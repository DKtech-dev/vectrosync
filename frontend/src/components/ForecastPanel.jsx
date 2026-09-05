import React from 'react';
import { TrendingUp } from 'lucide-react';

export function ForecastPanel({ forecast12h }) {
  if (!forecast12h || forecast12h.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500 font-mono text-xs bg-[#111827] rounded border border-[#1e293b]">
        Generating 12-hour predictive physics trajectory...
      </div>
    );
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
      <div className="hmi-panel p-3.5 flex flex-col justify-between bg-white border border-slate-200 rounded-lg shadow-xs">
        <div className="flex items-center justify-between text-xs pb-1.5 border-b border-slate-100">
          <span className="font-sans font-semibold text-slate-700">{label}</span>
          <span className="font-mono font-bold text-sky-700 text-xs tabular-nums">
            {formatFn(values[0])} → {formatFn(values[values.length - 1])} {unit}
          </span>
        </div>

        <div className="my-2 bg-slate-50 rounded-lg p-1.5 border border-slate-200">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
            {/* Guide Grid Lines */}
            <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 3" />
            <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 3" />
            <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#cbd5e1" strokeWidth="1" />

            {/* Trajectory Polyline */}
            <polyline fill="none" stroke={color} strokeWidth="2.2" points={points} />

            {/* Start and End Dots */}
            {points.split(' ').length > 0 && (
              <>
                <circle cx={points.split(' ')[0].split(',')[0]} cy={points.split(' ')[0].split(',')[1]} r="3" fill={color} stroke="#ffffff" strokeWidth="1.5" />
                <circle cx={points.split(' ').slice(-1)[0].split(',')[0]} cy={points.split(' ').slice(-1)[0].split(',')[1]} r="3.5" fill={color} stroke="#ffffff" strokeWidth="1.5" />
              </>
            )}
          </svg>
        </div>

        <div className="flex justify-between text-[9.5px] font-mono text-slate-500">
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
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 text-xs font-medium">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-sky-600" />
          <span className="font-bold text-slate-800 font-mono uppercase tracking-wide">
            12-Hour Multi-Physics Predictive Horizon
          </span>
          <span className="font-mono text-[10.5px] text-slate-500">Fast-Loop MPC Trajectory</span>
        </div>
        <span className="font-mono text-[11px] text-sky-700 font-medium">24 Steps (&Delta;t = 30 min)</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* 1. Formation Temperature Decay */}
        {renderSparkline('temperature_c', '#0284c7', 'Formation Temperature', '°C')}

        {/* 2. Heavy Crude Viscosity Surge */}
        {renderSparkline('viscosity_cp', '#d97706', 'Crude Dynamic Viscosity', 'cP', (v) => `${(v / 1000).toFixed(1)}k`)}

        {/* 3. Couette Shear Drag */}
        {renderSparkline('drag_beta', '#dc2626', 'Couette Shear Drag (β)', 'N·s/m²', (v) => v.toFixed(2))}

        {/* 4. Advisory MPC Speed Schedule */}
        {renderSparkline('spm_trajectory', '#059669', 'Advisory Speed Schedule', 'SPM')}
      </div>
    </div>
  );
}

export default ForecastPanel;
