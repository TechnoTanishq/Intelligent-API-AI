import type { Filters as FiltersType } from "../types";

function Select({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 min-w-[96px]">
      <span className="text-[10px] font-bold uppercase tracking-widest"
        style={{ color: "var(--text-muted)" }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg px-2.5 py-1.5 text-xs cursor-pointer focus:outline-none"
        style={{
          backgroundColor: "var(--bg-raised)",
          border: "1px solid var(--border)",
          color: "var(--text-secondary)",
        }}
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function ActionBtn({ onClick, children, variant = "default" }: {
  onClick: () => void; children: React.ReactNode; variant?: "default" | "danger" | "active";
}) {
  const styles: Record<string, React.CSSProperties> = {
    default: { backgroundColor: "var(--bg-raised)", border: "1px solid var(--border)", color: "var(--text-secondary)" },
    danger:  { backgroundColor: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.30)", color: "#ef4444" },
    active:  { backgroundColor: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.35)", color: "#059669" },
  };
  return (
    <button onClick={onClick}
      className="rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
      style={styles[variant]}>
      {children}
    </button>
  );
}

export default function FiltersBar({ filters, onChange, paused, onTogglePause, onClear, onClearBackend }: {
  filters: FiltersType; onChange: (f: FiltersType) => void;
  paused: boolean; onTogglePause: () => void; onClear: () => void; onClearBackend: () => void;
}) {
  const set = (patch: Partial<FiltersType>) => onChange({ ...filters, ...patch });

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-end gap-3">
        <Select label="Prediction" value={filters.prediction}
          options={["ALL", "NORMAL", "ATTACK"]}
          onChange={(v) => set({ prediction: v as FiltersType["prediction"] })} />
        <Select label="Risk" value={filters.risk}
          options={["ALL", "LOW", "MEDIUM", "HIGH"]}
          onChange={(v) => set({ risk: v as FiltersType["risk"] })} />
        <Select label="Action" value={filters.action}
          options={["ALL", "ALLOW", "MONITOR", "BLOCK"]}
          onChange={(v) => set({ action: v as FiltersType["action"] })} />
        <Select label="Attack type" value={filters.attackType}
          options={["ALL", "none", "sqli", "xss", "path_traversal", "cmd_injection"]}
          onChange={(v) => set({ attackType: v })} />

        <div className="ml-auto flex flex-wrap gap-2 items-center">
          <ActionBtn onClick={onTogglePause} variant={paused ? "active" : "default"}>
            {paused ? "▶ Resume display" : "❚❚ Pause display"}
          </ActionBtn>
          <ActionBtn onClick={onClear}>Clear view</ActionBtn>
          <ActionBtn onClick={onClearBackend} variant="danger">Clear history</ActionBtn>
        </div>
      </div>
    </div>
  );
}
