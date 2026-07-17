from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

import yfinance as yf
from pydantic import BaseModel, Field


class PricePoint(BaseModel):
    date: str
    close: float


class TickerSnapshot(BaseModel):
    ticker: str
    name: str
    price: float = Field(gt=0)
    currency: str
    history: list[PricePoint] = Field(min_length=1)


@dataclass
class TickerLookupError(Exception):
    ticker: str
    message: str


def normalize_ticker(raw_ticker: str) -> str:
    ticker = raw_ticker.strip().upper()
    if not ticker:
        raise TickerLookupError(
            ticker=raw_ticker,
            message="Ticker is required. Try examples like NVDA, 2330.TW, or BTC-USD.",
        )
    return ticker


def get_ticker_snapshot(raw_ticker: str) -> TickerSnapshot:
    ticker = normalize_ticker(raw_ticker)
    yf_ticker = yf.Ticker(ticker)

    history = yf_ticker.history(period="1mo", interval="1d", auto_adjust=False)
    if history.empty or "Close" not in history:
        raise TickerLookupError(
            ticker=ticker,
            message=f"We could not find market data for {ticker}. Try NVDA, 2330.TW, or BTC-USD.",
        )

    price_history = _extract_history(history)
    if not price_history:
        raise TickerLookupError(
            ticker=ticker,
            message=f"We could not find valid closing prices for {ticker}. Try another ticker format.",
        )

    info = _safe_info(yf_ticker)
    fast_info = _safe_fast_info(yf_ticker)
    price = _first_number(
        _dict_get(fast_info, "last_price"),
        _dict_get(info, "currentPrice"),
        _dict_get(info, "regularMarketPrice"),
        price_history[-1].close,
    )
    currency = (
        _first_text(
            _dict_get(fast_info, "currency"),
            _dict_get(info, "currency"),
            _currency_from_ticker(ticker),
        )
        or "N/A"
    )
    name = _first_text(
        _dict_get(info, "longName"),
        _dict_get(info, "shortName"),
        _dict_get(info, "displayName"),
        ticker,
    )

    if price is None or price <= 0:
        raise TickerLookupError(
            ticker=ticker,
            message=f"We could not find a current price for {ticker}. Try another ticker format.",
        )

    return TickerSnapshot(
        ticker=ticker,
        name=name,
        price=round(price, 4),
        currency=currency,
        history=price_history,
    )


def _extract_history(history: Any) -> list[PricePoint]:
    points: list[PricePoint] = []
    recent_history = history.tail(30)

    for index, row in recent_history.iterrows():
        close = _to_number(row.get("Close"))
        if close is None or close <= 0:
            continue

        if hasattr(index, "date"):
            date_text = index.date().isoformat()
        else:
            date_text = str(index)[:10]

        points.append(PricePoint(date=date_text, close=round(close, 4)))

    return points


def _safe_info(yf_ticker: Any) -> dict[str, Any]:
    try:
        info = yf_ticker.info
    except Exception:
        return {}
    return info if isinstance(info, dict) else {}


def _safe_fast_info(yf_ticker: Any) -> Any:
    try:
        return yf_ticker.fast_info
    except Exception:
        return {}


def _dict_get(source: Any, key: str) -> Any:
    if isinstance(source, dict):
        return source.get(key)

    try:
        return source.get(key)
    except Exception:
        return None


def _first_number(*values: Any) -> float | None:
    for value in values:
        number = _to_number(value)
        if number is not None:
            return number
    return None


def _first_text(*values: Any) -> str | None:
    for value in values:
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _to_number(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None

    if math.isnan(number) or math.isinf(number):
        return None

    return number


def _currency_from_ticker(ticker: str) -> str | None:
    if ticker.endswith(".TW"):
        return "TWD"
    if ticker.endswith("-USD"):
        return "USD"
    return None
