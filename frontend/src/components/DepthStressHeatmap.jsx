import React, { useRef, useEffect } from 'react';
import { Layers } from 'lucide-react';
import { useTheme } from '../utils/theme';

export function DepthStressHeatmap({ stressHeatmap, isBuckling }) {
  const canvasRef = useRef(null);
  const { theme } = useTheme();

  useEffect(() => {
    if (!stressHeatmap || !stressHeatmap.stress_matrix_mpa || !canvasRef.current) return;

    const { angles_deg, depths_m, stress_matrix_mpa } = stressHeatmap;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const width = canvas.width;
    const height = canvas.height;

    const numDepths = depths_m.length;
    const numAngles = angles_deg.length;

    // Theme-aware SCADA color mapping — read live accent/surface channels so the
    // heatmap re-tints on theme toggle. Channels are space-separated RGB triplets.
    const root = getComputedStyle(document.documentElement);
    const parse = (name) => root.getPropertyValue(name).trim().split(/\s+/).map(Number);
    const critical = parse('--accent-critical');
    const surf2 = parse('--bg-surface-2');
    const hi = parse('--accent-interactive');

    // Compression (< 0 MPa): interpolate surface -> critical.
    // Tension (>= 0 MPa): interpolate surface (low) -> interactive (high).
    const getColor = (val) => {
      if (val < 0) {
        const t = Math.min(1.0, Math.abs(val) / 25.0);
        const r = Math.round(surf2[0] + (critical[0] - surf2[0]) * t);
        const g = Math.round(surf2[1] + (critical[1] - surf2[1]) * t);
        const b = Math.round(surf2[2] + (critical[2] - surf2[2]) * t);
        return `rgb(${r}, ${g}, ${b})`;
      } else {
        const t = Math.min(1.0, val / 130.0);
        const r = Math.round(surf2[0] + (hi[0] - surf2[0]) * t);
        const g = Math.round(surf2[1] + (hi[1] - surf2[1]) * t);
        const b = Math.round(surf2[2] + (hi[2] - surf2[2]) * t);
        return `rgb(${r}, ${g}, ${b})`;
      }
    };

    const cellW = width / numAngles;
    const cellH = height / numDepths;

    for (let i = 0; i < numDepths; i++) {
      for (let j = 0; j < numAngles; j++) {
        const stress = stress_matrix_mpa[i][j];
        ctx.fillStyle = getColor(stress);
        ctx.fillRect(j * cellW, i * cellH, cellW + 0.5, cellH + 0.5);
      }
    }

    // Taper interface lines use the interactive accent channel.
    const taperColor = `rgb(${hi[0]}, ${hi[1]}, ${hi[2]})`;

    // Taper Interface 1: 350 m
    const yTaper1 = (350 / 1150) * height;
    ctx.strokeStyle = taperColor;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(0, yTaper1);
    ctx.lineTo(width, yTaper1);
    ctx.stroke();

    // Taper Interface 2: 750 m
    const yTaper2 = (750 / 1150) * height;
    ctx.strokeStyle = taperColor;
    ctx.beginPath();
    ctx.moveTo(0, yTaper2);
    ctx.lineTo(width, yTaper2);
    ctx.stroke();
    ctx.setLineDash([]);
  }, [stressHeatmap, theme]);

  return (
    <div className="flex flex-col gap-4 font-sans">
      {/* 2D Contour Canvas */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="icon-badge w-9 h-9 bg-interactive/10 text-interactive">
              <Layers className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <div className="card-title flex items-center gap-2">
                <span>Modeled axial stress σ(x, θ)</span>
                <span className="text-[10px] font-mono tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 font-semibold">
                  [VISUALIZATION SURROGATE]
                </span>
              </div>
              <div className="caption">Reduced-order screen across depth and crank angle (Illustrative Interpolation)</div>
            </div>
          </div>

          {/* The ONE real-state pill for this view */}
          <span className={`pill shrink-0 ${isBuckling ? 'bg-critical/10 text-critical' : 'bg-safe/10 text-safe'}`}>
            <span className="chip-dot" />
            {isBuckling ? 'Compression screen' : 'Tension floor met'}
          </span>
        </div>

        {/* Recessed chart bed */}
        <div className="card-nested p-4">
          <div className="relative flex">
            {/* Depth Axis Labels */}
            <div className="w-14 h-[280px] flex flex-col justify-between text-[11px] readout text-faint py-1 text-right pr-3">
              <span>0 m</span>
              <span>350 m</span>
              <span>750 m</span>
              <span>1,150 m</span>
            </div>

            {/* Canvas Viewport */}
            <div className="flex-1 relative">
              <canvas
                ref={canvasRef}
                width={520}
                height={280}
                role="img"
                aria-label="Synthetic reduced-order axial stress heatmap by modeled depth and crank angle"
                className="w-full h-[280px] rounded-[10px] border border-hairline"
                style={{ background: 'rgb(var(--bg-surface-2))' }}
              >
                Synthetic modeled axial stress heatmap.
              </canvas>
              {/* Small white callout tags pinned to each taper interface */}
              <div className="absolute top-[28%] right-2 bg-surface-1 border border-hairline rounded-lg px-2 py-1 text-[10px] readout text-muted shadow-card">
                Taper 1: 1.000" → 0.875" (350 m)
              </div>
              <div className="absolute top-[63%] right-2 bg-surface-1 border border-hairline rounded-lg px-2 py-1 text-[10px] readout text-muted shadow-card">
                Taper 2: 0.875" → 0.750" (750 m)
              </div>
            </div>
          </div>

          {/* Phase Angle X-Axis */}
          <div className="flex justify-between text-[11px] readout text-faint pl-14 pr-2 pt-3">
            <span>0° (TDC)</span>
            <span>90° (mid-downstroke)</span>
            <span>180° (BDC)</span>
            <span>270° (mid-upstroke)</span>
            <span>360°</span>
          </div>
        </div>

        {/* Colour-map key + model provenance */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 text-[12px]">
            <span className="flex items-center gap-2 text-muted">
              <span className="w-2.5 h-2.5 rounded-[3px] bg-critical"></span> Compression (&lt;0 MPa)
            </span>
            <span className="flex items-center gap-2 text-muted">
              <span className="w-2.5 h-2.5 rounded-[3px] bg-interactive"></span> Tension (&gt;50 MPa)
            </span>
          </div>

          <span className="caption readout">116 nodes &times; 144 crank angles &middot; synthetic output</span>
        </div>
      </div>

      <p className="caption">
        Synthetic reduced-order stress screen. Colors are not measured strain, inspection findings, fatigue results, or certified structural limits.
      </p>

      {/* 3-Section Taper Property Table Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card-nested p-4 flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-2 pb-3 border-b border-hairline">
            <span className="unit-label">Section 1</span>
            <span className="unit-label text-tertiary">1.000 in.</span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[12px] text-muted">Depth</span>
            <span className="readout text-[12px] text-ink">0 – 350 m</span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[12px] text-muted">Area</span>
            <span className="readout text-[12px] text-ink">5.067 cm²</span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[12px] text-muted">Fatigue / safety factor</span>
            <span className="readout text-[12px] text-faint">Not evaluated</span>
          </div>
        </div>

        <div className="card-nested p-4 flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-2 pb-3 border-b border-hairline">
            <span className="unit-label">Section 2</span>
            <span className="unit-label text-tertiary">0.875 in.</span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[12px] text-muted">Depth</span>
            <span className="readout text-[12px] text-ink">350 – 750 m</span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[12px] text-muted">Area</span>
            <span className="readout text-[12px] text-ink">3.879 cm²</span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[12px] text-muted">Fatigue / safety factor</span>
            <span className="readout text-[12px] text-faint">Not evaluated</span>
          </div>
        </div>

        <div className={`card-nested p-4 flex flex-col gap-3 border-l-2 ${
          isBuckling ? 'border-l-critical' : 'border-l-safe'
        }`}>
          <div className="flex items-baseline justify-between gap-2 pb-3 border-b border-hairline">
            <span className="unit-label">Section 3</span>
            <span className="unit-label text-tertiary">0.750 in.</span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[12px] text-muted">Depth</span>
            <span className="readout text-[12px] text-ink">750 – 1,150 m</span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[12px] text-muted">Area</span>
            <span className="readout text-[12px] text-ink">2.850 cm²</span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[12px] text-muted">Model screen</span>
            <span className={`readout text-[12px] ${isBuckling ? 'text-critical' : 'text-safe'}`}>
              {isBuckling ? 'Compression indicator' : 'Tension floor met'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DepthStressHeatmap;
