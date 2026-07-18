from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.database import ScoreboardResponse, VerdictRecord, VerdictSide, get_scoreboard, save_verdict
from app.debate import (
    DebateConfigurationError,
    DebateGenerationError,
    DebateProviderError,
    JudgedDebate,
    RoundOneDebate,
    TwoRoundDebate,
    generate_judged_debate,
    generate_round_one_debate,
    generate_two_round_debate,
)
from app.market_data import TickerLookupError, TickerSnapshot, get_ticker_snapshot

app = FastAPI(title="Bull vs Bear Arena API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/tickers/{ticker}", response_model=TickerSnapshot)
def read_ticker(ticker: str) -> TickerSnapshot:
    try:
        return get_ticker_snapshot(ticker)
    except TickerLookupError as exc:
        raise HTTPException(
            status_code=404,
            detail={
                "message": exc.message,
                "examples": ["NVDA", "2330.TW", "BTC-USD"],
            },
        ) from exc


class RoundOneDebateRequest(BaseModel):
    ticker: str = Field(min_length=1)
    language: str = "zh-Hant"


class VerdictSubmitRequest(BaseModel):
    debate: JudgedDebate
    side: VerdictSide
    confidence: int = Field(ge=1, le=5)
    note: str = ""


@app.post("/api/debates/round-one", response_model=RoundOneDebate)
def create_round_one_debate(request: RoundOneDebateRequest) -> RoundOneDebate:
    try:
        return generate_round_one_debate(request.ticker, request.language)
    except TickerLookupError as exc:
        raise HTTPException(
            status_code=404,
            detail={
                "message": exc.message,
                "examples": ["NVDA", "2330.TW", "BTC-USD"],
            },
        ) from exc
    except DebateConfigurationError as exc:
        raise HTTPException(status_code=503, detail={"message": str(exc)}) from exc
    except DebateProviderError as exc:
        raise HTTPException(status_code=exc.status_code, detail={"message": str(exc)}) from exc
    except DebateGenerationError as exc:
        raise HTTPException(
            status_code=502,
            detail={"message": "Debate generation failed. Please try again."},
        ) from exc


@app.post("/api/debates/two-round", response_model=TwoRoundDebate)
def create_two_round_debate(request: RoundOneDebateRequest) -> TwoRoundDebate:
    try:
        return generate_two_round_debate(request.ticker, request.language)
    except TickerLookupError as exc:
        raise HTTPException(
            status_code=404,
            detail={
                "message": exc.message,
                "examples": ["NVDA", "2330.TW", "BTC-USD"],
            },
        ) from exc
    except DebateConfigurationError as exc:
        raise HTTPException(status_code=503, detail={"message": str(exc)}) from exc
    except DebateProviderError as exc:
        raise HTTPException(status_code=exc.status_code, detail={"message": str(exc)}) from exc
    except DebateGenerationError as exc:
        raise HTTPException(
            status_code=502,
            detail={"message": "Debate generation failed. Please try again."},
        ) from exc


@app.post("/api/debates/judged", response_model=JudgedDebate)
def create_judged_debate(request: RoundOneDebateRequest) -> JudgedDebate:
    try:
        return generate_judged_debate(request.ticker, request.language)
    except TickerLookupError as exc:
        raise HTTPException(
            status_code=404,
            detail={
                "message": exc.message,
                "examples": ["NVDA", "2330.TW", "BTC-USD"],
            },
        ) from exc
    except DebateConfigurationError as exc:
        raise HTTPException(status_code=503, detail={"message": str(exc)}) from exc
    except DebateProviderError as exc:
        raise HTTPException(status_code=exc.status_code, detail={"message": str(exc)}) from exc
    except DebateGenerationError as exc:
        raise HTTPException(
            status_code=502,
            detail={"message": "Judge scoring failed. Please try again."},
        ) from exc


@app.post("/api/verdicts", response_model=VerdictRecord)
def submit_verdict(request: VerdictSubmitRequest) -> VerdictRecord:
    return save_verdict(
        debate=request.debate,
        side=request.side,
        confidence=request.confidence,
        note=request.note,
    )


@app.get("/api/records", response_model=ScoreboardResponse)
def read_records() -> ScoreboardResponse:
    return get_scoreboard()
