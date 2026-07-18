import { useEffect, useState } from "react";

const healthLabels = {
  checking: "checking",
  ok: "ok",
  error: "error",
};

const examples = ["NVDA", "2330.TW", "BTC-USD"];

function formatPrice(price, currency) {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: currency === "N/A" ? "USD" : currency,
    maximumFractionDigits: price >= 1000 ? 2 : 4,
  }).format(price);
}

function PriceLine({ history }) {
  if (!history?.length) {
    return null;
  }

  const width = 640;
  const height = 220;
  const padding = 22;
  const closes = history.map((point) => point.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = max - min || 1;

  const path = history
    .map((point, index) => {
      const x =
        padding + (index / Math.max(history.length - 1, 1)) * (width - padding * 2);
      const y = height - padding - ((point.close - min) / span) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg
      className="h-56 w-full overflow-visible"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="30 day price line chart"
    >
      <line x1={padding} x2={width - padding} y1={height - padding} y2={height - padding} className="stroke-zinc-700" />
      <path d={path} fill="none" className="stroke-emerald-300" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle
        cx={width - padding}
        cy={
          height -
          padding -
          ((history[history.length - 1].close - min) / span) * (height - padding * 2)
        }
        r="5"
        className="fill-amber-300"
      />
      <text x={padding} y="18" className="fill-zinc-400 text-xs">
        {max.toFixed(2)}
      </text>
      <text x={padding} y={height - 6} className="fill-zinc-400 text-xs">
        {min.toFixed(2)}
      </text>
    </svg>
  );
}

function App() {
  const [health, setHealth] = useState("checking");
  const [ticker, setTicker] = useState("NVDA");
  const [snapshot, setSnapshot] = useState(null);
  const [lookupState, setLookupState] = useState("idle");
  const [error, setError] = useState("");
  const [debate, setDebate] = useState(null);
  const [debateState, setDebateState] = useState("idle");
  const [debateError, setDebateError] = useState("");
  const [judgeRevealed, setJudgeRevealed] = useState(false);
  const [verdictSide, setVerdictSide] = useState("bull");
  const [confidence, setConfidence] = useState(3);
  const [note, setNote] = useState("");
  const [verdictState, setVerdictState] = useState("idle");
  const [verdictResult, setVerdictResult] = useState(null);

  useEffect(() => {
    let active = true;

    fetch("/api/health")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Healthcheck failed");
        }
        return response.json();
      })
      .then((data) => {
        if (active) {
          setHealth(data.status === "ok" ? "ok" : "error");
        }
      })
      .catch(() => {
        if (active) {
          setHealth("error");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    const normalizedTicker = ticker.trim();

    if (!normalizedTicker) {
      setError("請輸入 ticker，例如 NVDA、2330.TW、BTC-USD。");
      return;
    }

    setLookupState("loading");
    setError("");

    try {
      const response = await fetch(`/api/tickers/${encodeURIComponent(normalizedTicker)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail?.message || "查無此標的，請確認 ticker 格式。");
      }

      setSnapshot(data);
      setDebate(null);
      setDebateError("");
      setDebateState("idle");
      resetVerdictState();
      setLookupState("ready");
    } catch (lookupError) {
      setSnapshot(null);
      setDebate(null);
      resetVerdictState();
      setError(lookupError.message);
      setLookupState("error");
    }
  }

  async function handleStartDebate() {
    if (!snapshot) {
      return;
    }

    setDebateState("loading");
    setDebateError("");

    try {
      const response = await fetch("/api/debates/judged", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: snapshot.ticker, language: "zh-Hant" }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail?.message || "辯論生成失敗，請稍後再試。");
      }

      setDebate(data);
      resetVerdictState();
      setDebateState("ready");
    } catch (debateLookupError) {
      setDebate(null);
      resetVerdictState();
      setDebateError(debateLookupError.message);
      setDebateState("error");
    }
  }

  function resetVerdictState() {
    setJudgeRevealed(false);
    setVerdictSide("bull");
    setConfidence(3);
    setNote("");
    setVerdictState("idle");
    setVerdictResult(null);
  }

  async function handleSubmitVerdict(event) {
    event.preventDefault();
    if (!debate) {
      return;
    }

    setVerdictState("saving");

    try {
      const response = await fetch("/api/verdicts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          debate,
          side: verdictSide,
          confidence,
          note,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail?.message || "站邊儲存失敗，請稍後再試。");
      }

      setVerdictResult(data);
      setJudgeRevealed(true);
      setVerdictState("saved");
    } catch (verdictError) {
      setVerdictState("error");
      setDebateError(verdictError.message);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <nav className="border-b border-zinc-800 bg-zinc-950/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-5">
          <span className="text-lg font-semibold tracking-wide">Bull vs Bear Arena</span>
          <span className="rounded border border-amber-400/40 px-3 py-1 text-sm text-amber-200">
            API: {healthLabels[health]}
          </span>
        </div>
      </nav>

      <section className="mx-auto grid max-w-6xl grid-cols-[0.95fr_1.05fr] gap-8 px-8 py-12">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-7">
          <p className="text-sm uppercase text-amber-200">Ticker lookup</p>
          <h1 className="mt-3 text-4xl font-semibold">AI 投資多空辯論擂台</h1>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <label className="block text-sm font-medium text-zinc-300" htmlFor="ticker-input">
              投資標的
            </label>
            <div className="flex gap-3">
              <input
                id="ticker-input"
                value={ticker}
                onChange={(event) => setTicker(event.target.value)}
                className="h-12 min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-950 px-4 text-lg font-semibold uppercase tracking-wide text-zinc-100 outline-none ring-0 transition focus:border-emerald-300"
                placeholder="NVDA"
              />
              <button
                type="submit"
                disabled={lookupState === "loading"}
                className="h-12 rounded bg-emerald-400 px-5 font-semibold text-zinc-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
              >
                {lookupState === "loading" ? "查詢中" : "查詢"}
              </button>
            </div>
          </form>

          <div className="mt-5 flex gap-2">
            {examples.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setTicker(example)}
                className="rounded border border-zinc-700 px-3 py-1 text-sm text-zinc-300 transition hover:border-amber-300 hover:text-amber-200"
              >
                {example}
              </button>
            ))}
          </div>

          {error ? (
            <div className="mt-6 rounded border border-red-400/40 bg-red-950/40 p-4 text-sm text-red-100">
              {error}
            </div>
          ) : null}
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-7">
          {snapshot ? (
            <>
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="text-sm uppercase text-zinc-400">{snapshot.ticker}</p>
                  <h2 className="mt-2 text-3xl font-semibold">{snapshot.name}</h2>
                </div>
                <div className="text-right">
                  <p className="text-sm text-zinc-400">{snapshot.currency}</p>
                  <p className="mt-1 text-3xl font-semibold text-emerald-300">
                    {formatPrice(snapshot.price, snapshot.currency)}
                  </p>
                </div>
              </div>
              <div className="mt-8">
                <PriceLine history={snapshot.history} />
              </div>
              <button
                type="button"
                onClick={handleStartDebate}
                disabled={debateState === "loading"}
                className="mt-7 h-12 rounded bg-amber-300 px-5 font-semibold text-zinc-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
              >
                {debateState === "loading" ? "多空研究中" : "開始辯論"}
              </button>
            </>
          ) : (
            <div className="flex h-full min-h-80 items-center justify-center rounded border border-dashed border-zinc-700 text-zinc-400">
              30 天價格走勢會顯示在這裡
            </div>
          )}
        </div>
      </section>

      {debateState === "loading" ? (
        <section className="mx-auto max-w-6xl px-8 pb-12">
          <div className="rounded-lg border border-amber-300/40 bg-amber-950/20 p-5 text-amber-100">
            多頭研究中… 空頭研究中…
          </div>
        </section>
      ) : null}

      {debateError ? (
        <section className="mx-auto max-w-6xl px-8 pb-12">
          <div className="rounded-lg border border-red-400/40 bg-red-950/40 p-5 text-red-100">
            {debateError}
          </div>
        </section>
      ) : null}

      {debate ? (
        <>
          {judgeRevealed ? (
            <section className="mx-auto max-w-6xl px-8 pb-8">
              <JudgeScoreboard judge={debate.judge} verdictResult={verdictResult} />
            </section>
          ) : (
            <section className="mx-auto max-w-6xl px-8 pb-8">
              <VerdictPanel
                side={verdictSide}
                setSide={setVerdictSide}
                confidence={confidence}
                setConfidence={setConfidence}
                note={note}
                setNote={setNote}
                state={verdictState}
                onSubmit={handleSubmitVerdict}
                onSkip={() => setJudgeRevealed(true)}
              />
            </section>
          )}
          <section className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-8 pb-10">
            <OpeningColumn
              title="多頭開場"
              tone="bull"
              claims={debate.bull.claims}
              scoreMap={judgeRevealed ? buildScoreMap(debate.judge) : {}}
            />
            <OpeningColumn
              title="空頭開場"
              tone="bear"
              claims={debate.bear.claims}
              scoreMap={judgeRevealed ? buildScoreMap(debate.judge) : {}}
            />
          </section>
          <section className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-8 pb-16">
            <RebuttalColumn
              title="多頭反駁"
              tone="bull"
              rebuttals={debate.bull_rebuttals.rebuttals}
              scoreMap={judgeRevealed ? buildScoreMap(debate.judge) : {}}
            />
            <RebuttalColumn
              title="空頭反駁"
              tone="bear"
              rebuttals={debate.bear_rebuttals.rebuttals}
              scoreMap={judgeRevealed ? buildScoreMap(debate.judge) : {}}
            />
          </section>
        </>
      ) : null}
    </main>
  );
}

function buildScoreMap(judge) {
  return (judge?.scores || []).reduce((map, score) => {
    map[score.item_id] = score;
    return map;
  }, {});
}

function VerdictPanel({
  side,
  setSide,
  confidence,
  setConfidence,
  note,
  setNote,
  state,
  onSubmit,
  onSkip,
}) {
  return (
    <form className="rounded-lg border border-amber-300/40 bg-zinc-900 p-6" onSubmit={onSubmit}>
      <div className="flex items-start justify-between gap-8">
        <div>
          <p className="text-sm uppercase text-amber-200">Blind verdict</p>
          <h2 className="mt-2 text-2xl font-semibold">先站邊，再揭曉裁判評分</h2>
        </div>
        <button
          type="button"
          onClick={onSkip}
          className="rounded border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-amber-300 hover:text-amber-200"
        >
          跳過站邊，直接看評分
        </button>
      </div>

      <div className="mt-6 flex gap-3">
        {[
          ["bull", "看多"],
          ["bear", "看空"],
          ["neutral", "中立觀望"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setSide(value)}
            className={`rounded px-4 py-2 font-semibold transition ${
              side === value
                ? "bg-amber-300 text-zinc-950"
                : "border border-zinc-700 text-zinc-300 hover:border-amber-300 hover:text-amber-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <label className="mt-6 block text-sm font-medium text-zinc-300" htmlFor="confidence">
        信心度 {confidence}
      </label>
      <input
        id="confidence"
        type="range"
        min="1"
        max="5"
        value={confidence}
        onChange={(event) => setConfidence(Number(event.target.value))}
        className="mt-3 w-full accent-amber-300"
      />

      <label className="mt-6 block text-sm font-medium text-zinc-300" htmlFor="verdict-note">
        一句話理由
      </label>
      <textarea
        id="verdict-note"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        className="mt-3 h-24 w-full resize-none rounded border border-zinc-700 bg-zinc-950 p-3 text-zinc-100 outline-none transition focus:border-amber-300"
      />

      <button
        type="submit"
        disabled={state === "saving"}
        className="mt-6 h-12 rounded bg-amber-300 px-5 font-semibold text-zinc-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
      >
        {state === "saving" ? "儲存中" : "送出站邊"}
      </button>
    </form>
  );
}

function JudgeScoreboard({ judge, verdictResult }) {
  const maxTotal = Math.max(judge.bull_total, judge.bear_total, 1);
  const bullWidth = `${(judge.bull_total / maxTotal) * 100}%`;
  const bearWidth = `${(judge.bear_total / maxTotal) * 100}%`;

  return (
    <div className="rounded-lg border border-amber-300/40 bg-zinc-900 p-6">
      <div className="flex items-start justify-between gap-8">
        <div>
          <p className="text-sm uppercase text-amber-200">Judge</p>
          <h2 className="mt-2 text-2xl font-semibold">裁判評分</h2>
        </div>
        <div className="text-right text-sm text-zinc-300">
          <p>多頭 {judge.bull_total}</p>
          <p>空頭 {judge.bear_total}</p>
        </div>
      </div>
      <div className="mt-5 space-y-3">
        <div className="h-3 rounded bg-zinc-800">
          <div className="h-3 rounded bg-emerald-300" style={{ width: bullWidth }} />
        </div>
        <div className="h-3 rounded bg-zinc-800">
          <div className="h-3 rounded bg-red-300" style={{ width: bearWidth }} />
        </div>
      </div>
      <p className="mt-5 text-sm leading-6 text-zinc-300">{judge.summary}</p>
      {verdictResult ? (
        <p className="mt-4 rounded border border-amber-300/40 bg-amber-950/20 p-3 text-sm text-amber-100">
          {verdictResult.judge_agreement ? "你與裁判同邊" : "你與裁判不同邊"}，裁判傾向：
          {verdictResult.judge_side === "bull"
            ? "看多"
            : verdictResult.judge_side === "bear"
              ? "看空"
              : "中立"}
        </p>
      ) : (
        <p className="mt-4 rounded border border-zinc-700 bg-zinc-950 p-3 text-sm text-zinc-300">
          已跳過站邊，本場不計入戰績
        </p>
      )}
    </div>
  );
}

function OpeningColumn({ title, tone, claims, scoreMap }) {
  const toneClass =
    tone === "bull"
      ? "border-emerald-400/40 bg-emerald-950/20 text-emerald-100"
      : "border-red-400/40 bg-red-950/20 text-red-100";

  return (
    <div className={`rounded-lg border p-6 ${toneClass}`}>
      <h2 className="text-2xl font-semibold">{title}</h2>
      <div className="mt-5 space-y-4">
        {claims.map((claim) => (
          <article
            key={claim.claim_id}
            id={`claim-${claim.claim_id}`}
            className="rounded border border-zinc-700/70 bg-zinc-950/80 p-4"
          >
            <p className="text-sm font-semibold text-zinc-400">#{claim.claim_id}</p>
            <h3 className="mt-2 text-lg font-semibold text-zinc-100">{claim.claim}</h3>
            <p className="mt-3 text-sm leading-6 text-zinc-300">{claim.evidence}</p>
            <ScoreStrip score={scoreMap[claim.claim_id]} />
            <a
              className="mt-4 inline-block text-sm text-amber-200 underline-offset-4 hover:underline"
              href={claim.source_url}
              target="_blank"
              rel="noreferrer"
            >
              {claim.source_name}
            </a>
          </article>
        ))}
      </div>
    </div>
  );
}

function RebuttalColumn({ title, tone, rebuttals, scoreMap }) {
  const toneClass =
    tone === "bull"
      ? "border-emerald-400/40 bg-emerald-950/20 text-emerald-100"
      : "border-red-400/40 bg-red-950/20 text-red-100";

  return (
    <div className={`rounded-lg border p-6 ${toneClass}`}>
      <h2 className="text-2xl font-semibold">{title}</h2>
      <div className="mt-5 space-y-4">
        {rebuttals.map((rebuttal, index) => {
          const itemId = `${tone.toUpperCase()}-REB-${index + 1}`;
          return (
          <article
            key={itemId}
            className="rounded border border-zinc-700/70 bg-zinc-950/80 p-4"
          >
            <a
              className="text-sm font-semibold text-amber-200 underline-offset-4 hover:underline"
              href={`#claim-${rebuttal.target_claim_id}`}
            >
              反駁 → 對方論點 #{rebuttal.target_claim_id}
            </a>
            <h3 className="mt-3 text-lg font-semibold text-zinc-100">{rebuttal.rebuttal}</h3>
            <p className="mt-3 text-sm leading-6 text-zinc-300">{rebuttal.evidence}</p>
            <ScoreStrip score={scoreMap[itemId]} />
            <a
              className="mt-4 inline-block break-all text-sm text-amber-200 underline-offset-4 hover:underline"
              href={rebuttal.source_url}
              target="_blank"
              rel="noreferrer"
            >
              {rebuttal.source_url}
            </a>
          </article>
          );
        })}
      </div>
    </div>
  );
}

function ScoreStrip({ score }) {
  if (!score) {
    return null;
  }

  return (
    <div className="mt-4 rounded border border-zinc-700 bg-zinc-900 p-3 text-sm text-zinc-300">
      <div className="flex gap-4">
        <span>證據 {score.evidence_score}</span>
        <span>來源 {score.source_score}</span>
        <span>邏輯 {score.logic_score}</span>
      </div>
      {score.flag === "unverifiable" ? (
        <p className="mt-2 text-amber-200">unverifiable：{score.flag_reason}</p>
      ) : null}
    </div>
  );
}

export default App;
