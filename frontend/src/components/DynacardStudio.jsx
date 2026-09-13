import React, { useCallback, useMemo, useState } from 'react';
import { Activity } from 'lucide-react';
import { AnimatedNumber } from './AnimatedNumber';
import { SkeletonPanel } from './Skeleton';

/* ============================================================================
   Shared constants — rod load ratings
   ----------------------------------------------------------------------------
   The working rating is what the rest of the application screens against.
   314.15 kN is the *material yield* of the top taper and is deliberately NOT
   used as a utilisation denominator; it is shown once, as a footnote, so the
   two numbers can never be confused again.
   ========================================================================== */
const ROD_WORKING_RATING_KN = 110.0;
const MPC_LOAD_CEILING_KN = 99.0;
const ROD_MATERIAL_YIELD_KN = 314.15;
const ANTI_FLOAT_FLOOR_KN = 0.5;

const EM = '\u2014';

/** Renders an explicit "no value reported" state. Never a plausible stand-in. */
function NA({ className = '' }) {
  return (
    <span className={`readout text-faint ${className}`}>
      <span aria-hidden="true">{EM}</span>
      <span className="sr-only">unavailable</span>
    </span>
  );
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const fmt = (v, d = 2) => (isNum(v) ? v.toFixed(d) : EM);
const signed = (v, d = 2) => (isNum(v) ? (v >= 0 ? `+${v.toFixed(d)}` : v.toFixed(d)) : EM);

/* Raw model enum -> human label. The raw token stays visible in a mono chip. */
const CLASS_LABELS = {
  NORMAL_OPERATION: 'Normal operation',
  ROD_FLOAT_PRECURSOR: 'Rod-float precursor',
  FLUID_POUND: 'Fluid pound',
  GAS_INTERFERENCE: 'Gas interference',
  PARTED_ROD: 'Parted rod',
};
const ANOMALY_LABELS = {
  NOMINAL: 'Nominal',
  ELEVATED: 'Elevated',
  CRITICAL: 'Critical',
};

function humanise(token, table) {
  if (typeof token !== 'string' || token.length === 0) return null;
  if (table && table[token]) return table[token];
  const words = token.replace(/_/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/* ---------------------------------------------------------------------------
   Axis helpers
   ------------------------------------------------------------------------- */
function niceTicks(min, max, target = 6) {
  const span = max - min;
  if (!(span > 0)) return [min];
  const raw = span / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  const step = (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
  const first = Math.ceil(min / step - 1e-9) * step;
  const out = [];
  for (let v = first; v <= max + step * 1e-6; v += step) {
    out.push(Math.abs(v) < step * 1e-9 ? 0 : Number(v.toFixed(6)));
  }
  return out;
}

const extent = (arr) => {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of arr) {
    if (!isNum(v)) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return Number.isFinite(lo) ? [lo, hi] : [0, 1];
};

/** Signed loop area via the shoelace formula — kN·m (= kJ) of net work. */
function loopArea(xs, ys) {
  if (!xs || !ys || xs.length < 3) return NaN;
  const n = Math.min(xs.length, ys.length);
  let a = 0;
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    if (!isNum(xs[i]) || !isNum(ys[i]) || !isNum(xs[j]) || !isNum(ys[j])) return NaN;
    a += xs[i] * ys[j] - xs[j] * ys[i];
  }
  return Math.abs(a) / 2;
}

/* ---------------------------------------------------------------------------
   Plot primitives
   ------------------------------------------------------------------------- */
const MARGIN = { top: 22, right: 30, bottom: 38, left: 54 };

function makePlot({ vw, vh, minX, maxX, minY, maxY }) {
  const iw = vw - MARGIN.left - MARGIN.right;
  const ih = vh - MARGIN.top - MARGIN.bottom;
  return {
    vw,
    vh,
    iw,
    ih,
    margin: MARGIN,
    minX,
    maxX,
    minY,
    maxY,
    sx: (x) => MARGIN.left + ((x - minX) / (maxX - minX)) * iw,
    sy: (y) => MARGIN.top + ih - ((y - minY) / (maxY - minY)) * ih,
  };
}

/**
 * A hairline chip pinned inside the right edge of the plot so a safety
 * boundary reads as a precise annotated rule, never as a second data series.
 */
function ThresholdTag({ plot, y, label, colorVar, dy = 0 }) {
  const w = label.length * 5.2 + 12;
  const xRight = plot.vw - plot.margin.right - 2;
  return (
    <g pointerEvents="none">
      <rect
        x={xRight - w}
        y={y - 7 + dy}
        width={w}
        height={14}
        rx="3"
        style={{ fill: 'rgb(var(--bg-surface-1))', stroke: `rgb(var(${colorVar}) / 0.4)` }}
        strokeWidth="1"
      />
      <text
        x={xRight - w / 2}
        y={y + 3.5 + dy}
        className="text-[8.5px] font-semibold"
        style={{ fill: `rgb(var(${colorVar}))` }}
        textAnchor="middle"
      >
        {label}
      </text>
    </g>
  );
}

/**
 * Interactive card plot. One component drives both the surface and the pump
 * card so their geometry, typography and interaction can never drift.
 *
 * The viewBox width is supplied by the caller and tracks the rendered
 * container width (see `VIEW_SCALE` in DynacardStudio), which keeps one
 * viewBox unit ~= one CSS pixel in every view mode. Label sizes are therefore
 * mode-invariant without any per-mode font maths.
 */
function CardPlot({
  plot,
  xs,
  ys,
  series,
  zones = [],
  band = null,
  rules = [],
  xTickFormat = (v) => v.toFixed(1),
  yTickFormat = (v) => String(v),
  xLabel,
  yLabel,
  cursorIdx,
  onCursor,
  cursorColorVar,
  ariaLabel,
  describedBy,
}) {
  const n = xs.length;
  const yTicks = useMemo(() => niceTicks(plot.minY, plot.maxY, 6), [plot.minY, plot.maxY]);
  const xTicks = useMemo(() => niceTicks(plot.minX, plot.maxX, 7), [plot.minX, plot.maxX]);

  const nearestIndex = useCallback(
    (px, py) => {
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < n; i += 1) {
        const dx = plot.sx(xs[i]) - px;
        const dy = plot.sy(ys[i]) - py;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      return best;
    },
    [n, xs, ys, plot],
  );

  const handlePointer = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const px = ((e.clientX - r.left) / r.width) * plot.vw;
    const py = ((e.clientY - r.top) / r.height) * plot.vh;
    onCursor(nearestIndex(px, py));
  };

  const handleKeyDown = (e) => {
    const cur = cursorIdx == null ? 0 : cursorIdx;
    let next = null;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = (cur + 1) % n;
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        next = (cur - 1 + n) % n;
        break;
      case 'PageUp':
        next = (cur + 12) % n;
        break;
      case 'PageDown':
        next = (cur - 12 + n) % n;
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

  const ci = cursorIdx == null ? null : Math.min(Math.max(cursorIdx, 0), n - 1);

  return (
    <svg
      viewBox={`0 0 ${plot.vw} ${plot.vh}`}
      role="img"
      aria-label={ariaLabel}
      aria-describedby={describedBy}
      tabIndex={0}
      className="w-full h-auto cursor-crosshair rounded-[5px]"
      onMouseMove={handlePointer}
      onMouseLeave={() => onCursor(null)}
      onKeyDown={handleKeyDown}
      onFocus={() => {
        if (cursorIdx == null) onCursor(0);
      }}
      onBlur={() => onCursor(null)}
    >
      <defs>
        {series
          .filter((s) => s.fill)
          .map((s) => (
            <linearGradient key={`g-${s.id}`} id={s.fill} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: `rgb(var(${s.colorVar}))`, stopOpacity: 0.26 }} />
              <stop offset="100%" style={{ stopColor: `rgb(var(${s.colorVar}))`, stopOpacity: 0 }} />
            </linearGradient>
          ))}
      </defs>

      {/* Value zones sit beneath everything */}
      {zones.map((z) => (
        <rect
          key={`z-${z.from}-${z.to}`}
          x={plot.margin.left}
          y={plot.sy(Math.max(z.from, z.to))}
          width={plot.iw}
          height={Math.abs(plot.sy(z.from) - plot.sy(z.to))}
          style={{ fill: `rgb(var(${z.colorVar}))` }}
          fillOpacity={z.opacity}
        />
      ))}

      {/* Single annotated band replaces two near-coincident dashed rules */}
      {band && (
        <g>
          <rect
            x={plot.margin.left}
            y={plot.sy(band.to)}
            width={plot.iw}
            height={Math.max(2, plot.sy(band.from) - plot.sy(band.to))}
            style={{ fill: `rgb(var(${band.colorVar}))` }}
            fillOpacity="0.17"
          />
          <line
            x1={plot.margin.left}
            y1={plot.sy(band.to)}
            x2={plot.vw - plot.margin.right}
            y2={plot.sy(band.to)}
            style={{ stroke: `rgb(var(${band.colorVar}))` }}
            strokeWidth="1"
          />
          <line
            x1={plot.margin.left}
            y1={plot.sy(band.from)}
            x2={plot.vw - plot.margin.right}
            y2={plot.sy(band.from)}
            style={{ stroke: `rgb(var(${band.edgeColorVar || band.colorVar}))` }}
            strokeWidth="1"
          />
          <ThresholdTag plot={plot} y={plot.sy((band.from + band.to) / 2)} label={band.label} colorVar={band.colorVar} />
        </g>
      )}

      {/* Value rules */}
      {yTicks.map((val) => (
        <g key={`y-${val}`}>
          <line
            x1={plot.margin.left}
            y1={plot.sy(val)}
            x2={plot.vw - plot.margin.right}
            y2={plot.sy(val)}
            className="stroke-grid"
            strokeWidth="1"
          />
          <text x={plot.margin.left - 8} y={plot.sy(val) + 3.5} className="text-[10px] fill-faint" textAnchor="end">
            {yTickFormat(val)}
          </text>
        </g>
      ))}

      {xTicks.map((val, i) => (
        <g key={`x-${val}`}>
          {i % 2 === 0 && (
            <line
              x1={plot.sx(val)}
              y1={plot.margin.top}
              x2={plot.sx(val)}
              y2={plot.vh - plot.margin.bottom}
              className="stroke-grid"
              strokeWidth="1"
            />
          )}
          <text
            x={plot.sx(val)}
            y={plot.vh - plot.margin.bottom + 14}
            className="text-[10px] fill-faint"
            textAnchor="middle"
          >
            {xTickFormat(val)}
          </text>
        </g>
      ))}

      {/* Threshold rules */}
      {rules.map((r) => (
        <g key={`r-${r.at}-${r.label}`}>
          <line
            x1={plot.margin.left}
            y1={plot.sy(r.at)}
            x2={plot.vw - plot.margin.right}
            y2={plot.sy(r.at)}
            style={{ stroke: `rgb(var(${r.colorVar}))` }}
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          <ThresholdTag plot={plot} y={plot.sy(r.at)} label={r.label} colorVar={r.colorVar} dy={r.dy || 0} />
        </g>
      ))}

      {/* Series */}
      {series.map((s) => (
        <g key={s.id}>
          {s.fill && <path className="vs-area" d={s.path} fill={`url(#${s.fill})`} stroke="none" />}
          {s.glow && (
            <path
              d={s.path}
              style={{ stroke: `rgb(var(${s.colorVar}))` }}
              fill="none"
              strokeWidth="6"
              opacity="0.14"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          <path
            key={s.animKey}
            className={s.dash ? undefined : 'vs-draw'}
            d={s.path}
            style={{
              '--draw-length': 2600,
              stroke: `rgb(var(${s.colorVar}))`,
              ...(s.dash ? { strokeDasharray: s.dash } : null),
            }}
            fill="none"
            strokeWidth={s.width}
            strokeOpacity={s.opacity ?? 1}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </g>
      ))}

      {/* Crosshair */}
      {ci != null && (
        <g pointerEvents="none">
          <line
            x1={plot.sx(xs[ci])}
            y1={plot.margin.top}
            x2={plot.sx(xs[ci])}
            y2={plot.vh - plot.margin.bottom}
            className="stroke-faint"
            strokeWidth="1"
            strokeDasharray="2 3"
          />
          <line
            x1={plot.margin.left}
            y1={plot.sy(ys[ci])}
            x2={plot.vw - plot.margin.right}
            y2={plot.sy(ys[ci])}
            className="stroke-faint"
            strokeWidth="1"
            strokeDasharray="2 3"
          />
          <circle
            cx={plot.sx(xs[ci])}
            cy={plot.sy(ys[ci])}
            r="3.5"
            style={{ fill: `rgb(var(${cursorColorVar}))`, stroke: 'rgb(var(--bg-surface-1))' }}
            strokeWidth="2"
          />
        </g>
      )}

      {/* Axis titles */}
      <text
        x={plot.margin.left + plot.iw / 2}
        y={plot.vh - 4}
        className="text-[10px] fill-faint"
        textAnchor="middle"
      >
        {xLabel}
      </text>
      <text
        x={13}
        y={plot.margin.top + plot.ih / 2}
        className="text-[10px] fill-faint"
        textAnchor="middle"
        transform={`rotate(-90, 13, ${plot.margin.top + plot.ih / 2})`}
      >
        {yLabel}
      </text>
    </svg>
  );
}

/* ---------------------------------------------------------------------------
   Cursor readout strip — the visible + accessible equivalent of the crosshair
   ------------------------------------------------------------------------- */
function CursorReadout({ items, hint }) {
  if (!items) {
    return (
      <p className="caption text-faint" aria-live="polite">
        {hint}
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1" aria-live="polite">
      {items.map((it) => (
        <span key={it.label} className="flex items-baseline gap-1.5">
          <span className="eyebrow">{it.label}</span>
          <span className="readout text-[11.5px]" style={it.colorVar ? { color: `rgb(var(${it.colorVar}))` } : undefined}>
            {it.value}
          </span>
        </span>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Model intelligence ribbon
   ------------------------------------------------------------------------- */
function ModelPanel({ title, badge, children }) {
  return (
    <section className="panel-nested p-3 flex flex-col gap-2">
      <header className="flex items-start justify-between gap-2">
        <h4 className="eyebrow">{title}</h4>
        {badge}
      </header>
      {children}
    </section>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[11.5px] text-muted">{label}</span>
      {children}
    </div>
  );
}

function ProbabilityBars({ probabilities }) {
  const entries = useMemo(() => {
    if (!probabilities || typeof probabilities !== 'object') return null;
    const list = Object.entries(probabilities).filter(([, v]) => isNum(v));
    if (list.length === 0) return null;
    return list.sort((a, b) => b[1] - a[1]);
  }, [probabilities]);

  if (!entries) {
    return <p className="caption text-faint">Class posterior not reported.</p>;
  }

  return (
    <ul className="flex flex-col gap-1 list-none m-0 p-0">
      {entries.map(([token, pct], i) => (
        <li key={token} className="flex items-center gap-2">
          <span className="readout text-[9px] text-faint w-[104px] shrink-0 truncate" title={token}>
            {token}
          </span>
          <span className="h-[3px] flex-1 rounded-full bg-surface-3 overflow-hidden" aria-hidden="true">
            <span
              className="block h-full"
              style={{
                width: `${Math.max(0, Math.min(100, pct))}%`,
                background: i === 0 ? 'rgb(var(--accent-interactive))' : 'rgb(var(--text-tertiary) / 0.55)',
              }}
            />
          </span>
          <span className="readout text-[9.5px] text-muted w-[36px] text-right">{pct.toFixed(1)}%</span>
        </li>
      ))}
    </ul>
  );
}

function DiagnosticsRibbon({ ai }) {
  const clf = ai?.classifier;
  const surr = ai?.wave_surrogate;
  const anom = ai?.anomaly_detector;

  const predictedToken = typeof clf?.predicted_class === 'string' ? clf.predicted_class : null;
  const predictedLabel = humanise(predictedToken, CLASS_LABELS);
  const isNormal = predictedToken === 'NORMAL_OPERATION';

  const anomToken = typeof anom?.status === 'string' ? anom.status : null;
  const anomLabel = humanise(anomToken, ANOMALY_LABELS);
  const anomTone = anomToken === 'CRITICAL' ? 'tone-critical' : anomToken === 'ELEVATED' ? 'tone-caution' : anomToken === 'NOMINAL' ? 'tone-safe' : '';

  const surrMicros = isNum(surr?.inference_time_ms) ? surr.inference_time_ms * 1000 : null;
  const anomMicros = isNum(anom?.inference_time_ms) ? anom.inference_time_ms * 1000 : null;
  const accel = typeof surr?.acceleration_factor === 'string' && surr.acceleration_factor.length > 0 ? surr.acceleration_factor : null;

  return (
    <section className="well p-3.5 flex flex-col gap-3" aria-labelledby="dyna-models-heading">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="icon-badge w-6 h-6 text-interactive text-[10px] font-bold" aria-hidden="true">
            ML
          </span>
          <h3 id="dyna-models-heading" className="panel-title">
            Model diagnostics
          </h3>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="eyebrow">Surrogate inference</span>
          {surrMicros != null ? (
            <span className="readout text-[11px] text-ink">{surrMicros.toFixed(0)} µs</span>
          ) : (
            <NA className="text-[11px]" />
          )}
          <span className="text-faint" aria-hidden="true">
            ·
          </span>
          <span className="eyebrow">vs PDE</span>
          {accel ? <span className="readout text-[11px] text-ink">{accel}</span> : <NA className="text-[11px]" />}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <ModelPanel
          title="Dynacard classifier"
          badge={
            isNum(clf?.confidence_pct) ? (
              <span className={`pill ${isNormal ? 'tone-safe' : 'tone-critical'}`}>{clf.confidence_pct.toFixed(1)}% conf</span>
            ) : (
              <span className="pill">
                conf <NA />
              </span>
            )
          }
        >
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-[13px] font-semibold text-ink">{predictedLabel || <NA />}</span>
            {predictedToken && <span className="pill">{predictedToken}</span>}
          </div>
          <ProbabilityBars probabilities={clf?.probabilities} />
          <div className="flex flex-col gap-1 pt-1 border-t border-hairline">
            <Row label="Compression integral">
              {isNum(clf?.compression_integral_kn_m) ? (
                <span className="readout text-[11.5px] text-ink">{clf.compression_integral_kn_m.toFixed(2)} kN·m</span>
              ) : (
                <NA className="text-[11.5px]" />
              )}
            </Row>
            <Row label="Downstroke minimum">
              {isNum(clf?.downstroke_min_kn) ? (
                <span className="readout text-[11.5px] text-ink">{signed(clf.downstroke_min_kn)} kN</span>
              ) : (
                <NA className="text-[11.5px]" />
              )}
            </Row>
          </div>
          {clf?.reason ? <p className="caption">{clf.reason}</p> : <p className="caption text-faint">No reason string reported.</p>}
        </ModelPanel>

        <ModelPanel title="Operating-point surrogate" badge={<span className="pill tone-signal">Scalar extrema</span>}>
          <div className="flex flex-col gap-1">
            <Row label="Predicted min tension">
              {isNum(surr?.predicted_min_tension_kn) ? (
                <span
                  className={`readout text-[12px] font-semibold ${
                    surr.predicted_min_tension_kn >= ANTI_FLOAT_FLOOR_KN ? 'text-safe' : 'text-critical'
                  }`}
                >
                  {signed(surr.predicted_min_tension_kn)} kN
                </span>
              ) : (
                <NA className="text-[12px]" />
              )}
            </Row>
            <Row label="Predicted PPRL">
              {isNum(surr?.predicted_pprl_kn) ? (
                <span className="readout text-[12px] text-ink">{surr.predicted_pprl_kn.toFixed(2)} kN</span>
              ) : (
                <NA className="text-[12px]" />
              )}
            </Row>
            <Row label="Inference time">
              {surrMicros != null ? (
                <span className="readout text-[11.5px] text-ink">{surrMicros.toFixed(0)} µs</span>
              ) : (
                <NA className="text-[11.5px]" />
              )}
            </Row>
          </div>
          <p className="caption">
            Screens the MPC inner loop against the {ANTI_FLOAT_FLOOR_KN.toFixed(2)} kN tension floor. No accuracy metric is
            reported by the service.
          </p>
        </ModelPanel>

        <ModelPanel
          title="Telemetry anomaly detector"
          badge={anomLabel ? <span className={`pill ${anomTone}`}>{anomLabel}</span> : <span className="pill"><NA /></span>}
        >
          <div className="flex flex-col gap-1">
            <Row label="Anomaly score">
              {isNum(anom?.anomaly_score) ? (
                <span className="readout text-[12px] font-semibold text-ink">{anom.anomaly_score.toFixed(2)}</span>
              ) : (
                <NA className="text-[12px]" />
              )}
            </Row>
            <Row label="Flagged">
              {typeof anom?.is_anomalous === 'boolean' ? (
                <span className={`readout text-[11.5px] ${anom.is_anomalous ? 'text-caution' : 'text-safe'}`}>
                  {anom.is_anomalous ? 'YES' : 'NO'}
                </span>
              ) : (
                <NA className="text-[11.5px]" />
              )}
            </Row>
            <Row label="Inference time">
              {anomMicros != null ? (
                <span className="readout text-[11.5px] text-ink">{anomMicros.toFixed(0)} µs</span>
              ) : (
                <NA className="text-[11.5px]" />
              )}
            </Row>
          </div>
          {anom?.dominant_driver ? (
            <p className="caption">{anom.dominant_driver}</p>
          ) : (
            <p className="caption text-faint">No dominant driver reported.</p>
          )}
          {anomToken && <span className="pill self-start">{anomToken}</span>}
        </ModelPanel>
      </div>
    </section>
  );
}

/* ============================================================================
   DynacardStudio
   ========================================================================== */
export function DynacardStudio({ dynacard, isBuckling, minTensionKn, aiDiagnostics }) {
  const [cursorIdx, setCursorIdx] = useState(null);
  const [showEnvelope, setShowEnvelope] = useState(true);
  const [view, setView] = useState('dual'); // 'dual' | 'surface' | 'downhole'

  const ready = Boolean(
    dynacard && Array.isArray(dynacard.surface_position_m) && dynacard.surface_position_m.length > 1,
  );

  // The viewBox width tracks the rendered container width (a single-card view
  // is ~2x as wide as one column of the dual grid), so one viewBox unit stays
  // ~1 CSS pixel and every label renders at the same visual size in both modes.
  const viewScale = view === 'dual' ? 1 : 2;
  const BASE_W = 400;
  const VIEW_H = 286;

  const geom = useMemo(() => {
    if (!ready) return null;
    const pos = dynacard.surface_position_m;
    const surf = dynacard.surface_load_kn || [];
    const down = dynacard.downhole_load_kn || [];
    const base = dynacard.baseline_downhole_load_kn || down;

    const [, posHi] = extent(pos);
    const maxX = Math.max(0.5, Math.ceil(posHi / 0.5) * 0.5);

    const [surfLo, surfHi] = extent(surf);
    const surfMax = Math.max(surfHi * 1.08, ROD_WORKING_RATING_KN * 1.06);
    const surfPlot = makePlot({
      vw: BASE_W * viewScale,
      vh: VIEW_H,
      minX: 0,
      maxX,
      minY: Math.min(0, Math.floor(surfLo / 10) * 10),
      maxY: Math.ceil(surfMax / 25) * 25,
    });

    const [downLo, downHi] = extent([...down, ...base]);
    const downPlot = makePlot({
      vw: BASE_W * viewScale,
      vh: VIEW_H,
      minX: 0,
      maxX,
      minY: Math.min(-2, Math.floor((downLo - 2) / 5) * 5),
      maxY: Math.max(5, Math.ceil((downHi + 3) / 5) * 5),
    });

    const path = (xArr, yArr, p) => {
      if (!xArr?.length || !yArr?.length) return '';
      return `${xArr
        .map((x, i) => `${i === 0 ? 'M' : 'L'} ${p.sx(x).toFixed(1)},${p.sy(yArr[i]).toFixed(1)}`)
        .join(' ')} Z`;
    };

    const areaSurface = loopArea(pos, surf);
    const areaDown = loopArea(pos, down);
    const areaBase = loopArea(pos, base);

    return {
      pos,
      surf,
      down,
      base,
      hasBaseline: Array.isArray(dynacard.baseline_downhole_load_kn),
      surfPlot,
      downPlot,
      surfPath: path(pos, surf, surfPlot),
      downPath: path(pos, down, downPlot),
      basePath: path(pos, base, downPlot),
      areaSurface,
      areaDown,
      areaBase,
      retention: isNum(areaDown) && isNum(areaBase) && areaBase > 0 ? areaDown / areaBase : NaN,
      pumpToSurface: isNum(areaDown) && isNum(areaSurface) && areaSurface > 0 ? areaDown / areaSurface : NaN,
      phaseStepDeg: 360 / pos.length,
    };
  }, [ready, dynacard, viewScale]);

  const cursor = useMemo(() => {
    if (!geom || cursorIdx == null) return null;
    const n = geom.pos.length;
    const i = Math.min(Math.max(cursorIdx, 0), n - 1);
    const prev = geom.pos[(i - 1 + n) % n];
    const next = geom.pos[(i + 1) % n];
    const rising = next - prev >= 0;
    return {
      i,
      phaseDeg: i * geom.phaseStepDeg,
      disp: geom.pos[i],
      surfLoad: geom.surf[i],
      downLoad: geom.down[i],
      baseLoad: geom.base[i],
      stroke: rising ? 'Upstroke' : 'Downstroke',
      valves: rising ? 'TV closed · SV open' : 'TV open · SV closed',
    };
  }, [geom, cursorIdx]);

  if (!ready) {
    return <SkeletonPanel title="Awaiting dynacard solution" lines={4} height={260} />;
  }

  const {
    pprl_kn,
    mprl_kn,
    oil_production_bopd,
    liquid_production_bopd,
    power_kw,
    hydraulic_power_kw,
    baseline_power_kw,
  } = dynacard;

  const downToneVar = isBuckling ? '--accent-critical' : '--accent-safe';
  const utilPct = isNum(pprl_kn) ? (pprl_kn / ROD_WORKING_RATING_KN) * 100 : NaN;
  const hydraulicFraction =
    isNum(hydraulic_power_kw) && isNum(power_kw) && power_kw > 0 ? (hydraulic_power_kw / power_kw) * 100 : NaN;

  const dataSig = `${geom.pos.length}-${view}-${fmt(geom.surf[0], 2)}-${fmt(geom.down[0], 2)}`;

  const surfaceSummary =
    `Surface dynamometer card over ${geom.pos.length} crank-phase bins at ${geom.phaseStepDeg.toFixed(1)} degree steps. ` +
    `Stroke ${fmt(geom.surfPlot.minX, 2)} to ${fmt(Math.max(...geom.pos), 2)} metres. ` +
    `Peak rod load ${fmt(pprl_kn, 1)} kilonewtons, minimum rod load ${fmt(mprl_kn, 1)} kilonewtons. ` +
    `Working rating ${ROD_WORKING_RATING_KN.toFixed(1)} kilonewtons with an MPC ceiling of ${MPC_LOAD_CEILING_KN.toFixed(1)} kilonewtons; ` +
    `utilisation ${isNum(utilPct) ? `${utilPct.toFixed(0)} percent` : 'unavailable'}. ` +
    `Enclosed loop work ${fmt(geom.areaSurface, 2)} kilojoules per stroke.`;

  const downholeSummary =
    `Pump card over ${geom.pos.length} crank-phase bins. Minimum downhole tension ${signed(minTensionKn)} kilonewtons ` +
    `against an anti-float floor of ${ANTI_FLOAT_FLOOR_KN.toFixed(2)} kilonewtons; compression below zero is the failure condition. ` +
    `Enclosed pump loop work ${fmt(geom.areaDown, 2)} kilojoules per stroke` +
    (geom.hasBaseline
      ? `, which is ${isNum(geom.retention) ? `${(geom.retention * 100).toFixed(0)} percent` : 'an unavailable fraction'} of the uncontrolled baseline card at ${fmt(geom.areaBase, 2)} kilojoules.`
      : '. No baseline reference card was reported.') +
    ` Current screen: ${isBuckling ? 'compression indicated' : 'tension floor met'}.`;

  return (
    <div className="flex flex-col gap-5 font-sans">
      <section className="panel-nested p-4" aria-labelledby="dyna-heading">
        <header className="flex flex-col xl:flex-row xl:items-center justify-between pb-4 mb-4 border-b border-hairline gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="icon-badge text-interactive" aria-hidden="true">
              <Activity className="w-[18px] h-[18px]" />
            </span>
            <div className="min-w-0">
              <h2 id="dyna-heading" className="panel-title">
                Surface &amp; pump dynamometer cards
              </h2>
              <p className="caption">
                {geom.pos.length} crank-phase bins · {geom.phaseStepDeg.toFixed(1)}° steps · index 0 at bottom of stroke
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="segmented" role="group" aria-label="Card view mode">
              {[
                ['dual', 'Dual view'],
                ['surface', 'Surface'],
                ['downhole', 'Pump'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={view === id}
                  onClick={() => setView(id)}
                  className="segmented-item"
                >
                  {label}
                </button>
              ))}
            </div>

            <label className="pill cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showEnvelope}
                onChange={(e) => setShowEnvelope(e.target.checked)}
                className="w-3.5 h-3.5 rounded-[3px] accent-interactive"
              />
              <span>Screening thresholds</span>
            </label>

            <span className={`pill ${isBuckling ? 'tone-critical' : 'tone-safe'}`}>
              <span className="chip-dot" />
              {isBuckling ? 'Compression screen' : 'Tension floor met'}
            </span>
          </div>
        </header>

        {aiDiagnostics && (
          <div className="mb-4">
            <DiagnosticsRibbon ai={aiDiagnostics} />
          </div>
        )}

        <div className={view === 'dual' ? 'grid grid-cols-1 lg:grid-cols-2 gap-5' : 'block'}>
          {/* ---- Surface card ------------------------------------------- */}
          {(view === 'dual' || view === 'surface') && (
            <section className="panel-nested p-4 flex flex-col gap-3" aria-labelledby="dyna-surf-heading">
              <div className="flex items-baseline justify-between gap-3">
                <h3 id="dyna-surf-heading" className="panel-title">
                  Surface card
                </h3>
                <span className="readout text-[11.5px] text-muted">
                  PPRL <AnimatedNumber value={pprl_kn} format={(v) => v.toFixed(1)} className="text-ink font-semibold" /> · MPRL{' '}
                  <AnimatedNumber value={mprl_kn} format={(v) => v.toFixed(1)} className="text-ink font-semibold" /> kN
                </span>
              </div>

              <p id="dyna-surf-desc" className="sr-only">
                {surfaceSummary}
              </p>

              <CardPlot
                plot={geom.surfPlot}
                xs={geom.pos}
                ys={geom.surf}
                cursorIdx={cursorIdx}
                onCursor={setCursorIdx}
                cursorColorVar="--accent-interactive"
                ariaLabel="Surface load versus stroke displacement card. Focus and use arrow keys to step the crosshair through each crank-phase bin."
                describedBy="dyna-surf-desc"
                xLabel="Stroke displacement (m)"
                yLabel="Surface load (kN)"
                rules={
                  showEnvelope
                    ? [
                        { at: MPC_LOAD_CEILING_KN, colorVar: '--accent-caution', label: `${MPC_LOAD_CEILING_KN.toFixed(0)} kN MPC` },
                        {
                          at: ROD_WORKING_RATING_KN,
                          colorVar: '--accent-critical',
                          label: `${ROD_WORKING_RATING_KN.toFixed(0)} kN working`,
                        },
                      ]
                    : []
                }
                series={[
                  {
                    id: 'surface',
                    path: geom.surfPath,
                    colorVar: '--accent-interactive',
                    width: 2.5,
                    fill: 'dyna-surf-fill',
                    glow: true,
                    animKey: `surf-${dataSig}`,
                  },
                ]}
                yTickFormat={(v) => v.toFixed(0)}
              />

              <CursorReadout
                hint="Hover or focus the plot and use ← → to inspect each crank-phase bin."
                items={
                  cursor && [
                    { label: 'Bin', value: `${cursor.i} / ${geom.pos.length - 1}` },
                    { label: 'Phase', value: `${cursor.phaseDeg.toFixed(1)}°` },
                    { label: 'Stroke', value: `${fmt(cursor.disp)} m` },
                    { label: 'Load', value: `${fmt(cursor.surfLoad, 1)} kN`, colorVar: '--accent-interactive' },
                    { label: cursor.stroke, value: cursor.valves },
                  ]
                }
              />
            </section>
          )}

          {/* ---- Pump card ---------------------------------------------- */}
          {(view === 'dual' || view === 'downhole') && (
            <section className="panel-nested p-4 flex flex-col gap-3" aria-labelledby="dyna-down-heading">
              <div className="flex items-baseline justify-between gap-3">
                <h3 id="dyna-down-heading" className="panel-title">
                  Pump card <span className="unit-label">diagnostic</span>
                </h3>
                <span className="readout text-[11.5px] text-muted">
                  F<sub>min</sub>{' '}
                  <AnimatedNumber
                    value={minTensionKn}
                    format={(v) => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2))}
                    className={`font-semibold ${isNum(minTensionKn) && minTensionKn >= ANTI_FLOAT_FLOOR_KN ? 'text-safe' : 'text-critical'}`}
                  />{' '}
                  kN
                </span>
              </div>

              <p id="dyna-down-desc" className="sr-only">
                {downholeSummary}
              </p>

              <CardPlot
                plot={geom.downPlot}
                xs={geom.pos}
                ys={geom.down}
                cursorIdx={cursorIdx}
                onCursor={setCursorIdx}
                cursorColorVar={downToneVar}
                ariaLabel="Downhole pump load versus stroke displacement card. Focus and use arrow keys to step the crosshair through each crank-phase bin."
                describedBy="dyna-down-desc"
                xLabel="Stroke displacement (m)"
                yLabel="Downhole load (kN)"
                zones={
                  showEnvelope
                    ? [
                        { from: geom.downPlot.minY, to: 0, colorVar: '--accent-critical', opacity: 0.08 },
                        { from: ANTI_FLOAT_FLOOR_KN, to: geom.downPlot.maxY, colorVar: '--accent-safe', opacity: 0.05 },
                      ]
                    : []
                }
                band={
                  showEnvelope
                    ? {
                        from: 0,
                        to: ANTI_FLOAT_FLOOR_KN,
                        colorVar: '--accent-caution',
                        edgeColorVar: '--accent-critical',
                        label: `ANTI-FLOAT 0…+${ANTI_FLOAT_FLOOR_KN.toFixed(2)} kN`,
                      }
                    : null
                }
                series={[
                  ...(geom.hasBaseline
                    ? [
                        {
                          id: 'baseline',
                          path: geom.basePath,
                          colorVar: '--text-tertiary',
                          width: 1.25,
                          dash: '4 4',
                          opacity: 0.9,
                          animKey: `base-${dataSig}`,
                        },
                      ]
                    : []),
                  {
                    id: 'downhole',
                    path: geom.downPath,
                    colorVar: downToneVar,
                    width: 2.5,
                    fill: 'dyna-down-fill',
                    glow: true,
                    animKey: `down-${dataSig}`,
                  },
                ]}
                yTickFormat={(v) => v.toFixed(0)}
              />

              <CursorReadout
                hint="Hover or focus the plot and use ← → to inspect each crank-phase bin."
                items={
                  cursor && [
                    { label: 'Bin', value: `${cursor.i} / ${geom.pos.length - 1}` },
                    { label: 'Phase', value: `${cursor.phaseDeg.toFixed(1)}°` },
                    { label: 'Stroke', value: `${fmt(cursor.disp)} m` },
                    { label: 'Pump', value: `${signed(cursor.downLoad)} kN`, colorVar: downToneVar },
                    ...(geom.hasBaseline ? [{ label: 'Baseline', value: `${signed(cursor.baseLoad)} kN` }] : []),
                    { label: cursor.stroke, value: cursor.valves },
                  ]
                }
              />
            </section>
          )}
        </div>

        {showEnvelope && (
          <p className="caption mt-4">
            Screening references — MPC load ceiling {MPC_LOAD_CEILING_KN.toFixed(1)} kN of a{' '}
            {ROD_WORKING_RATING_KN.toFixed(1)} kN working rating; downhole anti-float band spans 0 to +
            {ANTI_FLOAT_FLOOR_KN.toFixed(2)} kN, and any excursion below 0 kN is rod compression.
          </p>
        )}

        {/* Legend */}
        <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-4 mt-4 border-t border-hairline text-[11.5px] list-none m-0 p-0">
          <li className="flex items-center gap-2">
            <span className="w-4 h-[2px] rounded-full bg-interactive" aria-hidden="true" />
            <span className="text-muted">Surface card</span>
          </li>
          <li className="flex items-center gap-2">
            <span className={`w-4 h-[2px] rounded-full ${isBuckling ? 'bg-critical' : 'bg-safe'}`} aria-hidden="true" />
            <span className="text-muted">Pump card (governed)</span>
          </li>
          {geom.hasBaseline && (
            <li className="flex items-center gap-2">
              <span className="w-4 border-t border-dashed border-faint" aria-hidden="true" />
              <span className="text-muted">Pump card, uncontrolled baseline</span>
            </li>
          )}
          <li className="flex items-center gap-2">
            <span className="w-4 h-[7px] rounded-[2px] bg-caution/30 border-y border-caution" aria-hidden="true" />
            <span className="text-muted">Anti-float band</span>
          </li>
        </ul>
      </section>

      {/* ---- Card geometry: the surface-fat / pump-thin tell -------------- */}
      <section className="panel-nested p-4 flex flex-col gap-3" aria-labelledby="dyna-geom-heading">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h3 id="dyna-geom-heading" className="panel-title">
            Card geometry
          </h3>
          <span className="eyebrow">Shoelace integral of each closed loop</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="well p-3 flex flex-col gap-1.5">
            <span className="unit-label">Surface loop work</span>
            <span className="readout text-[15px] text-ink">{fmt(geom.areaSurface, 2)} kJ</span>
            <span className="caption">Net work per stroke at the polished rod.</span>
          </div>
          <div className="well p-3 flex flex-col gap-1.5">
            <span className="unit-label">Pump loop work</span>
            <span className="readout text-[15px] text-ink">{fmt(geom.areaDown, 2)} kJ</span>
            <span className="caption">
              {isNum(geom.pumpToSurface)
                ? `${(geom.pumpToSurface * 100).toFixed(0)}% of the surface loop.`
                : 'Ratio to surface loop unavailable.'}
            </span>
          </div>
          <div className={`well p-3 flex flex-col gap-1.5 ${geom.hasBaseline ? '' : 'opacity-70'}`}>
            <span className="unit-label">Pump vs baseline</span>
            {geom.hasBaseline && isNum(geom.retention) ? (
              <span
                className={`readout text-[15px] ${geom.retention < 0.85 ? 'text-caution' : 'text-ink'}`}
              >
                {(geom.retention * 100).toFixed(0)}%
              </span>
            ) : (
              <NA className="text-[15px]" />
            )}
            <span className="caption">
              A fat surface card with a thin, corner-rounded pump card is the rod-float signature.
            </span>
          </div>
          <div className="well p-3 flex flex-col gap-1.5">
            <span className="unit-label">Hydraulic / input power</span>
            {isNum(hydraulicFraction) ? (
              <span className="readout text-[15px] text-ink">{hydraulicFraction.toFixed(1)}%</span>
            ) : (
              <NA className="text-[15px]" />
            )}
            <span className="caption">
              {isNum(hydraulic_power_kw) && isNum(power_kw)
                ? `${hydraulic_power_kw.toFixed(2)} kW of ${power_kw.toFixed(2)} kW${
                    isNum(baseline_power_kw) ? ` · baseline ${baseline_power_kw.toFixed(2)} kW` : ''
                  }`
                : 'Power channels not reported.'}
            </span>
          </div>
        </div>
      </section>

      {/* ---- Scalar readout strip ---------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="panel-nested p-4 flex flex-col gap-2">
          <span className="unit-label">PPRL</span>
          <div className="flex items-baseline gap-1.5">
            <AnimatedNumber value={pprl_kn} format={(v) => v.toFixed(1)} className="metric-secondary" />
            <span className="text-[12px] font-semibold text-muted">kN</span>
          </div>
          <span className="caption">
            {isNum(utilPct)
              ? `${utilPct.toFixed(0)}% of the ${ROD_WORKING_RATING_KN.toFixed(1)} kN working rating · MPC ceiling ${MPC_LOAD_CEILING_KN.toFixed(1)} kN`
              : `Working rating ${ROD_WORKING_RATING_KN.toFixed(1)} kN · MPC ceiling ${MPC_LOAD_CEILING_KN.toFixed(1)} kN`}
          </span>
          <span className="caption text-faint">
            {ROD_MATERIAL_YIELD_KN.toFixed(2)} kN is the material yield, not a working limit.
          </span>
        </div>

        <div className="panel-nested p-4 flex flex-col gap-2">
          <span className="unit-label">MPRL</span>
          <div className="flex items-baseline gap-1.5">
            <AnimatedNumber value={mprl_kn} format={(v) => v.toFixed(1)} className="metric-secondary" />
            <span className="text-[12px] font-semibold text-muted">kN</span>
          </div>
          <span className="caption">
            {isNum(pprl_kn) && isNum(mprl_kn) ? `Load range ${(pprl_kn - mprl_kn).toFixed(1)} kN` : 'Load range unavailable'}
          </span>
        </div>

        <div className="panel-nested p-4 flex flex-col gap-2">
          <span className="unit-label">Downhole min tension</span>
          <div className="flex items-baseline gap-1.5">
            <AnimatedNumber
              value={minTensionKn}
              format={(v) => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2))}
              className={`metric-secondary ${
                isNum(minTensionKn) && minTensionKn >= ANTI_FLOAT_FLOOR_KN ? 'text-safe' : 'text-critical'
              }`}
            />
            <span className="text-[12px] font-semibold text-muted">kN</span>
          </div>
          <span className="caption">
            {!isNum(minTensionKn)
              ? 'Not reported'
              : minTensionKn >= ANTI_FLOAT_FLOOR_KN
                ? `At or above the +${ANTI_FLOAT_FLOOR_KN.toFixed(2)} kN anti-float floor`
                : `Below the +${ANTI_FLOAT_FLOOR_KN.toFixed(2)} kN anti-float floor`}
          </span>
        </div>

        <div className="panel-nested p-4 flex flex-col gap-2">
          <span className="unit-label">Oil rate</span>
          <div className="flex items-baseline gap-1.5">
            <AnimatedNumber value={oil_production_bopd} format={(v) => v.toFixed(1)} className="metric-secondary" />
            <span className="text-[12px] font-semibold text-muted">BOPD</span>
          </div>
          <span className="caption">
            {isNum(liquid_production_bopd) ? `Liquid rate ${liquid_production_bopd.toFixed(1)} BLPD` : 'Liquid rate unavailable'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default DynacardStudio;
