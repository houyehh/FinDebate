import { useEffect, useState } from "react";

const healthLabels = {
  checking: "checking",
  ok: "ok",
  error: "error",
};

function App() {
  const [health, setHealth] = useState("checking");

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

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <nav className="border-b border-slate-800 bg-slate-950/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-5">
          <span className="text-lg font-semibold tracking-wide">Bull vs Bear Arena</span>
          <span className="rounded border border-amber-400/40 px-3 py-1 text-sm text-amber-200">
            API: {healthLabels[health]}
          </span>
        </div>
      </nav>

      <section className="mx-auto max-w-6xl px-8 py-16">
        <p className="text-sm uppercase text-amber-200">System health</p>
        <h1 className="mt-3 text-4xl font-semibold">AI 投資多空辯論擂台</h1>
        <p className="mt-4 max-w-2xl text-slate-300">
          The local FastAPI backend and React frontend are wired together.
        </p>
      </section>
    </main>
  );
}

export default App;
