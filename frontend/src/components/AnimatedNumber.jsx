import React from 'react';
import { useCountUp } from '../utils/motion';

/**
 * Renders a numeric telemetry value that tweens (count-up/down) to its target
 * instead of snapping. `format` maps the animated number to display text so
 * callers keep full control of precision, sign, and unit-scaling.
 *
 * The `readout` class supplies JetBrains Mono + tabular figures, so digits
 * stay column-aligned and the box never jitters mid-tween.
 *
 * A non-finite or absent value renders an em-dash plus an explicit
 * "unavailable" text equivalent. It never substitutes a plausible number.
 */
export function AnimatedNumber({ value, format = (v) => v.toFixed(1), duration = 350, className = '' }) {
  const animated = useCountUp(value, { duration });
  const isValid = typeof value === 'number' && Number.isFinite(value);

  let display = null;
  if (isValid) {
    try {
      const formatted = format(animated);
      display = formatted === null || formatted === undefined ? null : String(formatted);
    } catch {
      display = null;
    }
  }

  if (display === null) {
    return (
      <span className={`readout ${className}`} title="Value unavailable">
        <span aria-hidden="true">{'\u2014'}</span>
        <span className="sr-only">unavailable</span>
      </span>
    );
  }

  return <span className={`readout ${className}`}>{display}</span>;
}

export default AnimatedNumber;
