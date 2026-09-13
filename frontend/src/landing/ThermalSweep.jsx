import React, { memo, useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { usePrefersReducedMotion } from '../utils/motion.js';
import { usePointerParallax } from './hooks.js';
import { formatCp, viscosityAt } from './viscosity.js';
import { EMULSION_PEAK, EMULSION_PEAK_WATER_CUT, NATIVE_TEMP_C, VISCOSITY_TABLE } from './data.js';

/* ============================================================================
   Hero figure — "one cyclic steam cycle, in viscosity space".
   ----------------------------------------------------------------------------
   Authored in-house, drawn entirely from the dossier's tabulated µ(T) values.
   The sweep marker walks a steam cycle: a short injection/soak ramp up to
   260 °C, then an exponential thermal decay back toward the 48 °C native
   reservoir temperature. The lower curve is the crude; the upper dashed curve
   is the same crude at the peak water-in-oil emulsion multiplier (6.118× at
   60 % water cut). The shaded band between them is the extra viscosity the
   rod string has to shear through on every downstroke.

   Static geometry lives in memoised, prop-less subcomponents so the 60 fps
   sweep only ever reconciles the marker and the clip rect.
   ========================================================================== */

const W = 780;
const H = 440;
/* Left padding fits the widest decade label ('100k') at the largest step of
   the responsive SVG type ladder; bottom padding fits two label rows. */
const PAD = { l: 60, r: 20, t: 34, b: 56 };
const PLOT_W = W - PAD.l - PAD.r;
const PLOT_H = H - PAD.t - PAD.b;

const T_MAX = 270;
const T_MIN = 45;
const MU_MIN = 6;
const MU_MAX = 200000;
const LOG_MIN = Math.log10(MU_MIN);
const LOG_SPAN = Math.log10(MU_MAX) - LOG_MIN;

const DECADES = [
  { mu: 10, label: '10' },
  { mu: 100, label: '100' },
  { mu: 1000, label: '1k' },
  { mu: 10000, label: '10k' },
  { mu: 100000, label: '100k' },
];
const T_TICKS = [260, 220, 180, 140, 100, 60];

const xOf = (t) => PAD.l + ((T_MAX - t) / (T_MAX - T_MIN)) * PLOT_W;
const yOf = (mu) => {
  const clamped = Math.min(MU_MAX, Math.max(MU_MIN, mu));
  return PAD.t + (1 - (Math.log10(clamped) - LOG_MIN) / LOG_SPAN) * PLOT_H;
};

/* ---- Steam-cycle timeline ------------------------------------------------- */
const REHEAT_MS = 900;
const DECAY_MS = 10000;
const HOLD_MS = 1400;
const CYCLE_MS = REHEAT_MS + DECAY_MS + HOLD_MS;
/** ≈ 50.1 °C — the cold end of the tabulated data. */
const T_COLD = NATIVE_TEMP_C + 212 * Math.exp(-4.6);

const easeInOut = (p) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);

function sampleCycle(elapsed) {
  if (elapsed < REHEAT_MS) {
    const p = elapsed / REHEAT_MS;
    return { temp: T_COLD + (260 - T_COLD) * easeInOut(p), phase: 'inject' };
  }
  if (elapsed < REHEAT_MS + DECAY_MS) {
    const p = (elapsed - REHEAT_MS) / DECAY_MS;
    return { temp: NATIVE_TEMP_C + 212 * Math.exp(-4.6 * p), phase: 'decay' };
  }
  return { temp: T_COLD, phase: 'native' };
}

const PHASE_COPY = {
  inject: { label: 'Steam injection · soak', tone: 'tone-thermal' },
  decay: { label: 'Thermal decay', tone: 'tone-signal' },
  native: { label: 'Near native reservoir', tone: 'tone-critical' },
};

/* ---- Path construction ---------------------------------------------------- */
const SAMPLES = 180;

function buildPath(multiplier) {
  let d = '';
  for (let i = 0; i <= SAMPLES; i += 1) {
    const t = T_MAX - ((T_MAX - T_MIN) * i) / SAMPLES;
    d += `${i === 0 ? 'M' : 'L'}${xOf(t).toFixed(2)} ${yOf(viscosityAt(t) * multiplier).toFixed(2)}`;
  }
  return d;
}

