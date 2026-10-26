/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          900: "#0a0e14",
          800: "#0f1620",
          700: "#16202e",
          600: "#1d2a3a",
          500: "#28384c",
        },
        accent: {
          DEFAULT: "#22d3ee",
          soft: "#67e8f9",
        },
        danger: "#f87171",
        warn: "#fbbf24",
        ok: "#34d399",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
