import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";

const tickerSnapshot = {
  ticker: "NVDA",
  name: "NVIDIA Corporation",
  price: 123.45,
  currency: "USD",
  history: [
    { date: "2026-06-01", close: 120 },
    { date: "2026-06-02", close: 121.5 },
    { date: "2026-06-03", close: 123.45 },
  ],
};

const tsmcSnapshot = {
  ticker: "2330.TW",
  name: "Taiwan Semiconductor Manufacturing Company",
  price: 980,
  currency: "TWD",
  history: [
    { date: "2026-06-01", close: 960 },
    { date: "2026-06-02", close: 970 },
    { date: "2026-06-03", close: 980 },
  ],
};

const evidencePack = [
  {
    evidence_id: "T1",
    category: "technical",
    title: "MA5 / MA20",
    value: "121.00 / 119.00",
    detail: "Trend proxy.",
    tone: "bull",
    source_name: "Yahoo Finance / yfinance",
    source_url: "https://finance.yahoo.com/quote/NVDA/",
  },
  {
    evidence_id: "A1",
    category: "ai",
    title: "AI suggested side",
    value: "Bullish",
    detail: "Confidence 4/5.",
    tone: "bull",
    source_name: "deterministic_ai_coach",
    source_url: "https://finance.yahoo.com/quote/NVDA/",
  },
];

const aiDebate = {
  bull: {
    side: "bull",
    claims: [
      {
        claim_id: "BULL-1",
        claim: "Bull evidence points to continuation.",
        evidence: "Evidence cited: T1 MA5 / MA20: 121.00 / 119.00",
        evidence_refs: ["T1", "A1"],
        source_url: "https://finance.yahoo.com/quote/NVDA/",
        source_name: "Yahoo Finance / yfinance",
      },
      {
        claim_id: "BULL-2",
        claim: "AI thesis supports the long side.",
        evidence: "Evidence cited: A1 AI suggested side: Bullish",
        evidence_refs: ["A1"],
        source_url: "https://finance.yahoo.com/quote/NVDA/",
        source_name: "deterministic_ai_coach",
      },
      {
        claim_id: "BULL-3",
        claim: "Momentum can still hold.",
        evidence: "Evidence cited: T1 MA5 / MA20: 121.00 / 119.00",
        evidence_refs: ["T1"],
        source_url: "https://finance.yahoo.com/quote/NVDA/",
        source_name: "Yahoo Finance / yfinance",
      },
    ],
  },
  bear: {
    side: "bear",
    claims: [
      {
        claim_id: "BEAR-1",
        claim: "Valuation risk can offset momentum.",
        evidence: "Evidence cited: A1 AI suggested side: Bullish",
        evidence_refs: ["A1"],
        source_url: "https://finance.yahoo.com/quote/NVDA/",
        source_name: "Yahoo Finance / yfinance",
      },
      {
        claim_id: "BEAR-2",
        claim: "Crowded positioning can reverse.",
        evidence: "Evidence cited: T1 MA5 / MA20: 121.00 / 119.00",
        evidence_refs: ["T1"],
        source_url: "https://finance.yahoo.com/quote/NVDA/",
        source_name: "Yahoo Finance / yfinance",
      },
      {
        claim_id: "BEAR-3",
        claim: "AI may overfit visible price action.",
        evidence: "Evidence cited: A1 AI suggested side: Bullish",
        evidence_refs: ["A1"],
        source_url: "https://finance.yahoo.com/quote/NVDA/",
        source_name: "deterministic_ai_coach",
      },
    ],
  },
  bull_rebuttals: {
    side: "bull",
    rebuttals: [
      {
        target_claim_id: "BEAR-1",
        rebuttal: "Bull rebuttal cites T1.",
        evidence: "Evidence cited: T1 MA5 / MA20: 121.00 / 119.00",
        evidence_refs: ["T1"],
        source_url: "https://finance.yahoo.com/quote/NVDA/",
      },
      {
        target_claim_id: "BEAR-2",
        rebuttal: "Bull rebuttal cites A1.",
        evidence: "Evidence cited: A1 AI suggested side: Bullish",
        evidence_refs: ["A1"],
        source_url: "https://finance.yahoo.com/quote/NVDA/",
      },
    ],
  },
  bear_rebuttals: {
    side: "bear",
    rebuttals: [
      {
        target_claim_id: "BULL-1",
        rebuttal: "Bear rebuttal cites A1.",
        evidence: "Evidence cited: A1 AI suggested side: Bullish",
        evidence_refs: ["A1"],
        source_url: "https://finance.yahoo.com/quote/NVDA/",
      },
      {
        target_claim_id: "BULL-2",
        rebuttal: "Bear rebuttal cites T1.",
        evidence: "Evidence cited: T1 MA5 / MA20: 121.00 / 119.00",
        evidence_refs: ["T1"],
        source_url: "https://finance.yahoo.com/quote/NVDA/",
      },
    ],
  },
  judge: {
    bull_total: 55,
    bear_total: 48,
    summary: "AI debate only cites this evidence pack.",
    scores: [],
  },
  source: "evidence_pack_ai_debate",
};

