import { useEffect, useRef, useState } from "react";
import type { EventRecord, Filters } from "../types";

function pill(text: string, bgCss: string, textCss: string, borderCss: string) {
  return { text, bgCss, textCss, borderCss };
}

function decisionPill(d: string) {
  if (d === "BLOCK")   return pill(d, "rgba(239,68,68,0.10)",  "#ef4444", "rgba(239,68,68,0.35)");
  if (d === "MONITOR") return pill(d, "rgba(245,158,11,0.10)", "#d97706", "rgba(245,158,11,0.35)");
  return                      pill(d, "rgba(16,185,129,0.10)", "#059669", "rgba(16,185,129,0.35)");
}
function predPill(p: string) {
  return p === "ATTACK"
    ? pill(p, "rgba(239,68,68,0.10)",  "#ef4444", "rgba(239,68,68,0.35)")
    : pill(p, "rgba(16,185,129,0.10)", "#059669", "rgba(16,185,129,0.35)");
}
function riskPill(r: string) {
  if (r === "HIGH")   return pill(r, "rgba(239,68,68,0.10)",  "#ef4444", "rgba(239,68,68,0.35)");
  if (r === "MEDIUM") return pill(r, "rgba(245,158,11,0.10)", "#d97706", "rgba(245,158,11,0.35)");
  return                     pill(r, "rgba(16,185,129,0.10)", "#059669", "rgba(16,185,129,0.35)");
}
function methodPill(m: string) {
  if (m === "POST") return pill(m, "var(--accent-bg)", "var(--accent-muted)", "var(--accent-border)");
  if (m === "PUT")  return pill(m, "rgba(245,158,11,0.10)", "#d97706", "rgba(245,158,11,0.35)");
  return pill(m, "var(--bg-sunken)", "var(--text-secondary)", "var(--border)");
}

function Chip({ p }: { p: ReturnType<typeof pill> }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      borderRadius: 6, border: `1px solid ${p.borderCss}`,
      padding: "1px 7px", fontSize: 10, fontWeight: 700,
      letterSpacing: "0.05em", fontFamily: "monospace",
      backgroundColor: p.bgCss, color: p.textCss,
    }}>
      {p.text}
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

function FeedRow({ event, isSelected, isNew, onSelect }: {
  event: EventRecord; isSelected: boolean; isNew: boolean; onSelect: (e: EventRecord) => void;
}) {
  const [flash, setFlash] = useState(isNew);
  useEffect(() => { if (!isNew) return; const t = setTimeout(() => setFlash(false), 1400); return () => clearTimeout(t); }, [isNew]);

  return (
    <tr
      onClick={() => onSelect(event)}
      className={`cursor-pointer transition-colors duration-100 ${flash ? "animate-row-flash" : ""}`}
      style={{
        borderBottom: "1px solid var(--border)",
        backgroundColor: isSelected
          ? "rgba(249,115,22,0.07)"
          : undefined,
      }}
      onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-raised)"; }}
      onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = ""; }}
    >
      <td className="px-3 py-2.5 font-mono text-[11px] whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
        {new Date(event.timestamp).toLocaleTimeString()}
      </td>
      <td className="px-3 py-2.5"><Chip p={methodPill(event.method)} /></td>
      <td className="px-3 py-2.5 font-mono text-[11px] truncate max-w-[160px]"
        title={event.path} style={{ color: "var(--text-secondary)" }}>
        {event.path}
      </td>
      <td className="px-3 py-2.5"><Chip p={predPill(event.prediction)} /></td>
      <td className="px-3 py-2.5 font-mono text-[11px] tabular-nums" style={{ color: "var(--text-secondary)" }}>
        {event.attack_probability.toFixed(3)}
      </td>
      <td className="px-3 py-2.5"><Chip p={riskPill(event.risk_level)} /></td>
      <td className="px-3 py-2.5"><Chip p={decisionPill(event.decision)} /></td>
      <td className="px-3 py-2.5 font-mono text-[11px] tabular-nums" style={{ color: "var(--text-muted)" }}>
        {event.inference_latency_ms.toFixed(0)}ms
      </td>
    </tr>
  );
}

export default function TrafficFeed({ events, filters, selectedId, onSelect }: {
  events: EventRecord[]; filters: Filters;
  selectedId: string | null; onSelect: (e: EventRecord) => void;
}) {
  const filtered = events.filter((e) => matchesFilters(e, filters));
  const knownIds = useRef<Set<string>>(new Set());
  const newIds   = new Set<string>();
  filtered.forEach((e) => { if (!knownIds.current.has(e.event_id)) { newIds.add(e.event_id); knownIds.current.add(e.event_id); } });

  const COLS = ["Time", "Method", "Endpoint", "Prediction", "Prob", "Risk", "Action", "Latency"];

  return (
    <div className="card overflow-hidden flex flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-raised)" }}>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-ok animate-live-pulse" />
          <span className="text-[11px] font-bold uppercase tracking-wider"
            style={{ color: "var(--text-secondary)" }}>Live Traffic</span>
        </div>
        <span className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>
          {filtered.length} shown · {events.length} total
        </span>
      </div>

      {/* Table */}
      <div className="overflow-auto" style={{ maxHeight: 460 }}>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2"
            style={{ color: "var(--text-muted)" }}>
            <div className="text-4xl">📡</div>
            <div className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>Waiting for traffic</div>
            <div className="text-[11px]">Start the simulator at localhost:5174</div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr style={{ backgroundColor: "var(--bg-raised)", borderBottom: "2px solid var(--border)" }}>
                {COLS.map((h) => (
                  <th key={h} className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: "var(--text-muted)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <FeedRow key={e.event_id} event={e}
                  isSelected={selectedId === e.event_id}
                  isNew={newIds.has(e.event_id)}
                  onSelect={onSelect} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
