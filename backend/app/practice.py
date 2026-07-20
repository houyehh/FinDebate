from __future__ import annotations

import json
import math
import os
import random
import re
from collections import Counter
from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, Field
import yfinance as yf

from app.database import VerdictSide, connect, init_db

PracticeResult = Literal["correct", "wrong"]


class PracticeQuestion(BaseModel):
    id: str
    ticker: str
    title: str
    as_of: str
    price: float
    currency: str
    horizon_days: int
    scenario: str
    bull_points: list[str]
    bear_points: list[str]
    prompt: str
    focus_tags: list[str]
    indicator_summary: list[str] = []
    market_window: list["MarketIndicatorPoint"] = []


class MarketIndicatorPoint(BaseModel):
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: int
    volume_ma5: float | None = None
    k: float | None = None
    d: float | None = None
    macd: float | None = None
    macd_signal: float | None = None
    macd_hist: float | None = None


class PracticeCase(PracticeQuestion):
    title_zh: str
    scenario_zh: str
    bull_points_zh: list[str]
    bear_points_zh: list[str]
    prompt_zh: str
    answer_side: VerdictSide
    outcome_pct: float
    answer_explanation_zh: str
    answer_explanation_en: str


class PracticeFeedback(BaseModel):
    summary: str
    probable_causes: list[str]
    improvement_steps: list[str]
    focus_tags: list[str]


class PracticeAttemptRequest(BaseModel):
    question_id: str = Field(min_length=1)
    side: VerdictSide
    confidence: int = Field(ge=1, le=5)
    rationale: str = ""
    language: str = "zh-Hant"


class PracticeAttemptRecord(BaseModel):
    id: int
    question_id: str
    ticker: str
    selected_side: VerdictSide
    confidence: int
    rationale: str
    answer_side: VerdictSide
    outcome_pct: float
    result: PracticeResult
    feedback: PracticeFeedback
    created_at: str


class PracticeStats(BaseModel):
    total_attempts: int
    accuracy_rate: float | None
    high_confidence_accuracy_rate: float | None
    low_confidence_accuracy_rate: float | None
    most_common_focus: str | None


class PracticeDashboardResponse(BaseModel):
    questions: list[PracticeQuestion]
    stats: PracticeStats
    recent_attempts: list[PracticeAttemptRecord]


