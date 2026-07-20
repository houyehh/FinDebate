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
  const [practiceState, setPracticeState] = useState("idle");
  const [practiceData, setPracticeData] = useState(null);
  const [practiceError, setPracticeError] = useState("");
  const [settingsState, setSettingsState] = useState("idle");
  const [openAISettings, setOpenAISettings] = useState(null);
  const [settingsApiKey, setSettingsApiKey] = useState("");
  const [settingsModel, setSettingsModel] = useState("");
  const [settingsKeySource, setSettingsKeySource] = useState("default");
  const [settingsDebateMode, setSettingsDebateMode] = useState("api");
  const [settingsError, setSettingsError] = useState("");
  const [settingsSaved, setSettingsSaved] = useState(false);
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
    } else if (activePage === "practice") {
      fetchPractice();
    } else if (activePage === "settings") {
      fetchOpenAISettings();
    }
  }, [activePage, language]);

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

  async function fetchOpenAISettings() {
    setSettingsState("loading");
    setSettingsError("");
    setSettingsSaved(false);

    try {
      const response = await fetch(apiUrl("/api/settings/openai"));
      const data = await readApiResponse(response, t.settingsFailed);

      if (!response.ok) {
        throw new Error(apiErrorMessage(data, t.settingsFailed));
      }

      setOpenAISettings(data);
      setSettingsModel(data.model || "");
      setSettingsKeySource(data.key_source || "default");
      setSettingsDebateMode(data.debate_mode || "api");
      setSettingsApiKey("");
      setSettingsState("ready");
    } catch (settingsLookupError) {
      setSettingsError(settingsLookupError.message);
      setSettingsState("error");
    }
  }

  async function fetchPractice({ silent = false } = {}) {
    if (!silent) {
      setPracticeState("loading");
    }
    setPracticeError("");

    try {
      const response = await fetch(apiUrl(`/api/practice?language=${encodeURIComponent(language)}`));
      const data = await readApiResponse(response, t.practiceFailed);

      if (!response.ok) {
        throw new Error(apiErrorMessage(data, t.practiceFailed));
      }

      setPracticeData(data);
      setPracticeState("ready");
    } catch (practiceLookupError) {
      setPracticeError(practiceLookupError.message);
      setPracticeState("error");
    }
  }

  async function handleSubmitPracticeAttempt(payload) {
    const response = await fetch(apiUrl("/api/practice/attempts"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await readApiResponse(response, t.practiceSubmitFailed);

    if (!response.ok) {
      throw new Error(apiErrorMessage(data, t.practiceSubmitFailed));
    }

    await fetchPractice({ silent: true });
    return data;
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

  async function handleSubmitOpenAISettings(event) {
    event.preventDefault();
    setSettingsState("saving");
    setSettingsError("");
    setSettingsSaved(false);

    try {
      const response = await fetch(apiUrl("/api/settings/openai"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: settingsApiKey,
          model: settingsModel,
          key_source: settingsKeySource,
          debate_mode: settingsDebateMode,
        }),
      });
      const data = await readApiResponse(response, t.settingsSaveFailed);

      if (!response.ok) {
        throw new Error(apiErrorMessage(data, t.settingsSaveFailed));
      }

      setOpenAISettings(data);
      setSettingsModel(data.model || "");
      setSettingsKeySource(data.key_source || "default");
      setSettingsDebateMode(data.debate_mode || "api");
      setSettingsApiKey("");
      setSettingsSaved(true);
      setSettingsState("ready");
    } catch (settingsSaveError) {
      setSettingsError(settingsSaveError.message);
      setSettingsState("error");
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
              <button
                type="button"
                onClick={() => setActivePage("practice")}
                className={`rounded px-3 py-1 text-sm transition ${
                  activePage === "practice"
                    ? "bg-zinc-800 text-amber-200"
                    : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                {t.navPractice}
              </button>
              <button
                type="button"
                onClick={() => setActivePage("settings")}
                className={`rounded px-3 py-1 text-sm transition ${
                  activePage === "settings"
                    ? "bg-zinc-800 text-amber-200"
                    : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                {t.navSettings}
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
      ) : activePage === "records" ? (
        <RecordsPage
          state={recordsState}
          data={recordsData}
          error={recordsError}
          onRefresh={fetchRecords}
          t={t}
        />
      ) : activePage === "practice" ? (
        <PracticePage
          state={practiceState}
          data={practiceData}
          error={practiceError}
          language={language}
          onRefresh={fetchPractice}
          onSubmitAttempt={handleSubmitPracticeAttempt}
          t={t}
        />
      ) : (
        <OpenAISettingsPage
          state={settingsState}
          settings={openAISettings}
          apiKey={settingsApiKey}
          setApiKey={setSettingsApiKey}
          model={settingsModel}
          setModel={setSettingsModel}
          keySource={settingsKeySource}
          setKeySource={setSettingsKeySource}
          debateMode={settingsDebateMode}
          setDebateMode={setSettingsDebateMode}
          error={settingsError}
          saved={settingsSaved}
          onSubmit={handleSubmitOpenAISettings}
          onRefresh={fetchOpenAISettings}
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

function PracticePage({
  state,
  data,
  error,
  language,
  onRefresh,
  onSubmitAttempt,
  t,
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [side, setSide] = useState("bull");
  const [confidence, setConfidence] = useState(3);
  const [rationale, setRationale] = useState("");
  const [attempt, setAttempt] = useState(null);
  const [submitState, setSubmitState] = useState("idle");
  const [submitError, setSubmitError] = useState("");
  const questions = data?.questions || [];
  const question = questions[currentIndex] || questions[0];

  useEffect(() => {
    setSide("bull");
    setConfidence(3);
    setRationale("");
    setAttempt(null);
    setSubmitError("");
    setSubmitState("idle");
  }, [question?.id]);

  if (state === "loading" && !data) {
    return (
      <section className="mx-auto max-w-6xl px-8 py-12">
        <div className="rounded-lg border border-amber-300/40 bg-amber-950/20 p-5 text-amber-100">
          {t.loadingPractice}
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

  if (!question) {
    return (
      <section className="mx-auto max-w-6xl px-8 py-12">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-zinc-400">
          {t.practiceNoQuestions}
        </div>
      </section>
    );
  }

  async function submitAttempt(event) {
    event.preventDefault();
    setSubmitState("saving");
    setSubmitError("");

    try {
      const result = await onSubmitAttempt({
        question_id: question.id,
        side,
        confidence,
        rationale,
        language,
      });
      setAttempt(result);
      setSubmitState("saved");
    } catch (practiceSubmitError) {
      setSubmitError(practiceSubmitError.message);
      setSubmitState("error");
    }
  }

  function goToNextQuestion() {
    setCurrentIndex((index) => (index + 1) % questions.length);
  }

  const stats = data?.stats;
  const recentAttempts = data?.recent_attempts || [];

  return (
    <section className="mx-auto max-w-6xl px-8 py-12">
      <div className="flex items-start justify-between gap-8">
        <div>
          <p className="text-sm uppercase text-amber-200">{t.practiceKicker}</p>
          <h1 className="mt-2 text-4xl font-semibold">{t.practiceTitle}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">{t.practiceSubtitle}</p>
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
        <div className="mt-8 grid grid-cols-5 gap-4">
          <StatBox label={t.practiceTotalAttempts} value={stats.total_attempts} />
          <StatBox label={t.practiceAccuracy} value={formatPercent(stats.accuracy_rate, t)} />
          <StatBox
            label={t.practiceHighConfidenceAccuracy}
            value={formatPercent(stats.high_confidence_accuracy_rate, t)}
          />
          <StatBox
            label={t.practiceLowConfidenceAccuracy}
            value={formatPercent(stats.low_confidence_accuracy_rate, t)}
          />
          <StatBox label={t.practiceMostCommonFocus} value={stats.most_common_focus || t.unavailable} />
        </div>
      ) : null}

      <div className="mt-8 grid grid-cols-[1.2fr_0.8fr] gap-8">
        <article className="rounded-lg border border-zinc-800 bg-zinc-900 p-7">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-sm uppercase text-zinc-400">
                {t.practiceQuestion} {currentIndex + 1}/{questions.length}
              </p>
              <h2 className="mt-2 text-3xl font-semibold">{question.ticker}: {question.title}</h2>
            </div>
            <div className="text-right text-sm text-zinc-400">
              <p>{question.horizon_days}D</p>
              <p>{formatPrice(question.price, question.currency, language)}</p>
            </div>
          </div>

          <p className="mt-6 text-sm leading-6 text-zinc-300">{question.scenario}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {question.focus_tags.map((tag) => (
              <span key={tag} className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400">
                {tag}
              </span>
            ))}
          </div>

          <div className="mt-7 grid grid-cols-2 gap-5">
            <PracticeClueList title={t.practiceBullClues} tone="bull" items={question.bull_points} />
            <PracticeClueList title={t.practiceBearClues} tone="bear" items={question.bear_points} />
          </div>

          <p className="mt-7 rounded border border-amber-300/30 bg-amber-950/20 p-4 text-sm text-amber-100">
            {question.prompt}
          </p>
        </article>

        <div className="space-y-6">
          <form className="rounded-lg border border-zinc-800 bg-zinc-900 p-6" onSubmit={submitAttempt}>
            <p className="text-sm uppercase text-amber-200">{t.practiceYourAnswer}</p>
            <div className="mt-5 grid grid-cols-3 gap-3">
              {[
                ["bull", t.bullSide],
                ["bear", t.bearSide],
                ["neutral", t.neutralSide],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSide(value)}
                  className={`rounded px-3 py-2 text-sm font-semibold transition ${
                    side === value
                      ? "bg-amber-300 text-zinc-950"
                      : "border border-zinc-700 text-zinc-300 hover:border-amber-300 hover:text-amber-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <label className="mt-6 block text-sm font-medium text-zinc-300" htmlFor="practice-confidence">
              {t.confidence} {confidence}
            </label>
            <input
              id="practice-confidence"
              type="range"
              min="1"
              max="5"
              value={confidence}
              onChange={(event) => setConfidence(Number(event.target.value))}
              className="mt-3 w-full accent-amber-300"
            />

            <label className="mt-6 block text-sm font-medium text-zinc-300" htmlFor="practice-rationale">
              {t.practiceRationaleLabel}
            </label>
            <textarea
              id="practice-rationale"
              value={rationale}
              onChange={(event) => setRationale(event.target.value)}
              placeholder={t.practiceRationalePlaceholder}
              className="mt-3 h-32 w-full resize-none rounded border border-zinc-700 bg-zinc-950 p-3 text-zinc-100 outline-none transition focus:border-amber-300"
            />

            {submitError ? (
              <div className="mt-5 rounded border border-red-400/40 bg-red-950/40 p-3 text-sm text-red-100">
                {submitError}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitState === "saving"}
              className="mt-6 h-12 rounded bg-amber-300 px-5 font-semibold text-zinc-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
            >
              {submitState === "saving" ? t.submittingPractice : t.submitPractice}
            </button>
          </form>

          {attempt ? (
            <PracticeFeedbackPanel attempt={attempt} onNext={goToNextQuestion} t={t} />
          ) : null}
        </div>
      </div>

      <div className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-xl font-semibold">{t.practiceRecent}</h2>
        {recentAttempts.length ? (
          <div className="mt-4 grid grid-cols-5 gap-3 text-sm">
            {recentAttempts.map((item) => (
              <div key={item.id} className="rounded border border-zinc-800 bg-zinc-950 p-3">
                <p className="font-semibold text-zinc-100">{item.ticker}</p>
                <p className={item.result === "correct" ? "mt-2 text-emerald-300" : "mt-2 text-red-300"}>
                  {item.result === "correct" ? t.practiceCorrect : t.practiceWrong}
                </p>
                <p className="mt-1 text-zinc-400">
                  {sideLabel(item.selected_side, t)} / {item.confidence}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-zinc-400">{t.practiceNoAttempts}</p>
        )}
      </div>
    </section>
  );
}

function PracticeClueList({ title, tone, items }) {
  const toneClass =
    tone === "bull"
      ? "border-emerald-400/30 bg-emerald-950/20"
      : "border-red-400/30 bg-red-950/20";

  return (
    <div className={`rounded border p-4 ${toneClass}`}>
      <h3 className="font-semibold text-zinc-100">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-300">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function PracticeFeedbackPanel({ attempt, onNext, t }) {
  const isCorrect = attempt.result === "correct";

  return (
    <div className={`rounded-lg border p-6 ${isCorrect ? "border-emerald-400/40 bg-emerald-950/20" : "border-red-400/40 bg-red-950/20"}`}>
      <p className="text-sm uppercase text-amber-200">{t.practiceFeedback}</p>
      <h3 className="mt-2 text-2xl font-semibold">
        {isCorrect ? t.practiceCorrect : t.practiceWrong}
      </h3>
      <p className="mt-4 text-sm leading-6 text-zinc-200">{attempt.feedback.summary}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-zinc-300">
        <div className="rounded border border-zinc-700 bg-zinc-950 p-3">
          <span className="text-zinc-500">{t.practiceAnswer}</span>
          <p className="mt-1 font-semibold text-zinc-100">{sideLabel(attempt.answer_side, t)}</p>
        </div>
        <div className="rounded border border-zinc-700 bg-zinc-950 p-3">
          <span className="text-zinc-500">{t.practiceOutcome}</span>
          <p className="mt-1 font-semibold text-zinc-100">{formatSignedPercent(attempt.outcome_pct)}</p>
        </div>
      </div>

      <FeedbackList title={t.practiceCauses} items={attempt.feedback.probable_causes} />
      <FeedbackList title={t.practiceSteps} items={attempt.feedback.improvement_steps} />

      <div className="mt-4 flex flex-wrap gap-2">
        {attempt.feedback.focus_tags.map((tag) => (
          <span key={tag} className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-400">
            {tag}
          </span>
        ))}
      </div>

      <button
        type="button"
        onClick={onNext}
        className="mt-6 h-11 rounded bg-amber-300 px-5 font-semibold text-zinc-950 transition hover:bg-amber-200"
      >
        {t.nextQuestion}
      </button>
    </div>
  );
}

function FeedbackList({ title, items }) {
  return (
    <div className="mt-5">
      <h4 className="text-sm font-semibold text-zinc-100">{title}</h4>
      <ul className="mt-2 space-y-2 text-sm leading-6 text-zinc-300">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function OpenAISettingsPage({
  state,
  settings,
  apiKey,
  setApiKey,
  model,
  setModel,
  keySource,
  setKeySource,
  debateMode,
  setDebateMode,
  error,
  saved,
  onSubmit,
  onRefresh,
  t,
}) {
  if (state === "loading" && !settings) {
    return (
      <section className="mx-auto max-w-4xl px-8 py-12">
        <div className="rounded-lg border border-amber-300/40 bg-amber-950/20 p-5 text-amber-100">
          {t.loadingSettings}
        </div>
      </section>
    );
  }

  const keyStatus = settings?.api_key_configured ? t.openaiSettingsConfigured : t.openaiSettingsMissing;
  const keyPreview = settings?.api_key_preview ? ` (${settings.api_key_preview})` : "";
  const modelOptions = settings?.available_models || [];
  const defaultKeyStatus = settings?.default_key_configured ? t.openaiSettingsConfigured : t.openaiSettingsMissing;
  const userKeyStatus = settings?.user_key_configured ? t.openaiSettingsConfigured : t.openaiSettingsMissing;

  return (
    <section className="mx-auto max-w-4xl px-8 py-12">
      <div className="flex items-start justify-between gap-8">
        <div>
          <p className="text-sm uppercase text-amber-200">{t.openaiSettingsKicker}</p>
          <h1 className="mt-2 text-4xl font-semibold">{t.openaiSettingsTitle}</h1>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="rounded border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-amber-300 hover:text-amber-200"
        >
          {t.refresh}
        </button>
      </div>

      <form className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900 p-7" onSubmit={onSubmit}>
        <div>
          <p className="text-sm font-medium text-zinc-300">{t.debateModeLabel}</p>
          <div className="mt-3 flex gap-3">
            {[
              ["api", t.apiMode],
              ["demo", t.demoMode],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setDebateMode(value)}
                className={`rounded px-4 py-2 font-semibold transition ${
                  debateMode === value
                    ? "bg-amber-300 text-zinc-950"
                    : "border border-zinc-700 text-zinc-300 hover:border-amber-300 hover:text-amber-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 rounded border border-zinc-700 bg-zinc-950 p-4 text-sm text-zinc-300">
          <span className="text-zinc-400">{t.openaiSettingsStatus}: </span>
          <span className={settings?.api_key_configured ? "text-emerald-300" : "text-amber-200"}>
            {keyStatus}{keyPreview}
          </span>
        </div>

        <div className="mt-6">
          <p className="text-sm font-medium text-zinc-300">{t.keySourceLabel}</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setKeySource("default")}
              className={`rounded border px-4 py-3 text-left transition ${
                keySource === "default"
                  ? "border-amber-300 bg-amber-950/30 text-amber-100"
                  : "border-zinc-700 text-zinc-300 hover:border-amber-300"
              }`}
            >
              <span className="block font-semibold">{t.defaultApiKey}</span>
              <span className="mt-1 block text-sm text-zinc-400">
                {t.openaiSettingsStatus}: {defaultKeyStatus}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setKeySource("user")}
              className={`rounded border px-4 py-3 text-left transition ${
                keySource === "user"
                  ? "border-amber-300 bg-amber-950/30 text-amber-100"
                  : "border-zinc-700 text-zinc-300 hover:border-amber-300"
              }`}
            >
              <span className="block font-semibold">{t.userApiKey}</span>
              <span className="mt-1 block text-sm text-zinc-400">
                {t.openaiSettingsStatus}: {userKeyStatus}
              </span>
            </button>
          </div>
        </div>

        <label className="mt-6 block text-sm font-medium text-zinc-300" htmlFor="openai-api-key">
          {t.openaiApiKeyLabel}
        </label>
        <input
          id="openai-api-key"
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          className="mt-3 h-12 w-full rounded border border-zinc-700 bg-zinc-950 px-4 text-zinc-100 outline-none transition focus:border-amber-300"
          placeholder={t.openaiApiKeyPlaceholder}
          autoComplete="off"
        />

        <label className="mt-6 block text-sm font-medium text-zinc-300" htmlFor="openai-model">
          {t.openaiModelLabel}
        </label>
        <input
          id="openai-model"
          list="openai-model-options"
          value={model}
          onChange={(event) => setModel(event.target.value)}
          className="mt-3 h-12 w-full rounded border border-zinc-700 bg-zinc-950 px-4 text-zinc-100 outline-none transition focus:border-amber-300"
          placeholder={t.openaiModelPlaceholder}
        />
        <datalist id="openai-model-options">
          {modelOptions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>

        <p className="mt-4 text-sm leading-6 text-zinc-400">{t.settingsSecurityNote}</p>

        {error ? (
          <div className="mt-6 rounded border border-red-400/40 bg-red-950/40 p-4 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        {saved ? (
          <div className="mt-6 rounded border border-emerald-400/40 bg-emerald-950/30 p-4 text-sm text-emerald-100">
            {t.settingsSaved}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={state === "saving"}
          className="mt-7 h-12 rounded bg-amber-300 px-5 font-semibold text-zinc-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
        >
          {state === "saving" ? t.settingsSaving : t.saveSettings}
        </button>
      </form>
    </section>
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

function formatSignedPercent(value) {
  return `${value > 0 ? "+" : ""}${Number(value).toFixed(1)}%`;
}

export default App;
