import { useEffect, useRef, useState } from 'react';

/**
 * Tracks the user's `prefers-reduced-motion` setting so animations can be
 * disabled globally at the JS layer (count-up tweens, etc.).
 */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (event) => setReduced(event.matches);
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, []);

  return reduced;
}

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

/**
 * Tweens a numeric value toward `value` over `duration` ms (easeOutCubic).
 * Returns the current animated value. Snaps instantly under reduced-motion.
 * This is the core of the "expensive dashboard" feel: numbers move.
 */
export function useCountUp(value, { duration = 350 } = {}) {
  const numericTarget = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  const [display, setDisplay] = useState(numericTarget);
  const fromRef = useRef(numericTarget);
  const rafRef = useRef(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced || !Number.isFinite(numericTarget)) {
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

  return display;
}
