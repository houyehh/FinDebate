import { useEffect, useState } from "react";

import { dictionaries } from "./i18n";

const healthLabels = {
  checking: "checking",
  ok: "ok",
  error: "error",
};

const examples = ["NVDA", "2330.TW", "BTC-USD"];
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
const DEV_API_BASE_URLS = ["http://127.0.0.1:8030", "http://127.0.0.1:8020", "http://127.0.0.1:8000"];

function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

function practiceApiUrls(path) {
  const fallbackUrls = DEV_API_BASE_URLS.map((baseUrl) => `${baseUrl}${path}`);
  if (API_BASE_URL) {
    const configuredUrl = apiUrl(path);
    return [configuredUrl, ...fallbackUrls.filter((url) => url !== configuredUrl)];
  }

  return [path, ...fallbackUrls];
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

async function fetchPracticeApi(path, options = {}, fallbackMessage) {
  const urls = practiceApiUrls(path);
  let lastError = null;

  for (let index = 0; index < urls.length; index += 1) {
    const url = urls[index];
    let response;

    try {
      response = await fetch(url, options);
    } catch (error) {
      lastError = error;
      continue;
    }

    let data;
    try {
      data = await readApiResponse(response, fallbackMessage);
    } catch (error) {
      lastError = error;
      if (index < urls.length - 1) {
        continue;
      }
      throw error;
    }

    const retryableStatus = [404, 500, 502, 503, 504].includes(response.status);
    if (!response.ok && retryableStatus && index < urls.length - 1) {
      lastError = new Error(apiErrorMessage(data, fallbackMessage));
      continue;
    }

    return { response, data };
  }

  throw new Error(lastError?.message || fallbackMessage);
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
  const [tickerSuggestions, setTickerSuggestions] = useState([]);
  const [tickerSuggestionState, setTickerSuggestionState] = useState("idle");
  const [showTickerSuggestions, setShowTickerSuggestions] = useState(false);
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

  useEffect(() => {
    if (activePage !== "home") {
      return undefined;
    }

    const query = ticker.trim();
    if (query.length < 2) {
      setTickerSuggestions([]);
      setTickerSuggestionState("idle");
      return undefined;
    }

    const timer = window.setTimeout(() => {
      fetchTickerSuggestions(query);
    }, 180);

    return () => window.clearTimeout(timer);
  }, [ticker, activePage]);

  async function handleSubmit(event) {
    event.preventDefault();
    await lookupTicker(ticker);
  }

  async function lookupTicker(rawTicker) {
    const normalizedTicker = rawTicker.trim();
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
      setShowTickerSuggestions(false);
    } catch (lookupError) {
      setSnapshot(null);
      setDebate(null);
      resetVerdictState();
      setError(lookupError.message);
      setLookupState("error");
    }
  }

  async function fetchTickerSuggestions(query) {
    setTickerSuggestionState("loading");
    try {
      const response = await fetch(
        apiUrl(`/api/tickers/search?q=${encodeURIComponent(query)}&limit=8`),
      );
      const data = await readApiResponse(response, t.tickerNotFound);
      if (!response.ok) {
        throw new Error(apiErrorMessage(data, t.tickerNotFound));
      }
      setTickerSuggestions(Array.isArray(data) ? data : []);
      setTickerSuggestionState("ready");
    } catch {
      setTickerSuggestions([]);
      setTickerSuggestionState("error");
    }
  }

  function selectTickerSuggestion(candidate) {
    setTicker(candidate.ticker);
    setShowTickerSuggestions(false);
    lookupTicker(candidate.ticker);
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

  async function fetchPractice({ silent = false, refreshRandom = true } = {}) {
    if (!silent) {
      setPracticeState("loading");
    }
    setPracticeError("");

    try {
      const { response, data } = await fetchPracticeApi(
        `/api/practice?language=${encodeURIComponent(language)}&refresh_random=${refreshRandom}`,
        {},
        t.practiceFailed,
      );

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
    const { response, data } = await fetchPracticeApi(
      "/api/practice/attempts",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      t.practiceSubmitFailed,
    );

    if (!response.ok) {
      throw new Error(apiErrorMessage(data, t.practiceSubmitFailed));
    }

    await fetchPractice({ silent: true, refreshRandom: false });
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
            <button
              type="button"
              onClick={() => setActivePage("settings")}
              className={`rounded border px-3 py-1 text-sm transition ${
                activePage === "settings"
                  ? "border-amber-300 bg-amber-950/30 text-amber-100"
                  : "border-amber-400/40 text-amber-200 hover:border-amber-300 hover:bg-amber-950/20"
              }`}
              title={t.apiStatusButtonTitle}
            >
              API: {healthLabels[health]}
            </button>
          </div>
        </div>
      </nav>

      {activePage === "home" ? (
        <>
      <section className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-8 py-12">
        <div className="min-w-0 rounded-lg border border-zinc-800 bg-zinc-900 p-7">
          <p className="text-sm uppercase text-amber-200">{t.tickerLookup}</p>
          <h1 className="mt-3 text-4xl font-semibold">{t.appTitle}</h1>
          <p className="mt-4 text-sm leading-6 text-zinc-400">{t.homeSubtitle}</p>

          <div className="mt-6 rounded border border-zinc-800 bg-zinc-950 p-4">
            <p className="text-xs uppercase text-zinc-500">{t.trainingLoopTitle}</p>
            <div className="mt-3 grid grid-cols-5 gap-2 text-center text-xs text-zinc-300">
              {t.trainingLoopSteps.map((step, index) => (
                <div key={step} className="rounded border border-zinc-800 bg-zinc-900 px-2 py-2">
                  <span className="mr-1 text-amber-200">{index + 1}</span>
                  {step}
                </div>
              ))}
            </div>
          </div>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <label className="block text-sm font-medium text-zinc-300" htmlFor="ticker-input">
              {t.tickerLabel}
            </label>
            <div className="relative flex gap-3">
              <input
                id="ticker-input"
                value={ticker}
                onChange={(event) => {
                  setTicker(event.target.value);
                  setShowTickerSuggestions(true);
                }}
                onFocus={() => setShowTickerSuggestions(true)}
                className="h-12 min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-950 px-4 text-lg font-semibold text-zinc-100 outline-none ring-0 transition focus:border-emerald-300"
                placeholder={t.tickerSearchPlaceholder}
              />
              <button
                type="submit"
                disabled={lookupState === "loading"}
                className="h-12 rounded bg-emerald-400 px-5 font-semibold text-zinc-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
              >
                {lookupState === "loading" ? t.searching : t.search}
              </button>
              {showTickerSuggestions && ticker.trim().length >= 2 ? (
                <div className="absolute left-0 top-14 z-20 w-[calc(100%-6.25rem)] overflow-hidden rounded border border-zinc-700 bg-zinc-950 shadow-xl">
                  <div className="border-b border-zinc-800 px-3 py-2 text-xs uppercase text-zinc-500">
                    {t.tickerSuggestions}
                  </div>
                  {tickerSuggestions.length ? (
                    <div className="max-h-72 overflow-auto">
                      {tickerSuggestions.map((candidate) => (
                        <button
                          key={candidate.ticker}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => selectTickerSuggestion(candidate)}
                          className="flex w-full items-center justify-between gap-4 border-b border-zinc-900 px-3 py-3 text-left transition last:border-b-0 hover:bg-zinc-900"
                        >
                          <span>
                            <span className="block font-semibold text-zinc-100">{candidate.ticker}</span>
                            <span className="block text-xs text-zinc-400">{candidate.name}</span>
                          </span>
                          <span className="text-xs text-zinc-500">
                            {candidate.exchange || candidate.asset_type} · {candidate.currency}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-3 py-4 text-sm text-zinc-500">
                      {tickerSuggestionState === "loading" ? t.searching : t.tickerNoSuggestions}
                    </div>
                  )}
                </div>
              ) : null}
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
  const [weights, setWeights] = useState({
    technical: 45,
    fundamental: 25,
    chip: 0,
    ai: 30,
  });
  const [attempt, setAttempt] = useState(null);
  const [submitState, setSubmitState] = useState("idle");
  const [submitError, setSubmitError] = useState("");
  const questions = data?.questions || [];
  const question = questions[currentIndex] || questions[0];

  useEffect(() => {
    setSide("bull");
    setConfidence(3);
    setRationale("");
    setWeights({ technical: 45, fundamental: 25, chip: 0, ai: 30 });
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
        weights: { ...weights, chip: 0 },
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

  function refreshQuestions() {
    setCurrentIndex(0);
    onRefresh();
  }

  const stats = data?.stats;
  const recentAttempts = data?.recent_attempts || [];
  const weightTotal = weights.technical + weights.fundamental + weights.ai;
  const latestPoint = question.market_window?.[question.market_window.length - 1];
  const answerSectionId = "practice-answer";

  function goToAnswer() {
    document.getElementById(answerSectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section className="mx-auto max-w-7xl px-8 py-12">
      <div className="flex items-start justify-between gap-8">
        <div>
          <p className="text-sm uppercase text-amber-200">{t.practiceKicker}</p>
          <h1 className="mt-2 text-4xl font-semibold">{t.practiceTitle}</h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-zinc-400">{t.practiceSubtitle}</p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={refreshQuestions}
            className="rounded border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-amber-300 hover:text-amber-200 whitespace-nowrap"
          >
            {t.randomPractice}
          </button>
          <button
            type="button"
            onClick={goToAnswer}
            className="rounded bg-amber-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-200 whitespace-nowrap"
          >
            {t.practiceAnswerCta}
          </button>
        </div>
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
          <StatBox label={t.aiAlignmentRate} value={formatPercent(stats.ai_alignment_rate, t)} />
          <StatBox label={t.aiAlignedAccuracy} value={formatPercent(stats.ai_aligned_accuracy_rate, t)} />
          <StatBox label={t.aiUnalignedAccuracy} value={formatPercent(stats.ai_unaligned_accuracy_rate, t)} />
          <StatBox label={t.highTechnicalWeightAccuracy} value={formatPercent(stats.high_technical_weight_accuracy_rate, t)} />
          <StatBox label={t.highAiWeightAccuracy} value={formatPercent(stats.high_ai_weight_accuracy_rate, t)} />
        </div>
      ) : null}

      <article className="mt-8 border-y border-zinc-800 py-7">
        <div className="grid grid-cols-[1fr_280px] gap-8">
          <div>
            <p className="text-sm uppercase text-zinc-400">
              {t.practiceQuestion} {currentIndex + 1}/{questions.length}
            </p>
            <h2 className="mt-2 text-3xl font-semibold leading-tight">{question.ticker}: {question.title}</h2>
            <p className="mt-5 max-w-4xl text-sm leading-6 text-zinc-300">{question.scenario}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="border border-zinc-800 bg-zinc-950 p-3">
              <p className="text-xs text-zinc-500">{t.dataCutoff}</p>
              <p className="mt-1 font-semibold text-zinc-100">{question.as_of}</p>
            </div>
            <div className="border border-zinc-800 bg-zinc-950 p-3">
              <p className="text-xs text-zinc-500">{t.practiceHorizon}</p>
              <p className="mt-1 font-semibold text-zinc-100">{question.horizon_days}D</p>
            </div>
            <div className="col-span-2 border border-zinc-800 bg-zinc-950 p-3">
              <p className="text-xs text-zinc-500">{t.practiceAsOfPrice}</p>
              <p className="mt-1 text-xl font-semibold text-zinc-100">
                {formatPrice(question.price, question.currency, language)}
              </p>
            </div>
          </div>
        </div>

        {question.training_goal ? (
          <div className="mt-6 border border-amber-300/30 bg-amber-950/20 p-4 text-sm leading-6 text-amber-100">
            <span className="font-semibold">{t.trainingGoal}: </span>
            {question.training_goal}
          </div>
        ) : null}

        <div className="mt-5 flex items-start justify-between gap-6">
          <div>
            {question.data_cutoff_note ? (
              <p className="text-xs leading-5 text-zinc-500">{question.data_cutoff_note}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {question.focus_tags.map((tag) => (
                <span key={tag} className="border border-zinc-700 px-2 py-1 text-xs text-zinc-400">
                  {tag}
                </span>
              ))}
            </div>
          </div>
          {latestPoint ? (
            <p className="shrink-0 text-right text-xs leading-5 text-zinc-500">
              {t.practiceLatestVisibleClose}<br />
              <span className="text-zinc-200">{latestPoint.close.toFixed(2)}</span>
            </p>
          ) : null}
        </div>

      </article>

      {question.market_window?.length ? (
        <section className="mt-8">
          <div className="mb-4 flex items-end justify-between gap-6">
            <div>
              <h2 className="text-2xl font-semibold">{t.technicalChartTitle}</h2>
              <p className="mt-2 text-sm text-zinc-400">{t.practiceChartLead}</p>
            </div>
          </div>
          <MarketIndicatorChart points={question.market_window} t={t} />
        </section>
      ) : null}

      <section className="mt-8">
        <div className="flex items-end justify-between gap-6">
          <div>
            <h2 className="text-2xl font-semibold">{t.practiceDimensionReview}</h2>
            <p className="mt-2 text-sm text-zinc-400">{t.practiceDimensionLead}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-4">
          <MetricPanel title={t.fundamentalDimension} metrics={question.fundamental_snapshot || []} />
          <MetricPanel title={t.newsDimension} metrics={question.news_snapshot || []} />
          <AiSnapshotPanel snapshot={question.ai_snapshot} t={t} />
        </div>
      </section>

      <section className="mt-8">
        <div className="grid grid-cols-2 gap-5">
          <PracticeClueList title={t.practiceBullClues} tone="bull" items={question.bull_points} />
          <PracticeClueList title={t.practiceBearClues} tone="bear" items={question.bear_points} />
        </div>

        <p className="mt-6 border border-amber-300/30 bg-amber-950/20 p-4 text-sm text-amber-100">
          {question.prompt}
        </p>
      </section>

      <section id={answerSectionId} className="mt-10 border-t border-zinc-800 pt-8">
        <div className="grid grid-cols-[0.75fr_1.25fr] gap-8">
          <div>
            <p className="text-sm uppercase text-amber-200">{t.practiceYourAnswer}</p>
            <h2 className="mt-2 text-3xl font-semibold">{t.answerAfterReview}</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-400">{t.practiceReadFirst}</p>
          </div>

          <form className="border border-zinc-800 bg-zinc-900 p-6" onSubmit={submitAttempt}>
            <div className="grid grid-cols-3 gap-3">
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

            <div className="mt-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-zinc-300">{t.judgmentWeights}</p>
                <p className={weightTotal === 100 ? "text-sm text-emerald-300" : "text-sm text-red-300"}>
                  {t.weightTotal}: {weightTotal}%
                </p>
              </div>
              <p className="mt-1 text-xs text-zinc-500">{t.weightTotalHint}</p>
              <div className="mt-4 grid grid-cols-3 gap-4">
                {[
                  ["technical", t.technicalDimension],
                  ["fundamental", t.fundamentalDimension],
                  ["ai", t.aiDimension],
                ].map(([key, label]) => (
                  <label key={key} className="block text-xs text-zinc-400">
                    <div className="mb-2 flex justify-between">
                      <span>{label}</span>
                      <span>{weights[key]}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={weights[key]}
                      onChange={(event) =>
                        setWeights((current) => ({
                          ...current,
                          chip: 0,
                          [key]: Number(event.target.value),
                        }))
                      }
                      className="w-full accent-amber-300"
                    />
                  </label>
                ))}
              </div>
            </div>

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
              <div className="mt-5 border border-red-400/40 bg-red-950/40 p-3 text-sm text-red-100">
                {submitError}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitState === "saving" || weightTotal !== 100}
              className="mt-6 h-12 rounded bg-amber-300 px-5 font-semibold text-zinc-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
            >
              {submitState === "saving" ? t.submittingPractice : t.submitPractice}
            </button>
          </form>
        </div>

        {attempt ? (
          <div className="mt-8">
            <PracticeFeedbackPanel attempt={attempt} onNext={goToNextQuestion} t={t} />
          </div>
        ) : null}
      </section>

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

function MetricPanel({ title, metrics }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-950 p-4">
      <h3 className="font-semibold text-zinc-100">{title}</h3>
      {metrics.length ? (
        <div className="mt-3 space-y-2">
          {metrics.map((metric) => (
            <div key={`${title}-${metric.label}`} className="rounded border border-zinc-800 bg-zinc-900 p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs text-zinc-500">{metric.label}</p>
                <span className={`text-xs font-semibold ${metricToneClass(metric.tone)}`}>
                  {metric.value}
                </span>
              </div>
              {metric.detail ? <p className="mt-2 text-xs leading-5 text-zinc-400">{metric.detail}</p> : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-zinc-500">No data</p>
      )}
    </div>
  );
}

function AiSnapshotPanel({ snapshot, t }) {
  if (!snapshot) {
    return <MetricPanel title={t.aiDimension} metrics={[]} />;
  }

  return (
    <div className="rounded border border-amber-300/30 bg-amber-950/10 p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-zinc-100">{t.aiDimension}</h3>
        <div className="text-right text-xs text-amber-200">
          <p>{t.aiSuggestedSide}: {sideLabel(snapshot.suggested_side, t)}</p>
          <p>{t.aiConfidence}: {snapshot.confidence}/5</p>
        </div>
      </div>
      <div className="mt-3 space-y-3 text-xs leading-5 text-zinc-300">
        <p>
          <span className="font-semibold text-emerald-300">{t.aiBullThesis}: </span>
          {snapshot.bull_thesis}
        </p>
        <p>
          <span className="font-semibold text-red-300">{t.aiBearThesis}: </span>
          {snapshot.bear_thesis}
        </p>
        <p>
          <span className="font-semibold text-zinc-100">{t.aiNarrative}: </span>
          {snapshot.narrative}
        </p>
        <p>
          <span className="font-semibold text-zinc-100">{t.aiUncertainty}: </span>
          {snapshot.key_uncertainty}
        </p>
      </div>
      {snapshot.checklist?.length ? (
        <ul className="mt-3 space-y-1 text-xs leading-5 text-zinc-400">
          {snapshot.checklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function metricToneClass(tone) {
  if (tone === "bull") {
    return "text-emerald-300";
  }
  if (tone === "bear") {
    return "text-red-300";
  }
  if (tone === "warn") {
    return "text-amber-300";
  }
  return "text-zinc-300";
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
        <div className="rounded border border-zinc-700 bg-zinc-950 p-3">
          <span className="text-zinc-500">{t.aiComparison}</span>
          <p className="mt-1 font-semibold text-zinc-100">
            {attempt.ai_agreement ? t.aiAligned : t.aiDifferent}
          </p>
        </div>
        <div className="rounded border border-zinc-700 bg-zinc-950 p-3">
          <span className="text-zinc-500">{t.judgmentWeights}</span>
          <p className="mt-1 text-xs leading-5 text-zinc-300">
            {t.technicalDimension} {attempt.weights.technical}% · {t.fundamentalDimension} {attempt.weights.fundamental}% · {t.aiDimension} {attempt.weights.ai}%
            {attempt.weights.chip ? ` · ${t.priceVolumeProxy} ${attempt.weights.chip}%` : ""}
          </p>
        </div>
      </div>

      {attempt.future_results?.length ? (
        <div className="mt-4 rounded border border-zinc-700 bg-zinc-950 p-3">
          <p className="text-sm font-semibold text-zinc-100">{t.futureResults}</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-zinc-300">
            {attempt.future_results.map((item) => (
              <div key={item.horizon_days} className="rounded border border-zinc-800 bg-zinc-900 p-2">
                <p className="text-zinc-500">{item.horizon_days}D · {item.settle_date}</p>
                <p className="mt-1 font-semibold text-zinc-100">
                  {item.settle_price.toFixed(2)} ({formatSignedPercent(item.pct_change)})
                </p>
                <p className="mt-1 text-zinc-400">{sideLabel(item.result_side, t)}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <FeedbackList title={t.practiceCauses} items={attempt.feedback.probable_causes} />
      <FeedbackList title={t.practiceSteps} items={attempt.feedback.improvement_steps} />
      <FeedbackList title={t.missedSignals} items={attempt.feedback.missed_signals || []} />
      <FeedbackList title={t.goodReasoning} items={attempt.feedback.good_reasoning || []} />

      {attempt.feedback.next_drill_focus || attempt.feedback.suggested_framework ? (
        <div className="mt-5 rounded border border-zinc-700 bg-zinc-950 p-4 text-sm leading-6 text-zinc-300">
          {attempt.feedback.next_drill_focus ? (
            <p>
              <span className="font-semibold text-zinc-100">{t.nextDrillFocus}: </span>
              {attempt.feedback.next_drill_focus}
            </p>
          ) : null}
          {attempt.feedback.suggested_framework ? (
            <p className="mt-2">
              <span className="font-semibold text-zinc-100">{t.suggestedFramework}: </span>
              {attempt.feedback.suggested_framework}
            </p>
          ) : null}
        </div>
      ) : null}

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
  if (!items?.length) {
    return null;
  }

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

function MarketIndicatorChart({ points, t }) {
  if (!points?.length) {
    return null;
  }

  const [visibleSeries, setVisibleSeries] = useState({
    ma5: true,
    ma10: true,
    ma20: true,
    bollinger: true,
    volumeAverage: true,
    kd: true,
    macd: true,
  });
  const [hoverIndex, setHoverIndex] = useState(null);
  const chartPoints = enrichIndicatorPoints(points);
  const width = 1120;
  const height = 660;
  const left = 68;
  const right = 24;
  const top = 32;
  const panelGap = 18;
  const priceHeight = 310;
  const volumeHeight = 82;
  const kdHeight = 80;
  const macdHeight = 88;
  const innerWidth = width - left - right;
  const priceTop = top;
  const volumeTop = priceTop + priceHeight + panelGap;
  const kdTop = volumeTop + volumeHeight + panelGap;
  const macdTop = kdTop + kdHeight + panelGap;
  const xStep = innerWidth / Math.max(chartPoints.length - 1, 1);
  const candleWidth = Math.max(4, Math.min(14, xStep * 0.55));
  const priceValues = chartPoints
    .flatMap((point) => [point.high, point.low, point.ma5, point.ma10, point.ma20, point.bb_upper, point.bb_lower])
    .filter((value) => value != null && !Number.isNaN(Number(value)));
  const rawMaxPrice = Math.max(...priceValues);
  const rawMinPrice = Math.min(...priceValues);
  const rawPriceSpan = rawMaxPrice - rawMinPrice || 1;
  const maxPrice = rawMaxPrice + rawPriceSpan * 0.04;
  const minPrice = rawMinPrice - rawPriceSpan * 0.04;
  const priceSpan = maxPrice - minPrice || 1;
  const maxVolume = Math.max(...chartPoints.flatMap((point) => [point.volume, point.volume_ma20 || 0]), 1);
  const macdAbs = Math.max(
    ...chartPoints.flatMap((point) => [
      Math.abs(point.macd || 0),
      Math.abs(point.macd_signal || 0),
      Math.abs(point.macd_hist || 0),
    ]),
    0.1,
  );

  const xAt = (index) => left + index * xStep;
  const yPrice = (value) => priceTop + priceHeight - ((value - minPrice) / priceSpan) * priceHeight;
  const yVolume = (value) => volumeTop + volumeHeight - (value / maxVolume) * volumeHeight;
  const yKD = (value) => kdTop + kdHeight - (value / 100) * kdHeight;
  const yMacd = (value) => macdTop + macdHeight / 2 - (value / macdAbs) * (macdHeight / 2);
  const ma5Path = linePath(chartPoints, (point) => point.ma5, xAt, yPrice);
  const ma10Path = linePath(chartPoints, (point) => point.ma10, xAt, yPrice);
  const ma20Path = linePath(chartPoints, (point) => point.ma20, xAt, yPrice);
  const bbUpperPath = linePath(chartPoints, (point) => point.bb_upper, xAt, yPrice);
  const bbLowerPath = linePath(chartPoints, (point) => point.bb_lower, xAt, yPrice);
  const bbArea = bandAreaPath(chartPoints, (point) => point.bb_upper, (point) => point.bb_lower, xAt, yPrice);
  const volumeMA20Path = linePath(chartPoints, (point) => point.volume_ma20, xAt, yVolume);
  const kPath = linePath(chartPoints, (point) => point.k, xAt, yKD);
  const dPath = linePath(chartPoints, (point) => point.d, xAt, yKD);
  const macdPath = linePath(chartPoints, (point) => point.macd, xAt, yMacd);
  const signalPath = linePath(chartPoints, (point) => point.macd_signal, xAt, yMacd);
  const firstDate = chartPoints[0].date;
  const lastDate = chartPoints[chartPoints.length - 1].date;
  const activeIndex = Math.min(Math.max(hoverIndex ?? chartPoints.length - 1, 0), chartPoints.length - 1);
  const activePoint = chartPoints[activeIndex];
  const activeX = xAt(activeIndex);
  const indicatorToggles = [
    ["ma5", "MA5"],
    ["ma10", "MA10"],
    ["ma20", "MA20"],
    ["bollinger", t.chartBollingerBands],
    ["volumeAverage", t.chartVolumeAverage],
    ["kd", "KD"],
    ["macd", "MACD"],
  ];

  function toggleSeries(key) {
    setVisibleSeries((current) => ({ ...current, [key]: !current[key] }));
  }

  function handlePointerMove(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const svgX = ((event.clientX - rect.left) / rect.width) * width;
    const nextIndex = Math.round((svgX - left) / xStep);
    setHoverIndex(Math.min(Math.max(nextIndex, 0), chartPoints.length - 1));
  }

  return (
    <div className="rounded border border-zinc-800 bg-zinc-950 p-5">
      <div className="mb-4 flex items-start justify-between gap-6">
        <div>
          <p className="text-sm font-semibold text-zinc-100">{t.chartPriceSystem}</p>
          <p className="mt-1 text-xs text-zinc-500">{firstDate} → {lastDate}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-x-4 gap-y-2 text-xs text-zinc-400">
          <ChartLegendItem color="bg-emerald-300" label={t.chartCandles} />
          <ChartLegendItem color="bg-amber-300" label="MA5" />
          <ChartLegendItem color="bg-cyan-300" label="MA10" />
          <ChartLegendItem color="bg-sky-300" label="MA20" />
          <ChartLegendItem color="bg-violet-300" label={t.chartBollingerBands} />
          <ChartLegendItem color="bg-zinc-400" label={t.chartVolumeAverage} />
        </div>
      </div>
      <div className="mb-4 flex flex-wrap gap-3 border border-zinc-800 bg-zinc-900/60 p-3 text-xs text-zinc-300">
        {indicatorToggles.map(([key, label]) => (
          <label key={key} className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={visibleSeries[key]}
              onChange={() => toggleSeries(key)}
              className="accent-amber-300"
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
      <svg
        className="h-[660px] w-full"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={t.technicalChartTitle}
        onMouseMove={handlePointerMove}
        onFocus={() => setHoverIndex(activeIndex)}
      >
        <ChartPanelLabel x="12" y={priceTop + 16} label="PRICE" />
        <ChartPanelLabel x="12" y={volumeTop + 16} label="VOL" />
        <ChartPanelLabel x="12" y={kdTop + 16} label="KD" />
        <ChartPanelLabel x="12" y={macdTop + 16} label="MACD" />

        {[priceTop, priceTop + priceHeight / 2, priceTop + priceHeight, volumeTop, kdTop, macdTop].map((panelTop) => (
          <line
            key={panelTop}
            x1={left}
            x2={width - right}
            y1={panelTop}
            y2={panelTop}
            className="stroke-zinc-800"
          />
        ))}
        <line x1={left} x2={width - right} y1={volumeTop + volumeHeight} y2={volumeTop + volumeHeight} className="stroke-zinc-800" />
        <line x1={left} x2={width - right} y1={kdTop + kdHeight} y2={kdTop + kdHeight} className="stroke-zinc-800" />
        <line x1={left} x2={width - right} y1={macdTop + macdHeight / 2} y2={macdTop + macdHeight / 2} className="stroke-zinc-700" />
        <line x1={left} x2={width - right} y1={yKD(80)} y2={yKD(80)} className="stroke-zinc-700" strokeDasharray="4 6" />
        <line x1={left} x2={width - right} y1={yKD(20)} y2={yKD(20)} className="stroke-zinc-700" strokeDasharray="4 6" />

        <text x={left} y={priceTop + 14} className="fill-zinc-500 text-[11px]">
          {maxPrice.toFixed(2)}
        </text>
        <text x={left} y={priceTop + priceHeight - 7} className="fill-zinc-500 text-[11px]">
          {minPrice.toFixed(2)}
        </text>
        <text x={left} y={volumeTop + 14} className="fill-zinc-500 text-[11px]">
          {formatCompactVolume(maxVolume)}
        </text>
        <text x={left} y={kdTop + 14} className="fill-zinc-500 text-[11px]">100</text>
        <text x={left} y={kdTop + kdHeight - 6} className="fill-zinc-500 text-[11px]">0</text>

        {visibleSeries.bollinger && bbArea ? <path d={bbArea} fill="rgba(167, 139, 250, 0.12)" stroke="none" /> : null}
        {visibleSeries.bollinger && bbUpperPath ? <path d={bbUpperPath} fill="none" stroke="#a78bfa" strokeWidth="1.4" strokeDasharray="6 6" /> : null}
        {visibleSeries.bollinger && bbLowerPath ? <path d={bbLowerPath} fill="none" stroke="#a78bfa" strokeWidth="1.4" strokeDasharray="6 6" /> : null}

        {chartPoints.map((point, index) => {
          const x = xAt(index);
          const up = point.close >= point.open;
          const candleTop = yPrice(Math.max(point.open, point.close));
          const candleBottom = yPrice(Math.min(point.open, point.close));
          const candleHeight = Math.max(candleBottom - candleTop, 2);
          return (
            <g key={`${point.date}-${index}`}>
              <line
                x1={x}
                x2={x}
                y1={yPrice(point.high)}
                y2={yPrice(point.low)}
                className={up ? "stroke-emerald-300" : "stroke-red-300"}
                strokeWidth="1.4"
              />
              <rect
                x={x - candleWidth / 2}
                y={candleTop}
                width={candleWidth}
                height={candleHeight}
                rx="1"
                className={up ? "fill-emerald-300" : "fill-red-300"}
              />
              <rect
                x={x - candleWidth / 2}
                y={yVolume(point.volume)}
                width={candleWidth}
                height={volumeTop + volumeHeight - yVolume(point.volume)}
                className={up ? "fill-emerald-500/45" : "fill-red-500/45"}
              />
              {visibleSeries.macd ? (
                <rect
                  x={x - candleWidth / 2}
                  y={point.macd_hist >= 0 ? yMacd(point.macd_hist) : yMacd(0)}
                  width={candleWidth}
                  height={Math.max(Math.abs(yMacd(point.macd_hist || 0) - yMacd(0)), 1)}
                  className={point.macd_hist >= 0 ? "fill-emerald-400/50" : "fill-red-400/50"}
                />
              ) : null}
            </g>
          );
        })}

        {visibleSeries.ma5 && ma5Path ? <path d={ma5Path} fill="none" className="stroke-amber-300" strokeWidth="2.2" /> : null}
        {visibleSeries.ma10 && ma10Path ? <path d={ma10Path} fill="none" className="stroke-cyan-300" strokeWidth="2.2" /> : null}
        {visibleSeries.ma20 && ma20Path ? <path d={ma20Path} fill="none" className="stroke-sky-300" strokeWidth="2.2" /> : null}
        {visibleSeries.volumeAverage && volumeMA20Path ? <path d={volumeMA20Path} fill="none" className="stroke-zinc-400" strokeWidth="1.8" /> : null}
        {visibleSeries.kd && kPath ? <path d={kPath} fill="none" className="stroke-amber-300" strokeWidth="2" /> : null}
        {visibleSeries.kd && dPath ? <path d={dPath} fill="none" className="stroke-sky-300" strokeWidth="2" /> : null}
        {visibleSeries.macd && macdPath ? <path d={macdPath} fill="none" className="stroke-emerald-300" strokeWidth="2" /> : null}
        {visibleSeries.macd && signalPath ? <path d={signalPath} fill="none" className="stroke-red-300" strokeWidth="2" /> : null}

        <line x1={activeX} x2={activeX} y1={priceTop} y2={macdTop + macdHeight} className="stroke-amber-200/50" strokeDasharray="4 6" />
        <circle cx={activeX} cy={yPrice(activePoint.close)} r="4" className="fill-amber-200" />
        <ChartHoverTooltip
          point={activePoint}
          x={activeX > width - 280 ? activeX - 260 : activeX + 14}
          y={priceTop + 16}
          t={t}
        />

        <text x={left} y={height - 5} className="fill-zinc-500 text-[11px]">
          {firstDate}
        </text>
        <text x={width - right - 82} y={height - 5} className="fill-zinc-500 text-[11px]">
          {lastDate}
        </text>
        <text x={width - right - 155} y={priceTop + 14} className="fill-amber-300 text-[11px]">MA5</text>
        <text x={width - right - 120} y={priceTop + 14} className="fill-cyan-300 text-[11px]">MA10</text>
        <text x={width - right - 76} y={priceTop + 14} className="fill-sky-300 text-[11px]">MA20</text>
        <text x={width - right - 32} y={priceTop + 14} className="fill-violet-300 text-[11px]">BB</text>
        <text x={width - right - 145} y={kdTop + 14} className="fill-amber-300 text-[11px]">K</text>
        <text x={width - right - 125} y={kdTop + 14} className="fill-sky-300 text-[11px]">D</text>
        <text x={width - right - 145} y={macdTop + 14} className="fill-emerald-300 text-[11px]">DIF</text>
        <text x={width - right - 105} y={macdTop + 14} className="fill-red-300 text-[11px]">Signal</text>
      </svg>
    </div>
  );
}

function ChartHoverTooltip({ point, x, y, t }) {
  const rows = [
    [t.chartOpen, formatTooltipNumber(point.open)],
    [t.chartHigh, formatTooltipNumber(point.high)],
    [t.chartLow, formatTooltipNumber(point.low)],
    [t.chartClose, formatTooltipNumber(point.close)],
    [t.chartVolume, formatCompactVolume(point.volume)],
    ["MA5", formatTooltipNumber(point.ma5)],
    ["MA10", formatTooltipNumber(point.ma10)],
    ["MA20", formatTooltipNumber(point.ma20)],
    ["BB", `${formatTooltipNumber(point.bb_upper)} / ${formatTooltipNumber(point.bb_lower)}`],
    ["RSI", formatTooltipNumber(point.rsi, 1)],
    ["KD", `${formatTooltipNumber(point.k, 1)} / ${formatTooltipNumber(point.d, 1)}`],
    ["MACD", `${formatTooltipNumber(point.macd, 3)} / ${formatTooltipNumber(point.macd_signal, 3)} / ${formatTooltipNumber(point.macd_hist, 3)}`],
  ];
  const rowHeight = 17;
  const tooltipWidth = 242;
  const tooltipHeight = 34 + rows.length * rowHeight;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={tooltipWidth}
        height={tooltipHeight}
        rx="4"
        className="fill-zinc-950 stroke-amber-300/60"
      />
      <text x={x + 12} y={y + 18} className="fill-amber-200 text-[12px] font-semibold">
        {point.date}
      </text>
      {rows.map(([label, value], index) => (
        <g key={label}>
          <text x={x + 12} y={y + 38 + index * rowHeight} className="fill-zinc-500 text-[11px]">
            {label}
          </text>
          <text x={x + 105} y={y + 38 + index * rowHeight} className="fill-zinc-100 text-[11px]">
            {value}
          </text>
        </g>
      ))}
    </g>
  );
}

function ChartLegendItem({ color, label }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-2 w-6 ${color}`} />
      {label}
    </span>
  );
}

function enrichIndicatorPoints(points) {
  const closes = points.map((point) => Number(point.close));
  return points.map((point, index) => {
    const closeWindow5 = closes.slice(Math.max(0, index - 4), index + 1);
    const closeWindow10 = closes.slice(Math.max(0, index - 9), index + 1);
    const closeWindow20 = closes.slice(Math.max(0, index - 19), index + 1);
    const ma5 = point.ma5 ?? average(closeWindow5);
    const ma10 = point.ma10 ?? average(closeWindow10);
    const ma20 = point.ma20 ?? average(closeWindow20);
    const std20 = stddev(closeWindow20);

    return {
      ...point,
      ma5,
      ma10,
      ma20,
      bb_middle: point.bb_middle ?? ma20,
      bb_upper: point.bb_upper ?? ma20 + std20 * 2,
      bb_lower: point.bb_lower ?? ma20 - std20 * 2,
      volume_ma20: point.volume_ma20 ?? average(points.slice(Math.max(0, index - 19), index + 1).map((item) => Number(item.volume))),
    };
  });
}

function average(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((total, value) => total + Number(value || 0), 0) / values.length;
}

function stddev(values) {
  if (!values.length) {
    return 0;
  }
  const mean = average(values);
  return Math.sqrt(values.reduce((total, value) => total + (Number(value) - mean) ** 2, 0) / values.length);
}

function bandAreaPath(points, upperAccessor, lowerAccessor, xAt, yAt) {
  const upper = points
    .map((point, index) => {
      const value = upperAccessor(point);
      return value == null ? null : [xAt(index), yAt(Number(value))];
    })
    .filter(Boolean);
  const lower = points
    .map((point, index) => {
      const value = lowerAccessor(point);
      return value == null ? null : [xAt(index), yAt(Number(value))];
    })
    .filter(Boolean);

  if (!upper.length || upper.length !== lower.length) {
    return "";
  }

  const upperPath = upper.map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`);
  const lowerPath = lower
    .slice()
    .reverse()
    .map(([x, y]) => `L ${x.toFixed(2)} ${y.toFixed(2)}`);

  return `${upperPath.join(" ")} ${lowerPath.join(" ")} Z`;
}

function ChartPanelLabel({ x, y, label }) {
  return (
    <text x={x} y={y} className="fill-zinc-500 text-[11px] font-semibold">
      {label}
    </text>
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

function formatCompactVolume(value) {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return String(Math.round(value));
}

function formatTooltipNumber(value, digits = 2) {
  if (value == null || Number.isNaN(Number(value))) {
    return "N/A";
  }
  return Number(value).toFixed(digits);
}

function linePath(points, accessor, xAt, yAt) {
  return points
    .map((point, index) => {
      const value = accessor(point);
      if (value == null || Number.isNaN(Number(value))) {
        return "";
      }
      return `${index === 0 ? "M" : "L"} ${xAt(index).toFixed(2)} ${yAt(Number(value)).toFixed(2)}`;
    })
    .filter(Boolean)
    .join(" ");
}

export default App;
