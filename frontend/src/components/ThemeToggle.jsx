import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../utils/theme';

/**
 * Appearance toggle for the nav rail.
 *
 * a11y: this is a plain toggle button named after the *state* it controls
 * ("Dark theme") with `aria-pressed` carrying whether that state is active,
 * so AT announces "Dark theme, toggle button, pressed". The previous
 * `role="switch"` + action-phrased name produced the contradictory
 * "Switch to dark theme, switch, not checked".
 */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme !== 'light';

  return (
    <button
      type="button"
      aria-pressed={isDark}
      aria-label="Dark theme"
      title={isDark ? 'Dark theme on — activate for light theme' : 'Dark theme off — activate for dark theme'}
      onClick={toggleTheme}
      className="nav-pill"
    >
      {isDark ? (
        <Moon key="moon" className="vs-icon-swap w-[18px] h-[18px]" aria-hidden="true" />
      ) : (
        <Sun key="sun" className="vs-icon-swap w-[18px] h-[18px]" aria-hidden="true" />
      )}
    </button>
  );
}

export default ThemeToggle;
