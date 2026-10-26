import type { EventRecord } from "../types";

function Pill({ label, value, tone }: { label: string; value: string; tone?: string }) {
  const c = tone === "ok" ? "text-ok border-ok/40"
    : tone === "warn" ? "text-warn border-warn/40"
    : tone === "danger" ? "text-danger border-danger/40"
    : "text-slate-300 border-ink-500";
  return <span className={`inline-block rounded border px-2 py-0.5 text-xs font-mono ${c}`}>{label}: {value}</span>;
}

export default function ThreatPanel({ event }: { event: EventRecord | null }) {
  if (!event) {
    return (
      <div className="rounded-xl border border-ink-600 bg-ink-800 p-4 h-full flex items-center justify-center">
        <div className="text-sm text-slate-500 italic text-center">
          Select a row in the live traffic feed to inspect its full threat analysis and explanation.
        </div>
      </div>
    );
  }
  const r = event.result;
  const present = r.model_evidence.filter((e) => e.present);
  return (
    <div className="rounded-xl border border-ink-600 bg-ink-800 p-4 overflow-auto max-h-[640px]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs uppercase tracking-wider text-slate-400">Threat analysis · {event.event_id}</h3>
        <span className="text-[11px] text-slate-500 font-mono">{new Date(event.timestamp).toLocaleString()}</span>
      </div>

      {/* Request details */}
      <div className="rounded-lg bg-ink-900 border border-ink-600 p-3 mb-3 font-mono text-[11px] text-slate-300 space-y-1">
        <div><span className="text-slate-500">method:</span> {event.method}</div>
        <div className="truncate"><span className="text-slate-500">path:</span> {event.path}</div>
        <div className="truncate"><span className="text-slate-500">query:</span> {event.query || <span className="text-slate-600">(none)</span>}</div>
        <div className="truncate"><span className="text-slate-500">body len:</span> {String(r.request_summary?.body_length ?? 0)}</div>
        {event.scenario_label && (
          <div><span className="text-slate-500">simulator ground-truth:</span> <span className="text-accent-soft">{event.scenario_label}</span></div>
        )}
      </div>

      {/* Prediction / risk / decision */}
      <div className="flex flex-wrap gap-2 mb-3">
        <Pill label="prediction" value={r.prediction} tone={r.prediction === "ATTACK" ? "danger" : "ok"} />
        <Pill label="attack_type" value={r.attack_type ?? "—"} />
        <Pill label="probability" value={r.attack_probability.toFixed(3)} />
        <Pill label="risk" value={r.risk_level} tone={r.risk_level === "HIGH" ? "danger" : r.risk_level === "MEDIUM" ? "warn" : "ok"} />
        <Pill label="decision" value={r.decision} tone={r.decision === "BLOCK" ? "danger" : r.decision === "MONITOR" ? "warn" : "ok"} />
        <Pill label="latency" value={`${r.inference_latency_ms.toFixed(1)}ms`} />
        <Pill label="model" value={r.model_name} />
      </div>

      {/* Decision policy */}
      <div className="rounded-lg bg-ink-900 border border-ink-600 p-3 mb-3">
        <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Decision policy</div>
        <div className="font-mono text-[11px] text-slate-300">{r.decision_policy}</div>
        {r.escalated_by_heuristics && (
          <div className="text-[11px] text-warn mt-1">Heuristics escalated this decision (base action: {r.base_action}).</div>
        )}
      </div>

      {/* Reasons / explanation */}
      <div className="rounded-lg bg-ink-900 border border-ink-600 p-3 mb-3">
        <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Why this decision (reasons)</div>
        <ul className="list-disc list-inside text-[12px] text-slate-300 space-y-1">
          {r.reasons.map((rsn, i) => <li key={i}>{rsn}</li>)}
        </ul>
      </div>

      {/* Model evidence */}
      <div className="rounded-lg bg-ink-900 border border-ink-600 p-3 mb-3">
        <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">
          Model evidence (top contributing features present in this request)
        </div>
        {present.length ? (
          <div className="flex flex-wrap gap-2">
            {present.map((e) => (
              <span key={e.feature} className="rounded bg-ink-700 border border-ink-500 px-2 py-1 text-[11px] font-mono">
                {e.feature} <span className="text-slate-500">({(e.importance * 100).toFixed(2)}%)</span>
              </span>
            ))}
          </div>
        ) : <div className="text-[12px] text-slate-500 italic">No high-importance suspicious model features present.</div>}
      </div>

      {/* Heuristic findings */}
      <div className="rounded-lg bg-ink-900 border border-ink-600 p-3 mb-3">
        <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Heuristic findings (separate from model)</div>
        {r.heuristic_findings.length ? (
          <ul className="space-y-1">
            {r.heuristic_findings.map((h, i) => (
              <li key={i} className="text-[12px]">
                <span className="font-mono text-warn">{h.type}</span>{" "}
                <span className="text-slate-300">{h.description}</span>
                <div className="font-mono text-[11px] text-danger break-all">evidence: {h.evidence}</div>
              </li>
            ))}
          </ul>
        ) : <div className="text-[12px] text-slate-500 italic">No heuristic indicators triggered.</div>}
      </div>

      {/* Decision tree path (interpretable baseline) */}
      {r.decision_tree_path.length > 0 && (
        <div className="rounded-lg bg-ink-900 border border-ink-600 p-3">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Decision Tree path (interpretable baseline)</div>
          <ol className="list-decimal list-inside text-[11px] font-mono text-slate-300 space-y-0.5">
            {r.decision_tree_path.map((s, i) => (
              <li key={i}>
                {s.leaf
                  ? <span className="text-accent-soft">leaf → predict {s.prediction}</span>
                  : <span>{s.feature} {s.direction} {s.threshold} <span className="text-slate-600">(val {s.value})</span></span>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
