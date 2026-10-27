import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import StatCards from "./components/StatCards";
import Charts from "./components/Charts";
import ConfusionMatrix from "./components/ConfusionMatrix";
import TrafficFeed from "./components/TrafficFeed";
import ThreatPanel from "./components/ThreatPanel";
import FiltersBar from "./components/Filters";
import ToastContainer, { type ToastItem } from "./components/Toast";
import { useTheme } from "./context/ThemeContext";
import { useEventStream } from "./hooks/useEventStream";
import { clearEvents, fetchModelInfo, fetchRecentEvents } from "./services/api";
import { computeStats } from "./utils/stats";
import type { EventRecord, Filters, ModelInfo } from "./types";

const API_DEFAULT = "http://127.0.0.1:8000";
const DEFAULT_FILTERS: Filters = { prediction: "ALL", risk: "ALL", action: "ALL", attackType: "ALL" };

function SunIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-[15px] w-[15px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-[15px] w-[15px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/>
    </svg>
  );
}

export default function App() {
  const { isDark, toggle: toggleTheme } = useTheme();

  const [apiBase, setApiBase]     = useState(API_DEFAULT);
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [selected, setSelected]   = useState<EventRecord | null>(null);
  const [filters, setFilters]     = useState<Filters>(DEFAULT_FILTERS);
  const [paused, setPaused]       = useState(false);
  const [frozen, setFrozen]       = useState<EventRecord[] | null>(null);
  const [toasts, setToasts]       = useState<ToastItem[]>([]);

  const { events, status, clear: clearBuffer, seed } = useEventStream(apiBase, false);

  useEffect(() => {
    let active = true;
    setModelError(null);
    fetchModelInfo(apiBase)
      .then((m) => active && setModelInfo(m))
      .catch((e) => active && setModelError(e instanceof Error ? e.message : String(e)));
    fetchRecentEvents(apiBase, 100)
      .then((evs) => active && seed(evs))
      .catch(() => {});
    return () => { active = false; };
  }, [apiBase, seed]);

  // Toast on new events
  const seenIds       = useRef<Set<string>>(new Set());
  const isFirstBatch  = useRef(true);
  useEffect(() => {
    if (events.length === 0) return;
    if (isFirstBatch.current) { events.forEach((e) => seenIds.current.add(e.event_id)); isFirstBatch.current = false; return; }
    const newEvs = events.filter((e) => !seenIds.current.has(e.event_id));
    newEvs.forEach((e) => seenIds.current.add(e.event_id));
    if (newEvs.length === 0) return;
    const ev = newEvs[0];
    setToasts((prev) => [{
      id: `t-${ev.event_id}`,
      decision: ev.decision as ToastItem["decision"],
      prediction: ev.prediction as ToastItem["prediction"],
      path: ev.path, method: ev.method,
      probability: ev.attack_probability, attackType: ev.attack_type,
    }, ...prev].slice(0, 5));
  }, [events]);

  const dismissToast = useCallback((id: string) => setToasts((p) => p.filter((t) => t.id !== id)), []);

  const displayed = paused && frozen ? frozen : events;
  const stats = useMemo(() => computeStats(displayed), [displayed]);

  const selectedIdRef = useRef<string | null>(null);
  useEffect(() => { selectedIdRef.current = selected?.event_id ?? null; }, [selected]);
  useEffect(() => {
    if (paused || !selectedIdRef.current) return;
    const fresh = events.find((e) => e.event_id === selectedIdRef.current);
    if (fresh) setSelected(fresh);
  }, [events, paused]);

  const onTogglePause    = () => setPaused((p) => { const n = !p; if (n) setFrozen(events); else setFrozen(null); return n; });
  const onClearView      = () => { clearBuffer(); setFrozen(null); setSelected(null); seenIds.current.clear(); isFirstBatch.current = true; };
  const onClearBackend   = async () => { try { await clearEvents(apiBase); } catch { /* */ } onClearView(); };

  const wsLabel = { connected: "Live", connecting: "Connecting…", disconnected: "Offline" } as const;
  const wsDot   = { connected: "bg-ok animate-live-pulse", connecting: "bg-warn animate-pulse", disconnected: "bg-danger" } as const;
  const wsText  = { connected: "text-ok", connecting: "text-warn", disconnected: "text-danger" } as const;

  return (
    <div className="min-h-full" style={{ backgroundColor: "var(--bg-page)", color: "var(--text-primary)" }}>
      <ToastContainer toasts={toasts} onDone={dismissToast} />

      {/* ═══ HEADER — deep navy ═══════════════════════════════════════════ */}
      <header className="sticky top-0 z-40 shadow-header" style={{ backgroundColor: "var(--bg-header)" }}>
        <div className="mx-auto max-w-7xl px-5 h-14 flex items-center justify-between gap-4">

          {/* Brand */}
          <div className="flex items-center gap-3">
            {/* Shield */}
            <div className="flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: "rgba(249,115,22,0.18)" }}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none"
                viewBox="0 0 24 24" stroke="var(--accent)" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
              </svg>
            </div>
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-extrabold tracking-tight leading-none"
                  style={{ color: "var(--accent)" }}>IntelliAPI AI</span>
                <span className="text-[11px] font-normal hidden sm:inline"
                  style={{ color: "var(--text-on-header-m)" }}>Security Dashboard</span>
              </div>
              <div className="text-[10px] mt-0.5 hidden md:block"
                style={{ color: "var(--text-on-header-m)" }}>
                Real-time threat detection · explainable AI
              </div>
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            {/* WS pill */}
            <div className={`hidden sm:inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold border ${wsText[status]}`}
              style={{ borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.07)" }}>
              <span className={`h-1.5 w-1.5 rounded-full ${wsDot[status]}`} />
              {wsLabel[status]}
            </div>

            {/* API URL */}
            <input
              value={apiBase}
              onChange={(e) => setApiBase(e.target.value)}
              className="hidden md:block rounded-lg px-3 py-1.5 text-xs font-mono w-40 focus:outline-none"
              style={{
                backgroundColor: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.14)",
                color: "var(--text-on-header)",
              }}
              title="Backend API base URL"
            />

            {/* Theme toggle */}
            <button onClick={toggleTheme}
              title={isDark ? "Light mode" : "Dark mode"}
              className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors"
              style={{
                backgroundColor: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.14)",
                color: "var(--text-on-header)",
              }}>
              {isDark ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </div>
      </header>

      {/* ═══ BODY ════════════════════════════════════════════════════════════ */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-7 space-y-8">

        {modelError && (
          <div className="rounded-xl border border-danger/40 px-4 py-3 text-sm flex items-center gap-3 text-danger"
            style={{ backgroundColor: "rgba(239,68,68,0.06)" }}>
            <span className="text-lg flex-shrink-0">⚠</span>
            <span><strong>Backend unreachable:</strong> {modelError} — is the server running at {apiBase}?</span>
          </div>
        )}

        <section>
          <SectionStripe label="Live Statistics" />
          <StatCards stats={stats} />
        </section>

        <section>
          <SectionStripe label="Visualisations" />
          <Charts events={displayed} stats={stats} modelInfo={modelInfo} />
        </section>

        <section>
          <SectionStripe label="Model Evaluation — Held-Out Test Set" />
          <ConfusionMatrix modelInfo={modelInfo} />
        </section>

        <section className="space-y-3">
          <SectionStripe label="Live Traffic Feed" />
          <FiltersBar
            filters={filters}
            onChange={setFilters}
            paused={paused}
            onTogglePause={onTogglePause}
            onClear={onClearView}
            onClearBackend={onClearBackend}
          />
          <div className="grid lg:grid-cols-2 gap-5">
            <TrafficFeed events={displayed} filters={filters}
              selectedId={selected?.event_id ?? null} onSelect={setSelected} />
            <ThreatPanel event={selected} />
          </div>
        </section>

      </main>

      <footer className="py-8 text-center text-[11px]" style={{ color: "var(--text-muted)" }}>
        IntelliAPI AI · AIL-L4 mini-project · educational prototype ·
        model metrics from labelled test set · live stats from analysed traffic
      </footer>
    </div>
  );
}

/* ── Section stripe heading ─────────────────────────────────────────────── */
function SectionStripe({ label }: { label: string }) {
  return (
    <div className="rounded-lg px-4 py-2 mb-4 flex items-center gap-3"
      style={{ backgroundColor: "var(--stripe-bg)" }}>
      <span className="h-3.5 w-1 rounded-full flex-shrink-0"
        style={{ backgroundColor: "var(--accent)" }} />
      <span className="text-[11px] font-bold uppercase tracking-widest"
        style={{ color: "var(--stripe-text)" }}>
        {label}
      </span>
    </div>
  );
}
