import type { Stats } from "../types";

function Card({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-ink-600 bg-ink-800 p-4">
      <div className="text-[11px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${accent ?? "text-slate-100"}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

export default function StatCards({ stats }: { stats: Stats }) {
  const cards = [
    { label: "Total requests analyzed", value: stats.total_requests, accent: "text-slate-100" },
    { label: "Detected attacks", value: stats.detected_attacks, accent: stats.detected_attacks > 0 ? "text-danger" : "text-slate-100" },
    { label: "Allowed", value: stats.allowed_requests, accent: "text-ok" },
    { label: "Monitored", value: stats.monitored_requests, accent: "text-warn" },
    { label: "Blocked", value: stats.blocked_requests, accent: stats.blocked_requests > 0 ? "text-danger" : "text-slate-100" },
    {
      label: "Current attack rate",
      value: `${(stats.attack_rate * 100).toFixed(1)}%`,
      sub: "detected_attacks / total_requests",
      accent: "text-accent-soft",
    },
    {
      label: "Avg inference latency",
      value: `${stats.avg_inference_latency_ms.toFixed(1)} ms`,
      sub: "mean per-request agent latency",
      accent: "text-accent-soft",
    },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
      {cards.map((c) => (
        <Card key={c.label} label={c.label} value={String(c.value)} sub={c.sub} accent={c.accent} />
      ))}
    </div>
  );
}
