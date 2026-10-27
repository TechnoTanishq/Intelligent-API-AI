import type { EventRecord } from "../types";

function Pill({ label, value, tone }: { label: string; value: string; tone?: string }) {
  const base = "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-mono";
  const c =
    tone === "ok"     ? "text-ok    border-ok/40    bg-ok/8"    :
    tone === "warn"   ? "text-warn  border-warn/40  bg-warn/8"  :
    tone === "danger" ? "text-danger border-danger/40 bg-danger/8" :
    "text-[var(--text-secondary)] border-[var(--border)] bg-[var(--bg-raised)]";
  return <span className={`${base} ${c}`}><span className="text-[var(--text-muted)]">{label}:</span> {value}</span>;
}

function Block({ title, children, accent }: { title: string; children: React.ReactNode; accent?: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-raised)] overflow-hidden mb-3 last:mb-0">
      <div className={`px-3 py-2 border-b border-[var(--border)] flex items-center gap-2 ${accent ?? ""}`}>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">{title}</span>
      </div>
      <div className="px-3 py-3">{children}</div>
    </div>
  );
}

export default function ThreatPanel({ event }: { event: EventRecord | null }) {
  if (!event) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] flex flex-col items-center justify-center gap-3 min-h-[300px] p-6">
        <div className="h-12 w-12 rounded-full bg-[var(--bg-raised)] flex items-center justify-center text-2xl">🔍</div>
        <div className="text-center">
          <div className="text-sm font-medium text-[var(--text-secondary)]">No event selected</div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">
            Click any row in the feed to inspect its full threat analysis
          </div>
        </div>
      </div>
    );
  }

  const r = event.result;
  const present = r.model_evidence.filter((e) => e.present);
  const isAttack = r.prediction === "ATTACK";

  // Decide header accent strip colour
  const headerCls =
    r.decision === "BLOCK"   ? "bg-danger/10 border-b border-danger/20" :
    r.decision === "MONITOR" ? "bg-warn/10   border-b border-warn/20"   :
                               "bg-ok/10     border-b border-ok/20";
  const decisionCls =
    r.decision === "BLOCK"   ? "text-danger" :
    r.decision === "MONITOR" ? "text-warn"   : "text-ok";

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden flex flex-col max-h-[700px]">
      {/* ── Panel header ────────────────────────────────────────────────── */}
      <div className={`px-4 py-3 ${headerCls} flex items-center justify-between gap-2`}>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Threat Analysis
          </h3>
          <div className="font-mono text-[11px] text-[var(--text-muted)] mt-0.5 truncate max-w-[240px]">
            {event.event_id}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className={`text-lg font-black ${decisionCls}`}>{r.decision}</div>
          <div className="text-[10px] text-[var(--text-muted)] font-mono">
            {new Date(event.timestamp).toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* ── Scrollable body ─────────────────────────────────────────────── */}
      <div className="overflow-auto flex-1 p-3">

        {/* Quick summary pills */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <Pill label="prediction" value={r.prediction} tone={isAttack ? "danger" : "ok"} />
          {r.attack_type && <Pill label="type" value={r.attack_type} tone="warn" />}
          <Pill label="prob" value={r.attack_probability.toFixed(3)} />
          <Pill label="risk" value={r.risk_level} tone={r.risk_level === "HIGH" ? "danger" : r.risk_level === "MEDIUM" ? "warn" : "ok"} />
          <Pill label="latency" value={`${r.inference_latency_ms.toFixed(0)}ms`} />
          <Pill label="model" value={r.model_name} />
        </div>

        {/* Request details */}
        <Block title="Request">
          <div className="font-mono text-[11px] text-[var(--text-secondary)] space-y-1">
            <div><span className="text-[var(--text-muted)] mr-1">method</span>{event.method}</div>
            <div className="truncate"><span className="text-[var(--text-muted)] mr-1">path</span>{event.path || "/"}</div>
            <div className="truncate"><span className="text-[var(--text-muted)] mr-1">query</span>{event.query || <span className="italic text-[var(--text-muted)]">(none)</span>}</div>
            <div><span className="text-[var(--text-muted)] mr-1">body len</span>{String(r.request_summary?.body_length ?? 0)}</div>
            {event.scenario_label && (
              <div><span className="text-[var(--text-muted)] mr-1">sim label</span>
                <span className="text-accent-soft">{event.scenario_label}</span>
              </div>
            )}
          </div>
        </Block>

        {/* Decision policy */}
        <Block title="Decision policy">
          <div className="font-mono text-[11px] text-[var(--text-secondary)] break-words">{r.decision_policy}</div>
          {r.escalated_by_heuristics && (
            <div className="mt-2 text-[11px] text-warn flex items-center gap-1.5">
              <span>⬆</span>
              <span>Heuristics escalated from <strong>{r.base_action}</strong> to <strong>{r.decision}</strong></span>
            </div>
          )}
        </Block>

        {/* Reasons */}
        <Block title="Why this decision">
          <ul className="space-y-1.5">
            {r.reasons.map((rsn, i) => (
              <li key={i} className="flex gap-2 text-[12px] text-[var(--text-secondary)]">
                <span className="text-[var(--text-muted)] mt-0.5 flex-shrink-0">›</span>
                <span>{rsn}</span>
              </li>
            ))}
          </ul>
        </Block>

        {/* Model evidence */}
        <Block title={`Model evidence (${present.length} features active)`}>
          {present.length ? (
            <div className="flex flex-wrap gap-1.5">
              {present.map((e) => (
                <span
                  key={e.feature}
                  className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--bg-sunken)] px-2 py-1 text-[10px] font-mono text-[var(--text-secondary)]"
                >
                  {e.feature}
                  <span className="ml-1.5 text-accent opacity-80">{(e.importance * 100).toFixed(1)}%</span>
                </span>
              ))}
            </div>
          ) : (
            <div className="text-[11px] italic text-[var(--text-muted)]">No high-importance features present in this request.</div>
          )}
        </Block>

        {/* Heuristic findings */}
        <Block title={`Heuristic findings (${r.heuristic_findings.length}) — separate from model`}>
          {r.heuristic_findings.length ? (
            <ul className="space-y-2">
              {r.heuristic_findings.map((h, i) => (
                <li key={i} className="rounded-lg bg-[var(--bg-sunken)] border border-[var(--border)] p-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex rounded-md border border-warn/40 bg-warn/10 text-warn px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                      {h.type}
                    </span>
                    <span className="text-[11px] text-[var(--text-secondary)]">{h.description}</span>
                  </div>
                  <div className="font-mono text-[11px] text-danger break-all">
                    <span className="text-[var(--text-muted)] mr-1">evidence:</span>{h.evidence}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-[11px] italic text-[var(--text-muted)]">No heuristic indicators triggered.</div>
          )}
        </Block>

        {/* Decision tree path */}
        {r.decision_tree_path.length > 0 && (
          <Block title="Decision tree path (interpretable baseline)">
            <ol className="space-y-0.5">
              {r.decision_tree_path.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-[11px] font-mono text-[var(--text-secondary)]">
                  <span className="text-[var(--text-muted)] w-5 text-right flex-shrink-0">{i + 1}.</span>
                  {s.leaf ? (
                    <span className="text-accent-soft font-semibold">→ predict {s.prediction}</span>
                  ) : (
                    <span>
                      {s.feature}{" "}
                      <span className="text-warn">{s.direction}</span>{" "}
                      {s.threshold}
                      <span className="text-[var(--text-muted)] ml-1.5">(val {s.value})</span>
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </Block>
        )}

      </div>
    </div>
  );
}
