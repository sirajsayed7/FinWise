import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}", "./lib/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17201c",
        mist: "#eef5f0",
        forest: "#1d5c45",
        mint: "#6fbf9a",
        lime: "#d8f3a0",
        coral: "#f26f5e"
      },
      boxShadow: {
        soft: "0 18px 50px rgba(23, 32, 28, 0.10)"
      }
    }
  },
  plugins: []
};

export default config;
