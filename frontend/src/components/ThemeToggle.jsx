import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../utils/theme';

/**
 * Appearance toggle for the nav rail. Icon cross-fades on change; fully
 * keyboard operable with a descriptive aria-label.
 */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={!isLight}
      aria-label={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
      title={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
      onClick={toggleTheme}
      className="nav-pill"
    >
      {isLight ? (
        <Moon key="moon" className="vs-icon-swap w-[18px] h-[18px]" />
      ) : (
        <Sun key="sun" className="vs-icon-swap w-[18px] h-[18px]" />
      )}
    </button>
  );
}

export default ThemeToggle;
