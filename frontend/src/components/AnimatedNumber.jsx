import React from 'react';
import { useCountUp } from '../utils/motion';

/**
 * Renders a numeric telemetry value that tweens (count-up/down) to its target
 * instead of snapping. `format` maps the animated number to display text so
 * callers keep full control of precision, sign, and unit-scaling.
 *
 * Always monospace + tabular-nums (via the `readout` class) so digits stay
 * column-aligned and don't reflow mid-tween.
 */
export function AnimatedNumber({ value, format = (v) => v.toFixed(1), duration = 350, className = '' }) {
  const animated = useCountUp(value, { duration });
  const isValid = typeof value === 'number' && Number.isFinite(value);
  let display = '\u2014';
  if (isValid) {
    try {
      display = format(animated);
    } catch {
      display = '\u2014';
    }
  }
  return <span className={`readout ${className}`}>{display}</span>;
}

export default AnimatedNumber;
