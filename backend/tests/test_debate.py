import pytest
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


def _rebuttal(side: str, target: str, index: int) -> dict[str, str]:
    prefix = side.upper()
    return {
        "target_claim_id": target,
        "rebuttal": f"{prefix} rebuttal {index}",
        "evidence": f"{prefix} rebuttal evidence {index}",
        "source_url": f"https://example.com/{side}/rebuttal-{index}",
    }


def _judge_score(item_id: str, side: str, item_type: str, flag: str = "none") -> dict:
    return {
        "item_id": item_id,
        "side": side,
        "item_type": item_type,
        "evidence_score": 4,
        "source_score": 3,
        "logic_score": 5,
        "flag": flag,
        "flag_reason": "Cannot verify the claim." if flag == "unverifiable" else "",
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


@pytest.fixture(autouse=True)
def force_api_mode(monkeypatch) -> None:
    monkeypatch.setattr(debate, "get_debate_mode", lambda: "api")


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


def test_two_round_debate_endpoint_returns_rebuttals(monkeypatch) -> None:
    monkeypatch.setattr(debate, "get_ticker_snapshot", lambda _ticker: _snapshot())
    monkeypatch.setattr(
        debate,
        "generate_opening_for_side",
        lambda side, _snapshot, _language: debate.OpeningRound(
            side=side,
            claims=[_claim(side, index) for index in range(1, 4)],
        ),
    )
    monkeypatch.setattr(
        debate,
        "generate_rebuttals_for_side",
        lambda side, _snapshot, own_round, opponent_round, language: debate.RebuttalRound(
            side=side,
            rebuttals=[
                _rebuttal(side, opponent_round.claims[0].claim_id, 1),
                _rebuttal(side, opponent_round.claims[1].claim_id, 2),
            ],
        ),
    )
    client = TestClient(app)

    response = client.post("/api/debates/two-round", json={"ticker": "NVDA"})

    assert response.status_code == 200
    body = response.json()
    assert len(body["bull_rebuttals"]["rebuttals"]) == 2
    assert len(body["bear_rebuttals"]["rebuttals"]) == 2
    assert body["bull_rebuttals"]["rebuttals"][0]["target_claim_id"] == "BEAR-1"
    assert body["bear_rebuttals"]["rebuttals"][0]["target_claim_id"] == "BULL-1"
    assert body["bull_rebuttals"]["rebuttals"][0]["source_url"].startswith("https://")


def test_rebuttal_generation_retries_once_after_invalid_target(monkeypatch) -> None:
    own_round = debate.OpeningRound(
        side="bull",
        claims=[_claim("bull", index) for index in range(1, 4)],
    )
    opponent_round = debate.OpeningRound(
        side="bear",
        claims=[_claim("bear", index) for index in range(1, 4)],
    )
    calls = [
        {
            "side": "bull",
            "rebuttals": [
                _rebuttal("bull", "NOT-A-CLAIM", 1),
                _rebuttal("bull", "BEAR-2", 2),
            ],
        },
        {
            "side": "bull",
            "rebuttals": [
                _rebuttal("bull", "BEAR-1", 1),
                _rebuttal("bull", "BEAR-2", 2),
            ],
        },
    ]

    def fake_call(_side, _snapshot, _own_round, _opponent_round, _language):
        return calls.pop(0)

    monkeypatch.setattr(debate, "_call_openai_rebuttals", fake_call)

    rebuttal_round = debate.generate_rebuttals_for_side(
        "bull",
        _snapshot(),
        own_round=own_round,
        opponent_round=opponent_round,
        language="zh-Hant",
    )

    assert rebuttal_round.side == "bull"
    assert len(rebuttal_round.rebuttals) == 2
    assert calls == []


def test_judged_debate_endpoint_returns_scores(monkeypatch) -> None:
    monkeypatch.setattr(debate, "get_ticker_snapshot", lambda _ticker: _snapshot())
    monkeypatch.setattr(
        debate,
        "generate_opening_for_side",
        lambda side, _snapshot, _language: debate.OpeningRound(
            side=side,
            claims=[_claim(side, index) for index in range(1, 4)],
        ),
    )
    monkeypatch.setattr(
        debate,
        "generate_rebuttals_for_side",
        lambda side, _snapshot, own_round, opponent_round, language: debate.RebuttalRound(
            side=side,
            rebuttals=[
                _rebuttal(side, opponent_round.claims[0].claim_id, 1),
                _rebuttal(side, opponent_round.claims[1].claim_id, 2),
            ],
        ),
    )
    monkeypatch.setattr(
        debate,
        "generate_judge_for_debate",
        lambda two_round, _language: debate.JudgeResult(
            scores=[
                debate.JudgeItemScore(**_judge_score("BULL-1", "bull", "claim")),
                debate.JudgeItemScore(**_judge_score("BULL-2", "bull", "claim")),
                debate.JudgeItemScore(**_judge_score("BULL-3", "bull", "claim")),
                debate.JudgeItemScore(**_judge_score("BEAR-1", "bear", "claim")),
                debate.JudgeItemScore(**_judge_score("BEAR-2", "bear", "claim")),
                debate.JudgeItemScore(**_judge_score("BEAR-3", "bear", "claim")),
                debate.JudgeItemScore(**_judge_score("BULL-REB-1", "bull", "rebuttal")),
                debate.JudgeItemScore(**_judge_score("BULL-REB-2", "bull", "rebuttal")),
                debate.JudgeItemScore(**_judge_score("BEAR-REB-1", "bear", "rebuttal")),
                debate.JudgeItemScore(**_judge_score("BEAR-REB-2", "bear", "rebuttal")),
            ],
            bull_total=60,
            bear_total=60,
            summary="Both sides cite evidence.",
        ),
    )
    client = TestClient(app)

    response = client.post("/api/debates/judged", json={"ticker": "NVDA"})

    assert response.status_code == 200
    body = response.json()
    assert body["judge"]["bull_total"] == 60
    assert body["judge"]["bear_total"] == 60
    assert len(body["judge"]["scores"]) == 10


def test_provider_error_endpoint_returns_json_detail(monkeypatch) -> None:
    monkeypatch.setattr(debate, "get_ticker_snapshot", lambda _ticker: _snapshot())

    def raise_provider_error(*_args, **_kwargs):
        raise debate.DebateProviderError(
            "OpenAI API quota exceeded. Check billing, credits, or project limits.",
            status_code=429,
        )

    monkeypatch.setattr(debate, "generate_opening_for_side", raise_provider_error)
    client = TestClient(app)

    response = client.post("/api/debates/round-one", json={"ticker": "NVDA"})

    assert response.status_code == 429
    assert response.json()["detail"]["message"] == (
        "OpenAI API quota exceeded. Check billing, credits, or project limits."
    )


def test_openai_insufficient_quota_maps_to_provider_error() -> None:
    exc = debate.OpenAIError("quota")
    exc.status_code = 429
    exc.body = {"error": {"code": "insufficient_quota"}}

    provider_error = debate._provider_error_from_openai(exc)

    assert provider_error.status_code == 429
    assert "quota exceeded" in str(provider_error)


def test_demo_mode_returns_judged_debate_without_openai(monkeypatch) -> None:
    monkeypatch.setattr(debate, "get_ticker_snapshot", lambda _ticker: _snapshot())
    monkeypatch.setattr(debate, "get_debate_mode", lambda: "demo")

    def fail_openai_call(*_args, **_kwargs):
        raise AssertionError("Demo mode must not call OpenAI")

    monkeypatch.setattr(debate, "_create_openai_response", fail_openai_call)

    result = debate.generate_judged_debate("NVDA", "zh-Hant")

    assert result.ticker == "NVDA"
    assert len(result.bull.claims) == 3
    assert len(result.bear.claims) == 3
    assert len(result.bull_rebuttals.rebuttals) == 2
    assert len(result.bear_rebuttals.rebuttals) == 2
    assert len(result.judge.scores) == 10
    assert any(score.flag == "unverifiable" for score in result.judge.scores)


def test_judge_flags_unverifiable_fixture(monkeypatch) -> None:
    bull_round = debate.OpeningRound(
        side="bull",
        claims=[
            _claim("bull", 1),
            {
                **_claim("bull", 2),
                "claim": "NVIDIA acquired a fictional exchange on Mars in 2099.",
            },
            _claim("bull", 3),
        ],
    )
    bear_round = debate.OpeningRound(
        side="bear",
        claims=[_claim("bear", index) for index in range(1, 4)],
    )
    bull_rebuttals = debate.RebuttalRound(
        side="bull",
        rebuttals=[_rebuttal("bull", "BEAR-1", 1), _rebuttal("bull", "BEAR-2", 2)],
    )
    bear_rebuttals = debate.RebuttalRound(
        side="bear",
        rebuttals=[_rebuttal("bear", "BULL-1", 1), _rebuttal("bear", "BULL-2", 2)],
    )
    two_round = debate.TwoRoundDebate(
        ticker="NVDA",
        language="zh-Hant",
        generated_at="2026-07-18T00:00:00+00:00",
        bull=bull_round,
        bear=bear_round,
        bull_rebuttals=bull_rebuttals,
        bear_rebuttals=bear_rebuttals,
        price_at_debate=123.45,
        currency="USD",
    )
    monkeypatch.setattr(
        debate,
        "_call_openai_judge",
        lambda _debate, _language: {
            "scores": [
                _judge_score("BULL-1", "bull", "claim"),
                _judge_score("BULL-2", "bull", "claim", flag="unverifiable"),
                _judge_score("BULL-3", "bull", "claim"),
                _judge_score("BEAR-1", "bear", "claim"),
                _judge_score("BEAR-2", "bear", "claim"),
                _judge_score("BEAR-3", "bear", "claim"),
                _judge_score("BULL-REB-1", "bull", "rebuttal"),
                _judge_score("BULL-REB-2", "bull", "rebuttal"),
                _judge_score("BEAR-REB-1", "bear", "rebuttal"),
                _judge_score("BEAR-REB-2", "bear", "rebuttal"),
            ],
            "summary": "One claim is unverifiable.",
        },
    )

    judge = debate.generate_judge_for_debate(two_round, "zh-Hant")

    flagged = [score for score in judge.scores if score.flag == "unverifiable"]
    assert len(flagged) == 1
    assert flagged[0].item_id == "BULL-2"
    assert judge.bull_total == 60
    assert judge.bear_total == 60
