import React, { useState } from 'react';
import { Activity, ShieldCheck, AlertTriangle, Layers, Maximize2 } from 'lucide-react';
import { AnimatedNumber } from './AnimatedNumber';
import { SkeletonPanel } from './Skeleton';

export function DynacardStudio({ dynacard, isBuckling, minTensionKn }) {
  const [hoverData, setHoverData] = useState(null);
  const [showEnvelope, setShowEnvelope] = useState(true);
  const [activeCardView, setActiveCardView] = useState('dual'); // 'dual' | 'surface' | 'downhole'

  if (!dynacard || !dynacard.surface_position_m || dynacard.surface_position_m.length === 0) {
    return <SkeletonPanel title="Awaiting synthetic dynacard output" lines={4} height={260} />;
  }

  const {
    surface_position_m,
    surface_load_kn,
    downhole_load_kn,
    baseline_downhole_load_kn,
    pprl_kn,
    mprl_kn,
    oil_production_bopd,
    liquid_production_bopd,
  } = dynacard;

  // Max displacement bounds: calibrate to 3.5 m per requirement
  const strokeMaxM = 3.5;

  // Dedicated High-Precision Scale Generators
  // Surface Card Scale: 0 to 3.5 m vs 0 to 150 kN
  const surfPlot = {
    margin: { top: 20, right: 25, bottom: 35, left: 50 },
    width: activeCardView === 'dual' ? 340 : 660,
    height: 270,
    minX: 0,
    maxX: strokeMaxM,
    minY: 0,
    maxY: 150,
  };

  // Downhole Card Scale: 0 to 3.5 m vs -10 to +40 kN
  const downPlot = {
    margin: { top: 20, right: 25, bottom: 35, left: 50 },
    width: activeCardView === 'dual' ? 340 : 660,
    height: 270,
    minX: 0,
    maxX: strokeMaxM,
    minY: -10,
    maxY: 40,
  };

  const makeScaleX = (p) => (x) => p.margin.left + (x / p.maxX) * (p.width - p.margin.left - p.margin.right);
  const makeScaleY = (p) => (y) => p.margin.top + (p.height - p.margin.top - p.margin.bottom) - ((y - p.minY) / (p.maxY - p.minY)) * (p.height - p.margin.top - p.margin.bottom);

  const scaleXSurf = makeScaleX(surfPlot);
  const scaleYSurf = makeScaleY(surfPlot);

  const scaleXDown = makeScaleX(downPlot);
  const scaleYDown = makeScaleY(downPlot);

  // Path Builders
  const buildPath = (xArr, yArr, scaleX, scaleY) => {
    if (!xArr || !yArr || xArr.length === 0) return '';
    return xArr
      .map((x, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(x).toFixed(1)},${scaleY(yArr[i]).toFixed(1)}`)
      .join(' ') + ' Z';
  };

  const surfaceCardPath = buildPath(surface_position_m, surface_load_kn, scaleXSurf, scaleYSurf);
  const downholeCardPath = buildPath(surface_position_m, downhole_load_kn, scaleXDown, scaleYDown);
  const baselineDownholePath = buildPath(surface_position_m, baseline_downhole_load_kn || downhole_load_kn, scaleXDown, scaleYDown);

  // Synchronous Crosshair Handler
  const handleMouseMove = (e, plotType) => {
    const p = plotType === 'surf' ? surfPlot : downPlot;
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * p.width;
    const plotW = p.width - p.margin.left - p.margin.right;

    if (svgX < p.margin.left || svgX > p.margin.left + plotW) {
      setHoverData(null);
      return;
    }

    const dispM = ((svgX - p.margin.left) / plotW) * p.maxX;
    let closestIdx = 0;
    let minDiff = 999;
    surface_position_m.forEach((pos, idx) => {
      const diff = Math.abs(pos - dispM);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });

    setHoverData({
      disp: surface_position_m[closestIdx],
      surfLoad: surface_load_kn[closestIdx],
      downLoad: downhole_load_kn[closestIdx],
      baselineDownLoad: baseline_downhole_load_kn ? baseline_downhole_load_kn[closestIdx] : downhole_load_kn[closestIdx],
    });
  };

  return (
    <div className="flex flex-col gap-3 font-sans">
      {/* Studio Header & View Mode Selector */}
      <div className="panel p-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between pb-3 mb-3 border-b border-hairline gap-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-muted" />
            <span className="section-title">
              Reduced-Order Dynacard Estimates &mdash; Screening Thresholds
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Toggle */}
            <div className="inline-flex bg-surface-2 p-0.5 rounded-md border border-hairline text-[11px] readout">
              <button
                type="button"
                aria-pressed={activeCardView === 'dual'}
                onClick={() => setActiveCardView('dual')}
                className={`px-3 py-1 rounded transition ${
                  activeCardView === 'dual' ? 'bg-surface-1 text-interactive font-bold border border-hairline' : 'text-muted hover:text-ink'
                }`}
              >
                Dual view
              </button>
              <button
                type="button"
                aria-pressed={activeCardView === 'surface'}
                onClick={() => setActiveCardView('surface')}
                className={`px-3 py-1 rounded transition ${
                  activeCardView === 'surface' ? 'bg-surface-1 text-interactive font-bold border border-hairline' : 'text-muted hover:text-ink'
                }`}
              >
                Surface (0-150 kN)
              </button>
              <button
                type="button"
                aria-pressed={activeCardView === 'downhole'}
                onClick={() => setActiveCardView('downhole')}
                className={`px-3 py-1 rounded transition ${
                  activeCardView === 'downhole' ? 'bg-surface-1 text-interactive font-bold border border-hairline' : 'text-muted hover:text-ink'
                }`}
              >
                Downhole (-10..40 kN)
              </button>
            </div>

            <label className="flex items-center gap-1.5 cursor-pointer select-none text-muted text-[11px] readout ml-1">
              <input
                type="checkbox"
                checked={showEnvelope}
                onChange={(e) => setShowEnvelope(e.target.checked)}
                className="rounded border-hairline text-interactive focus:ring-interactive text-xs"
              />
              <span>Show screening thresholds</span>
            </label>
          </div>
        </div>

        {/* Vector SVG Cards Canvas Area */}
        <div className={activeCardView === 'dual' ? 'grid grid-cols-1 lg:grid-cols-2 gap-3' : 'flex justify-center'}>
          
          {/* Card 1: High-Precision Surface Dynamometer Card (0 - 3.5 m vs 0 - 150 kN) */}
          {(activeCardView === 'dual' || activeCardView === 'surface') && (
            <div className="panel-inset p-3 relative flex flex-col justify-between">
              <div className="flex items-center justify-between px-1 mb-1 text-[11px] readout">
                <span className="section-title flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-interactive"></span>
                  Modeled surface card (0 &ndash; 150 kN)
                </span>
                <span className="readout text-[10px] text-faint">
                  PPRL: <AnimatedNumber value={pprl_kn} format={(v) => `${v.toFixed(1)} kN`} className="text-ink font-bold" /> | MPRL: <AnimatedNumber value={mprl_kn} format={(v) => `${v.toFixed(1)} kN`} className="text-ink font-bold" />
                </span>
              </div>

            <svg
                viewBox={`0 0 ${surfPlot.width} ${surfPlot.height}`}
                role="img"
                aria-label="Synthetic modeled surface load versus stroke displacement card"
                className="w-full h-auto cursor-crosshair bg-surface-1 rounded border border-hairline"
                onMouseMove={(e) => handleMouseMove(e, 'surf')}
                onMouseLeave={() => setHoverData(null)}
              >
                {/* Surface Grid Lines */}
                {[0, 25, 50, 75, 100, 125, 150].map((val) => {
                  const y = scaleYSurf(val);
                  return (
                    <g key={`surf-y-${val}`}>
                      <line x1={surfPlot.margin.left} y1={y} x2={surfPlot.width - surfPlot.margin.right} y2={y} style={{ stroke: 'rgb(var(--border-hairline))' }} strokeWidth="1" />
                      <text x={surfPlot.margin.left - 6} y={y + 3.5} className="text-[8.5px] fill-faint font-mono text-right" textAnchor="end">
                        {val}
                      </text>
                    </g>
                  );
                })}

                {[0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5].map((val) => {
                  const x = scaleXSurf(val);
                  return (
                    <g key={`surf-x-${val}`}>
                      <line x1={x} y1={surfPlot.margin.top} x2={x} y2={surfPlot.height - surfPlot.margin.bottom} style={{ stroke: 'rgb(var(--border-hairline))' }} strokeWidth="1" />
                      <text x={x} y={surfPlot.height - surfPlot.margin.bottom + 14} className="text-[8.5px] fill-faint font-mono" textAnchor="middle">
                        {val.toFixed(1)}
                      </text>
                    </g>
                  );
                })}

                {/* API 11L Structural Rating Limits (110.0 kN rated capacity, 99.0 kN working limit) */}
                {showEnvelope && (
                  <g>
                    {/* 90% Working Limit Threshold (99.0 kN) */}
                    <line
                      x1={surfPlot.margin.left}
                      y1={scaleYSurf(99.0)}
                      x2={surfPlot.width - surfPlot.margin.right}
                      y2={scaleYSurf(99.0)}
                      style={{ stroke: 'rgb(var(--accent-critical))' }}
                      strokeWidth="1.2"
                      strokeDasharray="4 3"
                    />
                    <text x={surfPlot.width - surfPlot.margin.right - 4} y={scaleYSurf(99.0) - 3} className="text-[8px] fill-critical font-mono" textAnchor="end">
                      90% Working Limit (99.0 kN) · Rated 110.0 kN
                    </text>
                  </g>
                )}

                {/* Surface P-V Loop (interactive-toned vector, draws in on scenario switch) */}
                <path
                  key={`surf-${surface_position_m.length}-${surface_load_kn[0]?.toFixed?.(1)}`}
                  className="vs-draw stroke-interactive"
                  d={surfaceCardPath}
                  style={{ '--draw-length': 2000, fill: 'rgb(var(--accent-interactive))' }}
                  fillOpacity="0.08"
                  strokeWidth="2.2"
                />

                {/* Hover Crosshair on Surface Plot */}
                {hoverData && (
                  <g>
                    <line
                      x1={scaleXSurf(hoverData.disp)}
                      y1={surfPlot.margin.top}
                      x2={scaleXSurf(hoverData.disp)}
                      y2={surfPlot.height - surfPlot.margin.bottom}
                      style={{ stroke: 'rgb(var(--text-tertiary))' }}
                      strokeWidth="1"
                      strokeDasharray="2 2"
                    />
                    <circle
                      cx={scaleXSurf(hoverData.disp)}
                      cy={scaleYSurf(hoverData.surfLoad)}
                      r="3.5"
                      className="fill-interactive"
                      style={{ stroke: 'rgb(var(--bg-surface-1))' }}
                      strokeWidth="1.5"
                    />
                  </g>
                )}

                {/* Axis Labels */}
                <text x={surfPlot.margin.left + (surfPlot.width - surfPlot.margin.left - surfPlot.margin.right) / 2} y={surfPlot.height - 4} className="text-[9px] fill-muted font-mono" textAnchor="middle">
                  Stroke displacement (m)
                </text>
                <text
                  x={14}
                  y={surfPlot.margin.top + (surfPlot.height - surfPlot.margin.top - surfPlot.margin.bottom) / 2}
                  className="text-[9px] fill-muted font-mono"
                  textAnchor="middle"
                  transform={`rotate(-90, 14, ${surfPlot.margin.top + (surfPlot.height - surfPlot.margin.top - surfPlot.margin.bottom) / 2})`}
                >
                  Surface Load (kN)
                </text>
              </svg>
            </div>
          )}

          {/* Card 2: High-Precision Downhole Pump Card (-10 to +40 kN vs 0 - 3.5 m) */}
          {(activeCardView === 'dual' || activeCardView === 'downhole') && (
            <div className="panel-inset p-3 relative flex flex-col justify-between">
              <div className="flex items-center justify-between px-1 mb-1 text-[11px] readout">
                <span className="section-title flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${isBuckling ? 'bg-critical animate-pulse' : 'bg-safe'}`}></span>
                  Modeled downhole card (-10 &ndash; +40 kN)
                </span>
                <span className="readout text-[10px] text-faint">
                  F_min: <AnimatedNumber
                    value={minTensionKn}
                    format={(v) => `${v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2)} kN`}
                    className={`font-bold ${minTensionKn >= 0.5 ? 'text-safe' : 'text-critical'}`}
                  />
                </span>
              </div>

              <svg
                viewBox={`0 0 ${downPlot.width} ${downPlot.height}`}
                role="img"
                aria-label="Synthetic modeled downhole load versus stroke displacement card"
                className="w-full h-auto cursor-crosshair bg-surface-1 rounded border border-hairline"
                onMouseMove={(e) => handleMouseMove(e, 'down')}
                onMouseLeave={() => setHoverData(null)}
              >
                {/* Safe Operational Envelope Shaded Zone (+0.50 kN to +35.0 kN) */}
                {showEnvelope && (
                  <g>
                    {/* Permissible Safe Tension Shading */}
                    <rect
                      x={downPlot.margin.left}
                      y={scaleYDown(35)}
                      width={downPlot.width - downPlot.margin.left - downPlot.margin.right}
                      height={scaleYDown(0.5) - scaleYDown(35)}
                      style={{ fill: 'rgb(var(--accent-safe))' }}
                      fillOpacity="0.08"
                    />
                    {/* Compressive Buckling Hazard Danger Zone (< 0 kN) */}
                    <rect
                      x={downPlot.margin.left}
                      y={scaleYDown(0)}
                      width={downPlot.width - downPlot.margin.left - downPlot.margin.right}
                      height={scaleYDown(-10) - scaleYDown(0)}
                      style={{ fill: 'rgb(var(--accent-critical))' }}
                      fillOpacity="0.10"
                    />
                  </g>
                )}

                {/* Downhole Grid Lines */}
                {[-10, 0, 10, 20, 30, 40].map((val) => {
                  const y = scaleYDown(val);
                  return (
                    <g key={`down-y-${val}`}>
                      <line 
                        x1={downPlot.margin.left} 
                        y1={y} 
                        x2={downPlot.width - downPlot.margin.right} 
                        y2={y} 
                        style={{ stroke: val === 0 ? 'rgb(var(--text-tertiary))' : 'rgb(var(--border-hairline))' }}
                        strokeWidth={val === 0 ? '1.5' : '1'} 
                      />
                      <text x={downPlot.margin.left - 6} y={y + 3.5} className="text-[8.5px] fill-faint font-mono text-right" textAnchor="end">
                        {val}
                      </text>
                    </g>
                  );
                })}

                {[0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5].map((val) => {
                  const x = scaleXDown(val);
                  return (
                    <g key={`down-x-${val}`}>
                      <line x1={x} y1={downPlot.margin.top} x2={x} y2={downPlot.height - downPlot.margin.bottom} style={{ stroke: 'rgb(var(--border-hairline))' }} strokeWidth="1" />
                      <text x={x} y={downPlot.height - downPlot.margin.bottom + 14} className="text-[8.5px] fill-faint font-mono" textAnchor="middle">
                        {val.toFixed(1)}
                      </text>
                    </g>
                  );
                })}

                {/* +0.50 kN Structural Anti-Float Safety Limit Line */}
                <g>
                  <line
                    x1={downPlot.margin.left}
                    y1={scaleYDown(0.5)}
                    x2={downPlot.width - downPlot.margin.right}
                    y2={scaleYDown(0.5)}
                    style={{ stroke: 'rgb(var(--accent-caution))' }}
                    strokeWidth="1.6"
                    strokeDasharray="4 3"
                  />
                  <text x={downPlot.width - downPlot.margin.right - 4} y={scaleYDown(0.5) - 3} className="text-[8px] fill-caution font-mono font-bold" textAnchor="end">
                    +0.50 kN Model Screening Floor
                  </text>
                </g>

                {/* 0.0 kN Buckling Boundary */}
                <g>
                  <line
                    x1={downPlot.margin.left}
                    y1={scaleYDown(0.0)}
                    x2={downPlot.width - downPlot.margin.right}
                    y2={scaleYDown(0.0)}
                    style={{ stroke: 'rgb(var(--accent-critical))' }}
                    strokeWidth="1.2"
                    strokeDasharray="2 2"
                  />
                  <text x={downPlot.margin.left + 6} y={scaleYDown(0.0) + 9} className="text-[7.5px] fill-critical font-mono">
                    0.0 kN Compression Screen
                  </text>
                </g>

                {/* Baseline Downhole Curve (critical, draws in on scenario switch) */}
                <path
                  key={`base-${surface_position_m.length}-${(baseline_downhole_load_kn?.[0] ?? downhole_load_kn[0])?.toFixed?.(1)}`}
                  className="vs-draw stroke-critical"
                  d={baselineDownholePath}
                  fill="none"
                  style={{ '--draw-length': 2000 }}
                  strokeWidth="1.8"
                  opacity="0.85"
                />

                {/* Coupled Digital Twin Downhole Card (safe solid, critical if buckled — draws in) */}
                <path
                  key={`down-${surface_position_m.length}-${downhole_load_kn[0]?.toFixed?.(1)}`}
                  className={`vs-draw ${isBuckling ? 'stroke-critical' : 'stroke-safe'}`}
                  d={downholeCardPath}
                  style={{ '--draw-length': 2000, fill: isBuckling ? 'rgb(var(--accent-critical))' : 'rgb(var(--accent-safe))' }}
                  fillOpacity="0.10"
                  strokeWidth="2.2"
                />

                {/* Hover Crosshair on Downhole Plot */}
                {hoverData && (
                  <g>
                    <line
                      x1={scaleXDown(hoverData.disp)}
                      y1={downPlot.margin.top}
                      x2={scaleXDown(hoverData.disp)}
                      y2={downPlot.height - downPlot.margin.bottom}
                      style={{ stroke: 'rgb(var(--text-tertiary))' }}
                      strokeWidth="1"
                      strokeDasharray="2 2"
                    />
                    <circle
                      cx={scaleXDown(hoverData.disp)}
                      cy={scaleYDown(hoverData.downLoad)}
                      r="3.5"
                      className={isBuckling ? 'fill-critical' : 'fill-safe'}
                      style={{ stroke: 'rgb(var(--bg-surface-1))' }}
                      strokeWidth="1.5"
                    />
                  </g>
                )}

                {/* Axis Labels */}
                <text x={downPlot.margin.left + (downPlot.width - downPlot.margin.left - downPlot.margin.right) / 2} y={downPlot.height - 4} className="text-[9px] fill-muted font-mono" textAnchor="middle">
                  Stroke displacement (m)
                </text>
                <text
                  x={14}
                  y={downPlot.margin.top + (downPlot.height - downPlot.margin.top - downPlot.margin.bottom) / 2}
                  className="text-[9px] fill-muted font-mono"
                  textAnchor="middle"
                  transform={`rotate(-90, 14, ${downPlot.margin.top + (downPlot.height - downPlot.margin.top - downPlot.margin.bottom) / 2})`}
                >
                  Downhole Load (kN)
                </text>
              </svg>
            </div>
          )}
        </div>

        {/* Synchronous Hover Tooltip Banner */}
        {hoverData && (
          <div className="mt-3 p-2 panel-inset rounded-md flex flex-wrap items-center justify-between gap-2 text-xs readout text-muted">
            <span className="text-faint">Position: <strong className="text-ink">{hoverData.disp.toFixed(2)} m</strong></span>
            <span className="text-interactive">Surface Load: <strong>{hoverData.surfLoad.toFixed(1)} kN</strong></span>
            <span className={isBuckling ? 'text-critical font-bold' : 'text-safe font-bold'}>
              Modeled Downhole: <strong>{hoverData.downLoad.toFixed(2)} kN</strong>
            </span>
            <span className="text-critical text-[11px]">
              Baseline Estimate: <strong>{hoverData.baselineDownLoad.toFixed(2)} kN</strong>
            </span>
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 text-[11px] readout border-t border-hairline mt-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-1 bg-interactive rounded-sm"></span>
              <span className="text-muted">Modeled Surface</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`w-3.5 h-1 ${isBuckling ? 'bg-critical' : 'bg-safe'} rounded-sm`}></span>
              <span className="text-muted">{isBuckling ? 'Modeled Compression Screen' : 'Modeled Downhole Estimate'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-0.5 border-b-2 border-dashed border-critical"></span>
              <span className="text-muted">Baseline Downhole Estimate</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-0.5 border-b-2 border-dashed border-caution"></span>
              <span className="text-caution font-medium">+0.50 kN Model Screening Floor</span>
            </div>
          </div>

          <div className="text-faint text-[10px]">
            Deterministic reduced-order card estimator &middot; synthetic output
          </div>
        </div>
      </div>

      <div className="readout text-[10.5px] text-caution bg-caution/10 border border-caution/30 rounded-md px-3 py-1.5">
        Algebraic card estimates, not wave-solver telemetry or measured dynamometer cards. Thresholds are screening references and do not certify equipment condition.
      </div>

      {/* Technical model readout strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 readout text-xs">
        <div className="panel p-4 flex flex-col">
          <span className="text-[10px] text-muted font-sans">Peak Polished Rod Load (PPRL)</span>
          <AnimatedNumber value={pprl_kn} format={(v) => `${v.toFixed(1)} kN`} className="text-lg font-bold text-ink my-1" />
          <span className="text-[10.5px] text-faint">Illustrative 314.2 kN reference: {(pprl_kn / 314.2 * 100).toFixed(0)}% · verify equipment data</span>
        </div>

        <div className="panel p-4 flex flex-col">
          <span className="text-[10px] text-muted font-sans">Min Polished Rod Load (MPRL)</span>
          <AnimatedNumber value={mprl_kn} format={(v) => `${v.toFixed(1)} kN`} className="text-lg font-bold text-ink my-1" />
          <span className="text-[10.5px] text-faint">Kinematic delta: {(pprl_kn - mprl_kn).toFixed(1)} kN</span>
        </div>

        <div className={`panel p-4 flex flex-col border-l-2 ${
          minTensionKn >= 0.5 ? 'border-l-safe' : 'border-l-critical'
        }`}>
          <span className="text-[10px] text-muted font-sans">Downhole Minimum Tension</span>
          <AnimatedNumber
            value={minTensionKn}
            format={(v) => `${v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2)} kN`}
            className={`text-lg font-bold my-1 ${minTensionKn >= 0.5 ? 'text-safe' : 'text-critical'}`}
          />
          <span className="text-[10.5px] text-muted">
            {minTensionKn >= 0.5 ? 'Above implemented model floor' : 'Modeled compression screen'}
          </span>
        </div>

        <div className="panel p-4 flex flex-col">
          <span className="text-[10px] text-muted font-sans">Estimated Oil Rate</span>
          <AnimatedNumber value={oil_production_bopd} format={(v) => `${v.toFixed(1)} BOPD`} className="text-lg font-bold text-ink my-1" />
          <span className="text-[10.5px] text-faint">Modeled liquid rate: {liquid_production_bopd.toFixed(1)} BLPD</span>
        </div>
      </div>
    </div>
  );
}

export default DynacardStudio;
