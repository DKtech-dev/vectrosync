import React from 'react';
import { useCountUp } from '../utils/motion';
import { DotNumber } from './DotNumber';

/**
 * Radial gauge with a soft glow arc, sized in cqw so it never collides with
 * a sibling. `pct` is 0..100.
 */
export function RingGauge({ pct, label, valueDots, valueSuffix = '', tone = '#5eead4', size = 132 }) {
  const animated = useCountUp(pct, { duration: 500 });
  const clamped = Math.max(0, Math.min(100, animated));

  const stroke = 9;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = Math.PI * r;
  const offset = circumference * (1 - clamped / 100);
  const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size / 2 + 10} viewBox={`0 0 ${size} ${size / 2 + 10}`} role="img" aria-label={`${label}`} style={{ overflow: 'visible' }}>
        <defs>
          <filter id={`glow-${label.replace(/\s/g, '')}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path d={arc} fill="none" strokeWidth={stroke} strokeLinecap="round" style={{ stroke: 'rgba(255,255,255,0.14)' }} />
        <path
          d={arc}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          style={{ stroke: tone, strokeDasharray: circumference, strokeDashoffset: offset, filter: `url(#glow-${label.replace(/\s/g, '')})`, transition: 'stroke-dashoffset 0.5s cubic-bezier(0.16,1,0.3,1)' }}
        />
      </svg>
      <div className="-mt-7 text-center">
        <div className="flex items-baseline justify-center gap-1" style={{ color: '#fff' }}>
          <DotNumber value={valueDots} dotRadius={2.1} style={{ height: '0.95em' }} />
          {valueSuffix && <span className="text-[13px] font-semibold opacity-85">{valueSuffix}</span>}
        </div>
        <div className="text-[11.5px] mt-1.5 opacity-75">{label}</div>
      </div>
    </div>
  );
}

/**
 * Quick-read health panel: rod load capacity, tension margin vs the screening
 * floor, and telemetry link health. All values derive from existing sim state.
 */
export function GaugePanel({ pprlKn = 0, minTensionKn = 0, isWsLive = false, isModbusSevered = false, failsafeLevel = '' }) {
  // Rod load capacity against the illustrative 110 kN rating.
  const loadPct = Math.max(0, Math.min(100, (pprlKn / 110) * 100));
  const loadTone = loadPct >= 90 ? '#fda4af' : loadPct >= 75 ? '#fde68a' : '#5eead4';

  // Tension margin: 0 kN -> 0%, +2 kN or more -> 100%.
  const marginPct = Math.max(0, Math.min(100, (minTensionKn / 2.0) * 100));
  const marginTone = minTensionKn < 0.5 ? '#fda4af' : minTensionKn < 1.0 ? '#fde68a' : '#5eead4';

  // Telemetry health.
  const healthy = isWsLive && !isModbusSevered && !failsafeLevel.includes('LEVEL_3');
  const degraded = isModbusSevered || failsafeLevel.includes('LEVEL_2') || failsafeLevel.includes('LEVEL_3');
  const healthPct = isModbusSevered ? 0 : healthy ? 100 : 55;
  const healthTone = degraded ? '#fda4af' : healthy ? '#5eead4' : '#fde68a';

  return (
    <div className="glass-card glass-card--neutral p-5" style={{ '--entrance-delay': '0.1s' }}>
      <div className="glass-card__grain" />
      <div className="relative z-[2] flex items-center justify-between gap-3 mb-1">
        <h2 className="text-[18px]" style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}>Health Summary</h2>
        <span
          className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
          style={{ background: degraded ? 'rgba(253,164,175,0.18)' : 'rgba(94,234,212,0.18)', color: degraded ? '#fda4af' : '#5eead4' }}
        >
          {degraded ? 'Attention' : 'Nominal'}
        </span>
      </div>
      <p className="relative z-[2] text-[12px] opacity-70 mb-3">Screening ratios from the reduced-order model</p>

      <div className="relative z-[2] grid grid-cols-1 gap-2">
        <div className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)' }}>
          <RingGauge pct={loadPct} tone={loadTone} valueDots={loadPct.toFixed(0)} valueSuffix="%" label={`Rod load \u00b7 ${pprlKn.toFixed(1)} / 110 kN`} />
        </div>

        <div className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)' }}>
          <RingGauge pct={marginPct} tone={marginTone} valueDots={`${minTensionKn >= 0 ? '+' : ''}${minTensionKn.toFixed(2)}`} label="Tension margin \u00b7 floor +0.50 kN" />
        </div>

        <div className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)' }}>
          <RingGauge pct={healthPct} tone={healthTone} valueDots={healthPct.toFixed(0)} valueSuffix="%" label={isModbusSevered ? 'Telemetry link \u00b7 lost' : healthy ? 'Telemetry link \u00b7 live' : 'Telemetry link \u00b7 degraded'} />
        </div>
      </div>

      <p className="relative z-[2] text-[11.5px] opacity-65 mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.14)' }}>
        Ratios are screening references against illustrative equipment limits, not certified capacity.
      </p>
    </div>
  );
}

export default GaugePanel;
