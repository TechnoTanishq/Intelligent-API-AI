/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  // Class-based dark mode: add/remove `dark` class on <html>
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // ── Dark-mode surface palette ──────────────────────────────
        ink: {
          950: "#060a0f",
          900: "#0a0e14",
          800: "#0f1620",
          750: "#121c28",
          700: "#16202e",
          600: "#1d2a3a",
          500: "#28384c",
          400: "#3a506b",
        },
        // ── Light-mode surface palette ────────────────────────────
        cloud: {
          50:  "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
        },
        // ── Brand / status ────────────────────────────────────────
        accent: {
          DEFAULT: "#06b6d4",   // cyan-500
          soft:    "#22d3ee",   // cyan-400
          muted:   "#0e7490",   // cyan-700
        },
        danger:  "#ef4444",
        "danger-soft": "#fca5a5",
        warn:    "#f59e0b",
        "warn-soft": "#fcd34d",
        ok:      "#10b981",
        "ok-soft": "#6ee7b7",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      keyframes: {
        // toast slide-in from right
        "toast-in": {
          "0%":   { opacity: "0", transform: "translateX(110%)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        // toast fade out
        "toast-out": {
          "0%":   { opacity: "1", transform: "translateX(0)" },
          "100%": { opacity: "0", transform: "translateX(110%)" },
        },
        // flash a new table row
        "row-flash": {
          "0%":   { backgroundColor: "rgba(6,182,212,0.18)" },
          "100%": { backgroundColor: "transparent" },
        },
        // subtle pulse for the live dot
        "live-pulse": {
          "0%, 100%": { opacity: "1",   transform: "scale(1)" },
          "50%":       { opacity: "0.4", transform: "scale(0.85)" },
        },
      },
      animation: {
        "toast-in":   "toast-in 0.3s cubic-bezier(0.16,1,0.3,1) forwards",
        "toast-out":  "toast-out 0.25s ease-in forwards",
        "row-flash":  "row-flash 1.2s ease-out forwards",
        "live-pulse": "live-pulse 1.4s ease-in-out infinite",
      },
      boxShadow: {
        "card-dark":  "0 1px 3px 0 rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)",
        "card-light": "0 1px 3px 0 rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.06)",
        "toast":      "0 8px 30px rgba(0,0,0,0.35)",
      },
    },
  },
  plugins: [],
};
