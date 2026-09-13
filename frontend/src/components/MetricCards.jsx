import React from 'react';
import { Thermometer, Droplets, MoveVertical, Gauge } from 'lucide-react';
import { AnimatedNumber } from './AnimatedNumber';

/**
 * The four headline KPIs, read as instrument faces rather than cards: a flush
 * tag rail, one monospace readout, and a linear scale that shows where the
 * value sits inside its real engineering range (with the governing thresholds
 * ticked on the scale itself).
 *
 * Values are rendered as text — a monospace `.metric-hero` readout is both
 * more legible and more credible than a faux-LED bitmap, and it is readable
 * by assistive technology without a parallel text twin.
 */

const TONES = {
  neutral: { text: 'text-ink', accent: 'var(--text-secondary)', pill: '' },
  signal: { text: 'text-interactive', accent: 'var(--accent-interactive)', pill: 'tone-signal' },
  safe: { text: 'text-safe', accent: 'var(--accent-safe)', pill: 'tone-safe' },
  caution: { text: 'text-caution', accent: 'var(--accent-caution)', pill: 'tone-caution' },
  critical: { text: 'text-critical', accent: 'var(--accent-critical)', pill: 'tone-critical' },
  thermal: { text: 'text-thermal', accent: 'var(--accent-thermal)', pill: 'tone-thermal' },
};

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** Position of `value` inside [min, max] as 0..1, on a linear or log10 axis. */
function axisFraction(value, { min, max, log = false }) {
  if (!isNum(value)) return null;
  if (log) {
    const lo = Math.log10(Math.max(min, 1e-6));
    const hi = Math.log10(Math.max(max, min * 10));
    return clamp01((Math.log10(Math.max(value, 1e-6)) - lo) / (hi - lo));
  }
  return clamp01((value - min) / (max - min));
}

/**
 * Linear scale: hairline rail, filled span, and threshold ticks. Built from
 * 1px divs rather than SVG so hairlines stay exactly one device pixel and
 * there are no document-unique IDs to collide.
 */
function ScaleBar({ axis, value, accent, markers = [] }) {
  const fraction = axisFraction(value, axis);

  return (
    <div className="mt-4">
      <div className="relative h-[7px] rounded-[2px] bg-surface-2 border border-hairline overflow-hidden">
        {fraction !== null && (
          <div
            className="absolute inset-y-0 left-0 transition-[width] duration-500 ease-instrument"
            style={{ width: `${fraction * 100}%`, background: `rgb(${accent} / 0.85)` }}
          />
        )}
        {markers.map((m) => {
          const at = axisFraction(m.at, axis);
          if (at === null) return null;
          return (
            <span
              key={m.label}
              className="absolute top-0 bottom-0 w-[1px]"
              style={{ left: `${at * 100}%`, background: `rgb(var(${m.accent}) / 0.9)` }}
              aria-hidden="true"
            />
          );
        })}
      </div>

      <div className="flex items-baseline justify-between gap-2 mt-1.5">
        <span className="eyebrow">{axis.minLabel}</span>
        {markers.length > 0 && (
          <span className="eyebrow truncate" style={{ color: `rgb(var(${markers[0].accent}))` }}>
            {markers[0].label}
          </span>
        )}
        <span className="eyebrow">{axis.maxLabel}</span>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, tag, title, value, format, unit, tone = 'neutral', status, axis, markers, note, delay = 0 }) {
  const t = TONES[tone] ?? TONES.neutral;
  const available = isNum(value);

  return (
    <article
      className="panel vs-establish overflow-hidden flex flex-col"
      style={{ '--entrance-delay': `${delay}ms` }}
    >
      <div className="panel-rail">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`icon-badge w-6 h-6 ${t.text}`}>
            <Icon className="w-3.5 h-3.5" />
          </span>
          <h3 className="panel-title truncate">{title}</h3>
        </div>
        <span className="eyebrow shrink-0">{tag}</span>
      </div>

      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-end justify-between gap-3">
          <div className="flex items-baseline gap-1.5 min-w-0">
            {available ? (
              <AnimatedNumber value={value} format={format} className={`metric-hero ${t.text}`} />
            ) : (
              <span className="metric-hero text-faint">
                <span aria-hidden="true">{'\u2014'}</span>
                <span className="sr-only">unavailable</span>
              </span>
            )}
            <span className="unit-label">{unit}</span>
          </div>
          {status && (
            <span className={`pill ${t.pill} shrink-0`}>
              <span className="chip-dot" />
              {status}
            </span>
          )}
        </div>

        <div className="flex-1 pb-4">
          {available ? (
            <ScaleBar axis={axis} value={value} accent={t.accent} markers={markers} />
          ) : (
            <p className="caption mt-4">No value reported by the model for this field.</p>
          )}
        </div>

        <p className="caption pt-3 border-t border-hairline">{note}</p>
      </div>
    </article>
  );
}

