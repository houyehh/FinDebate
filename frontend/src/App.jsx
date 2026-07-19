import { useEffect, useState } from "react";

import { dictionaries } from "./i18n";

const healthLabels = {
  checking: "checking",
  ok: "ok",
  error: "error",
};

const examples = ["NVDA", "2330.TW", "BTC-USD"];
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

function formatPrice(price, currency, language = "zh-Hant") {
  return new Intl.NumberFormat(language === "en" ? "en-US" : "zh-TW", {
    style: "currency",
    currency: currency === "N/A" ? "USD" : currency,
    maximumFractionDigits: price >= 1000 ? 2 : 4,
  }).format(price);
}

async function readApiResponse(response, fallbackMessage) {
  if (typeof response.text === "function") {
    const bodyText = await response.text();
    if (!bodyText) {
      return {};
    }

    try {
      return JSON.parse(bodyText);
    } catch {
      throw new Error(fallbackMessage);
    }
  }

  try {
    return await response.json();
  } catch {
    throw new Error(fallbackMessage);
  }
}

function apiErrorMessage(payload, fallbackMessage) {
  if (typeof payload?.detail === "string") {
    return payload.detail;
  }

  return payload?.detail?.message || payload?.message || fallbackMessage;
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
  const [language, setLanguage] = useState(() => localStorage.getItem("language") || "zh-Hant");
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
  const [activePage, setActivePage] = useState("home");
  const [recordsState, setRecordsState] = useState("idle");
  const [recordsData, setRecordsData] = useState(null);
  const [recordsError, setRecordsError] = useState("");
  const t = dictionaries[language] || dictionaries["zh-Hant"];

  useEffect(() => {
    let active = true;

    fetch(apiUrl("/api/health"))
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

  useEffect(() => {
    if (activePage === "records") {
      fetchRecords();
    }
  }, [activePage]);

  async function handleSubmit(event) {
    event.preventDefault();
    const normalizedTicker = ticker.trim();

    if (!normalizedTicker) {
      setError(t.tickerRequired);
      return;
    }

    setLookupState("loading");
    setError("");

    try {
      const response = await fetch(apiUrl(`/api/tickers/${encodeURIComponent(normalizedTicker)}`));
      const data = await readApiResponse(response, t.tickerNotFound);

      if (!response.ok) {
        throw new Error(apiErrorMessage(data, t.tickerNotFound));
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

  async function fetchRecords() {
    setRecordsState("loading");
    setRecordsError("");

    try {
      const response = await fetch(apiUrl("/api/records"));
      const data = await readApiResponse(response, t.recordsFailed);

      if (!response.ok) {
        throw new Error(apiErrorMessage(data, t.recordsFailed));
      }

      setRecordsData(data);
      setRecordsState("ready");
    } catch (recordsLookupError) {
      setRecordsError(recordsLookupError.message);
      setRecordsState("error");
    }
  }

  async function handleStartDebate() {
    if (!snapshot) {
      return;
    }

    setDebateState("loading");
    setDebateError("");

    try {
      const response = await fetch(apiUrl("/api/debates/judged"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: snapshot.ticker, language }),
      });
      const data = await readApiResponse(response, t.debateFailed);

      if (!response.ok) {
        throw new Error(apiErrorMessage(data, t.debateFailed));
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
      const response = await fetch(apiUrl("/api/verdicts"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          debate,
          side: verdictSide,
          confidence,
          note,
        }),
      });
      const data = await readApiResponse(response, t.verdictFailed);

      if (!response.ok) {
        throw new Error(apiErrorMessage(data, t.verdictFailed));
      }

      setVerdictResult(data);
      setJudgeRevealed(true);
      setVerdictState("saved");
    } catch (verdictError) {
      setVerdictState("error");
      setDebateError(verdictError.message);
    }
  }

  function changeLanguage(nextLanguage) {
    setLanguage(nextLanguage);
    localStorage.setItem("language", nextLanguage);
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <nav className="border-b border-zinc-800 bg-zinc-950/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-5">
          <div className="flex items-center gap-6">
            <span className="text-lg font-semibold tracking-wide">Bull vs Bear Arena</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setActivePage("home")}
                className={`rounded px-3 py-1 text-sm transition ${
                  activePage === "home"
                    ? "bg-zinc-800 text-amber-200"
                    : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                {t.navHome}
              </button>
              <button
                type="button"
                onClick={() => setActivePage("records")}
                className={`rounded px-3 py-1 text-sm transition ${
                  activePage === "records"
                    ? "bg-zinc-800 text-amber-200"
                    : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                {t.navRecords}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded border border-zinc-700 p-1 text-sm">
              <button
                type="button"
                onClick={() => changeLanguage("zh-Hant")}
                className={`rounded px-2 py-1 ${
                  language === "zh-Hant" ? "bg-zinc-800 text-amber-200" : "text-zinc-400"
                }`}
              >
                繁中
              </button>
              <button
                type="button"
                onClick={() => changeLanguage("en")}
                className={`rounded px-2 py-1 ${
                  language === "en" ? "bg-zinc-800 text-amber-200" : "text-zinc-400"
                }`}
              >
                EN
              </button>
            </div>
            <span className="rounded border border-amber-400/40 px-3 py-1 text-sm text-amber-200">
              API: {healthLabels[health]}
            </span>
          </div>
        </div>
      </nav>

      {activePage === "home" ? (
        <>
      <section className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-8 py-12">
        <div className="min-w-0 rounded-lg border border-zinc-800 bg-zinc-900 p-7">
          <p className="text-sm uppercase text-amber-200">{t.tickerLookup}</p>
          <h1 className="mt-3 text-4xl font-semibold">{t.appTitle}</h1>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <label className="block text-sm font-medium text-zinc-300" htmlFor="ticker-input">
              {t.tickerLabel}
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
                {lookupState === "loading" ? t.searching : t.search}
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

        <div className="min-w-0 rounded-lg border border-zinc-800 bg-zinc-900 p-7">
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
                    {formatPrice(snapshot.price, snapshot.currency, language)}
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
                {debateState === "loading" ? t.researching : t.startDebate}
              </button>
            </>
          ) : (
            <div className="flex h-full min-h-80 items-center justify-center rounded border border-dashed border-zinc-700 text-zinc-400">
              {t.chartPlaceholder}
            </div>
          )}
        </div>
      </section>

      {debateState === "loading" ? (
        <section className="mx-auto max-w-6xl px-8 pb-12">
          <div className="rounded-lg border border-amber-300/40 bg-amber-950/20 p-5 text-amber-100">
            {t.researchStatus}
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
              <JudgeScoreboard judge={debate.judge} verdictResult={verdictResult} t={t} />
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
                t={t}
              />
            </section>
          )}
          <section className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-8 pb-10">
            <OpeningColumn
              title={t.bullOpening}
              tone="bull"
              claims={debate.bull.claims}
              scoreMap={judgeRevealed ? buildScoreMap(debate.judge) : {}}
              t={t}
            />
            <OpeningColumn
              title={t.bearOpening}
              tone="bear"
              claims={debate.bear.claims}
              scoreMap={judgeRevealed ? buildScoreMap(debate.judge) : {}}
              t={t}
            />
          </section>
          <section className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-8 pb-16">
            <RebuttalColumn
              title={t.bullRebuttal}
              tone="bull"
              rebuttals={debate.bull_rebuttals.rebuttals}
              scoreMap={judgeRevealed ? buildScoreMap(debate.judge) : {}}
              t={t}
            />
            <RebuttalColumn
              title={t.bearRebuttal}
              tone="bear"
              rebuttals={debate.bear_rebuttals.rebuttals}
              scoreMap={judgeRevealed ? buildScoreMap(debate.judge) : {}}
              t={t}
            />
          </section>
        </>
      ) : null}
        </>
      ) : (
        <RecordsPage
          state={recordsState}
          data={recordsData}
          error={recordsError}
          onRefresh={fetchRecords}
          t={t}
        />
      )}
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
  t,
}) {
  return (
    <form className="rounded-lg border border-amber-300/40 bg-zinc-900 p-6" onSubmit={onSubmit}>
      <div className="flex items-start justify-between gap-8">
        <div>
          <p className="text-sm uppercase text-amber-200">{t.blindVerdict}</p>
          <h2 className="mt-2 text-2xl font-semibold">{t.blindTitle}</h2>
        </div>
        <button
          type="button"
          onClick={onSkip}
          className="rounded border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-amber-300 hover:text-amber-200"
        >
          {t.skipVerdict}
        </button>
      </div>

      <div className="mt-6 flex gap-3">
        {[
          ["bull", t.bullSide],
          ["bear", t.bearSide],
          ["neutral", t.neutralSide],
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
        {t.confidence} {confidence}
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
        {t.noteLabel}
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
        {state === "saving" ? t.saving : t.submitVerdict}
      </button>
    </form>
  );
}

function JudgeScoreboard({ judge, verdictResult, t }) {
  const maxTotal = Math.max(judge.bull_total, judge.bear_total, 1);
  const bullWidth = `${(judge.bull_total / maxTotal) * 100}%`;
  const bearWidth = `${(judge.bear_total / maxTotal) * 100}%`;

  return (
    <div className="rounded-lg border border-amber-300/40 bg-zinc-900 p-6">
      <div className="flex items-start justify-between gap-8">
        <div>
          <p className="text-sm uppercase text-amber-200">{t.judge}</p>
          <h2 className="mt-2 text-2xl font-semibold">{t.judgeScore}</h2>
        </div>
        <div className="text-right text-sm text-zinc-300">
          <p>{t.bull} {judge.bull_total}</p>
          <p>{t.bear} {judge.bear_total}</p>
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
          {verdictResult.judge_agreement ? t.sameSide : t.differentSide} {t.judgeTilt}
          {verdictResult.judge_side === "bull"
            ? t.bullSide
            : verdictResult.judge_side === "bear"
              ? t.bearSide
              : t.neutralSide}
        </p>
      ) : (
        <p className="mt-4 rounded border border-zinc-700 bg-zinc-950 p-3 text-sm text-zinc-300">
          {t.skipped}
        </p>
      )}
    </div>
  );
}

