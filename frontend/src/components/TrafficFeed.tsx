import { useEffect, useRef, useState } from "react";
import type { EventRecord, Filters } from "../types";

// ── colour helpers ────────────────────────────────────────────────────────────
function decisionBadge(d: string) {
  if (d === "BLOCK")   return "bg-danger/15 text-danger   border-danger/30";
  if (d === "MONITOR") return "bg-warn/15   text-warn     border-warn/30";
  return                      "bg-ok/15     text-ok       border-ok/30";
}
function predBadge(p: string) {
  return p === "ATTACK"
    ? "bg-danger/15 text-danger border-danger/30"
    : "bg-ok/15     text-ok     border-ok/30";
}
function riskBadge(r: string) {
  if (r === "HIGH")   return "bg-danger/15 text-danger border-danger/30";
  if (r === "MEDIUM") return "bg-warn/15   text-warn   border-warn/30";
  return                     "bg-ok/15     text-ok     border-ok/30";
}
function methodBadge(m: string) {
  if (m === "POST") return "bg-accent/15 text-accent border-accent/30";
  if (m === "PUT")  return "bg-warn/15   text-warn   border-warn/30";
  return                   "bg-[var(--bg-raised)] text-[var(--text-secondary)] border-[var(--border)]";
}

function Pill({ text, cls }: { text: string; cls: string }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ${cls}`}>
      {text}
    </span>
  );
}

function matchesFilters(e: EventRecord, f: Filters): boolean {
  if (f.prediction !== "ALL" && e.prediction !== f.prediction) return false;
  if (f.risk !== "ALL" && e.risk_level !== f.risk) return false;
  if (f.action !== "ALL" && e.decision !== f.action) return false;
  if (f.attackType !== "ALL" && (e.attack_type || "none") !== f.attackType) return false;
  return true;
}

// ── Row with flash-on-mount animation ─────────────────────────────────────────
function FeedRow({
  event, isSelected, isNew, onSelect,
}: {
  event: EventRecord;
  isSelected: boolean;
  isNew: boolean;
  onSelect: (e: EventRecord) => void;
}) {
  const [flash, setFlash] = useState(isNew);

  useEffect(() => {
    if (!isNew) return;
    const t = setTimeout(() => setFlash(false), 1200);
    return () => clearTimeout(t);
  }, [isNew]);

  return (
    <tr
      onClick={() => onSelect(event)}
      className={`
        cursor-pointer border-b border-[var(--border-subtle)]
        transition-colors duration-150
        ${flash ? "animate-row-flash" : ""}
        ${isSelected
          ? "bg-accent/8 dark:bg-accent/10"
          : "hover:bg-[var(--bg-raised)]"
        }
      `}
    >
      <td className="px-3 py-2.5 font-mono text-[11px] text-[var(--text-muted)] whitespace-nowrap">
        {new Date(event.timestamp).toLocaleTimeString()}
      </td>
      <td className="px-3 py-2.5">
        <Pill text={event.method} cls={methodBadge(event.method)} />
      </td>
      <td className="px-3 py-2.5 font-mono text-[11px] text-[var(--text-secondary)] truncate max-w-[170px]" title={event.path}>
        {event.path}
      </td>
      <td className="px-3 py-2.5">
        <Pill text={event.prediction} cls={predBadge(event.prediction)} />
      </td>
      <td className="px-3 py-2.5 font-mono text-[11px] text-[var(--text-secondary)] tabular-nums">
        {event.attack_probability.toFixed(3)}
      </td>
      <td className="px-3 py-2.5">
        <Pill text={event.risk_level} cls={riskBadge(event.risk_level)} />
      </td>
      <td className="px-3 py-2.5">
        <Pill text={event.decision} cls={decisionBadge(event.decision)} />
      </td>
      <td className="px-3 py-2.5 font-mono text-[11px] text-[var(--text-muted)] tabular-nums">
        {event.inference_latency_ms.toFixed(0)}ms
      </td>
    </tr>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function TrafficFeed({
  events, filters, selectedId, onSelect,
}: {
  events: EventRecord[];
  filters: Filters;
  selectedId: string | null;
  onSelect: (e: EventRecord) => void;
}) {
  const filtered = events.filter((e) => matchesFilters(e, filters));

  // Track which event IDs are "new" (first render for that id)
  const knownIds = useRef<Set<string>>(new Set());
  const newIds = new Set<string>();
  filtered.forEach((e) => {
    if (!knownIds.current.has(e.event_id)) {
      newIds.add(e.event_id);
      knownIds.current.add(e.event_id);
    }
  });

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          {/* Animated live dot */}
          <span className="h-2 w-2 rounded-full bg-ok animate-live-pulse" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Live traffic feed
          </h3>
        </div>
        <span className="text-[11px] font-mono text-[var(--text-muted)]">
          {filtered.length} shown · {events.length} total
        </span>
      </div>

      {/* Table */}
      <div className="overflow-auto max-h-[440px] flex-1">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[var(--text-muted)]">
            <div className="text-3xl mb-3">📡</div>
            <div className="text-sm font-medium">Waiting for traffic</div>
            <div className="text-[11px] mt-1">Start the simulator at localhost:5174</div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[var(--bg-raised)] border-b border-[var(--border)]">
                {["Time","Method","Endpoint","Prediction","Prob","Risk","Action","Latency"].map((h) => (
                  <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <FeedRow
                  key={e.event_id}
                  event={e}
                  isSelected={selectedId === e.event_id}
                  isNew={newIds.has(e.event_id)}
                  onSelect={onSelect}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
