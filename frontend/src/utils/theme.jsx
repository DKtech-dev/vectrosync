import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/**
 * Theme is persisted under `catenary-theme`. `vectrosync-theme` is the
 * pre-rebrand key: it is still *read* so existing users keep their choice,
 * but it is never written to again.
 */
const STORAGE_KEY = 'catenary-theme';
const LEGACY_STORAGE_KEY = 'vectrosync-theme';

/** Dark is the product default (control-room ergonomics). */
const DEFAULT_THEME = 'dark';

const isTheme = (value) => value === 'light' || value === 'dark';

const ThemeContext = createContext({
  theme: DEFAULT_THEME,
  toggleTheme: () => {},
  setTheme: () => {},
});

function readStoredTheme() {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isTheme(stored)) return stored;
    const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (isTheme(legacy)) return legacy;
  } catch {
    /* private mode / disabled storage — fall through to the default */
  }
  return null;
}

function resolveInitialTheme() {
  // An explicit, persisted user choice always wins over whatever the
  // pre-paint inline script happened to put on <html data-theme>.
  const stored = readStoredTheme();
  if (stored) return stored;

  if (typeof document !== 'undefined') {
    const current = document.documentElement.getAttribute('data-theme');
    if (isTheme(current)) return current;
  }

  return DEFAULT_THEME;
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(resolveInitialTheme);

  // Reflect the theme onto the document root so the CSS variables switch.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const setTheme = useCallback((next) => {
    if (!isTheme(next)) return;
    setThemeState(next);
    try {
      // Only the current key is written; the legacy key is read-only.
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ theme, toggleTheme, setTheme }), [theme, toggleTheme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export default ThemeProvider;
