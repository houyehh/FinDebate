from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Literal

from openai import OpenAI
from pydantic import BaseModel, Field, ValidationError, model_validator

from app.market_data import TickerSnapshot, get_ticker_snapshot
from app.settings import OPENAI_MODEL, get_openai_api_key

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


class RoundOneDebate(BaseModel):
    ticker: str
    language: str
    generated_at: str
    bull: OpeningRound
    bear: OpeningRound
    price_at_debate: float
    currency: str


class DebateGenerationError(Exception):
    pass


class DebateConfigurationError(DebateGenerationError):
    pass


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


def _call_openai_opening(side: Side, snapshot: TickerSnapshot, language: str) -> dict[str, Any]:
    api_key = get_openai_api_key()
    if not api_key:
        raise DebateConfigurationError("OPENAI_API_KEY is not configured.")

    client = OpenAI(api_key=api_key)
    response = client.responses.create(
        model=OPENAI_MODEL,
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
