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

    // Close the same point list down to the baseline so the gradient wash sits
    // under the stroke. Identical coordinates — the polyline still owns the line.
    const pointList = points.split(' ');
    const firstX = pointList[0].split(',')[0];
    const lastX = pointList[pointList.length - 1].split(',')[0];
    const baselineY = (height - padding).toFixed(1);
    const areaPath = `M ${firstX},${baselineY} L ${pointList.join(' L ')} L ${lastX},${baselineY} Z`;

    const gradId = `spark-fill-${dataKey}`;

    return (
      <div className="card-nested p-4 flex flex-col gap-4">
        {/* Label + unit, then the horizon value dominates */}
        <div className="flex flex-col gap-3 pb-4 border-b border-hairline">
          <div className="flex items-baseline justify-between gap-2">
            <span className="unit-label">{label}</span>
            <span className="unit-label text-faint">{unit}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <AnimatedNumber value={values[values.length - 1]} format={formatFn} className="metric-secondary" />
            <span className="readout text-[12px] text-muted">
              from <AnimatedNumber value={values[0]} format={formatFn} /> at T+0h
            </span>
          </div>
        </div>

        <div className="card-nested p-4">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
            <defs>
              {/* Vertical wash in the series colour, fading to nothing at the baseline */}
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.28 }} />
                <stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }} />
              </linearGradient>
            </defs>

            {/* Sparse guide rules */}
            <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} className="stroke-grid" strokeWidth="1" />
            <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} className="stroke-grid" strokeWidth="1" />

            {/* Gradient area under the curve */}
            <path className="vs-area" d={areaPath} fill={`url(#${gradId})`} stroke="none" />

            {/* Soft glow under-layer — a wide translucent stroke reads as ambient light */}
            <polyline
              fill="none"
              stroke={color}
              strokeWidth="6"
              opacity="0.15"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={points}
            />

            {/* Trajectory Polyline — draws in on scenario/data change */}
            <polyline
              key={`${dataKey}-${values[0]}-${values.length}`}
              className="vs-draw"
              fill="none"
              stroke={color}
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={points}
              style={{ '--draw-length': 700 }}
            />

            {/* Start and End Dots */}
            {points.split(' ').length > 0 && (
              <>
                <circle cx={points.split(' ')[0].split(',')[0]} cy={points.split(' ')[0].split(',')[1]} r="3" fill={color} stroke="rgb(var(--bg-surface-2))" strokeWidth="2" />
                <circle cx={points.split(' ').slice(-1)[0].split(',')[0]} cy={points.split(' ').slice(-1)[0].split(',')[1]} r="4" fill={color} stroke="rgb(var(--bg-surface-2))" strokeWidth="2" />
              </>
            )}
          </svg>

          {/* Time axis */}
          <div className="flex justify-between text-[10px] readout text-faint pt-2">
            <span>T+0h</span>
            <span>T+4h</span>
            <span>T+8h</span>
            <span>T+12h</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-5 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-hairline gap-3">
        <div className="flex items-center gap-2.5">
          <span className="icon-badge bg-interactive/10 text-interactive">
            <TrendingUp className="w-[18px] h-[18px]" />
          </span>
          <span className="card-title">12-hour reduced-order model projection</span>
        </div>
        <span className="caption">
          Advisory governor trajectory &middot; 24 steps (&Delta;t = 30 min)
        </span>
      </div>

      <p className="caption">
        Uncalibrated synthetic projection; values are not a field forecast, autonomous control plan, or operating instruction.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* 1. Formation Temperature Decay */}
        {renderSparkline('temperature_c', 'rgb(var(--accent-interactive))', 'Modeled formation temperature', '°C')}

        {/* 2. Heavy Crude Viscosity Surge */}
        {renderSparkline('viscosity_cp', 'rgb(var(--accent-caution))', 'Modeled crude viscosity', 'cP', (v) => `${(v / 1000).toFixed(1)}k`)}

        {/* 3. Couette Shear Drag */}
        {renderSparkline('drag_beta', 'rgb(var(--accent-critical))', 'Reduced-order drag coefficient β', 'N·s/m²', (v) => v.toFixed(2))}

        {/* 4. Advisory MPC Speed Schedule */}
        {renderSparkline('spm_trajectory', 'rgb(var(--accent-safe))', 'Model-recommended speed schedule', 'SPM')}
      </div>
    </div>
  );
}

export default ForecastPanel;
