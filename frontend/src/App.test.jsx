import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = vi.fn((url) => {
      if (url === "/api/health") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: "ok" }),
        });
      }

      if (url === "/api/tickers/NVDA") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ticker: "NVDA",
              name: "NVIDIA Corporation",
              price: 123.45,
              currency: "USD",
              history: [
                { date: "2026-06-01", close: 120 },
                { date: "2026-06-02", close: 121.5 },
                { date: "2026-06-03", close: 123.45 },
              ],
            }),
        });
      }

      if (url === "/api/debates/judged") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
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
                bear_total: 60,
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
                    item_id: "BULL-2",
                    side: "bull",
                    item_type: "claim",
                    evidence_score: 4,
                    source_score: 3,
                    logic_score: 5,
                    flag: "none",
                    flag_reason: "",
                  },
                  {
                    item_id: "BULL-3",
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
                  {
                    item_id: "BEAR-2",
                    side: "bear",
                    item_type: "claim",
                    evidence_score: 4,
                    source_score: 3,
                    logic_score: 5,
                    flag: "none",
                    flag_reason: "",
                  },
                  {
                    item_id: "BEAR-3",
                    side: "bear",
                    item_type: "claim",
                    evidence_score: 4,
                    source_score: 3,
                    logic_score: 5,
                    flag: "none",
                    flag_reason: "",
                  },
                  {
                    item_id: "BULL-REB-1",
                    side: "bull",
                    item_type: "rebuttal",
                    evidence_score: 4,
                    source_score: 3,
                    logic_score: 5,
                    flag: "none",
                    flag_reason: "",
                  },
                  {
                    item_id: "BULL-REB-2",
                    side: "bull",
                    item_type: "rebuttal",
                    evidence_score: 4,
                    source_score: 3,
                    logic_score: 5,
                    flag: "none",
                    flag_reason: "",
                  },
                  {
                    item_id: "BEAR-REB-1",
                    side: "bear",
                    item_type: "rebuttal",
                    evidence_score: 4,
                    source_score: 3,
                    logic_score: 5,
                    flag: "none",
                    flag_reason: "",
                  },
                  {
                    item_id: "BEAR-REB-2",
                    side: "bear",
                    item_type: "rebuttal",
                    evidence_score: 4,
                    source_score: 3,
                    logic_score: 5,
                    flag: "none",
                    flag_reason: "",
                  },
                ],
              },
            }),
        });
      }

      if (url === "/api/verdicts") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 1,
              debate_id: 1,
              side: "bull",
              confidence: 3,
              judge_side: "bull",
              judge_agreement: true,
              price_at_verdict: 124,
              created_at: "2026-07-18T00:00:00+00:00",
            }),
        });
      }

      if (url === "/api/records") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
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
                  price_at_verdict: 100,
                  created_at: "2026-07-10T00:00:00+00:00",
                  judge_side: "bull",
                  judge_agreement: true,
                  settlements: [
                    {
                      horizon: "1d",
                      settle_price: 105,
                      pct_change: 5,
                      result: "win",
                      settled_at: "2026-07-11T00:00:00+00:00",
                    },
                    {
                      horizon: "7d",
                      settle_price: 110,
                      pct_change: 10,
                      result: "win",
                      settled_at: "2026-07-17T00:00:00+00:00",
                    },
                    {
                      horizon: "30d",
                      settle_price: null,
                      pct_change: null,
                      result: "pending",
                      settled_at: null,
                    },
                  ],
                },
              ],
            }),
        });
      }

      return Promise.resolve({
        ok: false,
        json: () =>
          Promise.resolve({
            detail: { message: "查無此標的，請確認 ticker 格式。" },
          }),
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

  it("searches a ticker and renders market data", async () => {
    render(<App />);

    fireEvent.submit(screen.getByRole("button", { name: "查詢" }).closest("form"));

    expect(await screen.findByText("NVIDIA Corporation")).toBeInTheDocument();
    expect(screen.getAllByText("NVDA").length).toBeGreaterThan(1);
    expect(screen.getByRole("img", { name: "30 day price line chart" })).toBeInTheDocument();
  });

  it("starts a round-one debate and renders both opening rounds", async () => {
    render(<App />);

    fireEvent.submit(screen.getByRole("button", { name: "查詢" }).closest("form"));
    await screen.findByText("NVIDIA Corporation");
    fireEvent.click(screen.getByRole("button", { name: "開始辯論" }));

    expect(await screen.findByText("多頭開場")).toBeInTheDocument();
    expect(screen.getByText("空頭開場")).toBeInTheDocument();
    expect(screen.getByText("Bull claim 1")).toBeInTheDocument();
    expect(screen.getByText("Bear claim 1")).toBeInTheDocument();
    expect(screen.getByText("多頭反駁")).toBeInTheDocument();
    expect(screen.getByText("空頭反駁")).toBeInTheDocument();
    expect(screen.getByText("Bull rebuttal 1")).toBeInTheDocument();
    expect(screen.getByText("反駁 → 對方論點 #BEAR-1")).toBeInTheDocument();
    expect(screen.queryByText("裁判評分")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "送出站邊" }));

    expect(await screen.findByText("裁判評分")).toBeInTheDocument();
    expect(screen.getAllByText("證據 4").length).toBeGreaterThan(0);
    expect(screen.getByText("unverifiable：Cannot verify the source.")).toBeInTheDocument();
    expect(screen.getByText(/你與裁判同邊/)).toBeInTheDocument();
  });

  it("loads the records page with settled scoreboard data", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "戰績" }));

    expect(await screen.findByText("判斷力戰績")).toBeInTheDocument();
    expect(screen.getByText("7日勝率")).toBeInTheDocument();
    expect(screen.getAllByText("50%").length).toBeGreaterThan(1);
    expect(screen.getByText("NVDA")).toBeInTheDocument();
    expect(screen.getByText("110.00 (+10.00%) 勝")).toBeInTheDocument();
    expect(screen.getByText("待結算")).toBeInTheDocument();
  });

  it("switches UI language and sends the selected debate language", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "EN" }));

    expect(screen.getByLabelText("Ticker")).toBeInTheDocument();
    fireEvent.submit(screen.getByRole("button", { name: "Search" }).closest("form"));
    await screen.findByText("NVIDIA Corporation");
    fireEvent.click(screen.getByRole("button", { name: "Start Debate" }));

    expect(await screen.findByText("Bull Opening")).toBeInTheDocument();
    const debateCall = global.fetch.mock.calls.find(([url]) => url === "/api/debates/judged");
    expect(JSON.parse(debateCall[1].body).language).toBe("en");
    expect(localStorage.getItem("language")).toBe("en");
  });
});
