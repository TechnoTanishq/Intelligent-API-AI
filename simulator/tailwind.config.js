/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: { 950:"#060a0f", 900:"#0a0e14", 800:"#0f1620", 750:"#121c28",
               700:"#16202e", 600:"#1d2a3a", 500:"#28384c", 400:"#3a506b" },
        cloud: { 50:"#f8fafc", 100:"#f1f5f9", 200:"#e2e8f0", 300:"#cbd5e1",
                 400:"#94a3b8", 500:"#64748b" },
        accent: { DEFAULT:"#06b6d4", soft:"#22d3ee", muted:"#0e7490" },
        danger: "#ef4444",
        warn:   "#f59e0b",
        ok:     "#10b981",
      },
      keyframes: {
        "live-pulse": {
          "0%, 100%": { opacity:"1",   transform:"scale(1)" },
          "50%":       { opacity:"0.4", transform:"scale(0.85)" },
        },
      },
      animation: {
        "live-pulse": "live-pulse 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
