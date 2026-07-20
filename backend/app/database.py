from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timezone
from datetime import timedelta
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field

from app.debate import JudgedDebate
from app.market_data import get_close_near_date, get_ticker_snapshot
from app.settings import DATABASE_PATH

VerdictSide = Literal["bull", "bear", "neutral"]
HORIZONS = {"1d": 1, "7d": 7, "30d": 30}


class VerdictRecord(BaseModel):
    id: int
    debate_id: int
    side: VerdictSide
    confidence: int = Field(ge=1, le=5)
    judge_side: VerdictSide
    judge_agreement: bool
    price_at_verdict: float
    created_at: str


class SettlementRecord(BaseModel):
    horizon: str
    settle_price: float | None
    pct_change: float | None
    result: str
    settled_at: str | None


class VerdictHistoryRecord(BaseModel):
    id: int
    debate_id: int
    ticker: str
    side: VerdictSide
    confidence: int
    note: str
    price_at_verdict: float
    created_at: str
    judge_side: VerdictSide
    judge_agreement: bool
    settlements: list[SettlementRecord]


class ScoreboardStats(BaseModel):
    total_verdicts: int
    win_rate_7d: float | None
    bull_count: int
    bear_count: int
    neutral_count: int
    high_confidence_win_rate_7d: float | None
    low_confidence_win_rate_7d: float | None
    judge_agreement_rate: float | None
    aligned_win_rate_7d: float | None
    unaligned_win_rate_7d: float | None


class ScoreboardResponse(BaseModel):
    stats: ScoreboardStats
    records: list[VerdictHistoryRecord]


def database_path() -> Path:
    return Path(os.getenv("DATABASE_PATH", DATABASE_PATH))


def connect() -> sqlite3.Connection:
    path = database_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    return connection


def init_db() -> None:
    with connect() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS debates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticker TEXT NOT NULL,
                created_at TEXT NOT NULL,
                language TEXT NOT NULL,
                bull_json TEXT NOT NULL,
                bear_json TEXT NOT NULL,
                judge_json TEXT NOT NULL,
                price_at_debate REAL NOT NULL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS verdicts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                debate_id INTEGER NOT NULL,
                side TEXT NOT NULL,
                confidence INTEGER NOT NULL,
                note TEXT NOT NULL,
                price_at_verdict REAL NOT NULL,
                judge_side TEXT NOT NULL,
                judge_agreement INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (debate_id) REFERENCES debates(id)
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS settlements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                verdict_id INTEGER NOT NULL,
                horizon TEXT NOT NULL,
                settle_price REAL,
                pct_change REAL,
                result TEXT NOT NULL,
                settled_at TEXT,
                FOREIGN KEY (verdict_id) REFERENCES verdicts(id)
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS practice_attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                question_id TEXT NOT NULL,
                selected_side TEXT NOT NULL,
                confidence INTEGER NOT NULL,
                rationale TEXT NOT NULL,
                answer_side TEXT NOT NULL,
                outcome_pct REAL NOT NULL,
                result TEXT NOT NULL,
                feedback_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS practice_questions (
                question_id TEXT PRIMARY KEY,
                case_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )


def save_verdict(
    debate: JudgedDebate,
    side: VerdictSide,
    confidence: int,
    note: str,
) -> VerdictRecord:
    init_db()
    now = datetime.now(timezone.utc).isoformat()
    judge_side = judge_leading_side(debate)
    judge_agreement = side == judge_side
    price_at_verdict = _current_price_or_debate_price(debate)

    bull_json = {
        "opening": debate.bull.model_dump(mode="json"),
        "rebuttals": debate.bull_rebuttals.model_dump(mode="json"),
    }
    bear_json = {
        "opening": debate.bear.model_dump(mode="json"),
        "rebuttals": debate.bear_rebuttals.model_dump(mode="json"),
    }

    with connect() as connection:
        debate_cursor = connection.execute(
            """
            INSERT INTO debates (
                ticker, created_at, language, bull_json, bear_json, judge_json, price_at_debate
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                debate.ticker,
                debate.generated_at,
                debate.language,
                json.dumps(bull_json, ensure_ascii=False),
                json.dumps(bear_json, ensure_ascii=False),
                debate.judge.model_dump_json(),
                debate.price_at_debate,
            ),
        )
        debate_id = int(debate_cursor.lastrowid)
        verdict_cursor = connection.execute(
            """
            INSERT INTO verdicts (
                debate_id, side, confidence, note, price_at_verdict,
                judge_side, judge_agreement, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                debate_id,
                side,
                confidence,
                note,
                price_at_verdict,
                judge_side,
                int(judge_agreement),
                now,
            ),
        )
        verdict_id = int(verdict_cursor.lastrowid)
        _create_pending_settlements(connection, verdict_id)

    return VerdictRecord(
        id=verdict_id,
        debate_id=debate_id,
        side=side,
        confidence=confidence,
        judge_side=judge_side,
        judge_agreement=judge_agreement,
        price_at_verdict=price_at_verdict,
        created_at=now,
    )


