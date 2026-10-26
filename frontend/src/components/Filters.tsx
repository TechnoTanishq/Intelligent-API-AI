import type { Filters as FiltersType } from "../types";

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-ink-900 border border-ink-600 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-accent"
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
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
    <div className="rounded-xl border border-ink-600 bg-ink-800 p-4 flex flex-wrap items-end gap-4">
      <Select label="Prediction" value={filters.prediction} options={["ALL", "NORMAL", "ATTACK"]} onChange={(v) => set({ prediction: v as FiltersType["prediction"] })} />
      <Select label="Risk" value={filters.risk} options={["ALL", "LOW", "MEDIUM", "HIGH"]} onChange={(v) => set({ risk: v as FiltersType["risk"] })} />
      <Select label="Action" value={filters.action} options={["ALL", "ALLOW", "MONITOR", "BLOCK"]} onChange={(v) => set({ action: v as FiltersType["action"] })} />
      <Select label="Attack type" value={filters.attackType} options={["ALL", "none", "sqli", "xss", "path_traversal", "cmd_injection"]} onChange={(v) => set({ attackType: v })} />

      <div className="ml-auto flex gap-2">
        <button onClick={onTogglePause}
          className="rounded-lg border border-ink-500 hover:bg-ink-700 text-slate-200 font-semibold px-4 py-2 text-sm">
          {paused ? "▶ Resume display" : "❚❚ Pause display"}
        </button>
        <button onClick={onClear}
          className="rounded-lg border border-ink-500 hover:bg-ink-700 text-slate-200 font-semibold px-4 py-2 text-sm">
          Clear view
        </button>
        <button onClick={onClearBackend}
          className="rounded-lg border border-danger/50 hover:bg-danger/10 text-danger font-semibold px-4 py-2 text-sm">
          Clear history (backend)
        </button>
      </div>
    </div>
  );
}
