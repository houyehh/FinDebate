import sqlite3
from pathlib import Path
from uuid import uuid4

from fastapi.testclient import TestClient

from app import practice
from app.main import app


def _database_file() -> Path:
    return Path("data") / f"test_{uuid4().hex}.db"


def test_practice_dashboard_hides_answers_and_shows_dimensions(monkeypatch) -> None:
    monkeypatch.setenv("DATABASE_PATH", str(_database_file()))
    monkeypatch.setenv("PRACTICE_DISABLE_RANDOM", "1")
    client = TestClient(app)

    response = client.get("/api/practice")

    assert response.status_code == 200
    body = response.json()
    assert body["stats"]["total_attempts"] == 0
    assert len(body["questions"]) >= 5
    first_question = body["questions"][0]
    assert first_question["id"] == "nvda-historical-ai-snapshot"
    assert "answer_side" not in first_question
    assert "outcome_pct" not in first_question
    assert "future_results" not in first_question
    assert first_question["market_window"]
    assert first_question["technical_snapshot"]
    assert first_question["fundamental_snapshot"]
    assert first_question["chip_snapshot"]
    assert first_question["ai_snapshot"]["suggested_side"] in {"bull", "bear", "neutral"}
    assert first_question["training_goal"]


def test_practice_dashboard_falls_back_when_random_generation_fails(monkeypatch) -> None:
    monkeypatch.setenv("DATABASE_PATH", str(_database_file()))

    def fail_generation(_language: str) -> practice.PracticeCase:
        raise RuntimeError("live data unavailable")

    monkeypatch.setattr(practice, "generate_random_market_case", fail_generation)
    client = TestClient(app)

    response = client.get("/api/practice?refresh_random=true")

    assert response.status_code == 200
    body = response.json()
    first_question = body["questions"][0]
    assert first_question["ticker"] == "DEMO"
    assert first_question["market_window"]
    assert first_question["ai_snapshot"] is not None


