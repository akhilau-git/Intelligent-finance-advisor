import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          300: "#F5D67A",
          400: "#F5C542",
          500: "#F5A623",
          600: "#D4891A",
        },
        fs: {
          bg:      "#050714",
          surface: "#080C1F",
          card:    "#0D1230",
          border:  "rgba(139,92,246,0.2)",
          purple:  "#7C3AED",
          violet:  "#8B5CF6",
          accent:  "#A78BFA",
        }
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      animation: {
        "fade-in":    "fadeIn 0.3s ease-out",
        "slide-up":   "slideUp 0.25s ease-out",
        "pulse-slow": "pulse 3s ease-in-out infinite",
        "spin-slow":  "spin 8s linear infinite",
        "glow":       "glow 2s ease-in-out infinite",
        "float":      "float 6s ease-in-out infinite",
      },
      keyframes: {
        fadeIn:  { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        slideUp: { from: { opacity: "0", transform: "translateY(16px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        glow:    { "0%,100%": { opacity: "0.6" }, "50%": { opacity: "1" } },
        float:   { "0%,100%": { transform: "translateY(0px)" }, "50%": { transform: "translateY(-8px)" } },
      },
      backdropBlur: { xs: "2px" },
    },
  },
  plugins: [],
}
export default config
