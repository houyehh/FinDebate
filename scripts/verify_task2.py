from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.market_data import TickerLookupError, get_ticker_snapshot  # noqa: E402


def main() -> int:
    tickers = ["NVDA", "2330.TW", "BTC-USD"]

    for ticker in tickers:
        snapshot = get_ticker_snapshot(ticker)
        print(
            f"{snapshot.ticker}: {snapshot.name} "
            f"{snapshot.price} {snapshot.currency} history={len(snapshot.history)}"
        )
        if not snapshot.name or snapshot.price <= 0 or not snapshot.history:
            raise AssertionError(f"Incomplete snapshot for {ticker}")

    try:
        get_ticker_snapshot("FAKETICKER")
    except TickerLookupError as exc:
        print(f"FAKETICKER rejected: {exc.message}")
        return 0

    raise AssertionError("FAKETICKER should be rejected")


if __name__ == "__main__":
    raise SystemExit(main())
