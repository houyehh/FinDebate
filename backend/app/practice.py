from __future__ import annotations

import json
import math
import os
import random
import re
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from typing import Any, Literal

from pydantic import BaseModel, Field
import yfinance as yf

from app.database import VerdictSide, connect, init_db

PracticeResult = Literal["correct", "wrong"]
MetricTone = Literal["bull", "bear", "neutral", "warn"]


class SnapshotMetric(BaseModel):
    label: str
    value: str
    detail: str = ""
    tone: MetricTone = "neutral"


class FutureResult(BaseModel):
    horizon_days: int
    settle_date: str
    settle_price: float
    pct_change: float
    result_side: VerdictSide


class AiSnapshot(BaseModel):
    suggested_side: VerdictSide
    confidence: int = Field(ge=1, le=5)
    bull_thesis: str
    bear_thesis: str
    narrative: str
    hard_to_quantify_factors: list[str]
    key_uncertainty: str
    checklist: list[str]
    source: str = "deterministic_ai_coach"


class MarketIndicatorPoint(BaseModel):
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: int
    volume_ma5: float | None = None
    volume_ma20: float | None = None
    ma5: float | None = None
    ma10: float | None = None
    ma20: float | None = None
    bb_middle: float | None = None
    bb_upper: float | None = None
    bb_lower: float | None = None
    rsi: float | None = None
    k: float | None = None
    d: float | None = None
    macd: float | None = None
    macd_signal: float | None = None
    macd_hist: float | None = None
    volatility20: float | None = None


class PracticeQuestion(BaseModel):
    id: str
    ticker: str
    title: str
    as_of: str
    price: float
    currency: str
    horizon_days: int
    scenario: str
    training_goal: str = ""
    bull_points: list[str]
    bear_points: list[str]
    prompt: str
    focus_tags: list[str]
    indicator_summary: list[str] = []
    market_window: list[MarketIndicatorPoint] = []
    technical_snapshot: list[SnapshotMetric] = []
    fundamental_snapshot: list[SnapshotMetric] = []
    news_snapshot: list[SnapshotMetric] = []
    chip_snapshot: list[SnapshotMetric] = []
    ai_snapshot: AiSnapshot | None = None
    data_cutoff_note: str = ""


class PracticeCase(PracticeQuestion):
    title_zh: str = ""
    scenario_zh: str = ""
    training_goal_zh: str = ""
    bull_points_zh: list[str] = []
    bear_points_zh: list[str] = []
    prompt_zh: str = ""
    data_cutoff_note_zh: str = ""
    answer_side: VerdictSide
    outcome_pct: float
    future_results: list[FutureResult] = []
    answer_explanation_zh: str = ""
    answer_explanation_en: str = ""


class JudgmentWeights(BaseModel):
    technical: int = Field(default=35, ge=0, le=100)
    fundamental: int = Field(default=20, ge=0, le=100)
    chip: int = Field(default=20, ge=0, le=100)
    ai: int = Field(default=25, ge=0, le=100)


class PracticeFeedback(BaseModel):
    summary: str
    probable_causes: list[str]
    improvement_steps: list[str]
    focus_tags: list[str]
    diagnosis: str = ""
    missed_signals: list[str] = []
    good_reasoning: list[str] = []
    next_drill_focus: str = ""
    suggested_framework: str = ""


class PracticeAttemptRequest(BaseModel):
    question_id: str = Field(min_length=1)
    side: VerdictSide
    confidence: int = Field(ge=1, le=5)
    rationale: str = ""
    language: str = "zh-Hant"
    weights: JudgmentWeights = Field(default_factory=JudgmentWeights)


class PracticeAttemptRecord(BaseModel):
    id: int
    question_id: str
    ticker: str
    selected_side: VerdictSide
    confidence: int
    rationale: str
    weights: JudgmentWeights
    answer_side: VerdictSide
    outcome_pct: float
    result: PracticeResult
    feedback: PracticeFeedback
    ai_side: VerdictSide | None = None
    ai_agreement: bool | None = None
    future_results: list[FutureResult] = []
    created_at: str


class PracticeStats(BaseModel):
    total_attempts: int
    accuracy_rate: float | None
    high_confidence_accuracy_rate: float | None
    low_confidence_accuracy_rate: float | None
    most_common_focus: str | None
    ai_alignment_rate: float | None = None
    ai_aligned_accuracy_rate: float | None = None
    ai_unaligned_accuracy_rate: float | None = None
    high_technical_weight_accuracy_rate: float | None = None
    high_fundamental_weight_accuracy_rate: float | None = None
    high_chip_weight_accuracy_rate: float | None = None
    high_ai_weight_accuracy_rate: float | None = None
    top_weaknesses: list[str] = []


class PracticeDashboardResponse(BaseModel):
    questions: list[PracticeQuestion]
    stats: PracticeStats
    recent_attempts: list[PracticeAttemptRecord]


class PracticeQuestionNotFoundError(ValueError):
    pass


class PracticeValidationError(ValueError):
    pass


RANDOM_PRACTICE_TICKERS = [
    "NVDA",
    "AAPL",
    "TSLA",
    "MSFT",
    "AMD",
    "INTC",
    "PLTR",
    "SOFI",
    "RIVN",
    "COIN",
    "SHOP",
    "ROKU",
    "NET",
    "DDOG",
    "SNOW",
    "UBER",
    "BA",
    "PFE",
    "PYPL",
    "BTC-USD",
    "ETH-USD",
    "SOL-USD",
    "2330.TW",
    "2317.TW",
    "2454.TW",
    "2303.TW",
]
PRACTICE_HORIZONS = [1, 7, 30]


def get_practice_dashboard(language: str = "zh-Hant", refresh_random: bool = True) -> PracticeDashboardResponse:
    init_db()
    recent_attempts = _recent_attempts()
    questions = [_public_question(case, language) for case in PRACTICE_BANK]

    if refresh_random and os.getenv("PRACTICE_DISABLE_RANDOM") != "1":
        try:
            random_case = generate_random_market_case(language)
        except Exception:
            random_case = _fallback_random_market_case(language)
        try:
            _cache_practice_case(random_case)
        except Exception:
            pass
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
    source_note = "Yahoo Finance historical OHLCV through the as-of date."
    try:
        raw_rows = _history_rows_for_ticker(ticker)
    except Exception:
        ticker = "DEMO"
        raw_rows = _fallback_history_rows()
        source_note = "Local deterministic fallback OHLCV through the as-of date."

    points = _indicator_points(raw_rows)
    if len(points) < 95:
        ticker = "DEMO"
        points = _indicator_points(_fallback_history_rows())
        source_note = "Local deterministic fallback OHLCV through the as-of date."

    max_index = len(points) - 31
    selected_index = random.randint(60, max_index)
    horizon = PRACTICE_HORIZONS[random.randint(0, len(PRACTICE_HORIZONS) - 1)]
    return _case_from_points(ticker, points, selected_index, horizon, source_note, language)


