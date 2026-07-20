from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app import settings
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
from app.market_data import TickerLookupError, TickerSearchResult, TickerSnapshot, get_ticker_snapshot, search_tickers
from app.practice import (
    PracticeAttemptRecord,
    PracticeAttemptRequest,
    PracticeDashboardResponse,
    PracticeQuestionNotFoundError,
    PracticeValidationError,
    get_practice_dashboard,
    submit_practice_attempt,
)

app = FastAPI(title="Bull vs Bear Arena API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:5174",
        "http://localhost:5174",
        "http://127.0.0.1:5175",
        "http://localhost:5175",
    ],
    allow_origin_regex=r"^http://(127\.0\.0\.1|localhost):51[0-9]{2}$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/tickers/search", response_model=list[TickerSearchResult])
def search_ticker_candidates(q: str, limit: int = 8) -> list[TickerSearchResult]:
    return search_tickers(q, limit=limit)


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


class OpenAISettingsRequest(BaseModel):
    api_key: str = ""
    model: str = Field(min_length=1)
    key_source: str = "default"
    debate_mode: str = "api"


class OpenAISettingsResponse(BaseModel):
    api_key_configured: bool
    api_key_preview: str
    default_key_configured: bool
    user_key_configured: bool
    key_source: str
    debate_mode: str
    model: str
    available_models: list[str]
    key_sources: list[str]
    debate_modes: list[str]


@app.get("/api/settings/openai", response_model=OpenAISettingsResponse)
def read_openai_settings() -> dict:
    return settings.read_openai_settings()


@app.post("/api/settings/openai", response_model=OpenAISettingsResponse)
def update_openai_settings(request: OpenAISettingsRequest) -> dict:
    try:
        return settings.update_openai_settings(
            api_key=request.api_key,
            model=request.model,
            key_source=request.key_source,
            debate_mode=request.debate_mode,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"message": str(exc)}) from exc


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


@app.get("/api/practice", response_model=PracticeDashboardResponse)
def read_practice_dashboard(
    language: str = "zh-Hant",
    refresh_random: bool = True,
) -> PracticeDashboardResponse:
    return get_practice_dashboard(language, refresh_random=refresh_random)


@app.post("/api/practice/attempts", response_model=PracticeAttemptRecord)
def create_practice_attempt(request: PracticeAttemptRequest) -> PracticeAttemptRecord:
    try:
        return submit_practice_attempt(request)
    except PracticeValidationError as exc:
        raise HTTPException(status_code=400, detail={"message": str(exc)}) from exc
    except PracticeQuestionNotFoundError as exc:
        raise HTTPException(status_code=404, detail={"message": str(exc)}) from exc
