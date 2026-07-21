from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field

from app.database import VerdictSide, connect, init_db
from app.market_data import TickerLookupError, TickerSnapshot, get_ticker_snapshot
from app.practice import (
    AiDebate,
    AiSnapshot,
    EvidenceItem,
    JudgmentWeights,
    MarketIndicatorPoint,
    SnapshotMetric,
    _chip_snapshot,
    _factor_clues,
    _fundamental_snapshot,
    _history_rows_for_ticker,
    _indicator_points,
    _news_snapshot,
    _technical_snapshot,
    build_ai_snapshot,
    build_ai_debate,
    build_evidence_pack,
    localized_snapshot_metrics,
)


class LiveAnalysisResponse(BaseModel):
    ticker: str
    name: str
    as_of: str
    price: float
    currency: str
    market_window: list[MarketIndicatorPoint]
    technical_snapshot: list[SnapshotMetric]
    fundamental_snapshot: list[SnapshotMetric]
    news_snapshot: list[SnapshotMetric]
    chip_snapshot: list[SnapshotMetric]
    ai_snapshot: AiSnapshot
    evidence_pack: list[EvidenceItem]
    ai_debate: AiDebate
    bull_points: list[str]
    bear_points: list[str]
    data_note: str
    source_summary: str


PortfolioStatus = Literal["watching", "open", "closed"]


class PortfolioDecisionRequest(BaseModel):
    ticker: str = Field(min_length=1)
    side: VerdictSide
    confidence: int = Field(ge=1, le=5)
    rationale: str = ""
    language: str = "zh-Hant"
    weights: JudgmentWeights = Field(default_factory=JudgmentWeights)
    analysis: LiveAnalysisResponse | None = None
    entry_price: float | None = Field(default=None, gt=0)
    created_at: str | None = None
    currency: str | None = None
    status: PortfolioStatus = "open"
    exit_price: float | None = Field(default=None, gt=0)
    exit_at: str | None = None
    review_note: str = ""


class PortfolioDecisionUpdateRequest(BaseModel):
    ticker: str | None = Field(default=None, min_length=1)
    side: VerdictSide | None = None
    confidence: int | None = Field(default=None, ge=1, le=5)
    rationale: str | None = None
    price_at_decision: float | None = Field(default=None, gt=0)
    currency: str | None = None
    created_at: str | None = None
    status: PortfolioStatus | None = None
    exit_price: float | None = Field(default=None, gt=0)
    exit_at: str | None = None
    review_note: str | None = None


class PortfolioDecisionRecord(BaseModel):
    id: int
    ticker: str
    side: VerdictSide
    confidence: int
    rationale: str
    price_at_decision: float
    current_price: float | None
    pct_change: float | None
    currency: str
    created_at: str
    ai_side: VerdictSide | None = None
    ai_agreement: bool | None = None
    data_note: str
    status: PortfolioStatus = "open"
    exit_price: float | None = None
    exit_at: str | None = None
    review_note: str = ""


class PortfolioStats(BaseModel):
    total_decisions: int
    bull_count: int
    bear_count: int
    neutral_count: int
    open_count: int = 0
    closed_count: int = 0
    average_pct_change: float | None
    ai_agreement_rate: float | None


class PortfolioResponse(BaseModel):
    stats: PortfolioStats
    decisions: list[PortfolioDecisionRecord]


class PortfolioDecisionNotFoundError(ValueError):
    pass


