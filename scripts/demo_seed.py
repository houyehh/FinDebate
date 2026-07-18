from __future__ import annotations

import argparse
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.database import insert_demo_verdict, refresh_pending_settlements  # noqa: E402
from app.market_data import get_close_near_date, get_ticker_snapshot  # noqa: E402


DEMO_VERDICTS = [
    ("NVDA", "bull", 5, "Demo bullish semiconductor call.", "bull"),
    ("AAPL", "bear", 2, "Demo cautious mega-cap call.", "bull"),
    ("BTC-USD", "bull", 4, "Demo crypto momentum call.", "bull"),
    ("MSFT", "neutral", 3, "Demo neutral quality call.", "neutral"),
    ("TSLA", "bear", 4, "Demo bearish volatility call.", "bear"),
]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--demo-seed", action="store_true", help="insert five demo verdicts")
    args = parser.parse_args()

    if not args.demo_seed:
        parser.print_help()
        return 1

    created_at = datetime.now(timezone.utc) - timedelta(days=7)
    created_at_text = created_at.isoformat()

    for ticker, side, confidence, note, judge_side in DEMO_VERDICTS:
        price = get_close_near_date(ticker, created_at.date())
        if price is None:
            price = get_ticker_snapshot(ticker).price
        verdict_id = insert_demo_verdict(
            ticker=ticker,
            side=side,
            confidence=confidence,
            note=note,
            created_at=created_at_text,
            price_at_verdict=price,
            judge_side=judge_side,
        )
        print(f"seeded verdict {verdict_id}: {ticker} {side} at {price}")

    refresh_pending_settlements()
    print("demo seed complete")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
