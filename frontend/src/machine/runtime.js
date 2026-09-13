import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * ============================================================================
 * MACHINE RUNTIME
 * ============================================================================
 * A 60 fps mechanism cannot be animated through React state. Two rod strings,
 * two pumping units, ~40 moving parts and a particle field re-reconciling the
 * tree every frame would drop frames on any laptop.
 *
 * So the runtime is split:
 *   - ONE requestAnimationFrame loop owns the clock and pushes a frame object
 *     to imperative subscribers, which mutate SVG attributes on refs directly.
 *   - React state is updated on a slow cadence (8 Hz) purely for the numeric
 *     readouts, where tearing is invisible and legibility matters more.
 *
 * Everything is paused when the tab is hidden and frozen (single static frame)
 * under `prefers-reduced-motion`.
 * ==========================================================================*/

const TWO_PI = Math.PI * 2;

export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

/**
 * Master clock for the twin-bay comparison.
 *
 * Both bays advance on the SAME wall clock but at their OWN stroke rates, so
 * they visibly desynchronise. That drift is the argument: at the end of a
 * minute the ungoverned unit has completed more strokes, and every one of the
 * extra strokes was taken in compression.
 *
 * @param opts.spmA  ungoverned / baseline strokes per minute
 * @param opts.spmB  governed strokes per minute
 */
export function useMachineClock({ spmA, spmB, isPlaying = true, speed = 1, reduced = false }) {
  const stateRef = useRef({
    tS: 0,
    phaseA: 0,
    phaseB: 0,
    strokesA: 0,
    strokesB: 0,
    /** Accumulated compression exposure, stroke-seconds. Set by the bays. */
    damageA: 0,
    damageB: 0,
    spmA,
    spmB,
    speed,
    isPlaying,
    reduced,
  });
  const subsRef = useRef(new Set());
  const rafRef = useRef(0);

  // Keep the live parameters current without restarting the loop.
  stateRef.current.spmA = spmA;
  stateRef.current.spmB = spmB;
  stateRef.current.speed = speed;
  stateRef.current.isPlaying = isPlaying;
  stateRef.current.reduced = reduced;

  const api = useMemo(
    () => ({
      subscribe(fn) {
        subsRef.current.add(fn);
        return () => subsRef.current.delete(fn);
      },
      get() {
        return stateRef.current;
      },
      reset() {
        const s = stateRef.current;
        s.tS = 0;
        s.phaseA = 0;
        s.phaseB = 0;
        s.strokesA = 0;
        s.strokesB = 0;
        s.damageA = 0;
        s.damageB = 0;
      },
      /** Manually place both bays at a phase — used by the scrub control. */
      scrubTo(phase) {
        const s = stateRef.current;
        s.phaseA = phase;
        s.phaseB = phase;
        subsRef.current.forEach((fn) => fn(s, 0));
      },
    }),
    [],
  );

  useEffect(() => {
    let last = 0;
    let hidden = false;
    const onVis = () => {
      hidden = document.hidden;
      last = 0;
    };
    document.addEventListener('visibilitychange', onVis);

    const tick = (now) => {
      rafRef.current = requestAnimationFrame(tick);
      const s = stateRef.current;
      if (!last) last = now;
      // Clamp: a backgrounded tab or a long GC pause must not teleport the
      // mechanism through half a revolution.
      const dtS = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (hidden) return;

      if (s.isPlaying && !s.reduced) {
        const k = s.speed * dtS;
        const dA = (s.spmA / 60) * k;
        const dB = (s.spmB / 60) * k;
        s.tS += k;
        s.strokesA += dA;
        s.strokesB += dB;
        s.phaseA = (s.phaseA + dA * TWO_PI) % TWO_PI;
        s.phaseB = (s.phaseB + dB * TWO_PI) % TWO_PI;
      }
      subsRef.current.forEach((fn) => fn(s, dtS));
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return api;
}

/**
 * Slow React mirror of the imperative clock, for text readouts.
 * @param hz update rate — 8 Hz is fast enough to read as live, slow enough to
 *           be free.
 */
export function useClockMirror(clock, hz = 8) {
  const [snap, setSnap] = useState(() => ({ ...clock.get() }));
  useEffect(() => {
    const id = setInterval(() => setSnap({ ...clock.get() }), 1000 / hz);
    return () => clearInterval(id);
  }, [clock, hz]);
  return snap;
}

/**
 * Pointer parallax.
 *
 * Returns a ref to attach to the container and a ref holding normalised
 * pointer offset in [-1, 1]. Consumers read `offset.current` inside their own
 * rAF frame and apply their own depth factor, so a 5-layer scene costs one
 * pointer listener and zero re-renders.
 *
 * Disabled entirely for coarse pointers (touch) and reduced motion.
 */
export function useParallax({ reduced = false, damping = 0.09 } = {}) {
  const hostRef = useRef(null);
  const target = useRef({ x: 0, y: 0 });
  const offset = useRef({ x: 0, y: 0 });
  const active = useRef(false);

  useEffect(() => {
    const el = hostRef.current;
    if (!el || reduced) return undefined;
    if (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches) return undefined;

    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      target.current.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      target.current.y = ((e.clientY - r.top) / r.height) * 2 - 1;
      active.current = true;
    };
    const onLeave = () => {
      target.current.x = 0;
      target.current.y = 0;
    };
    el.addEventListener('pointermove', onMove, { passive: true });
    el.addEventListener('pointerleave', onLeave, { passive: true });

    let raf = 0;
    const smooth = () => {
      raf = requestAnimationFrame(smooth);
      offset.current.x += (target.current.x - offset.current.x) * damping;
      offset.current.y += (target.current.y - offset.current.y) * damping;
    };
    raf = requestAnimationFrame(smooth);

    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      cancelAnimationFrame(raf);
    };
  }, [reduced, damping]);

  return { hostRef, offset };
}

/** Read a theme token as an `r, g, b` string usable in `rgba()`. */
export function readToken(name, fallback = '148, 165, 184') {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v ? v.split(/\s+/).join(', ') : fallback;
}

/** Subscribe to theme changes on `<html data-theme>`. */
export function useThemeEpoch() {
  const [epoch, setEpoch] = useState(0);
  useEffect(() => {
    const obs = new MutationObserver(() => setEpoch((e) => e + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return epoch;
}

export const TAU = TWO_PI;