def get_live_analysis(raw_ticker: str, language: str = "zh-Hant") -> LiveAnalysisResponse:
    snapshot = get_ticker_snapshot(raw_ticker)
    rows, source_note = _live_history_rows(snapshot)
    points = _indicator_points(rows)
    if not points:
        raise TickerLookupError(
            ticker=snapshot.ticker,
            message=f"We could not build live indicator data for {snapshot.ticker}.",
        )

    window = points[-90:]
    point = window[-1]
    technical = _technical_snapshot(point, window)
    fundamental = _fundamental_snapshot(snapshot.ticker)
    news = _news_snapshot(snapshot.ticker)
    chip = _chip_snapshot(point, window)
    ai = build_ai_snapshot(
        snapshot.ticker,
        point,
        window,
        technical,
        fundamental,
        news,
        chip,
        language=language,
    )
    technical = localized_snapshot_metrics(technical, language)
    fundamental = localized_snapshot_metrics(fundamental, language)
    news = localized_snapshot_metrics(news, language)
    chip = localized_snapshot_metrics(chip, language)
    bull_points, bear_points = _factor_clues(point, window, ai, language.startswith("zh"))
    evidence_pack = build_evidence_pack(
        snapshot.ticker,
        technical,
        fundamental,
        news,
        chip,
        ai,
        zh=language.startswith("zh"),
    )
    ai_debate = build_ai_debate(
        snapshot.ticker,
        evidence_pack,
        bull_points,
        bear_points,
        ai,
        language.startswith("zh"),
    )

    return LiveAnalysisResponse(
        ticker=snapshot.ticker,
        name=snapshot.name,
        as_of=point.date,
        price=snapshot.price,
        currency=snapshot.currency,
        market_window=window,
        technical_snapshot=technical,
        fundamental_snapshot=fundamental,
        news_snapshot=news,
        chip_snapshot=chip,
        ai_snapshot=ai,
        evidence_pack=evidence_pack,
        ai_debate=ai_debate,
        bull_points=bull_points,
        bear_points=bear_points,
        data_note=_live_data_note(point.date, source_note, language),
        source_summary=_source_summary(language),
    )