PRACTICE_BANK: list[PracticeCase] = [
    PracticeCase(
        id="nvda-ai-guidance",
        ticker="NVDA",
        title="AI demand beats valuation anxiety",
        title_zh="AI 需求壓過估值焦慮",
        as_of="Training case",
        price=123.45,
        currency="USD",
        horizon_days=7,
        scenario=(
            "The company has just reported another strong AI-driven quarter. Demand and guidance are strong, "
            "but the stock has already rallied sharply and valuation anxiety is loud."
        ),
        scenario_zh="公司剛公布強勁的 AI 需求季度，需求與指引都偏強，但股價已大漲，市場也有明顯估值焦慮。",
        bull_points=[
            "Revenue growth and forward guidance are both described as accelerating.",
            "Data-center demand is the clearest quantified driver in the case.",
            "The strongest evidence points to near-term earnings revision risk to the upside.",
        ],
        bull_points_zh=[
            "營收成長與未來指引都呈現加速。",
            "資料中心需求是本題最具體的驅動因素。",
            "最強證據指向短期獲利預期可能上修。",
        ],
        bear_points=[
            "The stock has already rallied before the decision point.",
            "High expectations can punish any disappointment.",
            "The valuation objection is plausible but less directly tied to the next 7 days.",
        ],
        bear_points_zh=[
            "作答時股價已經先漲一段。",
            "高預期會放大任何失望反應。",
            "估值疑慮合理，但和未來 7 日的連結較間接。",
        ],
        prompt="For the next 7 trading days, would you choose bull, bear, or neutral?",
        prompt_zh="以未來 7 個交易日來看，你會選擇看多、看空，還是中立？",
        focus_tags=["evidence quality", "valuation", "time horizon"],
        answer_side="bull",
        outcome_pct=8.4,
        answer_explanation_zh="題目中的可驗證催化來自營收與指引上修，7 日視角下比抽象估值焦慮更直接。",
        answer_explanation_en="The checkable catalyst is stronger revenue and guidance, which matters more over 7 days than abstract valuation anxiety.",
    ),
    PracticeCase(
        id="aapl-guidance-pressure",
        ticker="AAPL",
        title="Buyback headline versus weak guidance",
        title_zh="買回標題對上疲弱指引",
        as_of="Training case",
        price=191.2,
        currency="USD",
        horizon_days=7,
        scenario=(
            "The company announces a large buyback, but management commentary points to weak product demand "
            "and softer regional growth."
        ),
        scenario_zh="公司宣布大型買回，但管理層談話顯示產品需求偏弱，部分區域成長也轉軟。",
        bull_points=[
            "The buyback can cushion downside and signals management confidence.",
            "The brand remains highly cash-generative.",
            "Long-term holders may look past one soft quarter.",
        ],
        bull_points_zh=[
            "買回能提供下檔支撐，也傳達管理層信心。",
            "品牌仍有很強的現金流能力。",
            "長線持有人可能忽略單季疲弱。",
        ],
        bear_points=[
            "Forward demand commentary is weaker than the headline buyback.",
            "The negative driver is linked to near-term earnings expectations.",
            "The market may discount the buyback if growth estimates are revised down.",
        ],
        bear_points_zh=[
            "未來需求談話比買回標題更弱。",
            "負面因素直接連到短期獲利預期。",
            "若成長預估下修，市場可能不買單買回故事。",
        ],
        prompt="For the next 7 trading days, would you choose bull, bear, or neutral?",
        prompt_zh="以未來 7 個交易日來看，你會選擇看多、看空，還是中立？",
        focus_tags=["headline risk", "guidance", "cash return"],
        answer_side="bear",
        outcome_pct=-4.2,
        answer_explanation_zh="買回是支撐因素，但題目中的主要新資訊是需求與指引走弱，短線更容易壓過資本回饋敘事。",
        answer_explanation_en="The buyback is supportive, but the new information is weaker demand and guidance, which dominates the short horizon.",
    ),
    PracticeCase(
        id="btc-etf-overheated",
        ticker="BTC-USD",
        title="ETF inflows with overheated positioning",
        title_zh="ETF 流入遇上過熱部位",
        as_of="Training case",
        price=67200.0,
        currency="USD",
        horizon_days=7,
        scenario=(
            "ETF inflows remain positive, but funding is stretched, the asset has moved fast, and the next catalyst is unclear."
        ),
        scenario_zh="ETF 資金仍在流入，但資金費率偏緊，價格已快速上行，下一個明確催化並不清楚。",
        bull_points=[
            "ETF inflows are a real demand source.",
            "The broader trend is still constructive.",
            "Liquidity can keep momentum alive longer than expected.",
        ],
        bull_points_zh=[
            "ETF 流入是真實需求來源。",
            "大方向趨勢仍偏建設性。",
            "流動性可能讓動能延續比預期更久。",
        ],
        bear_points=[
            "Positioning looks crowded after a fast move.",
            "Funding and leverage make the next move fragile.",
            "There is no clear fresh catalyst inside the 7-day window.",
        ],
        bear_points_zh=[
            "快速上漲後部位看起來擁擠。",
            "資金費率與槓桿讓下一段走勢更脆弱。",
            "7 日時間窗內缺少新的明確催化。",
        ],
        prompt="For the next 7 trading days, would you choose bull, bear, or neutral?",
        prompt_zh="以未來 7 個交易日來看，你會選擇看多、看空，還是中立？",
        focus_tags=["crowding", "catalyst", "neutral discipline"],
        answer_side="neutral",
        outcome_pct=0.6,
        answer_explanation_zh="正反線索都合理，且結果落在 ±1% 內；這題訓練的是願意承認沒有明確優勢。",
        answer_explanation_en="Both sides are reasonable and the move lands inside +/-1%; the lesson is recognizing when there is no clear edge.",
    ),
    PracticeCase(
        id="tsla-margin-compression",
        ticker="TSLA",
        title="Delivery growth hides margin pressure",
        title_zh="交付成長掩蓋毛利壓力",
        as_of="Training case",
        price=248.8,
        currency="USD",
        horizon_days=7,
        scenario=(
            "Delivery numbers look acceptable, but price cuts and margin commentary point to weaker profitability."
        ),
        scenario_zh="交付數字看起來尚可，但降價與毛利談話都指向獲利能力轉弱。",
        bull_points=[
            "Unit deliveries are not collapsing.",
            "The market still values long-term optionality.",
            "A lower price can stimulate demand later.",
        ],
        bull_points_zh=[
            "交付量沒有崩壞。",
            "市場仍重視長期選擇權價值。",
            "降價之後可能刺激後續需求。",
        ],
        bear_points=[
            "Price cuts directly pressure margin quality.",
            "The profitability signal is more important than unit count for this case.",
            "The short horizon rewards the cleaner earnings-quality read.",
        ],
        bear_points_zh=[
            "降價直接壓縮毛利品質。",
            "本題中獲利訊號比交付量更重要。",
            "短線更重視清楚的獲利品質惡化。",
        ],
        prompt="For the next 7 trading days, would you choose bull, bear, or neutral?",
        prompt_zh="以未來 7 個交易日來看，你會選擇看多、看空，還是中立？",
        focus_tags=["margin quality", "headline versus substance", "earnings quality"],
        answer_side="bear",
        outcome_pct=-6.1,
        answer_explanation_zh="交付量沒有崩壞，但真正影響短期重新定價的是毛利與獲利品質惡化。",
        answer_explanation_en="Deliveries are not collapsing, but margin and earnings quality are the cleaner short-term repricing drivers.",
    ),
    PracticeCase(
        id="tsm-ai-revision",
        ticker="2330.TW",
        title="AI demand offsets macro caution",
        title_zh="AI 需求抵消總經疑慮",
        as_of="Training case",
        price=865.0,
        currency="TWD",
        horizon_days=7,
        scenario=(
            "Management sounds cautious about broad consumer electronics, but AI-related demand and capital spending visibility improve."
        ),
        scenario_zh="管理層對消費電子整體偏謹慎，但 AI 相關需求與資本支出能見度變好。",
        bull_points=[
            "AI demand is the most specific positive driver in the setup.",
            "Capacity visibility supports forward estimates.",
            "The negative macro point is broad, while the positive driver is segment-specific.",
        ],
        bull_points_zh=[
            "AI 需求是本題最具體的正面驅動。",
            "產能能見度支撐未來預估。",
            "負面總經因素較籠統，正面驅動則更聚焦於特定業務。",
        ],
        bear_points=[
            "Consumer electronics demand is still uneven.",
            "Geopolitical and currency risks remain present.",
            "The stock may already reflect part of the AI optimism.",
        ],
        bear_points_zh=[
            "消費電子需求仍不平均。",
            "地緣政治與匯率風險仍存在。",
            "股價可能已反映部分 AI 樂觀預期。",
        ],
        prompt="For the next 7 trading days, would you choose bull, bear, or neutral?",
        prompt_zh="以未來 7 個交易日來看，你會選擇看多、看空，還是中立？",
        focus_tags=["specificity", "segment mix", "macro noise"],
        answer_side="bull",
        outcome_pct=3.7,
        answer_explanation_zh="這題的關鍵是證據具體度：AI 需求與產能能見度比籠統的總經疑慮更能解釋短線走勢。",
        answer_explanation_en="The key is evidence specificity: AI demand and capacity visibility are cleaner than broad macro caution.",
    ),
]


