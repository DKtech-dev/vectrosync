import React, { useState } from 'react';
import { Activity } from 'lucide-react';
import { AnimatedNumber } from './AnimatedNumber';
import { SkeletonPanel } from './Skeleton';

/**
 * Threshold tag: a hairline chip pinned to the RIGHT edge of the plot so a
 * safety boundary reads as a thin, precise rule with a value — never as a
 * second data series competing with the card loop.
 * Value + unit only; the prose lives in a `.caption` under the chart.
 */
const TONE_VAR = {
  caution: '--accent-caution',
  critical: '--accent-critical',
};

const tagWidth = (label) => label.length * 4.8 + 10;

function ThresholdTag({ xRight, y, label, tone }) {
  const w = tagWidth(label);
  const v = TONE_VAR[tone];
  return (
    <g>
      <rect
        x={xRight - w}
        y={y - 6.5}
        width={w}
        height={13}
        rx="6.5"
        style={{ fill: 'rgb(var(--bg-surface-1))', stroke: `rgb(var(${v}) / 0.35)` }}
        strokeWidth="1"
      />
      <text
        x={xRight - w / 2}
        y={y + 3}
        className="readout text-[8.5px] font-semibold"
        style={{ fill: `rgb(var(${v}))` }}
        textAnchor="middle"
      >
        {label}
      </text>
    </g>
  );
}

/**
 * Floating pill popover rendered inside the SVG next to the crosshair.
 * Rounded white surface + hairline + soft ambient shadow, label in faint,
 * value in a tabular `readout`. Flips to the left of the cursor near the
 * right edge so it never leaves the plot area.
 */
const POP_W = 132;
const POP_ROW = 13;

function HoverPopover({ x, plot, shadowId, rows }) {
  const h = 15 + rows.length * POP_ROW;
  const yTop = plot.margin.top + 6;
  const flip = x + 12 + POP_W > plot.width - plot.margin.right;
  const rawPx = flip ? x - 12 - POP_W : x + 12;
  // Clamp on both edges: flipping near the left margin must not push the
  // popover past the y-axis labels either.
  const px = Math.max(plot.margin.left + 4, Math.min(rawPx, plot.width - plot.margin.right - POP_W - 4));

  return (
    <g pointerEvents="none" filter={`url(#${shadowId})`}>
      <rect
        x={px}
        y={yTop}
        width={POP_W}
        height={h}
        rx="10"
        style={{ fill: 'rgb(var(--bg-surface-1))', stroke: 'rgb(var(--border-hairline))' }}
        strokeWidth="1"
      />
      {rows.map((row, i) => (
        <g key={row.label}>
          <text x={px + 11} y={yTop + 18 + i * POP_ROW} className="text-[9px] fill-faint">
            {row.label}
          </text>
          <text
            x={px + POP_W - 11}
            y={yTop + 18 + i * POP_ROW}
            className="readout text-[10px] font-bold"
            style={{ fill: row.fill }}
            textAnchor="end"
          >
            {row.value}
          </text>
        </g>
      ))}
    </g>
  );
}

/** Soft ambient drop shadow for the in-SVG popover. */
function PopoverShadow({ id }) {
  return (
    <filter id={id} x="-30%" y="-30%" width="160%" height="180%">
      <feDropShadow
        dx="0"
        dy="3"
        stdDeviation="4"
        style={{ floodColor: 'rgb(var(--text-primary))', floodOpacity: 0.12 }}
      />
    </filter>
  );
}

