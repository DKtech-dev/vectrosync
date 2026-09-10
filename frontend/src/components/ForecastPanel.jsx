import React from 'react';
import { TrendingUp } from 'lucide-react';
import { AnimatedNumber } from './AnimatedNumber';
import { SkeletonPanel } from './Skeleton';

export function ForecastPanel({ forecast12h }) {
  if (!forecast12h || forecast12h.length === 0) {
    return <SkeletonPanel title="Generating 12-hour projection" lines={4} height={220} />;
  }

  const renderSparkline = (dataKey, color, label, unit, formatFn = (v) => v.toFixed(1)) => {
    const values = forecast12h.map((p) => p[dataKey]);
    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    const range = maxV - minV || 1;

    const width = 280;
    const height = 110;
    const padding = 15;

    const points = values
      .map((val, idx) => {
        const x = padding + (idx / (values.length - 1)) * (width - 2 * padding);
        const y = height - padding - ((val - minV) / range) * (height - 2 * padding);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

    return (
      <div className="panel p-3 flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs pb-3 border-b border-hairline">
          <span className="font-semibold text-muted">{label}</span>
          <span className="readout font-semibold text-ink text-xs">
            <AnimatedNumber value={values[0]} format={formatFn} /> →{' '}
            <AnimatedNumber value={values[values.length - 1]} format={formatFn} /> {unit}
          </span>
        </div>

        <div className="panel-inset my-3 p-2">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
            {/* Guide Grid Lines */}
            <line x1={padding} y1={padding} x2={width - padding} y2={padding} className="stroke-hairline" strokeWidth="1" strokeDasharray="3 3" />
            <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} className="stroke-hairline" strokeWidth="1" strokeDasharray="3 3" />
            <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} className="stroke-hairline" strokeWidth="1" />

            {/* Trajectory Polyline — draws in on scenario/data change */}
            <polyline
              key={`${dataKey}-${values[0]}-${values.length}`}
              className="vs-draw"
              fill="none"
              stroke={color}
              strokeWidth="2.2"
              points={points}
              style={{ '--draw-length': 700 }}
            />

            {/* Start and End Dots */}
            {points.split(' ').length > 0 && (
              <>
                <circle cx={points.split(' ')[0].split(',')[0]} cy={points.split(' ')[0].split(',')[1]} r="3" fill={color} stroke="rgb(var(--bg-surface-1))" strokeWidth="1.5" />
                <circle cx={points.split(' ').slice(-1)[0].split(',')[0]} cy={points.split(' ').slice(-1)[0].split(',')[1]} r="3.5" fill={color} stroke="rgb(var(--bg-surface-1))" strokeWidth="1.5" />
              </>
            )}
          </svg>
        </div>

        <div className="flex justify-between text-[9.5px] readout text-faint">
          <span>T+0h</span>
          <span>T+4h</span>
          <span>T+8h</span>
          <span>T+12h (Horizon)</span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-hairline text-xs font-medium gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <TrendingUp className="w-4 h-4 text-muted" />
          <span className="section-title">12-Hour Reduced-Order Model Projection</span>
          <span className="text-[10.5px] text-muted">Advisory governor trajectory</span>
        </div>
        <span className="chip text-muted bg-surface-2 border-hairline">24 Steps (&Delta;t = 30 min)</span>
      </div>

      <div className="readout text-[10.5px] text-caution bg-caution/10 border border-caution/30 rounded-md px-3 py-1.5">
        Uncalibrated synthetic projection; values are not a field forecast, autonomous control plan, or operating instruction.
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* 1. Formation Temperature Decay */}
        {renderSparkline('temperature_c', 'rgb(var(--accent-interactive))', 'Modeled Formation Temperature', '°C')}

        {/* 2. Heavy Crude Viscosity Surge */}
        {renderSparkline('viscosity_cp', 'rgb(var(--accent-caution))', 'Modeled Crude Viscosity', 'cP', (v) => `${(v / 1000).toFixed(1)}k`)}

        {/* 3. Couette Shear Drag */}
        {renderSparkline('drag_beta', 'rgb(var(--accent-critical))', 'Reduced-Order Drag Coefficient (β)', 'N·s/m²', (v) => v.toFixed(2))}

        {/* 4. Advisory MPC Speed Schedule */}
        {renderSparkline('spm_trajectory', 'rgb(var(--accent-safe))', 'Model-Recommended Speed Schedule', 'SPM')}
      </div>
    </div>
  );
}

export default ForecastPanel;
