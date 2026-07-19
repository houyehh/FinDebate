from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Literal

from openai import OpenAI, OpenAIError
from pydantic import BaseModel, Field, ValidationError, model_validator

from app.market_data import TickerSnapshot, get_ticker_snapshot
from app.settings import get_openai_api_key, get_openai_model

Side = Literal["bull", "bear"]


class DebateClaim(BaseModel):
    claim_id: str = Field(min_length=1)
    claim: str = Field(min_length=1)
    evidence: str = Field(min_length=1)
    source_url: str = Field(min_length=1)
    source_name: str = Field(min_length=1)


class OpeningRound(BaseModel):
    side: Side
    claims: list[DebateClaim] = Field(min_length=3, max_length=3)

    @model_validator(mode="after")
    def claim_ids_must_be_unique(self) -> "OpeningRound":
        claim_ids = [claim.claim_id for claim in self.claims]
        if len(claim_ids) != len(set(claim_ids)):
            raise ValueError("claim_id values must be unique")
        return self


class Rebuttal(BaseModel):
    target_claim_id: str = Field(min_length=1)
    rebuttal: str = Field(min_length=1)
    evidence: str = Field(min_length=1)
    source_url: str = Field(min_length=1)


class RebuttalRound(BaseModel):
    side: Side
    rebuttals: list[Rebuttal] = Field(min_length=2, max_length=2)


class RoundOneDebate(BaseModel):
    ticker: str
    language: str
    generated_at: str
    bull: OpeningRound
    bear: OpeningRound
    price_at_debate: float
    currency: str


class TwoRoundDebate(RoundOneDebate):
    bull_rebuttals: RebuttalRound
    bear_rebuttals: RebuttalRound


class JudgeItemScore(BaseModel):
    item_id: str = Field(min_length=1)
    side: Side
    item_type: Literal["claim", "rebuttal"]
    evidence_score: int = Field(ge=1, le=5)
    source_score: int = Field(ge=1, le=5)
    logic_score: int = Field(ge=1, le=5)
    flag: Literal["none", "unverifiable"] = "none"
    flag_reason: str = ""


class JudgeResult(BaseModel):
    scores: list[JudgeItemScore]
    bull_total: int
    bear_total: int
    summary: str = Field(min_length=1)


class JudgedDebate(TwoRoundDebate):
    judge: JudgeResult


class DebateGenerationError(Exception):
    pass


class DebateConfigurationError(DebateGenerationError):
    pass


class DebateProviderError(DebateGenerationError):
    def __init__(self, message: str, status_code: int = 502) -> None:
        super().__init__(message)
        self.status_code = status_code


OPENING_ROUND_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "side": {"type": "string", "enum": ["bull", "bear"]},
        "claims": {
            "type": "array",
            "minItems": 3,
            "maxItems": 3,
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "claim_id": {"type": "string"},
                    "claim": {"type": "string"},
                    "evidence": {"type": "string"},
                    "source_url": {"type": "string"},
                    "source_name": {"type": "string"},
                },
                "required": ["claim_id", "claim", "evidence", "source_url", "source_name"],
            },
        },
    },
    "required": ["side", "claims"],
}


def generate_round_one_debate(ticker: str, language: str = "zh-Hant") -> RoundOneDebate:
    snapshot = get_ticker_snapshot(ticker)
    bull = generate_opening_for_side("bull", snapshot, language)
    bear = generate_opening_for_side("bear", snapshot, language)

    return _build_round_one_response(snapshot, language, bull, bear)


def generate_two_round_debate(ticker: str, language: str = "zh-Hant") -> TwoRoundDebate:
    snapshot = get_ticker_snapshot(ticker)
    bull = generate_opening_for_side("bull", snapshot, language)
    bear = generate_opening_for_side("bear", snapshot, language)
    bull_rebuttals = generate_rebuttals_for_side("bull", snapshot, own_round=bull, opponent_round=bear, language=language)
    bear_rebuttals = generate_rebuttals_for_side("bear", snapshot, own_round=bear, opponent_round=bull, language=language)
    first_round = _build_round_one_response(snapshot, language, bull, bear)

    return TwoRoundDebate(
        **first_round.model_dump(),
        bull_rebuttals=bull_rebuttals,
        bear_rebuttals=bear_rebuttals,
    )


def generate_judged_debate(ticker: str, language: str = "zh-Hant") -> JudgedDebate:
    two_round = generate_two_round_debate(ticker, language)
    judge = generate_judge_for_debate(two_round, language)

    return JudgedDebate(
        **two_round.model_dump(),
        judge=judge,
    )


