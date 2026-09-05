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
        scada: {
          bg: '#f8fafc',
          surface: '#ffffff',
          surfaceRaised: '#f1f5f9',
          border: '#e2e8f0',
          borderDark: '#cbd5e1',
          cyan: '#0284c7',
          sky: '#0284c7',
          emerald: '#059669',
          amber: '#d97706',
          orange: '#ea580c',
          crimson: '#dc2626',
          muted: '#64748b',
          subtext: '#475569',
          text: '#0f172a',
        },
        hmi: {
          bg: '#f8fafc',
          surface: '#ffffff',
          surfaceRaised: '#f1f5f9',
          border: '#e2e8f0',
          borderDark: '#cbd5e1',
          ink: '#0f172a',
          inkSecondary: '#475569',
          inkMuted: '#64748b',
          steel: '#0284c7',
          steelLight: '#e0f2fe',
          safe: '#059669',
          safeBg: '#ecfdf5',
          safeBorder: '#a7f3d0',
          caution: '#d97706',
          cautionBg: '#fffbeb',
          cautionBorder: '#fde68a',
          alarm: '#dc2626',
          alarmBg: '#fef2f2',
          alarmBorder: '#fecaca',
          ochre: '#b45309',
          ochreBg: '#fef3c7',
        }
      },
      boxShadow: {
        'popover': '0 4px 16px rgba(15, 23, 42, 0.08)',
        'modal': '0 12px 36px rgba(15, 23, 42, 0.16)',
        'glow-cyan': '0 0 12px rgba(2, 132, 199, 0.20)',
        'glow-emerald': '0 0 12px rgba(5, 150, 105, 0.20)',
        'glow-crimson': '0 0 12px rgba(220, 38, 38, 0.20)',
      }
    },
  },
  plugins: [],
}
