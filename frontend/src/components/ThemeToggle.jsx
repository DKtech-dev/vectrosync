import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../utils/theme';

/**
 * Header sun/moon control. The knob slides 200ms; the icon cross-fades on
 * change. Fully keyboard operable with a descriptive aria-label.
 */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isLight}
      aria-label={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
      title={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
      onClick={toggleTheme}
      className="btn relative h-7 w-[52px] rounded-full border border-hairline bg-surface-2 px-0"
    >
      {/* Static rail glyphs */}
      <Moon className="absolute left-[7px] top-1/2 -translate-y-1/2 h-3 w-3 text-faint" aria-hidden="true" />
      <Sun className="absolute right-[7px] top-1/2 -translate-y-1/2 h-3 w-3 text-faint" aria-hidden="true" />

      {/* Sliding knob carrying the active icon */}
      <span
        className="absolute top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-surface-1 shadow-sm border border-hairline transition-[left] duration-200 ease-out"
        style={{ left: isLight ? '26px' : '3px' }}
      >
        {isLight ? (
          <Sun key="sun" className="vs-icon-swap h-3 w-3 text-caution" aria-hidden="true" />
        ) : (
          <Moon key="moon" className="vs-icon-swap h-3 w-3 text-interactive" aria-hidden="true" />
        )}
      </span>
    </button>
  );
}

export default ThemeToggle;