RANDOM_PRACTICE_TICKERS = ["NVDA", "AAPL", "TSLA", "BTC-USD", "2330.TW"]


FALLBACK_MARKET_ROWS: list[dict[str, Any]] = [
    {"date": "2026-05-01", "open": 101.0, "high": 103.0, "low": 99.8, "close": 102.2, "volume": 25200000},
    {"date": "2026-05-04", "open": 102.4, "high": 104.2, "low": 101.7, "close": 103.8, "volume": 27100000},
    {"date": "2026-05-05", "open": 104.0, "high": 105.1, "low": 102.5, "close": 103.0, "volume": 26300000},
    {"date": "2026-05-06", "open": 103.2, "high": 106.4, "low": 102.9, "close": 105.9, "volume": 31800000},
    {"date": "2026-05-07", "open": 106.1, "high": 108.3, "low": 105.0, "close": 107.7, "volume": 35100000},
    {"date": "2026-05-08", "open": 107.5, "high": 109.0, "low": 106.4, "close": 106.8, "volume": 28900000},
    {"date": "2026-05-11", "open": 106.9, "high": 110.2, "low": 106.5, "close": 109.8, "volume": 37600000},
    {"date": "2026-05-12", "open": 109.5, "high": 112.4, "low": 108.8, "close": 111.9, "volume": 39200000},
    {"date": "2026-05-13", "open": 112.0, "high": 113.2, "low": 110.6, "close": 111.0, "volume": 33100000},
    {"date": "2026-05-14", "open": 110.7, "high": 112.8, "low": 109.9, "close": 112.2, "volume": 30200000},
    {"date": "2026-05-15", "open": 112.4, "high": 114.6, "low": 111.8, "close": 114.1, "volume": 36500000},
    {"date": "2026-05-18", "open": 114.5, "high": 115.1, "low": 112.0, "close": 112.8, "volume": 34700000},
    {"date": "2026-05-19", "open": 112.6, "high": 113.5, "low": 110.3, "close": 111.1, "volume": 37200000},
    {"date": "2026-05-20", "open": 110.9, "high": 112.0, "low": 108.7, "close": 109.4, "volume": 41100000},
    {"date": "2026-05-21", "open": 109.2, "high": 111.5, "low": 108.9, "close": 110.8, "volume": 28800000},
    {"date": "2026-05-22", "open": 111.0, "high": 113.6, "low": 110.5, "close": 113.1, "volume": 33300000},
    {"date": "2026-05-26", "open": 113.4, "high": 116.2, "low": 112.9, "close": 115.8, "volume": 40500000},
    {"date": "2026-05-27", "open": 116.1, "high": 118.8, "low": 115.7, "close": 118.0, "volume": 42200000},
    {"date": "2026-05-28", "open": 118.2, "high": 119.4, "low": 116.6, "close": 117.2, "volume": 35600000},
    {"date": "2026-05-29", "open": 117.4, "high": 120.7, "low": 116.9, "close": 120.2, "volume": 43800000},
    {"date": "2026-06-01", "open": 120.5, "high": 121.0, "low": 118.2, "close": 119.0, "volume": 38400000},
    {"date": "2026-06-02", "open": 119.1, "high": 122.3, "low": 118.8, "close": 121.7, "volume": 39700000},
    {"date": "2026-06-03", "open": 121.8, "high": 123.5, "low": 120.0, "close": 120.6, "volume": 36200000},
    {"date": "2026-06-04", "open": 120.4, "high": 121.1, "low": 117.4, "close": 118.1, "volume": 44600000},
    {"date": "2026-06-05", "open": 118.3, "high": 119.8, "low": 116.9, "close": 117.6, "volume": 37100000},
    {"date": "2026-06-08", "open": 117.8, "high": 120.4, "low": 117.5, "close": 119.9, "volume": 31800000},
    {"date": "2026-06-09", "open": 120.0, "high": 122.8, "low": 119.7, "close": 122.1, "volume": 34400000},
    {"date": "2026-06-10", "open": 122.2, "high": 124.1, "low": 121.5, "close": 123.4, "volume": 36600000},
    {"date": "2026-06-11", "open": 123.5, "high": 124.0, "low": 120.6, "close": 121.0, "volume": 41900000},
    {"date": "2026-06-12", "open": 120.9, "high": 122.4, "low": 119.2, "close": 119.8, "volume": 40100000},
    {"date": "2026-06-15", "open": 119.7, "high": 121.7, "low": 118.8, "close": 121.2, "volume": 29400000},
    {"date": "2026-06-16", "open": 121.4, "high": 123.9, "low": 121.0, "close": 123.2, "volume": 31600000},
    {"date": "2026-06-17", "open": 123.0, "high": 125.2, "low": 122.4, "close": 124.8, "volume": 32900000},
    {"date": "2026-06-18", "open": 124.9, "high": 126.5, "low": 123.8, "close": 125.7, "volume": 35100000},
    {"date": "2026-06-19", "open": 125.5, "high": 127.4, "low": 124.2, "close": 126.8, "volume": 37700000},
    {"date": "2026-06-22", "open": 126.6, "high": 128.2, "low": 124.7, "close": 125.1, "volume": 39500000},
    {"date": "2026-06-23", "open": 125.0, "high": 126.2, "low": 122.8, "close": 123.0, "volume": 42800000},
    {"date": "2026-06-24", "open": 122.8, "high": 124.1, "low": 121.5, "close": 122.2, "volume": 36900000},
    {"date": "2026-06-25", "open": 122.4, "high": 125.0, "low": 121.9, "close": 124.7, "volume": 33600000},
    {"date": "2026-06-26", "open": 124.8, "high": 126.9, "low": 124.2, "close": 126.4, "volume": 34200000},
]


