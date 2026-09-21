import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#18181b",
        paper: "#F7F5F0",
        brand: { 50: "#EEF2FF", 500: "#6366F1", 600: "#4F46E5" }
      },
      boxShadow: {
        card: "0 1px 2px rgb(0 0 0 / 0.06), 0 8px 24px -12px rgb(0 0 0 / 0.18)"
      }
    }
  },
  plugins: []
};

export default config;
