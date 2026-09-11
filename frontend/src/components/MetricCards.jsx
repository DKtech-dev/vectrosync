import React from 'react';
import { DotNumber } from './DotNumber';

/**
 * Miniature radial gauge: a quarter-to-full arc sweep sized entirely in `cqw`
 * (percent of the card's own width, via CSS container queries) so it can
 * never overlap a sibling regardless of how the grid reflows.
 */
function MiniGauge({ pct, toneVar }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const size = 100;
  const stroke = 7;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const arcFraction = 0.72; // 260deg sweep, gauge-style (not a full circle)
  const dash = circumference * arcFraction;
  const rotate = 90 + (360 * (1 - arcFraction)) / 2;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="glass-card__gauge w-full h-full" style={{ overflow: 'visible' }} aria-hidden="true">
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circumference}`}
        transform={`rotate(${rotate} ${cx} ${cy})`}
      />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={toneVar}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dash * (clamped / 100)} ${circumference}`}
        transform={`rotate(${rotate} ${cx} ${cy})`}
        style={{ transition: 'stroke-dasharray 0.6s cubic-bezier(0.16,1,0.3,1)' }}
      />
    </svg>
  );
}

const TONES = {
  safe: { cls: 'glass-card--safe', var: '#5eead4' },
  caution: { cls: 'glass-card--caution', var: '#fde68a' },
  critical: { cls: 'glass-card--critical', var: '#fda4af' },
  neutral: { cls: 'glass-card--neutral', var: '#c7d2fe' },
};

function CapabilityCard({ tone = 'neutral', title, caption, value, unit, gaugePct, delay = 0 }) {
  const t = TONES[tone];
  return (
    <div
      className={`glass-card ${t.cls} p-5 flex flex-col items-center text-center gap-3`}
      style={{ '--entrance-delay': `${delay}s` }}
    >
      <div className="glass-card__grain" />
      <h3 className="relative z-[2] text-[15px] font-semibold leading-snug" style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: '20px' }}>
        {title}
      </h3>

      <div className="relative z-[2] w-[34%] aspect-square my-1">
        <MiniGauge pct={gaugePct} toneVar={t.var} />
      </div>

      <div className="glass-card__metric relative z-[2] flex items-baseline gap-1.5 justify-center">
        <DotNumber value={value} dotRadius={2.3} style={{ height: '0.9em', color: '#fff' }} />
        <span className="text-[15px] font-semibold opacity-90">{unit}</span>
      </div>

      <p className="relative z-[2] text-[12.5px] leading-snug opacity-80">{caption}</p>
    </div>
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
  elapsedDays = 12.0,
}) {
  const meetsFloor = minTensionKn >= 0.5;
  const constrained = effectiveSpm < targetSpm;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <CapabilityCard
        tone="neutral"
        title={'Formation Temp'}
        value={temperatureC.toFixed(1)}
        unit="\u00b0C"
        gaugePct={Math.min(100, (temperatureC / 260) * 100)}
        caption={`Boberg-Lantz model \u00b7 CSS day ${elapsedDays.toFixed(0)}`}
        delay={0}
      />

      <CapabilityCard
        tone="caution"
        title={'Crude Viscosity'}
        value={viscosityCp > 1000 ? (viscosityCp / 1000).toFixed(1) : viscosityCp.toFixed(0)}
        unit={viscosityCp > 1000 ? 'k cP' : 'cP'}
        gaugePct={Math.min(100, (viscosityCp / 15000) * 100)}
        caption={`Arrhenius model \u00b7 \u03b2 ${dragBeta.toFixed(2)} N\u00b7s/m\u00b2`}
        delay={0.08}
      />

      <CapabilityCard
        tone={meetsFloor ? 'safe' : 'critical'}
        title={'Min Rod Tension'}
        value={minTensionKn >= 0 ? `+${minTensionKn.toFixed(2)}` : minTensionKn.toFixed(2)}
        unit="kN"
        gaugePct={Math.max(0, Math.min(100, ((minTensionKn + 2) / 4) * 100))}
        caption={
          meetsFloor
            ? `+${(minTensionKn - 0.5).toFixed(2)} kN above the +0.50 floor`
            : `${(minTensionKn - 0.5).toFixed(2)} kN below the +0.50 floor`
        }
        delay={0.16}
      />

      <CapabilityCard
        tone={constrained ? 'caution' : 'safe'}
        title={'Advisory Speed'}
        value={effectiveSpm.toFixed(1)}
        unit="SPM"
        gaugePct={(effectiveSpm / (targetSpm || 1)) * 100}
        caption={
          constrained
            ? `Throttled from requested ${targetSpm.toFixed(1)} SPM`
            : `At requested ${targetSpm.toFixed(1)} SPM setpoint`
        }
        delay={0.24}
      />
    </div>
  );
}

export default MetricCards;
