/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // ── Dark-mode surfaces ────────────────────────────────────
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
        // ── Navy palette (light-mode primary) ─────────────────────
        navy: {
          950: "#020617",
          900: "#0a1628",   // darkest navy — header bg
          800: "#0f2040",   // sidebar / heavy surfaces
          700: "#162a52",
          600: "#1e3a6e",   // accent fills
          500: "#1e4db7",   // primary navy action color
          400: "#3b6fd4",
          300: "#6b9fe8",
          200: "#bfd3f5",
          100: "#deeafc",   // very light tint
          50:  "#f0f5ff",   // page background
        },
        // ── Orange palette (accent) ────────────────────────────────
        orange: {
          600: "#c2410c",
          500: "#ea580c",
          400: "#f97316",   // primary orange
          300: "#fb923c",
          200: "#fed7aa",
          100: "#ffedd5",
          50:  "#fff7ed",
        },
        // ── Status ────────────────────────────────────────────────
        danger:  "#ef4444",
        warn:    "#f59e0b",
        ok:      "#10b981",
        accent: {
          DEFAULT: "#f97316",   // orange-400 in light, cyan in dark
          soft:    "#fb923c",
          muted:   "#c2410c",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      keyframes: {
        "toast-in":   { "0%":{ opacity:"0", transform:"translateX(110%)" }, "100%":{ opacity:"1", transform:"translateX(0)" } },
        "toast-out":  { "0%":{ opacity:"1", transform:"translateX(0)"   }, "100%":{ opacity:"0", transform:"translateX(110%)" } },
        "row-flash":  { "0%":{ backgroundColor:"rgba(249,115,22,0.15)" }, "100%":{ backgroundColor:"transparent" } },
        "live-pulse": { "0%, 100%":{ opacity:"1", transform:"scale(1)" }, "50%":{ opacity:"0.45", transform:"scale(0.82)" } },
        "fade-in":    { "0%":{ opacity:"0", transform:"translateY(6px)" }, "100%":{ opacity:"1", transform:"translateY(0)" } },
      },
      animation: {
        "toast-in":   "toast-in 0.3s cubic-bezier(0.16,1,0.3,1) forwards",
        "toast-out":  "toast-out 0.25s ease-in forwards",
        "row-flash":  "row-flash 1.4s ease-out forwards",
        "live-pulse": "live-pulse 1.4s ease-in-out infinite",
        "fade-in":    "fade-in 0.4s ease-out forwards",
      },
      boxShadow: {
        "card":  "0 1px 4px 0 rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.05)",
        "card-navy": "0 2px 8px 0 rgba(10,22,40,0.18), 0 0 0 1px rgba(255,255,255,0.06)",
        "header": "0 1px 0 0 rgba(0,0,0,0.10)",
        "toast":  "0 8px 30px rgba(0,0,0,0.22)",
      },
    },
  },
  plugins: [],
};
