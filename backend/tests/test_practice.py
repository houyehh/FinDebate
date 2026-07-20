import sqlite3
from pathlib import Path
from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app


def _database_file() -> Path:
    return Path("data") / f"test_{uuid4().hex}.db"


def test_practice_dashboard_hides_answers(monkeypatch) -> None:
    monkeypatch.setenv("DATABASE_PATH", str(_database_file()))
    client = TestClient(app)

    response = client.get("/api/practice")

    assert response.status_code == 200
    body = response.json()
    assert body["stats"]["total_attempts"] == 0
    assert len(body["questions"]) >= 5
    first_question = body["questions"][0]
    assert first_question["id"] == "nvda-ai-guidance"
    assert "answer_side" not in first_question
    assert "outcome_pct" not in first_question


def test_practice_attempt_persists_feedback_and_updates_stats(monkeypatch) -> None:
    database_file = _database_file()
    monkeypatch.setenv("DATABASE_PATH", str(database_file))
    client = TestClient(app)

    response = client.post(
        "/api/practice/attempts",
        json={
            "question_id": "aapl-guidance-pressure",
            "side": "bull",
            "confidence": 5,
            "rationale": "Buyback is good.",
            "language": "en",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["result"] == "wrong"
    assert body["answer_side"] == "bear"
    assert body["ticker"] == "AAPL"
    assert body["feedback"]["probable_causes"]
    assert "calibration" in body["feedback"]["focus_tags"]

    with sqlite3.connect(database_file) as connection:
        row = connection.execute(
            "SELECT question_id, selected_side, answer_side, result FROM practice_attempts"
        ).fetchone()

    assert row == ("aapl-guidance-pressure", "bull", "bear", "wrong")

    dashboard = client.get("/api/practice").json()
    assert dashboard["stats"]["total_attempts"] == 1
    assert dashboard["stats"]["accuracy_rate"] == 0.0
    assert dashboard["recent_attempts"][0]["question_id"] == "aapl-guidance-pressure"


def test_unknown_practice_question_returns_friendly_error(monkeypatch) -> None:
    monkeypatch.setenv("DATABASE_PATH", str(_database_file()))
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
