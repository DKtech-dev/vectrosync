/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'IBM Plex Mono', 'monospace'],
      },
      colors: {
        canvas: 'rgb(var(--bg-canvas) / <alpha-value>)',
        'surface-1': 'rgb(var(--bg-surface-1) / <alpha-value>)',
        'surface-2': 'rgb(var(--bg-surface-2) / <alpha-value>)',
        hairline: 'rgb(var(--border-hairline) / <alpha-value>)',

        ink: 'rgb(var(--text-primary) / <alpha-value>)',
        muted: 'rgb(var(--text-secondary) / <alpha-value>)',
        faint: 'rgb(var(--text-tertiary) / <alpha-value>)',
        secondary: 'rgb(var(--text-secondary) / <alpha-value>)',
        tertiary: 'rgb(var(--text-tertiary) / <alpha-value>)',

        interactive: 'rgb(var(--accent-interactive) / <alpha-value>)',
        'interactive-soft': 'rgb(var(--accent-interactive-soft) / <alpha-value>)',
        safe: 'rgb(var(--accent-safe) / <alpha-value>)',
        caution: 'rgb(var(--accent-caution) / <alpha-value>)',
        critical: 'rgb(var(--accent-critical) / <alpha-value>)',
      },
      borderRadius: {
        master: '28px',
        card: '18px',
        panel: '18px',
      },
      boxShadow: {
        card: '0 10px 30px -5px rgb(0 0 0 / 0.04), 0 2px 6px -1px rgb(0 0 0 / 0.03)',
        float: '0 20px 50px -12px rgb(0 0 0 / 0.10), 0 4px 12px -2px rgb(0 0 0 / 0.04)',
      },
    },
  },
  plugins: [],
}