def _build_round_one_response(
    snapshot: TickerSnapshot,
    language: str,
    bull: OpeningRound,
    bear: OpeningRound,
) -> RoundOneDebate:
    return RoundOneDebate(
        ticker=snapshot.ticker,
        language=language,
        generated_at=datetime.now(timezone.utc).isoformat(),
        bull=bull,
        bear=bear,
        price_at_debate=snapshot.price,
        currency=snapshot.currency,
    )


def generate_opening_for_side(side: Side, snapshot: TickerSnapshot, language: str) -> OpeningRound:
    last_error: Exception | None = None

    for _attempt in range(2):
        try:
            raw_payload = _call_openai_opening(side, snapshot, language)
            opening = OpeningRound.model_validate(raw_payload)
            if opening.side != side:
                raise ValueError(f"Expected side {side}, got {opening.side}")
            return opening
        except (json.JSONDecodeError, ValidationError, ValueError) as exc:
            last_error = exc

    raise DebateGenerationError(f"Model output did not match opening schema: {last_error}")


def generate_rebuttals_for_side(
    side: Side,
    snapshot: TickerSnapshot,
    own_round: OpeningRound,
    opponent_round: OpeningRound,
    language: str,
) -> RebuttalRound:
    target_claim_ids = [claim.claim_id for claim in opponent_round.claims]
    last_error: Exception | None = None

    for _attempt in range(2):
        try:
            raw_payload = _call_openai_rebuttals(side, snapshot, own_round, opponent_round, language)
            rebuttal_round = RebuttalRound.model_validate(raw_payload)
            if rebuttal_round.side != side:
                raise ValueError(f"Expected side {side}, got {rebuttal_round.side}")
            invalid_targets = [
                rebuttal.target_claim_id
                for rebuttal in rebuttal_round.rebuttals
                if rebuttal.target_claim_id not in target_claim_ids
            ]
            if invalid_targets:
                raise ValueError(f"Invalid target claim ids: {invalid_targets}")
            return rebuttal_round
        except (json.JSONDecodeError, ValidationError, ValueError) as exc:
            last_error = exc

    raise DebateGenerationError(f"Model output did not match rebuttal schema: {last_error}")


def generate_judge_for_debate(debate: TwoRoundDebate, language: str) -> JudgeResult:
    expected_item_ids = [item["item_id"] for item in _judge_items(debate)]
    last_error: Exception | None = None

    for _attempt in range(2):
        try:
            raw_payload = _call_openai_judge(debate, language)
            scores = [JudgeItemScore.model_validate(item) for item in raw_payload["scores"]]
            _validate_judge_scores(scores, expected_item_ids)
            bull_total = _score_total(scores, "bull")
            bear_total = _score_total(scores, "bear")
            return JudgeResult(
                scores=scores,
                bull_total=bull_total,
                bear_total=bear_total,
                summary=raw_payload["summary"],
            )
        except (KeyError, TypeError, ValidationError, ValueError) as exc:
            last_error = exc

    raise DebateGenerationError(f"Judge output did not match scoring schema: {last_error}")


def _call_openai_opening(side: Side, snapshot: TickerSnapshot, language: str) -> dict[str, Any]:
    response = _create_openai_response(
        model=get_openai_model(),
        input=[
            {"role": "system", "content": _system_prompt(side, language)},
            {"role": "user", "content": _user_prompt(snapshot)},
        ],
        text={
            "format": {
                "type": "json_schema",
                "name": f"{side}_opening_round",
                "schema": OPENING_ROUND_SCHEMA,
                "strict": True,
            }
        },
    )

    return json.loads(response.output_text)


def _call_openai_rebuttals(
    side: Side,
    snapshot: TickerSnapshot,
    own_round: OpeningRound,
    opponent_round: OpeningRound,
    language: str,
) -> dict[str, Any]:
    response = _create_openai_response(
        model=get_openai_model(),
        input=[
            {"role": "system", "content": _rebuttal_system_prompt(side, language)},
            {
                "role": "user",
                "content": _rebuttal_user_prompt(snapshot, own_round, opponent_round),
            },
        ],
        tools=[{"type": "web_search"}],
        text={
            "format": {
                "type": "json_schema",
                "name": f"{side}_rebuttal_round",
                "schema": _rebuttal_round_schema([claim.claim_id for claim in opponent_round.claims]),
                "strict": True,
            }
        },
    )

    return json.loads(response.output_text)


