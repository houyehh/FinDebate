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
});