def get_practice_dashboard(language: str = "zh-Hant", refresh_random: bool = True) -> PracticeDashboardResponse:
    init_db()
    recent_attempts = _recent_attempts()
    questions = [_public_question(case, language) for case in PRACTICE_BANK]
    if refresh_random and os.getenv("PRACTICE_DISABLE_RANDOM") != "1":
        random_case = generate_random_market_case(language)
        _cache_practice_case(random_case)
        questions.insert(0, _public_question(random_case, language))
    else:
        cached_case = _latest_cached_case()
        if cached_case is not None:
            questions.insert(0, _public_question(cached_case, language))

    return PracticeDashboardResponse(
        questions=questions,
        stats=_practice_stats(),
        recent_attempts=recent_attempts,
    )


def generate_random_market_case(language: str = "zh-Hant") -> PracticeCase:
    ticker = random.choice(RANDOM_PRACTICE_TICKERS)
    try:
        raw_rows = _history_rows_for_ticker(ticker)
    except Exception:
        ticker = "DEMO"
        raw_rows = list(FALLBACK_MARKET_ROWS)

    points = _indicator_points(raw_rows)
    if len(points) < 28:
        ticker = "DEMO"
        points = _indicator_points(FALLBACK_MARKET_ROWS)

    pick_min = min(24, max(0, len(points) - 10))
    pick_max = max(pick_min, len(points) - 8)
    selected_index = random.randint(pick_min, pick_max)
    selected = points[selected_index]
    future = points[min(selected_index + 7, len(points) - 1)]
    outcome_pct = round(((future.close - selected.close) / selected.close) * 100, 2)
    answer_side = _answer_side_from_pct(outcome_pct)
    window = points[max(0, selected_index - 29) : selected_index + 1]
    question_id = f"market-{ticker}-{selected.date}-{random.randint(1000, 9999)}"
    summary_en = _indicator_summary(selected, window, False)
    summary_zh = _indicator_summary(selected, window, True)
    bull_points_en, bear_points_en = _indicator_clues(selected, window, False)
    bull_points_zh, bear_points_zh = _indicator_clues(selected, window, True)

    return PracticeCase(
        id=question_id,
        ticker=ticker,
        title=f"Random market snapshot on {selected.date}",
        title_zh=f"{selected.date} 隨機市場截面題",
        as_of=selected.date,
        price=selected.close,
        currency=_currency_for_ticker(ticker),
        horizon_days=7,
        scenario=(
            f"You are shown {ticker} through {selected.date}. Use only the visible OHLCV, volume, KD, "
            "and MACD context to judge the next 7 available trading days."
        ),
        scenario_zh=(
            f"這題只顯示 {ticker} 到 {selected.date} 為止的資料。請只根據可見的 K 線、價量、"
            "VOL 均量、KD 與 MACD 判斷接下來 7 個可用交易日。"
        ),
        bull_points=bull_points_en,
        bull_points_zh=bull_points_zh,
        bear_points=bear_points_en,
        bear_points_zh=bear_points_zh,
        prompt="Based on the chart and indicators only, what is your 7-day directional judgment?",
        prompt_zh="只根據圖表與指標，你對未來 7 日的方向判斷是什麼？",
        focus_tags=["technical context", "price-volume", "KD", "MACD"],
        indicator_summary=summary_zh if language.startswith("zh") else summary_en,
        market_window=window,
        answer_side=answer_side,
        outcome_pct=outcome_pct,
        answer_explanation_zh=(
            f"抽題日收盤為 {selected.close:.2f}，第 7 個可用交易日收盤為 {future.close:.2f}，"
            f"漲跌幅 {outcome_pct:+.2f}%。以 ±1% 為平手區間，本題參考答案為{_side_label(answer_side, True)}。"
        ),
        answer_explanation_en=(
            f"The snapshot close was {selected.close:.2f}; the 7th available trading-day close was {future.close:.2f}, "
            f"for a {outcome_pct:+.2f}% move. With +/-1% as the draw band, the reference answer is {_side_label(answer_side, False)}."
        ),
    )