def save_portfolio_decision(request: PortfolioDecisionRequest) -> PortfolioDecisionRecord:
    init_db()
    analysis = request.analysis
    snapshot: TickerSnapshot | None = None
    if analysis is None and request.entry_price is None:
        analysis = get_live_analysis(request.ticker, request.language)
    if analysis is None:
        snapshot = get_ticker_snapshot(request.ticker)

    ticker = analysis.ticker if analysis is not None else snapshot.ticker
    price_at_decision = request.entry_price or analysis.price
    currency = request.currency or (analysis.currency if analysis is not None else snapshot.currency)
    created_at = _normalize_datetime(request.created_at)
    ai_side = analysis.ai_snapshot.suggested_side if analysis and analysis.ai_snapshot else None
    ai_agreement = request.side == ai_side if ai_side else None
    analysis_json = analysis.model_dump_json() if analysis is not None else json.dumps(
        {
            "source": "manual_portfolio_entry",
            "ticker": ticker,
            "entry_price": price_at_decision,
            "created_at": created_at,
        },
        ensure_ascii=False,
    )
    data_note = analysis.data_note if analysis is not None else _manual_data_note(request.language)

    with connect() as connection:
        cursor = connection.execute(
            """
            INSERT INTO portfolio_decisions (
                ticker, side, confidence, rationale, price_at_decision, currency,
                created_at, analysis_json, ai_side, ai_agreement, data_note,
                status, exit_price, exit_at, review_note
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                ticker,
                request.side,
                request.confidence,
                request.rationale,
                price_at_decision,
                currency,
                created_at,
                analysis_json,
                ai_side,
                int(ai_agreement) if ai_agreement is not None else None,
                data_note,
                request.status,
                request.exit_price,
                _normalize_datetime(request.exit_at, allow_empty=True),
                request.review_note,
            ),
        )
        decision_id = int(cursor.lastrowid)

    record = _portfolio_decision_by_id(decision_id)
    if record is None:
        raise PortfolioDecisionNotFoundError(f"Portfolio decision {decision_id} was not found.")
    return record


def get_portfolio() -> PortfolioResponse:
    init_db()
    with connect() as connection:
        rows = connection.execute(
            """
            SELECT
                id, ticker, side, confidence, rationale, price_at_decision,
                currency, created_at, ai_side, ai_agreement, data_note,
                status, exit_price, exit_at, review_note
            FROM portfolio_decisions
            ORDER BY created_at DESC, id DESC
            """
        ).fetchall()

    price_cache: dict[str, float | None] = {}
    decisions: list[PortfolioDecisionRecord] = []
    for row in rows:
        ticker = row["ticker"]
        if ticker not in price_cache:
            price_cache[ticker] = _current_price(ticker)
        current_price = price_cache[ticker]
        decisions.append(_portfolio_record_from_row(row, current_price))

    return PortfolioResponse(stats=_portfolio_stats(decisions), decisions=decisions)


def update_portfolio_decision(decision_id: int, request: PortfolioDecisionUpdateRequest) -> PortfolioDecisionRecord:
    init_db()
    with connect() as connection:
        row = connection.execute("SELECT * FROM portfolio_decisions WHERE id = ?", (decision_id,)).fetchone()
        if row is None:
            raise PortfolioDecisionNotFoundError(f"Portfolio decision {decision_id} was not found.")

        fields_set = request.model_fields_set
        ticker = request.ticker.strip().upper() if request.ticker is not None else row["ticker"]
        side = request.side or row["side"]
        confidence = request.confidence if request.confidence is not None else row["confidence"]
        rationale = row["rationale"] if request.rationale is None else request.rationale
        price_at_decision = request.price_at_decision if request.price_at_decision is not None else row["price_at_decision"]
        currency = request.currency or row["currency"]
        created_at = _normalize_datetime(request.created_at) if request.created_at is not None else row["created_at"]
        status = request.status or row["status"]
        exit_price = request.exit_price if "exit_price" in fields_set else row["exit_price"]
        exit_at = _normalize_datetime(request.exit_at, allow_empty=True) if "exit_at" in fields_set else row["exit_at"]
        review_note = row["review_note"] if request.review_note is None else request.review_note
        ai_side = row["ai_side"]
        ai_agreement = side == ai_side if ai_side else None

        connection.execute(
            """
            UPDATE portfolio_decisions
            SET ticker = ?, side = ?, confidence = ?, rationale = ?, price_at_decision = ?,
                currency = ?, created_at = ?, ai_agreement = ?, status = ?,
                exit_price = ?, exit_at = ?, review_note = ?
            WHERE id = ?
            """,
            (
                ticker,
                side,
                confidence,
                rationale,
                price_at_decision,
                currency,
                created_at,
                int(ai_agreement) if ai_agreement is not None else None,
                status,
                exit_price,
                exit_at,
                review_note,
                decision_id,
            ),
        )

    record = _portfolio_decision_by_id(decision_id)
    if record is None:
        raise PortfolioDecisionNotFoundError(f"Portfolio decision {decision_id} was not found.")
    return record


def delete_portfolio_decision(decision_id: int) -> None:
    init_db()
    with connect() as connection:
        cursor = connection.execute("DELETE FROM portfolio_decisions WHERE id = ?", (decision_id,))
        if cursor.rowcount == 0:
            raise PortfolioDecisionNotFoundError(f"Portfolio decision {decision_id} was not found.")


def _portfolio_decision_by_id(decision_id: int) -> PortfolioDecisionRecord | None:
    init_db()
    with connect() as connection:
        row = connection.execute("SELECT * FROM portfolio_decisions WHERE id = ?", (decision_id,)).fetchone()
    if row is None:
        return None
    return _portfolio_record_from_row(row, _current_price(row["ticker"]))


def _portfolio_record_from_row(row, current_price: float | None) -> PortfolioDecisionRecord:
    effective_price = row["exit_price"] if row["status"] == "closed" and row["exit_price"] is not None else current_price
    return PortfolioDecisionRecord(
        id=row["id"],
        ticker=row["ticker"],
        side=row["side"],
        confidence=row["confidence"],
        rationale=row["rationale"],
        price_at_decision=row["price_at_decision"],
        current_price=current_price,
        pct_change=_pct_change(row["price_at_decision"], effective_price),
        currency=row["currency"],
        created_at=row["created_at"],
        ai_side=row["ai_side"],
        ai_agreement=bool(row["ai_agreement"]) if row["ai_agreement"] is not None else None,
        data_note=row["data_note"],
        status=row["status"],
        exit_price=row["exit_price"],
        exit_at=row["exit_at"],
        review_note=row["review_note"],
    )


def _normalize_datetime(value: str | None, allow_empty: bool = False) -> str | None:
    if value is None or not value.strip():
        return None if allow_empty else datetime.now(timezone.utc).isoformat()
    normalized = value.strip().replace("Z", "+00:00")
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.isoformat()


def _manual_data_note(language: str) -> str:
    if language.startswith("zh"):
        return "手動建立的 Portfolio 紀錄；入場價與時間由使用者填寫，目前價格仍由 yfinance 更新。"
    return "Manual portfolio record; entry price and time were entered by the user, while current price is refreshed from yfinance."


def _live_history_rows(snapshot: TickerSnapshot) -> tuple[list[dict], str]:
    try:
        return _history_rows_for_ticker(snapshot.ticker), "Yahoo Finance historical OHLCV via yfinance."
    except Exception:
        rows = []
        previous_close = None
        for item in snapshot.history:
            close = float(item.close)
            open_price = previous_close if previous_close is not None else close
            rows.append(
                {
                    "date": item.date,
                    "open": open_price,
                    "high": max(open_price, close),
                    "low": min(open_price, close),
                    "close": close,
                    "volume": 0,
                }
            )
            previous_close = close
        return rows, "Fallback 30-day close-only data from ticker snapshot; volume is unavailable."


def _source_summary(language: str) -> str:
    if language.startswith("zh"):
        return (
            "市場資料來自 Yahoo Finance/yfinance；基本面使用最新公司 profile 與估值欄位，"
            "新聞/題材使用 yfinance 回傳的近期新聞、原始連結與公司描述。AI 面在 API 模式會優先由 OpenAI "
            "根據同一份證據生成；若 quota、授權或模型不可用，會降級為 deterministic coach。"
        )
    return (
        "Market data comes from Yahoo Finance/yfinance; fundamentals use the latest company profile and "
        "valuation fields, news/theme uses recent yfinance news with original URLs plus company descriptions. In API Mode, "
        "the AI view is generated by OpenAI from the same evidence; if quota, auth, or model access fails, it falls back to a deterministic coach."
    )


def _live_data_note(as_of: str, source_note: str, language: str) -> str:
    if language.startswith("zh"):
        return f"即時分析使用最新可取得資料；圖表最後一筆為 {as_of}。{source_note}"
    return f"Live analysis uses the latest available data; the chart ends at {as_of}. {source_note}"


def _current_price(ticker: str) -> float | None:
    try:
        return get_ticker_snapshot(ticker).price
    except Exception:
        return None


def _pct_change(entry_price: float, current_price: float | None) -> float | None:
    if current_price is None or entry_price <= 0:
        return None
    return round(((current_price - entry_price) / entry_price) * 100, 2)


def _portfolio_stats(decisions: list[PortfolioDecisionRecord]) -> PortfolioStats:
    pct_values = [item.pct_change for item in decisions if item.pct_change is not None]
    agreement_values = [item.ai_agreement for item in decisions if item.ai_agreement is not None]
    return PortfolioStats(
        total_decisions=len(decisions),
        bull_count=sum(1 for item in decisions if item.side == "bull"),
        bear_count=sum(1 for item in decisions if item.side == "bear"),
        neutral_count=sum(1 for item in decisions if item.side == "neutral"),
        open_count=sum(1 for item in decisions if item.status != "closed"),
        closed_count=sum(1 for item in decisions if item.status == "closed"),
        average_pct_change=round(sum(pct_values) / len(pct_values), 2) if pct_values else None,
        ai_agreement_rate=_percentage(sum(1 for item in agreement_values if item), len(agreement_values)),
    )


def _percentage(numerator: int, denominator: int) -> float | None:
    if denominator == 0:
        return None
    return round((numerator / denominator) * 100, 1)
