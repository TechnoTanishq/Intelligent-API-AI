import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export interface ToastItem {
  id: string;
  decision: "ALLOW" | "MONITOR" | "BLOCK";
  prediction: "NORMAL" | "ATTACK";
  path: string;
  method: string;
  probability: number;
  attackType: string | null;
}

// ─── Single toast card ────────────────────────────────────────────────────
function ToastCard({ toast, onDone }: { toast: ToastItem; onDone: (id: string) => void }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    // Start exit animation at 1.6 s, remove at 1.9 s
    const exitTimer  = setTimeout(() => setLeaving(true), 1600);
    const doneTimer  = setTimeout(() => onDone(toast.id), 1900);
    return () => { clearTimeout(exitTimer); clearTimeout(doneTimer); };
  }, [toast.id, onDone]);

  // Colour scheme per decision
  const scheme = {
    ALLOW:   { bar: "bg-ok",     icon: "✓",  label: "ALLOWED",  ring: "border-ok/40",     bg: "bg-ok/10",    text: "text-ok" },
    MONITOR: { bar: "bg-warn",   icon: "⚠",  label: "MONITOR",  ring: "border-warn/40",   bg: "bg-warn/10",  text: "text-warn" },
    BLOCK:   { bar: "bg-danger", icon: "✕",  label: "BLOCKED",  ring: "border-danger/40", bg: "bg-danger/10",text: "text-danger" },
  }[toast.decision];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`
        pointer-events-auto relative overflow-hidden
        rounded-xl border shadow-toast
        bg-[var(--bg-surface)] ${scheme.ring}
        ${leaving ? "animate-toast-out" : "animate-toast-in"}
      `}
    >
      {/* Coloured left accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${scheme.bar}`} />

      <div className="pl-4 pr-3 py-3 flex items-start gap-3">
        {/* Icon badge */}
        <div className={`flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center font-bold text-base ${scheme.bg} ${scheme.text}`}>
          {scheme.icon}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`text-xs font-bold tracking-wide ${scheme.text}`}>{scheme.label}</span>
            {toast.prediction === "ATTACK" && toast.attackType && (
              <span className="text-[10px] font-mono bg-danger/15 text-danger rounded px-1.5 py-0.5">
                {toast.attackType}
              </span>
            )}
            <span className="ml-auto text-[10px] font-mono text-[var(--text-muted)]">
              {(toast.probability * 100).toFixed(0)}%
            </span>
          </div>
          <div className="text-xs font-mono text-[var(--text-secondary)] truncate">
            <span className="text-[var(--text-muted)]">{toast.method} </span>
            {toast.path.length > 32 ? toast.path.slice(0, 32) + "…" : toast.path}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className={`absolute bottom-0 left-0 h-[2px] ${scheme.bar} opacity-50`}
        style={{ animation: "toast-progress 1.6s linear forwards" }} />
    </div>
  );
}

// ─── Toast container — rendered via portal into #toast-root ──────────────
export default function ToastContainer({ toasts, onDone }: {
  toasts: ToastItem[];
  onDone: (id: string) => void;
}) {
  const root = document.getElementById("toast-root");
  if (!root) return null;
  return createPortal(
    <>
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDone={onDone} />
      ))}
    </>,
    root
  );
}

// ─── Progress bar keyframe (injected inline — Tailwind can't do dynamic dur) ─
const style = document.createElement("style");
style.textContent = `
  @keyframes toast-progress {
    from { width: 100%; }
    to   { width: 0%; }
  }
`;
document.head.appendChild(style);
