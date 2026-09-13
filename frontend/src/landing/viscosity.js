import { VISCOSITY_TABLE } from './data.js';

/* ============================================================================
   µ(T) for the hero figure.
   ----------------------------------------------------------------------------
   The dossier tabulates five verified (T, µ) pairs. Arrhenius behaviour is
   linear in (1/T_K, ln µ), so we interpolate piecewise-linearly in that space:
   the drawn curve passes exactly through every tabulated value and stays
   monotonic, and the two end segments extrapolate with their own slopes.
   No curve fitting, no smoothing, no invented data points.
   ========================================================================== */

const NODES = VISCOSITY_TABLE
  .map(({ t, mu }) => ({ x: 1 / (t + 273.15), y: Math.log(mu) }))
  .sort((a, b) => a.x - b.x);

/** Crude viscosity in cP at a near-wellbore temperature in °C. */
export function viscosityAt(tempC) {
  const x = 1 / (tempC + 273.15);
  let i = 0;
  while (i < NODES.length - 2 && x > NODES[i + 1].x) i += 1;
  const a = NODES[i];
  const b = NODES[i + 1];
  const slope = (b.y - a.y) / (b.x - a.x);
  return Math.exp(a.y + slope * (x - a.x));
}

/** Formats a cP value: one decimal below 100 cP, thousands-grouped above it. */
export function formatCp(mu) {
  if (mu < 100) return mu.toFixed(1);
  return Math.round(mu).toLocaleString('en-US');
}
