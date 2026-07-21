import json
import sqlite3
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app import practice
from app.main import app


def _database_file() -> Path:
    return Path("data") / f"test_{uuid4().hex}.db"


@pytest.fixture(autouse=True)
def disable_openai_ai(monkeypatch) -> None:
    monkeypatch.setattr(practice, "_should_use_openai_ai", lambda: False)


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
    assert first_question["evidence_pack"]
    assert first_question["ai_debate"]["bull"]["claims"]
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


def test_ai_snapshot_uses_openai_in_api_mode(monkeypatch) -> None:
    monkeypatch.setattr(practice, "_should_use_openai_ai", lambda: True)
    monkeypatch.setattr(practice, "get_openai_model", lambda: "gpt-test")
    point = practice.MarketIndicatorPoint(
        date="2026-05-01",
        open=100,
        high=105,
        low=99,
        close=104,
        volume=1_200_000,
        ma5=102,
        ma20=98,
        macd_hist=0.4,
    )

    class FakeResponse:
        output_text = json.dumps(
            {
                "suggested_side": "bull",
                "confidence": 4,
                "bull_thesis": "OpenAI bull thesis tied to MA and news evidence.",
                "bear_thesis": "OpenAI bear thesis flags valuation risk.",
                "narrative": "Investors may be repricing AI demand.",
                "hard_to_quantify_factors": ["Positioning", "Management credibility", "Narrative crowding"],
                "key_uncertainty": "The thesis fails if volume fades.",
                "checklist": ["Verify source URLs", "Compare MACD", "Check valuation"],
            }
        )

    monkeypatch.setattr(practice, "_create_openai_response", lambda **_kwargs: FakeResponse())

    snapshot = practice.build_ai_snapshot(
        "NVDA",
        point,
        [point],
        [practice.SnapshotMetric(label="MACD hist", value="+0.40", tone="bull")],
        [practice.SnapshotMetric(label="Trailing PE", value="32.4", tone="neutral")],
        [practice.SnapshotMetric(label="Recent news", value="AI demand theme", tone="bull")],
        [],
        language="en",
    )

    assert snapshot.source == "openai:gpt-test"
    assert snapshot.suggested_side == "bull"
    assert "OpenAI bull thesis" in snapshot.bull_thesis


def test_ai_snapshot_falls_back_when_openai_fails(monkeypatch) -> None:
    monkeypatch.setattr(practice, "_should_use_openai_ai", lambda: True)
    point = practice.MarketIndicatorPoint(
        date="2026-05-01",
        open=100,
        high=105,
        low=99,
        close=104,
        volume=1_200_000,
        ma5=102,
        ma20=98,
        macd_hist=0.4,
    )

    def fail_openai(**_kwargs):
        raise RuntimeError("quota exceeded")

    monkeypatch.setattr(practice, "_create_openai_response", fail_openai)

    snapshot = practice.build_ai_snapshot("NVDA", point, [point], [], [], [], [], language="en")

    assert snapshot.source == "deterministic_ai_coach_fallback"
    assert snapshot.fallback_reason == "quota exceeded"


