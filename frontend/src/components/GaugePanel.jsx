import React, { useId } from 'react';
import { Activity, Radio, Unplug, TriangleAlert } from 'lucide-react';
import { useCountUp } from '../utils/motion';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** React's useId contains `:` — strip it so the value is safe in any context. */
const safeId = (raw) => raw.replace(/[^a-zA-Z0-9_-]/g, '');

const TRACK = 'rgb(var(--border-strong))';

/**
 * 180° ratio gauge: hairline tick scale, one flat token-coloured arc, and a
 * monospace readout underneath. No glow filters and no gradients, so the SVG
 * declares no `defs` at all; the only generated id comes from `useId()`
 * (never from live label text, which previously produced ids containing
 * `·`, `/` and `.` that were then referenced from CSS `url(#…)`).
 *
 * `pct` is 0..100. `valueDots` is the pre-formatted display string.
 */
export function RingGauge({ pct, label, valueDots, valueSuffix = '', tone = 'rgb(var(--accent-interactive))', size = 132 }) {
  const titleId = `gauge-${safeId(useId())}`;
  const animated = useCountUp(isNum(pct) ? pct : 0, { duration: 500 });
  const clamped = Math.max(0, Math.min(100, animated));
  const available = isNum(pct);

  const stroke = 8;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const arcLength = Math.PI * r;
  const offset = arcLength * (1 - clamped / 100);
  const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  const theta = Math.PI * (1 - clamped / 100);
  const capX = cx + r * Math.cos(theta);
  const capY = cy - r * Math.sin(theta);

  const ticks = Array.from({ length: 11 }, (_, i) => {
    const a = Math.PI * (1 - i / 10);
    const inner = r - stroke / 2 - 5;
    const outer = r - stroke / 2 - 1;
    const major = i % 5 === 0;
    return {
      i,
      x1: cx + inner * Math.cos(a),
      y1: cy - inner * Math.sin(a),
      x2: cx + outer * Math.cos(a),
      y2: cy - outer * Math.sin(a),
      major,
    };
  });

  const readable = available ? `${valueDots}${valueSuffix ? ` ${valueSuffix}` : ''}` : 'unavailable';

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox={`0 0 ${size} ${size / 2 + 8}`}
        className="w-full h-auto max-w-[160px]"
        role="img"
        aria-labelledby={titleId}
      >
        <title id={titleId}>{`${label} — ${readable}`}</title>

        {ticks.map((t) => (
          <line
            key={t.i}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke="rgb(var(--text-tertiary))"
            strokeWidth="1"
            opacity={t.major ? 0.75 : 0.35}
          />
        ))}

        <path d={arc} fill="none" stroke={TRACK} strokeWidth={stroke} strokeLinecap="butt" />

        {available && (
          <>
            <path
              d={arc}
              fill="none"
              stroke={tone}
              strokeWidth={stroke}
              strokeLinecap="butt"
              style={{
                strokeDasharray: arcLength,
                strokeDashoffset: offset,
                transition: 'stroke-dashoffset 500ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            />
            <circle cx={capX} cy={capY} r="2.5" fill="rgb(var(--bg-surface-1))" stroke={tone} strokeWidth="2" />
          </>
        )}
      </svg>

      <div className="-mt-3 text-center">
        <div className="flex items-baseline justify-center gap-1">
          {available ? (
            <span className="metric-secondary" style={{ color: tone }}>
              {valueDots}
            </span>
          ) : (
            <span className="metric-secondary text-faint">
              <span aria-hidden="true">{'\u2014'}</span>
              <span className="sr-only">unavailable</span>
            </span>
          )}
          {valueSuffix && <span className="unit-label">{valueSuffix}</span>}
        </div>
        <div className="caption mt-1">{label}</div>
      </div>
    </div>
  );
}

/** Discrete telemetry-link states. Never expressed as a percentage: link
 *  health is categorical, and inventing a "55%" would be a fabricated number. */
const LINK_STATES = [
  { id: 'live', label: 'Live', icon: Radio, tone: 'tone-safe' },
  { id: 'degraded', label: 'Degraded', icon: TriangleAlert, tone: 'tone-caution' },
  { id: 'severed', label: 'Severed', icon: Unplug, tone: 'tone-critical' },
];

/**
 * Quick-read health panel: rod-load utilisation, anti-float tension margin,
 * and the categorical telemetry link state. Every value derives from live
 * simulation state; ratios are screening references against the illustrative
 * equipment limits, not certified capacity.
 */
export function GaugePanel({ pprlKn, minTensionKn, isWsLive = false, isModbusSevered = false, failsafeLevel = '' }) {
  const level = String(failsafeLevel || '');

  // Rod load against the 110 kN working rating. A PPRL of zero or less is not
  // physically meaningful, so it is reported as "no dynacard" rather than 0%.
  const loadAvailable = isNum(pprlKn) && pprlKn > 0;
  const loadPct = loadAvailable ? (pprlKn / 110) * 100 : null;
  const loadTone = !loadAvailable
    ? TRACK
    : loadPct >= 90
      ? 'rgb(var(--accent-critical))'
      : loadPct >= 75
        ? 'rgb(var(--accent-caution))'
        : 'rgb(var(--accent-safe))';

  // Tension margin: 0 kN -> 0 %, +2.0 kN or more -> 100 %.
  const marginAvailable = isNum(minTensionKn);
  const marginPct = marginAvailable ? Math.max(0, Math.min(100, (minTensionKn / 2) * 100)) : null;
  const marginTone = !marginAvailable
    ? TRACK
    : minTensionKn < 0.5
      ? 'rgb(var(--accent-critical))'
      : minTensionKn < 1
        ? 'rgb(var(--accent-caution))'
        : 'rgb(var(--accent-safe))';

  const severed = Boolean(isModbusSevered);
  const degraded = severed || level.includes('LEVEL_2') || level.includes('LEVEL_3');
  const linkState = severed ? 'severed' : degraded ? 'degraded' : isWsLive ? 'live' : 'degraded';

  const attention =
    degraded ||
    (loadAvailable && loadPct >= 90) ||
    (marginAvailable && minTensionKn < 0.5) ||
    !isWsLive;

  return (
    <section className="panel overflow-hidden" aria-labelledby="health-summary-heading">
      <div className="panel-rail">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`icon-badge w-6 h-6 ${attention ? 'text-caution' : 'text-safe'}`}>
            <Activity className="w-3.5 h-3.5" />
          </span>
          <h2 id="health-summary-heading" className="panel-title truncate">
            Health summary
          </h2>
        </div>
        <span className={`pill ${attention ? 'tone-caution' : 'tone-safe'} shrink-0`}>
          <span className="chip-dot" />
          {attention ? 'Attention' : 'Nominal'}
        </span>
      </div>

      <div className="p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="panel-nested p-3">
            <h3 className="eyebrow mb-2">Rod load</h3>
            <RingGauge
              pct={loadPct}
              tone={loadTone}
              valueDots={loadAvailable ? loadPct.toFixed(0) : ''}
              valueSuffix="%"
              label={loadAvailable ? `${pprlKn.toFixed(1)} of 110 kN rating` : 'No dynacard reported'}
            />
          </div>

          <div className="panel-nested p-3">
            <h3 className="eyebrow mb-2">Tension margin</h3>
            <RingGauge
              pct={marginPct}
              tone={marginTone}
              valueDots={marginAvailable ? `${minTensionKn >= 0 ? '+' : ''}${minTensionKn.toFixed(2)}` : ''}
              valueSuffix="kN"
              label="Anti-float floor +0.50 kN"
            />
          </div>
        </div>

        <div className="panel-nested p-3">
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <h3 className="eyebrow">Telemetry link</h3>
            {level ? (
              <span className="eyebrow readout">{level.replaceAll('_', ' ')}</span>
            ) : (
              <span className="eyebrow">no failsafe</span>
            )}
          </div>

          <ul className="grid grid-cols-3 gap-2" role="list">
            {LINK_STATES.map((state) => {
              const active = state.id === linkState;
              const Icon = state.icon;
              return (
                <li key={state.id}>
                  <div
                    className={`well flex flex-col items-center gap-1.5 py-2.5 ${active ? state.tone : 'text-faint'}`}
                    aria-current={active ? 'true' : undefined}
                  >
                    <Icon className={`w-4 h-4 ${active ? 'vs-live-dot' : ''}`} />
                    <span className="eyebrow" style={active ? { color: 'inherit' } : undefined}>
                      {state.label}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="sr-only">{`Telemetry link ${linkState}.`}</p>
        </div>
      </div>

      <p className="caption px-4 py-3 border-t border-hairline">
        Screening ratios against illustrative limits — 110 kN PPRL working rating, 99 kN MPC ceiling, +0.50 kN anti-float
        floor. Advisory reference, not certified capacity.
      </p>
    </section>
  );
}

export default GaugePanel;
