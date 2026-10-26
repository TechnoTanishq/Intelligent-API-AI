import type { ModelInfo } from "../types";

function Metric({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg bg-ink-900 border border-ink-600 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-lg font-bold ${accent ?? "text-slate-100"}`}>{value}</div>
    </div>
  );
}

export default function ConfusionMatrix({ modelInfo }: { modelInfo: ModelInfo | null }) {
  if (!modelInfo) {
    return (
      <div className="rounded-xl border border-ink-600 bg-ink-800 p-4">
        <h3 className="text-xs uppercase tracking-wider text-slate-400 mb-3">Model evaluation (held-out test set)</h3>
        <div className="text-sm text-slate-500 italic">Loading /model-info…</div>
      </div>
    );
  }
  const cm = modelInfo.confusion_matrix; // [[TN,FP],[FN,TP]]
  const tn = cm[0]?.[0] ?? 0, fp = cm[0]?.[1] ?? 0, fn = cm[1]?.[0] ?? 0, tp = cm[1]?.[1] ?? 0;
  const cell = (v: number, label: string, tone: string) => (
    <div className={`rounded-lg p-3 text-center border ${tone}`}>
      <div className="text-[10px] uppercase tracking-wider opacity-70">{label}</div>
      <div className="text-2xl font-bold">{v}</div>
    </div>
  );
  return (
    <div className="rounded-xl border border-ink-600 bg-ink-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs uppercase tracking-wider text-slate-400">Model evaluation (held-out test set)</h3>
        <span className="text-[11px] text-slate-500 font-mono">{modelInfo.primary_model} · v{modelInfo.model_version}</span>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-4">
        <Metric label="Accuracy" value={`${(modelInfo.accuracy * 100).toFixed(2)}%`} accent="text-ok" />
        <Metric label="Precision" value={modelInfo.precision.toFixed(4)} />
        <Metric label="Recall" value={modelInfo.recall.toFixed(4)} />
        <Metric label="F1" value={modelInfo.f1.toFixed(4)} />
        <Metric label="FPR" value={modelInfo.false_positive_rate.toFixed(4)} accent="text-warn" />
        <Metric label="FNR" value={modelInfo.false_negative_rate.toFixed(4)} accent="text-warn" />
        <Metric label="Threshold ALLOW" value={`p<${modelInfo.risk_thresholds.risk_low_max}`} />
        <Metric label="Threshold BLOCK" value={`p>=${modelInfo.risk_thresholds.risk_high_min}`} />
      </div>

      <div className="grid grid-cols-2 gap-2 max-w-sm">
        <div className="text-[11px] text-slate-500 text-center">Predicted NORMAL</div>
        <div className="text-[11px] text-slate-500 text-center">Predicted ATTACK</div>
        <div className="text-[11px] text-slate-500 self-center text-right pr-2">Actual NORMAL</div>
        {cell(tn, "True Neg", "border-ok/40 bg-ok/10 text-ok")}
        {cell(fp, "False Pos", "border-warn/40 bg-warn/10 text-warn")}
        <div className="text-[11px] text-slate-500 self-center text-right pr-2">Actual ATTACK</div>
        {cell(fn, "False Neg", "border-danger/40 bg-danger/10 text-danger")}
        {cell(tp, "True Pos", "border-ok/40 bg-ok/10 text-ok")}
      </div>
      <p className="text-[11px] text-slate-500 mt-3">
        Metrics are from the labelled test set used during training — NOT from simulated traffic.
      </p>
    </div>
  );
}
