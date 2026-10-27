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

// ─── Sun icon ────────────────────────────────────────────────────────────────
function SunIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

// ─── Moon icon ───────────────────────────────────────────────────────────────
function MoonIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
    </svg>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const { isDark, toggle: toggleTheme } = useTheme();

  const [apiBase, setApiBase] = useState(API_DEFAULT);
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [selected, setSelected] = useState<EventRecord | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [paused, setPaused] = useState(false);
  const [frozen, setFrozen] = useState<EventRecord[] | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const { events, status, clear: clearBuffer, seed } = useEventStream(apiBase, false);

  // ── Seed model info + historical events on mount / apiBase change ──────────
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

  // ── Toast: fire on every NEW incoming event (not historical seeds) ─────────
  const seenIds = useRef<Set<string>>(new Set());
  const isFirstBatch = useRef(true);

  useEffect(() => {
    if (events.length === 0) return;
    // Skip the very first batch (historical events loaded on mount)
    if (isFirstBatch.current) {
      events.forEach((e) => seenIds.current.add(e.event_id));
      isFirstBatch.current = false;
      return;
    }
    // Find truly new events
    const newEvents = events.filter((e) => !seenIds.current.has(e.event_id));
    newEvents.forEach((e) => seenIds.current.add(e.event_id));
    if (newEvents.length === 0) return;

    const latest = newEvents[0]; // newest is at index 0
    const toast: ToastItem = {
      id: `toast-${latest.event_id}`,
      decision: latest.decision as ToastItem["decision"],
      prediction: latest.prediction as ToastItem["prediction"],
      path: latest.path,
      method: latest.method,
      probability: latest.attack_probability,
      attackType: latest.attack_type,
    };
    setToasts((prev) => [toast, ...prev].slice(0, 5)); // max 5 toasts at once
  }, [events]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Freeze/unfreeze display on pause ──────────────────────────────────────
  const displayed = paused && frozen ? frozen : events;
  const stats = useMemo(() => computeStats(displayed), [displayed]);

  // Keep selected row in sync if not paused
  const selectedIdRef = useRef<string | null>(null);
  useEffect(() => { selectedIdRef.current = selected?.event_id ?? null; }, [selected]);
  useEffect(() => {
    if (paused || !selectedIdRef.current) return;
    const fresh = events.find((e) => e.event_id === selectedIdRef.current);
    if (fresh) setSelected(fresh);
  }, [events, paused]);

  const onTogglePause = () => {
    setPaused((p) => {
      const next = !p;
      if (next) setFrozen(events); else setFrozen(null);
      return next;
    });
  };
  const onClearView = () => { clearBuffer(); setFrozen(null); setSelected(null); seenIds.current.clear(); isFirstBatch.current = true; };
  const onClearBackend = async () => {
    try { await clearEvents(apiBase); } catch { /* ignore */ }
    onClearView();
  };

  // ── WS status colours ─────────────────────────────────────────────────────
  const wsColors = {
    connected:    "text-ok",
    connecting:   "text-warn",
    disconnected: "text-danger",
  } as const;
  const wsDots = {
    connected:    "bg-ok animate-live-pulse",
    connecting:   "bg-warn animate-pulse",
    disconnected: "bg-danger",
  } as const;

  return (
    <div className="min-h-full bg-[var(--bg-base)] text-[var(--text-primary)] transition-colors duration-200">
      {/* Toast portal */}
      <ToastContainer toasts={toasts} onDone={dismissToast} />

      {/* ── Sticky top nav ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg-surface)]/90 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-6 h-14 flex items-center justify-between gap-4">

          {/* Brand */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Shield icon */}
            <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-accent/15 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold tracking-tight leading-none">
                <span className="text-accent">IntelliAPI AI</span>
                <span className="text-[var(--text-muted)] font-normal ml-1 hidden sm:inline">· Security Dashboard</span>
              </h1>
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5 hidden md:block">
                Real-time API threat detection · explainable decisions
              </p>
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* WS status pill */}
            <div className={`hidden sm:inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-mono border border-[var(--border)] ${wsColors[status]}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${wsDots[status]}`} />
              <span>{status}</span>
            </div>

            {/* API URL input */}
            <input
              value={apiBase}
              onChange={(e) => setApiBase(e.target.value)}
              className="hidden md:block bg-[var(--bg-raised)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs font-mono w-40 focus:outline-none focus:border-accent text-[var(--text-secondary)] placeholder:text-[var(--text-muted)]"
              title="Backend API base URL"
              placeholder="http://127.0.0.1:8000"
            />

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
              className="h-8 w-8 rounded-lg flex items-center justify-center
                bg-[var(--bg-raised)] border border-[var(--border)]
                text-[var(--text-secondary)] hover:text-accent hover:border-accent
                transition-colors duration-150"
            >
              {isDark ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </div>
      </header>

      {/* ── Page body ──────────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">

        {/* API error banner */}
        {modelError && (
          <div className="rounded-xl border border-danger/40 bg-danger/8 text-danger px-4 py-3 text-sm flex items-center gap-3">
            <span className="text-lg">⚠</span>
            <span><span className="font-semibold">Cannot reach backend:</span> {modelError}</span>
          </div>
        )}

        {/* Stat cards */}
        <section>
          <SectionLabel>Live statistics</SectionLabel>
          <StatCards stats={stats} />
        </section>

        {/* Charts */}
        <section>
          <SectionLabel>Visualisations</SectionLabel>
          <Charts events={displayed} stats={stats} modelInfo={modelInfo} />
        </section>

        {/* Model evaluation */}
        <section>
          <SectionLabel>Model evaluation (held-out test set)</SectionLabel>
          <ConfusionMatrix modelInfo={modelInfo} />
        </section>

        {/* Filters + feed + panel */}
        <section className="space-y-3">
          <SectionLabel>Live traffic</SectionLabel>
          <FiltersBar
            filters={filters}
            onChange={setFilters}
            paused={paused}
            onTogglePause={onTogglePause}
            onClear={onClearView}
            onClearBackend={onClearBackend}
          />
          <div className="grid lg:grid-cols-2 gap-4">
            <TrafficFeed
              events={displayed}
              filters={filters}
              selectedId={selected?.event_id ?? null}
              onSelect={setSelected}
            />
            <ThreatPanel event={selected} />
          </div>
        </section>

      </main>

      <footer className="mt-6 mb-8 text-center text-[11px] text-[var(--text-muted)]">
        IntelliAPI AI · AIL-L4 mini-project · educational prototype ·{" "}
        model metrics from labelled test set · live stats from analyzed traffic
      </footer>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-3 flex items-center gap-2">
      <span className="flex-1 h-px bg-[var(--border)]" />
      {children}
      <span className="flex-1 h-px bg-[var(--border)]" />
    </h2>
  );
}
