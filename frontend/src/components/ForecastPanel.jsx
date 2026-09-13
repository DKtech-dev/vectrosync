import React, { useCallback, useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { AnimatedNumber } from './AnimatedNumber';
import { SkeletonPanel } from './Skeleton';

const EM = '\u2014';
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

const VW = 320;
const VH = 142;
const MARGIN = { top: 14, right: 12, bottom: 26, left: 42 };
const IW = VW - MARGIN.left - MARGIN.right;
const IH = VH - MARGIN.top - MARGIN.bottom;

/** Explicit "not reported" state — never a plausible stand-in value. */
function NA({ className = '' }) {
  return (
    <span className={`readout text-faint ${className}`}>
      <span aria-hidden="true">{EM}</span>
      <span className="sr-only">unavailable</span>
    </span>
  );
}

/**
 * One projected channel. Geometry, tick labels and the crosshair all derive
 * from the same two scales, so nothing can drift out of alignment.
 *
 * The cursor index is owned by the parent so all four channels read the same
 * forecast step at once — an instrument, not four independent widgets.
 */
function ForecastSeries({ id, label, unit, colorVar, hours, values, format, cursorIdx, onCursor }) {
  const stats = useMemo(() => {
    const finite = values.filter(isNum);
    if (finite.length < 2) return null;
    const min = Math.min(...finite);
    const max = Math.max(...finite);
    const span = max - min || Math.max(Math.abs(max), 1) * 0.02;
    return {
      min,
      max,
      mid: (min + max) / 2,
      span,
      lo: min - span * 0.12,
      hi: max + span * 0.12,
      first: values[0],
      last: values[values.length - 1],
    };
  }, [values]);

  const hourSpan = useMemo(() => {
    const h0 = hours[0];
    const hN = hours[hours.length - 1];
    return { h0, hN, range: hN - h0 || 1 };
  }, [hours]);

  const sx = useCallback((h) => MARGIN.left + ((h - hourSpan.h0) / hourSpan.range) * IW, [hourSpan]);
  const sy = useCallback((v) => (stats ? MARGIN.top + IH - ((v - stats.lo) / (stats.hi - stats.lo)) * IH : 0), [stats]);

  const paths = useMemo(() => {
    if (!stats) return null;
    const pts = values.map((v, i) => `${sx(hours[i]).toFixed(1)},${sy(v).toFixed(1)}`);
    const baseY = (MARGIN.top + IH).toFixed(1);
    const firstX = sx(hours[0]).toFixed(1);
    const lastX = sx(hours[hours.length - 1]).toFixed(1);
    return {
      line: pts.join(' '),
      area: `M ${firstX},${baseY} L ${pts.join(' L ')} L ${lastX},${baseY} Z`,
    };
  }, [stats, values, hours, sx, sy]);

  const n = values.length;
  const ci = cursorIdx == null ? null : Math.min(Math.max(cursorIdx, 0), n - 1);

  const handlePointer = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (r.width === 0) return;
    const vx = ((e.clientX - r.left) / r.width) * VW;
    const h = hourSpan.h0 + ((vx - MARGIN.left) / IW) * hourSpan.range;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < n; i += 1) {
      const d = Math.abs(hours[i] - h);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    onCursor(best);
  };

  const handleKeyDown = (e) => {
    const cur = ci == null ? 0 : ci;
    let next = null;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = Math.min(n - 1, cur + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        next = Math.max(0, cur - 1);
        break;
      case 'PageUp':
        next = Math.min(n - 1, cur + 4);
        break;
      case 'PageDown':
        next = Math.max(0, cur - 4);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = n - 1;
        break;
      case 'Escape':
        onCursor(null);
        return;
      default:
        return;
    }
    e.preventDefault();
    onCursor(next);
  };

  if (!stats || !paths) {
    return (
      <section className="panel-nested p-4 flex flex-col gap-3" aria-labelledby={`${id}-heading`}>
        <div className="flex items-baseline justify-between gap-2">
          <h3 id={`${id}-heading`} className="panel-title">
            {label}
          </h3>
          <span className="unit-label">{unit}</span>
        </div>
        <p className="caption text-faint">Channel not reported by the projection service.</p>
      </section>
    );
  }

  const delta = isNum(stats.last) && isNum(stats.first) ? stats.last - stats.first : NaN;
  const hourTicks = [0, 3, 6, 9, 12].filter((h) => h >= hourSpan.h0 - 1e-6 && h <= hourSpan.hN + 1e-6);
  const gradId = `fc-fill-${id}`;
  const descId = `${id}-desc`;

  const summary =
    `${label} projected over ${n} steps from T+${hourSpan.h0.toFixed(2)} to T+${hourSpan.hN.toFixed(2)} hours. ` +
    `Starts at ${format(stats.first)} ${unit}, ends at ${format(stats.last)} ${unit}, ` +
    `a change of ${delta >= 0 ? 'plus' : 'minus'} ${format(Math.abs(delta))} ${unit}. ` +
    `Minimum ${format(stats.min)} ${unit}, maximum ${format(stats.max)} ${unit}.`;

  return (
    <section className="panel-nested p-4 flex flex-col gap-3" aria-labelledby={`${id}-heading`}>
      <div className="flex flex-col gap-2.5 pb-3 border-b border-hairline">
        <div className="flex items-baseline justify-between gap-2">
          <h3 id={`${id}-heading`} className="panel-title">
            {label}
          </h3>
          <span className="unit-label">{unit}</span>
        </div>
        <div className="flex items-baseline gap-2 flex-wrap">
          <AnimatedNumber value={stats.last} format={format} className="metric-secondary" />
          <span className="readout text-[11.5px] text-muted">
            at T+{hourSpan.hN.toFixed(1)} h · from <AnimatedNumber value={stats.first} format={format} /> at T+
            {hourSpan.h0.toFixed(1)} h
          </span>
          {isNum(delta) && (
            <span
              className="readout text-[11.5px]"
              style={{ color: `rgb(var(${colorVar}))` }}
            >
              {delta >= 0 ? '▲' : '▼'} {format(Math.abs(delta))}
            </span>
          )}
        </div>
      </div>

      <p id={descId} className="sr-only">
        {summary}
      </p>

      <div className="well p-2">
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          role="img"
          aria-label={`${label} projection. Focus and use arrow keys to step through each forecast sample.`}
          aria-describedby={descId}
          tabIndex={0}
          className="w-full h-auto cursor-crosshair"
          onMouseMove={handlePointer}
          onMouseLeave={() => onCursor(null)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (cursorIdx == null) onCursor(0);
          }}
          onBlur={() => onCursor(null)}
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: `rgb(var(${colorVar}))`, stopOpacity: 0.26 }} />
              <stop offset="100%" style={{ stopColor: `rgb(var(${colorVar}))`, stopOpacity: 0 }} />
            </linearGradient>
          </defs>

          {/* Value rules at the real min / mid / max of the channel */}
          {[
            { v: stats.max, text: format(stats.max) },
            { v: stats.mid, text: format(stats.mid) },
            { v: stats.min, text: format(stats.min) },
          ].map((t, i) => (
            <g key={`rule-${i}`}>
              <line
                x1={MARGIN.left}
                y1={sy(t.v)}
                x2={VW - MARGIN.right}
                y2={sy(t.v)}
                className="stroke-grid"
                strokeWidth="1"
              />
              <text x={MARGIN.left - 6} y={sy(t.v) + 3.2} className="text-[9px] fill-faint" textAnchor="end">
                {t.text}
              </text>
            </g>
          ))}

          {/* Hour ticks on the same scale as the curve */}
          {hourTicks.map((h) => (
            <g key={`h-${h}`}>
              <line
                x1={sx(h)}
                y1={MARGIN.top + IH}
                x2={sx(h)}
                y2={MARGIN.top + IH + 3}
                className="stroke-grid"
                strokeWidth="1"
              />
              <text x={sx(h)} y={VH - 9} className="text-[9px] fill-faint" textAnchor="middle">
                T+{h}h
              </text>
            </g>
          ))}

          <path className="vs-area" d={paths.area} fill={`url(#${gradId})`} stroke="none" />
          <polyline
            fill="none"
            style={{ stroke: `rgb(var(${colorVar}))` }}
            strokeWidth="6"
            opacity="0.14"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={paths.line}
          />
          <polyline
            key={`${id}-${n}-${stats.first}`}
            className="vs-draw"
            fill="none"
            style={{ stroke: `rgb(var(${colorVar}))`, '--draw-length': 700 }}
            strokeWidth="2.25"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={paths.line}
          />

          {/* Endpoint markers */}
          <circle
            cx={sx(hours[0])}
            cy={sy(values[0])}
            r="2.5"
            style={{ fill: `rgb(var(${colorVar}))`, stroke: 'rgb(var(--bg-canvas))' }}
            strokeWidth="1.5"
          />
          <circle
            cx={sx(hours[n - 1])}
            cy={sy(values[n - 1])}
            r="3.5"
            style={{ fill: `rgb(var(${colorVar}))`, stroke: 'rgb(var(--bg-canvas))' }}
            strokeWidth="1.5"
          />

          {/* Crosshair */}
          {ci != null && isNum(values[ci]) && (
            <g pointerEvents="none">
              <line
                x1={sx(hours[ci])}
                y1={MARGIN.top}
                x2={sx(hours[ci])}
                y2={MARGIN.top + IH}
                className="stroke-faint"
                strokeWidth="1"
                strokeDasharray="2 3"
              />
              <circle
                cx={sx(hours[ci])}
                cy={sy(values[ci])}
                r="3.5"
                style={{ fill: `rgb(var(${colorVar}))`, stroke: 'rgb(var(--bg-surface-1))' }}
                strokeWidth="2"
              />
            </g>
          )}
        </svg>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1" aria-live="polite">
        {ci != null ? (
          <>
            <span className="flex items-baseline gap-1.5">
              <span className="eyebrow">Step</span>
              <span className="readout text-[11.5px] text-ink">
                {ci} / {n - 1}
              </span>
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="eyebrow">T+</span>
              <span className="readout text-[11.5px] text-ink">{hours[ci].toFixed(2)} h</span>
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="eyebrow">Value</span>
              {isNum(values[ci]) ? (
                <span className="readout text-[11.5px] font-semibold" style={{ color: `rgb(var(${colorVar}))` }}>
                  {format(values[ci])} {unit}
                </span>
              ) : (
                <NA className="text-[11.5px]" />
              )}
            </span>
          </>
        ) : (
          <p className="caption text-faint">Hover or focus the plot and use ← → to step through samples.</p>
        )}
      </div>
    </section>
  );
}

