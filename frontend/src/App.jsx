import { Fragment, useEffect, useState } from "react";

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

function fallbackApiUrls(path) {
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

async function fetchApiWithFallback(path, options = {}, fallbackMessage) {
  const urls = fallbackApiUrls(path);
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
      if (response.ok && index < urls.length - 1) {
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

async function fetchPracticeApi(path, options = {}, fallbackMessage) {
  return fetchApiWithFallback(path, options, fallbackMessage);
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
  const [liveAnalysis, setLiveAnalysis] = useState(null);
  const [liveState, setLiveState] = useState("idle");
  const [liveError, setLiveError] = useState("");
  const [liveSide, setLiveSide] = useState("bull");
  const [liveConfidence, setLiveConfidence] = useState(3);
  const [liveRationale, setLiveRationale] = useState("");
  const [liveDecisionState, setLiveDecisionState] = useState("idle");
  const [liveDecisionError, setLiveDecisionError] = useState("");
  const [liveDecisionSaved, setLiveDecisionSaved] = useState(null);
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
  const [portfolioState, setPortfolioState] = useState("idle");
  const [portfolioData, setPortfolioData] = useState(null);
  const [portfolioError, setPortfolioError] = useState("");
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
      fetchPractice({ silent: true, refreshRandom: false });
    } else if (activePage === "portfolio") {
      fetchPortfolio();
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

  useEffect(() => {
    if (activePage === "home" && snapshot?.ticker && liveAnalysis) {
      fetchLiveAnalysis(snapshot.ticker);
    }
  }, [language, activePage]);

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
      const { response, data } = await fetchApiWithFallback(
        `/api/tickers/${encodeURIComponent(normalizedTicker)}`,
        {},
        t.tickerNotFound,
      );

      if (!response.ok) {
        throw new Error(apiErrorMessage(data, t.tickerNotFound));
      }

      setSnapshot(data);
      setLiveAnalysis(null);
      setLiveError("");
      setLiveState("idle");
      setDebate(null);
      setDebateError("");
      setDebateState("idle");
      resetVerdictState();
      resetLiveDecisionState();
      setLookupState("ready");
      setShowTickerSuggestions(false);
      await fetchLiveAnalysis(data.ticker);
    } catch (lookupError) {
      setSnapshot(null);
      setLiveAnalysis(null);
      setLiveError("");
      setLiveState("idle");
      setDebate(null);
      resetVerdictState();
      resetLiveDecisionState();
      setError(lookupError.message);
      setLookupState("error");
    }
  }

  async function fetchTickerSuggestions(query) {
    setTickerSuggestionState("loading");
    try {
      const { response, data } = await fetchApiWithFallback(
        `/api/tickers/search?q=${encodeURIComponent(query)}&limit=8`,
        {},
        t.tickerNotFound,
      );
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
      const { response, data } = await fetchApiWithFallback("/api/records", {}, t.recordsFailed);

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

  async function fetchPortfolio() {
    setPortfolioState("loading");
    setPortfolioError("");

    try {
      const { response, data } = await fetchApiWithFallback(
        "/api/portfolio",
        {},
        t.portfolioFailed,
      );

      if (!response.ok) {
        throw new Error(apiErrorMessage(data, t.portfolioFailed));
      }

      setPortfolioData(data);
      setPortfolioState("ready");
    } catch (portfolioLookupError) {
      setPortfolioError(portfolioLookupError.message);
      setPortfolioState("error");
    }
  }

  async function createPortfolioDecision(payload) {
    const { response, data } = await fetchApiWithFallback(
      "/api/portfolio/decisions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      t.portfolioCreateFailed,
    );

    if (!response.ok) {
      throw new Error(apiErrorMessage(data, t.portfolioCreateFailed));
    }

    await fetchPortfolio();
    return data;
  }

  async function updatePortfolioDecision(decisionId, payload) {
    const { response, data } = await fetchApiWithFallback(
      `/api/portfolio/decisions/${decisionId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      t.portfolioUpdateFailed,
    );

    if (!response.ok) {
      throw new Error(apiErrorMessage(data, t.portfolioUpdateFailed));
    }

    await fetchPortfolio();
    return data;
  }

  async function deletePortfolioDecision(decisionId) {
    const { response, data } = await fetchApiWithFallback(
      `/api/portfolio/decisions/${decisionId}`,
      { method: "DELETE" },
      t.portfolioDeleteFailed,
    );

    if (!response.ok) {
      throw new Error(apiErrorMessage(data, t.portfolioDeleteFailed));
    }

    await fetchPortfolio();
  }

  async function fetchLiveAnalysis(rawTicker) {
    const normalizedTicker = rawTicker.trim();
    if (!normalizedTicker) {
      return;
    }

    setLiveState("loading");
    setLiveError("");
    resetLiveDecisionState();

    try {
      const { response, data } = await fetchApiWithFallback(
        `/api/live-analysis/${encodeURIComponent(normalizedTicker)}?language=${encodeURIComponent(language)}`,
        {},
        t.liveAnalysisFailed,
      );

      if (!response.ok) {
        throw new Error(apiErrorMessage(data, t.liveAnalysisFailed));
      }

      setLiveAnalysis(data);
      setLiveState("ready");
    } catch (liveLookupError) {
      setLiveAnalysis(null);
      setLiveError(liveLookupError.message);
      setLiveState("error");
    }
  }

  async function fetchOpenAISettings() {
    setSettingsState("loading");
    setSettingsError("");
    setSettingsSaved(false);

    try {
      const { response, data } = await fetchApiWithFallback(
        "/api/settings/openai",
        {},
        t.settingsFailed,
      );

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

  async function updatePracticeAttempt(attemptId, payload) {
    const { response, data } = await fetchPracticeApi(
      `/api/practice/attempts/${attemptId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, language }),
      },
      t.practiceUpdateFailed,
    );

    if (!response.ok) {
      throw new Error(apiErrorMessage(data, t.practiceUpdateFailed));
    }

    await fetchPractice({ silent: true, refreshRandom: false });
    return data;
  }

  async function deletePracticeAttempt(attemptId) {
    const { response, data } = await fetchPracticeApi(
      `/api/practice/attempts/${attemptId}`,
      { method: "DELETE" },
      t.practiceDeleteFailed,
    );

    if (!response.ok) {
      throw new Error(apiErrorMessage(data, t.practiceDeleteFailed));
    }

    await fetchPractice({ silent: true, refreshRandom: false });
  }

  async function updateVerdictRecord(recordId, payload) {
    const { response, data } = await fetchApiWithFallback(
      `/api/records/${recordId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      t.recordUpdateFailed,
    );

    if (!response.ok) {
      throw new Error(apiErrorMessage(data, t.recordUpdateFailed));
    }

    await fetchRecords();
    return data;
  }

  async function deleteVerdictRecord(recordId) {
    const { response, data } = await fetchApiWithFallback(
      `/api/records/${recordId}`,
      { method: "DELETE" },
      t.recordDeleteFailed,
    );

    if (!response.ok) {
      throw new Error(apiErrorMessage(data, t.recordDeleteFailed));
    }

    await fetchRecords();
  }

  async function handleStartDebate() {
    if (!snapshot) {
      return;
    }

    setDebateState("loading");
    setDebateError("");

    try {
      const { response, data } = await fetchApiWithFallback(
        "/api/debates/judged",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticker: snapshot.ticker, language }),
        },
        t.debateFailed,
      );

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

  function resetLiveDecisionState() {
    setLiveSide("bull");
    setLiveConfidence(3);
    setLiveRationale("");
    setLiveDecisionState("idle");
    setLiveDecisionError("");
    setLiveDecisionSaved(null);
  }

  async function handleSubmitLiveDecision(event) {
    event.preventDefault();
    if (!liveAnalysis) {
      return;
    }

    setLiveDecisionState("saving");
    setLiveDecisionError("");

    try {
      const data = await createPortfolioDecision({
        ticker: liveAnalysis.ticker,
        side: liveSide,
        confidence: liveConfidence,
        rationale: liveRationale,
        language,
        weights: { technical: 45, fundamental: 25, chip: 0, ai: 30 },
        analysis: liveAnalysis,
      });
      setLiveDecisionSaved(data);
      setLiveDecisionState("saved");
    } catch (decisionError) {
      setLiveDecisionError(decisionError.message);
      setLiveDecisionState("error");
    }
  }

  async function handleSubmitVerdict(event) {
    event.preventDefault();
    if (!debate) {
      return;
    }

    setVerdictState("saving");

    try {
      const { response, data } = await fetchApiWithFallback(
        "/api/verdicts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            debate,
            side: verdictSide,
            confidence,
            note,
          }),
        },
        t.verdictFailed,
      );

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
      const { response, data } = await fetchApiWithFallback(
        "/api/settings/openai",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: settingsApiKey,
            model: settingsModel,
            key_source: settingsKeySource,
            debate_mode: settingsDebateMode,
          }),
        },
        t.settingsSaveFailed,
      );

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
            <button
              type="button"
              onClick={() => setActivePage("home")}
              className="text-left text-lg font-semibold tracking-wide text-zinc-100 transition hover:text-amber-200"
            >
              {t.brandName}
            </button>
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
                onClick={() => {
                  setActivePage("home");
                  window.setTimeout(() => document.getElementById("ticker-input")?.focus(), 0);
                }}
                className="rounded px-3 py-1 text-sm text-zinc-400 transition hover:text-zinc-100"
              >
                {t.navLiveAnalysis}
              </button>
              <button
                type="button"
                onClick={() => setActivePage("portfolio")}
                className={`rounded px-3 py-1 text-sm transition ${
                  activePage === "portfolio"
                    ? "bg-zinc-800 text-amber-200"
                    : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                {t.navPortfolio}
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
      <section className="mx-auto grid max-w-6xl grid-cols-[1.05fr_0.95fr] gap-8 px-8 py-12">
        <div className="min-w-0 rounded-lg border border-zinc-800 bg-zinc-900 p-7">
          <p className="text-sm uppercase text-amber-200">{t.tickerLookup}</p>
          <h1 className="mt-3 text-4xl font-semibold">{t.appTitle}</h1>
          <p className="mt-4 text-sm leading-6 text-zinc-400">{t.homeSubtitle}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setActivePage("practice")}
              className="rounded bg-amber-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-200"
            >
              {t.startPracticeCta}
            </button>
            <button
              type="button"
              onClick={() => document.getElementById("ticker-input")?.focus()}
              className="rounded border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:border-emerald-300 hover:text-emerald-200"
            >
              {t.currentAnalysisCta}
            </button>
          </div>

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
              <div className="mt-7 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => fetchLiveAnalysis(snapshot.ticker)}
                  disabled={liveState === "loading"}
                  className="h-12 rounded bg-emerald-400 px-5 font-semibold text-zinc-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
                >
                  {liveState === "loading" ? t.loadingLiveAnalysis : t.liveRunAnalysis}
                </button>
              </div>
            </>
          ) : (
            <div className="flex h-full min-h-80 items-center justify-center rounded border border-dashed border-zinc-700 text-zinc-400">
              {t.chartPlaceholder}
            </div>
          )}
        </div>
      </section>

      {liveState === "loading" ? (
        <section className="mx-auto max-w-7xl px-8 pb-8">
          <div className="rounded-lg border border-emerald-300/40 bg-emerald-950/20 p-5 text-emerald-100">
            {t.loadingLiveAnalysis}
          </div>
        </section>
      ) : null}

      {liveError ? (
        <section className="mx-auto max-w-7xl px-8 pb-8">
          <div className="rounded-lg border border-red-400/40 bg-red-950/40 p-5 text-red-100">
            {liveError}
          </div>
        </section>
      ) : null}

      {liveAnalysis ? (
        <LiveAnalysisWorkbench
          analysis={liveAnalysis}
          side={liveSide}
          setSide={setLiveSide}
          confidence={liveConfidence}
          setConfidence={setLiveConfidence}
          rationale={liveRationale}
          setRationale={setLiveRationale}
          decisionState={liveDecisionState}
          decisionError={liveDecisionError}
          decisionSaved={liveDecisionSaved}
          onSubmitDecision={handleSubmitLiveDecision}
          debate={debate}
          debateState={debateState}
          debateError={debateError}
          onStartDebate={handleStartDebate}
          language={language}
          t={t}
        />
      ) : null}
        </>
      ) : activePage === "records" ? (
        <RecordsPage
          state={recordsState}
          data={recordsData}
          error={recordsError}
          practiceData={practiceData}
          practiceState={practiceState}
          onUpdateRecord={updateVerdictRecord}
          onDeleteRecord={deleteVerdictRecord}
          onUpdatePracticeAttempt={updatePracticeAttempt}
          onDeletePracticeAttempt={deletePracticeAttempt}
          onRefresh={() => {
            fetchRecords();
            fetchPractice({ silent: true, refreshRandom: false });
          }}
          t={t}
        />
      ) : activePage === "portfolio" ? (
        <PortfolioPage
          state={portfolioState}
          data={portfolioData}
          error={portfolioError}
          onRefresh={fetchPortfolio}
          onCreate={createPortfolioDecision}
          onUpdate={updatePortfolioDecision}
          onDelete={deletePortfolioDecision}
          language={language}
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

function JudgeScoreboard({ judge, verdictResult, t, showVerdictStatus = true }) {
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
      ) : showVerdictStatus ? (
        <p className="mt-4 rounded border border-zinc-700 bg-zinc-950 p-3 text-sm text-zinc-300">
          {t.skipped}
        </p>
      ) : null}
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
            {claim.evidence_refs?.length ? (
              <p className="mt-3 text-xs text-zinc-500">
                {t.evidenceRefs}: {claim.evidence_refs.join(", ")}
              </p>
            ) : null}
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
            {rebuttal.evidence_refs?.length ? (
              <p className="mt-3 text-xs text-zinc-500">
                {t.evidenceRefs}: {rebuttal.evidence_refs.join(", ")}
              </p>
            ) : null}
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

function LiveAnalysisWorkbench({
  analysis,
  side,
  setSide,
  confidence,
  setConfidence,
  rationale,
  setRationale,
  decisionState,
  decisionError,
  decisionSaved,
  onSubmitDecision,
  debate,
  debateState,
  debateError,
  onStartDebate,
  language,
  t,
}) {
  const [evidenceTab, setEvidenceTab] = useState("fundamental");
  const latestPoint = analysis.market_window?.[analysis.market_window.length - 1];

  return (
    <section className="mx-auto max-w-7xl px-8 pb-12">
      <article className="border-y border-zinc-800 py-7">
        <div className="grid grid-cols-[1fr_320px] gap-8">
          <div>
            <p className="text-sm uppercase text-emerald-200">{t.liveAnalysisKicker}</p>
            <h1 className="mt-2 text-4xl font-semibold">{analysis.ticker}: {analysis.name}</h1>
            <p className="mt-4 max-w-4xl text-sm leading-6 text-zinc-400">{t.liveAnalysisSubtitle}</p>
            <p className="mt-4 text-xs leading-5 text-zinc-500">{analysis.source_summary}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="border border-zinc-800 bg-zinc-950 p-3">
              <p className="text-xs text-zinc-500">{t.liveLatestPrice}</p>
              <p className="mt-1 text-xl font-semibold text-emerald-300">
                {formatPrice(analysis.price, analysis.currency, language)}
              </p>
            </div>
            <div className="border border-zinc-800 bg-zinc-950 p-3">
              <p className="text-xs text-zinc-500">{t.liveAsOf}</p>
              <p className="mt-1 font-semibold text-zinc-100">{analysis.as_of}</p>
            </div>
            <div className="col-span-2 border border-zinc-800 bg-zinc-950 p-3">
              <p className="text-xs text-zinc-500">{t.liveDataSource}</p>
              <p className="mt-1 text-xs leading-5 text-zinc-300">{analysis.data_note}</p>
            </div>
          </div>
        </div>
      </article>

      <section className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900/40 p-6">
        <div className="mb-5 flex items-start justify-between gap-6">
          <div>
            <p className="text-sm uppercase text-emerald-200">{t.decisionWorkbench}</p>
            <h2 className="mt-2 text-2xl font-semibold">{t.technicalChartTitle}</h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-400">{t.liveWorkbenchLead}</p>
          </div>
          {latestPoint ? (
            <div className="shrink-0 border border-zinc-800 bg-zinc-950 px-3 py-2 text-right text-xs text-zinc-400">
              {t.practiceLatestVisibleClose}<br />
              <span className="text-zinc-200">{latestPoint.close.toFixed(2)}</span>
            </div>
          ) : null}
        </div>

        {analysis.market_window?.length ? (
          <MarketIndicatorChart points={analysis.market_window} t={t} />
        ) : null}

        <div className="mt-6">
          <div className="mb-4 flex items-end justify-between gap-6">
            <div>
              <h2 className="text-2xl font-semibold">{t.practiceDimensionReview}</h2>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-400">{t.practiceDimensionLead}</p>
            </div>
          </div>
          <EvidenceTabs
            activeTab={evidenceTab}
            setActiveTab={setEvidenceTab}
            question={analysis}
            t={t}
          />
        </div>

        <AiDebatePanel
          aiDebate={analysis.ai_debate}
          judgedDebate={debate}
          onStartDebate={onStartDebate}
          debateState={debateState}
          debateError={debateError}
          t={t}
        />
      </section>

      <LiveDecisionPanel
        side={side}
        setSide={setSide}
        confidence={confidence}
        setConfidence={setConfidence}
        rationale={rationale}
        setRationale={setRationale}
        decisionState={decisionState}
        decisionError={decisionError}
        decisionSaved={decisionSaved}
        onSubmit={onSubmitDecision}
        t={t}
      />
    </section>
  );
}

function LiveDecisionPanel({
  side,
  setSide,
  confidence,
  setConfidence,
  rationale,
  setRationale,
  decisionState,
  decisionError,
  decisionSaved,
  onSubmit,
  t,
}) {
  return (
    <section className="mt-10 border-t border-zinc-800 pt-8">
      <div className="grid grid-cols-[0.75fr_1.25fr] gap-8">
        <div>
          <p className="text-sm uppercase text-emerald-200">{t.liveDecisionKicker}</p>
          <h2 className="mt-2 text-3xl font-semibold">{t.liveDecisionTitle}</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-400">{t.liveDecisionLead}</p>
        </div>

        <form className="border border-zinc-800 bg-zinc-900 p-6" onSubmit={onSubmit}>
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
                    ? "bg-emerald-300 text-zinc-950"
                    : "border border-zinc-700 text-zinc-300 hover:border-emerald-300 hover:text-emerald-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <label className="mt-6 block text-sm font-medium text-zinc-300" htmlFor="live-confidence">
            {t.confidence} {confidence}
          </label>
          <input
            id="live-confidence"
            type="range"
            min="1"
            max="5"
            value={confidence}
            onChange={(event) => setConfidence(Number(event.target.value))}
            className="mt-3 w-full accent-emerald-300"
          />

          <label className="mt-6 block text-sm font-medium text-zinc-300" htmlFor="live-rationale">
            {t.liveRationaleLabel}
          </label>
          <textarea
            id="live-rationale"
            value={rationale}
            onChange={(event) => setRationale(event.target.value)}
            placeholder={t.liveRationalePlaceholder}
            className="mt-3 h-32 w-full resize-none rounded border border-zinc-700 bg-zinc-950 p-3 text-zinc-100 outline-none transition focus:border-emerald-300"
          />

          {decisionError ? (
            <div className="mt-5 border border-red-400/40 bg-red-950/40 p-3 text-sm text-red-100">
              {decisionError}
            </div>
          ) : null}

          {decisionSaved ? (
            <div className="mt-5 border border-emerald-400/40 bg-emerald-950/30 p-3 text-sm text-emerald-100">
              {t.liveDecisionSaved}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={decisionState === "saving"}
            className="mt-6 h-12 rounded bg-emerald-300 px-5 font-semibold text-zinc-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
          >
            {decisionState === "saving" ? t.savingLiveDecision : t.saveLiveDecision}
          </button>
        </form>
      </div>
    </section>
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
  const [evidenceTab, setEvidenceTab] = useState("fundamental");
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
    setEvidenceTab("fundamental");
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

      <section className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900/40 p-6">
        <div className="mb-5 flex items-start justify-between gap-6">
          <div>
            <p className="text-sm uppercase text-amber-200">{t.decisionWorkbench}</p>
            <h2 className="mt-2 text-2xl font-semibold">{t.technicalChartTitle}</h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-400">{t.practiceChartLead}</p>
          </div>
          <div className="shrink-0 border border-zinc-800 bg-zinc-950 px-3 py-2 text-right text-xs text-zinc-400">
            {t.practiceReadPath}
          </div>
        </div>

        {question.market_window?.length ? (
          <MarketIndicatorChart points={question.market_window} t={t} />
        ) : null}

        <div className="mt-6">
          <div className="mb-4 flex items-end justify-between gap-6">
            <div>
              <h2 className="text-2xl font-semibold">{t.practiceDimensionReview}</h2>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-400">{t.practiceDimensionLead}</p>
            </div>
          </div>
          <EvidenceTabs
            activeTab={evidenceTab}
            setActiveTab={setEvidenceTab}
            question={question}
            t={t}
          />
        </div>

        <AiDebatePanel aiDebate={question.ai_debate} t={t} />

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

function EvidenceTabs({ activeTab, setActiveTab, question, t }) {
  const tabs = [
    ["fundamental", t.fundamentalDimension],
    ["news", t.newsDimension],
    ["ai", t.aiDimension],
    ["evidence", t.evidencePack],
  ];

  return (
    <div className="rounded border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex flex-wrap gap-2 border-b border-zinc-800 pb-3">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`rounded px-3 py-2 text-sm font-semibold transition ${
              activeTab === key
                ? "bg-amber-300 text-zinc-950"
                : "border border-zinc-700 text-zinc-300 hover:border-amber-300 hover:text-amber-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {activeTab === "fundamental" ? (
          <MetricPanel title={t.fundamentalDimension} metrics={question.fundamental_snapshot || []} />
        ) : null}
        {activeTab === "news" ? (
          <MetricPanel title={t.newsDimension} metrics={question.news_snapshot || []} />
        ) : null}
        {activeTab === "ai" ? <AiSnapshotPanel snapshot={question.ai_snapshot} t={t} /> : null}
        {activeTab === "evidence" ? <EvidencePackPanel evidence={question.evidence_pack || []} t={t} /> : null}
      </div>
    </div>
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
          {snapshot.source ? <p>{t.aiSource}: {snapshot.source}</p> : null}
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
      {snapshot.hard_to_quantify_factors?.length ? (
        <div className="mt-3 rounded border border-zinc-700 bg-zinc-950 p-3">
          <p className="text-xs font-semibold text-zinc-100">{t.aiHardFactors}</p>
          <ul className="mt-2 space-y-1 text-xs leading-5 text-zinc-400">
            {snapshot.hard_to_quantify_factors.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function EvidencePackPanel({ evidence, t }) {
  if (!evidence?.length) {
    return <p className="text-sm text-zinc-500">{t.noEvidencePack}</p>;
  }

  return (
    <div>
      <p className="text-sm leading-6 text-zinc-400">{t.evidencePackLead}</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {evidence.map((item) => (
          <article key={item.evidence_id} className="rounded border border-zinc-800 bg-zinc-900 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-amber-200">{item.evidence_id} · {item.category}</p>
                <h4 className="mt-1 text-sm font-semibold text-zinc-100">{item.title}</h4>
              </div>
              <span className={`text-xs font-semibold ${metricToneClass(item.tone)}`}>{item.value}</span>
            </div>
            {item.detail ? <p className="mt-2 text-xs leading-5 text-zinc-400">{item.detail}</p> : null}
          </article>
        ))}
      </div>
    </div>
  );
}

function AiDebatePanel({
  aiDebate,
  judgedDebate = null,
  onStartDebate = null,
  debateState = "idle",
  debateError = "",
  t,
}) {
  const debate = judgedDebate || aiDebate;
  if (!debate) {
    return null;
  }
  const scoreMap = debate.judge ? buildScoreMap(debate.judge) : {};

  return (
    <section className="mt-8 border-t border-zinc-800 pt-6">
      <div className="mb-5 flex items-start justify-between gap-6">
        <div>
          <p className="text-sm uppercase text-amber-200">{t.aiDebateKicker}</p>
          <h2 className="mt-2 text-2xl font-semibold">{t.aiDebateTitle}</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-400">{t.aiDebateLead}</p>
        </div>
        {onStartDebate ? (
          <button
            type="button"
            onClick={onStartDebate}
            disabled={debateState === "loading"}
            className="shrink-0 rounded border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-950/30 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:text-zinc-500"
          >
            {debateState === "loading" ? t.researching : judgedDebate ? t.refreshAiDebate : t.runAiDebate}
          </button>
        ) : null}
      </div>

      {debateState === "loading" ? (
        <div className="mb-5 rounded border border-amber-300/40 bg-amber-950/20 p-4 text-sm text-amber-100">
          {t.researchStatus}
        </div>
      ) : null}
      {debateError ? (
        <div className="mb-5 rounded border border-red-400/40 bg-red-950/40 p-4 text-sm text-red-100">
          {debateError}
        </div>
      ) : null}

      {debate.judge ? (
        <div className="mb-6">
          <JudgeScoreboard judge={debate.judge} verdictResult={null} t={t} showVerdictStatus={false} />
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-5">
        <OpeningColumn title={t.bullOpening} tone="bull" claims={debate.bull.claims} scoreMap={scoreMap} t={t} />
        <OpeningColumn title={t.bearOpening} tone="bear" claims={debate.bear.claims} scoreMap={scoreMap} t={t} />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-5">
        <RebuttalColumn
          title={t.bullRebuttal}
          tone="bull"
          rebuttals={debate.bull_rebuttals.rebuttals}
          scoreMap={scoreMap}
          t={t}
        />
        <RebuttalColumn
          title={t.bearRebuttal}
          tone="bear"
          rebuttals={debate.bear_rebuttals.rebuttals}
          scoreMap={scoreMap}
          t={t}
        />
      </div>
    </section>
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
      <ChartHoverInspector point={activePoint} t={t} />
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

function ChartHoverInspector({ point, t }) {
  const items = [
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

  return (
    <div className="mb-4 border border-amber-300/30 bg-amber-950/10 p-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <span className="font-semibold text-amber-200">{point.date}</span>
        {items.map(([label, value]) => (
          <span key={label} className="text-zinc-400">
            {label} <span className="font-semibold text-zinc-100">{value}</span>
          </span>
        ))}
      </div>
    </div>
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

function LabeledInput({ label, value, onChange, type = "text", ...props }) {
  return (
    <label className="block text-xs text-zinc-400">
      <span>{label}</span>
      <input
        type={type}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-10 w-full rounded border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none transition focus:border-amber-300"
        {...props}
      />
    </label>
  );
}

function LabeledSelect({ label, value, onChange, options }) {
  return (
    <label className="block text-xs text-zinc-400">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-10 w-full rounded border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none transition focus:border-amber-300"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function LabeledTextarea({ label, value, onChange }) {
  return (
    <label className="block text-xs text-zinc-400">
      <span>{label}</span>
      <textarea
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-20 w-full resize-none rounded border border-zinc-700 bg-zinc-950 p-3 text-sm text-zinc-100 outline-none transition focus:border-amber-300"
      />
    </label>
  );
}

function PortfolioPage({ state, data, error, onRefresh, onCreate, onUpdate, onDelete, language, t }) {
  const [manualForm, setManualForm] = useState({
    ticker: "NVDA",
    side: "bull",
    confidence: 3,
    entry_price: "",
    currency: "USD",
    created_at: "",
    status: "open",
    rationale: "",
    review_note: "",
  });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [actionState, setActionState] = useState("idle");
  const [actionError, setActionError] = useState("");

  if (state === "loading" && !data) {
    return (
      <section className="mx-auto max-w-6xl px-8 py-12">
        <div className="rounded-lg border border-amber-300/40 bg-amber-950/20 p-5 text-amber-100">
          {t.loadingPortfolio}
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
  const decisions = data?.decisions || [];

  function setManualField(key, value) {
    setManualForm((current) => ({ ...current, [key]: value }));
  }

  function setEditField(key, value) {
    setEditForm((current) => ({ ...current, [key]: value }));
  }

  async function submitManualDecision(event) {
    event.preventDefault();
    setActionState("saving");
    setActionError("");
    try {
      await onCreate({
        ticker: manualForm.ticker,
        side: manualForm.side,
        confidence: Number(manualForm.confidence),
        rationale: manualForm.rationale,
        entry_price: Number(manualForm.entry_price),
        currency: manualForm.currency || undefined,
        created_at: manualForm.created_at || undefined,
        status: manualForm.status,
        review_note: manualForm.review_note,
      });
      setManualForm((current) => ({
        ...current,
        entry_price: "",
        rationale: "",
        review_note: "",
      }));
      setActionState("idle");
    } catch (submitError) {
      setActionError(submitError.message);
      setActionState("error");
    }
  }

  function startEdit(decision) {
    setEditingId(decision.id);
    setEditForm({
      ticker: decision.ticker,
      side: decision.side,
      confidence: decision.confidence,
      price_at_decision: decision.price_at_decision,
      currency: decision.currency,
      created_at: toDateTimeLocal(decision.created_at),
      status: decision.status || "open",
      exit_price: decision.exit_price ?? "",
      exit_at: toDateTimeLocal(decision.exit_at),
      rationale: decision.rationale || "",
      review_note: decision.review_note || "",
    });
    setActionError("");
  }

  async function submitEdit(event) {
    event.preventDefault();
    setActionState("saving");
    setActionError("");
    try {
      await onUpdate(editingId, {
        ticker: editForm.ticker,
        side: editForm.side,
        confidence: Number(editForm.confidence),
        price_at_decision: Number(editForm.price_at_decision),
        currency: editForm.currency,
        created_at: editForm.created_at || undefined,
        status: editForm.status,
        exit_price: editForm.exit_price === "" ? null : Number(editForm.exit_price),
        exit_at: editForm.exit_at || null,
        rationale: editForm.rationale,
        review_note: editForm.review_note,
      });
      setEditingId(null);
      setEditForm(null);
      setActionState("idle");
    } catch (submitError) {
      setActionError(submitError.message);
      setActionState("error");
    }
  }

  async function deleteDecision(decisionId) {
    setActionState("saving");
    setActionError("");
    try {
      await onDelete(decisionId);
      setActionState("idle");
    } catch (deleteError) {
      setActionError(deleteError.message);
      setActionState("error");
    }
  }

  return (
    <section className="mx-auto max-w-6xl px-8 py-12">
      <div className="flex items-start justify-between gap-8">
        <div>
          <p className="text-sm uppercase text-emerald-200">{t.portfolioKicker}</p>
          <h1 className="mt-2 text-4xl font-semibold">{t.portfolioTitle}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">{t.portfolioSubtitle}</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="rounded border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-emerald-300 hover:text-emerald-200"
        >
          {t.refresh}
        </button>
      </div>

      {stats ? (
        <div className="mt-8 grid grid-cols-6 gap-4">
          <StatBox label={t.portfolioTotal} value={stats.total_decisions} />
          <StatBox label={t.portfolioOpenClosed} value={`${stats.open_count || 0}/${stats.closed_count || 0}`} />
          <StatBox label={t.distribution} value={`${stats.bull_count}/${stats.bear_count}/${stats.neutral_count}`} />
          <StatBox label={t.portfolioAvgMove} value={formatPercent(stats.average_pct_change, t)} />
          <StatBox label={t.portfolioAiAgreement} value={formatPercent(stats.ai_agreement_rate, t)} />
          <StatBox label={t.liveDataSource} value="yfinance" />
        </div>
      ) : null}

      <form className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900 p-6" onSubmit={submitManualDecision}>
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-sm uppercase text-emerald-200">{t.manualPortfolioKicker}</p>
            <h2 className="mt-2 text-2xl font-semibold">{t.manualPortfolioTitle}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">{t.manualPortfolioLead}</p>
          </div>
          <button
            type="submit"
            disabled={actionState === "saving" || !manualForm.ticker || !manualForm.entry_price}
            className="rounded bg-emerald-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
          >
            {actionState === "saving" ? t.saving : t.addPortfolioDecision}
          </button>
        </div>

        <div className="mt-5 grid grid-cols-6 gap-4">
          <LabeledInput label={t.tableTicker} value={manualForm.ticker} onChange={(value) => setManualField("ticker", value)} />
          <LabeledSelect
            label={t.tableSide}
            value={manualForm.side}
            onChange={(value) => setManualField("side", value)}
            options={[["bull", t.bullSide], ["bear", t.bearSide], ["neutral", t.neutralSide]]}
          />
          <LabeledInput label={t.tableConfidence} type="number" min="1" max="5" value={manualForm.confidence} onChange={(value) => setManualField("confidence", value)} />
          <LabeledInput label={t.entryPrice} type="number" step="any" value={manualForm.entry_price} onChange={(value) => setManualField("entry_price", value)} />
          <LabeledInput label={t.currency} value={manualForm.currency} onChange={(value) => setManualField("currency", value)} />
          <LabeledInput label={t.entryTime} type="datetime-local" value={manualForm.created_at} onChange={(value) => setManualField("created_at", value)} />
        </div>
        <div className="mt-4 grid grid-cols-[180px_1fr_1fr] gap-4">
          <LabeledSelect
            label={t.portfolioStatus}
            value={manualForm.status}
            onChange={(value) => setManualField("status", value)}
            options={[["watching", t.statusWatching], ["open", t.statusOpen], ["closed", t.statusClosed]]}
          />
          <LabeledTextarea label={t.portfolioRationale} value={manualForm.rationale} onChange={(value) => setManualField("rationale", value)} />
          <LabeledTextarea label={t.reviewNote} value={manualForm.review_note} onChange={(value) => setManualField("review_note", value)} />
        </div>
      </form>

      {actionError ? (
        <div className="mt-5 rounded border border-red-400/40 bg-red-950/40 p-4 text-sm text-red-100">
          {actionError}
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
              <th className="px-4 py-3">{t.portfolioCurrentPrice}</th>
              <th className="px-4 py-3">{t.portfolioPctChange}</th>
              <th className="px-4 py-3">{t.aiComparison}</th>
              <th className="px-4 py-3">{t.portfolioRationale}</th>
              <th className="px-4 py-3">{t.actions}</th>
            </tr>
          </thead>
          <tbody>
            {decisions.map((decision) => (
              <Fragment key={decision.id}>
                <tr className="border-t border-zinc-800 text-zinc-200">
                  <td className="px-4 py-4">
                    <p className="font-semibold">{decision.ticker}</p>
                    <p className="mt-1 text-xs text-zinc-500">{formatDateTime(decision.created_at)}</p>
                    <p className="mt-1 text-xs text-zinc-500">{statusLabel(decision.status, t)}</p>
                  </td>
                  <td className="px-4 py-4">{sideLabel(decision.side, t)}</td>
                  <td className="px-4 py-4">{decision.confidence}</td>
                  <td className="px-4 py-4">{formatPrice(decision.price_at_decision, decision.currency, language)}</td>
                  <td className="px-4 py-4">
                    {decision.current_price == null
                      ? t.unavailable
                      : formatPrice(decision.current_price, decision.currency, language)}
                    {decision.exit_price != null ? (
                      <p className="mt-1 text-xs text-zinc-500">
                        {t.exitPrice}: {formatPrice(decision.exit_price, decision.currency, language)}
                      </p>
                    ) : null}
                  </td>
                  <td className={`px-4 py-4 ${pctToneClass(decision.pct_change)}`}>
                    {decision.pct_change == null ? t.unavailable : formatSignedPercent(decision.pct_change)}
                  </td>
                  <td className="px-4 py-4">
                    {decision.ai_agreement == null ? t.unavailable : decision.ai_agreement ? t.aiAligned : t.aiDifferent}
                  </td>
                  <td className="max-w-[300px] px-4 py-4 text-xs leading-5 text-zinc-400">
                    {decision.rationale || t.unavailable}
                    {decision.review_note ? <p className="mt-2 text-amber-200">{t.reviewNote}: {decision.review_note}</p> : null}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => startEdit(decision)} className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:border-amber-300 hover:text-amber-200">
                        {t.edit}
                      </button>
                      <button type="button" onClick={() => deleteDecision(decision.id)} className="rounded border border-red-400/50 px-2 py-1 text-xs text-red-200 hover:bg-red-950/40">
                        {t.delete}
                      </button>
                    </div>
                  </td>
                </tr>
                {editingId === decision.id && editForm ? (
                  <tr className="border-t border-zinc-800 bg-zinc-950/70">
                    <td colSpan="9" className="p-4">
                      <form onSubmit={submitEdit}>
                        <div className="grid grid-cols-6 gap-4">
                          <LabeledInput label={t.tableTicker} value={editForm.ticker} onChange={(value) => setEditField("ticker", value)} />
                          <LabeledSelect label={t.tableSide} value={editForm.side} onChange={(value) => setEditField("side", value)} options={[["bull", t.bullSide], ["bear", t.bearSide], ["neutral", t.neutralSide]]} />
                          <LabeledInput label={t.tableConfidence} type="number" min="1" max="5" value={editForm.confidence} onChange={(value) => setEditField("confidence", value)} />
                          <LabeledInput label={t.entryPrice} type="number" step="any" value={editForm.price_at_decision} onChange={(value) => setEditField("price_at_decision", value)} />
                          <LabeledInput label={t.currency} value={editForm.currency} onChange={(value) => setEditField("currency", value)} />
                          <LabeledInput label={t.entryTime} type="datetime-local" value={editForm.created_at} onChange={(value) => setEditField("created_at", value)} />
                        </div>
                        <div className="mt-4 grid grid-cols-[180px_180px_220px_1fr_1fr] gap-4">
                          <LabeledSelect label={t.portfolioStatus} value={editForm.status} onChange={(value) => setEditField("status", value)} options={[["watching", t.statusWatching], ["open", t.statusOpen], ["closed", t.statusClosed]]} />
                          <LabeledInput label={t.exitPrice} type="number" step="any" value={editForm.exit_price} onChange={(value) => setEditField("exit_price", value)} />
                          <LabeledInput label={t.exitTime} type="datetime-local" value={editForm.exit_at} onChange={(value) => setEditField("exit_at", value)} />
                          <LabeledTextarea label={t.portfolioRationale} value={editForm.rationale} onChange={(value) => setEditField("rationale", value)} />
                          <LabeledTextarea label={t.reviewNote} value={editForm.review_note} onChange={(value) => setEditField("review_note", value)} />
                        </div>
                        <div className="mt-4 flex gap-2">
                          <button type="submit" className="rounded bg-amber-300 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-200">
                            {t.saveEdit}
                          </button>
                          <button type="button" onClick={() => setEditingId(null)} className="rounded border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-500">
                            {t.cancel}
                          </button>
                        </div>
                      </form>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
        {decisions.length === 0 ? (
          <div className="bg-zinc-900 p-8 text-center text-zinc-400">{t.portfolioNoDecisions}</div>
        ) : null}
      </div>
    </section>
  );
}

function RecordsPage({
  state,
  data,
  error,
  practiceData,
  practiceState,
  onUpdateRecord,
  onDeleteRecord,
  onUpdatePracticeAttempt,
  onDeletePracticeAttempt,
  onRefresh,
  t,
}) {
  const [editingRecordId, setEditingRecordId] = useState(null);
  const [recordForm, setRecordForm] = useState(null);
  const [editingAttemptId, setEditingAttemptId] = useState(null);
  const [attemptForm, setAttemptForm] = useState(null);
  const [actionState, setActionState] = useState("idle");
  const [actionError, setActionError] = useState("");

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
  const practiceAttempts = practiceData?.recent_attempts || [];
  const practiceStats = practiceData?.stats;

  function startRecordEdit(record) {
    setEditingRecordId(record.id);
    setRecordForm({
      side: record.side,
      confidence: record.confidence,
      note: record.note || "",
      review_note: record.review_note || "",
    });
    setActionError("");
  }

  async function submitRecordEdit(event) {
    event.preventDefault();
    setActionState("saving");
    setActionError("");
    try {
      await onUpdateRecord(editingRecordId, {
        side: recordForm.side,
        confidence: Number(recordForm.confidence),
        note: recordForm.note,
        review_note: recordForm.review_note,
      });
      setEditingRecordId(null);
      setRecordForm(null);
      setActionState("idle");
    } catch (submitError) {
      setActionError(submitError.message);
      setActionState("error");
    }
  }

  async function deleteRecord(recordId) {
    setActionState("saving");
    setActionError("");
    try {
      await onDeleteRecord(recordId);
      setActionState("idle");
    } catch (deleteError) {
      setActionError(deleteError.message);
      setActionState("error");
    }
  }

  function startAttemptEdit(attempt) {
    setEditingAttemptId(attempt.id);
    setAttemptForm({
      selected_side: attempt.selected_side,
      confidence: attempt.confidence,
      rationale: attempt.rationale || "",
      review_note: attempt.review_note || "",
      weights: attempt.weights,
    });
    setActionError("");
  }

  async function submitAttemptEdit(event) {
    event.preventDefault();
    setActionState("saving");
    setActionError("");
    try {
      await onUpdatePracticeAttempt(editingAttemptId, {
        selected_side: attemptForm.selected_side,
        confidence: Number(attemptForm.confidence),
        rationale: attemptForm.rationale,
        review_note: attemptForm.review_note,
        weights: attemptForm.weights,
      });
      setEditingAttemptId(null);
      setAttemptForm(null);
      setActionState("idle");
    } catch (submitError) {
      setActionError(submitError.message);
      setActionState("error");
    }
  }

  async function deleteAttempt(attemptId) {
    setActionState("saving");
    setActionError("");
    try {
      await onDeletePracticeAttempt(attemptId);
      setActionState("idle");
    } catch (deleteError) {
      setActionError(deleteError.message);
      setActionState("error");
    }
  }

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

      {actionError ? (
        <div className="mt-5 rounded border border-red-400/40 bg-red-950/40 p-4 text-sm text-red-100">
          {actionError}
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
              <th className="px-4 py-3">{t.actions}</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <Fragment key={record.id}>
                <tr className="border-t border-zinc-800 text-zinc-200">
                  <td className="px-4 py-4">
                    <p className="font-semibold">{record.ticker}</p>
                    {record.review_note ? <p className="mt-1 text-xs text-amber-200">{t.reviewNote}: {record.review_note}</p> : null}
                  </td>
                  <td className="px-4 py-4">{sideLabel(record.side, t)}</td>
                  <td className="px-4 py-4">{record.confidence}</td>
                  <td className="px-4 py-4">{record.price_at_verdict.toFixed(2)}</td>
                  <td className="px-4 py-4">{settlementLabel(record, "1d", t)}</td>
                  <td className="px-4 py-4">{settlementLabel(record, "7d", t)}</td>
                  <td className="px-4 py-4">{settlementLabel(record, "30d", t)}</td>
                  <td className="px-4 py-4">
                    {record.judge_agreement ? t.same : t.different}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => startRecordEdit(record)} className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:border-amber-300 hover:text-amber-200">
                        {t.edit}
                      </button>
                      <button type="button" onClick={() => deleteRecord(record.id)} className="rounded border border-red-400/50 px-2 py-1 text-xs text-red-200 hover:bg-red-950/40">
                        {t.delete}
                      </button>
                    </div>
                  </td>
                </tr>
                {editingRecordId === record.id && recordForm ? (
                  <tr className="border-t border-zinc-800 bg-zinc-950/70">
                    <td colSpan="9" className="p-4">
                      <form onSubmit={submitRecordEdit}>
                        <div className="grid grid-cols-[180px_160px_1fr_1fr] gap-4">
                          <LabeledSelect label={t.tableSide} value={recordForm.side} onChange={(value) => setRecordForm((current) => ({ ...current, side: value }))} options={[["bull", t.bullSide], ["bear", t.bearSide], ["neutral", t.neutralSide]]} />
                          <LabeledInput label={t.tableConfidence} type="number" min="1" max="5" value={recordForm.confidence} onChange={(value) => setRecordForm((current) => ({ ...current, confidence: value }))} />
                          <LabeledTextarea label={t.noteLabel} value={recordForm.note} onChange={(value) => setRecordForm((current) => ({ ...current, note: value }))} />
                          <LabeledTextarea label={t.reviewNote} value={recordForm.review_note} onChange={(value) => setRecordForm((current) => ({ ...current, review_note: value }))} />
                        </div>
                        <div className="mt-4 flex gap-2">
                          <button type="submit" className="rounded bg-amber-300 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-200">{t.saveEdit}</button>
                          <button type="button" onClick={() => setEditingRecordId(null)} className="rounded border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-500">{t.cancel}</button>
                        </div>
                      </form>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
        {records.length === 0 ? (
          <div className="bg-zinc-900 p-8 text-center text-zinc-400">{t.noRecords}</div>
        ) : null}
      </div>

      <section className="mt-10 border-t border-zinc-800 pt-8">
        <div className="flex items-start justify-between gap-8">
          <div>
            <p className="text-sm uppercase text-amber-200">{t.practiceKicker}</p>
            <h2 className="mt-2 text-3xl font-semibold">{t.practiceAttemptRecords}</h2>
          </div>
          {practiceStats ? (
            <div className="grid grid-cols-3 gap-3 text-sm">
              <StatBox label={t.practiceTotalAttempts} value={practiceStats.total_attempts} />
              <StatBox label={t.practiceAccuracy} value={formatPercent(practiceStats.accuracy_rate, t)} />
              <StatBox label={t.practiceMostCommonFocus} value={practiceStats.most_common_focus || t.unavailable} />
            </div>
          ) : null}
        </div>

        {practiceState === "loading" && !practiceData ? (
          <div className="mt-6 rounded-lg border border-amber-300/40 bg-amber-950/20 p-5 text-amber-100">
            {t.loadingPractice}
          </div>
        ) : null}

        <div className="mt-6 overflow-hidden rounded-lg border border-zinc-800">
          <table className="w-full border-collapse bg-zinc-900 text-left text-sm">
            <thead className="bg-zinc-950 text-zinc-400">
              <tr>
                <th className="px-4 py-3">{t.tableTicker}</th>
                <th className="px-4 py-3">{t.tableSide}</th>
                <th className="px-4 py-3">{t.tableConfidence}</th>
                <th className="px-4 py-3">{t.tableResult}</th>
                <th className="px-4 py-3">{t.practiceOutcome}</th>
                <th className="px-4 py-3">{t.tableRationale}</th>
                <th className="px-4 py-3">{t.tableFeedback}</th>
                <th className="px-4 py-3">{t.actions}</th>
              </tr>
            </thead>
            <tbody>
              {practiceAttempts.map((attempt) => (
                <Fragment key={attempt.id}>
                  <tr className="border-t border-zinc-800 text-zinc-200">
                    <td className="px-4 py-4 font-semibold">{attempt.ticker}</td>
                    <td className="px-4 py-4">{sideLabel(attempt.selected_side, t)}</td>
                    <td className="px-4 py-4">{attempt.confidence}</td>
                    <td className={`px-4 py-4 ${attempt.result === "correct" ? "text-emerald-300" : "text-red-300"}`}>
                      {attempt.result === "correct" ? t.practiceCorrect : t.practiceWrong}
                    </td>
                    <td className="px-4 py-4">{formatSignedPercent(attempt.outcome_pct)}</td>
                    <td className="max-w-[220px] px-4 py-4 text-xs leading-5 text-zinc-400">
                      {attempt.rationale || t.unavailable}
                      {attempt.review_note ? <p className="mt-2 text-amber-200">{t.reviewNote}: {attempt.review_note}</p> : null}
                    </td>
                    <td className="max-w-[320px] px-4 py-4 text-xs leading-5 text-zinc-300">
                      {attempt.feedback?.summary || t.unavailable}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex gap-2">
                        <button type="button" onClick={() => startAttemptEdit(attempt)} className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:border-amber-300 hover:text-amber-200">
                          {t.edit}
                        </button>
                        <button type="button" onClick={() => deleteAttempt(attempt.id)} className="rounded border border-red-400/50 px-2 py-1 text-xs text-red-200 hover:bg-red-950/40">
                          {t.delete}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {editingAttemptId === attempt.id && attemptForm ? (
                    <tr className="border-t border-zinc-800 bg-zinc-950/70">
                      <td colSpan="8" className="p-4">
                        <form onSubmit={submitAttemptEdit}>
                          <div className="grid grid-cols-[180px_160px_1fr_1fr] gap-4">
                            <LabeledSelect label={t.tableSide} value={attemptForm.selected_side} onChange={(value) => setAttemptForm((current) => ({ ...current, selected_side: value }))} options={[["bull", t.bullSide], ["bear", t.bearSide], ["neutral", t.neutralSide]]} />
                            <LabeledInput label={t.tableConfidence} type="number" min="1" max="5" value={attemptForm.confidence} onChange={(value) => setAttemptForm((current) => ({ ...current, confidence: value }))} />
                            <LabeledTextarea label={t.practiceRationaleLabel} value={attemptForm.rationale} onChange={(value) => setAttemptForm((current) => ({ ...current, rationale: value }))} />
                            <LabeledTextarea label={t.reviewNote} value={attemptForm.review_note} onChange={(value) => setAttemptForm((current) => ({ ...current, review_note: value }))} />
                          </div>
                          <div className="mt-4 flex gap-2">
                            <button type="submit" className="rounded bg-amber-300 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-200">{t.saveEdit}</button>
                            <button type="button" onClick={() => setEditingAttemptId(null)} className="rounded border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-500">{t.cancel}</button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
          {practiceAttempts.length === 0 ? (
            <div className="bg-zinc-900 p-8 text-center text-zinc-400">{t.noPracticeRecord}</div>
          ) : null}
        </div>
      </section>
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

function statusLabel(status, t) {
  if (status === "closed") {
    return t.statusClosed;
  }
  if (status === "watching") {
    return t.statusWatching;
  }
  return t.statusOpen;
}

function formatPercent(value, t) {
  return value == null ? t.unavailable : `${value}%`;
}

function formatSignedPercent(value) {
  return `${value > 0 ? "+" : ""}${Number(value).toFixed(1)}%`;
}

function formatDateTime(value) {
  if (!value) {
    return "";
  }
  return String(value).replace("T", " ").slice(0, 16);
}

function toDateTimeLocal(value) {
  if (!value) {
    return "";
  }
  return String(value).slice(0, 16);
}

function pctToneClass(value) {
  if (value == null) {
    return "text-zinc-400";
  }
  if (value > 0) {
    return "text-emerald-300";
  }
  if (value < 0) {
    return "text-red-300";
  }
  return "text-zinc-300";
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
