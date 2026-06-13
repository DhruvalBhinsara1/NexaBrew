import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    // Preline UI component classes (Tailwind v3 compatible, pinned 2.x)
    "./node_modules/preline/preline.js",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        // Wise design language: geometric heavy display (Manrope ≈ Wise Sans)
        // paired with Inter for body/utility. Wired via next/font CSS vars.
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        // Wise radius scale (DESIGN-wise.md): inputs 12px, cards/buttons 24px.
        wise: "12px",
        wiseCard: "24px",
        wisePill: "9999px",
      },
      boxShadow: {
        wiseCard: "0 1px 2px rgba(14,15,12,0.04), 0 8px 24px -12px rgba(14,15,12,0.12)",
        wiseModal: "0 24px 64px -16px rgba(14,15,12,0.28)",
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // --- NexaBrew design tokens (DESIGN.md) ---
        brand: {
          50: "#fdf6ee",
          100: "#f9e8d0",
          200: "#f2ce99",
          300: "#e9b062",
          400: "#df9438",
          500: "#d4791f",
          600: "#b85e14",
          700: "#934710",
          800: "#773a13",
          900: "#613113",
        },
        surface: {
          DEFAULT: "#ffffff",
          muted: "#f8f7f5",
          border: "#e8e3db",
        },
        kds: {
          bg: "#0f1117",
          card: "#1a1d27",
          border: "#2a2d3e",
          tocook: "#f59e0b",
          preparing: "#3b82f6",
          completed: "#10b981",
        },
        // --- Wise design language (DESIGN-wise.md) — Phase 1 token foundation.
        // Lime-green is the sole brand/CTA accent; ink text on sage/white canvas.
        wise: {
          primary: "#9fe870",
          "primary-active": "#cdffad",
          "primary-neutral": "#c5edab",
          "primary-pale": "#e2f6d5",
          "on-primary": "#0e0f0c",
          ink: "#0e0f0c",
          "ink-deep": "#163300",
          body: "#454745",
          mute: "#868685",
          canvas: "#ffffff",
          "canvas-soft": "#e8ebe6",
          border: "#d7ddd2",
          positive: "#2ead4b",
          "positive-deep": "#054d28",
          warning: "#ffd11a",
          "warning-deep": "#b86700",
          "warning-content": "#4a3b1c",
          negative: "#d03238",
          "negative-deep": "#a72027",
          "negative-bg": "#320707",
          "accent-orange": "#ffc091",
          "accent-cyan": "#38c8ff",
        },
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("preline/plugin")],
};
export default config;
