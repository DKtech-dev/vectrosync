import React, { useState } from 'react';
import { Activity, ShieldCheck, AlertTriangle, Layers, Maximize2 } from 'lucide-react';

export function DynacardStudio({ dynacard, isBuckling, minTensionKn }) {
  const [hoverData, setHoverData] = useState(null);
  const [showEnvelope, setShowEnvelope] = useState(true);
  const [activeCardView, setActiveCardView] = useState('dual'); // 'dual' | 'surface' | 'downhole'

  if (!dynacard || !dynacard.surface_position_m || dynacard.surface_position_m.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500 font-mono text-xs bg-[#111827] rounded border border-[#1e293b]">
        Awaiting wave solver dynamometer telemetry...
      </div>
    );
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
      <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2.5 border-b border-slate-200 gap-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-sky-600" />
            <span className="font-bold text-xs text-slate-800 uppercase tracking-wide font-mono">
              High-Precision Dynacard Studio &mdash; Safe Operational Envelope
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="inline-flex bg-slate-100 p-0.5 rounded-md border border-slate-200 text-[11px] font-mono">
              <button
                onClick={() => setActiveCardView('dual')}
                className={`px-2.5 py-0.5 rounded transition ${
                  activeCardView === 'dual' ? 'bg-white text-sky-700 font-bold border border-slate-200 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                DUAL SPLIT
              </button>
              <button
                onClick={() => setActiveCardView('surface')}
                className={`px-2.5 py-0.5 rounded transition ${
                  activeCardView === 'surface' ? 'bg-white text-sky-700 font-bold border border-slate-200 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                SURFACE (0-150kN)
              </button>
              <button
                onClick={() => setActiveCardView('downhole')}
                className={`px-2.5 py-0.5 rounded transition ${
                  activeCardView === 'downhole' ? 'bg-white text-sky-700 font-bold border border-slate-200 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                DOWNHOLE (-10..40kN)
              </button>
            </div>

            <label className="flex items-center gap-1.5 cursor-pointer select-none text-slate-600 text-[11px] font-mono ml-1">
              <input
                type="checkbox"
                checked={showEnvelope}
                onChange={(e) => setShowEnvelope(e.target.checked)}
                className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 text-xs"
              />
              <span>Safe Envelope</span>
            </label>
          </div>
        </div>

        {/* Vector SVG Cards Canvas Area */}
        <div className={`pt-3 ${activeCardView === 'dual' ? 'grid grid-cols-1 lg:grid-cols-2 gap-3' : 'flex justify-center'}`}>
          
          {/* Card 1: High-Precision Surface Dynamometer Card (0 - 3.5 m vs 0 - 150 kN) */}
          {(activeCardView === 'dual' || activeCardView === 'surface') && (
            <div className="bg-slate-50/70 rounded-lg border border-slate-200 p-2.5 relative flex flex-col justify-between">
              <div className="flex items-center justify-between px-1 mb-1 text-[11px] font-mono">
                <span className="text-sky-700 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-600"></span>
                  SURFACE CARD (0 &ndash; 150 kN)
                </span>
                <span className="text-slate-500 text-[10px]">
                  PPRL: <strong className="text-slate-800">{pprl_kn.toFixed(1)} kN</strong> | MPRL: <strong className="text-slate-800">{mprl_kn.toFixed(1)} kN</strong>
                </span>
              </div>

              <svg
                viewBox={`0 0 ${surfPlot.width} ${surfPlot.height}`}
                className="w-full h-auto cursor-crosshair bg-white rounded border border-slate-200"
                onMouseMove={(e) => handleMouseMove(e, 'surf')}
                onMouseLeave={() => setHoverData(null)}
              >
                {/* Surface Grid Lines */}
                {[0, 25, 50, 75, 100, 125, 150].map((val) => {
                  const y = scaleYSurf(val);
                  return (
                    <g key={`surf-y-${val}`}>
                      <line x1={surfPlot.margin.left} y1={y} x2={surfPlot.width - surfPlot.margin.right} y2={y} stroke="#e2e8f0" strokeWidth="1" />
                      <text x={surfPlot.margin.left - 6} y={y + 3.5} className="text-[8.5px] fill-slate-500 font-mono text-right" textAnchor="end">
                        {val}
                      </text>
                    </g>
                  );
                })}

                {[0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5].map((val) => {
                  const x = scaleXSurf(val);
                  return (
                    <g key={`surf-x-${val}`}>
                      <line x1={x} y1={surfPlot.margin.top} x2={x} y2={surfPlot.height - surfPlot.margin.bottom} stroke="#e2e8f0" strokeWidth="1" />
                      <text x={x} y={surfPlot.height - surfPlot.margin.bottom + 14} className="text-[8.5px] fill-slate-500 font-mono" textAnchor="middle">
                        {val.toFixed(1)}
                      </text>
                    </g>
                  );
                })}

                {/* API 11L Structural Rating Limit (90% PPRL Rod Limit: ~135 kN) */}
                {showEnvelope && (
                  <g>
                    <line
                      x1={surfPlot.margin.left}
                      y1={scaleYSurf(135)}
                      x2={surfPlot.width - surfPlot.margin.right}
                      y2={scaleYSurf(135)}
                      stroke="#dc2626"
                      strokeWidth="1.2"
                      strokeDasharray="4 3"
                    />
                    <text x={surfPlot.width - surfPlot.margin.right - 4} y={scaleYSurf(135) - 3} className="text-[8px] fill-rose-600 font-mono" textAnchor="end">
                      90% Rod Rating Limit (135 kN)
                    </text>
                  </g>
                )}

                {/* Surface P-V Loop (Sky Blue Bold Vector) */}
                <path
                  d={surfaceCardPath}
                  fill="#0284c7"
                  fillOpacity="0.08"
                  stroke="#0284c7"
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
                      stroke="#94a3b8"
                      strokeWidth="1"
                      strokeDasharray="2 2"
                    />
                    <circle
                      cx={scaleXSurf(hoverData.disp)}
                      cy={scaleYSurf(hoverData.surfLoad)}
                      r="3.5"
                      fill="#0284c7"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                  </g>
                )}

                {/* Axis Labels */}
                <text x={surfPlot.margin.left + (surfPlot.width - surfPlot.margin.left - surfPlot.margin.right) / 2} y={surfPlot.height - 4} className="text-[9px] fill-slate-600 font-mono" textAnchor="middle">
                  Stroke displacement (m)
                </text>
                <text
                  x={14}
                  y={surfPlot.margin.top + (surfPlot.height - surfPlot.margin.top - surfPlot.margin.bottom) / 2}
                  className="text-[9px] fill-slate-600 font-mono"
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
            <div className="bg-slate-50/70 rounded-lg border border-slate-200 p-2.5 relative flex flex-col justify-between">
              <div className="flex items-center justify-between px-1 mb-1 text-[11px] font-mono">
                <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${isBuckling ? 'bg-rose-600 animate-pulse' : 'bg-emerald-600'}`}></span>
                  DOWNHOLE CARD (-10 &ndash; +40 kN)
                </span>
                <span className="text-slate-500 text-[10px]">
                  F_min: <strong className={minTensionKn >= 0.5 ? 'text-emerald-600' : 'text-rose-600'}>
                    {minTensionKn >= 0 ? `+${minTensionKn.toFixed(2)}` : minTensionKn.toFixed(2)} kN
                  </strong>
                </span>
              </div>

              <svg
                viewBox={`0 0 ${downPlot.width} ${downPlot.height}`}
                className="w-full h-auto cursor-crosshair bg-white rounded border border-slate-200"
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
                      fill="#10b981"
                      fillOpacity="0.08"
                    />
                    {/* Compressive Buckling Hazard Danger Zone (< 0 kN) */}
                    <rect
                      x={downPlot.margin.left}
                      y={scaleYDown(0)}
                      width={downPlot.width - downPlot.margin.left - downPlot.margin.right}
                      height={scaleYDown(-10) - scaleYDown(0)}
                      fill="#ef4444"
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
                        stroke={val === 0 ? '#94a3b8' : '#e2e8f0'} 
                        strokeWidth={val === 0 ? '1.5' : '1'} 
                      />
                      <text x={downPlot.margin.left - 6} y={y + 3.5} className="text-[8.5px] fill-slate-500 font-mono text-right" textAnchor="end">
                        {val}
                      </text>
                    </g>
                  );
                })}

                {[0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5].map((val) => {
                  const x = scaleXDown(val);
                  return (
                    <g key={`down-x-${val}`}>
                      <line x1={x} y1={downPlot.margin.top} x2={x} y2={downPlot.height - downPlot.margin.bottom} stroke="#e2e8f0" strokeWidth="1" />
                      <text x={x} y={downPlot.height - downPlot.margin.bottom + 14} className="text-[8.5px] fill-slate-500 font-mono" textAnchor="middle">
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
                    stroke="#d97706"
                    strokeWidth="1.6"
                    strokeDasharray="4 3"
                  />
                  <text x={downPlot.width - downPlot.margin.right - 4} y={scaleYDown(0.5) - 3} className="text-[8px] fill-amber-700 font-mono font-bold" textAnchor="end">
                    +0.50 kN Anti-Float Limit
                  </text>
                </g>

                {/* 0.0 kN Buckling Boundary */}
                <g>
                  <line
                    x1={downPlot.margin.left}
                    y1={scaleYDown(0.0)}
                    x2={downPlot.width - downPlot.margin.right}
                    y2={scaleYDown(0.0)}
                    stroke="#dc2626"
                    strokeWidth="1.2"
                    strokeDasharray="2 2"
                  />
                  <text x={downPlot.margin.left + 6} y={scaleYDown(0.0) + 9} className="text-[7.5px] fill-rose-600 font-mono">
                    0.0 kN Neutral Buckling Axis
                  </text>
                </g>

                {/* Baseline Downhole Curve (Crimson Dashed) */}
                <path
                  d={baselineDownholePath}
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth="1.8"
                  strokeDasharray="4 3"
                  opacity="0.85"
                />

                {/* Coupled Digital Twin Downhole Card (Emerald Solid or Crimson if Buckled) */}
                <path
                  d={downholeCardPath}
                  fill={isBuckling ? '#dc2626' : '#059669'}
                  fillOpacity="0.10"
                  stroke={isBuckling ? '#dc2626' : '#059669'}
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
                      stroke="#94a3b8"
                      strokeWidth="1"
                      strokeDasharray="2 2"
                    />
                    <circle
                      cx={scaleXDown(hoverData.disp)}
                      cy={scaleYDown(hoverData.downLoad)}
                      r="3.5"
                      fill={isBuckling ? '#dc2626' : '#059669'}
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                  </g>
                )}

                {/* Axis Labels */}
                <text x={downPlot.margin.left + (downPlot.width - downPlot.margin.left - downPlot.margin.right) / 2} y={downPlot.height - 4} className="text-[9px] fill-slate-600 font-mono" textAnchor="middle">
                  Stroke displacement (m)
                </text>
                <text
                  x={14}
                  y={downPlot.margin.top + (downPlot.height - downPlot.margin.top - downPlot.margin.bottom) / 2}
                  className="text-[9px] fill-slate-600 font-mono"
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
          <div className="mt-2.5 p-2 bg-slate-100 border border-slate-200 rounded-md flex items-center justify-between text-xs font-mono tabular-nums text-slate-700">
            <span className="text-slate-500">Position: <strong className="text-slate-800">{hoverData.disp.toFixed(2)} m</strong></span>
            <span className="text-sky-700">Surface Load: <strong>{hoverData.surfLoad.toFixed(1)} kN</strong></span>
            <span className={isBuckling ? 'text-rose-600 font-bold' : 'text-emerald-700 font-bold'}>
              Twin Downhole: <strong>{hoverData.downLoad.toFixed(2)} kN</strong>
            </span>
            <span className="text-rose-600 text-[11px]">
              Baseline Float: <strong>{hoverData.baselineDownLoad.toFixed(2)} kN</strong>
            </span>
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2.5 text-[11px] font-mono border-t border-slate-200 mt-2.5">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-1 bg-sky-600 rounded-sm"></span>
              <span className="text-slate-700">Coupled Surface</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`w-3.5 h-1 ${isBuckling ? 'bg-rose-600' : 'bg-emerald-600'} rounded-sm`}></span>
              <span className="text-slate-700">{isBuckling ? 'Buckled Downhole' : 'Coupled Downhole Twin'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-0.5 border-b-2 border-dashed border-rose-500"></span>
              <span className="text-slate-500">Baseline Downhole Float</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-0.5 border-b-2 border-dashed border-amber-500"></span>
              <span className="text-amber-700 font-medium">+0.50 kN Anti-Float Boundary</span>
            </div>
          </div>

          <div className="text-slate-400 text-[10px]">
            144-Node Wave Integration &middot; Dual High-Precision Viewport
          </div>
        </div>
      </div>

      {/* Technical Telemetry Monospace Readout Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs tabular-nums">
        <div className="hmi-panel p-3 flex flex-col bg-white border border-slate-200 rounded-lg shadow-xs">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-sans">Peak Polished Rod Load (PPRL)</span>
          <span className="text-lg font-bold text-slate-900 my-0.5">{pprl_kn.toFixed(1)} kN</span>
          <span className="text-[10.5px] text-slate-400">API 11L Rating: 314.2 kN ({(pprl_kn / 314.2 * 100).toFixed(0)}%)</span>
        </div>

        <div className="hmi-panel p-3 flex flex-col bg-white border border-slate-200 rounded-lg shadow-xs">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-sans">Min Polished Rod Load (MPRL)</span>
          <span className="text-lg font-bold text-slate-900 my-0.5">{mprl_kn.toFixed(1)} kN</span>
          <span className="text-[10.5px] text-slate-400">Kinematic delta: {(pprl_kn - mprl_kn).toFixed(1)} kN</span>
        </div>

        <div className={`hmi-panel p-3 flex flex-col border-l-4 rounded-lg shadow-xs ${
          minTensionKn >= 0.5 ? 'border-l-emerald-500 bg-white border-slate-200' : 'border-l-rose-500 bg-rose-50/60 border-rose-200'
        }`}>
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-sans">Downhole Minimum Tension</span>
          <span className={`text-lg font-bold my-0.5 ${minTensionKn >= 0.5 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {minTensionKn >= 0 ? `+${minTensionKn.toFixed(2)}` : minTensionKn.toFixed(2)} kN
          </span>
          <span className="text-[10.5px] text-slate-500">
            {minTensionKn >= 0.5 ? 'Tension Preserved (Safe)' : 'Compressive Float Hazard'}
          </span>
        </div>

        <div className="hmi-panel p-3 flex flex-col bg-white border border-slate-200 rounded-lg shadow-xs">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-sans">Net Oil Production</span>
          <span className="text-lg font-bold text-slate-900 my-0.5">{oil_production_bopd.toFixed(1)} BOPD</span>
          <span className="text-[10.5px] text-slate-400">Gross Liquid: {liquid_production_bopd.toFixed(1)} BLPD</span>
        </div>
      </div>
    </div>
  );
}

export default DynacardStudio;