def _history_rows_for_ticker(ticker: str) -> list[dict[str, Any]]:
    history = yf.Ticker(ticker).history(period="18mo", interval="1d", auto_adjust=False)
    if history.empty:
        raise ValueError(f"No history for {ticker}")

    rows: list[dict[str, Any]] = []
    for index, row in history.iterrows():
        close = _to_float(row.get("Close"))
        open_price = _to_float(row.get("Open"))
        high = _to_float(row.get("High"))
        low = _to_float(row.get("Low"))
        volume = _to_float(row.get("Volume"))
        if None in (close, open_price, high, low, volume) or close <= 0 or volume < 0:
            continue
        date_text = index.date().isoformat() if hasattr(index, "date") else str(index)[:10]
        rows.append(
            {
                "date": date_text,
                "open": open_price,
                "high": high,
                "low": low,
                "close": close,
                "volume": int(volume),
            }
        )

    if len(rows) < 36:
        raise ValueError(f"Not enough history for {ticker}")
    return rows


def _indicator_points(rows: list[dict[str, Any]]) -> list[MarketIndicatorPoint]:
    closes = [float(row["close"]) for row in rows]
    highs = [float(row["high"]) for row in rows]
    lows = [float(row["low"]) for row in rows]
    volumes = [int(row["volume"]) for row in rows]
    ema12 = _ema(closes, 12)
    ema26 = _ema(closes, 26)
    macd_values = [a - b for a, b in zip(ema12, ema26)]
    macd_signal_values = _ema(macd_values, 9)
    k_values, d_values = _kd_values(closes, highs, lows)

    points: list[MarketIndicatorPoint] = []
    for index, row in enumerate(rows):
        volume_window = volumes[max(0, index - 4) : index + 1]
        points.append(
            MarketIndicatorPoint(
                date=row["date"],
                open=round(float(row["open"]), 4),
                high=round(float(row["high"]), 4),
                low=round(float(row["low"]), 4),
                close=round(float(row["close"]), 4),
                volume=int(row["volume"]),
                volume_ma5=round(sum(volume_window) / len(volume_window), 2),
                k=round(k_values[index], 2),
                d=round(d_values[index], 2),
                macd=round(macd_values[index], 4),
                macd_signal=round(macd_signal_values[index], 4),
                macd_hist=round(macd_values[index] - macd_signal_values[index], 4),
            )
        )
    return points


def _kd_values(closes: list[float], highs: list[float], lows: list[float]) -> tuple[list[float], list[float]]:
    k_values: list[float] = []
    d_values: list[float] = []
    k = 50.0
    d = 50.0
    for index, close in enumerate(closes):
        start = max(0, index - 8)
        highest = max(highs[start : index + 1])
        lowest = min(lows[start : index + 1])
        rsv = 50.0 if highest == lowest else ((close - lowest) / (highest - lowest)) * 100
        k = (2 / 3) * k + (1 / 3) * rsv
        d = (2 / 3) * d + (1 / 3) * k
        k_values.append(k)
        d_values.append(d)
    return k_values, d_values


def _ema(values: list[float], span: int) -> list[float]:
    if not values:
        return []
    alpha = 2 / (span + 1)
    result = [values[0]]
    for value in values[1:]:
        result.append((value * alpha) + (result[-1] * (1 - alpha)))
    return result


def _indicator_summary(point: MarketIndicatorPoint, window: list[MarketIndicatorPoint], zh: bool) -> list[str]:
    five_day_pct = _window_pct(window, 5)
    volume_ratio = point.volume / point.volume_ma5 if point.volume_ma5 else 1
    if zh:
        return [
            f"收盤 {point.close:.2f}，近 5 日 {five_day_pct:+.2f}%。",
            f"成交量約為 5 日均量的 {volume_ratio:.2f} 倍。",
            f"KD：K={point.k:.1f}、D={point.d:.1f}。",
            f"MACD：DIF={point.macd:.3f}、Signal={point.macd_signal:.3f}、Hist={point.macd_hist:+.3f}。",
        ]
    return [
        f"Close {point.close:.2f}, 5-day move {five_day_pct:+.2f}%.",
        f"Volume is {volume_ratio:.2f}x the 5-day average.",
        f"KD: K={point.k:.1f}, D={point.d:.1f}.",
        f"MACD: DIF={point.macd:.3f}, Signal={point.macd_signal:.3f}, Hist={point.macd_hist:+.3f}.",
    ]