const practiceQuestion = {
  id: "nvda-historical-ai-snapshot",
  ticker: "NVDA",
  title: "Historical snapshot: NVDA on 2026-06-02",
  as_of: "2026-06-02",
  price: 123.45,
  currency: "USD",
  horizon_days: 7,
  scenario: "You are back on 2026-06-02. Only information available through this date is visible.",
  training_goal: "Practice integrating technical, fundamental, news/theme, and AI analysis without future leakage.",
  bull_points: ["20D return is positive.", "AI suggests bull, but needs validation."],
  bear_points: ["Volume can warn of reversal.", "Narrative-only AI should be discounted."],
  prompt: "What is your 7D directional judgment from this historical snapshot?",
  focus_tags: ["historical backtest", "AI usage"],
  indicator_summary: [
    "Close 123.45; 5D +2.00%, 20D +5.00%.",
    "Volume is 1.20x the 20D average.",
  ],
  market_window: [
    {
      date: "2026-06-01",
      open: 120,
      high: 122,
      low: 119,
      close: 121,
      volume: 1000000,
      volume_ma5: 950000,
      volume_ma20: 900000,
      ma5: 120,
      ma10: 119,
      ma20: 118,
      bb_middle: 118,
      bb_upper: 124,
      bb_lower: 112,
      rsi: 55,
      k: 55,
      d: 50,
      macd: 0.5,
      macd_signal: 0.2,
      macd_hist: 0.3,
      volatility20: 0.02,
    },
    {
      date: "2026-06-02",
      open: 121,
      high: 124,
      low: 120,
      close: 123.45,
      volume: 1200000,
      volume_ma5: 1000000,
      volume_ma20: 1000000,
      ma5: 121,
      ma10: 120,
      ma20: 119,
      bb_middle: 119,
      bb_upper: 125,
      bb_lower: 113,
      rsi: 65,
      k: 65,
      d: 58,
      macd: 1.2,
      macd_signal: 0.8,
      macd_hist: 0.4,
      volatility20: 0.025,
    },
  ],
  technical_snapshot: [
    { label: "MA5 / MA20", value: "121.00 / 119.00", detail: "Trend proxy.", tone: "bull" },
    { label: "Bollinger", value: "87% band", detail: "Close location relative to 20D bands.", tone: "warn" },
  ],
  fundamental_snapshot: [
    { label: "Revenue growth", value: "+10.0%", detail: "Latest proxy.", tone: "bull" },
  ],
  news_snapshot: [
    {
      label: "Business lane",
      value: "Semiconductors / AI infrastructure",
      detail: "Latest profile.",
      tone: "neutral",
      source_name: "Yahoo Finance / yfinance",
      source_url: "https://finance.yahoo.com/quote/NVDA/",
    },
    {
      label: "As-of news",
      value: "AI demand remains a key theme",
      detail: "Demo News · 2026-06-02",
      tone: "neutral",
      source_name: "Demo News",
      source_url: "https://example.com/news/nvda-ai-demand",
      published_at: "2026-06-02",
      summary: "AI accelerator demand remains the main market theme around the company.",
    },
  ],
  chip_snapshot: [
    { label: "Volume / 20D avg", value: "1.20x", detail: "Price-volume read.", tone: "neutral" },
  ],
  ai_snapshot: {
    suggested_side: "bull",
    confidence: 4,
    bull_thesis: "Momentum and AI narrative align.",
    bear_thesis: "Valuation and crowded positioning can hurt.",
    narrative: "AI infrastructure expectations affect psychology.",
    hard_to_quantify_factors: ["Market psychology"],
    key_uncertainty: "AI may overfit visible price action.",
    checklist: ["Does the AI thesis cite a concrete signal?"],
    source: "deterministic_ai_coach",
  },
  evidence_pack: evidencePack,
  ai_debate: aiDebate,
  data_cutoff_note: "Visible market data ends at 2026-06-02.",
};

const practiceAttemptRecord = {
  id: 7,
  question_id: "nvda-historical-ai-snapshot",
  ticker: "NVDA",
  selected_side: "bull",
  confidence: 4,
  rationale: "MA10, MACD, and AI thesis all pointed to follow-through.",
  weights: { technical: 45, fundamental: 25, chip: 0, ai: 30 },
  answer_side: "bull",
  outcome_pct: 8.4,
  result: "correct",
  ai_side: "bull",
  ai_agreement: true,
  future_results: [],
  review_note: "Need to keep checking counter-risk.",
  created_at: "2026-07-20T00:00:00+00:00",
  feedback: {
    summary: "A correct result still needs evidence quality.",
    probable_causes: ["Direction was right, but keep checking counter-risk."],
    improvement_steps: ["State one disconfirming signal next time."],
    focus_tags: ["evidence"],
    diagnosis: "Good evidence density.",
    missed_signals: [],
    good_reasoning: ["You cited concrete indicators."],
    next_drill_focus: "Counter-risk discipline.",
    suggested_framework: "Start with the strongest measurable signal.",
  },
};

