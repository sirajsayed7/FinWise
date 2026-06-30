import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}", "./lib/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        "fw-base":     "var(--bg-base)",
        "fw-surface":  "var(--bg-surface)",
        "fw-elevated": "var(--bg-elevated)",
        "fw-overlay":  "var(--bg-overlay)",
        "fw-accent":   "var(--accent)",
        "fw-accent-dim":"var(--accent-dim)",
        "fw-text":     "var(--text-primary)",
        "fw-muted":    "var(--text-secondary)",
        "fw-faint":    "var(--text-muted)",
        "fw-success":  "var(--success)",
        "fw-danger":   "var(--danger)",
        "fw-warning":  "var(--warning)",
        "fw-border":   "var(--border)"
      },
      boxShadow: {
        "fw-card":   "var(--shadow-card)",
        "fw-hero":   "var(--shadow-hero)",
        "fw-accent": "var(--shadow-accent)"
      }
    }
  },
  plugins: []
};

export default config;
