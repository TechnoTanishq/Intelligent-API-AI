import type { Stats } from "../types";

interface CardDef {
  label: string;
  value: string;
  sub?: string;
  accent: string;
  icon: string;
  gradient: string;
}

function StatCard({ label, value, sub, accent, icon, gradient }: CardDef) {
  return (
    <div className={`relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-card-dark dark:shadow-card-dark shadow-card-light transition-shadow hover:shadow-md`}>
      {/* Subtle gradient splash in corner */}
      <div className={`pointer-events-none absolute -top-4 -right-4 h-16 w-16 rounded-full opacity-10 blur-xl ${gradient}`} />

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-2 truncate">
            {label}
          </div>
          <div className={`text-2xl font-bold leading-none tabular-nums ${accent}`}>
            {value}
          </div>
          {sub && (
            <div className="mt-1.5 text-[10px] text-[var(--text-muted)] truncate">{sub}</div>
          )}
        </div>
        <div className={`flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-base ${gradient} bg-opacity-15`}>
          <span>{icon}</span>
        </div>
      </div>
    </div>
  );
}

export default function StatCards({ stats }: { stats: Stats }) {
  const cards: CardDef[] = [
    {
      label: "Total analysed",
      value: stats.total_requests.toLocaleString(),
      accent: "text-[var(--text-primary)]",
      icon: "⬡",
      gradient: "bg-accent",
    },
    {
      label: "Detected attacks",
      value: stats.detected_attacks.toLocaleString(),
      accent: stats.detected_attacks > 0 ? "text-danger" : "text-[var(--text-primary)]",
      icon: "🛡",
      gradient: "bg-danger",
    },
    {
      label: "Allowed",
      value: stats.allowed_requests.toLocaleString(),
      accent: "text-ok",
      icon: "✓",
      gradient: "bg-ok",
    },
    {
      label: "Monitored",
      value: stats.monitored_requests.toLocaleString(),
      accent: "text-warn",
      icon: "◎",
      gradient: "bg-warn",
    },
    {
      label: "Blocked",
      value: stats.blocked_requests.toLocaleString(),
      accent: stats.blocked_requests > 0 ? "text-danger" : "text-[var(--text-primary)]",
      icon: "✕",
      gradient: "bg-danger",
    },
    {
      label: "Attack rate",
      value: `${(stats.attack_rate * 100).toFixed(1)}%`,
      sub: "attacks ÷ total",
      accent: "text-accent-soft",
      icon: "%",
      gradient: "bg-accent",
    },
    {
      label: "Avg latency",
      value: `${stats.avg_inference_latency_ms.toFixed(0)} ms`,
      sub: "per-request agent",
      accent: "text-accent-soft",
      icon: "⚡",
      gradient: "bg-accent",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
      {cards.map((c) => <StatCard key={c.label} {...c} />)}
    </div>
  );
}
