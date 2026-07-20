from __future__ import annotations

import json
import re
from collections import Counter
from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field

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


def get_practice_dashboard(language: str = "zh-Hant") -> PracticeDashboardResponse:
    init_db()
    recent_attempts = _recent_attempts()
    return PracticeDashboardResponse(
        questions=[_public_question(case, language) for case in PRACTICE_BANK],
        stats=_practice_stats(),
        recent_attempts=recent_attempts,
    )


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
    return PracticeQuestion(**data)


def _case_by_id(question_id: str) -> PracticeCase:
    for case in PRACTICE_BANK:
        if case.id == question_id:
            return case
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
