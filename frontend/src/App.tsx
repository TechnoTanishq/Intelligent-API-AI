import { useEffect, useMemo, useRef, useState } from "react";
import StatCards from "./components/StatCards";
import Charts from "./components/Charts";
import ConfusionMatrix from "./components/ConfusionMatrix";
import TrafficFeed from "./components/TrafficFeed";
import ThreatPanel from "./components/ThreatPanel";
import FiltersBar from "./components/Filters";
import { useEventStream } from "./hooks/useEventStream";
import { clearEvents, fetchModelInfo, fetchRecentEvents } from "./services/api";
import { computeStats } from "./utils/stats";
import type { EventRecord, Filters, ModelInfo } from "./types";

const API_DEFAULT = "http://127.0.0.1:8000";
const DEFAULT_FILTERS: Filters = { prediction: "ALL", risk: "ALL", action: "ALL", attackType: "ALL" };

export default function App() {
  const [apiBase, setApiBase] = useState(API_DEFAULT);
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [selected, setSelected] = useState<EventRecord | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [paused, setPaused] = useState(false);
  const [frozen, setFrozen] = useState<EventRecord[] | null>(null);

  const { events, status, clear: clearBuffer, seed } = useEventStream(apiBase, false);

  // Load model info + recent history on mount and when apiBase changes.
  useEffect(() => {
    let active = true;
    setModelError(null);
    fetchModelInfo(apiBase)
      .then((m) => active && setModelInfo(m))
      .catch((e) => active && setModelError(e instanceof Error ? e.message : String(e)));
    fetchRecentEvents(apiBase, 100)
      .then((evs) => active && seed(evs))
      .catch(() => {/* backend may be empty */ });
    return () => { active = false; };
  }, [apiBase, seed]);

  // Freeze view when pausing; resume shows live buffer.
  const displayed = paused && frozen ? frozen : events;
  const stats = useMemo(() => computeStats(displayed), [displayed]);

  // Keep selected event in sync with live updates (refresh its data) if not paused.
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
      if (next) setFrozen(events);
      else setFrozen(null);
      return next;
    });
  };
  const onClearView = () => { clearBuffer(); setFrozen(null); setSelected(null); };
  const onClearBackend = async () => {
    try { await clearEvents(apiBase); } catch { /* ignore */ }
    clearBuffer(); setFrozen(null); setSelected(null);
  };

  const statusColor = status === "connected" ? "text-ok" : status === "connecting" ? "text-warn" : "text-danger";
  const statusDot = status === "connected" ? "bg-ok" : status === "connecting" ? "bg-warn animate-pulse" : "bg-danger";

  return (
    <div className="min-h-full bg-ink-900 text-slate-200">
      <div className="mx-auto max-w-7xl px-6 py-6">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              <span className="text-accent">IntelliAPI AI</span> · Security Dashboard
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Real-time API threat detection · intelligent agent · explainable decisions
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span className={`inline-flex items-center gap-2 font-mono ${statusColor}`}>
                <span className={`h-2.5 w-2.5 rounded-full ${statusDot}`} />
                WS: {status}
              </span>
            </div>
            <input
              value={apiBase}
              onChange={(e) => setApiBase(e.target.value)}
              className="bg-ink-800 border border-ink-600 rounded-lg px-3 py-1.5 text-sm font-mono w-44 focus:outline-none focus:border-accent"
              title="Backend API base URL"
            />
          </div>
        </header>

        {modelError && (
          <div className="rounded-lg border border-danger/40 bg-danger/10 text-danger px-4 py-3 text-sm mb-4 font-mono">
            Could not load /model-info: {modelError}. Is the backend running at {apiBase}?
          </div>
        )}

        {/* Stat cards */}
        <section className="mb-6">
          <StatCards stats={stats} />
        </section>

        {/* Charts row */}
        <section className="mb-6">
          <Charts events={displayed} stats={stats} modelInfo={modelInfo} />
        </section>

        {/* Confusion matrix */}
        <section className="mb-6">
          <ConfusionMatrix modelInfo={modelInfo} />
        </section>

        {/* Controls */}
        <section className="mb-4">
          <FiltersBar
            filters={filters}
            onChange={setFilters}
            paused={paused}
            onTogglePause={onTogglePause}
            onClear={onClearView}
            onClearBackend={onClearBackend}
          />
        </section>

        {/* Feed + threat panel */}
        <section className="grid lg:grid-cols-2 gap-4">
          <TrafficFeed events={displayed} filters={filters} selectedId={selected?.event_id ?? null} onSelect={setSelected} />
          <ThreatPanel event={selected} />
        </section>

        <footer className="mt-10 text-center text-xs text-slate-600">
          IntelliAPI AI · educational prototype · model metrics from labelled test set · live stats from analyzed traffic
        </footer>
      </div>
    </div>
  );
}