def _fallback_random_market_case(language: str = "zh-Hant") -> PracticeCase:
    points = _indicator_points(_fallback_history_rows())
    max_index = len(points) - 31
    selected_index = min(max(60, max_index // 2), max_index)
    return _case_from_points(
        "DEMO",
        points,
        selected_index,
        7,
        "Local deterministic fallback OHLCV through the as-of date.",
        language,
        use_live_fundamentals=False,
    )


def submit_practice_attempt(request: PracticeAttemptRequest) -> PracticeAttemptRecord:
    init_db()
    if _weight_total(request.weights) != 100:
        raise PracticeValidationError("Judgment weights must add up to 100.")

    case = _case_by_id(request.question_id)
    result: PracticeResult = "correct" if request.side == case.answer_side else "wrong"
    ai_side = case.ai_snapshot.suggested_side if case.ai_snapshot else None
    ai_agreement = request.side == ai_side if ai_side else None
    feedback = analyze_practice_attempt(
        case=case,
        selected_side=request.side,
        confidence=request.confidence,
        rationale=request.rationale,
        weights=request.weights,
        language=request.language,
    )
    now = datetime.now(timezone.utc).isoformat()

    with connect() as connection:
        cursor = connection.execute(
            """
            INSERT INTO practice_attempts (
                question_id, selected_side, confidence, rationale, answer_side,
                outcome_pct, result, feedback_json, created_at,
                weights_json, ai_side, ai_agreement
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                request.weights.model_dump_json(),
                ai_side,
                int(ai_agreement) if ai_agreement is not None else None,
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
        weights=request.weights,
        answer_side=case.answer_side,
        outcome_pct=case.outcome_pct,
        result=result,
        feedback=feedback,
        ai_side=ai_side,
        ai_agreement=ai_agreement,
        future_results=case.future_results,
        created_at=now,
    )


def analyze_practice_attempt(
    case: PracticeCase,
    selected_side: VerdictSide,
    confidence: int,
    rationale: str,
    weights: JudgmentWeights,
    language: str,
) -> PracticeFeedback:
    zh = language.startswith("zh")
    normalized = rationale.strip().lower()
    result = selected_side == case.answer_side
    ai_side = case.ai_snapshot.suggested_side if case.ai_snapshot else None
    weights_map = weights.model_dump()
    top_dimension = max(weights_map, key=weights_map.get)

    has_number = bool(re.search(r"\d|%|rsi|kd|macd|ma|pe|margin|volume|量|均線|本益比|營收|新聞|題材|ai", normalized))
    has_counter = any(token in normalized for token in ["but", "however", "risk", "counter", "雖然", "但是", "風險", "反方"])
    is_short = len(rationale.strip()) < 24
    signal_labels = _rationale_signal_labels(normalized)
    rationale_excerpt = _rationale_excerpt(rationale)

    causes: list[str] = []
    steps: list[str] = []
    missed: list[str] = []
    good: list[str] = []
    tags: list[str] = []

    if is_short:
        causes.append(_text(zh, "理由太短，還看不出你真正依據哪一個可驗證訊號。", "The rationale is too short to reveal the signal you relied on."))
        steps.append(_text(zh, "下一題請至少寫出一個主訊號、一個反方風險，以及你給這個信心度的原因。", "Next time, write one main signal, one counter-risk, and why the confidence level fits."))
        tags.append("rationale depth")
    elif signal_labels:
        good.append(
            _text(
                zh,
                f"你的理由「{rationale_excerpt}」明確使用了：{'、'.join(signal_labels)}。",
                f"Your rationale, \"{rationale_excerpt}\", explicitly used: {', '.join(signal_labels)}.",
            )
        )

    if not has_number:
        causes.append(_text(zh, "理由缺少數字或指標錨點，容易變成感覺式判斷。", "The rationale lacks numeric or indicator anchors, so it can become impression-driven."))
        steps.append(_text(zh, "把理由改寫成「哪個數據會在目標週期內重新定價，為什麼」。", "Rewrite the rationale as: which data point can reprice within the target horizon, and why."))
        tags.append("evidence")
    else:
        good.append(_text(zh, "你有嘗試把判斷連回具體資料，這是可回測訓練的核心。", "You connected the judgment to concrete data, which is the core of backtestable practice."))

    if weights.technical >= 35 and not _mentions_any(normalized, ["rsi", "kd", "macd", "ma", "boll", "bb", "均線", "布林", "量", "volume"]):
        causes.append(_text(zh, "你給技術面較高權重，但理由沒有點名圖表上的技術訊號。", "You gave technicals meaningful weight, but the rationale did not name a chart signal."))
        steps.append(_text(zh, "下次請在理由中引用游標 tooltip 裡的一個具體技術數字。", "Next time, cite one concrete number from the chart tooltip."))
        tags.append("technical evidence")

    if weights.fundamental >= 25 and not _mentions_any(normalized, ["pe", "margin", "revenue", "growth", "news", "theme", "sector", "題材", "新聞", "營收", "本益比", "毛利", "產業"]):
        causes.append(_text(zh, "你給基本/新聞面權重，但理由沒有說明公司切入領域、財務或新聞題材。", "You weighted fundamentals/news, but did not explain the business lane, financials, or news theme."))
        steps.append(_text(zh, "下次請把基本面寫成：公司在做什麼、最近題材是什麼、這和目標週期有什麼關係。", "Next time, write: what the company does, the recent theme, and why it matters for the horizon."))
        tags.append("fundamental/news evidence")

    if weights.ai >= 30 and not _mentions_any(normalized, ["ai", "模型", "人工智慧", "thesis", "敘事", "narrative"]):
        causes.append(_text(zh, "你分配了 AI 面權重，但理由沒有說明你採納或反駁 AI 論點的原因。", "You assigned AI weight, but did not explain why you accepted or rejected the AI thesis."))
        steps.append(_text(zh, "下次請寫出 AI 論點的一個可驗證部分，以及一個可能讓 AI 錯的條件。", "Next time, write one verifiable part of the AI thesis and one condition that would make it wrong."))
        tags.append("AI thesis use")

    if not has_counter:
        causes.append(_text(zh, "理由沒有處理反方訊號，容易形成確認偏誤。", "The rationale does not handle opposing evidence, which can create confirmation bias."))
        missed.append(_text(zh, "提交前先問：如果我錯了，最可能是哪個反方訊號我低估了？", "Before submitting, ask: if I am wrong, which opposing signal did I underweight?"))
        tags.append("counterargument")
    else:
        good.append(_text(zh, "你有納入反方風險，這有助於避免只挑支持自己方向的證據。", "You included a counter-risk, which helps avoid cherry-picking evidence."))

    if weights.ai >= 45 and ai_side == selected_side:
        causes.append(_text(zh, "AI 面權重偏高且你與 AI 同邊，請確認這是被證據說服，不是盲從 AI。", "AI weight is high and you matched AI; verify that evidence convinced you, not AI authority alone."))
        steps.append(_text(zh, "下次請明確寫出：AI 論點和技術/基本/新聞題材哪一項互相驗證。", "Next time, state which technical, fundamental, or news/theme signal validates the AI thesis."))
        tags.append("AI reliance")

    if ai_side and selected_side != ai_side and _mentions_any(normalized, ["ai", "模型", "人工智慧", "thesis", "敘事", "narrative"]):
        good.append(_text(zh, "你有意識地沒有盲從 AI，這對訓練獨立判斷很重要。", "You consciously did not follow AI blindly, which is important for independent judgment."))

    if max(weights_map.values()) >= 60:
        causes.append(_text(zh, f"{_dimension_label(top_dimension, zh)}權重過高，可能忽略其他面向。", f"{_dimension_label(top_dimension, zh)} weight is very high, which may crowd out other dimensions."))
        steps.append(_text(zh, "刻意找一個不同面向的反證，再決定是否維持原方向。", "Force yourself to find one disconfirming signal from another dimension before locking the side."))
        tags.append(f"{top_dimension} overweight")

    if confidence >= 4 and (not result or is_short or not has_number):
        causes.append(_text(zh, "高信心但證據密度不足，這是校準度風險。", "High confidence with thin evidence is a calibration risk."))
        steps.append(_text(zh, "只有在方向、催化因素、時間週期三者一致時，才保留 4-5 分信心。", "Reserve 4-5 confidence for cases where direction, catalyst, and horizon align."))
        tags.append("calibration")

    if not result:
        causes.append(_wrong_side_cause(case.answer_side, selected_side, zh))
        steps.append(_wrong_side_step(case.answer_side, zh))
        missed.extend(_missed_signals(case, zh))
        tags.append("side selection")

    if not causes:
        causes.append(_text(zh, "方向、證據與不確定性處理都相對完整，下一步是讓這套流程穩定重複。", "Direction, evidence, and uncertainty handling are solid; make the process repeatable."))
        steps.append(_text(zh, "維持三段式：主訊號、反方風險、信心校準。", "Keep the three-part structure: main signal, opposing risk, confidence calibration."))

    summary = _feedback_summary(case, selected_side, result, confidence, zh)
    diagnosis = _feedback_diagnosis(
        case=case,
        selected_side=selected_side,
        confidence=confidence,
        weights=weights,
        signal_labels=signal_labels,
        result=result,
        zh=zh,
    )
    return PracticeFeedback(
        summary=summary,
        probable_causes=_dedupe(causes)[:5],
        improvement_steps=_dedupe(steps)[:5],
        focus_tags=_dedupe(tags + case.focus_tags)[:6],
        diagnosis=diagnosis,
        missed_signals=_dedupe(missed)[:4],
        good_reasoning=_dedupe(good)[:4],
        next_drill_focus=_next_drill_focus(tags, zh),
        suggested_framework=_personalized_framework(weights, signal_labels, zh),
    )


def _case_from_points(
    ticker: str,
    points: list[MarketIndicatorPoint],
    selected_index: int,
    horizon: int,
    source_note: str,
    language: str,
    use_live_fundamentals: bool = True,
) -> PracticeCase:
    selected = points[selected_index]
    window = points[max(0, selected_index - 59) : selected_index + 1]
    future_results = _future_results(points, selected_index)
    target_result = next(item for item in future_results if item.horizon_days == horizon)
    answer_side = target_result.result_side
    outcome_pct = target_result.pct_change
    technical_snapshot = _technical_snapshot(selected, window)
    fundamental_snapshot = _fundamental_snapshot(ticker, as_of=selected.date) if use_live_fundamentals else _demo_fundamental_snapshot(ticker)
    news_snapshot = _news_snapshot(ticker, as_of=selected.date) if use_live_fundamentals else _demo_news_snapshot(ticker, as_of=selected.date)
    chip_snapshot = _chip_snapshot(selected, window)
    ai_snapshot = _ai_snapshot(ticker, selected, window, technical_snapshot, fundamental_snapshot, chip_snapshot)
    bull_points, bear_points = _factor_clues(selected, window, ai_snapshot, False)
    bull_points_zh, bear_points_zh = _factor_clues(selected, window, ai_snapshot, True)
    question_id = f"history-{ticker}-{selected.date}-{horizon}d-{random.randint(1000, 9999)}"
    currency = _currency_for_ticker(ticker)
    title = f"Historical snapshot: {ticker} on {selected.date}"
    title_zh = f"歷史截面題：{ticker} 在 {selected.date}"
    scenario = (
        f"You are back on {selected.date}. Only information available through this date is visible. "
        f"Use technical, fundamental, news/theme, and AI dimensions to judge the next {horizon} available trading day(s)."
    )
    scenario_zh = (
        f"你被放回 {selected.date}。畫面只顯示這一天以前可見的資訊，請整合技術面、基本面、新聞/題材與 AI 面，"
        f"判斷接下來 {horizon} 個可交易日的方向。"
    )
    data_note = f"Visible market data ends at {selected.date}. Future prices are hidden until submission. {source_note}"
    data_note_zh = f"可見市場資料截止於 {selected.date}；未來價格會在提交後才揭曉。{source_note}"
    explanation_en = (
        f"The as-of close was {selected.close:.2f}. The {horizon}D settlement close was "
        f"{target_result.settle_price:.2f} on {target_result.settle_date}, a {outcome_pct:+.2f}% move. "
        f"With +/-1% treated as neutral, the reference answer is {_side_label(answer_side, False)}."
    )
    explanation_zh = (
        f"截面收盤價為 {selected.close:.2f}。{horizon} 日後在 {target_result.settle_date} 的結算價為 "
        f"{target_result.settle_price:.2f}，報酬 {outcome_pct:+.2f}%。以 ±1% 視為中立，參考答案是"
        f"{_side_label(answer_side, True)}。"
    )

    return PracticeCase(
        id=question_id,
        ticker=ticker,
        title=title,
        title_zh=title_zh,
        as_of=selected.date,
        price=selected.close,
        currency=currency,
        horizon_days=horizon,
        scenario=scenario,
        scenario_zh=scenario_zh,
        training_goal="Practice integrating technical, fundamental, news/theme, and AI analysis without future leakage.",
        training_goal_zh="訓練你在沒有未來資料的情況下，整合技術面、基本面、新聞/題材與 AI 面。",
        bull_points=bull_points,
        bull_points_zh=bull_points_zh,
        bear_points=bear_points,
        bear_points_zh=bear_points_zh,
        prompt=f"What is your {horizon}D directional judgment from this historical snapshot?",
        prompt_zh=f"只根據這個歷史截面，你對未來 {horizon} 日的方向判斷是什麼？",
        focus_tags=["historical backtest", "technical", "fundamental", "news/theme", "AI usage"],
        indicator_summary=_indicator_summary(selected, window, language.startswith("zh")),
        market_window=window,
        technical_snapshot=technical_snapshot,
        fundamental_snapshot=fundamental_snapshot,
        news_snapshot=news_snapshot,
        chip_snapshot=chip_snapshot,
        ai_snapshot=ai_snapshot,
        data_cutoff_note=data_note,
        data_cutoff_note_zh=data_note_zh,
        answer_side=answer_side,
        outcome_pct=outcome_pct,
        future_results=future_results,
        answer_explanation_zh=explanation_zh,
        answer_explanation_en=explanation_en,
    )


def _history_rows_for_ticker(ticker: str) -> list[dict[str, Any]]:
    history = yf.Ticker(ticker).history(period="5y", interval="1d", auto_adjust=False)
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

    if len(rows) < 95:
        raise ValueError(f"Not enough history for {ticker}")
    return rows


def _fallback_history_rows() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    current = date(2025, 1, 2)
    index = 0
    while len(rows) < 140:
        if current.weekday() < 5:
            trend = index * 0.18
            wave = math.sin(index / 5) * 2.4
            pullback = -7.5 if 72 <= index <= 82 else 0
            close = 100 + trend + wave + pullback
            open_price = close - math.sin(index / 3) * 1.1
            high = max(open_price, close) + 1.4 + abs(math.sin(index)) * 0.5
            low = min(open_price, close) - 1.2 - abs(math.cos(index)) * 0.4
            volume = int(24_000_000 + (index % 13) * 1_350_000 + (6_500_000 if 72 <= index <= 82 else 0))
            rows.append(
                {
                    "date": current.isoformat(),
                    "open": round(open_price, 4),
                    "high": round(high, 4),
                    "low": round(low, 4),
                    "close": round(close, 4),
                    "volume": volume,
                }
            )
            index += 1
        current += timedelta(days=1)
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
    rsi_values = _rsi_values(closes, 14)
    volatility_values = _volatility_values(closes, 20)

    points: list[MarketIndicatorPoint] = []
    for index, row in enumerate(rows):
        volume_window_5 = volumes[max(0, index - 4) : index + 1]
        volume_window_20 = volumes[max(0, index - 19) : index + 1]
        close_window_5 = closes[max(0, index - 4) : index + 1]
        close_window_10 = closes[max(0, index - 9) : index + 1]
        close_window_20 = closes[max(0, index - 19) : index + 1]
        close_ma20 = sum(close_window_20) / len(close_window_20)
        bb_std = _stddev(close_window_20)
        points.append(
            MarketIndicatorPoint(
                date=row["date"],
                open=round(float(row["open"]), 4),
                high=round(float(row["high"]), 4),
                low=round(float(row["low"]), 4),
                close=round(float(row["close"]), 4),
                volume=int(row["volume"]),
                volume_ma5=round(sum(volume_window_5) / len(volume_window_5), 2),
                volume_ma20=round(sum(volume_window_20) / len(volume_window_20), 2),
                ma5=round(sum(close_window_5) / len(close_window_5), 4),
                ma10=round(sum(close_window_10) / len(close_window_10), 4),
                ma20=round(close_ma20, 4),
                bb_middle=round(close_ma20, 4),
                bb_upper=round(close_ma20 + bb_std * 2, 4),
                bb_lower=round(close_ma20 - bb_std * 2, 4),
                rsi=round(rsi_values[index], 2),
                k=round(k_values[index], 2),
                d=round(d_values[index], 2),
                macd=round(macd_values[index], 4),
                macd_signal=round(macd_signal_values[index], 4),
                macd_hist=round(macd_values[index] - macd_signal_values[index], 4),
                volatility20=round(volatility_values[index], 4),
            )
        )
    return points


def _technical_snapshot(point: MarketIndicatorPoint, window: list[MarketIndicatorPoint]) -> list[SnapshotMetric]:
    pct5 = _window_pct(window, 5)
    pct20 = _window_pct(window, 20)
    ma_tone: MetricTone = "bull" if (point.ma5 or 0) > (point.ma20 or 0) else "bear"
    rsi_tone: MetricTone = "warn" if (point.rsi or 50) > 70 else "bear" if (point.rsi or 50) < 40 else "neutral"
    macd_tone: MetricTone = "bull" if (point.macd_hist or 0) > 0 else "bear"
    return [
        SnapshotMetric(label="5D return", value=f"{pct5:+.2f}%", tone=_pct_tone(pct5)),
        SnapshotMetric(label="20D return", value=f"{pct20:+.2f}%", tone=_pct_tone(pct20)),
        SnapshotMetric(label="MA5 / MA10 / MA20", value=f"{point.ma5:.2f} / {point.ma10:.2f} / {point.ma20:.2f}", tone=ma_tone),
        SnapshotMetric(label="Bollinger", value=_bollinger_position(point), detail="Close location relative to 20D bands.", tone=_bollinger_tone(point)),
        SnapshotMetric(label="RSI14", value=f"{point.rsi:.1f}", detail="Over 70 can be crowded; under 40 can be weak.", tone=rsi_tone),
        SnapshotMetric(label="KD", value=f"K {point.k:.1f} / D {point.d:.1f}", tone="bull" if (point.k or 0) > (point.d or 0) else "bear"),
        SnapshotMetric(label="MACD hist", value=f"{point.macd_hist:+.4f}", tone=macd_tone),
        SnapshotMetric(label="20D volatility", value=f"{(point.volatility20 or 0) * 100:.2f}%", detail="Daily close-to-close volatility proxy."),
    ]


def _fundamental_snapshot(ticker: str, as_of: str | None = None) -> list[SnapshotMetric]:
    if ticker == "DEMO":
        return _demo_fundamental_snapshot(ticker)

    try:
        ticker_obj = yf.Ticker(ticker)
        info = ticker_obj.info
    except Exception:
        info = {}
        ticker_obj = None
    if not isinstance(info, dict):
        info = {}

    metrics: list[SnapshotMetric] = []
    cutoff = _parse_iso_date(as_of) if as_of else None
    if cutoff and ticker_obj is not None:
        historical_metrics = _historical_financial_snapshot(ticker_obj, cutoff)
        if historical_metrics:
            return historical_metrics[:6]
        return [
            SnapshotMetric(
                label="Historical financials",
                value="As-of backfill unavailable",
                detail="Current valuation and revenue ratios are hidden to avoid future leakage.",
                tone="warn",
            ),
            *_demo_fundamental_snapshot(ticker)[:5],
        ][:6]

    market_cap = _to_float(info.get("marketCap"))
    trailing_pe = _to_float(info.get("trailingPE"))
    forward_pe = _to_float(info.get("forwardPE"))
    revenue_growth = _to_float(info.get("revenueGrowth"))
    profit_margin = _to_float(info.get("profitMargins"))
    debt_to_equity = _to_float(info.get("debtToEquity"))
    recommendation = info.get("recommendationKey")

    if market_cap:
        metrics.append(SnapshotMetric(label="Market cap", value=_compact_number(market_cap), detail="Latest yfinance company profile proxy."))
    if trailing_pe:
        metrics.append(SnapshotMetric(label="Trailing PE", value=f"{trailing_pe:.1f}", tone="warn" if trailing_pe > 45 else "neutral"))
    if forward_pe:
        metrics.append(SnapshotMetric(label="Forward PE", value=f"{forward_pe:.1f}", tone="warn" if forward_pe > 45 else "neutral"))
    if revenue_growth is not None:
        metrics.append(SnapshotMetric(label="Revenue growth", value=f"{revenue_growth * 100:+.1f}%", tone=_pct_tone(revenue_growth * 100)))
    if profit_margin is not None:
        metrics.append(SnapshotMetric(label="Profit margin", value=f"{profit_margin * 100:.1f}%", tone="bull" if profit_margin > 0.15 else "neutral"))
    if debt_to_equity is not None:
        metrics.append(SnapshotMetric(label="Debt/equity", value=f"{debt_to_equity:.1f}", tone="warn" if debt_to_equity > 150 else "neutral"))
    if isinstance(recommendation, str) and recommendation:
        metrics.append(SnapshotMetric(label="Analyst proxy", value=recommendation.replace("_", " ").title(), detail="Latest yfinance recommendation key."))

    if not metrics:
        metrics.append(
            SnapshotMetric(
                label="Fundamental data",
                value="Not enough data",
                detail="yfinance did not return enough fundamental fields for this asset.",
                tone="warn",
            )
        )
    return metrics[:6]


def _historical_financial_snapshot(ticker_obj: Any, cutoff: date) -> list[SnapshotMetric]:
    try:
        financials = ticker_obj.quarterly_financials
    except Exception:
        return []
    if financials is None or bool(getattr(financials, "empty", True)):
        return []

    columns: list[tuple[date, Any]] = []
    for column in list(getattr(financials, "columns", [])):
        column_date = _financial_column_date(column)
        if column_date and column_date <= cutoff:
            columns.append((column_date, column))
    columns.sort(key=lambda item: item[0], reverse=True)
    if not columns:
        return []

    current_date, current_column = columns[0]
    previous_column = columns[1][1] if len(columns) > 1 else None
    revenue = _financial_value(financials, current_column, ["Total Revenue", "TotalRevenue"])
    previous_revenue = _financial_value(financials, previous_column, ["Total Revenue", "TotalRevenue"]) if previous_column is not None else None
    net_income = _financial_value(financials, current_column, ["Net Income", "NetIncome"])
    operating_income = _financial_value(financials, current_column, ["Operating Income", "OperatingIncome", "EBIT"])

    metrics = [
        SnapshotMetric(
            label="Financial period",
            value=current_date.isoformat(),
            detail="Latest quarterly financial period ending before the question cutoff; filing lag is approximated.",
        )
    ]
    if revenue is not None:
        metrics.append(SnapshotMetric(label="Revenue", value=_compact_number(revenue), detail="Quarterly statement value before cutoff."))
    if previous_revenue not in (None, 0) and revenue is not None:
        revenue_change = ((revenue - previous_revenue) / abs(previous_revenue)) * 100
        metrics.append(SnapshotMetric(label="Revenue change", value=f"{revenue_change:+.1f}%", detail="Sequential change from the prior available quarter.", tone=_pct_tone(revenue_change)))
    if net_income is not None:
        metrics.append(SnapshotMetric(label="Net income", value=_compact_number(net_income), detail="Quarterly statement value before cutoff.", tone="bull" if net_income > 0 else "bear"))
    if revenue not in (None, 0) and net_income is not None:
        margin = (net_income / revenue) * 100
        metrics.append(SnapshotMetric(label="Net margin", value=f"{margin:.1f}%", detail="Net income divided by revenue.", tone="bull" if margin > 15 else "bear" if margin < 0 else "neutral"))
    if operating_income is not None:
        metrics.append(SnapshotMetric(label="Operating income", value=_compact_number(operating_income), detail="Quarterly statement value before cutoff.", tone="bull" if operating_income > 0 else "bear"))
    return metrics[:6]


def _news_snapshot(ticker: str, as_of: str | None = None) -> list[SnapshotMetric]:
    if ticker == "DEMO":
        return _demo_news_snapshot(ticker, as_of=as_of)

    try:
        ticker_obj = yf.Ticker(ticker)
        info = ticker_obj.info
    except Exception:
        info = {}
        ticker_obj = None
    if not isinstance(info, dict):
        info = {}

    metrics: list[SnapshotMetric] = []
    sector = info.get("sector")
    industry = info.get("industry")
    summary = info.get("longBusinessSummary")

    if sector or industry:
        metrics.append(
            SnapshotMetric(
                label="Business lane",
                value=" / ".join(str(item) for item in [sector, industry] if item),
                detail="Current yfinance company profile; use as business context, not future price evidence.",
            )
        )
    if isinstance(summary, str) and summary:
        metrics.append(
            SnapshotMetric(
                label="What it does",
                value=_short_text(summary, 96),
                detail="Business context only; do not treat it as an as-of-date filing.",
            )
        )

    news_items: list[Any] = []
    if ticker_obj is not None:
        try:
            news_items = ticker_obj.news or []
        except Exception:
            news_items = []

    cutoff = _parse_iso_date(as_of) if as_of else None
    eligible_news: list[tuple[Any, date | None]] = []
    for item in news_items:
        published_at = _news_date(item)
        if cutoff and published_at and published_at > cutoff:
            continue
        if cutoff and published_at and published_at < cutoff - timedelta(days=120):
            continue
        if cutoff and not published_at:
            continue
        eligible_news.append((item, published_at))

    for item, published_at in eligible_news[:3]:
        title = _news_title(item)
        if not title:
            continue
        publisher = _news_publisher(item)
        source_detail = publisher or "yfinance news item"
        if published_at:
            source_detail = f"{source_detail} · {published_at.isoformat()}"
        metrics.append(
            SnapshotMetric(
                label="As-of news" if cutoff else "Recent news",
                value=_short_text(title, 88),
                detail=source_detail,
                tone="neutral",
            )
        )

    if not metrics:
        metrics.extend(_demo_news_snapshot(ticker, as_of=as_of))
    elif cutoff and not any(metric.label == "As-of news" for metric in metrics):
        metrics.append(
            SnapshotMetric(
                label="Historical news",
                value="No yfinance news available before the cutoff",
                detail="The drill avoids showing later headlines that the past self could not know.",
                tone="warn",
            )
        )
    return metrics[:5]


def _demo_fundamental_snapshot(ticker: str) -> list[SnapshotMetric]:
    profiles = {
        "NVDA": ("AI semiconductor leader", "Premium", "Strong"),
        "AAPL": ("Consumer hardware ecosystem", "Quality premium", "Stable"),
        "BTC-USD": ("Crypto asset", "No PE", "Liquidity-driven"),
        "DEMO": ("Demo mega-cap growth stock", "Moderate premium", "Positive"),
    }
    profile, valuation, growth = profiles.get(ticker, ("Large liquid asset", "Mixed", "Mixed"))
    return [
        SnapshotMetric(label="Profile", value=profile, detail="Local demo profile, not a live filing feed."),
        SnapshotMetric(label="Valuation proxy", value=valuation, detail="Used only for training context."),
        SnapshotMetric(label="Growth proxy", value=growth, detail="Used only for training context.", tone="bull" if growth in {"Strong", "Positive"} else "neutral"),
    ]


def _demo_news_snapshot(ticker: str, as_of: str | None = None) -> list[SnapshotMetric]:
    themes = {
        "NVDA": ("AI accelerators", "Watch whether AI capex expectations are already priced in."),
        "AAPL": ("Device cycle and services", "Short horizons often react to demand checks and ecosystem headlines."),
        "TSLA": ("EV margins and autonomy", "Narrative can swing between growth optionality and pricing pressure."),
        "MSFT": ("Cloud and AI software", "AI monetization and capex commentary can move sentiment."),
        "AMD": ("AI GPU challenger", "Market watches whether accelerator share gains become visible revenue."),
        "INTC": ("Foundry turnaround", "Execution milestones matter more than long-term ambition alone."),
        "PLTR": ("AI software adoption", "Commercial growth narratives can reprice quickly."),
        "SOFI": ("Fintech profitability", "Credit quality and member growth can dominate near-term reactions."),
        "RIVN": ("EV production ramp", "Cash burn, deliveries, and guidance changes matter."),
        "COIN": ("Crypto trading activity", "Crypto price momentum and regulation narratives feed volume expectations."),
        "SHOP": ("Merchant commerce platform", "GMV growth and margin discipline are common catalysts."),
        "ROKU": ("Streaming ad cycle", "Ad demand and platform monetization drive sentiment."),
        "NET": ("Edge security growth", "Enterprise spend and AI traffic narratives can shift valuation."),
        "DDOG": ("Cloud observability", "Cloud optimization cycles and usage growth are key themes."),
        "SNOW": ("Data cloud consumption", "Consumption growth and AI data workloads shape expectations."),
        "UBER": ("Mobility and delivery scale", "Margins, demand resilience, and capital returns matter."),
        "BA": ("Aerospace execution risk", "Production quality and delivery cadence can outweigh valuation."),
        "PFE": ("Pharma pipeline reset", "Pipeline updates and post-COVID revenue base matter."),
        "PYPL": ("Payments turnaround", "Branded checkout growth and margin repair are central themes."),
        "BTC-USD": ("Crypto liquidity cycle", "ETF flows, regulation, and leverage psychology often dominate."),
        "ETH-USD": ("Smart-contract ecosystem", "Network activity, staking, and ETF narratives shape sentiment."),
        "SOL-USD": ("High-beta crypto ecosystem", "Network usage and risk appetite can move quickly."),
        "2330.TW": ("AI semiconductor manufacturing", "AI demand, capex, currency, and geopolitical risk all matter."),
        "2317.TW": ("Electronics manufacturing", "AI server demand and margin mix are common themes."),
        "2454.TW": ("Mobile and edge chips", "Phone cycle and networking demand affect revisions."),
        "2303.TW": ("Foundry cycle", "Utilization, pricing, and mature-node demand are key."),
    }
    theme, detail = themes.get(ticker, ("Theme unavailable", "Use the news panel as context, not as a standalone signal."))
    cutoff_detail = f"As-of {as_of}; yfinance does not provide reliable historical headline backfill here." if as_of else "Fallback item keeps the drill usable when yfinance news is unavailable."
    return [
        SnapshotMetric(label="Theme lens", value=theme, detail=detail),
        SnapshotMetric(label="Historical news", value="No as-of headline available", detail=cutoff_detail, tone="warn"),
    ]


def _chip_snapshot(point: MarketIndicatorPoint, window: list[MarketIndicatorPoint]) -> list[SnapshotMetric]:
    pct5 = _window_pct(window, 5)
    pct20 = _window_pct(window, 20)
    volume_ratio = point.volume / point.volume_ma20 if point.volume_ma20 else 1
    obv_trend = _obv_trend(window, 10)
    close_location = 0.5 if point.high == point.low else (point.close - point.low) / (point.high - point.low)
    divergence = "Price up without volume confirmation" if pct5 > 1 and volume_ratio < 0.9 else "Volume confirms move" if volume_ratio > 1.2 else "Mixed"

    return [
        SnapshotMetric(label="Volume / 20D avg", value=f"{volume_ratio:.2f}x", detail="Price-volume read, not institutional flow.", tone="bull" if volume_ratio > 1.2 and pct5 > 0 else "bear" if volume_ratio > 1.2 and pct5 < 0 else "neutral"),
        SnapshotMetric(label="OBV 10D proxy", value=f"{obv_trend:+.2f}%", detail="Uses close direction x volume.", tone=_pct_tone(obv_trend)),
        SnapshotMetric(label="Close location", value=f"{close_location * 100:.0f}%", detail="Close position inside daily high-low range.", tone="bull" if close_location > 0.65 else "bear" if close_location < 0.35 else "neutral"),
        SnapshotMetric(label="Price-volume read", value=divergence, detail=f"5D {pct5:+.2f}%, 20D {pct20:+.2f}%.", tone="warn" if "without" in divergence else "neutral"),
    ]


def _ai_snapshot(
    ticker: str,
    point: MarketIndicatorPoint,
    window: list[MarketIndicatorPoint],
    technical: list[SnapshotMetric],
    fundamental: list[SnapshotMetric],
    chip: list[SnapshotMetric],
) -> AiSnapshot:
    score = 0
    pct20 = _window_pct(window, 20)
    volume_ratio = point.volume / point.volume_ma20 if point.volume_ma20 else 1
    score += 1 if pct20 > 2 else -1 if pct20 < -2 else 0
    score += 1 if (point.ma5 or 0) > (point.ma20 or 0) else -1
    score += 1 if (point.macd_hist or 0) > 0 else -1
    score += 1 if volume_ratio > 1.15 and pct20 > 0 else -1 if volume_ratio > 1.15 and pct20 < 0 else 0
    score += 1 if any(metric.tone == "bull" for metric in fundamental) else 0
    score -= 1 if any(metric.tone == "warn" and metric.label in {"Trailing PE", "Forward PE"} for metric in fundamental) else 0
    side = "bull" if score >= 2 else "bear" if score <= -2 else "neutral"
    confidence = min(5, max(1, 2 + abs(score)))

    return AiSnapshot(
        suggested_side=side,
        confidence=confidence,
        bull_thesis=_ai_bull_thesis(ticker, point, pct20, volume_ratio),
        bear_thesis=_ai_bear_thesis(ticker, point, pct20, volume_ratio),
        narrative=_ticker_narrative(ticker, side),
        hard_to_quantify_factors=[
            "Market psychology around recent momentum",
            "Investor tolerance for valuation and uncertainty",
            "Whether news flow is already priced into the chart",
        ],
        key_uncertainty="The AI view may overfit visible price action; compare it against hard indicators before following it.",
        checklist=[
            "Does the AI thesis cite a concrete signal?",
            "Does technical momentum agree with the AI side?",
            "Does news/theme context confirm or contradict the AI thesis?",
            "What evidence would make the AI thesis wrong?",
        ],
    )


def _indicator_summary(point: MarketIndicatorPoint, window: list[MarketIndicatorPoint], zh: bool) -> list[str]:
    pct5 = _window_pct(window, 5)
    pct20 = _window_pct(window, 20)
    volume_ratio = point.volume / point.volume_ma20 if point.volume_ma20 else 1
    ma5 = _optional_number(point.ma5)
    ma20 = _optional_number(point.ma20)
    rsi = _optional_number(point.rsi, 1)
    k_value = _optional_number(point.k, 1)
    d_value = _optional_number(point.d, 1)
    macd_hist = _optional_number(point.macd_hist, 3, signed=True)
    bb_upper = _optional_number(point.bb_upper)
    bb_lower = _optional_number(point.bb_lower)
    if zh:
        return [
            f"收盤 {point.close:.2f}，5 日 {pct5:+.2f}%，20 日 {pct20:+.2f}%。",
            f"量能為 20 日均量 {volume_ratio:.2f} 倍。",
            f"MA5/MA20：{ma5} / {ma20}，RSI14：{rsi}。",
            f"BB 上/下軌：{bb_upper} / {bb_lower}；KD：K={k_value} / D={d_value}；MACD Hist={macd_hist}。",
        ]
    return [
        f"Close {point.close:.2f}; 5D {pct5:+.2f}%, 20D {pct20:+.2f}%.",
        f"Volume is {volume_ratio:.2f}x the 20D average.",
        f"MA5/MA20: {ma5} / {ma20}; RSI14: {rsi}.",
        f"BB upper/lower: {bb_upper} / {bb_lower}; KD: K={k_value} / D={d_value}; MACD Hist={macd_hist}.",
    ]


def _factor_clues(
    point: MarketIndicatorPoint,
    window: list[MarketIndicatorPoint],
    ai_snapshot: AiSnapshot,
    zh: bool,
) -> tuple[list[str], list[str]]:
    pct20 = _window_pct(window, 20)
    volume_ratio = point.volume / point.volume_ma20 if point.volume_ma20 else 1
    if zh:
        bull = [
            f"20 日報酬 {pct20:+.2f}%，若趨勢仍在均線上方，短期動能可能延續。",
            f"MACD Hist {point.macd_hist:+.3f}，可檢查動能是否正在修復或擴張。",
            f"AI 面偏向{_side_label(ai_snapshot.suggested_side, True)}，但需要用技術與新聞/題材訊號交叉驗證。",
        ]
        bear = [
            f"量能 {volume_ratio:.2f} 倍於 20 日均量，放量但無延續時要檢查是否只是短線賣壓。",
            f"RSI {point.rsi:.1f}，過熱或轉弱都會影響追價風險。",
            "若 AI 論點只描述敘事、沒有連到指標，應降低 AI 面權重。",
        ]
        return bull, bear
    bull = [
        f"20D return is {pct20:+.2f}%; if price holds above moving averages, momentum may persist.",
        f"MACD Hist is {point.macd_hist:+.3f}; check whether momentum is repairing or expanding.",
        f"AI suggests {_side_label(ai_snapshot.suggested_side, False)}, but it should be cross-checked against technical and news/theme signals.",
    ]
    bear = [
        f"Volume is {volume_ratio:.2f}x the 20D average; high volume without follow-through can show weak hands.",
        f"RSI is {point.rsi:.1f}; overheating or deterioration changes chase risk.",
        "If the AI thesis is narrative-only and not tied to indicators, reduce AI weight.",
    ]
    return bull, bear


def _future_results(points: list[MarketIndicatorPoint], selected_index: int) -> list[FutureResult]:
    selected = points[selected_index]
    results: list[FutureResult] = []
    for horizon in PRACTICE_HORIZONS:
        future = points[selected_index + horizon]
        pct = round(((future.close - selected.close) / selected.close) * 100, 2)
        results.append(
            FutureResult(
                horizon_days=horizon,
                settle_date=future.date,
                settle_price=future.close,
                pct_change=pct,
                result_side=_answer_side_from_pct(pct),
            )
        )
    return results


def _public_question(case: PracticeCase, language: str) -> PracticeQuestion:
    data = case.model_dump(
        exclude={
            "title_zh",
            "scenario_zh",
            "training_goal_zh",
            "bull_points_zh",
            "bear_points_zh",
            "prompt_zh",
            "data_cutoff_note_zh",
            "answer_side",
            "outcome_pct",
            "future_results",
            "answer_explanation_zh",
            "answer_explanation_en",
        }
    )
    if language.startswith("zh"):
        data.update(
            {
                "title": case.title_zh or case.title,
                "scenario": case.scenario_zh or case.scenario,
                "training_goal": case.training_goal_zh or case.training_goal,
                "bull_points": case.bull_points_zh or case.bull_points,
                "bear_points": case.bear_points_zh or case.bear_points,
                "prompt": case.prompt_zh or case.prompt,
                "data_cutoff_note": case.data_cutoff_note_zh or case.data_cutoff_note,
            }
        )
        if case.market_window:
            data["indicator_summary"] = _indicator_summary(case.market_window[-1], case.market_window, True)
    elif case.market_window:
        data["indicator_summary"] = _indicator_summary(case.market_window[-1], case.market_window, False)
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
    raise PracticeQuestionNotFoundError(f"Unknown practice question: {question_id}")


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
            top_weaknesses=[],
        )

    high_confidence = [row for row in rows if row["confidence"] >= 4]
    low_confidence = [row for row in rows if row["confidence"] <= 2]
    ai_aligned = [row for row in rows if row["ai_agreement"] == 1]
    ai_unaligned = [row for row in rows if row["ai_agreement"] == 0]
    weighted = [(_weights_from_json(row["weights_json"]), row) for row in rows]
    tags: list[str] = []
    for row in rows:
        try:
            feedback = json.loads(row["feedback_json"])
        except json.JSONDecodeError:
            continue
        tags.extend(feedback.get("focus_tags", []))

    counter = Counter(tags)
    return PracticeStats(
        total_attempts=len(rows),
        accuracy_rate=_accuracy(rows),
        high_confidence_accuracy_rate=_accuracy(high_confidence),
        low_confidence_accuracy_rate=_accuracy(low_confidence),
        most_common_focus=counter.most_common(1)[0][0] if counter else None,
        ai_alignment_rate=_percentage(sum(1 for row in rows if row["ai_agreement"] == 1), len(rows)),
        ai_aligned_accuracy_rate=_accuracy(ai_aligned),
        ai_unaligned_accuracy_rate=_accuracy(ai_unaligned),
        high_technical_weight_accuracy_rate=_accuracy([row for weights, row in weighted if weights.technical >= 40]),
        high_fundamental_weight_accuracy_rate=_accuracy([row for weights, row in weighted if weights.fundamental >= 40]),
        high_chip_weight_accuracy_rate=_accuracy([row for weights, row in weighted if weights.chip >= 40]),
        high_ai_weight_accuracy_rate=_accuracy([row for weights, row in weighted if weights.ai >= 40]),
        top_weaknesses=[item for item, _count in counter.most_common(3)],
    )


def _attempt_from_row(row) -> PracticeAttemptRecord:
    try:
        case = _case_by_id(row["question_id"])
        ticker = case.ticker
        future_results = case.future_results
    except PracticeQuestionNotFoundError:
        ticker = _legacy_ticker_from_question_id(row["question_id"])
        future_results = []
    weights = _weights_from_json(row["weights_json"])
    ai_agreement = None if row["ai_agreement"] is None else bool(row["ai_agreement"])
    return PracticeAttemptRecord(
        id=row["id"],
        question_id=row["question_id"],
        ticker=ticker,
        selected_side=row["selected_side"],
        confidence=row["confidence"],
        rationale=row["rationale"],
        weights=weights,
        answer_side=row["answer_side"],
        outcome_pct=row["outcome_pct"],
        result=row["result"],
        feedback=_feedback_from_json(row["feedback_json"]),
        ai_side=row["ai_side"],
        ai_agreement=ai_agreement,
        future_results=future_results,
        created_at=row["created_at"],
    )


def _build_demo_bank() -> list[PracticeCase]:
    points = _indicator_points(_fallback_history_rows())
    return [
        _case_from_points("NVDA", points, 84, 7, "Local demo case with historical-style OHLCV.", "en", False).model_copy(
            update={"id": "nvda-historical-ai-snapshot"}
        ),
        _case_from_points("AAPL", points, 92, 30, "Local demo case with historical-style OHLCV.", "en", False).model_copy(
            update={"id": "aapl-historical-quality-snapshot"}
        ),
        _case_from_points("BTC-USD", points, 76, 1, "Local demo case with historical-style OHLCV.", "en", False).model_copy(
            update={"id": "btc-historical-momentum-snapshot"}
        ),
        _case_from_points("TSLA", points, 100, 7, "Local demo case with historical-style OHLCV.", "en", False).model_copy(
            update={"id": "tsla-historical-volatility-snapshot"}
        ),
        _case_from_points("MSFT", points, 108, 30, "Local demo case with historical-style OHLCV.", "en", False).model_copy(
            update={"id": "msft-historical-quality-snapshot"}
        ),
    ]


def _ema(values: list[float], span: int) -> list[float]:
    if not values:
        return []
    alpha = 2 / (span + 1)
    result = [values[0]]
    for value in values[1:]:
        result.append((value * alpha) + (result[-1] * (1 - alpha)))
    return result


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


def _rsi_values(closes: list[float], period: int) -> list[float]:
    values: list[float] = []
    gains: list[float] = []
    losses: list[float] = []
    for index, close in enumerate(closes):
        if index == 0:
            values.append(50.0)
            continue
        change = close - closes[index - 1]
        gains.append(max(change, 0))
        losses.append(abs(min(change, 0)))
        gain_window = gains[max(0, len(gains) - period) :]
        loss_window = losses[max(0, len(losses) - period) :]
        avg_gain = sum(gain_window) / len(gain_window) if gain_window else 0
        avg_loss = sum(loss_window) / len(loss_window) if loss_window else 0
        if avg_loss == 0:
            values.append(100.0 if avg_gain > 0 else 50.0)
        else:
            rs = avg_gain / avg_loss
            values.append(100 - (100 / (1 + rs)))
    return values


def _volatility_values(closes: list[float], period: int) -> list[float]:
    returns = [0.0]
    for index in range(1, len(closes)):
        returns.append((closes[index] - closes[index - 1]) / closes[index - 1])
    values: list[float] = []
    for index in range(len(closes)):
        window = returns[max(0, index - period + 1) : index + 1]
        mean = sum(window) / len(window)
        variance = sum((item - mean) ** 2 for item in window) / len(window)
        values.append(math.sqrt(variance))
    return values


def _stddev(values: list[float]) -> float:
    if not values:
        return 0.0
    mean = sum(values) / len(values)
    variance = sum((value - mean) ** 2 for value in values) / len(values)
    return math.sqrt(variance)


def _window_pct(window: list[MarketIndicatorPoint], days: int) -> float:
    if len(window) <= days:
        return 0.0
    start = window[-days - 1].close
    end = window[-1].close
    return round(((end - start) / start) * 100, 2)


def _obv_trend(window: list[MarketIndicatorPoint], days: int) -> float:
    if len(window) <= days:
        return 0.0
    obv = 0
    values = [0]
    for index in range(1, len(window)):
        if window[index].close > window[index - 1].close:
            obv += window[index].volume
        elif window[index].close < window[index - 1].close:
            obv -= window[index].volume
        values.append(obv)
    start = values[-days - 1]
    end = values[-1]
    denominator = abs(start) or max(abs(end), 1)
    return round(((end - start) / denominator) * 100, 2)


def _answer_side_from_pct(pct_change: float) -> VerdictSide:
    if pct_change > 1:
        return "bull"
    if pct_change < -1:
        return "bear"
    return "neutral"


def _pct_tone(value: float) -> MetricTone:
    if value > 1:
        return "bull"
    if value < -1:
        return "bear"
    return "neutral"


def _bollinger_position(point: MarketIndicatorPoint) -> str:
    if point.bb_upper is None or point.bb_lower is None:
        return "N/A"
    if point.close > point.bb_upper:
        return "Above upper"
    if point.close < point.bb_lower:
        return "Below lower"
    midpoint = ((point.close - point.bb_lower) / max(point.bb_upper - point.bb_lower, 0.0001)) * 100
    return f"{midpoint:.0f}% band"


def _bollinger_tone(point: MarketIndicatorPoint) -> MetricTone:
    if point.bb_upper is None or point.bb_lower is None:
        return "neutral"
    if point.close > point.bb_upper:
        return "warn"
    if point.close < point.bb_lower:
        return "bear"
    midpoint = ((point.close - point.bb_lower) / max(point.bb_upper - point.bb_lower, 0.0001)) * 100
    if midpoint > 80:
        return "warn"
    if midpoint < 20:
        return "bear"
    return "neutral"


def _currency_for_ticker(ticker: str) -> str:
    if ticker.endswith(".TW"):
        return "TWD"
    return "USD"


def _compact_number(value: float) -> str:
    for suffix, divisor in [("T", 1_000_000_000_000), ("B", 1_000_000_000), ("M", 1_000_000)]:
        if abs(value) >= divisor:
            return f"{value / divisor:.2f}{suffix}"
    return f"{value:.0f}"


def _short_text(value: Any, max_length: int = 100) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    if len(text) <= max_length:
        return text
    return f"{text[: max_length - 1].rstrip()}..."


def _news_title(item: Any) -> str:
    if not isinstance(item, dict):
        return ""
    content = item.get("content") if isinstance(item.get("content"), dict) else {}
    return str(item.get("title") or content.get("title") or "").strip()


def _news_publisher(item: Any) -> str:
    if not isinstance(item, dict):
        return ""
    content = item.get("content") if isinstance(item.get("content"), dict) else {}
    provider = content.get("provider") if isinstance(content.get("provider"), dict) else {}
    publisher = item.get("publisher") or item.get("provider") or provider.get("displayName") or provider.get("name")
    published = item.get("providerPublishTime") or content.get("pubDate") or content.get("displayTime")
    parts = [str(publisher).strip()] if publisher else []
    if published:
        parts.append(str(published).strip())
    return " · ".join(parts)


def _parse_iso_date(value: Any) -> date | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value)[:10]).date()
    except ValueError:
        return None


def _news_date(item: Any) -> date | None:
    if not isinstance(item, dict):
        return None
    content = item.get("content") if isinstance(item.get("content"), dict) else {}
    candidates = [
        item.get("providerPublishTime"),
        item.get("publishTime"),
        content.get("providerPublishTime"),
        content.get("pubDate"),
        content.get("displayTime"),
    ]
    for candidate in candidates:
        if candidate in (None, ""):
            continue
        if isinstance(candidate, (int, float)):
            timestamp = candidate / 1000 if candidate > 10_000_000_000 else candidate
            try:
                return datetime.fromtimestamp(timestamp, tz=timezone.utc).date()
            except (OSError, OverflowError, ValueError):
                continue
        text = str(candidate).strip()
        try:
            return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
        except ValueError:
            parsed = _parse_iso_date(text)
            if parsed:
                return parsed
    return None


def _financial_column_date(value: Any) -> date | None:
    if hasattr(value, "date"):
        try:
            return value.date()
        except TypeError:
            pass
    return _parse_iso_date(value)


def _financial_value(financials: Any, column: Any, row_names: list[str]) -> float | None:
    if column is None:
        return None
    try:
        index_values = list(getattr(financials, "index", []))
    except TypeError:
        index_values = []
    normalized_rows = {_normalize_financial_label(label): label for label in index_values}
    for row_name in row_names:
        row_label = row_name if row_name in index_values else normalized_rows.get(_normalize_financial_label(row_name))
        if row_label is None:
            continue
        try:
            value = financials.loc[row_label, column]
        except Exception:
            continue
        if hasattr(value, "iloc"):
            try:
                value = value.iloc[0]
            except Exception:
                return None
        parsed = _to_float(value)
        if parsed is not None:
            return parsed
    return None


def _normalize_financial_label(value: Any) -> str:
    return re.sub(r"[^a-z0-9]", "", str(value).lower())


def _to_float(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(number) or math.isinf(number):
        return None
    return number


def _optional_number(value: float | None, digits: int = 2, signed: bool = False) -> str:
    if value is None:
        return "N/A"
    sign = "+" if signed else ""
    return f"{value:{sign}.{digits}f}"


def _weight_total(weights: JudgmentWeights) -> int:
    return weights.technical + weights.fundamental + weights.chip + weights.ai


def _weights_from_json(raw: str | None) -> JudgmentWeights:
    if not raw:
        return JudgmentWeights()
    try:
        return JudgmentWeights.model_validate_json(raw)
    except Exception:
        return JudgmentWeights()


def _feedback_from_json(raw: str | None) -> PracticeFeedback:
    if raw:
        try:
            return PracticeFeedback.model_validate_json(raw)
        except Exception:
            pass
    return PracticeFeedback(
        summary="Legacy practice attempt loaded without full coach feedback.",
        probable_causes=["This attempt was created before the current practice schema."],
        improvement_steps=["Replay a new historical drill to receive full dimension-based feedback."],
        focus_tags=["legacy"],
    )


def _legacy_ticker_from_question_id(question_id: str) -> str:
    match = re.match(r"([A-Za-z0-9.]+)", question_id or "")
    return match.group(1).upper() if match else "LEGACY"


def _accuracy(rows) -> float | None:
    if not rows:
        return None
    correct = sum(1 for row in rows if row["result"] == "correct")
    return _percentage(correct, len(rows))


def _percentage(numerator: int, denominator: int) -> float | None:
    if denominator == 0:
        return None
    return round((numerator / denominator) * 100, 1)


def _side_label(side: VerdictSide, zh: bool) -> str:
    if zh:
        return {"bull": "看多", "bear": "看空", "neutral": "中立"}[side]
    return {"bull": "bull", "bear": "bear", "neutral": "neutral"}[side]


def _dimension_label(dimension: str, zh: bool) -> str:
    zh_labels = {"technical": "技術面", "fundamental": "基本面", "chip": "價量觀察", "ai": "AI 面"}
    en_labels = {"technical": "Technical", "fundamental": "Fundamental", "chip": "Price-volume read", "ai": "AI"}
    return (zh_labels if zh else en_labels).get(dimension, dimension)


def _rationale_signal_labels(normalized: str) -> list[str]:
    signals: list[tuple[str, list[str]]] = [
        ("MA/均線", ["ma", "均線"]),
        ("MA10", ["ma10", "10 日", "10日"]),
        ("Bollinger/布林", ["boll", "bb", "布林"]),
        ("RSI", ["rsi"]),
        ("KD", ["kd", " k ", " d "]),
        ("MACD", ["macd", "dif", "signal"]),
        ("成交量", ["volume", "量能", "成交量", "放量"]),
        ("估值", ["pe", "valuation", "估值", "本益比"]),
        ("營收/成長", ["revenue", "growth", "margin", "營收", "成長", "毛利", "利潤"]),
        ("新聞/題材", ["news", "theme", "headline", "新聞", "題材", "消息"]),
        ("AI", ["ai", "模型", "人工智慧", "thesis", "敘事", "narrative"]),
    ]
    result: list[str] = []
    padded = f" {normalized} "
    for label, tokens in signals:
        if any(token in padded for token in tokens):
            result.append(label)
    return _dedupe(result)


def _mentions_any(normalized: str, tokens: list[str]) -> bool:
    padded = f" {normalized} "
    return any(token in padded for token in tokens)


def _rationale_excerpt(rationale: str, max_length: int = 64) -> str:
    text = re.sub(r"\s+", " ", rationale.strip())
    if len(text) <= max_length:
        return text
    return f"{text[: max_length - 1].rstrip()}..."


def _feedback_diagnosis(
    case: PracticeCase,
    selected_side: VerdictSide,
    confidence: int,
    weights: JudgmentWeights,
    signal_labels: list[str],
    result: bool,
    zh: bool,
) -> str:
    weights_map = weights.model_dump()
    top_dimension = max(weights_map, key=weights_map.get)
    signal_text = "、".join(signal_labels) if zh else ", ".join(signal_labels)
    if not signal_text:
        signal_text = _text(zh, "未偵測到明確訊號", "no explicit signal detected")
    ai_side = case.ai_snapshot.suggested_side if case.ai_snapshot else None
    ai_relation = ""
    if ai_side:
        ai_relation = _text(
            zh,
            f"你和 AI {'同邊' if selected_side == ai_side else '不同邊'}。",
            f"You {'matched' if selected_side == ai_side else 'differed from'} AI.",
        )
    outcome_text = _text(zh, "答對" if result else "待加強", "correct" if result else "needs work")
    if zh:
        return (
            f"本次你選{_side_label(selected_side, True)}、信心 {confidence}/5，最高權重是"
            f"{_dimension_label(top_dimension, True)} {weights_map[top_dimension]}%。理由偵測到：{signal_text}。"
            f"{ai_relation} 這題結果為{outcome_text}，請回看你高權重面向是否真的有被理由支撐。"
        )
    return (
        f"You chose {_side_label(selected_side, False)} with {confidence}/5 confidence. Your highest weight was "
        f"{_dimension_label(top_dimension, False)} at {weights_map[top_dimension]}%. Detected signals: {signal_text}. "
        f"{ai_relation} Result: {outcome_text}. Check whether the high-weight dimension was actually supported by your rationale."
    )


def _personalized_framework(weights: JudgmentWeights, signal_labels: list[str], zh: bool) -> str:
    weights_map = weights.model_dump()
    top_dimension = max(weights_map, key=weights_map.get)
    missing_news = "新聞/題材" not in signal_labels
    missing_ai = "AI" not in signal_labels
    if zh:
        parts = [
            f"先用{_dimension_label(top_dimension, True)}建立主假說",
            "再用圖表 tooltip 的具體數字驗證",
        ]
        if missing_news:
            parts.append("補一條基本/新聞題材是否支持此假說")
        if missing_ai:
            parts.append("最後寫出 AI 論點哪裡可採、哪裡可能錯")
        return "，".join(parts) + "。"
    parts = [
        f"Start with {_dimension_label(top_dimension, False)} as the main thesis",
        "validate it with a concrete chart-tooltip number",
    ]
    if missing_news:
        parts.append("add one fundamental/news theme that supports or rejects it")
    if missing_ai:
        parts.append("then state which part of the AI thesis is useful and how it could be wrong")
    return ", ".join(parts) + "."


def _feedback_summary(case: PracticeCase, selected_side: VerdictSide, result: bool, confidence: int, zh: bool) -> str:
    answer = _side_label(case.answer_side, zh)
    selected = _side_label(selected_side, zh)
    explanation = case.answer_explanation_zh if zh else case.answer_explanation_en
    if zh:
        verdict = "答對" if result else "待加強"
        return f"你選擇{selected}，信心 {confidence}/5。參考答案是{answer}，目標週期報酬 {case.outcome_pct:+.1f}%。結果：{verdict}。{explanation}"
    verdict = "correct" if result else "needs work"
    return f"You chose {selected} with {confidence}/5 confidence. The answer is {answer}, outcome {case.outcome_pct:+.1f}%. Result: {verdict}. {explanation}"


def _wrong_side_cause(answer_side: VerdictSide, selected_side: VerdictSide, zh: bool) -> str:
    if answer_side == "neutral":
        return _text(zh, "這題真正的訓練點是沒有明確優勢；強行選邊可能代表你把混合訊號二分化。", "The lesson was no clear edge; forcing a side can turn mixed signals into a binary call.")
    if selected_side == "neutral":
        return _text(zh, "你選擇中立，但題目有較主導的訊號；可能是等待過高確定性。", "You chose neutral, but the case had a dominant signal; you may be waiting for too much certainty.")
    if answer_side == "bull":
        return _text(zh, "你可能高估風險敘事，低估了短期可驗證的正向催化。", "You may have overweighted risk narrative and underweighted the near-term checkable catalyst.")
    return _text(zh, "你可能被正面標題吸引，低估了更直接的負面訊號。", "You may have been pulled by a positive headline and underweighted the more direct negative signal.")


def _wrong_side_step(answer_side: VerdictSide, zh: bool) -> str:
    if answer_side == "neutral":
        return _text(zh, "當多空都合理時，先找目標週期內是否有明確催化；沒有就允許自己選中立。", "When both sides are credible, look for a clear catalyst inside the horizon; if none exists, allow neutral.")
    return _text(zh, "把線索按具體度排序，再讓最具體的兩個線索決定方向。", "Rank clues by specificity, then let the two most specific clues drive side selection.")


def _missed_signals(case: PracticeCase, zh: bool) -> list[str]:
    signals = []
    if case.ai_snapshot:
        signals.append(_text(zh, f"AI 面建議為{_side_label(case.ai_snapshot.suggested_side, True)}，但仍需和硬資料交叉驗證。", f"AI suggested {_side_label(case.ai_snapshot.suggested_side, False)}, but it still needed validation against hard data."))
    if case.technical_snapshot:
        signals.append(_text(zh, f"技術面重點：{case.technical_snapshot[0].label} {case.technical_snapshot[0].value}。", f"Technical focus: {case.technical_snapshot[0].label} {case.technical_snapshot[0].value}."))
    if case.news_snapshot:
        signals.append(_text(zh, f"新聞/題材重點：{case.news_snapshot[0].label} {case.news_snapshot[0].value}。", f"News/theme focus: {case.news_snapshot[0].label} {case.news_snapshot[0].value}."))
    return signals


def _next_drill_focus(tags: list[str], zh: bool) -> str:
    if "AI reliance" in tags:
        return _text(zh, "下一題刻意降低 AI 權重，先獨立寫出技術與新聞/題材判斷。", "Next drill: lower AI weight and write technical plus news/theme judgments first.")
    if "calibration" in tags:
        return _text(zh, "下一題專注練習信心校準，高信心只給證據密度高的題目。", "Next drill: confidence calibration; reserve high confidence for dense evidence.")
    if "counterargument" in tags:
        return _text(zh, "下一題先寫反方最佳論點，再提交答案。", "Next drill: write the best opposing case before submitting.")
    return _text(zh, "下一題練習三面向權重分配，並補一條新聞/題材反證。", "Next drill: practice three-dimension weighting and add one news/theme counterpoint.")


def _ai_bull_thesis(ticker: str, point: MarketIndicatorPoint, pct20: float, volume_ratio: float) -> str:
    return (
        f"{ticker} can work on the long side if the {pct20:+.2f}% 20D trend holds above MA20 and "
        f"volume at {volume_ratio:.2f}x confirms follow-through."
    )


def _ai_bear_thesis(ticker: str, point: MarketIndicatorPoint, pct20: float, volume_ratio: float) -> str:
    return (
        f"{ticker} can fail if the visible move is already priced in, MACD momentum fades, or "
        f"{volume_ratio:.2f}x volume reflects distribution rather than accumulation."
    )


def _ticker_narrative(ticker: str, side: VerdictSide) -> str:
    themes = {
        "NVDA": "AI infrastructure expectations can amplify both upside revisions and valuation anxiety.",
        "AAPL": "Quality and cash returns matter, but demand-cycle disappointment can dominate short horizons.",
        "TSLA": "Narratives shift quickly between growth optionality, margin pressure, and execution risk.",
        "MSFT": "Durable software cash flow can support dips, while AI capex expectations affect sentiment.",
        "BTC-USD": "Crypto psychology often turns on liquidity, ETF flow narratives, and crowded positioning.",
        "2330.TW": "AI semiconductor demand can offset macro caution, but currency and geopolitical risk remain visible.",
    }
    base = themes.get(ticker, "Investor psychology can shift faster than slowly moving fundamentals.")
    return f"{base} Current AI side: {_side_label(side, False)}."


def _text(zh: bool, zh_text: str, en_text: str) -> str:
    return zh_text if zh else en_text


def _dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        if item and item not in seen:
            seen.add(item)
            result.append(item)
    return result


PRACTICE_BANK = _build_demo_bank()