function buildBand() {
  let forward = '';
  const back = [];
  for (let i = 0; i <= SAMPLES; i += 1) {
    const t = T_MAX - ((T_MAX - T_MIN) * i) / SAMPLES;
    const x = xOf(t).toFixed(2);
    forward += `${i === 0 ? 'M' : 'L'}${x} ${yOf(viscosityAt(t)).toFixed(2)}`;
    back.push(`L${x} ${yOf(viscosityAt(t) * EMULSION_PEAK).toFixed(2)}`);
  }
  return `${forward}${back.reverse().join('')}Z`;
}

const BASE_PATH = buildPath(1);
const EMULSION_PATH = buildPath(EMULSION_PEAK);
const BAND_PATH = buildBand();

/* ---- Static layers -------------------------------------------------------- */

const FigGrid = memo(function FigGrid() {
  return (
    <g aria-hidden="true">
      {DECADES.map((d) => (
        <g key={d.mu}>
          <line
            x1={PAD.l}
            x2={PAD.l + PLOT_W}
            y1={yOf(d.mu)}
            y2={yOf(d.mu)}
            style={{ stroke: 'rgb(var(--border-hairline))' }}
            strokeWidth="1"
          />
          <text
            x={PAD.l - 9}
            y={yOf(d.mu) + 3.5}
            textAnchor="end"
            className="cat-fig-text fill-muted"
          >
            {d.label}
          </text>
        </g>
      ))}
      {T_TICKS.map((t) => (
        <g key={t}>
          <line
            x1={xOf(t)}
            x2={xOf(t)}
            y1={PAD.t}
            y2={PAD.t + PLOT_H}
            style={{ stroke: 'rgb(var(--border-hairline))', strokeOpacity: 0.6 }}
            strokeWidth="1"
          />
          <text
            x={xOf(t)}
            y={PAD.t + PLOT_H + 18}
            textAnchor="middle"
            className="cat-fig-text fill-muted"
          >
            {t}
          </text>
        </g>
      ))}
      <text x={PAD.l - 9} y={PAD.t - 13} textAnchor="end" className="cat-fig-text fill-muted">
        cP
      </text>
      <text
        x={PAD.l + PLOT_W}
        y={PAD.t + PLOT_H + 42}
        textAnchor="end"
        className="cat-fig-text fill-muted"
      >
        NEAR-WELLBORE TEMPERATURE °C → COOLING
      </text>
      {/* Kept outside the plot clip path so the label is never cropped. */}
      <text
        x={xOf(NATIVE_TEMP_C) - 7}
        y={PAD.t - 13}
        textAnchor="end"
        className="cat-fig-text cat-fig-anno fill-critical"
      >
        NATIVE {NATIVE_TEMP_C} °C
      </text>
      <line
        x1={PAD.l}
        x2={PAD.l + PLOT_W}
        y1={PAD.t + PLOT_H}
        y2={PAD.t + PLOT_H}
        style={{ stroke: 'rgb(var(--border-strong))' }}
        strokeWidth="1"
      />
    </g>
  );
});

const FigCurves = memo(function FigCurves() {
  return (
    <g aria-hidden="true">
      <path d={BAND_PATH} fill="url(#cat-fig1-band)" />
      <path
        d={`${BASE_PATH}L${PAD.l + PLOT_W} ${PAD.t + PLOT_H}L${PAD.l} ${PAD.t + PLOT_H}Z`}
        fill="url(#cat-fig1-under)"
      />
      <path
        d={EMULSION_PATH}
        fill="none"
        style={{ stroke: 'rgb(var(--accent-critical))', strokeOpacity: 0.55 }}
        strokeWidth="1.25"
        strokeDasharray="5 4"
      />

      {/* native reservoir temperature — the floor the well always returns to */}
      <line
        x1={xOf(NATIVE_TEMP_C)}
        x2={xOf(NATIVE_TEMP_C)}
        y1={PAD.t - 6}
        y2={PAD.t + PLOT_H}
        style={{ stroke: 'rgb(var(--accent-critical))', strokeOpacity: 0.5 }}
        strokeWidth="1"
        strokeDasharray="3 3"
      />

      <path
        d={BASE_PATH}
        fill="none"
        style={{ stroke: 'rgb(var(--accent-interactive))', strokeOpacity: 0.3 }}
        strokeWidth="1.75"
      />

      <text
        x={xOf(168)}
        y={yOf(viscosityAt(168) * EMULSION_PEAK) - 11}
        textAnchor="middle"
        className="cat-fig-text cat-fig-anno fill-critical"
      >
        {`× ${EMULSION_PEAK} EMULSION @ ${EMULSION_PEAK_WATER_CUT} % WATER CUT`}
      </text>
    </g>
  );
});