def judge_leading_side(debate: JudgedDebate) -> VerdictSide:
    if debate.judge.bull_total > debate.judge.bear_total:
        return "bull"
    if debate.judge.bear_total > debate.judge.bull_total:
        return "bear"
    return "neutral"


def _current_price_or_debate_price(debate: JudgedDebate) -> float:
    try:
        return get_ticker_snapshot(debate.ticker).price
    except Exception:
        return debate.price_at_debate


def get_scoreboard() -> ScoreboardResponse:
    refresh_pending_settlements()

    with connect() as connection:
        rows = connection.execute(
            """
            SELECT
                v.id, v.debate_id, d.ticker, v.side, v.confidence, v.note,
                v.price_at_verdict, v.created_at, v.judge_side, v.judge_agreement
            FROM verdicts v
            JOIN debates d ON d.id = v.debate_id
            ORDER BY v.created_at DESC, v.id DESC
            """
        ).fetchall()

        records: list[VerdictHistoryRecord] = []
        for row in rows:
            settlement_rows = connection.execute(
                """
                SELECT horizon, settle_price, pct_change, result, settled_at
                FROM settlements
                WHERE verdict_id = ?
                ORDER BY CASE horizon WHEN '1d' THEN 1 WHEN '7d' THEN 2 ELSE 3 END
                """,
                (row["id"],),
            ).fetchall()
            records.append(
                VerdictHistoryRecord(
                    id=row["id"],
                    debate_id=row["debate_id"],
                    ticker=row["ticker"],
                    side=row["side"],
                    confidence=row["confidence"],
                    note=row["note"],
                    price_at_verdict=row["price_at_verdict"],
                    created_at=row["created_at"],
                    judge_side=row["judge_side"],
                    judge_agreement=bool(row["judge_agreement"]),
                    settlements=[
                        SettlementRecord(
                            horizon=settlement["horizon"],
                            settle_price=settlement["settle_price"],
                            pct_change=settlement["pct_change"],
                            result=settlement["result"],
                            settled_at=settlement["settled_at"],
                        )
                        for settlement in settlement_rows
                    ],
                )
            )

    return ScoreboardResponse(stats=_scoreboard_stats(records), records=records)


def refresh_pending_settlements() -> None:
    init_db()
    now = datetime.now(timezone.utc)

    with connect() as connection:
        rows = connection.execute(
            """
            SELECT
                s.id, s.horizon, v.side, v.price_at_verdict,
                v.created_at, d.ticker
            FROM settlements s
            JOIN verdicts v ON v.id = s.verdict_id
            JOIN debates d ON d.id = v.debate_id
            WHERE s.result = 'pending'
            """
        ).fetchall()

        for row in rows:
            verdict_created_at = datetime.fromisoformat(row["created_at"])
            if verdict_created_at.tzinfo is None:
                verdict_created_at = verdict_created_at.replace(tzinfo=timezone.utc)
            target_at = verdict_created_at + timedelta(days=HORIZONS[row["horizon"]])
            if now < target_at:
                continue

            settle_price = get_close_near_date(row["ticker"], target_at.date())
            if settle_price is None:
                continue

            pct_change = round(
                ((settle_price - row["price_at_verdict"]) / row["price_at_verdict"]) * 100,
                4,
            )
            result = _settlement_result(row["side"], pct_change)
            connection.execute(
                """
                UPDATE settlements
                SET settle_price = ?, pct_change = ?, result = ?, settled_at = ?
                WHERE id = ?
                """,
                (settle_price, pct_change, result, now.isoformat(), row["id"]),
            )