def test_ai_debate_uses_openai_and_validates_evidence_refs(monkeypatch) -> None:
    monkeypatch.setattr(practice, "_should_use_openai_ai", lambda: True)
    monkeypatch.setattr(practice, "get_openai_model", lambda: "gpt-test")
    evidence = [
        practice.EvidenceItem(
            evidence_id="T1",
            category="technical",
            title="MACD",
            value="+0.40",
            detail="Positive momentum",
            tone="bull",
        ),
        practice.EvidenceItem(
            evidence_id="F1",
            category="fundamental",
            title="Trailing PE",
            value="32.4",
            detail="Valuation context",
            tone="warn",
        ),
    ]
    payload = {
        "bull": {
            "side": "bull",
            "claims": [
                {"claim_id": "BULL-1", "claim": "Bull 1", "evidence": "Uses T1", "evidence_refs": ["T1"], "source_url": "https://finance.yahoo.com/", "source_name": "Yahoo Finance"},
                {"claim_id": "BULL-2", "claim": "Bull 2", "evidence": "Uses T1", "evidence_refs": ["T1"], "source_url": "https://finance.yahoo.com/", "source_name": "Yahoo Finance"},
                {"claim_id": "BULL-3", "claim": "Bull 3", "evidence": "Uses T1", "evidence_refs": ["T1"], "source_url": "https://finance.yahoo.com/", "source_name": "Yahoo Finance"},
            ],
        },
        "bear": {
            "side": "bear",
            "claims": [
                {"claim_id": "BEAR-1", "claim": "Bear 1", "evidence": "Uses F1", "evidence_refs": ["F1"], "source_url": "https://finance.yahoo.com/", "source_name": "Yahoo Finance"},
                {"claim_id": "BEAR-2", "claim": "Bear 2", "evidence": "Uses F1", "evidence_refs": ["F1"], "source_url": "https://finance.yahoo.com/", "source_name": "Yahoo Finance"},
                {"claim_id": "BEAR-3", "claim": "Bear 3", "evidence": "Uses F1", "evidence_refs": ["F1"], "source_url": "https://finance.yahoo.com/", "source_name": "Yahoo Finance"},
            ],
        },
        "bull_rebuttals": {
            "side": "bull",
            "rebuttals": [
                {"target_claim_id": "BEAR-1", "rebuttal": "Bull rebuts", "evidence": "Uses T1", "evidence_refs": ["T1"], "source_url": "https://finance.yahoo.com/"},
                {"target_claim_id": "BEAR-2", "rebuttal": "Bull rebuts", "evidence": "Uses T1", "evidence_refs": ["T1"], "source_url": "https://finance.yahoo.com/"},
            ],
        },
        "bear_rebuttals": {
            "side": "bear",
            "rebuttals": [
                {"target_claim_id": "BULL-1", "rebuttal": "Bear rebuts", "evidence": "Uses F1", "evidence_refs": ["F1"], "source_url": "https://finance.yahoo.com/"},
                {"target_claim_id": "BULL-2", "rebuttal": "Bear rebuts", "evidence": "Uses F1", "evidence_refs": ["F1"], "source_url": "https://finance.yahoo.com/"},
            ],
        },
        "judge": {
            "scores": [
                {"item_id": item_id, "side": "bull" if item_id.startswith("BULL") else "bear", "item_type": "rebuttal" if "REB" in item_id else "claim", "evidence_score": 4, "source_score": 4, "logic_score": 4, "flag": "none", "flag_reason": ""}
                for item_id in ["BULL-1", "BULL-2", "BULL-3", "BEAR-1", "BEAR-2", "BEAR-3", "BULL-REB-1", "BULL-REB-2", "BEAR-REB-1", "BEAR-REB-2"]
            ],
            "bull_total": 1,
            "bear_total": 1,
            "summary": "OpenAI debate grounded in supplied evidence.",
        },
    }

    class FakeResponse:
        output_text = json.dumps(payload)

    monkeypatch.setattr(practice, "_create_openai_response", lambda **_kwargs: FakeResponse())

    debate = practice.build_ai_debate("NVDA", evidence, ["bull"], ["bear"], None, False)

    assert debate.source == "openai:gpt-test"
    assert debate.judge.bull_total == 60
    assert debate.judge.bear_total == 60


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
    assert "MACD" in body["feedback"]["diagnosis"] or "MACD" in " ".join(body["feedback"]["good_reasoning"])
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

    attempt_id = body["id"]
    updated = client.patch(
        f"/api/practice/attempts/{attempt_id}",
        json={
            "selected_side": "neutral",
            "confidence": 2,
            "rationale": "After review, the edge looked weaker.",
            "review_note": "Overweighted the original trend.",
            "language": "en",
            "weights": {"technical": 40, "fundamental": 20, "chip": 20, "ai": 20},
        },
    )
    assert updated.status_code == 200
    updated_body = updated.json()
    assert updated_body["selected_side"] == "neutral"
    assert updated_body["review_note"] == "Overweighted the original trend."
    assert updated_body["feedback"]["summary"]

    deleted = client.delete(f"/api/practice/attempts/{attempt_id}")
    assert deleted.status_code == 200
    dashboard = client.get("/api/practice").json()
    assert dashboard["stats"]["total_attempts"] == 0


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
    monkeypatch.setattr(practice, "_fundamental_snapshot", lambda _ticker, as_of=None: [practice.SnapshotMetric(label="Revenue", value="+10%")])
    monkeypatch.setattr(practice, "_news_snapshot", lambda _ticker, as_of=None: [practice.SnapshotMetric(label="As-of news", value="AI demand theme")])
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
    assert question.news_snapshot
    assert question.chip_snapshot
    assert question.ai_snapshot is not None
    assert question.evidence_pack
    assert question.ai_debate is not None
    last_point = question.market_window[-1]
    assert last_point.k is not None
    assert last_point.d is not None
    assert last_point.macd is not None
    assert last_point.rsi is not None
    assert last_point.ma10 is not None
    assert last_point.bb_upper is not None
    assert last_point.bb_middle is not None
    assert last_point.bb_lower is not None
    assert any(metric.label == "Bollinger" for metric in question.technical_snapshot)