def _indicator_clues(
    point: MarketIndicatorPoint,
    window: list[MarketIndicatorPoint],
    zh: bool,
) -> tuple[list[str], list[str]]:
    five_day_pct = _window_pct(window, 5)
    volume_ratio = point.volume / point.volume_ma5 if point.volume_ma5 else 1
    kd_bull = (point.k or 0) > (point.d or 0)
    macd_bull = (point.macd_hist or 0) > 0

    if zh:
        bull_points = [
            f"近 5 日漲跌幅 {five_day_pct:+.2f}%，若為正代表短線價格動能仍在。",
            f"KD {'偏多：K 高於 D' if kd_bull else '尚未轉強，但可觀察是否接近交叉'}。",
            f"MACD histogram {'在零軸上方' if macd_bull else '若開始收斂，可能是動能修復線索'}。",
        ]
        bear_points = [
            f"成交量為 5 日均量 {volume_ratio:.2f} 倍，放量但價格不續強時要小心反轉。",
            f"KD {'已偏高，可能接近過熱' if (point.k or 0) > 75 else '未明顯強勢，追價需要保守'}。",
            f"MACD histogram {'雖為正但若縮小要留意背離' if macd_bull else '在零軸下方，短線動能偏弱'}。",
        ]
        return bull_points, bear_points

    bull_points = [
        f"The 5-day move is {five_day_pct:+.2f}%; a positive value suggests price momentum remains active.",
        f"KD is {'bullish: K is above D' if kd_bull else 'not yet strong, but watch for a possible turn'}.",
        f"MACD histogram is {'above zero' if macd_bull else 'negative, but contraction could signal momentum repair'}.",
    ]
    bear_points = [
        f"Volume is {volume_ratio:.2f}x the 5-day average; high volume without follow-through can warn of reversal.",
        f"KD is {'elevated and may be overheated' if (point.k or 0) > 75 else 'not clearly strong, so chasing requires caution'}.",
        f"MACD histogram is {'positive, but shrinking would warn of divergence' if macd_bull else 'below zero, showing weak short-term momentum'}.",
    ]
    return bull_points, bear_points


def _window_pct(window: list[MarketIndicatorPoint], days: int) -> float:
    if len(window) <= days:
        return 0.0
    start = window[-days - 1].close
    end = window[-1].close
    return round(((end - start) / start) * 100, 2)


def _answer_side_from_pct(pct_change: float) -> VerdictSide:
    if pct_change > 1:
        return "bull"
    if pct_change < -1:
        return "bear"
    return "neutral"


def _currency_for_ticker(ticker: str) -> str:
    if ticker.endswith(".TW"):
        return "TWD"
    return "USD"


