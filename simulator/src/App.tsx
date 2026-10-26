import { useCallback, useEffect, useRef, useState } from "react";
import type { AnalyzeResponse, ScenarioLabel, SimRequest, SimState, SimStats, TrafficMix } from "./types";
import { DEFAULT_MIX, generateRequest } from "./scenarios/generator";
import { analyzeRequest, checkHealth } from "./services/api";

const API_DEFAULT = "http://127.0.0.1:8000";
const EMPTY_STATS: SimStats = {
  total: 0,
  byScenario: { normal: 0, sqli: 0, xss: 0, path_traversal: 0, cmd_injection: 0 },
  errors: 0,
  matches: 0,
  mismatches: 0,
};

const SCENARIO_COLORS: Record<ScenarioLabel, string> = {
  normal: "text-ok",
  sqli: "text-warn",
  xss: "text-danger",
  path_traversal: "text-accent-soft",
  cmd_injection: "text-fuchsia-400",
};

function agrees(prediction: string, scenario: ScenarioLabel): boolean {
  if (scenario === "normal") return prediction === "NORMAL";
  return prediction === "ATTACK";
}

export default function App() {
  const [apiBase, setApiBase] = useState(API_DEFAULT);
  const [intervalMs, setIntervalMs] = useState(4000);
  const [mix, setMix] = useState<TrafficMix>(DEFAULT_MIX);
  const [state, setState] = useState<SimState>("stopped");
  const [stats, setStats] = useState<SimStats>(EMPTY_STATS);
  const [lastReq, setLastReq] = useState<SimRequest | null>(null);
  const [lastResp, setLastResp] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<string>("unknown");

  // refs to avoid stale closures inside the interval callback
  const intervalRef = useRef<number | null>(null);
  const mixRef = useRef(mix);
  const apiBaseRef = useRef(apiBase);
  useEffect(() => { mixRef.current = mix; }, [mix]);
  useEffect(() => { apiBaseRef.current = apiBase; }, [apiBase]);

  const clearTimer = () => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const tick = useCallback(async () => {
    const req = generateRequest(mixRef.current);
    setLastReq(req);
    try {
      const resp = await analyzeRequest(apiBaseRef.current, req);
      setLastResp(resp);
      setStats((s) => {
        const ok = agrees(resp.prediction, req.scenario_label);
        const byScenario = { ...s.byScenario };
        byScenario[req.scenario_label] += 1;
        return {
          total: s.total + 1,
          byScenario,
          errors: s.errors,
          matches: s.matches + (ok ? 1 : 0),
          mismatches: s.mismatches + (ok ? 0 : 1),
        };
      });
      setError(null);
    } catch (e) {
      setLastResp(null);
      setStats((s) => ({ ...s, errors: s.errors + 1 }));
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const startTimer = () => {
    clearTimer();
    intervalRef.current = window.setInterval(() => { void tick(); }, intervalMs);
  };

  // health check on mount and when apiBase changes
  useEffect(() => {
    let active = true;
    checkHealth(apiBase)
      .then((h) => active && setHealth(h.model_loaded ? "connected" : "model_not_loaded"))
      .catch(() => active && setHealth("disconnected"));
    return () => { active = false; };
  }, [apiBase]);

  // keep timer in sync with interval while running
  useEffect(() => {
    if (state === "running") startTimer();
    return clearTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, state]);

  const onStart = () => {
    if (state === "stopped") {
      void tick(); // send one immediately so the user sees activity right away
    }
    setState("running");
  };
  const onPause = () => setState("paused");
  const onResume = () => setState("running");
  const onStop = () => { clearTimer(); setState("stopped"); };
  const onClearStats = () => { setStats(EMPTY_STATS); setLastReq(null); setLastResp(null); setError(null); };

  return (
    <div className="min-h-full bg-ink-900 text-slate-200">
      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              <span className="text-accent">IntelliAPI AI</span> · Traffic Simulator
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Generates HTTP requests every {intervalMs / 1000}s and sends them to the inference API.
            </p>
          </div>
          <div className="text-right">
            <span className={`inline-flex items-center gap-2 text-sm font-mono ${health === "connected" ? "text-ok" : "text-danger"}`}>
              <span className={`h-2.5 w-2.5 rounded-full ${health === "connected" ? "bg-ok" : "bg-danger"}`} />
              API: {health}
            </span>
          </div>
        </header>

        {/* Control bar */}
        <section className="rounded-xl border border-ink-600 bg-ink-800 p-5 mb-6">
          <div className="grid md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">API base URL</label>
              <input
                value={apiBase}
                onChange={(e) => setApiBase(e.target.value)}
                disabled={state === "running"}
                className="w-full rounded-lg bg-ink-900 border border-ink-600 px-3 py-2 font-mono text-sm focus:outline-none focus:border-accent disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                Generation interval: {intervalMs} ms ({(intervalMs / 1000).toFixed(1)}s)
              </label>
              <input
                type="range" min={1000} max={10000} step={500}
                value={intervalMs}
                onChange={(e) => setIntervalMs(Number(e.target.value))}
                className="w-full accent-accent"
              />
            </div>
          </div>

          {/* Traffic mix sliders */}
          <div className="mt-5">
            <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">Traffic mix (%)</label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {(Object.keys(mix) as ScenarioLabel[]).map((k) => (
                <div key={k}>
                  <div className={`text-xs font-mono mb-1 ${SCENARIO_COLORS[k]}`}>{k}: {mix[k]}%</div>
                  <input
                    type="range" min={0} max={100} step={5}
                    value={mix[k]}
                    onChange={(e) => setMix({ ...mix, [k]: Number(e.target.value) })}
                    className="w-full accent-accent"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Buttons */}
          <div className="mt-5 flex flex-wrap gap-3">
            <button onClick={onStart} disabled={state === "running"}
              className="rounded-lg bg-ok/90 hover:bg-ok text-ink-900 font-semibold px-5 py-2 disabled:opacity-40 disabled:cursor-not-allowed">
              ▶ Start
            </button>
            <button onClick={onPause} disabled={state !== "running"}
              className="rounded-lg bg-warn/90 hover:bg-warn text-ink-900 font-semibold px-5 py-2 disabled:opacity-40 disabled:cursor-not-allowed">
              ❚❚ Pause
            </button>
            <button onClick={onResume} disabled={state !== "paused"}
              className="rounded-lg bg-accent/90 hover:bg-accent text-ink-900 font-semibold px-5 py-2 disabled:opacity-40 disabled:cursor-not-allowed">
              ▶ Resume
            </button>
            <button onClick={onStop} disabled={state === "stopped"}
              className="rounded-lg bg-danger/90 hover:bg-danger text-white font-semibold px-5 py-2 disabled:opacity-40 disabled:cursor-not-allowed">
              ■ Stop
            </button>
            <button onClick={onClearStats}
              className="rounded-lg border border-ink-500 hover:bg-ink-700 text-slate-300 font-semibold px-5 py-2">
              Clear
            </button>
            <div className="ml-auto self-center">
              <StateBadge state={state} />
            </div>
          </div>
        </section>

        {/* Stat cards */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Requests sent" value={stats.total} />
          <StatCard label="Matches (model vs truth)" value={stats.matches} accent="ok" />
          <StatCard label="Mismatches" value={stats.mismatches} accent={stats.mismatches > 0 ? "warn" : undefined} />
          <StatCard label="Errors" value={stats.errors} accent={stats.errors > 0 ? "danger" : undefined} />
        </section>

        {/* Scenario distribution */}
        <section className="rounded-xl border border-ink-600 bg-ink-800 p-5 mb-6">
          <h2 className="text-sm uppercase tracking-wider text-slate-400 mb-3">Generated scenarios</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {(Object.keys(stats.byScenario) as ScenarioLabel[]).map((k) => (
              <div key={k} className="rounded-lg bg-ink-900 border border-ink-600 px-4 py-3">
                <div className={`text-xs font-mono ${SCENARIO_COLORS[k]}`}>{k}</div>
                <div className="text-2xl font-bold">{stats.byScenario[k]}</div>
                <div className="text-[11px] text-slate-500">{((stats.byScenario[k] / (stats.total || 1)) * 100).toFixed(0)}% of sent</div>
              </div>
            ))}
          </div>
        </section>

        {/* Latest request + response */}
        <div className="grid md:grid-cols-2 gap-6">
          <Panel title="Latest generated request">
            {lastReq ? (
              <pre className="text-xs font-mono text-slate-300 overflow-auto max-h-72">
                {JSON.stringify({ ...lastReq, headers: { "user-agent": lastReq.headers["user-agent"] } }, null, 2)}
              </pre>
            ) : <Empty label="No request generated yet" />}
            <div className="mt-3 text-xs text-slate-400">
              Ground-truth label:{" "}
              <span className={`font-mono ${lastReq ? SCENARIO_COLORS[lastReq.scenario_label] : ""}`}>
                {lastReq?.scenario_label ?? "—"}
              </span>{" "}
              <span className="text-slate-600">(stored for evaluation, not a model input)</span>
            </div>
          </Panel>

          <Panel title="Latest server response">
            {lastResp ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2 text-xs font-mono">
                  <Tag label="prediction" value={lastResp.prediction}
                    color={lastResp.prediction === "ATTACK" ? "danger" : "ok"} />
                  <Tag label="prob" value={lastResp.attack_probability.toFixed(3)} />
                  <Tag label="risk" value={lastResp.risk_level}
                    color={lastResp.risk_level === "HIGH" ? "danger" : lastResp.risk_level === "MEDIUM" ? "warn" : "ok"} />
                  <Tag label="decision" value={lastResp.decision}
                    color={lastResp.decision === "BLOCK" ? "danger" : lastResp.decision === "MONITOR" ? "warn" : "ok"} />
                  <Tag label="latency" value={`${lastResp.inference_latency_ms.toFixed(1)}ms`} />
                  <Tag label="attack_type" value={lastResp.attack_type ?? "—"} />
                </div>
                <pre className="text-xs font-mono text-slate-400 overflow-auto max-h-56">
                  {lastResp.reasons.join("\n")}
                </pre>
                <div className="text-xs text-slate-500">
                  Heuristic findings: {lastResp.heuristic_findings.length} · Model evidence: {lastResp.model_evidence.length}
                </div>
              </div>
            ) : <Empty label="No response yet" />}
          </Panel>
        </div>

        {error && (
          <div className="mt-6 rounded-lg border border-danger/40 bg-danger/10 text-danger px-4 py-3 text-sm font-mono">
            Error: {error}
          </div>
        )}

        <footer className="mt-10 text-center text-xs text-slate-600">
          IntelliAPI-AI-Simulator/1.0 · Educational prototype · Requests sent only to your local service
        </footer>
      </div>
    </div>
  );
}

function StateBadge({ state }: { state: SimState }) {
  const map = {
    stopped: { c: "bg-ink-600 text-slate-400", t: "Stopped" },
    running: { c: "bg-ok/20 text-ok", t: "Running" },
    paused: { c: "bg-warn/20 text-warn", t: "Paused" },
  } as const;
  const m = map[state];
  return <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${m.c}`}>
    <span className={`h-2 w-2 rounded-full ${state === "running" ? "bg-ok animate-pulse" : state === "paused" ? "bg-warn" : "bg-slate-500"}`} />
    {m.t}
  </span>;
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: "ok" | "warn" | "danger" }) {
  const color = accent === "ok" ? "text-ok" : accent === "warn" ? "text-warn" : accent === "danger" ? "text-danger" : "text-slate-100";
  return (
    <div className="rounded-xl border border-ink-600 bg-ink-800 p-4">
      <div className="text-xs uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`text-3xl font-bold mt-1 ${color}`}>{value}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-ink-600 bg-ink-800 p-5">
      <h2 className="text-sm uppercase tracking-wider text-slate-400 mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Tag({ label, value, color }: { label: string; value: string; color?: "ok" | "warn" | "danger" }) {
  const c = color === "ok" ? "text-ok border-ok/40" : color === "warn" ? "text-warn border-warn/40" : color === "danger" ? "text-danger border-danger/40" : "text-slate-300 border-ink-500";
  return <span className={`rounded border px-2 py-1 ${c}`}>{label}: {value}</span>;
}

function Empty({ label }: { label: string }) {
  return <div className="text-sm text-slate-500 italic">{label}</div>;
}
