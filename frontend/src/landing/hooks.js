import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '../utils/motion.js';

/**
 * Adds `is-in` to an element the first time it enters the viewport, which is
 * what drives the `.cat-reveal` entrance transition. Degrades to "immediately
 * visible" when IntersectionObserver is unavailable, so content can never be
 * stranded invisible by a failed observer.
 */
export function useReveal() {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      node.classList.add('is-in');
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return ref;
}

/**
 * Tracks which section id is currently under the reading line so the nav can
 * expose a truthful `aria-current`. Returns '' while the hero is in view.
 */
export function useScrollSpy(ids) {
  const [active, setActive] = useState('');
  const key = ids.join('|');

  useEffect(() => {
    const sectionIds = key.split('|');
    if (typeof IntersectionObserver === 'undefined') return undefined;

    const visible = new Map();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) visible.set(entry.target.id, entry.intersectionRatio);
          else visible.delete(entry.target.id);
        });
        if (window.scrollY < 240) {
          setActive('');
          return;
        }
        let best = '';
        let bestRatio = 0;
        visible.forEach((ratio, id) => {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            best = id;
          }
        });
        if (best) setActive(best);
      },
      { rootMargin: '-30% 0px -45% 0px', threshold: [0, 0.15, 0.4, 0.75, 1] },
    );

    sectionIds.forEach((id) => {
      const node = document.getElementById(id);
      if (node) io.observe(node);
    });

    const onScroll = () => {
      if (window.scrollY < 240) setActive('');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, [key]);

  return active;
}

/**
 * In-page navigation that deliberately does NOT write `window.location.hash`.
 * The app router keys off `#console`, and mutating the hash for anchors would
 * fire `hashchange` and leave routing state in the URL for no benefit.
 * Sections keep real `id`s so deep links still work if someone pastes one.
 */
export function useSectionScroll() {
  const reduced = usePrefersReducedMotion();

  return useCallback(
    (id) => {
      const node = document.getElementById(id);
      if (!node) return;
      node.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      // Move keyboard focus with the viewport without adding a tab stop.
      node.setAttribute('tabindex', '-1');
      node.focus({ preventScroll: true });
    },
    [reduced],
  );
}

/**
 * Very small pointer parallax. Writes CSS custom properties on a container
 * rather than React state so it never re-renders the figure, and stays inert
 * under reduced motion or on coarse pointers.
 */
export function usePointerParallax() {
  const ref = useRef(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node || reduced) return undefined;
    if (window.matchMedia?.('(pointer: coarse)').matches) return undefined;

    let raf = null;
    let nx = 0;
    let ny = 0;

    const apply = () => {
      raf = null;
      node.style.setProperty('--px', nx.toFixed(3));
      node.style.setProperty('--py', ny.toFixed(3));
    };
    const onMove = (event) => {
      const rect = node.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      nx = (event.clientX - rect.left) / rect.width - 0.5;
      ny = (event.clientY - rect.top) / rect.height - 0.5;
      if (raf === null) raf = requestAnimationFrame(apply);
    };
    const onLeave = () => {
      nx = 0;
      ny = 0;
      if (raf === null) raf = requestAnimationFrame(apply);
    };

    node.addEventListener('pointermove', onMove);
    node.addEventListener('pointerleave', onLeave);
    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
      node.removeEventListener('pointermove', onMove);
      node.removeEventListener('pointerleave', onLeave);
    };
  }, [reduced]);

  return ref;
}

/** Stable list of section ids for the scroll spy. */
export function useSectionIds(sections) {
  return useMemo(() => sections.map((s) => s.id), [sections]);
}
