import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Akanil institutional palette — Earth + Data + Governance + Sustainability
        obsidian: {
          DEFAULT: "#0A0C0E",
          900: "#0A0C0E",
          800: "#101418",
          700: "#161B21",
          600: "#1E242C",
        },
        gold: {
          DEFAULT: "#B8924A", // muted gold (brand mark)
          light: "#D4B373",
          muted: "#9C7B3C",
        },
        copper: {
          DEFAULT: "#B06A3C",
          light: "#C98B5E",
        },
        teal: {
          DEFAULT: "#1F6F6B",
          light: "#2E8C87",
        },
        emerald: {
          DEFAULT: "#1C5D45",
          light: "#2C7E5F",
        },
        ivory: {
          DEFAULT: "#F4F1E9",
          muted: "#CFCABB",
        },
        atlas: {
          DEFAULT: "#2A2F36",
          grey: "#8A9099",
          line: "#2C333B",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-space-grotesk)", "var(--font-inter)", "sans-serif"],
      },
      maxWidth: {
        content: "1200px",
      },
      backgroundImage: {
        "geo-grid":
          "linear-gradient(rgba(184,146,74,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(184,146,74,0.04) 1px, transparent 1px)",
        "gold-fade":
          "linear-gradient(180deg, rgba(184,146,74,0.12) 0%, rgba(10,12,14,0) 100%)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.7s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
