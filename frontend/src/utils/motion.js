import { useEffect, useRef, useState } from 'react';

const REDUCE_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Tracks the user's `prefers-reduced-motion` setting so animations can be
 * disabled at the JS layer too (count-up tweens, staggered reveals, etc.).
 * The CSS layer handles the declarative half in index.css.
 */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(REDUCE_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mql = window.matchMedia(REDUCE_QUERY);
    const onChange = (event) => setReduced(event.matches);
    // Re-sync on mount in case the setting changed before hydration.
    setReduced(mql.matches);
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, []);

  return reduced;
}

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

/**
 * Tweens a numeric value toward `value` over `duration` ms (easeOutCubic) and
 * returns the current animated value. Snaps instantly under reduced-motion.
 * Instrument readouts should move, not jump — but never at the cost of
 * accessibility or of showing a number that was never computed.
 */
export function useCountUp(value, { duration = 350 } = {}) {
  const numericTarget = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  const [display, setDisplay] = useState(numericTarget);
  const fromRef = useRef(numericTarget);
  const rafRef = useRef(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced || !Number.isFinite(numericTarget)) {
      cancelAnimationFrame(rafRef.current);
      fromRef.current = numericTarget;
      setDisplay(numericTarget);
      return undefined;
    }

    const from = fromRef.current;
    const to = numericTarget;
    if (from === to) return undefined;

    const start = performance.now();
    cancelAnimationFrame(rafRef.current);

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const current = from + (to - from) * easeOutCubic(t);
      setDisplay(current);
      fromRef.current = current;
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [numericTarget, duration, reduced]);

  // Unmount safety: never leave a frame queued against a dead component.
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return display;
}

export default useCountUp;
