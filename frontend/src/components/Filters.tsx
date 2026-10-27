import type { Filters as FiltersType } from "../types";

function Select({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 min-w-[100px]">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="
          bg-[var(--bg-raised)] border border-[var(--border)] rounded-lg
          px-2.5 py-1.5 text-xs text-[var(--text-secondary)]
          focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30
          cursor-pointer
        "
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function Btn({ onClick, children, variant = "default" }: {
  onClick: () => void;
  children: React.ReactNode;
  variant?: "default" | "danger";
}) {
  const base = "rounded-lg border font-semibold px-3.5 py-1.5 text-xs transition-colors duration-150";
  const cls =
    variant === "danger"
      ? `${base} border-danger/40 text-danger hover:bg-danger/10`
      : `${base} border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-raised)] hover:text-[var(--text-primary)]`;
  return <button onClick={onClick} className={cls}>{children}</button>;
}

export default function FiltersBar({
  filters, onChange, paused, onTogglePause, onClear, onClearBackend,
}: {
  filters: FiltersType;
  onChange: (f: FiltersType) => void;
  paused: boolean;
  onTogglePause: () => void;
  onClear: () => void;
  onClearBackend: () => void;
}) {
  const set = (patch: Partial<FiltersType>) => onChange({ ...filters, ...patch });

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
      <div className="flex flex-wrap items-end gap-3">
        {/* Filter selects */}
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

        {/* Action buttons — pushed right */}
        <div className="ml-auto flex flex-wrap gap-2 items-center">
          {/* Pause/resume with visual state */}
          <button
            onClick={onTogglePause}
            className={`
              rounded-lg border font-semibold px-3.5 py-1.5 text-xs
              transition-colors duration-150
              ${paused
                ? "border-ok/40 text-ok bg-ok/10 hover:bg-ok/15"
                : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-raised)]"
              }
            `}
          >
            {paused ? "▶ Resume display" : "❚❚ Pause display"}
          </button>
          <Btn onClick={onClear}>Clear view</Btn>
          <Btn onClick={onClearBackend} variant="danger">Clear history</Btn>
        </div>
      </div>
    </div>
  );
}
