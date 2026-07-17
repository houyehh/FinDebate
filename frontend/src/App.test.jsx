import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";

describe("App", () => {
  beforeEach(() => {
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

      if (url === "/api/debates/round-one") {
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
  });
});
