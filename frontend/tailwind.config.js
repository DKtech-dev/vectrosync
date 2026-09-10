/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'IBM Plex Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        // Surfaces
        canvas: 'rgb(var(--bg-canvas) / <alpha-value>)',
        'surface-1': 'rgb(var(--bg-surface-1) / <alpha-value>)',
        'surface-2': 'rgb(var(--bg-surface-2) / <alpha-value>)',
        hairline: 'rgb(var(--border-hairline) / <alpha-value>)',
        // Text
        ink: 'rgb(var(--text-primary) / <alpha-value>)',
        muted: 'rgb(var(--text-secondary) / <alpha-value>)',
        faint: 'rgb(var(--text-tertiary) / <alpha-value>)',
        // Semantic accents (identical meaning across themes)
        safe: 'rgb(var(--accent-safe) / <alpha-value>)',
        caution: 'rgb(var(--accent-caution) / <alpha-value>)',
        critical: 'rgb(var(--accent-critical) / <alpha-value>)',
        interactive: 'rgb(var(--accent-interactive) / <alpha-value>)',
      },
      spacing: {
        // Reinforce the 4/8/12/16/24/32 rhythm as named steps.
        'gap-xs': '4px',
        'gap-sm': '8px',
        'gap-md': '12px',
        'gap-lg': '16px',
        'gap-xl': '24px',
        'gap-2xl': '32px',
      },
      borderRadius: {
        panel: '10px',
      },
    },
  },
  plugins: [],
}