/** The five tabulated (T, µ) pairs — the only measured points on the figure. */
const FigAnchors = memo(function FigAnchors() {
  return (
    <g aria-hidden="true">
      {VISCOSITY_TABLE.map((p) => (
        <g key={p.t}>
          <rect
            x={xOf(p.t) - 3}
            y={yOf(p.mu) - 3}
            width="6"
            height="6"
            style={{ fill: 'rgb(var(--bg-surface-1))', stroke: 'rgb(var(--accent-interactive))' }}
            strokeWidth="1.25"
          />
          <text
            x={xOf(p.t) + (p.t === 260 ? 10 : -9)}
            y={yOf(p.mu) - 9}
            textAnchor={p.t === 260 ? 'start' : 'end'}
            className="cat-fig-text cat-fig-anno fill-muted"
          >
            {`${p.t} °C · ${p.mu.toLocaleString('en-US')} cP`}
          </text>
        </g>
      ))}
    </g>
  );
});

const FigTravelled = memo(function FigTravelled() {
  return (
    <g clipPath="url(#cat-fig1-travelled)">
      <path
        d={BASE_PATH}
        fill="none"
        style={{ stroke: 'rgb(var(--accent-interactive))' }}
        strokeWidth="2.25"
        strokeLinecap="round"
      />
    </g>
  );
});

/* -------------------------------------------------------------------------- */