def test_practice_attempt_persists_weights_feedback_and_future_results(monkeypatch) -> None:
    database_file = _database_file()
    monkeypatch.setenv("DATABASE_PATH", str(database_file))
    monkeypatch.setenv("PRACTICE_DISABLE_RANDOM", "1")
    client = TestClient(app)

    response = client.post(
        "/api/practice/attempts",
        json={
            "question_id": "aapl-historical-quality-snapshot",
            "side": "bull",
            "confidence": 5,
            "rationale": "The chart is above MA20, but MACD and volume risk may matter.",
            "language": "en",
            "weights": {"technical": 40, "fundamental": 20, "chip": 20, "ai": 20},
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["ticker"] == "AAPL"
    assert body["answer_side"] in {"bull", "bear", "neutral"}
    assert body["weights"] == {"technical": 40, "fundamental": 20, "chip": 20, "ai": 20}
    assert body["future_results"]
    assert body["feedback"]["probable_causes"]
    assert body["feedback"]["suggested_framework"]
    assert body["ai_side"] in {"bull", "bear", "neutral"}

    with sqlite3.connect(database_file) as connection:
        row = connection.execute(
            "SELECT question_id, selected_side, weights_json, ai_side FROM practice_attempts"
        ).fetchone()

    assert row[0] == "aapl-historical-quality-snapshot"
    assert row[1] == "bull"
    assert '"technical":40' in row[2].replace(" ", "")
    assert row[3] in {"bull", "bear", "neutral"}

    dashboard = client.get("/api/practice").json()
    assert dashboard["stats"]["total_attempts"] == 1
    assert dashboard["recent_attempts"][0]["question_id"] == "aapl-historical-quality-snapshot"


def test_practice_dashboard_handles_legacy_attempt_without_question_case(monkeypatch) -> None:
    database_file = _database_file()
    monkeypatch.setenv("DATABASE_PATH", str(database_file))
    monkeypatch.setenv("PRACTICE_DISABLE_RANDOM", "1")
    practice.init_db()
    with practice.connect() as connection:
        connection.execute(
            """
            INSERT INTO practice_attempts (
                question_id, selected_side, confidence, rationale, answer_side,
                outcome_pct, result, feedback_json, created_at,
                weights_json, ai_side, ai_agreement
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "nvda-ai-guidance",
                "bull",
                3,
                "Old demo attempt.",
                "bull",
                8.4,
                "correct",
                '{"summary":"Legacy feedback","probable_causes":[],"improvement_steps":[],"focus_tags":["legacy"]}',
                "2026-07-20T00:00:00+00:00",
                "{}",
                None,
                None,
            ),
        )
    client = TestClient(app)

    response = client.get("/api/practice?refresh_random=false")

    assert response.status_code == 200
    recent = response.json()["recent_attempts"][0]
    assert recent["question_id"] == "nvda-ai-guidance"
    assert recent["ticker"] == "NVDA"
    assert recent["future_results"] == []


def test_indicator_summary_handles_legacy_points_without_indicators() -> None:
    point = practice.MarketIndicatorPoint(
        date="2026-01-02",
        open=100,
        high=102,
        low=99,
        close=101,
        volume=1_000_000,
    )

    summary = practice._indicator_summary(point, [point], False)

    assert "N/A" in summary[2]
    assert "N/A" in summary[3]


def test_practice_attempt_rejects_weights_that_do_not_sum_to_100(monkeypatch) -> None:
    monkeypatch.setenv("DATABASE_PATH", str(_database_file()))
    monkeypatch.setenv("PRACTICE_DISABLE_RANDOM", "1")
    client = TestClient(app)

    response = client.post(
        "/api/practice/attempts",
        json={
            "question_id": "nvda-historical-ai-snapshot",
            "side": "neutral",
            "confidence": 3,
            "rationale": "No clear edge.",
            "weights": {"technical": 50, "fundamental": 20, "chip": 20, "ai": 20},
        },
    )

    assert response.status_code == 400
    assert "100" in response.json()["detail"]["message"]


def test_unknown_practice_question_returns_friendly_error(monkeypatch) -> None:
    monkeypatch.setenv("DATABASE_PATH", str(_database_file()))
    monkeypatch.setenv("PRACTICE_DISABLE_RANDOM", "1")
    client = TestClient(app)

    response = client.post(
        "/api/practice/attempts",
        json={
            "question_id": "missing",
            "side": "neutral",
            "confidence": 3,
            "rationale": "No edge.",
        },
    )

    assert response.status_code == 404
    assert "Unknown practice question" in response.json()["detail"]["message"]


def test_random_market_question_contains_historical_factor_snapshots(monkeypatch) -> None:
    rows = []
    for index in range(120):
        close = 100 + index * 0.6
        rows.append(
            {
                "date": f"2026-03-{index + 1:02d}",
                "open": close - 0.4,
                "high": close + 1.1,
                "low": close - 1.0,
                "close": close,
                "volume": 1_000_000 + index * 10_000,
            }
        )
    monkeypatch.setattr(practice, "_history_rows_for_ticker", lambda _ticker: rows)
    monkeypatch.setattr(practice, "_fundamental_snapshot", lambda _ticker: [practice.SnapshotMetric(label="Revenue", value="+10%")])
    monkeypatch.setattr(practice.random, "choice", lambda _items: "NVDA")
    monkeypatch.setattr(practice.random, "randint", lambda start, _end: start)

    question = practice.generate_random_market_case("en")

    assert question.id.startswith("history-NVDA-")
    assert question.market_window
    assert question.indicator_summary
    assert question.answer_side in {"bull", "bear", "neutral"}
    assert len(question.future_results) == 3
    assert question.technical_snapshot
    assert question.fundamental_snapshot
    assert question.chip_snapshot
    assert question.ai_snapshot is not None
    last_point = question.market_window[-1]
    assert last_point.k is not None
    assert last_point.d is not None
    assert last_point.macd is not None
    assert last_point.rsi is not None
