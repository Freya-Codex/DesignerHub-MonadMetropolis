import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0F0F12",
        "ink-deep": "#05060A",
        paper: "#FBFAF9",
        "paper-2": "#F4F2F7",
        violet: { DEFAULT: "#6E54FF", deep: "#4F47EB" },
        plum: "#25043A",
        muted: "#727285",
        coral: "#FFA1A1",
        hairline: "#ECECEC"
      },
      fontFamily: {
        display: ["Archivo", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "sans-serif"],
        body: ["-apple-system", "BlinkMacSystemFont", "Inter", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "SF Mono", "Menlo", "Consolas", "monospace"]
      },
      boxShadow: {
        glow: "0 30px 80px -40px rgba(110, 84, 255, 0.55)",
        sheet: "0 1px 0 rgba(15,15,18,0.04), 0 18px 40px -32px rgba(15,15,18,0.35)"
      },
      keyframes: {
        rise: {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "none" }
        }
      },
      animation: { rise: "rise 0.7s cubic-bezier(0.22, 1, 0.36, 1) both" }
    }
  },
  plugins: []
};

export default config;