def test_news_snapshot_filters_future_headlines(monkeypatch) -> None:
    class FakeTicker:
        info = {"sector": "Technology", "industry": "Software"}
        news = [
            {"title": "future headline", "publisher": "Future Wire", "providerPublishTime": 1706745600},
            {"title": "past headline", "publisher": "Past Wire", "providerPublishTime": 1704412800},
        ]

    monkeypatch.setattr(practice.yf, "Ticker", lambda _ticker: FakeTicker())

    metrics = practice._news_snapshot("SMALL", as_of="2024-01-10")
    text = " ".join(f"{metric.label} {metric.value} {metric.detail}" for metric in metrics)

    assert "past headline" in text
    assert "Future Wire" not in text
    assert "future headline" not in text


def test_fundamental_snapshot_hides_latest_ratios_without_asof_backfill(monkeypatch) -> None:
    class EmptyFinancials:
        empty = True

    class FakeTicker:
        info = {"marketCap": 999_000_000_000, "trailingPE": 88}
        quarterly_financials = EmptyFinancials()

    monkeypatch.setattr(practice.yf, "Ticker", lambda _ticker: FakeTicker())

    metrics = practice._fundamental_snapshot("SMALL", as_of="2024-01-10")
    text = " ".join(f"{metric.label} {metric.value} {metric.detail}" for metric in metrics)

    assert "Historical financials" in text
    assert "Point-in-time valuation" in text
    assert "999.00B" not in text
    assert "88" not in text


def test_fundamental_snapshot_includes_live_valuation_ratios(monkeypatch) -> None:
    class FakeTicker:
        info = {
            "marketCap": 500_000_000_000,
            "trailingPE": 32.4,
            "forwardPE": 28.1,
            "priceToSalesTrailing12Months": 12.2,
            "pegRatio": 1.7,
            "trailingEps": 4.56,
            "forwardEps": 5.25,
            "grossMargins": 0.68,
            "operatingMargins": 0.31,
            "profitMargins": 0.24,
            "debtToEquity": 45.0,
            "currentRatio": 1.8,
            "returnOnEquity": 0.29,
        }

    monkeypatch.setattr(practice.yf, "Ticker", lambda _ticker: FakeTicker())

    metrics = practice._fundamental_snapshot("SMALL")
    labels = {metric.label: metric for metric in metrics}

    assert labels["Trailing PE"].value == "32.4"
    assert labels["Forward PE"].value == "28.1"
    assert labels["Price/Sales"].value == "12.2"
    assert labels["PEG ratio"].value == "1.70"
    assert labels["Trailing EPS"].value == "4.56"
    assert labels["Gross margin"].value == "68.0%"
    assert labels["Trailing PE"].source_url.endswith("/quote/SMALL/")
