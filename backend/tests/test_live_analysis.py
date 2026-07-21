import sqlite3
from datetime import date, timedelta
from pathlib import Path
from uuid import uuid4

from fastapi.testclient import TestClient

from app import live_analysis
from app.main import app
from app.market_data import PricePoint, TickerSnapshot
from app.practice import SnapshotMetric


def _database_file() -> Path:
    return Path("data") / f"test_{uuid4().hex}.db"


def _rows(count: int = 120) -> list[dict]:
    start = date(2026, 1, 1)
    rows = []
    for index in range(count):
        close = 100 + index * 0.5
        open_price = close - 0.4
        rows.append(
            {
                "date": (start + timedelta(days=index)).isoformat(),
                "open": open_price,
                "high": close + 1.2,
                "low": close - 1.1,
                "close": close,
                "volume": 1_000_000 + index * 4_000,
            }
        )
    return rows


def _install_live_fakes(monkeypatch, price_box: dict[str, float]) -> None:
    def fake_snapshot(ticker: str) -> TickerSnapshot:
        return TickerSnapshot(
            ticker=ticker.upper(),
            name="NVIDIA Corporation",
            price=price_box["price"],
            currency="USD",
            history=[
                PricePoint(date="2026-04-28", close=118),
                PricePoint(date="2026-04-29", close=119),
                PricePoint(date="2026-04-30", close=price_box["price"]),
            ],
        )

    monkeypatch.setattr(live_analysis, "get_ticker_snapshot", fake_snapshot)
    monkeypatch.setattr(live_analysis, "_history_rows_for_ticker", lambda _ticker: _rows())
    monkeypatch.setattr(
        live_analysis,
        "_fundamental_snapshot",
        lambda _ticker: [SnapshotMetric(label="Revenue growth", value="+12.0%", detail="Latest yfinance profile proxy.", tone="bull")],
    )
    monkeypatch.setattr(
        live_analysis,
        "_news_snapshot",
        lambda _ticker: [
            SnapshotMetric(
                label="Recent news",
                value="AI demand remains the main theme",
                detail="Mock Wire · 2026-04-30",
                source_name="Mock Wire",
                source_url="https://example.com/news/nvda-ai",
                published_at="2026-04-30",
                summary="Mock summary from the original news payload.",
            )
        ],
    )


def test_live_analysis_builds_evidence_based_current_workbench(monkeypatch) -> None:
    monkeypatch.setenv("DATABASE_PATH", str(_database_file()))
    _install_live_fakes(monkeypatch, {"price": 160.0})
    client = TestClient(app)

    response = client.get("/api/live-analysis/NVDA?language=zh-Hant")

    assert response.status_code == 200
    body = response.json()
    assert body["ticker"] == "NVDA"
    assert body["market_window"]
    assert body["market_window"][-1]["ma10"] is not None
    assert body["technical_snapshot"]
    assert body["fundamental_snapshot"][0]["value"] == "+12.0%"
    assert body["news_snapshot"][0]["value"] == "AI demand remains the main theme"
    assert body["news_snapshot"][0]["source_url"] == "https://example.com/news/nvda-ai"
    assert body["news_snapshot"][0]["summary"] == "Mock summary from the original news payload."
    news_evidence = next(item for item in body["evidence_pack"] if item["category"] == "news")
    assert news_evidence["source_url"] == "https://example.com/news/nvda-ai"
    assert "20 日趨勢" in body["ai_snapshot"]["bull_thesis"]
    assert body["ai_snapshot"]["source"] == "deterministic_ai_coach"
    assert body["evidence_pack"]
    assert body["ai_debate"]["bull"]["claims"]
    assert body["ai_debate"]["bull"]["claims"][0]["evidence_refs"]
    assert "yfinance" in body["source_summary"]


def test_portfolio_decision_persists_and_tracks_latest_price(monkeypatch) -> None:
    database_file = _database_file()
    monkeypatch.setenv("DATABASE_PATH", str(database_file))
    price_box = {"price": 120.0}
    _install_live_fakes(monkeypatch, price_box)
    client = TestClient(app)

    analysis = client.get("/api/live-analysis/NVDA?language=en").json()
    response = client.post(
        "/api/portfolio/decisions",
        json={
            "ticker": "NVDA",
            "side": "bull",
            "confidence": 4,
            "rationale": "MA trend and AI thesis both cite concrete data.",
            "language": "en",
            "analysis": analysis,
        },
    )

    assert response.status_code == 200
    saved = response.json()
    assert saved["price_at_decision"] == 120.0
    assert saved["ai_side"] in {"bull", "bear", "neutral"}

    price_box["price"] = 132.0
    portfolio = client.get("/api/portfolio").json()

    assert portfolio["stats"]["total_decisions"] == 1
    assert portfolio["stats"]["bull_count"] == 1
    assert portfolio["decisions"][0]["current_price"] == 132.0
    assert portfolio["decisions"][0]["pct_change"] == 10.0

    with sqlite3.connect(database_file) as connection:
        row = connection.execute(
            "SELECT ticker, side, confidence, rationale, analysis_json FROM portfolio_decisions"
        ).fetchone()

    assert row[0] == "NVDA"
    assert row[1] == "bull"
    assert row[2] == 4
    assert "concrete data" in row[3]
    assert "market_window" in row[4]


def test_manual_portfolio_decision_can_be_updated_and_deleted(monkeypatch) -> None:
    database_file = _database_file()
    monkeypatch.setenv("DATABASE_PATH", str(database_file))
    price_box = {"price": 130.0}
    _install_live_fakes(monkeypatch, price_box)
    client = TestClient(app)

    created = client.post(
        "/api/portfolio/decisions",
        json={
            "ticker": "NVDA",
            "side": "neutral",
            "confidence": 2,
            "rationale": "Manual backfill.",
            "entry_price": 100.0,
            "currency": "USD",
            "created_at": "2026-07-01T09:30:00",
            "status": "open",
        },
    )

    assert created.status_code == 200
    decision_id = created.json()["id"]
    assert created.json()["price_at_decision"] == 100.0
    assert created.json()["pct_change"] == 30.0

    updated = client.patch(
        f"/api/portfolio/decisions/{decision_id}",
        json={
            "side": "bull",
            "confidence": 5,
            "price_at_decision": 110.0,
            "status": "closed",
            "exit_price": 121.0,
            "exit_at": "2026-07-10T16:00:00",
            "review_note": "Closed after target.",
        },
    )

    assert updated.status_code == 200
    body = updated.json()
    assert body["side"] == "bull"
    assert body["status"] == "closed"
    assert body["pct_change"] == 10.0
    assert body["review_note"] == "Closed after target."

    deleted = client.delete(f"/api/portfolio/decisions/{decision_id}")
    assert deleted.status_code == 200
    portfolio = client.get("/api/portfolio").json()
    assert portfolio["stats"]["total_decisions"] == 0
