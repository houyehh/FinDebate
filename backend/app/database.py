from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field

from app.debate import JudgedDebate
from app.market_data import get_ticker_snapshot
from app.settings import DATABASE_PATH

VerdictSide = Literal["bull", "bear", "neutral"]


class VerdictRecord(BaseModel):
    id: int
    debate_id: int
    side: VerdictSide
    confidence: int = Field(ge=1, le=5)
    judge_side: VerdictSide
    judge_agreement: bool
    price_at_verdict: float
    created_at: str


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
