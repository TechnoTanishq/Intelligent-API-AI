import type { EventRecord, Filters } from "../types";

function decisionClass(d: string): string {
  return d === "BLOCK" ? "text-danger" : d === "MONITOR" ? "text-warn" : "text-ok";
}
function predictionClass(p: string): string {
  return p === "ATTACK" ? "text-danger" : "text-ok";
}
function riskClass(r: string): string {
  return r === "HIGH" ? "text-danger" : r === "MEDIUM" ? "text-warn" : "text-ok";
}

function matchesFilters(e: EventRecord, f: Filters): boolean {
  if (f.prediction !== "ALL" && e.prediction !== f.prediction) return false;
  if (f.risk !== "ALL" && e.risk_level !== f.risk) return false;
  if (f.action !== "ALL" && e.decision !== f.action) return false;
  if (f.attackType !== "ALL" && (e.attack_type || "none") !== f.attackType) return false;
  return true;
}

export default function TrafficFeed({
  events, filters, selectedId, onSelect,
}: {
  events: EventRecord[];
  filters: Filters;
  selectedId: string | null;
  onSelect: (e: EventRecord) => void;
}) {
  const filtered = events.filter((e) => matchesFilters(e, filters));

  return (
    <div className="rounded-xl border border-ink-600 bg-ink-800 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-ink-600">
        <h3 className="text-xs uppercase tracking-wider text-slate-400">Live traffic feed</h3>
        <span className="text-[11px] text-slate-500 font-mono">{filtered.length} shown · {events.length} total</span>
      </div>
      <div className="overflow-auto max-h-[420px]">
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-slate-500 bg-ink-700 sticky top-0">
            <tr>
              <th className="text-left px-3 py-2">Timestamp</th>
              <th className="text-left px-3 py-2">Event ID</th>
              <th className="text-left px-3 py-2">Method</th>
              <th className="text-left px-3 py-2">Endpoint</th>
              <th className="text-left px-3 py-2">Prediction</th>
              <th className="text-left px-3 py-2">Prob</th>
              <th className="text-left px-3 py-2">Risk</th>
              <th className="text-left px-3 py-2">Action</th>
              <th className="text-left px-3 py-2">Latency</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-slate-500 italic">
                  No events yet. Start the traffic simulator to see live requests analyzed here.
                </td>
              </tr>
            )}
            {filtered.map((e) => (
              <tr
                key={e.event_id}
                onClick={() => onSelect(e)}
                className={`cursor-pointer border-b border-ink-700 hover:bg-ink-700/60 ${selectedId === e.event_id ? "bg-ink-700/80" : ""}`}
              >
                <td className="px-3 py-2 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                  {new Date(e.timestamp).toLocaleTimeString()}
                </td>
                <td className="px-3 py-2 font-mono text-[11px] text-slate-400 truncate max-w-[120px]">{e.event_id}</td>
                <td className="px-3 py-2 font-mono text-[11px]">{e.method}</td>
                <td className="px-3 py-2 font-mono text-[11px] truncate max-w-[180px]" title={e.path}>{e.path}</td>
                <td className={`px-3 py-2 font-semibold ${predictionClass(e.prediction)}`}>{e.prediction}</td>
                <td className="px-3 py-2 font-mono text-[11px]">{e.attack_probability.toFixed(3)}</td>
                <td className={`px-3 py-2 font-semibold ${riskClass(e.risk_level)}`}>{e.risk_level}</td>
                <td className={`px-3 py-2 font-semibold ${decisionClass(e.decision)}`}>{e.decision}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-slate-400">{e.inference_latency_ms.toFixed(1)}ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
