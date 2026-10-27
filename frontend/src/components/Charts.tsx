import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTheme } from "../context/ThemeContext";
import type { EventRecord, ModelInfo, Stats } from "../types";
import { buildRiskSeries, buildVolumeSeries } from "../utils/stats";

const COLORS = {
  normal: "#10b981",
  attack: "#f87171",
  sqli: "#fbbf24",
  xss: "#f87171",
  path_traversal: "#22d3ee",
  cmd_injection: "#c084fc",
  none: "#64748b",
  low: "#34d399",
  medium: "#fbbf24",
  high: "#f87171",
  allow: "#34d399",
  monitor: "#fbbf24",
  block: "#f87171",
};

const colorFor = (k: string) => (COLORS as Record<string, string>)[k.toLowerCase()] ?? "#67e8f9";

function Panel({ title, children, height = 220 }: { title: string; children: React.ReactNode; height?: number }) {
  return (
    <div className="card p-4">
      <h3 className="text-[11px] font-bold uppercase tracking-widest mb-3"
        style={{ color: "var(--text-muted)" }}>{title}</h3>
      <div style={{ height }}>{children}</div>
    </div>
  );
}

export default function Charts({ events, stats, modelInfo }: { events: EventRecord[]; stats: Stats; modelInfo: ModelInfo | null }) {
  const { isDark } = useTheme();
  const axisColor  = isDark ? "#475569" : "#6b87b8";
  const gridColor  = isDark ? "#1d2a3a" : "#dbe6f5";
  const tooltipBg  = isDark ? "var(--bg-raised)" : "#ffffff";
  const tooltipBdr = isDark ? "var(--border)"    : "#dbe6f5";
  const tooltipStyle = {
    background: tooltipBg,
    border: `1px solid ${tooltipBdr}`,
    borderRadius: 10,
    fontSize: 11,
    color: isDark ? "#e2e8f0" : "#0a1628",
  };

  const barFill = isDark ? "#22d3ee" : "#f97316";
  const hasEvents = events.length > 0;

  const atkTypeData = Object.entries(stats.attack_type_distribution).map(([name, value]) => ({ name, value }));
  const normalVsAttack = [
    { name: "Normal", value: stats.total_requests - stats.detected_attacks },
    { name: "Attack", value: stats.detected_attacks },
  ];
  const volumeData = buildVolumeSeries(events);
  const riskData = buildRiskSeries(events);
  const importanceData = (modelInfo?.feature_importance ?? [])
    .slice(0, 10)
    .map((f) => ({ name: f.name, importance: Number((f.importance * 100).toFixed(2)) }));

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Panel title="Attack category distribution">
        {hasEvents && atkTypeData.length ? (
          <ResponsiveContainer>
            <PieChart>
              <Pie data={atkTypeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={(d: { name: string }) => d.name}>
                {atkTypeData.map((d) => <Cell key={d.name} fill={colorFor(d.name)} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        ) : <Empty />}
      </Panel>

      <Panel title="Normal vs malicious traffic">
        {hasEvents ? (
          <ResponsiveContainer>
            <PieChart>
              <Pie data={normalVsAttack} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                <Cell fill={COLORS.normal} />
                <Cell fill={COLORS.attack} />
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        ) : <Empty />}
      </Panel>

      <Panel title="Request volume over time">
        {hasEvents && volumeData.length ? (
          <ResponsiveContainer>
            <LineChart data={volumeData} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
              <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
              <XAxis dataKey="t" stroke={axisColor} fontSize={10} tickMargin={6} minTickGap={40} />
              <YAxis stroke={axisColor} fontSize={10} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="total" stroke="#22d3ee" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="attacks" stroke="#f87171" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="normal" stroke="#34d399" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        ) : <Empty />}
      </Panel>

      <Panel title="Risk-score (attack probability) trend">
        {hasEvents && riskData.length ? (
          <ResponsiveContainer>
            <LineChart data={riskData} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
              <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
              <XAxis dataKey="idx" stroke={axisColor} fontSize={10} tickMargin={6} />
              <YAxis domain={[0, 1]} stroke={axisColor} fontSize={10} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="prob" stroke="#fbbf24" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        ) : <Empty />}
      </Panel>

      <Panel title="Top model features (global importance)" height={260}>
        {importanceData.length ? (
          <ResponsiveContainer>
            <BarChart data={importanceData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
              <CartesianGrid stroke={gridColor} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" stroke={axisColor} fontSize={10} />
              <YAxis type="category" dataKey="name" stroke={axisColor} fontSize={9} width={110} tickMargin={4} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}%`, "importance"]} />
              <Bar dataKey="importance" fill={barFill} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <Empty label="Feature importance available after /model-info loads" />}
      </Panel>
    </div>
  );
}

function Empty({ label }: { label?: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-2 text-[var(--text-muted)]">
      <span className="text-2xl">📊</span>
      <span className="text-xs italic">{label ?? "Waiting for live events…"}</span>
    </div>
  );
}
