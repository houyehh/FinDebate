from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel, Field

from app.database import VerdictSide, connect, init_db
from app.market_data import TickerLookupError, TickerSnapshot, get_ticker_snapshot
from app.practice import (
    AiSnapshot,
    JudgmentWeights,
    MarketIndicatorPoint,
    SnapshotMetric,
    _ai_snapshot,
    _chip_snapshot,
    _factor_clues,
    _fundamental_snapshot,
    _history_rows_for_ticker,
    _indicator_points,
    _news_snapshot,
    _technical_snapshot,
    localized_ai_snapshot,
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
    bull_points: list[str]
    bear_points: list[str]
    data_note: str
    source_summary: str


class PortfolioDecisionRequest(BaseModel):
    ticker: str = Field(min_length=1)
    side: VerdictSide
    confidence: int = Field(ge=1, le=5)
    rationale: str = ""
    language: str = "zh-Hant"
    weights: JudgmentWeights = Field(default_factory=JudgmentWeights)
    analysis: LiveAnalysisResponse | None = None


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


class PortfolioStats(BaseModel):
    total_decisions: int
    bull_count: int
    bear_count: int
    neutral_count: int
    average_pct_change: float | None
    ai_agreement_rate: float | None


class PortfolioResponse(BaseModel):
    stats: PortfolioStats
    decisions: list[PortfolioDecisionRecord]


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
    ai = _ai_snapshot(snapshot.ticker, point, window, technical, fundamental, chip)
    ai = localized_ai_snapshot(snapshot.ticker, point, window, ai, language)
    bull_points, bear_points = _factor_clues(point, window, ai, language.startswith("zh"))

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
        bull_points=bull_points,
        bear_points=bear_points,
        data_note=_live_data_note(point.date, source_note, language),
        source_summary=_source_summary(language),
    )


def save_portfolio_decision(request: PortfolioDecisionRequest) -> PortfolioDecisionRecord:
    init_db()
    analysis = request.analysis or get_live_analysis(request.ticker, request.language)
    now = datetime.now(timezone.utc).isoformat()
    ai_side = analysis.ai_snapshot.suggested_side if analysis.ai_snapshot else None
    ai_agreement = request.side == ai_side if ai_side else None

    with connect() as connection:
        cursor = connection.execute(
            """
            INSERT INTO portfolio_decisions (
                ticker, side, confidence, rationale, price_at_decision, currency,
                created_at, analysis_json, ai_side, ai_agreement, data_note
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                analysis.ticker,
                request.side,
                request.confidence,
                request.rationale,
                analysis.price,
                analysis.currency,
                now,
                analysis.model_dump_json(),
                ai_side,
                int(ai_agreement) if ai_agreement is not None else None,
                analysis.data_note,
            ),
        )
        decision_id = int(cursor.lastrowid)

    return PortfolioDecisionRecord(
        id=decision_id,
        ticker=analysis.ticker,
        side=request.side,
        confidence=request.confidence,
        rationale=request.rationale,
        price_at_decision=analysis.price,
        current_price=analysis.price,
        pct_change=0.0,
        currency=analysis.currency,
        created_at=now,
        ai_side=ai_side,
        ai_agreement=ai_agreement,
        data_note=analysis.data_note,
    )


def get_portfolio() -> PortfolioResponse:
    init_db()
    with connect() as connection:
        rows = connection.execute(
            """
            SELECT
                id, ticker, side, confidence, rationale, price_at_decision,
                currency, created_at, ai_side, ai_agreement, data_note
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
        pct_change = _pct_change(row["price_at_decision"], current_price)
        decisions.append(
            PortfolioDecisionRecord(
                id=row["id"],
                ticker=ticker,
                side=row["side"],
                confidence=row["confidence"],
                rationale=row["rationale"],
                price_at_decision=row["price_at_decision"],
                current_price=current_price,
                pct_change=pct_change,
                currency=row["currency"],
                created_at=row["created_at"],
                ai_side=row["ai_side"],
                ai_agreement=bool(row["ai_agreement"]) if row["ai_agreement"] is not None else None,
                data_note=row["data_note"],
            )
        )

    return PortfolioResponse(stats=_portfolio_stats(decisions), decisions=decisions)


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
            "新聞/題材使用 yfinance 回傳的近期新聞與公司描述。AI 面是 deterministic coach，"
            "只根據同一份技術、基本、新聞/題材資料產生。"
        )
    return (
        "Market data comes from Yahoo Finance/yfinance; fundamentals use the latest company profile and "
        "valuation fields, news/theme uses recent yfinance news and company descriptions, and the AI view is "
        "a deterministic coach generated from the same technical, fundamental, and news/theme snapshots."
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
        average_pct_change=round(sum(pct_values) / len(pct_values), 2) if pct_values else None,
        ai_agreement_rate=_percentage(sum(1 for item in agreement_values if item), len(agreement_values)),
    )


def _percentage(numerator: int, denominator: int) -> float | None:
    if denominator == 0:
        return None
    return round((numerator / denominator) * 100, 1)
