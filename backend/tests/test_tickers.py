import pandas as pd
from fastapi.testclient import TestClient

from app import market_data
from app.main import app


class FakeTicker:
    def __init__(self, ticker: str, empty: bool = False) -> None:
        self.ticker = ticker
        self.empty = empty
        self.fast_info = {"last_price": 123.45, "currency": "USD"}
        self.info = {"longName": "NVIDIA Corporation", "currency": "USD"}

    def history(self, **_kwargs):
        if self.empty:
            return pd.DataFrame()

        return pd.DataFrame(
            {"Close": [120.0, 121.5, 123.45]},
            index=pd.to_datetime(["2026-06-01", "2026-06-02", "2026-06-03"]),
        )


def test_ticker_endpoint_returns_snapshot(monkeypatch) -> None:
    monkeypatch.setattr(market_data.yf, "Ticker", lambda ticker: FakeTicker(ticker))
    client = TestClient(app)

    response = client.get("/api/tickers/nvda")

    assert response.status_code == 200
    body = response.json()
    assert body["ticker"] == "NVDA"
    assert body["name"] == "NVIDIA Corporation"
    assert body["price"] == 123.45
    assert body["currency"] == "USD"
    assert len(body["history"]) == 3


def test_ticker_endpoint_returns_friendly_error(monkeypatch) -> None:
    monkeypatch.setattr(market_data.yf, "Ticker", lambda ticker: FakeTicker(ticker, empty=True))
    client = TestClient(app)

    response = client.get("/api/tickers/FAKETICKER")

    assert response.status_code == 404
    detail = response.json()["detail"]
    assert "FAKETICKER" in detail["message"]
    assert detail["examples"] == ["NVDA", "2330.TW", "BTC-USD"]
