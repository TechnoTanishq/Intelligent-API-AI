import type { Stats } from "../types";

interface CardDef {
  label: string;
  value: string;
  sub?: string;
  valueColor: string;   // CSS color string
  iconBg: string;       // Tailwind bg class
  icon: string;
  topBarColor: string;  // top accent line color
}

function StatCard({ label, value, sub, valueColor, icon, iconBg, topBarColor }: CardDef) {
  return (
    <div className="card relative overflow-hidden animate-fade-in">
      {/* Top accent bar */}
      <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-xl" style={{ backgroundColor: topBarColor }} />

      <div className="pt-5 pb-4 px-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 ${iconBg}`}>
            {icon}
          </div>
          <div className="text-right flex-1 min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-widest truncate"
              style={{ color: "var(--text-muted)" }}>
              {label}
            </div>
          </div>
        </div>
        <div className="text-[28px] font-black leading-none tabular-nums"
          style={{ color: valueColor }}>
          {value}
        </div>
        {sub && (
          <div className="mt-1.5 text-[10px]" style={{ color: "var(--text-muted)" }}>{sub}</div>
        )}
      </div>
    </div>
  );
}

export default function StatCards({ stats }: { stats: Stats }) {
  /* accent = orange in light, cyan in dark — use CSS var */
  const accentColor = "var(--accent)";

  const cards: CardDef[] = [
    {
      label: "Total Analysed",
      value: stats.total_requests.toLocaleString(),
      valueColor: "var(--text-primary)",
      icon: "⬡",
      iconBg: "bg-navy-100 dark:bg-ink-600",
      topBarColor: "var(--accent)",
    },
    {
      label: "Detected Attacks",
      value: stats.detected_attacks.toLocaleString(),
      valueColor: stats.detected_attacks > 0 ? "#ef4444" : "var(--text-primary)",
      icon: "🛡",
      iconBg: stats.detected_attacks > 0 ? "bg-red-100 dark:bg-red-900/30" : "bg-navy-100 dark:bg-ink-600",
      topBarColor: stats.detected_attacks > 0 ? "#ef4444" : "var(--border-heavy)",
    },
    {
      label: "Allowed",
      value: stats.allowed_requests.toLocaleString(),
      valueColor: "#10b981",
      icon: "✓",
      iconBg: "bg-emerald-100 dark:bg-emerald-900/25",
      topBarColor: "#10b981",
    },
    {
      label: "Monitored",
      value: stats.monitored_requests.toLocaleString(),
      valueColor: "#f59e0b",
      icon: "◎",
      iconBg: "bg-amber-100 dark:bg-amber-900/25",
      topBarColor: "#f59e0b",
    },
    {
      label: "Blocked",
      value: stats.blocked_requests.toLocaleString(),
      valueColor: stats.blocked_requests > 0 ? "#ef4444" : "var(--text-primary)",
      icon: "✕",
      iconBg: stats.blocked_requests > 0 ? "bg-red-100 dark:bg-red-900/30" : "bg-navy-100 dark:bg-ink-600",
      topBarColor: stats.blocked_requests > 0 ? "#ef4444" : "var(--border-heavy)",
    },
    {
      label: "Attack Rate",
      value: `${(stats.attack_rate * 100).toFixed(1)}%`,
      sub: "attacks ÷ total",
      valueColor: accentColor,
      icon: "%",
      iconBg: "bg-orange-100 dark:bg-cyan-900/25",
      topBarColor: accentColor,
    },
    {
      label: "Avg Latency",
      value: `${stats.avg_inference_latency_ms.toFixed(0)}ms`,
      sub: "per-request",
      valueColor: accentColor,
      icon: "⚡",
      iconBg: "bg-orange-100 dark:bg-cyan-900/25",
      topBarColor: accentColor,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
      {cards.map((c) => <StatCard key={c.label} {...c} />)}
    </div>
  );
}