export function MetricCards({
  temperatureC,
  viscosityCp,
  dragBeta,
  minTensionKn,
  effectiveSpm,
  targetSpm,
  isBuckling,
  elapsedDays,
}) {
  const tensionTone = !isNum(minTensionKn)
    ? 'neutral'
    : isBuckling || minTensionKn < 0
      ? 'critical'
      : minTensionKn < 0.5
        ? 'caution'
        : 'safe';

  const tensionStatus = !isNum(minTensionKn)
    ? null
    : isBuckling || minTensionKn < 0
      ? 'Compression'
      : minTensionKn < 0.5
        ? 'Below floor'
        : 'Margin held';

  const tensionNote = isNum(minTensionKn)
    ? minTensionKn >= 0.5
      ? `${(minTensionKn - 0.5).toFixed(2)} kN above the +0.50 kN anti-float floor.`
      : `${(0.5 - minTensionKn).toFixed(2)} kN short of the +0.50 kN anti-float floor.`
    : 'Minimum rod tension unavailable.';

  const constrained = isNum(effectiveSpm) && isNum(targetSpm) && effectiveSpm < targetSpm - 0.005;
  const spmNote = isNum(targetSpm)
    ? constrained
      ? `Throttled from the requested ${targetSpm.toFixed(2)} SPM to hold rod tension.`
      : `Tracking the requested ${targetSpm.toFixed(2)} SPM setpoint.`
    : 'Requested setpoint unavailable.';

  const viscKilo = isNum(viscosityCp) && viscosityCp >= 1000;

  return (
    <section aria-labelledby="kpi-strip-heading">
      <h2 id="kpi-strip-heading" className="sr-only">
        Primary indicators
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          icon={Thermometer}
          tag="TI-101"
          title="Sandface temperature"
          tone="thermal"
          value={temperatureC}
          format={(v) => v.toFixed(1)}
          unit="°C"
          axis={{ min: 48, max: 260, minLabel: '48 native', maxLabel: '260 steam' }}
          note={
            isNum(elapsedDays)
              ? `Boberg–Lantz soak decline · CSS day ${elapsedDays.toFixed(0)}.`
              : 'Boberg–Lantz soak decline · elapsed CSS day unavailable.'
          }
          delay={0}
        />

        <KpiCard
          icon={Droplets}
          tag="VI-201"
          title="Mixture viscosity"
          tone="caution"
          value={viscosityCp}
          format={(v) => (viscKilo ? (v / 1000).toFixed(1) : v.toFixed(0))}
          unit={viscKilo ? 'k cP' : 'cP'}
          axis={{ min: 10, max: 20000, log: true, minLabel: 'log 10', maxLabel: '20k cP' }}
          note={
            isNum(dragBeta)
              ? `Arrhenius crude law with water-in-oil emulsion uplift · drag β ${dragBeta.toFixed(2)} N·s/m².`
              : 'Arrhenius crude law with water-in-oil emulsion uplift · drag β unavailable.'
          }
          delay={70}
        />

        <KpiCard
          icon={MoveVertical}
          tag="WE-401"
          title="Min rod tension"
          tone={tensionTone}
          value={minTensionKn}
          format={(v) => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2))}
          unit="kN"
          status={tensionStatus}
          axis={{ min: -2, max: 4, minLabel: '−2 kN', maxLabel: '+4 kN' }}
          markers={[{ at: 0.5, label: 'floor +0.50', accent: '--accent-safe' }]}
          note={tensionNote}
          delay={140}
        />

        <KpiCard
          icon={Gauge}
          tag="SIC-501"
          title="Advised pump speed"
          tone={constrained ? 'caution' : 'signal'}
          value={effectiveSpm}
          format={(v) => v.toFixed(2)}
          unit="SPM"
          status={isNum(effectiveSpm) ? (constrained ? 'Throttled' : 'At setpoint') : null}
          axis={{ min: 1, max: 5.5, minLabel: '1.0 min', maxLabel: '5.5 max' }}
          markers={
            isNum(targetSpm) ? [{ at: targetSpm, label: `req ${targetSpm.toFixed(1)}`, accent: '--accent-interactive' }] : []
          }
          note={spmNote}
          delay={210}
        />
      </div>
    </section>
  );
}

export default MetricCards;