const liveAnalysis = {
  ticker: "NVDA",
  name: "NVIDIA Corporation",
  as_of: "2026-06-02",
  price: 123.45,
  currency: "USD",
  market_window: practiceQuestion.market_window,
  technical_snapshot: practiceQuestion.technical_snapshot,
  fundamental_snapshot: practiceQuestion.fundamental_snapshot,
  news_snapshot: practiceQuestion.news_snapshot,
  chip_snapshot: practiceQuestion.chip_snapshot,
  ai_snapshot: practiceQuestion.ai_snapshot,
  evidence_pack: evidencePack,
  ai_debate: aiDebate,
  bull_points: practiceQuestion.bull_points,
  bear_points: practiceQuestion.bear_points,
  data_note: "即時分析使用最新可取得的 yfinance 資料。",
  source_summary: "市場資料來自 Yahoo Finance/yfinance；新聞/題材保留原始新聞連結，AI 面根據可見證據產生。",
};

const portfolioResponse = {
  stats: {
    total_decisions: 1,
    bull_count: 0,
    bear_count: 1,
    neutral_count: 0,
    open_count: 1,
    closed_count: 0,
    average_pct_change: 5.3,
    ai_agreement_rate: 0,
  },
  decisions: [
    {
      id: 4,
      ticker: "NVDA",
      side: "bear",
      confidence: 4,
      rationale: "Valuation risk outweighed momentum.",
      price_at_decision: 123.45,
      current_price: 130,
      pct_change: 5.3,
      currency: "USD",
      created_at: "2026-07-20T00:00:00+00:00",
      ai_side: "bull",
      ai_agreement: false,
      data_note: "Live analysis uses latest available yfinance data.",
      status: "open",
      exit_price: null,
      exit_at: null,
      review_note: "Watch if thesis breaks.",
    },
  ],
};

