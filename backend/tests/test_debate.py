from fastapi.testclient import TestClient

from app import debate
from app.main import app
from app.market_data import PricePoint, TickerSnapshot


def _claim(side: str, index: int) -> dict[str, str]:
    prefix = side.upper()
    return {
        "claim_id": f"{prefix}-{index}",
        "claim": f"{prefix} claim {index}",
        "evidence": f"{prefix} evidence {index}",
        "source_url": "https://example.com/source",
        "source_name": "Example Source",
    }


def _snapshot() -> TickerSnapshot:
    return TickerSnapshot(
        ticker="NVDA",
        name="NVIDIA Corporation",
        price=123.45,
        currency="USD",
        history=[
            PricePoint(date="2026-06-01", close=120.0),
            PricePoint(date="2026-06-02", close=121.5),
            PricePoint(date="2026-06-03", close=123.45),
        ],
    )


def test_round_one_debate_endpoint_returns_two_opening_rounds(monkeypatch) -> None:
    monkeypatch.setattr(debate, "get_ticker_snapshot", lambda _ticker: _snapshot())
    monkeypatch.setattr(
        debate,
        "generate_opening_for_side",
        lambda side, _snapshot, _language: debate.OpeningRound(
            side=side,
            claims=[_claim(side, index) for index in range(1, 4)],
        ),
    )
    client = TestClient(app)

    response = client.post("/api/debates/round-one", json={"ticker": "NVDA"})

    assert response.status_code == 200
    body = response.json()
    assert body["ticker"] == "NVDA"
    assert body["price_at_debate"] == 123.45
    assert len(body["bull"]["claims"]) == 3
    assert len(body["bear"]["claims"]) == 3
    assert body["bull"]["claims"][0]["claim_id"] == "BULL-1"
    assert body["bear"]["claims"][0]["claim_id"] == "BEAR-1"


def test_opening_generation_retries_once_after_invalid_schema(monkeypatch) -> None:
    calls = [
        {"side": "bull", "claims": []},
        {"side": "bull", "claims": [_claim("bull", index) for index in range(1, 4)]},
    ]

    def fake_call(_side, _snapshot, _language):
        return calls.pop(0)

    monkeypatch.setattr(debate, "_call_openai_opening", fake_call)

    opening = debate.generate_opening_for_side("bull", _snapshot(), "zh-Hant")

    assert opening.side == "bull"
    assert len(opening.claims) == 3
    assert calls == []
