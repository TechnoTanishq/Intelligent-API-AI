import { useCallback, useEffect, useRef, useState } from "react";
import type { AnalyzeResponse, ScenarioLabel, SimRequest, SimState, SimStats, TrafficMix } from "./types";
import { DEFAULT_MIX, generateRequest } from "./scenarios/generator";
import { analyzeRequest, checkHealth } from "./services/api";

const API_DEFAULT = "http://127.0.0.1:8000";
const EMPTY_STATS: SimStats = {
  total: 0,
  byScenario: { normal: 0, sqli: 0, xss: 0, path_traversal: 0, cmd_injection: 0 },
  errors: 0, matches: 0, mismatches: 0,
};

type Theme = "dark" | "light";

const SCENARIO_STYLES: Record<ScenarioLabel, { color: string; bg: string; icon: string }> = {
  normal:         { color: "text-ok",           bg: "bg-ok/10 border-ok/30",           icon: "✓" },
  sqli:           { color: "text-warn",          bg: "bg-warn/10 border-warn/30",         icon: "⚡" },
  xss:            { color: "text-danger",        bg: "bg-danger/10 border-danger/30",     icon: "✕" },
  path_traversal: { color: "text-[#22d3ee]",     bg: "bg-cyan-500/10 border-cyan-500/30", icon: "⬆" },
  cmd_injection:  { color: "text-fuchsia-400",   bg: "bg-fuchsia-500/10 border-fuchsia-500/30", icon: "⌘" },
};

function agrees(prediction: string, scenario: ScenarioLabel): boolean {
  return scenario === "normal" ? prediction === "NORMAL" : prediction === "ATTACK";
}

function SunIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/>
    </svg>
  );
}