const judgedDebate = {
  ticker: "NVDA",
  language: "zh-Hant",
  generated_at: "2026-07-18T00:00:00+00:00",
  price_at_debate: 123.45,
  currency: "USD",
  bull: {
    side: "bull",
    claims: [
      {
        claim_id: "BULL-1",
        claim: "Bull claim 1",
        evidence: "Bull evidence 1",
        source_url: "https://example.com/bull",
        source_name: "Bull Source",
      },
      {
        claim_id: "BULL-2",
        claim: "Bull claim 2",
        evidence: "Bull evidence 2",
        source_url: "https://example.com/bull",
        source_name: "Bull Source",
      },
      {
        claim_id: "BULL-3",
        claim: "Bull claim 3",
        evidence: "Bull evidence 3",
        source_url: "https://example.com/bull",
        source_name: "Bull Source",
      },
    ],
  },
  bear: {
    side: "bear",
    claims: [
      {
        claim_id: "BEAR-1",
        claim: "Bear claim 1",
        evidence: "Bear evidence 1",
        source_url: "https://example.com/bear",
        source_name: "Bear Source",
      },
      {
        claim_id: "BEAR-2",
        claim: "Bear claim 2",
        evidence: "Bear evidence 2",
        source_url: "https://example.com/bear",
        source_name: "Bear Source",
      },
      {
        claim_id: "BEAR-3",
        claim: "Bear claim 3",
        evidence: "Bear evidence 3",
        source_url: "https://example.com/bear",
        source_name: "Bear Source",
      },
    ],
  },
  bull_rebuttals: {
    side: "bull",
    rebuttals: [
      {
        target_claim_id: "BEAR-1",
        rebuttal: "Bull rebuttal 1",
        evidence: "Bull rebuttal evidence 1",
        source_url: "https://example.com/bull/rebuttal-1",
      },
      {
        target_claim_id: "BEAR-2",
        rebuttal: "Bull rebuttal 2",
        evidence: "Bull rebuttal evidence 2",
        source_url: "https://example.com/bull/rebuttal-2",
      },
    ],
  },
  bear_rebuttals: {
    side: "bear",
    rebuttals: [
      {
        target_claim_id: "BULL-1",
        rebuttal: "Bear rebuttal 1",
        evidence: "Bear rebuttal evidence 1",
        source_url: "https://example.com/bear/rebuttal-1",
      },
      {
        target_claim_id: "BULL-2",
        rebuttal: "Bear rebuttal 2",
        evidence: "Bear rebuttal evidence 2",
        source_url: "https://example.com/bear/rebuttal-2",
      },
    ],
  },
  judge: {
    bull_total: 60,
    bear_total: 55,
    summary: "Both sides cite evidence.",
    scores: [
      {
        item_id: "BULL-1",
        side: "bull",
        item_type: "claim",
        evidence_score: 4,
        source_score: 3,
        logic_score: 5,
        flag: "none",
        flag_reason: "",
      },
      {
        item_id: "BEAR-1",
        side: "bear",
        item_type: "claim",
        evidence_score: 4,
        source_score: 3,
        logic_score: 5,
        flag: "unverifiable",
        flag_reason: "Cannot verify the source.",
      },
    ],
  },
};

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = vi.fn((url, options = {}) => {
      if (url === "/api/health") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ status: "ok" }) });
      }

      if (url.startsWith("/api/tickers/search")) {
        return Promise.resolve({
          ok: true,
          text: () =>
            Promise.resolve(
              JSON.stringify([
                {
                  ticker: "2330.TW",
                  name: "Taiwan Semiconductor Manufacturing Company",
                  exchange: "TWSE",
                  asset_type: "equity",
                  currency: "TWD",
                },
                {
                  ticker: "NVDA",
                  name: "NVIDIA Corporation",
                  exchange: "NASDAQ",
                  asset_type: "equity",
                  currency: "USD",
                },
              ]),
            ),
        });
      }

      if (url === "/api/tickers/NVDA") {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(JSON.stringify(tickerSnapshot)) });
      }

      if (url === "/api/tickers/2330.TW") {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(JSON.stringify(tsmcSnapshot)) });
      }

      if (url.startsWith("/api/live-analysis/NVDA")) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(JSON.stringify(liveAnalysis)) });
      }

      if (url.startsWith("/api/live-analysis/2330.TW")) {
        return Promise.resolve({
          ok: true,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                ...liveAnalysis,
                ticker: "2330.TW",
                name: "Taiwan Semiconductor Manufacturing Company",
                price: 980,
                currency: "TWD",
              }),
            ),
        });
      }

      if (url === "/api/settings/openai" && options.method === "POST") {
        const body = JSON.parse(options.body);
        return Promise.resolve({
          ok: true,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                api_key_configured: true,
                api_key_preview: "sk-proj...abcd",
                default_key_configured: true,
                user_key_configured: Boolean(body.api_key),
                key_source: body.key_source,
                debate_mode: body.debate_mode,
                model: body.model,
                available_models: ["gpt-5.6-luna", "gpt-5.6-sol"],
                key_sources: ["default", "user"],
                debate_modes: ["api", "demo"],
              }),
            ),
        });
      }

      if (url === "/api/settings/openai") {
        return Promise.resolve({
          ok: true,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                api_key_configured: false,
                api_key_preview: "",
                default_key_configured: true,
                user_key_configured: false,
                key_source: "default",
                debate_mode: "api",
                model: "gpt-5.6-luna",
                available_models: ["gpt-5.6-luna", "gpt-5.6-sol"],
                key_sources: ["default", "user"],
                debate_modes: ["api", "demo"],
              }),
            ),
        });
      }

      if (url === "/api/practice/attempts") {
        const body = JSON.parse(options.body);
        return Promise.resolve({
          ok: true,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                id: 1,
                question_id: "nvda-historical-ai-snapshot",
                ticker: "NVDA",
                selected_side: body.side,
                confidence: body.confidence,
                rationale: body.rationale,
                weights: body.weights,
                answer_side: "bull",
                outcome_pct: 8.4,
                result: body.side === "bull" ? "correct" : "wrong",
                ai_side: "bull",
                ai_agreement: body.side === "bull",
                future_results: [
                  {
                    horizon_days: 1,
                    settle_date: "2026-06-03",
                    settle_price: 124,
                    pct_change: 0.45,
                    result_side: "neutral",
                  },
                  {
                    horizon_days: 7,
                    settle_date: "2026-06-11",
                    settle_price: 133.82,
                    pct_change: 8.4,
                    result_side: "bull",
                  },
                  {
                    horizon_days: 30,
                    settle_date: "2026-07-14",
                    settle_price: 130,
                    pct_change: 5.3,
                    result_side: "bull",
                  },
                ],
                created_at: "2026-07-20T00:00:00+00:00",
                feedback: {
                  summary: "You chose bear with 3/5 confidence. The answer is bull.",
                  probable_causes: ["You may have overweighted the risk narrative."],
                  improvement_steps: ["Rank the clues by specificity."],
                  focus_tags: ["calibration", "evidence"],
                  diagnosis: "A correct result still needs evidence quality.",
                  missed_signals: ["Technical focus: MA5 / MA20 121.00 / 119.00."],
                  good_reasoning: ["You included a counter-risk."],
                  next_drill_focus: "Write the best opposing case before submitting.",
                  suggested_framework: "Judge technical trend first, then validate with news themes and AI.",
                },
              }),
            ),
        });
      }

      if (url === "/api/practice" || url.startsWith("/api/practice?")) {
        return Promise.resolve({
          ok: true,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                stats: {
                  total_attempts: 0,
                  accuracy_rate: null,
                  high_confidence_accuracy_rate: null,
                  low_confidence_accuracy_rate: null,
                  most_common_focus: null,
                  ai_alignment_rate: null,
                  ai_aligned_accuracy_rate: null,
                  ai_unaligned_accuracy_rate: null,
                  high_technical_weight_accuracy_rate: null,
                  high_fundamental_weight_accuracy_rate: null,
                  high_chip_weight_accuracy_rate: null,
                  high_ai_weight_accuracy_rate: null,
                  top_weaknesses: [],
                },
                questions: [practiceQuestion],
                recent_attempts: [practiceAttemptRecord],
              }),
            ),
        });
      }

      if (url === "/api/portfolio/decisions" && options.method === "POST") {
        const body = JSON.parse(options.body);
        return Promise.resolve({
          ok: true,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                id: 4,
                ticker: body.ticker,
                side: body.side,
                confidence: body.confidence,
                rationale: body.rationale,
                price_at_decision: body.analysis?.price ?? body.entry_price,
                current_price: body.analysis?.price ?? 130,
                pct_change: 0,
                currency: body.analysis?.currency ?? body.currency ?? "USD",
                created_at: "2026-07-20T00:00:00+00:00",
                ai_side: "bull",
                ai_agreement: body.side === "bull",
                data_note: body.analysis?.data_note ?? "Manual entry.",
                status: body.status || "open",
                exit_price: body.exit_price || null,
                exit_at: body.exit_at || null,
                review_note: body.review_note || "",
              }),
            ),
        });
      }

      if (url === "/api/portfolio/decisions/4" && options.method === "PATCH") {
        const body = JSON.parse(options.body);
        return Promise.resolve({
          ok: true,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                ...portfolioResponse.decisions[0],
                ...body,
                id: 4,
                current_price: 130,
                pct_change: 5.3,
              }),
            ),
        });
      }

      if (url === "/api/portfolio/decisions/4" && options.method === "DELETE") {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(JSON.stringify({ status: "deleted" })) });
      }

      if (url === "/api/portfolio") {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(JSON.stringify(portfolioResponse)),
        });
      }

      if (url === "/api/debates/judged") {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(JSON.stringify(judgedDebate)) });
      }

      if (url === "/api/verdicts") {
        return Promise.resolve({
          ok: true,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                id: 1,
                debate_id: 1,
                side: "bull",
                confidence: 3,
                judge_side: "bull",
                judge_agreement: true,
                price_at_verdict: 124,
                created_at: "2026-07-18T00:00:00+00:00",
              }),
            ),
        });
      }

      if (url === "/api/records") {
        return Promise.resolve({
          ok: true,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                stats: {
                  total_verdicts: 2,
                  win_rate_7d: 50,
                  bull_count: 1,
                  bear_count: 1,
                  neutral_count: 0,
                  high_confidence_win_rate_7d: 100,
                  low_confidence_win_rate_7d: 0,
                  judge_agreement_rate: 50,
                  aligned_win_rate_7d: 100,
                  unaligned_win_rate_7d: 0,
                },
                records: [
                  {
                    id: 1,
                    debate_id: 1,
                    ticker: "NVDA",
                    side: "bull",
                    confidence: 5,
                    note: "High confidence winner.",
                    review_note: "",
                    price_at_verdict: 100,
                    created_at: "2026-07-10T00:00:00+00:00",
                    judge_side: "bull",
                    judge_agreement: true,
                    settlements: [
                      { horizon: "1d", settle_price: 105, pct_change: 5, result: "win", settled_at: "2026-07-11T00:00:00+00:00" },
                      { horizon: "7d", settle_price: 110, pct_change: 10, result: "win", settled_at: "2026-07-17T00:00:00+00:00" },
                      { horizon: "30d", settle_price: null, pct_change: null, result: "pending", settled_at: null },
                    ],
                  },
                ],
              }),
            ),
        });
      }

      if (url === "/api/records/1" && options.method === "PATCH") {
        const body = JSON.parse(options.body);
        return Promise.resolve({
          ok: true,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                id: 1,
                debate_id: 1,
                ticker: "NVDA",
                side: body.side,
                confidence: body.confidence,
                note: body.note,
                review_note: body.review_note,
                price_at_verdict: 100,
                created_at: "2026-07-10T00:00:00+00:00",
                judge_side: "bull",
                judge_agreement: body.side === "bull",
                settlements: [
                  { horizon: "7d", settle_price: 110, pct_change: 10, result: body.side === "bull" ? "win" : "loss", settled_at: "2026-07-17T00:00:00+00:00" },
                ],
              }),
            ),
        });
      }

      if (url === "/api/records/1" && options.method === "DELETE") {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(JSON.stringify({ status: "deleted" })) });
      }

      if (url === "/api/practice/attempts/7" && options.method === "PATCH") {
        const body = JSON.parse(options.body);
        return Promise.resolve({
          ok: true,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                ...practiceAttemptRecord,
                selected_side: body.selected_side,
                confidence: body.confidence,
                rationale: body.rationale,
                review_note: body.review_note,
              }),
            ),
        });
      }

      if (url === "/api/practice/attempts/7" && options.method === "DELETE") {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(JSON.stringify({ status: "deleted" })) });
      }

      return Promise.resolve({
        ok: false,
        text: () => Promise.resolve(JSON.stringify({ detail: { message: "Ticker not found." } })),
      });
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("displays the API ok health status", async () => {
    render(<App />);
    expect(await screen.findByText("API: ok")).toBeInTheDocument();
  });

  it("searches by company name and selects a ticker suggestion", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "即時工作台" }));
    fireEvent.change(screen.getByLabelText("輸入代號或股名"), { target: { value: "台積電" } });
    fireEvent.click(await screen.findByText("Taiwan Semiconductor Manufacturing Company"));

    expect(await screen.findByRole("heading", { name: "Taiwan Semiconductor Manufacturing Company" })).toBeInTheDocument();
    expect(screen.getByText("TWD")).toBeInTheDocument();
  });

  it("searches a ticker and renders market data", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "即時工作台" }));
    fireEvent.submit(screen.getByRole("button", { name: "查詢" }).closest("form"));

    expect(await screen.findByText("NVIDIA Corporation")).toBeInTheDocument();
    expect(screen.getAllByText("NVDA").length).toBeGreaterThan(1);
    expect(screen.getByRole("img", { name: "30 day price line chart" })).toBeInTheDocument();
    expect(await screen.findByText("記錄這一刻的判斷")).toBeInTheDocument();
    expect(screen.getByText("市場資料來自 Yahoo Finance/yfinance；新聞/題材保留原始新聞連結，AI 面根據可見證據產生。")).toBeInTheDocument();
  });

  it("records a live analysis decision into portfolio tracking", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "即時工作台" }));
    fireEvent.submit(screen.getByRole("button", { name: "查詢" }).closest("form"));
    expect(await screen.findByText("記錄這一刻的判斷")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "看空" }));
    fireEvent.change(screen.getByLabelText("當下決策理由"), {
      target: { value: "Valuation risk outweighed momentum." },
    });
    fireEvent.click(screen.getByRole("button", { name: "記錄到 Portfolio" }));

    expect(await screen.findByText("已記錄到 Portfolio；之後可到 Portfolio 追蹤。")).toBeInTheDocument();
    const decisionCall = global.fetch.mock.calls.find(
      ([url, options]) => url === "/api/portfolio/decisions" && options?.method === "POST",
    );
    expect(JSON.parse(decisionCall[1].body)).toMatchObject({
      ticker: "NVDA",
      side: "bear",
      confidence: 3,
      rationale: "Valuation risk outweighed momentum.",
      language: "zh-Hant",
      weights: { technical: 45, fundamental: 25, chip: 0, ai: 30 },
    });

    fireEvent.click(screen.getByRole("button", { name: "Portfolio" }));
    expect(await screen.findByText("當下決策追蹤")).toBeInTheDocument();
    expect(screen.getByText("Valuation risk outweighed momentum.")).toBeInTheDocument();
    expect(screen.getByText("+5.3%")).toBeInTheDocument();
  });

  it("adds edits and deletes a manual portfolio record", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "EN" }));
    fireEvent.click(screen.getByRole("button", { name: "Portfolio" }));
    expect(await screen.findByText("Current Decision Tracking")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Entry price"), { target: { value: "118.5" } });
    fireEvent.change(screen.getAllByLabelText("Decision rationale")[0], {
      target: { value: "Manual entry before using the app." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Record" }));

    await waitFor(() => {
      const createCall = global.fetch.mock.calls.find(
        ([url, options]) => url === "/api/portfolio/decisions" && options?.method === "POST" && JSON.parse(options.body).entry_price === 118.5,
      );
      expect(createCall).toBeTruthy();
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    fireEvent.change(screen.getAllByLabelText("Review note").at(-1), {
      target: { value: "Exit rules need to be clearer." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Edit" }));

    await waitFor(() => {
      const updateCall = global.fetch.mock.calls.find(
        ([url, options]) => url === "/api/portfolio/decisions/4" && options?.method === "PATCH",
      );
      expect(JSON.parse(updateCall[1].body).review_note).toBe("Exit rules need to be clearer.");
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    await waitFor(() => {
      expect(global.fetch.mock.calls.some(([url, options]) => url === "/api/portfolio/decisions/4" && options?.method === "DELETE")).toBe(true);
    });
  });

  it("starts a judged debate and reveals scores only after verdict", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "EN" }));
    fireEvent.click(screen.getByRole("button", { name: "Live Desk" }));
    fireEvent.submit(screen.getByRole("button", { name: "Search" }).closest("form"));
    await screen.findByText("NVIDIA Corporation");
    expect(await screen.findByText("AI Bull/Bear Debate")).toBeInTheDocument();
    expect(screen.getByText("Bull evidence points to continuation.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Run OpenAI Debate" }));

    expect(await screen.findByText("Bull Opening")).toBeInTheDocument();
    expect(screen.getByText("Bear Opening")).toBeInTheDocument();
    expect(screen.getByText("Bull claim 1")).toBeInTheDocument();
    expect(screen.getByText("Bear claim 1")).toBeInTheDocument();
    expect(screen.getByText("Bull Rebuttals")).toBeInTheDocument();
    expect(screen.getByText("Bear Rebuttals")).toBeInTheDocument();
    expect(screen.getByText("Judge Scores")).toBeInTheDocument();
    expect(screen.getAllByText("Evidence 4").length).toBeGreaterThan(0);
    expect(screen.getByText("unverifiable：Cannot verify the source.")).toBeInTheDocument();
  });

  it("shows a friendly debate error when the server returns non-json text", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "EN" }));
    fireEvent.click(screen.getByRole("button", { name: "Live Desk" }));
    fireEvent.submit(screen.getByRole("button", { name: "Search" }).closest("form"));
    await screen.findByText("NVIDIA Corporation");

    global.fetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        text: () => Promise.resolve("Internal Server Error"),
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Run OpenAI Debate" }));

    expect(await screen.findByText("Debate generation failed. Try again or switch to Demo Mode.")).toBeInTheDocument();
  });

  it("loads records with settled scoreboard data", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "復盤中心" }));

    expect(await screen.findByRole("heading", { name: "復盤中心" })).toBeInTheDocument();
    expect(await screen.findByText("練習作答紀錄")).toBeInTheDocument();
    expect(screen.getByText("A correct result still needs evidence quality.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "即時判斷" }));
    expect(screen.getByText("7 日勝率")).toBeInTheDocument();
    expect(screen.getAllByText("50%").length).toBeGreaterThan(1);
    expect(screen.getByText("110.00 (+10.00%) 勝")).toBeInTheDocument();
    expect(screen.getByText("待結算")).toBeInTheDocument();
  });

  it("edits and deletes records and practice attempts", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "EN" }));
    fireEvent.click(screen.getByRole("button", { name: "Review Center" }));
    expect(await screen.findByRole("heading", { name: "Review Center" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Live Judgments" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    fireEvent.change(screen.getByLabelText("Review note"), {
      target: { value: "Need better judge comparison." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Edit" }));

    await waitFor(() => {
      const recordUpdateCall = global.fetch.mock.calls.find(
        ([url, options]) => url === "/api/records/1" && options?.method === "PATCH",
      );
      expect(JSON.parse(recordUpdateCall[1].body).review_note).toBe("Need better judge comparison.");
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    await waitFor(() => {
      expect(global.fetch.mock.calls.some(([url, options]) => url === "/api/records/1" && options?.method === "DELETE")).toBe(true);
    });

    fireEvent.click(screen.getByRole("button", { name: "Practice Answers" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Edit" }).at(-1));
    fireEvent.change(screen.getAllByLabelText("Review note").at(-1), {
      target: { value: "I chased the visible trend." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Edit" }));

    await waitFor(() => {
      const attemptUpdateCall = global.fetch.mock.calls.find(
        ([url, options]) => url === "/api/practice/attempts/7" && options?.method === "PATCH",
      );
      expect(JSON.parse(attemptUpdateCall[1].body).review_note).toBe("I chased the visible trend.");
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    await waitFor(() => {
      expect(global.fetch.mock.calls.some(([url, options]) => url === "/api/practice/attempts/7" && options?.method === "DELETE")).toBe(true);
    });
  });

  it("submits a historical practice answer with dimension weights", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "EN" }));
    fireEvent.click(screen.getByRole("button", { name: "Practice" }));

    expect(await screen.findByText("Historical Judgment Drills")).toBeInTheDocument();
    expect(screen.getByText(/Training goal/)).toBeInTheDocument();
    expect(screen.getByText("Decision Workbench")).toBeInTheDocument();
    expect(screen.getByText("Evidence Panel")).toBeInTheDocument();
    expect(screen.getByText("Read chart → Check evidence → Audit AI → Answer")).toBeInTheDocument();
    expect(screen.getAllByText("Technical").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Fundamental").length).toBeGreaterThan(0);
    expect(screen.queryByText("Price-volume proxy")).not.toBeInTheDocument();
    expect(screen.getByText("K-line / MA5 / MA10 / MA20 / Bollinger Bands / Price-Volume / KD / MACD")).toBeInTheDocument();
    expect(screen.getAllByText("Bollinger Bands").length).toBeGreaterThan(0);
    expect(screen.getByText("News/Theme")).toBeInTheDocument();
    expect(screen.getByText("AI Bull/Bear Debate")).toBeInTheDocument();
    expect(screen.getByText("Evidence refs: T1, A1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "News/Theme" }));
    expect(screen.getByText("AI demand remains a key theme")).toBeInTheDocument();
    expect(screen.getByText("AI accelerator demand remains the main market theme around the company.")).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "Open original article" }).some(
        (link) => link.getAttribute("href") === "https://example.com/news/nvda-ai-demand",
      ),
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "AI" }));
    expect(screen.getAllByText(/AI suggested side/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Evidence Pack" }));
    expect(screen.getByText("The AI debate may only cite this evidence pack; use evidence refs to verify that each argument is grounded.")).toBeInTheDocument();
    expect(screen.queryByText("Close 123.45; 5D +2.00%, 20D +5.00%.")).not.toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getAllByText("MA10").length).toBeGreaterThan(0);
    const ma10Checkbox = screen.getByLabelText("MA10");
    expect(ma10Checkbox).toBeChecked();
    fireEvent.click(ma10Checkbox);
    expect(ma10Checkbox).not.toBeChecked();
    expect(screen.getByText("Answer after reading")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Bearish" }));
    fireEvent.change(screen.getByLabelText("Judgment rationale"), {
      target: { value: "MACD is positive, but valuation risk looks too high." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit Answer" }));

    expect(await screen.findByText("Needs work")).toBeInTheDocument();
    expect(screen.getByText("Real backtest")).toBeInTheDocument();
    expect(screen.getByText("You differed from AI")).toBeInTheDocument();
    expect(screen.getByText(/Suggested framework/)).toBeInTheDocument();

    const practiceCall = global.fetch.mock.calls.find(
      ([url, options]) => url === "/api/practice/attempts" && options?.method === "POST",
    );
    expect(JSON.parse(practiceCall[1].body)).toMatchObject({
      question_id: "nvda-historical-ai-snapshot",
      side: "bear",
      confidence: 3,
      rationale: "MACD is positive, but valuation risk looks too high.",
      language: "en",
      weights: { technical: 45, fundamental: 25, chip: 0, ai: 30 },
    });
  });

  it("falls back to a direct backend when the practice dev proxy misses", async () => {
    global.fetch.mockImplementation((url) => {
      if (url === "/api/health") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ status: "ok" }) });
      }

      if (url.startsWith("/api/practice?")) {
        return Promise.resolve({
          ok: false,
          status: 404,
          text: () => Promise.resolve(JSON.stringify({ detail: "Not Found" })),
        });
      }

      if (url.startsWith("http://127.0.0.1:8030/api/practice?")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                stats: {
                  total_attempts: 0,
                  accuracy_rate: null,
                  high_confidence_accuracy_rate: null,
                  low_confidence_accuracy_rate: null,
                  most_common_focus: null,
                  ai_alignment_rate: null,
                  ai_aligned_accuracy_rate: null,
                  ai_unaligned_accuracy_rate: null,
                  high_technical_weight_accuracy_rate: null,
                  high_fundamental_weight_accuracy_rate: null,
                  high_chip_weight_accuracy_rate: null,
                  high_ai_weight_accuracy_rate: null,
                  top_weaknesses: [],
                },
                questions: [practiceQuestion],
                recent_attempts: [],
              }),
            ),
        });
      }

      return Promise.resolve({
        ok: false,
        status: 404,
        text: () => Promise.resolve(JSON.stringify({ detail: { message: "Missing endpoint." } })),
      });
    });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "EN" }));
    fireEvent.click(screen.getByRole("button", { name: "Practice" }));

    expect(await screen.findByText("Historical Judgment Drills")).toBeInTheDocument();
    expect(screen.getByText("K-line / MA5 / MA10 / MA20 / Bollinger Bands / Price-Volume / KD / MACD")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("http://127.0.0.1:8030/api/practice?"),
      {},
    );
  });

  it("saves OpenAI API key and can switch to demo mode", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "API: ok" }));

    expect(await screen.findByText("模型與 API Key")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /使用我的 API key/ }));
    fireEvent.change(screen.getByLabelText("OpenAI API key"), {
      target: { value: "sk-proj-user-key" },
    });
    fireEvent.change(screen.getByLabelText("模型"), {
      target: { value: "gpt-5.6-sol" },
    });
    fireEvent.click(screen.getByRole("button", { name: "儲存設定" }));

    expect(await screen.findByText("設定已儲存；下一次辯論會使用新的 key/model。")).toBeInTheDocument();
    let settingsCall = global.fetch.mock.calls.find(
      ([url, options]) => url === "/api/settings/openai" && options?.method === "POST",
    );
    expect(JSON.parse(settingsCall[1].body)).toEqual({
      api_key: "sk-proj-user-key",
      model: "gpt-5.6-sol",
      key_source: "user",
      debate_mode: "api",
    });

    fireEvent.click(screen.getByRole("button", { name: "Demo 模式" }));
    fireEvent.click(screen.getByRole("button", { name: "儲存設定" }));
    await waitFor(() => {
      settingsCall = global.fetch.mock.calls.filter(
        ([url, options]) => url === "/api/settings/openai" && options?.method === "POST",
      )[1];
      expect(JSON.parse(settingsCall[1].body)).toMatchObject({
        debate_mode: "demo",
      });
    });
  });

  it("switches UI language and sends the selected debate language", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "EN" }));

    fireEvent.click(screen.getByRole("button", { name: "Live Desk" }));
    expect(screen.getByLabelText("Ticker or company name")).toBeInTheDocument();
    fireEvent.submit(screen.getByRole("button", { name: "Search" }).closest("form"));
    await screen.findByText("NVIDIA Corporation");
    fireEvent.click(screen.getByRole("button", { name: "Run OpenAI Debate" }));

    expect(await screen.findByText("Bull Opening")).toBeInTheDocument();
    const debateCall = global.fetch.mock.calls.find(([url]) => url === "/api/debates/judged");
    expect(JSON.parse(debateCall[1].body).language).toBe("en");
    expect(localStorage.getItem("language")).toBe("en");
  });
});