def _call_openai_judge(debate: TwoRoundDebate, language: str) -> dict[str, Any]:
    items = _judge_items(debate)
    response = _create_openai_response(
        model=get_openai_model(),
        input=[
            {"role": "system", "content": _judge_system_prompt(language)},
            {"role": "user", "content": _judge_user_prompt(debate, items)},
        ],
        tools=[{"type": "web_search"}],
        text={
            "format": {
                "type": "json_schema",
                "name": "judge_scores",
                "schema": _judge_schema([item["item_id"] for item in items]),
                "strict": True,
            }
        },
    )

    return json.loads(response.output_text)


def _create_openai_response(**kwargs: Any) -> Any:
    api_key = get_openai_api_key()
    if not api_key:
        raise DebateConfigurationError("OPENAI_API_KEY is not configured.")

    client = OpenAI(api_key=api_key)
    try:
        return client.responses.create(**kwargs)
    except OpenAIError as exc:
        raise _provider_error_from_openai(exc) from exc


def _provider_error_from_openai(exc: OpenAIError) -> DebateProviderError:
    status_code = getattr(exc, "status_code", None) or 502
    error_code = _openai_error_code(exc)

    if error_code == "insufficient_quota":
        return DebateProviderError(
            "OpenAI API quota exceeded. Check billing, credits, or project limits.",
            status_code=429,
        )
    if status_code == 401:
        return DebateProviderError("OpenAI API authentication failed. Check OPENAI_API_KEY.", status_code=401)
    if status_code == 404:
        return DebateProviderError(
            f"OpenAI model '{get_openai_model()}' is not available for this API key.",
            status_code=404,
        )
    if status_code == 429:
        return DebateProviderError("OpenAI API rate limit reached. Please try again later.", status_code=429)

    return DebateProviderError("OpenAI API request failed. Please try again.", status_code=status_code)


def _openai_error_code(exc: OpenAIError) -> str | None:
    body = getattr(exc, "body", None)
    if isinstance(body, dict):
        error = body.get("error")
        if isinstance(error, dict):
            code = error.get("code")
            if isinstance(code, str):
                return code
        code = body.get("code")
        if isinstance(code, str):
            return code

    code = getattr(exc, "code", None)
    return code if isinstance(code, str) else None


def _system_prompt(side: Side, language: str) -> str:
    stance = "bullish" if side == "bull" else "bearish"
    output_language = "Traditional Chinese" if language.startswith("zh") else "English"

    return (
        f"You are the {stance} analyst in a two-round investment debate. "
        "This task is round one only. Do not use web search. Use model knowledge and the "
        "provided market snapshot. Produce exactly three opening claims. "
        "Each claim must include a concrete evidence sentence, a source name, and a source URL. "
        "Avoid investment advice and do not mention that you are an AI. "
        f"Write claim and evidence text in {output_language}. "
        "Return only JSON matching the provided schema."
    )


def _judge_system_prompt(language: str) -> str:
    output_language = "Traditional Chinese" if language.startswith("zh") else "English"

    return (
        "You are a neutral evidence-quality judge for a fixed investment debate. "
        "Use web search to verify whether sources and factual claims are checkable. "
        "Score every provided item on evidence specificity, source quality, and logic, each from 1 to 5. "
        "If an item cannot be verified or appears hallucinated, set flag to unverifiable and explain why. "
        "Do not make an investment recommendation; only evaluate evidence quality. "
        f"Write the summary and flag reasons in {output_language}. "
        "Return only JSON matching the provided schema."
    )


def _rebuttal_system_prompt(side: Side, language: str) -> str:
    stance = "bullish" if side == "bull" else "bearish"
    output_language = "Traditional Chinese" if language.startswith("zh") else "English"

    return (
        f"You are the {stance} analyst in round two of a fixed investment debate. "
        "Use the web search tool to verify current facts and find evidence. "
        "Generate exactly two rebuttals to the opponent's round-one claims. "
        "Each rebuttal must target one opponent claim_id, include concrete evidence, "
        "and include a real source_url used for the rebuttal. "
        f"Write rebuttal and evidence text in {output_language}. "
        "Return only JSON matching the provided schema."
    )


def _user_prompt(snapshot: TickerSnapshot) -> str:
    history_text = ", ".join(
        f"{point.date}: {point.close}" for point in snapshot.history[-5:]
    )
    return (
        f"Ticker: {snapshot.ticker}\n"
        f"Name: {snapshot.name}\n"
        f"Current price: {snapshot.price} {snapshot.currency}\n"
        f"Recent closes: {history_text}\n"
        "Use claim_id values BULL-1/BULL-2/BULL-3 or BEAR-1/BEAR-2/BEAR-3 as appropriate."
    )