const CHANNELS = [
  {
    id: 'fc-temp',
    key: 'temperature_c',
    label: 'Formation temperature',
    unit: '°C',
    colorVar: '--accent-thermal',
    format: (v) => v.toFixed(1),
  },
  {
    id: 'fc-visc',
    key: 'viscosity_cp',
    label: 'Crude viscosity',
    unit: 'cP',
    colorVar: '--accent-caution',
    format: (v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(2)}k` : v.toFixed(0)),
  },
  {
    id: 'fc-drag',
    key: 'drag_beta',
    label: 'Drag coefficient β',
    unit: 'N·s/m²',
    colorVar: '--accent-critical',
    format: (v) => v.toFixed(2),
  },
  {
    id: 'fc-spm',
    key: 'spm_trajectory',
    label: 'Recommended speed schedule',
    unit: 'SPM',
    colorVar: '--accent-safe',
    format: (v) => v.toFixed(2),
  },
];

export function ForecastPanel({ forecast12h }) {
  const [cursorIdx, setCursorIdx] = useState(null);

  const hours = useMemo(() => {
    if (!Array.isArray(forecast12h)) return null;
    const h = forecast12h.map((p) => p?.hour);
    return h.every(isNum) ? h : null;
  }, [forecast12h]);

  const cadence = useMemo(() => {
    if (!hours || hours.length < 2) return null;
    const stepH = (hours[hours.length - 1] - hours[0]) / (hours.length - 1);
    return { steps: hours.length, stepMin: stepH * 60, horizonH: hours[hours.length - 1] };
  }, [hours]);

  if (!Array.isArray(forecast12h) || forecast12h.length < 2 || !hours) {
    return <SkeletonPanel title="Generating 12-hour projection" lines={4} height={220} />;
  }

  return (
    <div className="flex flex-col gap-5 font-sans">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-hairline gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="icon-badge text-interactive" aria-hidden="true">
            <TrendingUp className="w-[18px] h-[18px]" />
          </span>
          <div className="min-w-0">
            <h2 className="panel-title">12-hour projection</h2>
            <p className="caption">
              {cadence
                ? `${cadence.steps} steps to T+${cadence.horizonH.toFixed(2)} h · Δt = ${cadence.stepMin.toFixed(1)} min`
                : 'Projection cadence unavailable'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="eyebrow">Cursor syncs across channels</span>
          {cursorIdx != null && (
            <span className="pill tone-signal">T+{hours[Math.min(cursorIdx, hours.length - 1)].toFixed(2)} h</span>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {CHANNELS.map((c) => (
          <ForecastSeries
            key={c.id}
            id={c.id}
            label={c.label}
            unit={c.unit}
            colorVar={c.colorVar}
            hours={hours}
            values={forecast12h.map((p) => p?.[c.key])}
            format={c.format}
            cursorIdx={cursorIdx}
            onCursor={setCursorIdx}
          />
        ))}
      </div>
    </div>
  );
}

export default ForecastPanel;