def insert_demo_verdict(
    ticker: str,
    side: VerdictSide,
    confidence: int,
    note: str,
    created_at: str,
    price_at_verdict: float,
    judge_side: VerdictSide,
) -> int:
    init_db()
    judge_agreement = side == judge_side
    demo_judge = {
        "summary": "Demo seeded debate for scoreboard backtesting.",
        "bull_total": 45 if judge_side == "bull" else 40,
        "bear_total": 45 if judge_side == "bear" else 40,
        "scores": [],
    }
    demo_claim = {
        "claims": [
            {
                "claim_id": f"{side.upper()}-DEMO-1",
                "claim": "Demo seeded claim",
                "evidence": "Historical price seeded for demo.",
                "source_url": "https://finance.yahoo.com/",
                "source_name": "Yahoo Finance",
            }
        ]
    }

    with connect() as connection:
        debate_cursor = connection.execute(
            """
            INSERT INTO debates (
                ticker, created_at, language, bull_json, bear_json, judge_json, price_at_debate
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                ticker,
                created_at,
                "zh-Hant",
                json.dumps(demo_claim, ensure_ascii=False),
                json.dumps(demo_claim, ensure_ascii=False),
                json.dumps(demo_judge, ensure_ascii=False),
                price_at_verdict,
            ),
        )
        debate_id = int(debate_cursor.lastrowid)
        verdict_cursor = connection.execute(
            """
            INSERT INTO verdicts (
                debate_id, side, confidence, note, price_at_verdict,
                judge_side, judge_agreement, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                debate_id,
                side,
                confidence,
                note,
                price_at_verdict,
                judge_side,
                int(judge_agreement),
                created_at,
            ),
        )
        verdict_id = int(verdict_cursor.lastrowid)
        _create_pending_settlements(connection, verdict_id)

    return verdict_id


def _create_pending_settlements(connection: sqlite3.Connection, verdict_id: int) -> None:
    for horizon in HORIZONS:
        connection.execute(
            """
            INSERT INTO settlements (
                verdict_id, horizon, settle_price, pct_change, result, settled_at
            ) VALUES (?, ?, NULL, NULL, 'pending', NULL)
            """,
            (verdict_id, horizon),
        )


def _settlement_result(side: VerdictSide, pct_change: float) -> str:
    if abs(pct_change) <= 1:
        return "draw"
    if side == "bull":
        return "win" if pct_change > 1 else "loss"
    if side == "bear":
        return "win" if pct_change < -1 else "loss"
    return "loss"


def _scoreboard_stats(records: list[VerdictHistoryRecord]) -> ScoreboardStats:
    settled_7d = [
        (record, _settlement_for(record, "7d"))
        for record in records
        if _settlement_for(record, "7d") and _settlement_for(record, "7d").result != "pending"
    ]

    return ScoreboardStats(
        total_verdicts=len(records),
        win_rate_7d=_win_rate([settlement for _record, settlement in settled_7d]),
        bull_count=sum(1 for record in records if record.side == "bull"),
        bear_count=sum(1 for record in records if record.side == "bear"),
        neutral_count=sum(1 for record in records if record.side == "neutral"),
        high_confidence_win_rate_7d=_win_rate(
            [settlement for record, settlement in settled_7d if record.confidence >= 4]
        ),
        low_confidence_win_rate_7d=_win_rate(
            [settlement for record, settlement in settled_7d if record.confidence <= 2]
        ),
        judge_agreement_rate=_percentage(
            sum(1 for record in records if record.judge_agreement),
            len(records),
        ),
        aligned_win_rate_7d=_win_rate(
            [settlement for record, settlement in settled_7d if record.judge_agreement]
        ),
        unaligned_win_rate_7d=_win_rate(
            [settlement for record, settlement in settled_7d if not record.judge_agreement]
        ),
    )


def _settlement_for(record: VerdictHistoryRecord, horizon: str) -> SettlementRecord | None:
    return next(
        (settlement for settlement in record.settlements if settlement.horizon == horizon),
        None,
    )


def _win_rate(settlements: list[SettlementRecord]) -> float | None:
    if not settlements:
        return None
    wins = sum(1 for settlement in settlements if settlement.result == "win")
    return _percentage(wins, len(settlements))


def _percentage(numerator: int, denominator: int) -> float | None:
    if denominator == 0:
        return None
    return round((numerator / denominator) * 100, 1)