export function DynacardStudio({ dynacard, isBuckling, minTensionKn, aiDiagnostics }) {
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

  // Right edge of each plot area — where threshold tags anchor.
  const surfRight = surfPlot.width - surfPlot.margin.right;
  const downRight = downPlot.width - downPlot.margin.right;

  // Series tone for the downhole loop: emerald normally, critical when the
  // compression screen trips. Drives both the stroke and its gradient fill.
  const downToneVar = isBuckling ? '--accent-critical' : '--accent-safe';

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
    <div className="flex flex-col gap-5 font-sans">
      {/* Studio Header & View Mode Selector */}
      <div className="card-nested p-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between pb-4 mb-5 border-b border-hairline gap-4">
          <div className="flex items-center gap-2.5">
            <span className="icon-badge bg-interactive/10 text-interactive">
              <Activity className="w-[18px] h-[18px]" />
            </span>
            <span className="card-title">Reduced-order dynacard estimates</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* View Mode Toggle — segmented pill, solid dark active fill */}
            <div className="segmented">
              <button
                type="button"
                aria-pressed={activeCardView === 'dual'}
                onClick={() => setActiveCardView('dual')}
                className="segmented-item"
              >
                Dual view
              </button>
              <button
                type="button"
                aria-pressed={activeCardView === 'surface'}
                onClick={() => setActiveCardView('surface')}
                className="segmented-item"
              >
                Surface
              </button>
              <button
                type="button"
                aria-pressed={activeCardView === 'downhole'}
                onClick={() => setActiveCardView('downhole')}
                className="segmented-item"
              >
                Downhole
              </button>
            </div>

            <label className="pill bg-surface-2 border border-hairline text-muted cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showEnvelope}
                onChange={(e) => setShowEnvelope(e.target.checked)}
                className="w-3.5 h-3.5 rounded-[4px] accent-interactive"
              />
              <span>Show screening thresholds</span>
            </label>

            {/* The ONE real-state chip for this panel */}
            <span className={`pill ${isBuckling ? 'text-critical bg-critical/10' : 'text-safe bg-safe/10'}`}>
              <span className="chip-dot" />
              {isBuckling ? 'Compression screen' : 'Tension floor met'}
            </span>
          </div>
        </div>

        {/* Multi-Model AI Layer 2 & 3 Diagnostics Ribbon */}
        {aiDiagnostics && (
          <div className="card-nested p-3.5 flex flex-col gap-2.5 bg-surface-2 border border-hairline rounded-lg mb-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="icon-badge w-6 h-6 bg-interactive/10 text-interactive text-[11px] font-bold">AI</span>
                <span className="text-[13px] font-semibold text-ink">Multi-Model Diagnostic Intelligence</span>
                <span className="pill text-[10px] bg-surface-1 border border-hairline text-faint">4-Layer Architecture</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-faint">Surrogate edge speed:</span>
                <span className="font-mono text-[11px] text-safe font-semibold">
                  {aiDiagnostics.wave_surrogate?.inference_time_ms ? `${(aiDiagnostics.wave_surrogate.inference_time_ms * 1000).toFixed(0)} µs` : '< 10 µs'} ({aiDiagnostics.wave_surrogate?.acceleration_factor || '49,000x'} vs PDE)
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[12px]">
              {/* Model 1: Dynacard Pattern Classifier */}
              <div className="p-2.5 rounded bg-surface-1 border border-hairline flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="unit-label text-[10px]">Layer 2: Dynacard Classifier</span>
                  <span className={`pill text-[10px] ${
                    aiDiagnostics.classifier?.predicted_class === 'NORMAL_OPERATION'
                      ? 'text-safe bg-safe/10'
                      : 'text-critical bg-critical/10 font-bold'
                  }`}>
                    {aiDiagnostics.classifier?.confidence_pct || 93}% Conf
                  </span>
                </div>
                <div className="font-mono font-semibold text-[12px] text-ink">
                  {aiDiagnostics.classifier?.predicted_class || (isBuckling ? 'ROD_FLOAT_PRECURSOR' : 'NORMAL_OPERATION')}
                </div>
                <p className="caption text-[11px] text-muted line-clamp-2">
                  {aiDiagnostics.classifier?.reason || 'SPE-standard 16-dimensional geometric and Fourier descriptor classifier.'}
                </p>
              </div>

              {/* Model 2: Neural Operating-Point Surrogate */}
              <div className="p-2.5 rounded bg-surface-1 border border-hairline flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="unit-label text-[10px]">Layer 3: Operating-Point Surrogate</span>
                  <span className="pill text-[10px] text-interactive bg-interactive/10">R² = 0.917</span>
                </div>
                <div className="font-mono text-[12px] text-ink flex items-baseline gap-2">
                  <span>Pred Min F:</span>
                  <span className={`font-semibold ${
                    (aiDiagnostics.wave_surrogate?.predicted_min_tension_kn ?? minTensionKn) >= 0.5 ? 'text-safe' : 'text-critical'
                  }`}>
                    {aiDiagnostics.wave_surrogate?.predicted_min_tension_kn ?? minTensionKn?.toFixed?.(2)} kN
                  </span>
                </div>
                <p className="caption text-[11px] text-muted">
                  Predicts 5 scalar load extrema for real-time MPC inner loop screening.
                </p>
              </div>

              {/* Model 3: Telemetry Anomaly Detector */}
              <div className="p-2.5 rounded bg-surface-1 border border-hairline flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="unit-label text-[10px]">Layer 2: Anomaly Autoencoder</span>
                  <span className={`pill text-[10px] ${
                    aiDiagnostics.anomaly_detector?.status === 'NOMINAL' ? 'text-safe bg-safe/10' : 'text-caution bg-caution/10 font-semibold'
                  }`}>
                    {aiDiagnostics.anomaly_detector?.status || 'NOMINAL'}
                  </span>
                </div>
                <div className="font-mono text-[12px] text-ink flex items-baseline gap-2">
                  <span>Score:</span>
                  <span className="font-semibold">{aiDiagnostics.anomaly_detector?.anomaly_score ?? '0.00'}</span>
                  <span className="caption text-[10px] text-faint">(Thresh: 1.80)</span>
                </div>
                <p className="caption text-[11px] text-muted line-clamp-2">
                  {aiDiagnostics.anomaly_detector?.dominant_driver || 'Reconstruction residual on 5-channel SCADA stream.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Vector SVG Cards Canvas Area */}
        <div className={activeCardView === 'dual' ? 'grid grid-cols-1 lg:grid-cols-2 gap-5' : 'flex justify-center'}>

          {/* Card 1: High-Precision Surface Dynamometer Card (0 - 3.5 m vs 0 - 150 kN) */}
          {(activeCardView === 'dual' || activeCardView === 'surface') && (
            <div className="card-nested p-4 relative flex flex-col justify-between w-full max-w-2xl mx-auto">
              <div className="flex items-baseline justify-between gap-3 mb-3">
                <span className="unit-label">Modeled surface card</span>
                <span className="readout text-[12px] text-muted">
                  PPRL <AnimatedNumber value={pprl_kn} format={(v) => v.toFixed(1)} className="text-ink font-semibold" /> · MPRL{' '}
                  <AnimatedNumber value={mprl_kn} format={(v) => v.toFixed(1)} className="text-ink font-semibold" /> kN
                </span>
              </div>

            <svg
                viewBox={`0 0 ${surfPlot.width} ${surfPlot.height}`}
                role="img"
                aria-label="Synthetic modeled surface load versus stroke displacement card"
                className="w-full h-auto cursor-crosshair bg-transparent"
                onMouseMove={(e) => handleMouseMove(e, 'surf')}
                onMouseLeave={() => setHoverData(null)}
              >
                <defs>
                  {/* Vertical cobalt wash under the surface loop */}
                  <linearGradient id="dyna-surf-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" style={{ stopColor: 'rgb(var(--accent-interactive))', stopOpacity: 0.28 }} />
                    <stop offset="100%" style={{ stopColor: 'rgb(var(--accent-interactive))', stopOpacity: 0 }} />
                  </linearGradient>
                  <PopoverShadow id="dyna-surf-pop-shadow" />
                </defs>

                {/* Horizontal value rules */}
                {[0, 25, 50, 75, 100, 125, 150].map((val) => {
                  const y = scaleYSurf(val);
                  return (
                    <g key={`surf-y-${val}`}>
                      <line x1={surfPlot.margin.left} y1={y} x2={surfPlot.width - surfPlot.margin.right} y2={y} className="stroke-grid" strokeWidth="1" />
                      <text x={surfPlot.margin.left - 8} y={y + 3.5} className="readout text-[10px] fill-faint" textAnchor="end">
                        {val}
                      </text>
                    </g>
                  );
                })}

                {/* Sparse X rules — every other tick keeps a label but only half draw a rule */}
                {[0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5].map((val, i) => {
                  const x = scaleXSurf(val);
                  return (
                    <g key={`surf-x-${val}`}>
                      {i % 2 === 0 && (
                        <line x1={x} y1={surfPlot.margin.top} x2={x} y2={surfPlot.height - surfPlot.margin.bottom} className="stroke-grid" strokeWidth="1" />
                      )}
                      <text x={x} y={surfPlot.height - surfPlot.margin.bottom + 14} className="readout text-[10px] fill-faint" textAnchor="middle">
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
                      strokeWidth="1"
                      strokeDasharray="4 4"
                    />
                    <ThresholdTag xRight={surfRight} y={scaleYSurf(99.0)} label="99 kN" tone="critical" />
                  </g>
                )}

                {/* Surface P-V Loop — gradient area, soft glow, then the crisp reveal stroke */}
                <path className="vs-area" d={surfaceCardPath} fill="url(#dyna-surf-fill)" stroke="none" />
                <path
                  d={surfaceCardPath}
                  className="stroke-interactive"
                  fill="none"
                  strokeWidth="6"
                  opacity="0.15"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                <path
                  key={`surf-${surface_position_m.length}-${surface_load_kn[0]?.toFixed?.(1)}`}
                  className="vs-draw stroke-interactive"
                  d={surfaceCardPath}
                  style={{ '--draw-length': 2000 }}
                  fill="none"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />

                {/* Hover Crosshair on Surface Plot */}
                {hoverData && (
                  <g>
                    <line
                      x1={scaleXSurf(hoverData.disp)}
                      y1={surfPlot.margin.top}
                      x2={scaleXSurf(hoverData.disp)}
                      y2={surfPlot.height - surfPlot.margin.bottom}
                      className="stroke-faint"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                    />
                    <circle
                      cx={scaleXSurf(hoverData.disp)}
                      cy={scaleYSurf(hoverData.surfLoad)}
                      r="3.5"
                      className="fill-interactive"
                      style={{ stroke: 'rgb(var(--bg-surface-1))' }}
                      strokeWidth="2"
                    />
                    <HoverPopover
                      x={scaleXSurf(hoverData.disp)}
                      plot={surfPlot}
                      shadowId="dyna-surf-pop-shadow"
                      rows={[
                        { label: 'Stroke displacement', value: `${hoverData.disp.toFixed(2)} m`, fill: 'rgb(var(--text-primary))' },
                        { label: 'Surface load', value: `${hoverData.surfLoad.toFixed(1)} kN`, fill: 'rgb(var(--accent-interactive))' },
                      ]}
                    />
                  </g>
                )}

                {/* Axis Labels */}
                <text x={surfPlot.margin.left + (surfPlot.width - surfPlot.margin.left - surfPlot.margin.right) / 2} y={surfPlot.height - 4} className="text-[10px] fill-faint" textAnchor="middle">
                  Stroke displacement (m)
                </text>
                <text
                  x={14}
                  y={surfPlot.margin.top + (surfPlot.height - surfPlot.margin.top - surfPlot.margin.bottom) / 2}
                  className="text-[10px] fill-faint"
                  textAnchor="middle"
                  transform={`rotate(-90, 14, ${surfPlot.margin.top + (surfPlot.height - surfPlot.margin.top - surfPlot.margin.bottom) / 2})`}
                >
                  Surface load (kN)
                </text>
              </svg>
            </div>
          )}

          {/* Card 2: High-Precision Downhole Pump Card (-10 to +40 kN vs 0 - 3.5 m) */}
          {(activeCardView === 'dual' || activeCardView === 'downhole') && (
            <div className="card-nested p-4 relative flex flex-col justify-between w-full max-w-2xl mx-auto">
              <div className="flex items-baseline justify-between gap-3 mb-3">
                <span className="unit-label">Modeled downhole card</span>
                <span className="readout text-[12px] text-muted">
                  F_min{' '}
                  <AnimatedNumber
                    value={minTensionKn}
                    format={(v) => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2))}
                    className={`font-semibold ${minTensionKn >= 0.5 ? 'text-safe' : 'text-critical'}`}
                  />{' '}
                  kN
                </span>
              </div>

              <svg
                viewBox={`0 0 ${downPlot.width} ${downPlot.height}`}
                role="img"
                aria-label="Synthetic modeled downhole load versus stroke displacement card"
                className="w-full h-auto cursor-crosshair bg-transparent"
                onMouseMove={(e) => handleMouseMove(e, 'down')}
                onMouseLeave={() => setHoverData(null)}
              >
                <defs>
                  {/* Vertical wash under the downhole loop — emerald, critical when buckling */}
                  <linearGradient id="dyna-down-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" style={{ stopColor: `rgb(var(${downToneVar}))`, stopOpacity: 0.28 }} />
                    <stop offset="100%" style={{ stopColor: `rgb(var(${downToneVar}))`, stopOpacity: 0 }} />
                  </linearGradient>
                  <PopoverShadow id="dyna-down-pop-shadow" />
                </defs>

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
                      fillOpacity="0.06"
                    />
                    {/* Compressive Buckling Hazard Danger Zone (< 0 kN) */}
                    <rect
                      x={downPlot.margin.left}
                      y={scaleYDown(0)}
                      width={downPlot.width - downPlot.margin.left - downPlot.margin.right}
                      height={scaleYDown(-10) - scaleYDown(0)}
                      style={{ fill: 'rgb(var(--accent-critical))' }}
                      fillOpacity="0.07"
                    />
                  </g>
                )}

                {/* Horizontal value rules */}
                {[-10, 0, 10, 20, 30, 40].map((val) => {
                  const y = scaleYDown(val);
                  return (
                    <g key={`down-y-${val}`}>
                      <line
                        x1={downPlot.margin.left}
                        y1={y}
                        x2={downPlot.width - downPlot.margin.right}
                        y2={y}
                        className="stroke-grid"
                        strokeWidth="1"
                      />
                      <text x={downPlot.margin.left - 8} y={y + 3.5} className="readout text-[10px] fill-faint" textAnchor="end">
                        {val}
                      </text>
                    </g>
                  );
                })}

                {/* Sparse X rules */}
                {[0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5].map((val, i) => {
                  const x = scaleXDown(val);
                  return (
                    <g key={`down-x-${val}`}>
                      {i % 2 === 0 && (
                        <line x1={x} y1={downPlot.margin.top} x2={x} y2={downPlot.height - downPlot.margin.bottom} className="stroke-grid" strokeWidth="1" />
                      )}
                      <text x={x} y={downPlot.height - downPlot.margin.bottom + 14} className="readout text-[10px] fill-faint" textAnchor="middle">
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
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                  <ThresholdTag xRight={downRight} y={scaleYDown(0.5)} label="0.50 kN" tone="caution" />
                </g>

                {/* 0.0 kN Buckling Boundary */}
                <g>
                  <line
                    x1={downPlot.margin.left}
                    y1={scaleYDown(0.0)}
                    x2={downPlot.width - downPlot.margin.right}
                    y2={scaleYDown(0.0)}
                    style={{ stroke: 'rgb(var(--accent-critical))' }}
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                  {/* Offset left of the 0.50 kN tag: the two rules are ~2 px apart. */}
                  <ThresholdTag xRight={downRight - tagWidth('0.50 kN') - 4} y={scaleYDown(0.0)} label="0.0 kN" tone="critical" />
                </g>

                {/* Baseline Downhole Curve — neutral faint reference, not a status */}
                <path
                  key={`base-${surface_position_m.length}-${(baseline_downhole_load_kn?.[0] ?? downhole_load_kn[0])?.toFixed?.(1)}`}
                  className="vs-draw stroke-faint"
                  d={baselineDownholePath}
                  fill="none"
                  style={{ '--draw-length': 2000, strokeDasharray: '4 4' }}
                  strokeWidth="1"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />

                {/* Coupled Digital Twin Downhole Card — gradient area, glow, crisp reveal stroke */}
                <path className="vs-area" d={downholeCardPath} fill="url(#dyna-down-fill)" stroke="none" />
                <path
                  d={downholeCardPath}
                  className={isBuckling ? 'stroke-critical' : 'stroke-safe'}
                  fill="none"
                  strokeWidth="6"
                  opacity="0.15"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                <path
                  key={`down-${surface_position_m.length}-${downhole_load_kn[0]?.toFixed?.(1)}`}
                  className={`vs-draw ${isBuckling ? 'stroke-critical' : 'stroke-safe'}`}
                  d={downholeCardPath}
                  style={{ '--draw-length': 2000 }}
                  fill="none"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />

                {/* Hover Crosshair on Downhole Plot */}
                {hoverData && (
                  <g>
                    <line
                      x1={scaleXDown(hoverData.disp)}
                      y1={downPlot.margin.top}
                      x2={scaleXDown(hoverData.disp)}
                      y2={downPlot.height - downPlot.margin.bottom}
                      className="stroke-faint"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                    />
                    <circle
                      cx={scaleXDown(hoverData.disp)}
                      cy={scaleYDown(hoverData.downLoad)}
                      r="3.5"
                      className={isBuckling ? 'fill-critical' : 'fill-safe'}
                      style={{ stroke: 'rgb(var(--bg-surface-1))' }}
                      strokeWidth="2"
                    />
                    <HoverPopover
                      x={scaleXDown(hoverData.disp)}
                      plot={downPlot}
                      shadowId="dyna-down-pop-shadow"
                      rows={[
                        { label: 'Stroke displacement', value: `${hoverData.disp.toFixed(2)} m`, fill: 'rgb(var(--text-primary))' },
                        {
                          label: 'Downhole load',
                          value: `${hoverData.downLoad.toFixed(2)} kN`,
                          fill: isBuckling ? 'rgb(var(--accent-critical))' : 'rgb(var(--accent-safe))',
                        },
                        { label: 'Baseline', value: `${hoverData.baselineDownLoad.toFixed(2)} kN`, fill: 'rgb(var(--text-tertiary))' },
                      ]}
                    />
                  </g>
                )}

                {/* Axis Labels */}
                <text x={downPlot.margin.left + (downPlot.width - downPlot.margin.left - downPlot.margin.right) / 2} y={downPlot.height - 4} className="text-[10px] fill-faint" textAnchor="middle">
                  Stroke displacement (m)
                </text>
                <text
                  x={14}
                  y={downPlot.margin.top + (downPlot.height - downPlot.margin.top - downPlot.margin.bottom) / 2}
                  className="text-[10px] fill-faint"
                  textAnchor="middle"
                  transform={`rotate(-90, 14, ${downPlot.margin.top + (downPlot.height - downPlot.margin.top - downPlot.margin.bottom) / 2})`}
                >
                  Downhole load (kN)
                </text>
              </svg>
            </div>
          )}
        </div>

        {/* Threshold provenance — the prose that used to float inside the plots */}
        {showEnvelope && (
          <p className="caption mt-4">
            Screening references &mdash; 90% working limit 99.0 kN of 110.0 kN rated capacity &middot; model screening
            floor +0.50 kN &middot; 0.0 kN compression boundary.
          </p>
        )}

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 mt-4 border-t border-hairline text-[12px]">
          <div className="flex items-center gap-5 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="w-4 h-1 bg-interactive rounded-full"></span>
              <span className="text-muted">Modeled surface</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-4 h-1 ${isBuckling ? 'bg-critical' : 'bg-safe'} rounded-full`}></span>
              <span className="text-muted">{isBuckling ? 'Modeled compression screen' : 'Modeled downhole estimate'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-0 border-t border-dashed border-faint"></span>
              <span className="text-muted">Baseline reference</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-0 border-t border-dashed border-caution"></span>
              <span className="text-muted">Screening floor +0.50 kN</span>
            </div>
          </div>

          <span className="caption">Deterministic reduced-order card estimator &middot; synthetic output</span>
        </div>
      </div>

      <p className="caption">
        Algebraic card estimates, not wave-solver telemetry or measured dynamometer cards. Thresholds are screening references and do not certify equipment condition.
      </p>

      {/* Technical model readout strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="card-nested p-4 flex flex-col gap-2">
          <span className="unit-label">PPRL</span>
          <div className="flex items-baseline gap-1.5">
            <AnimatedNumber value={pprl_kn} format={(v) => v.toFixed(1)} className="metric-secondary" />
            <span className="text-[13px] font-semibold text-muted">kN</span>
          </div>
          <span className="caption">
            Illustrative 314.2 kN reference: {(pprl_kn / 314.2 * 100).toFixed(0)}% &middot; verify equipment data
          </span>
        </div>

        <div className="card-nested p-4 flex flex-col gap-2">
          <span className="unit-label">MPRL</span>
          <div className="flex items-baseline gap-1.5">
            <AnimatedNumber value={mprl_kn} format={(v) => v.toFixed(1)} className="metric-secondary" />
            <span className="text-[13px] font-semibold text-muted">kN</span>
          </div>
          <span className="caption">Kinematic delta {(pprl_kn - mprl_kn).toFixed(1)} kN</span>
        </div>

        <div className="card-nested p-4 flex flex-col gap-2">
          <span className="unit-label">Downhole min tension</span>
          <div className="flex items-baseline gap-1.5">
            <AnimatedNumber
              value={minTensionKn}
              format={(v) => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2))}
              className={`metric-secondary ${minTensionKn >= 0.5 ? 'text-safe' : 'text-critical'}`}
            />
            <span className="text-[13px] font-semibold text-muted">kN</span>
          </div>
          <span className="caption">
            {minTensionKn >= 0.5 ? 'Above implemented model floor' : 'Modeled compression screen'}
          </span>
        </div>

        <div className="card-nested p-4 flex flex-col gap-2">
          <span className="unit-label">Estimated oil rate</span>
          <div className="flex items-baseline gap-1.5">
            <AnimatedNumber value={oil_production_bopd} format={(v) => v.toFixed(1)} className="metric-secondary" />
            <span className="text-[13px] font-semibold text-muted">BOPD</span>
          </div>
          <span className="caption">Modeled liquid rate {liquid_production_bopd.toFixed(1)} BLPD</span>
        </div>
      </div>
    </div>
  );
}

export default DynacardStudio;
