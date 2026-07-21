import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

from fastapi.testclient import TestClient

from app import database
from app.debate import (
    DebateClaim,
    JudgeItemScore,
    JudgeResult,
    JudgedDebate,
    OpeningRound,
    Rebuttal,
    RebuttalRound,
)
from app.main import app


def _judged_debate() -> JudgedDebate:
    bull = OpeningRound(
        side="bull",
        claims=[
            DebateClaim(
                claim_id=f"BULL-{index}",
                claim=f"Bull claim {index}",
                evidence=f"Bull evidence {index}",
                source_url="https://example.com/bull",
                source_name="Bull Source",
            )
            for index in range(1, 4)
        ],
    )
    bear = OpeningRound(
        side="bear",
        claims=[
            DebateClaim(
                claim_id=f"BEAR-{index}",
                claim=f"Bear claim {index}",
                evidence=f"Bear evidence {index}",
                source_url="https://example.com/bear",
                source_name="Bear Source",
            )
            for index in range(1, 4)
        ],
    )
    bull_rebuttals = RebuttalRound(
        side="bull",
        rebuttals=[
            Rebuttal(
                target_claim_id="BEAR-1",
                rebuttal="Bull rebuttal 1",
                evidence="Bull rebuttal evidence 1",
                source_url="https://example.com/bull/rebuttal-1",
            ),
            Rebuttal(
                target_claim_id="BEAR-2",
                rebuttal="Bull rebuttal 2",
                evidence="Bull rebuttal evidence 2",
                source_url="https://example.com/bull/rebuttal-2",
            ),
        ],
    )
    bear_rebuttals = RebuttalRound(
        side="bear",
        rebuttals=[
            Rebuttal(
                target_claim_id="BULL-1",
                rebuttal="Bear rebuttal 1",
                evidence="Bear rebuttal evidence 1",
                source_url="https://example.com/bear/rebuttal-1",
            ),
            Rebuttal(
                target_claim_id="BULL-2",
                rebuttal="Bear rebuttal 2",
                evidence="Bear rebuttal evidence 2",
                source_url="https://example.com/bear/rebuttal-2",
            ),
        ],
    )
    scores = [
        JudgeItemScore(
            item_id=item_id,
            side=side,
            item_type=item_type,
            evidence_score=5,
            source_score=5,
            logic_score=5,
            flag="none",
            flag_reason="",
        )
        for item_id, side, item_type in [
            ("BULL-1", "bull", "claim"),
            ("BULL-2", "bull", "claim"),
            ("BULL-3", "bull", "claim"),
            ("BEAR-1", "bear", "claim"),
            ("BEAR-2", "bear", "claim"),
            ("BEAR-3", "bear", "claim"),
            ("BULL-REB-1", "bull", "rebuttal"),
            ("BULL-REB-2", "bull", "rebuttal"),
            ("BEAR-REB-1", "bear", "rebuttal"),
            ("BEAR-REB-2", "bear", "rebuttal"),
        ]
    ]
    judge = JudgeResult(
        scores=scores,
        bull_total=75,
        bear_total=60,
        summary="Bull has stronger evidence quality.",
    )

    return JudgedDebate(
        ticker="NVDA",
        language="zh-Hant",
        generated_at="2026-07-18T00:00:00+00:00",
        bull=bull,
        bear=bear,
        bull_rebuttals=bull_rebuttals,
        bear_rebuttals=bear_rebuttals,
        price_at_debate=123.45,
        currency="USD",
        judge=judge,
    )


def test_submit_verdict_persists_debate_and_verdict(monkeypatch) -> None:
    database_file = Path("data") / f"test_{uuid4().hex}.db"
    monkeypatch.setenv("DATABASE_PATH", str(database_file))
    monkeypatch.setattr(database, "_current_price_or_debate_price", lambda _debate: 124.0)
    client = TestClient(app)

    response = client.post(
        "/api/verdicts",
        json={
            "debate": _judged_debate().model_dump(mode="json"),
            "side": "bull",
            "confidence": 4,
            "note": "Evidence quality looked stronger.",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["judge_side"] == "bull"
    assert body["judge_agreement"] is True
    assert body["price_at_verdict"] == 124.0

    with sqlite3.connect(database_file) as connection:
        debate_row = connection.execute(
            "SELECT ticker, bull_json, judge_json FROM debates"
        ).fetchone()
        verdict_row = connection.execute(
            "SELECT side, confidence, note, judge_agreement FROM verdicts"
        ).fetchone()

    assert debate_row[0] == "NVDA"
    assert "Bull claim 1" in debate_row[1]
    assert "Bull has stronger evidence quality" in debate_row[2]
    assert verdict_row == ("bull", 4, "Evidence quality looked stronger.", 1)


def test_scoreboard_refreshes_settlements_and_stats(monkeypatch) -> None:
    database_file = Path("data") / f"test_{uuid4().hex}.db"
    monkeypatch.setenv("DATABASE_PATH", str(database_file))
    monkeypatch.setattr(database, "get_close_near_date", lambda _ticker, _target_date: 110.0)
    created_at = (datetime.now(timezone.utc) - timedelta(days=8)).isoformat()

    database.insert_demo_verdict(
        ticker="NVDA",
        side="bull",
        confidence=5,
        note="High confidence winner.",
        created_at=created_at,
        price_at_verdict=100.0,
        judge_side="bull",
    )
    database.insert_demo_verdict(
        ticker="AAPL",
        side="bear",
        confidence=2,
        note="Low confidence loser.",
        created_at=created_at,
        price_at_verdict=100.0,
        judge_side="bull",
    )

    scoreboard = database.get_scoreboard()

    assert scoreboard.stats.total_verdicts == 2
    assert scoreboard.stats.win_rate_7d == 50.0
    assert scoreboard.stats.bull_count == 1
    assert scoreboard.stats.bear_count == 1
    assert scoreboard.stats.high_confidence_win_rate_7d == 100.0
    assert scoreboard.stats.low_confidence_win_rate_7d == 0.0
    assert scoreboard.stats.judge_agreement_rate == 50.0
    assert scoreboard.stats.aligned_win_rate_7d == 100.0
    assert scoreboard.stats.unaligned_win_rate_7d == 0.0

    first_record = next(record for record in scoreboard.records if record.ticker == "NVDA")
    seven_day = next(settlement for settlement in first_record.settlements if settlement.horizon == "7d")
    assert seven_day.settle_price == 110.0
    assert seven_day.pct_change == 10.0
    assert seven_day.result == "win"

    client = TestClient(app)
    updated = client.patch(
        f"/api/records/{first_record.id}",
        json={
            "side": "bear",
            "confidence": 3,
            "note": "Changed after review.",
            "review_note": "I ignored the settlement direction.",
        },
    )
    assert updated.status_code == 200
    updated_body = updated.json()
    assert updated_body["side"] == "bear"
    assert updated_body["review_note"] == "I ignored the settlement direction."
    updated_7d = next(settlement for settlement in updated_body["settlements"] if settlement["horizon"] == "7d")
    assert updated_7d["result"] == "loss"

    deleted = client.delete(f"/api/records/{first_record.id}")
    assert deleted.status_code == 200
