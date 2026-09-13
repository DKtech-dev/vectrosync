/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'IBM Plex Mono', 'ui-monospace', 'monospace'],
        display: ['Instrument Serif', 'Georgia', 'serif'],
      },
      colors: {
        canvas: 'rgb(var(--bg-canvas) / <alpha-value>)',
        'surface-1': 'rgb(var(--bg-surface-1) / <alpha-value>)',
        'surface-2': 'rgb(var(--bg-surface-2) / <alpha-value>)',
        'surface-3': 'rgb(var(--bg-surface-3) / <alpha-value>)',
        hairline: 'rgb(var(--border-hairline) / <alpha-value>)',
        strong: 'rgb(var(--border-strong) / <alpha-value>)',

        ink: 'rgb(var(--text-primary) / <alpha-value>)',
        muted: 'rgb(var(--text-secondary) / <alpha-value>)',
        faint: 'rgb(var(--text-tertiary) / <alpha-value>)',
        /* Back-compat aliases for text ramp. */
        secondary: 'rgb(var(--text-secondary) / <alpha-value>)',
        tertiary: 'rgb(var(--text-tertiary) / <alpha-value>)',

        interactive: 'rgb(var(--accent-interactive) / <alpha-value>)',
        'interactive-soft': 'rgb(var(--accent-interactive-soft) / <alpha-value>)',
        safe: 'rgb(var(--accent-safe) / <alpha-value>)',
        caution: 'rgb(var(--accent-caution) / <alpha-value>)',
        critical: 'rgb(var(--accent-critical) / <alpha-value>)',
        thermal: 'rgb(var(--accent-thermal) / <alpha-value>)',
      },
      borderRadius: {
        xs: '3px',
        sm: '5px',
        DEFAULT: '7px',
        md: '7px',
        lg: '10px',
        xl: '14px',
        '2xl': '18px',
        panel: '10px',
        master: '14px',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        float: 'var(--shadow-float)',
        inset: 'var(--shadow-inset)',
      },
      fontSize: {
        micro: ['9.5px', { lineHeight: '1.25', letterSpacing: '0.09em' }],
        label: ['10.5px', { lineHeight: '1.3', letterSpacing: '0.075em' }],
        meta: ['11.5px', { lineHeight: '1.45' }],
        body: ['13px', { lineHeight: '1.55' }],
        lead: ['15px', { lineHeight: '1.5' }],
      },
      transitionTimingFunction: {
        instrument: 'cubic-bezier(0.22, 1, 0.36, 1)',
        mech: 'cubic-bezier(0.65, 0, 0.35, 1)',
      },
    },
  },
  plugins: [],
};
