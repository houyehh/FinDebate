from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import date, timedelta
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


class TickerSearchResult(BaseModel):
    ticker: str
    name: str
    exchange: str = ""
    asset_type: str = "equity"
    currency: str = "USD"


@dataclass
class TickerLookupError(Exception):
    ticker: str
    message: str


SEARCH_UNIVERSE: list[dict[str, Any]] = [
    {
        "ticker": "NVDA",
        "name": "NVIDIA Corporation",
        "exchange": "NASDAQ",
        "asset_type": "equity",
        "currency": "USD",
        "keywords": ["nvidia", "輝達", "英偉達", "gpu", "ai chip", "nvda"],
    },
    {
        "ticker": "AAPL",
        "name": "Apple Inc.",
        "exchange": "NASDAQ",
        "asset_type": "equity",
        "currency": "USD",
        "keywords": ["apple", "蘋果", "iphone", "aapl"],
    },
    {
        "ticker": "TSLA",
        "name": "Tesla, Inc.",
        "exchange": "NASDAQ",
        "asset_type": "equity",
        "currency": "USD",
        "keywords": ["tesla", "特斯拉", "ev", "tsla"],
    },
    {
        "ticker": "MSFT",
        "name": "Microsoft Corporation",
        "exchange": "NASDAQ",
        "asset_type": "equity",
        "currency": "USD",
        "keywords": ["microsoft", "微軟", "azure", "msft"],
    },
    {
        "ticker": "GOOGL",
        "name": "Alphabet Inc.",
        "exchange": "NASDAQ",
        "asset_type": "equity",
        "currency": "USD",
        "keywords": ["google", "alphabet", "谷歌", "googl"],
    },
    {
        "ticker": "META",
        "name": "Meta Platforms, Inc.",
        "exchange": "NASDAQ",
        "asset_type": "equity",
        "currency": "USD",
        "keywords": ["meta", "facebook", "臉書", "instagram"],
    },
    {
        "ticker": "AMZN",
        "name": "Amazon.com, Inc.",
        "exchange": "NASDAQ",
        "asset_type": "equity",
        "currency": "USD",
        "keywords": ["amazon", "亞馬遜", "aws", "amzn"],
    },
    {
        "ticker": "2330.TW",
        "name": "Taiwan Semiconductor Manufacturing Company",
        "exchange": "TWSE",
        "asset_type": "equity",
        "currency": "TWD",
        "keywords": ["台積電", "tsmc", "taiwan semiconductor", "2330"],
    },
    {
        "ticker": "2317.TW",
        "name": "Hon Hai Precision Industry",
        "exchange": "TWSE",
        "asset_type": "equity",
        "currency": "TWD",
        "keywords": ["鴻海", "foxconn", "hon hai", "2317"],
    },
    {
        "ticker": "2454.TW",
        "name": "MediaTek Inc.",
        "exchange": "TWSE",
        "asset_type": "equity",
        "currency": "TWD",
        "keywords": ["聯發科", "mediatek", "2454"],
    },
    {
        "ticker": "BTC-USD",
        "name": "Bitcoin USD",
        "exchange": "Crypto",
        "asset_type": "crypto",
        "currency": "USD",
        "keywords": ["bitcoin", "比特幣", "btc", "btc-usd"],
    },
    {
        "ticker": "ETH-USD",
        "name": "Ethereum USD",
        "exchange": "Crypto",
        "asset_type": "crypto",
        "currency": "USD",
        "keywords": ["ethereum", "以太幣", "eth", "eth-usd"],
    },
]


def normalize_ticker(raw_ticker: str) -> str:
    ticker = raw_ticker.strip().upper()
    if not ticker:
        raise TickerLookupError(
            ticker=raw_ticker,
            message="Ticker is required. Try examples like NVDA, 2330.TW, or BTC-USD.",
        )
    return ticker


def search_tickers(query: str, limit: int = 8) -> list[TickerSearchResult]:
    cleaned = query.strip()
    if not cleaned:
        return []
    normalized = cleaned.lower()
    scored: list[tuple[int, dict[str, Any]]] = []

    for item in SEARCH_UNIVERSE:
        ticker = item["ticker"]
        haystack = [ticker.lower(), item["name"].lower(), *[keyword.lower() for keyword in item["keywords"]]]
        if ticker.lower() == normalized:
            score = 100
        elif any(value == normalized for value in haystack):
            score = 90
        elif any(value.startswith(normalized) for value in haystack):
            score = 75
        elif any(normalized in value for value in haystack):
            score = 55
        else:
            continue
        scored.append((score, item))

    if _looks_like_ticker(cleaned) and not any(item["ticker"].lower() == normalized for _score, item in scored):
        ticker = normalize_ticker(cleaned)
        scored.append(
            (
                50,
                {
                    "ticker": ticker,
                    "name": ticker,
                    "exchange": "",
                    "asset_type": "equity",
                    "currency": _currency_from_ticker(ticker) or "USD",
                    "keywords": [],
                },
            )
        )

    return [
        TickerSearchResult(
            ticker=item["ticker"],
            name=item["name"],
            exchange=item.get("exchange", ""),
            asset_type=item.get("asset_type", "equity"),
            currency=item.get("currency", "USD"),
        )
        for _score, item in sorted(scored, key=lambda pair: (-pair[0], pair[1]["ticker"]))[:limit]
    ]


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


def _looks_like_ticker(value: str) -> bool:
    return bool(value.strip()) and all(ch.isalnum() or ch in ".-" for ch in value.strip())


def get_close_near_date(raw_ticker: str, target_date: date) -> float | None:
    ticker = normalize_ticker(raw_ticker)
    start = target_date - timedelta(days=5)
    end = target_date + timedelta(days=6)
    history = yf.Ticker(ticker).history(
        start=start.isoformat(),
        end=end.isoformat(),
        interval="1d",
        auto_adjust=False,
    )

    if history.empty or "Close" not in history:
        return None

    dated_prices: list[tuple[date, float]] = []
    for index, row in history.iterrows():
        close = _to_number(row.get("Close"))
        if close is None or close <= 0:
            continue
        price_date = index.date() if hasattr(index, "date") else date.fromisoformat(str(index)[:10])
        dated_prices.append((price_date, close))

    if not dated_prices:
        return None

    on_or_before = [item for item in dated_prices if item[0] <= target_date]
    if on_or_before:
        return round(on_or_before[-1][1], 4)

    return round(dated_prices[0][1], 4)
