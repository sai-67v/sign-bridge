module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./containers/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  mode: "jit",
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        'canis-purple': '#8b5cf6', // Violet 500
        'cosmic-pink': '#ec4899',  // Pink 500
        'deep-space': '#0f172a',   // Slate 900
        'star-glow': '#fcd34d',   // Yellow 300
        // Paper-first palette (Tailwind utilities; prefer CSS vars for theme switching)
        paper: {
          DEFAULT: '#fcfcfa',
          muted: '#f4f4f2',
          desk: '#e8e8e6',
        },
        ink: {
          DEFAULT: '#171717',
          muted: '#525252',
          faint: '#a3a3a3',
        },
        rule: '#d6d6d4',
        marker: {
          DEFAULT: '#fef08a',
          mint: '#bbf7d0',
        },
        sticky: {
          1: '#fef9c3',
          2: '#e0f2fe',
          3: '#fecaca',
        },
      },
      fontFamily: {
        outfit: ['Outfit', 'system-ui', 'sans-serif'],
        paper: ['Charter', 'Iowan Old Style', 'Georgia', 'Cambria', 'Times New Roman', 'serif'],
      },
      boxShadow: {
        paper: '0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.04)',
        sticky: '0 2px 8px rgba(0,0,0,0.08)',
      },
      fontSize: {
        "2xs": "0.65rem",
      },
      animation: {
        'blob': 'blob 7s infinite',
        'fade-in-up': 'fadeInUp 0.5s ease-out forwards',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        blob: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
          '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
          '100%': { transform: 'translate(0px, 0px) scale(1)' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    require("@tailwindcss/typography"),
    require("@tailwindcss/forms"),
    /** Lets `@apply bg-gradient-vibrant` work in standalone CSS chunks (e.g. button.css). */
    function gradientVibrantPlugin({ addUtilities }) {
      addUtilities({
        ".bg-gradient-vibrant": {
          backgroundImage:
            "linear-gradient(to bottom right, #8b5cf6, #ec4899, #f97316)",
        },
      });
    },
  ],
};