export default function ThermalSweep() {
  const reduced = usePrefersReducedMotion();
  const parallaxRef = usePointerParallax();

  const [playing, setPlaying] = useState(!reduced);
  const [temp, setTemp] = useState(260);
  const [phase, setPhase] = useState('decay');
  const [progress, setProgress] = useState(REHEAT_MS / CYCLE_MS);
  const elapsedRef = useRef(REHEAT_MS);

  useEffect(() => {
    if (!reduced) return;
    setPlaying(false);
    setTemp(T_COLD);
    setPhase('native');
    setProgress(1);
  }, [reduced]);

  useEffect(() => {
    if (!playing) return undefined;
    let raf = 0;
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(64, now - last);
      last = now;
      elapsedRef.current = (elapsedRef.current + dt) % CYCLE_MS;
      const e = elapsedRef.current;
      const sample = sampleCycle(e);
      setTemp(sample.temp);
      setPhase(sample.phase);
      setProgress(e / CYCLE_MS);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const muBase = viscosityAt(temp);
  const muEff = muBase * EMULSION_PEAK;
  const markerX = xOf(temp);
  const markerY = yOf(muBase);
  const markerYEff = yOf(muEff);
  const travelled = Math.max(0, markerX - PAD.l + 1);
  const phaseCopy = PHASE_COPY[phase];

  const readouts = [
    { k: 'T wellbore', v: temp.toFixed(1), u: '°C', cls: 'text-thermal' },
    { k: 'µ crude', v: formatCp(muBase), u: 'cP', cls: 'text-ink' },
    { k: `µ @ ${EMULSION_PEAK_WATER_CUT} % WC`, v: formatCp(muEff), u: 'cP', cls: 'text-interactive' },
  ];

  return (
    <figure className="panel cat-figure overflow-hidden" ref={parallaxRef}>
      <div className="panel-rail">
        <span className="eyebrow truncate">Fig. 01 — µ(T) · 16.5° API heavy crude</span>
        <div className="flex items-center gap-2">
          <span className={`pill ${phaseCopy.tone} hidden sm:inline-flex`}>
            <span className="chip-dot" />
            {phaseCopy.label}
          </span>
          <button
            type="button"
            className="btn-icon"
            aria-label={playing ? 'Pause the thermal-decay animation' : 'Play the thermal-decay animation'}
            aria-pressed={playing}
            onClick={() => setPlaying((v) => !v)}
          >
            {playing ? <Pause className="w-[13px] h-[13px]" /> : <Play className="w-[13px] h-[13px]" />}
          </button>
        </div>
      </div>

      <div>
        <div className="cat-parallax">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="block w-full h-auto"
            role="img"
            aria-labelledby="cat-fig1-title cat-fig1-desc"
          >
            <title id="cat-fig1-title">
              Crude viscosity against near-wellbore temperature, with the peak emulsion multiplier
            </title>
            <desc id="cat-fig1-desc">
              Log-scale plot. Crude viscosity rises from 12.4 centipoise at 260 degrees Celsius to 12,000
              centipoise at 50 degrees Celsius — roughly a thousandfold increase as the near-wellbore cools
              toward the 48 degree native reservoir temperature. A second curve shows the same crude
              multiplied by 6.118, the peak water-in-oil emulsion factor at 60 percent water cut.
            </desc>

            <defs>
              <clipPath id="cat-fig1-plot">
                <rect x={PAD.l - 1} y={PAD.t - 8} width={PLOT_W + 2} height={PLOT_H + 8} />
              </clipPath>
              <clipPath id="cat-fig1-travelled">
                <rect x={PAD.l - 1} y={PAD.t - 8} width={travelled} height={PLOT_H + 8} />
              </clipPath>
              <linearGradient id="cat-fig1-band" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" style={{ stopColor: 'rgb(var(--accent-thermal))', stopOpacity: 0.05 }} />
                <stop offset="100%" style={{ stopColor: 'rgb(var(--accent-critical))', stopOpacity: 0.16 }} />
              </linearGradient>
              <linearGradient id="cat-fig1-under" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: 'rgb(var(--accent-interactive))', stopOpacity: 0.14 }} />
                <stop offset="100%" style={{ stopColor: 'rgb(var(--accent-interactive))', stopOpacity: 0 }} />
              </linearGradient>
            </defs>

            <FigGrid />

            <g clipPath="url(#cat-fig1-plot)">
              <FigCurves />
              <FigTravelled />
              <FigAnchors />

              {/* --- sweep marker ------------------------------------------- */}
              <g aria-hidden="true">
                <line
                  x1={markerX}
                  x2={markerX}
                  y1={PAD.t}
                  y2={PAD.t + PLOT_H}
                  style={{ stroke: 'rgb(var(--accent-thermal))', strokeOpacity: 0.75 }}
                  strokeWidth="1"
                />
                <circle
                  cx={markerX}
                  cy={markerYEff}
                  r="4.5"
                  fill="none"
                  style={{ stroke: 'rgb(var(--accent-critical))' }}
                  strokeWidth="1.5"
                />
                <circle
                  cx={markerX}
                  cy={markerY}
                  r="11"
                  style={{ fill: 'rgb(var(--accent-thermal))', fillOpacity: 0.16 }}
                />
                <circle
                  cx={markerX}
                  cy={markerY}
                  r="4"
                  style={{ fill: 'rgb(var(--accent-thermal))', stroke: 'rgb(var(--bg-surface-1))' }}
                  strokeWidth="1.5"
                />
              </g>
            </g>
          </svg>
        </div>

        {/* Live readouts live in their own row: floating them over the plot
            collided with the NATIVE 48 °C and emulsion annotations. */}
        <div className="grid grid-cols-3 gap-px border-y border-hairline bg-hairline">
          {readouts.map((r) => (
            <div key={r.k} className="bg-surface-1 px-3 py-2.5">
              <span className="unit-label block whitespace-nowrap">{r.k}</span>
              <span className="mt-1 flex items-baseline gap-1 whitespace-nowrap">
                <span className={`readout text-[14px] font-semibold sm:text-[15px] ${r.cls}`}>{r.v}</span>
                <span className="unit-label">{r.u}</span>
              </span>
            </div>
          ))}
        </div>

        {/* steam-cycle position */}
        <div className="px-4 pb-3.5 pt-3">
          <div className="h-[3px] w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-interactive/70"
              style={{ width: `${(progress * 100).toFixed(2)}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="unit-label">Steam cycle · {(CYCLE_MS / 1000).toFixed(1)} s loop</span>
            <span className={`pill ${phaseCopy.tone} sm:hidden`}>
              <span className="chip-dot" />
              {phaseCopy.label}
            </span>
          </div>
        </div>
      </div>

      <figcaption className="border-t border-hairline px-4 py-3 caption">
        Curve: piecewise-Arrhenius interpolation through the five tabulated µ(T) values (square markers),
        linear in (1/T, ln µ). Upper dashed curve: the same crude at the peak emulsion multiplier. Cooling
        from 260 °C to 50 °C raises viscosity roughly 1,000×.
        <span className="sr-only">
          {' '}
          Tabulated values:{' '}
          {VISCOSITY_TABLE.map((p) => `${p.t} degrees Celsius, ${p.mu.toLocaleString('en-US')} centipoise`).join('; ')}.
        </span>
      </figcaption>
    </figure>
  );
}
