import type { ModelInfo } from "../types";

function Tile({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="rounded-xl p-3" style={{ backgroundColor: "var(--bg-raised)", border: "1px solid var(--border)" }}>
      <div className="text-[10px] font-bold uppercase tracking-widest mb-1.5"
        style={{ color: "var(--text-muted)" }}>{label}</div>
      <div className="text-lg font-black tabular-nums"
        style={{ color: valueColor ?? "var(--text-primary)" }}>{value}</div>
    </div>
  );
}

function CMCell({ value, label, color, bg, border }: {
  value: number; label: string; color: string; bg: string; border: string;
}) {
  return (
    <div className="rounded-xl p-4 text-center"
      style={{ backgroundColor: bg, border: `1px solid ${border}` }}>
      <div className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-75" style={{ color }}>
        {label}
      </div>
      <div className="text-3xl font-black tabular-nums" style={{ color }}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}

export default function ConfusionMatrix({ modelInfo }: { modelInfo: ModelInfo | null }) {
  if (!modelInfo) {
    return (
      <div className="card p-5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-warn animate-pulse" />
          <span className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}>
            Loading model info…
          </span>
        </div>
      </div>
    );
  }

  const cm = modelInfo.confusion_matrix;
  const tn = cm[0]?.[0] ?? 0, fp = cm[0]?.[1] ?? 0;
  const fn = cm[1]?.[0] ?? 0, tp = cm[1]?.[1] ?? 0;

  return (
    <div className="card p-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h3 className="font-bold text-base" style={{ color: "var(--text-primary)" }}>
            Model Evaluation Metrics
          </h3>
          <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
            Measured on the held-out test set (20% of 33,379 deduplicated records) — not from live traffic
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Big accuracy badge */}
          <div className="rounded-xl px-4 py-2 text-center"
            style={{ backgroundColor: "var(--accent-bg)", border: "2px solid var(--accent-border)" }}>
            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--accent-muted)" }}>
              Accuracy
            </div>
            <div className="text-2xl font-black" style={{ color: "var(--accent)" }}>
              {(modelInfo.accuracy * 100).toFixed(2)}%
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
              {modelInfo.primary_model}
            </div>
            <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              v{modelInfo.model_version}
            </div>
          </div>
        </div>
      </div>

      {/* Metric tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
        <Tile label="Precision"   value={modelInfo.precision.toFixed(4)} />
        <Tile label="Recall"      value={modelInfo.recall.toFixed(4)} />
        <Tile label="F1 Score"    value={modelInfo.f1.toFixed(4)}
          valueColor="#059669" />
        <Tile label="FPR"         value={modelInfo.false_positive_rate.toFixed(4)}
          valueColor="#d97706" />
        <Tile label="FNR"         value={modelInfo.false_negative_rate.toFixed(4)}
          valueColor="#d97706" />
        <Tile label="ALLOW if"    value={`p < ${modelInfo.risk_thresholds.risk_low_max}`} />
        <Tile label="BLOCK if"    value={`p ≥ ${modelInfo.risk_thresholds.risk_high_min}`} />
        <Tile label="Test Rows"   value={(tn+fp+fn+tp).toLocaleString()} />
      </div>

      {/* Confusion matrix */}
      <div className="font-semibold text-[11px] mb-2 uppercase tracking-wider"
        style={{ color: "var(--text-muted)" }}>Confusion Matrix</div>
      <div className="grid grid-cols-[auto_1fr_1fr] gap-2 max-w-sm items-center">
        <div />
        <div className="text-[10px] font-bold uppercase tracking-wider text-center"
          style={{ color: "var(--text-muted)" }}>Pred NORMAL</div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-center"
          style={{ color: "var(--text-muted)" }}>Pred ATTACK</div>

        <div className="text-[10px] font-bold uppercase tracking-wider text-right pr-2 leading-tight"
          style={{ color: "var(--text-muted)" }}>Actual<br/>NORMAL</div>
        <CMCell value={tn} label="True Neg"
          color="#059669" bg="rgba(16,185,129,0.07)" border="rgba(16,185,129,0.25)" />
        <CMCell value={fp} label="False Pos"
          color="#d97706" bg="rgba(245,158,11,0.07)" border="rgba(245,158,11,0.25)" />

        <div className="text-[10px] font-bold uppercase tracking-wider text-right pr-2 leading-tight"
          style={{ color: "var(--text-muted)" }}>Actual<br/>ATTACK</div>
        <CMCell value={fn} label="False Neg"
          color="#ef4444" bg="rgba(239,68,68,0.07)" border="rgba(239,68,68,0.25)" />
        <CMCell value={tp} label="True Pos"
          color="#059669" bg="rgba(16,185,129,0.07)" border="rgba(16,185,129,0.25)" />
      </div>
    </div>
  );
}