export default function App() {
  // ── theme ──────────────────────────────────────────────────────────────────
  const [theme, setTheme] = useState<Theme>(() => {
    try { return localStorage.getItem("intelliapi-sim-theme") === "light" ? "light" : "dark"; }
    catch { return "dark"; }
  });
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try { localStorage.setItem("intelliapi-sim-theme", theme); } catch { /* ignore */ }
  }, [theme]);
  const toggleTheme = () => setTheme((t) => t === "dark" ? "light" : "dark");

  // ── state ──────────────────────────────────────────────────────────────────
  const [apiBase, setApiBase] = useState(API_DEFAULT);
  const [intervalMs, setIntervalMs] = useState(4000);
  const [mix, setMix] = useState<TrafficMix>(DEFAULT_MIX);
  const [simState, setSimState] = useState<SimState>("stopped");
  const [stats, setStats] = useState<SimStats>(EMPTY_STATS);
  const [lastReq, setLastReq] = useState<SimRequest | null>(null);
  const [lastResp, setLastResp] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<"connected" | "disconnected" | "unknown">("unknown");

  const intervalRef = useRef<number | null>(null);
  const mixRef = useRef(mix);
  const apiBaseRef = useRef(apiBase);
  useEffect(() => { mixRef.current = mix; }, [mix]);
  useEffect(() => { apiBaseRef.current = apiBase; }, [apiBase]);

  const clearTimer = () => {
    if (intervalRef.current !== null) { clearInterval(intervalRef.current); intervalRef.current = null; }
  };

  const tick = useCallback(async () => {
    const req = generateRequest(mixRef.current);
    setLastReq(req);
    try {
      const resp = await analyzeRequest(apiBaseRef.current, req);
      setLastResp(resp);
      setError(null);
      setStats((s) => {
        const ok = agrees(resp.prediction, req.scenario_label);
        return {
          total: s.total + 1,
          byScenario: { ...s.byScenario, [req.scenario_label]: s.byScenario[req.scenario_label] + 1 },
          errors: s.errors,
          matches: s.matches + (ok ? 1 : 0),
          mismatches: s.mismatches + (ok ? 0 : 1),
        };
      });
    } catch (e) {
      setLastResp(null);
      setStats((s) => ({ ...s, errors: s.errors + 1 }));
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    intervalRef.current = window.setInterval(() => { void tick(); }, intervalMs);
  }, [intervalMs, tick]);

  useEffect(() => {
    let active = true;
    checkHealth(apiBase)
      .then((h) => active && setHealth(h.model_loaded ? "connected" : "disconnected"))
      .catch(() => active && setHealth("disconnected"));
    return () => { active = false; };
  }, [apiBase]);

  useEffect(() => {
    if (simState === "running") startTimer();
    return clearTimer;
  }, [intervalMs, simState, startTimer]);

  const onStart = () => { void tick(); setSimState("running"); };
  const onPause = () => setSimState("paused");
  const onResume = () => setSimState("running");
  const onStop = () => { clearTimer(); setSimState("stopped"); };
  const onClear = () => { setStats(EMPTY_STATS); setLastReq(null); setLastResp(null); setError(null); };

  // state badge config
  const stateBadge = {
    stopped: { dot: "bg-[var(--text-muted)]",            label: "Stopped" },
    running: { dot: "bg-ok animate-live-pulse",          label: "Running" },
    paused:  { dot: "bg-warn",                           label: "Paused"  },
  }[simState];

  const healthColor = health === "connected" ? "text-ok" : "text-danger";

  return (
    <div className="min-h-full bg-[var(--bg-base)] text-[var(--text-primary)]">

      {/* ── Sticky header ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg-surface)]/90 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-accent/15 flex items-center justify-center text-accent font-bold text-sm">S</div>
            <div>
              <h1 className="text-sm font-bold leading-none">
                <span className="text-[#06b6d4]">IntelliAPI AI</span>
                <span className="text-[var(--text-muted)] font-normal ml-1 hidden sm:inline">· Simulator</span>
              </h1>
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5 hidden md:block">HTTP traffic generator</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`hidden sm:inline text-[11px] font-mono ${healthColor}`}>
              API: {health}
            </span>
            <input
              value={apiBase}
              onChange={(e) => setApiBase(e.target.value)}
              disabled={simState === "running"}
              className="hidden md:block bg-[var(--bg-raised)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs font-mono w-40 focus:outline-none focus:border-[#06b6d4] disabled:opacity-50"
            />
            <button onClick={toggleTheme}
              className="h-8 w-8 rounded-lg flex items-center justify-center bg-[var(--bg-raised)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[#06b6d4] hover:border-[#06b6d4] transition-colors">
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 space-y-5">

        {/* ── Control panel ─────────────────────────────────────────────── */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
          <div className="grid md:grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-1.5">
                API base URL
              </label>
              <input
                value={apiBase}
                onChange={(e) => setApiBase(e.target.value)}
                disabled={simState === "running"}
                className="w-full rounded-lg bg-[var(--bg-raised)] border border-[var(--border)] px-3 py-2 font-mono text-sm focus:outline-none focus:border-[#06b6d4] disabled:opacity-50 text-[var(--text-secondary)]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-1.5">
                Interval: <span className="text-[#06b6d4] normal-case">{(intervalMs / 1000).toFixed(1)}s</span>
              </label>
              <input type="range" min={1000} max={10000} step={500} value={intervalMs}
                onChange={(e) => setIntervalMs(Number(e.target.value))}
                className="w-full accent-[#06b6d4] h-2" />
            </div>
          </div>

          {/* Traffic mix */}
          <div className="mb-5">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-2">Traffic mix</div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {(Object.keys(mix) as ScenarioLabel[]).map((k) => {
                const s = SCENARIO_STYLES[k];
                return (
                  <div key={k}>
                    <div className={`text-[11px] font-mono mb-1 ${s.color}`}>{k}: {mix[k]}%</div>
                    <input type="range" min={0} max={100} step={5} value={mix[k]}
                      onChange={(e) => setMix({ ...mix, [k]: Number(e.target.value) })}
                      className="w-full accent-[#06b6d4] h-1.5" />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-wrap gap-2 items-center">
            <button onClick={onStart} disabled={simState === "running"}
              className="rounded-lg bg-ok text-ink-900 dark:text-ink-900 font-bold px-5 py-2 text-sm disabled:opacity-40">
              ▶ Start
            </button>
            <button onClick={onPause} disabled={simState !== "running"}
              className="rounded-lg bg-warn text-ink-900 dark:text-ink-900 font-bold px-5 py-2 text-sm disabled:opacity-40">
              ❚❚ Pause
            </button>
            <button onClick={onResume} disabled={simState !== "paused"}
              className="rounded-lg border border-[#06b6d4] text-[#06b6d4] hover:bg-[#06b6d4]/10 font-bold px-5 py-2 text-sm disabled:opacity-40">
              ▶ Resume
            </button>
            <button onClick={onStop} disabled={simState === "stopped"}
              className="rounded-lg bg-danger text-white font-bold px-5 py-2 text-sm disabled:opacity-40">
              ■ Stop
            </button>
            <button onClick={onClear}
              className="rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-raised)] px-5 py-2 text-sm font-semibold">
              Clear
            </button>
            {/* State badge */}
            <div className="ml-auto flex items-center gap-1.5 rounded-full px-3 py-1 border border-[var(--border)] bg-[var(--bg-raised)] text-xs font-semibold text-[var(--text-secondary)]">
              <span className={`h-2 w-2 rounded-full ${stateBadge.dot}`} />
              {stateBadge.label}
            </div>
          </div>
        </div>

        {/* ── Stat cards ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Requests sent",    value: stats.total,      color: "text-[var(--text-primary)]" },
            { label: "Matches",          value: stats.matches,    color: "text-ok" },
            { label: "Mismatches",       value: stats.mismatches, color: stats.mismatches > 0 ? "text-warn" : "text-[var(--text-primary)]" },
            { label: "Errors",           value: stats.errors,     color: stats.errors > 0 ? "text-danger" : "text-[var(--text-primary)]" },
          ].map((c) => (
            <div key={c.label} className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">{c.label}</div>
              <div className={`text-3xl font-black mt-1 tabular-nums ${c.color}`}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* ── Scenario distribution ─────────────────────────────────────── */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
          <h2 className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-3">Generated scenarios</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {(Object.keys(stats.byScenario) as ScenarioLabel[]).map((k) => {
              const s = SCENARIO_STYLES[k];
              const pct = stats.total ? ((stats.byScenario[k] / stats.total) * 100).toFixed(0) : "0";
              return (
                <div key={k} className={`rounded-xl border ${s.bg} p-3`}>
                  <div className={`text-[11px] font-mono font-semibold ${s.color} mb-1`}>{s.icon} {k}</div>
                  <div className="text-2xl font-black tabular-nums text-[var(--text-primary)]">{stats.byScenario[k]}</div>
                  <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{pct}%</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Request / Response panels ─────────────────────────────────── */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
            <h2 className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-3">Latest generated request</h2>
            {lastReq ? (
              <>
                <pre className="text-[11px] font-mono text-[var(--text-secondary)] overflow-auto max-h-64 whitespace-pre-wrap break-all">
                  {JSON.stringify({ method: lastReq.method, path: lastReq.path, query: lastReq.query, body: lastReq.body }, null, 2)}
                </pre>
                <div className="mt-2 text-[11px] text-[var(--text-muted)]">
                  Ground-truth: <span className={`font-mono ${SCENARIO_STYLES[lastReq.scenario_label].color}`}>{lastReq.scenario_label}</span>
                  <span className="ml-2 opacity-60">(not a model input)</span>
                </div>
              </>
            ) : <div className="text-[11px] italic text-[var(--text-muted)]">No request yet — click Start</div>}
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
            <h2 className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-3">Latest server response</h2>
            {lastResp ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5 text-[11px] font-mono">
                  {[
                    { k: "prediction",  v: lastResp.prediction,                     t: lastResp.prediction === "ATTACK" ? "text-danger" : "text-ok" },
                    { k: "prob",        v: lastResp.attack_probability.toFixed(3),  t: "text-[var(--text-secondary)]" },
                    { k: "risk",        v: lastResp.risk_level,                     t: lastResp.risk_level === "HIGH" ? "text-danger" : lastResp.risk_level === "MEDIUM" ? "text-warn" : "text-ok" },
                    { k: "decision",    v: lastResp.decision,                       t: lastResp.decision === "BLOCK" ? "text-danger" : lastResp.decision === "MONITOR" ? "text-warn" : "text-ok" },
                    { k: "latency",     v: `${lastResp.inference_latency_ms.toFixed(0)}ms`, t: "text-[var(--text-muted)]" },
                  ].map((p) => (
                    <span key={p.k} className={`rounded-md border border-[var(--border)] bg-[var(--bg-raised)] px-2 py-0.5 ${p.t}`}>
                      <span className="text-[var(--text-muted)]">{p.k}: </span>{p.v}
                    </span>
                  ))}
                </div>
                <pre className="text-[11px] font-mono text-[var(--text-muted)] overflow-auto max-h-40 whitespace-pre-wrap">
                  {lastResp.reasons.join("\n")}
                </pre>
              </div>
            ) : <div className="text-[11px] italic text-[var(--text-muted)]">No response yet</div>}
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="rounded-xl border border-danger/40 bg-danger/8 text-danger px-4 py-3 text-sm font-mono">
            Error: {error}
          </div>
        )}

      </main>

      <footer className="mt-4 mb-8 text-center text-[11px] text-[var(--text-muted)]">
        IntelliAPI-AI-Simulator/1.0 · requests sent only to your local service
      </footer>
    </div>
  );
}
