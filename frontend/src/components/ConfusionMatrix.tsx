import type { ModelInfo } from "../types";

function MetricTile({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-raised)] px-3 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-1">{label}</div>
      <div className={`text-lg font-bold tabular-nums ${accent ?? "text-[var(--text-primary)]"}`}>{value}</div>
    </div>
  );
}

function CMCell({ value, label, tone }: { value: number; label: string; tone: "ok" | "warn" | "danger" }) {
  const cls = {
    ok:     "border-ok/40    bg-ok/8    text-ok",
    warn:   "border-warn/40  bg-warn/8  text-warn",
    danger: "border-danger/40 bg-danger/8 text-danger",
  }[tone];
  return (
    <div className={`rounded-xl border p-4 text-center ${cls}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70 mb-1">{label}</div>
      <div className="text-3xl font-black tabular-nums">{value.toLocaleString()}</div>
    </div>
  );
}

export default function ConfusionMatrix({ modelInfo }: { modelInfo: ModelInfo | null }) {
  if (!modelInfo) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-2 w-2 rounded-full bg-warn animate-pulse" />
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Model evaluation — loading…
          </span>
        </div>
      </div>
    );
  }

  const cm = modelInfo.confusion_matrix;
  const tn = cm[0]?.[0] ?? 0, fp = cm[0]?.[1] ?? 0;
  const fn = cm[1]?.[0] ?? 0, tp = cm[1]?.[1] ?? 0;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Model Evaluation</h3>
          <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
            Held-out test set · not from live traffic
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-ok/40 bg-ok/10 text-ok px-2.5 py-1 text-xs font-bold">
            {(modelInfo.accuracy * 100).toFixed(2)}% Accuracy
          </span>
          <span className="text-[11px] font-mono text-[var(--text-muted)]">
            {modelInfo.primary_model} v{modelInfo.model_version}
          </span>
        </div>
      </div>

      {/* Metric grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
        <MetricTile label="Precision" value={modelInfo.precision.toFixed(4)} />
        <MetricTile label="Recall"    value={modelInfo.recall.toFixed(4)} />
        <MetricTile label="F1 score"  value={modelInfo.f1.toFixed(4)} accent="text-ok" />
        <MetricTile label="FPR"       value={modelInfo.false_positive_rate.toFixed(4)} accent="text-warn" />
        <MetricTile label="FNR"       value={modelInfo.false_negative_rate.toFixed(4)} accent="text-warn" />
        <MetricTile label="ALLOW if"  value={`p < ${modelInfo.risk_thresholds.risk_low_max}`} />
        <MetricTile label="BLOCK if"  value={`p ≥ ${modelInfo.risk_thresholds.risk_high_min}`} />
        <MetricTile label="Test rows" value={(tn + fp + fn + tp).toLocaleString()} />
      </div>

      {/* Confusion matrix grid */}
      <div className="grid grid-cols-[auto_1fr_1fr] gap-2 max-w-md items-center">
        <div />
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] text-center">Pred NORMAL</div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] text-center">Pred ATTACK</div>

        <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] text-right pr-2 leading-tight">
          Actual<br/>NORMAL
        </div>
        <CMCell value={tn} label="True Neg" tone="ok" />
        <CMCell value={fp} label="False Pos" tone="warn" />

        <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] text-right pr-2 leading-tight">
          Actual<br/>ATTACK
        </div>
        <CMCell value={fn} label="False Neg" tone="danger" />
        <CMCell value={tp} label="True Pos" tone="ok" />
      </div>
    </div>
  );
}
