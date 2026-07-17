from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

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