function OpeningColumn({ title, tone, claims, scoreMap, t }) {
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
            <ScoreStrip score={scoreMap[claim.claim_id]} t={t} />
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

function RebuttalColumn({ title, tone, rebuttals, scoreMap, t }) {
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
              {t.rebuttalTarget} #{rebuttal.target_claim_id}
            </a>
            <h3 className="mt-3 text-lg font-semibold text-zinc-100">{rebuttal.rebuttal}</h3>
            <p className="mt-3 text-sm leading-6 text-zinc-300">{rebuttal.evidence}</p>
            <ScoreStrip score={scoreMap[itemId]} t={t} />
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

function ScoreStrip({ score, t }) {
  if (!score) {
    return null;
  }

  return (
    <div className="mt-4 rounded border border-zinc-700 bg-zinc-900 p-3 text-sm text-zinc-300">
      <div className="flex gap-4">
        <span>{t.evidence} {score.evidence_score}</span>
        <span>{t.source} {score.source_score}</span>
        <span>{t.logic} {score.logic_score}</span>
      </div>
      {score.flag === "unverifiable" ? (
        <p className="mt-2 text-amber-200">unverifiable：{score.flag_reason}</p>
      ) : null}
    </div>
  );
}

function RecordsPage({ state, data, error, onRefresh, t }) {
  if (state === "loading" && !data) {
    return (
      <section className="mx-auto max-w-6xl px-8 py-12">
        <div className="rounded-lg border border-amber-300/40 bg-amber-950/20 p-5 text-amber-100">
          {t.loadingRecords}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mx-auto max-w-6xl px-8 py-12">
        <div className="rounded-lg border border-red-400/40 bg-red-950/40 p-5 text-red-100">
          {error}
        </div>
      </section>
    );
  }

  const stats = data?.stats;
  const records = data?.records || [];

  return (
    <section className="mx-auto max-w-6xl px-8 py-12">
      <div className="flex items-start justify-between gap-8">
        <div>
          <p className="text-sm uppercase text-amber-200">{t.scoreboard}</p>
          <h1 className="mt-2 text-4xl font-semibold">{t.recordsTitle}</h1>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="rounded border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-amber-300 hover:text-amber-200"
        >
          {t.refresh}
        </button>
      </div>

      {stats ? (
        <div className="mt-8 grid grid-cols-4 gap-4">
          <StatBox label={t.totalVerdicts} value={stats.total_verdicts} />
          <StatBox label={t.winRate7d} value={formatPercent(stats.win_rate_7d, t)} />
          <StatBox label={t.judgeAgreementRate} value={formatPercent(stats.judge_agreement_rate, t)} />
          <StatBox
            label={t.distribution}
            value={`${stats.bull_count}/${stats.bear_count}/${stats.neutral_count}`}
          />
          <StatBox label={t.highConfidenceWinRate} value={formatPercent(stats.high_confidence_win_rate_7d, t)} />
          <StatBox label={t.lowConfidenceWinRate} value={formatPercent(stats.low_confidence_win_rate_7d, t)} />
          <StatBox label={t.alignedWinRate} value={formatPercent(stats.aligned_win_rate_7d, t)} />
          <StatBox label={t.unalignedWinRate} value={formatPercent(stats.unaligned_win_rate_7d, t)} />
        </div>
      ) : null}

      <div className="mt-8 overflow-hidden rounded-lg border border-zinc-800">
        <table className="w-full border-collapse bg-zinc-900 text-left text-sm">
          <thead className="bg-zinc-950 text-zinc-400">
            <tr>
              <th className="px-4 py-3">{t.tableTicker}</th>
              <th className="px-4 py-3">{t.tableSide}</th>
              <th className="px-4 py-3">{t.tableConfidence}</th>
              <th className="px-4 py-3">{t.tablePrice}</th>
              <th className="px-4 py-3">{t.table1d}</th>
              <th className="px-4 py-3">{t.table7d}</th>
              <th className="px-4 py-3">{t.table30d}</th>
              <th className="px-4 py-3">{t.tableJudge}</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id} className="border-t border-zinc-800 text-zinc-200">
                <td className="px-4 py-4 font-semibold">{record.ticker}</td>
                <td className="px-4 py-4">{sideLabel(record.side, t)}</td>
                <td className="px-4 py-4">{record.confidence}</td>
                <td className="px-4 py-4">{record.price_at_verdict.toFixed(2)}</td>
                <td className="px-4 py-4">{settlementLabel(record, "1d", t)}</td>
                <td className="px-4 py-4">{settlementLabel(record, "7d", t)}</td>
                <td className="px-4 py-4">{settlementLabel(record, "30d", t)}</td>
                <td className="px-4 py-4">
                  {record.judge_agreement ? t.same : t.different}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {records.length === 0 ? (
          <div className="bg-zinc-900 p-8 text-center text-zinc-400">{t.noRecords}</div>
        ) : null}
      </div>
    </section>
  );
}

function StatBox({ label, value }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-zinc-100">{value}</p>
    </div>
  );
}

function settlementLabel(record, horizon, t) {
  const settlement = record.settlements.find((item) => item.horizon === horizon);
  if (!settlement || settlement.result === "pending") {
    return t.pending;
  }
  const pct = `${settlement.pct_change > 0 ? "+" : ""}${settlement.pct_change.toFixed(2)}%`;
  return `${settlement.settle_price.toFixed(2)} (${pct}) ${resultLabel(settlement.result, t)}`;
}

function resultLabel(result, t) {
  if (result === "win") {
    return t.win;
  }
  if (result === "loss") {
    return t.loss;
  }
  return t.draw;
}

function sideLabel(side, t) {
  if (side === "bull") {
    return t.bullSide;
  }
  if (side === "bear") {
    return t.bearSide;
  }
  return t.neutralSide;
}

function formatPercent(value, t) {
  return value == null ? t.unavailable : `${value}%`;
}

export default App;