def _rebuttal_user_prompt(
    snapshot: TickerSnapshot,
    own_round: OpeningRound,
    opponent_round: OpeningRound,
) -> str:
    return (
        f"Ticker: {snapshot.ticker}\n"
        f"Name: {snapshot.name}\n"
        f"Current price: {snapshot.price} {snapshot.currency}\n"
        f"Your opening claims: {own_round.model_dump_json()}\n"
        f"Opponent opening claims: {opponent_round.model_dump_json()}\n"
        "Choose exactly two opponent claim_id values as targets."
    )


def _judge_user_prompt(debate: TwoRoundDebate, items: list[dict[str, Any]]) -> str:
    return (
        f"Ticker: {debate.ticker}\n"
        f"Price at debate: {debate.price_at_debate} {debate.currency}\n"
        f"Items to score: {json.dumps(items, ensure_ascii=False)}\n"
        "Return one score object for every item_id exactly once."
    )


def _rebuttal_round_schema(target_claim_ids: list[str]) -> dict[str, Any]:
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "side": {"type": "string", "enum": ["bull", "bear"]},
            "rebuttals": {
                "type": "array",
                "minItems": 2,
                "maxItems": 2,
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "target_claim_id": {"type": "string", "enum": target_claim_ids},
                        "rebuttal": {"type": "string"},
                        "evidence": {"type": "string"},
                        "source_url": {"type": "string"},
                    },
                    "required": ["target_claim_id", "rebuttal", "evidence", "source_url"],
                },
            },
        },
        "required": ["side", "rebuttals"],
    }


def _judge_schema(item_ids: list[str]) -> dict[str, Any]:
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "scores": {
                "type": "array",
                "minItems": len(item_ids),
                "maxItems": len(item_ids),
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "item_id": {"type": "string", "enum": item_ids},
                        "side": {"type": "string", "enum": ["bull", "bear"]},
                        "item_type": {"type": "string", "enum": ["claim", "rebuttal"]},
                        "evidence_score": {"type": "integer", "minimum": 1, "maximum": 5},
                        "source_score": {"type": "integer", "minimum": 1, "maximum": 5},
                        "logic_score": {"type": "integer", "minimum": 1, "maximum": 5},
                        "flag": {"type": "string", "enum": ["none", "unverifiable"]},
                        "flag_reason": {"type": "string"},
                    },
                    "required": [
                        "item_id",
                        "side",
                        "item_type",
                        "evidence_score",
                        "source_score",
                        "logic_score",
                        "flag",
                        "flag_reason",
                    ],
                },
            },
            "summary": {"type": "string"},
        },
        "required": ["scores", "summary"],
    }


def _judge_items(debate: TwoRoundDebate) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []

    for side, round_data in (("bull", debate.bull), ("bear", debate.bear)):
        for claim in round_data.claims:
            items.append(
                {
                    "item_id": claim.claim_id,
                    "side": side,
                    "item_type": "claim",
                    "claim": claim.claim,
                    "evidence": claim.evidence,
                    "source_url": claim.source_url,
                    "source_name": claim.source_name,
                }
            )

    for side, rebuttal_round in (
        ("bull", debate.bull_rebuttals),
        ("bear", debate.bear_rebuttals),
    ):
        for index, rebuttal in enumerate(rebuttal_round.rebuttals, start=1):
            items.append(
                {
                    "item_id": rebuttal_item_id(side, index),
                    "side": side,
                    "item_type": "rebuttal",
                    "target_claim_id": rebuttal.target_claim_id,
                    "rebuttal": rebuttal.rebuttal,
                    "evidence": rebuttal.evidence,
                    "source_url": rebuttal.source_url,
                }
            )

    return items


def rebuttal_item_id(side: str, index: int) -> str:
    return f"{side.upper()}-REB-{index}"


def _validate_judge_scores(scores: list[JudgeItemScore], expected_item_ids: list[str]) -> None:
    actual_item_ids = [score.item_id for score in scores]
    if len(actual_item_ids) != len(set(actual_item_ids)):
        raise ValueError("Judge score item_id values must be unique")
    if set(actual_item_ids) != set(expected_item_ids):
        raise ValueError("Judge scores must cover every debate item exactly once")


def _score_total(scores: list[JudgeItemScore], side: Side) -> int:
    return sum(
        score.evidence_score + score.source_score + score.logic_score
        for score in scores
        if score.side == side
    )
