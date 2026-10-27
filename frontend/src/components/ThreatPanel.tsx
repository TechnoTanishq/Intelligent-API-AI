import type { EventRecord } from "../types";

function Pill({ label, value, color, bg, border }: {
  label: string; value: string; color?: string; bg?: string; border?: string;
}) {
  return (
    <span style={{
      display: "inline-flex", gap: 4, alignItems: "center",
      borderRadius: 7, border: `1px solid ${border ?? "var(--border)"}`,
      padding: "2px 9px", fontSize: 11, fontFamily: "monospace",
      backgroundColor: bg ?? "var(--bg-raised)", color: color ?? "var(--text-secondary)",
    }}>
      <span style={{ color: "var(--text-muted)", marginRight: 1 }}>{label}:</span>
      <span style={{ fontWeight: 700 }}>{value}</span>
    </span>
  );
}

function Section({ title, accent, children }: { title: string; accent?: boolean; children: React.ReactNode }) {
  return (
    <div className="card-inner overflow-hidden mb-3 last:mb-0">
      <div className="px-3 py-2 flex items-center gap-2"
        style={{ borderBottom: "1px solid var(--border)", backgroundColor: accent ? "var(--accent-bg)" : "var(--bg-raised)" }}>
        {accent && <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: "var(--accent)" }} />}
        <span className="text-[10px] font-bold uppercase tracking-widest"
          style={{ color: accent ? "var(--accent-muted)" : "var(--text-muted)" }}>
          {title}
        </span>
      </div>
      <div className="px-3 py-3">{children}</div>
    </div>
  );
}