def _to_float(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(number) or math.isinf(number):
        return None
    return number


def _cache_practice_case(case: PracticeCase) -> None:
    now = datetime.now(timezone.utc).isoformat()
    with connect() as connection:
        connection.execute(
            """
            INSERT OR REPLACE INTO practice_questions (question_id, case_json, created_at)
            VALUES (?, ?, ?)
            """,
            (case.id, case.model_dump_json(), now),
        )


def _latest_cached_case() -> PracticeCase | None:
    with connect() as connection:
        row = connection.execute(
            """
            SELECT case_json
            FROM practice_questions
            ORDER BY created_at DESC
            LIMIT 1
            """
        ).fetchone()
    if row is None:
        return None
    return PracticeCase.model_validate_json(row["case_json"])


def submit_practice_attempt(request: PracticeAttemptRequest) -> PracticeAttemptRecord:
    init_db()
    case = _case_by_id(request.question_id)
    result: PracticeResult = "correct" if request.side == case.answer_side else "wrong"
    feedback = analyze_practice_attempt(
        case=case,
        selected_side=request.side,
        confidence=request.confidence,
        rationale=request.rationale,
        language=request.language,
    )
    now = datetime.now(timezone.utc).isoformat()

    with connect() as connection:
        cursor = connection.execute(
            """
            INSERT INTO practice_attempts (
                question_id, selected_side, confidence, rationale, answer_side,
                outcome_pct, result, feedback_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                case.id,
                request.side,
                request.confidence,
                request.rationale,
                case.answer_side,
                case.outcome_pct,
                result,
                feedback.model_dump_json(),
                now,
            ),
        )
        attempt_id = int(cursor.lastrowid)

    return PracticeAttemptRecord(
        id=attempt_id,
        question_id=case.id,
        ticker=case.ticker,
        selected_side=request.side,
        confidence=request.confidence,
        rationale=request.rationale,
        answer_side=case.answer_side,
        outcome_pct=case.outcome_pct,
        result=result,
        feedback=feedback,
        created_at=now,
    )


def analyze_practice_attempt(
    case: PracticeCase,
    selected_side: VerdictSide,
    confidence: int,
    rationale: str,
    language: str,
) -> PracticeFeedback:
    zh = language.startswith("zh")
    normalized = rationale.strip().lower()
    result = selected_side == case.answer_side
    has_number = bool(re.search(r"\d|%|percent|revenue|margin|guidance|valuation|eps|cash|營收|毛利|指引|估值|獲利|現金", normalized))
    has_counter = any(
        token in normalized
        for token in [
            "but",
            "however",
            "although",
            "risk",
            "counter",
            "另一方面",
            "但是",
            "但",
            "然而",
            "不過",
            "風險",
            "反方",
        ]
    )
    is_short = len(rationale.strip()) < 24

    causes: list[str] = []
    steps: list[str] = []
    focus_tags: list[str] = []

    if is_short:
        causes.append(
            "理由太短，還看不出你真正依據哪個可驗證訊號。"
            if zh
            else "The rationale is too short to show which verifiable signal drove the decision."
        )
        steps.append(
            "下一題至少寫出一個數據或事件、一個反方風險、一個會讓你改判的條件。"
            if zh
            else "Next time, write one data point or event, one counter-risk, and one condition that would change your mind."
        )
        focus_tags.append("rationale depth")

    if not has_number:
        causes.append(
            "理由偏敘事，缺少數字、指引、毛利、估值或時間點這類可查核錨點。"
            if zh
            else "The rationale leans narrative-heavy and lacks checkable anchors such as numbers, guidance, margins, valuation, or dates."
        )
        steps.append(
            "把『我覺得會漲/跌』改寫成『因為哪個指標在 7 日內可能重新定價』。"
            if zh
            else "Rewrite 'I think it moves' as 'which indicator could reprice within 7 days, and why'."
        )
        focus_tags.append("evidence")

    if not has_counter:
        causes.append(
            "理由沒有處理反方論點，容易變成只挑支持自己立場的證據。"
            if zh
            else "The rationale does not address the opposing case, which can become confirmation bias."
        )
        steps.append(
            "送出前先問：如果我錯了，最可能是因為我忽略了哪一條反方證據？"
            if zh
            else "Before submitting, ask: if I am wrong, which opposing evidence did I underweight?"
        )
        focus_tags.append("counterargument")

    if confidence >= 4 and (not result or is_short or not has_number):
        causes.append(
            "信心度偏高，但理由的證據密度還不足，可能有過度自信。"
            if zh
            else "Confidence is high while the evidence density is thin, which suggests overconfidence."
        )
        steps.append(
            "高信心只給同時滿足『方向、催化、時間窗』三件事的題目。"
            if zh
            else "Reserve high confidence for cases where direction, catalyst, and time window all line up."
        )
        focus_tags.append("calibration")

    if confidence <= 2 and result:
        causes.append(
            "方向判對但信心偏低，可能代表你看到了訊號，卻還不敢給它足夠權重。"
            if zh
            else "The direction was right but confidence was low; you may have spotted the signal without weighting it enough."
        )
        steps.append(
            "回頭標記你理由中最有效的那個訊號，下次遇到相似結構時提高權重。"
            if zh
            else "Mark the strongest signal in your rationale and give similar signals more weight next time."
        )
        focus_tags.append("signal weighting")

    if not result:
        causes.append(_wrong_side_cause(case.answer_side, selected_side, zh))
        steps.append(_wrong_side_step(case.answer_side, zh))
        focus_tags.append("side selection")

    if not causes:
        causes.append(
            "這次理由有方向、有證據，也有處理不確定性；重點是把這種格式固定下來。"
            if zh
            else "This rationale has direction, evidence, and uncertainty handling; the key is making this format repeatable."
        )
        steps.append(
            "保留這個三段式：主要訊號、反方風險、信心校準。"
            if zh
            else "Keep this three-part structure: main signal, opposing risk, confidence calibration."
        )

    summary = _feedback_summary(case, selected_side, result, confidence, zh)
    return PracticeFeedback(
        summary=summary,
        probable_causes=_dedupe(causes)[:4],
        improvement_steps=_dedupe(steps)[:4],
        focus_tags=_dedupe(focus_tags + case.focus_tags)[:5],
    )


def _feedback_summary(
    case: PracticeCase,
    selected_side: VerdictSide,
    result: bool,
    confidence: int,
    zh: bool,
) -> str:
    answer = _side_label(case.answer_side, zh)
    selected = _side_label(selected_side, zh)
    explanation = case.answer_explanation_zh if zh else case.answer_explanation_en
    if zh:
        verdict = "判對" if result else "判錯"
        return f"你選擇{selected}，信心 {confidence}/5；本題答案是{answer}，結果 {case.outcome_pct:+.1f}%。{verdict}。{explanation}"
    verdict = "correct" if result else "wrong"
    return f"You chose {selected} with {confidence}/5 confidence. The answer is {answer}, outcome {case.outcome_pct:+.1f}%. Result: {verdict}. {explanation}"


def _wrong_side_cause(answer_side: VerdictSide, selected_side: VerdictSide, zh: bool) -> str:
    if answer_side == "neutral":
        return (
            "這題真正的重點是沒有明確優勢；選方向可能代表你太急著把混合訊號二分化。"
            if zh
            else "The lesson was no clear edge; choosing a side may mean you forced mixed signals into a binary call."
        )
    if selected_side == "neutral":
        return (
            "你選了觀望，但題目其實有較清楚的主導訊號；可能等待了過多確定性。"
            if zh
            else "You chose neutral, but the case had a dominant signal; you may be waiting for too much certainty."
        )
    if answer_side == "bull":
        return (
            "你可能過度放大風險敘事，低估了短期可驗證催化。"
            if zh
            else "You may have overweighted the risk narrative and underweighted the near-term checkable catalyst."
        )
    return (
        "你可能被正面標題吸引，低估了獲利品質或指引走弱這類更直接的負面訊號。"
        if zh
        else "You may have been pulled by the positive headline and underweighted the more direct negative signal."
    )


def _wrong_side_step(answer_side: VerdictSide, zh: bool) -> str:
    if answer_side == "neutral":
        return (
            "遇到多空證據都合理時，先檢查是否真的有 7 日內的明確催化；沒有就允許自己選中立。"
            if zh
            else "When both sides are credible, check for a clear 7-day catalyst; if none exists, allow a neutral answer."
        )
    return (
        "把題目中的線索按『具體度』排序，再用最具體的兩條決定方向。"
        if zh
        else "Rank the clues by specificity, then let the two most specific clues drive the side selection."
    )


def _public_question(case: PracticeCase, language: str) -> PracticeQuestion:
    data = case.model_dump(
        exclude={
            "title_zh",
            "scenario_zh",
            "bull_points_zh",
            "bear_points_zh",
            "prompt_zh",
            "answer_side",
            "outcome_pct",
            "answer_explanation_zh",
            "answer_explanation_en",
        }
    )
    if language.startswith("zh"):
        data.update(
            {
                "title": case.title_zh,
                "scenario": case.scenario_zh,
                "bull_points": case.bull_points_zh,
                "bear_points": case.bear_points_zh,
                "prompt": case.prompt_zh,
            }
        )
    if case.market_window:
        data["indicator_summary"] = _indicator_summary(
            case.market_window[-1],
            case.market_window,
            language.startswith("zh"),
        )
    return PracticeQuestion(**data)


def _case_by_id(question_id: str) -> PracticeCase:
    for case in PRACTICE_BANK:
        if case.id == question_id:
            return case
    with connect() as connection:
        row = connection.execute(
            "SELECT case_json FROM practice_questions WHERE question_id = ?",
            (question_id,),
        ).fetchone()
    if row is not None:
        return PracticeCase.model_validate_json(row["case_json"])
    raise ValueError(f"Unknown practice question: {question_id}")


def _recent_attempts(limit: int = 5) -> list[PracticeAttemptRecord]:
    with connect() as connection:
        rows = connection.execute(
            """
            SELECT *
            FROM practice_attempts
            ORDER BY created_at DESC, id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

    return [_attempt_from_row(row) for row in rows]


def _practice_stats() -> PracticeStats:
    with connect() as connection:
        rows = connection.execute("SELECT * FROM practice_attempts").fetchall()

    if not rows:
        return PracticeStats(
            total_attempts=0,
            accuracy_rate=None,
            high_confidence_accuracy_rate=None,
            low_confidence_accuracy_rate=None,
            most_common_focus=None,
        )

    high_confidence = [row for row in rows if row["confidence"] >= 4]
    low_confidence = [row for row in rows if row["confidence"] <= 2]
    tags: list[str] = []
    for row in rows:
        try:
            feedback = json.loads(row["feedback_json"])
        except json.JSONDecodeError:
            continue
        tags.extend(feedback.get("focus_tags", []))

    return PracticeStats(
        total_attempts=len(rows),
        accuracy_rate=_accuracy(rows),
        high_confidence_accuracy_rate=_accuracy(high_confidence),
        low_confidence_accuracy_rate=_accuracy(low_confidence),
        most_common_focus=Counter(tags).most_common(1)[0][0] if tags else None,
    )


def _attempt_from_row(row) -> PracticeAttemptRecord:
    case = _case_by_id(row["question_id"])
    return PracticeAttemptRecord(
        id=row["id"],
        question_id=row["question_id"],
        ticker=case.ticker,
        selected_side=row["selected_side"],
        confidence=row["confidence"],
        rationale=row["rationale"],
        answer_side=row["answer_side"],
        outcome_pct=row["outcome_pct"],
        result=row["result"],
        feedback=PracticeFeedback.model_validate_json(row["feedback_json"]),
        created_at=row["created_at"],
    )


def _accuracy(rows) -> float | None:
    if not rows:
        return None
    correct = sum(1 for row in rows if row["result"] == "correct")
    return round((correct / len(rows)) * 100, 1)


def _side_label(side: VerdictSide, zh: bool) -> str:
    if zh:
        return {"bull": "看多", "bear": "看空", "neutral": "中立"}[side]
    return {"bull": "bull", "bear": "bear", "neutral": "neutral"}[side]


def _dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        if item not in seen:
            seen.add(item)
            result.append(item)
    return result