export default function ThreatPanel({ event }: { event: EventRecord | null }) {
  if (!event) {
    return (
      <div className="card flex flex-col items-center justify-center gap-4 min-h-[300px] p-8">
        <div className="h-14 w-14 rounded-2xl flex items-center justify-center text-2xl"
          style={{ backgroundColor: "var(--bg-sunken)" }}>🔍</div>
        <div className="text-center">
          <div className="font-semibold text-sm" style={{ color: "var(--text-secondary)" }}>
            No event selected
          </div>
          <div className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
            Click any row in the feed to inspect its full threat analysis
          </div>
        </div>
      </div>
    );
  }

  const r = event.result;
  const isBlock   = r.decision === "BLOCK";
  const isMonitor = r.decision === "MONITOR";
  const isAttack  = r.prediction === "ATTACK";

  const headerBg     = isBlock ? "rgba(239,68,68,0.08)"  : isMonitor ? "rgba(245,158,11,0.08)"  : "rgba(16,185,129,0.06)";
  const headerBorder = isBlock ? "rgba(239,68,68,0.25)"  : isMonitor ? "rgba(245,158,11,0.25)"  : "rgba(16,185,129,0.20)";
  const decisionColor= isBlock ? "#ef4444"               : isMonitor ? "#d97706"                : "#059669";

  const present = r.model_evidence.filter((e) => e.present);

  return (
    <div className="card overflow-hidden flex flex-col" style={{ maxHeight: 700 }}>
      {/* Coloured header */}
      <div className="px-4 py-3 flex items-center justify-between flex-shrink-0"
        style={{ backgroundColor: headerBg, borderBottom: `1px solid ${headerBorder}` }}>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
            Threat Analysis
          </div>
          <div className="font-mono text-[11px] mt-0.5 truncate max-w-[220px]"
            style={{ color: "var(--text-secondary)" }}>
            {event.event_id}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-black" style={{ color: decisionColor }}>{r.decision}</div>
          <div className="text-[10px] font-mono mt-0.5" style={{ color: "var(--text-muted)" }}>
            {new Date(event.timestamp).toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="overflow-auto flex-1 p-3">

        {/* Quick pills */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <Pill label="prediction" value={r.prediction}
            color={isAttack ? "#ef4444" : "#059669"}
            bg={isAttack ? "rgba(239,68,68,0.08)" : "rgba(16,185,129,0.08)"}
            border={isAttack ? "rgba(239,68,68,0.30)" : "rgba(16,185,129,0.30)"} />
          {r.attack_type && (
            <Pill label="type" value={r.attack_type}
              color="var(--accent-muted)" bg="var(--accent-bg)" border="var(--accent-border)" />
          )}
          <Pill label="prob" value={r.attack_probability.toFixed(3)} />
          <Pill label="risk" value={r.risk_level}
            color={r.risk_level === "HIGH" ? "#ef4444" : r.risk_level === "MEDIUM" ? "#d97706" : "#059669"}
            bg={r.risk_level === "HIGH" ? "rgba(239,68,68,0.08)" : r.risk_level === "MEDIUM" ? "rgba(245,158,11,0.08)" : "rgba(16,185,129,0.08)"}
            border={r.risk_level === "HIGH" ? "rgba(239,68,68,0.30)" : r.risk_level === "MEDIUM" ? "rgba(245,158,11,0.30)" : "rgba(16,185,129,0.30)"} />
          <Pill label="latency" value={`${r.inference_latency_ms.toFixed(0)}ms`} />
          <Pill label="model" value={r.model_name} />
        </div>

        {/* Request */}
        <Section title="Request">
          <div className="font-mono text-[11px] space-y-1" style={{ color: "var(--text-secondary)" }}>
            <div><span style={{ color: "var(--text-muted)" }}>method  </span>{event.method}</div>
            <div className="truncate"><span style={{ color: "var(--text-muted)" }}>path    </span>{event.path || "/"}</div>
            <div className="truncate"><span style={{ color: "var(--text-muted)" }}>query   </span>{event.query || <em style={{ color: "var(--text-muted)" }}>(none)</em>}</div>
            <div><span style={{ color: "var(--text-muted)" }}>bodylen </span>{String(r.request_summary?.body_length ?? 0)}</div>
            {event.scenario_label && (
              <div><span style={{ color: "var(--text-muted)" }}>sim tag </span>
                <span style={{ color: "var(--accent)" }}>{event.scenario_label}</span>
              </div>
            )}
          </div>
        </Section>

        {/* Decision policy */}
        <Section title="Decision Policy" accent>
          <div className="font-mono text-[11px] break-words" style={{ color: "var(--text-secondary)" }}>
            {r.decision_policy}
          </div>
          {r.escalated_by_heuristics && (
            <div className="mt-2 text-[11px] flex items-center gap-1.5"
              style={{ color: "#d97706" }}>
              <span>⬆</span>
              <span>Heuristics escalated <strong>{r.base_action}</strong> → <strong>{r.decision}</strong></span>
            </div>
          )}
        </Section>

        {/* Why */}
        <Section title="Why This Decision">
          <ul className="space-y-1.5">
            {r.reasons.map((rsn, i) => (
              <li key={i} className="flex gap-2 text-[12px]" style={{ color: "var(--text-secondary)" }}>
                <span className="flex-shrink-0 mt-0.5" style={{ color: "var(--accent)" }}>›</span>
                {rsn}
              </li>
            ))}
          </ul>
        </Section>

        {/* Model evidence */}
        <Section title={`Model Evidence (${present.length} features active)`}>
          {present.length ? (
            <div className="flex flex-wrap gap-1.5">
              {present.map((e) => (
                <span key={e.feature} style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  borderRadius: 6, border: "1px solid var(--border)",
                  padding: "3px 8px", fontSize: 10, fontFamily: "monospace",
                  backgroundColor: "var(--bg-sunken)", color: "var(--text-secondary)",
                }}>
                  {e.feature}
                  <span style={{ color: "var(--accent)", fontWeight: 700 }}>
                    {(e.importance * 100).toFixed(1)}%
                  </span>
                </span>
              ))}
            </div>
          ) : (
            <div className="text-[11px] italic" style={{ color: "var(--text-muted)" }}>
              No high-importance features active in this request.
            </div>
          )}
        </Section>

        {/* Heuristics */}
        <Section title={`Heuristic Findings (${r.heuristic_findings.length}) — separate from model`}>
          {r.heuristic_findings.length ? (
            <ul className="space-y-2">
              {r.heuristic_findings.map((h, i) => (
                <li key={i} className="rounded-lg p-2.5"
                  style={{ backgroundColor: "var(--bg-sunken)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span style={{
                      display: "inline-flex", borderRadius: 5,
                      padding: "1px 7px", fontSize: 10, fontWeight: 700,
                      letterSpacing: "0.06em", fontFamily: "monospace",
                      backgroundColor: "rgba(245,158,11,0.12)",
                      border: "1px solid rgba(245,158,11,0.35)", color: "#d97706",
                    }}>{h.type.toUpperCase()}</span>
                    <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{h.description}</span>
                  </div>
                  <div className="font-mono text-[10px] break-all" style={{ color: "#ef4444" }}>
                    <span style={{ color: "var(--text-muted)" }}>evidence: </span>{h.evidence}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-[11px] italic" style={{ color: "var(--text-muted)" }}>
              No heuristic indicators triggered.
            </div>
          )}
        </Section>

        {/* DT path */}
        {r.decision_tree_path.length > 0 && (
          <Section title="Decision Tree Path (Interpretable Baseline)">
            <ol className="space-y-0.5">
              {r.decision_tree_path.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-[11px] font-mono"
                  style={{ color: "var(--text-secondary)" }}>
                  <span className="w-5 text-right flex-shrink-0" style={{ color: "var(--text-muted)" }}>{i + 1}.</span>
                  {s.leaf
                    ? <span style={{ color: "var(--accent)", fontWeight: 700 }}>→ predict {s.prediction}</span>
                    : <span>
                        {s.feature}{" "}
                        <span style={{ color: "#d97706" }}>{s.direction}</span>{" "}
                        {s.threshold}
                        <span style={{ color: "var(--text-muted)" }}> (val {s.value})</span>
                      </span>
                  }
                </li>
              ))}
            </ol>
          </Section>
        )}

      </div>
    </div>
  );
}
