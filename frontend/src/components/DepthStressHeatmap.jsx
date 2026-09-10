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
    <div className="flex flex-col gap-3 font-sans">
      {/* 2D Contour Canvas */}
      <div className="panel p-4 relative">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between pb-3 mb-3 border-b border-hairline text-xs font-medium gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Layers className="w-4 h-4 text-muted" />
            <span className="section-title">
              Reduced-Order Modeled Axial Stress &mdash; σ(x, θ)
            </span>
            <span className="readout text-[10.5px] text-faint">116 Nodes &times; 144 Crank Angles</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 readout text-[10.5px]">
            <span className="flex items-center gap-1.5 text-critical font-semibold">
              <span className="w-2.5 h-2.5 rounded-xs bg-critical"></span> Compression (&lt;0 MPa)
            </span>
            <span className="flex items-center gap-1.5 text-interactive font-semibold">
              <span className="w-2.5 h-2.5 rounded-xs bg-interactive"></span> Tension (&gt;50 MPa)
            </span>
          </div>
        </div>

        <div className="relative flex pt-3">
          {/* Depth Axis Labels */}
          <div className="w-14 h-[280px] flex flex-col justify-between text-[9.5px] readout text-muted py-1 text-right pr-2">
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
              className="w-full h-[280px] rounded-lg border border-hairline"
              style={{ background: 'rgb(var(--bg-surface-2))' }}
            >
              Synthetic modeled axial stress heatmap.
            </canvas>
            <div className="absolute top-[28%] right-2 bg-surface-1/95 border border-interactive/40 rounded px-1.5 py-0.5 text-[9px] readout text-interactive font-bold">
              Taper 1: 1.000" → 0.875" (350 m)
            </div>
            <div className="absolute top-[63%] right-2 bg-surface-1/95 border border-interactive/40 rounded px-1.5 py-0.5 text-[9px] readout text-interactive font-bold">
              Taper 2: 0.875" → 0.750" (750 m)
            </div>
          </div>
        </div>

        {/* Phase Angle X-Axis */}
        <div className="flex justify-between text-[9.5px] readout text-muted pl-16 pr-2 pt-2">
          <span>0° (TDC)</span>
          <span>90° (Mid-Downstroke)</span>
          <span>180° (BDC)</span>
          <span>270° (Mid-Upstroke)</span>
          <span>360°</span>
        </div>
      </div>

      <div className="readout text-[10.5px] text-caution bg-caution/10 border border-caution/30 rounded px-3 py-1.5">
        Synthetic reduced-order stress screen; colors are not measured strain, inspection findings, fatigue results, or certified structural limits.
      </div>

      {/* 3-Section Taper Property Table Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 readout text-xs">
        <div className="panel p-4">
          <div className="font-bold text-ink mb-1 font-sans">Section 1 &mdash; 1.000 in. rod</div>
          <div className="flex justify-between py-1 text-[11px] text-muted border-b border-hairline">
            <span>Depth:</span> <span className="font-semibold text-ink">0 – 350 m</span>
          </div>
          <div className="flex justify-between py-1 text-[11px] text-muted border-b border-hairline">
            <span>Area:</span> <span className="font-semibold text-ink">5.067 cm²</span>
          </div>
          <div className="flex justify-between py-1 text-[11px] text-muted">
            <span>Fatigue / safety factor:</span> <span className="font-semibold text-muted">Not evaluated</span>
          </div>
        </div>

        <div className="panel p-4">
          <div className="font-bold text-ink mb-1 font-sans">Section 2 &mdash; 0.875 in. rod</div>
          <div className="flex justify-between py-1 text-[11px] text-muted border-b border-hairline">
            <span>Depth:</span> <span className="font-semibold text-ink">350 – 750 m</span>
          </div>
          <div className="flex justify-between py-1 text-[11px] text-muted border-b border-hairline">
            <span>Area:</span> <span className="font-semibold text-ink">3.879 cm²</span>
          </div>
          <div className="flex justify-between py-1 text-[11px] text-muted">
            <span>Fatigue / safety factor:</span> <span className="font-semibold text-muted">Not evaluated</span>
          </div>
        </div>

        <div className={`panel p-4 border-l-2 ${
          isBuckling ? 'border-l-critical' : 'border-l-safe'
        }`}>
          <div className="font-bold text-ink mb-1 font-sans">Section 3 &mdash; 0.750 in. rod</div>
          <div className="flex justify-between py-1 text-[11px] text-muted border-b border-hairline">
            <span>Depth:</span> <span className="font-semibold text-ink">750 – 1,150 m</span>
          </div>
          <div className="flex justify-between py-1 text-[11px] text-muted border-b border-hairline">
            <span>Area:</span> <span className="font-semibold text-ink">2.850 cm²</span>
          </div>
          <div className="flex justify-between py-1 text-[11px] text-muted">
            <span>Model screen:</span>{' '}
            <span className={`font-bold ${isBuckling ? 'text-critical' : 'text-safe'}`}>
              {isBuckling ? 'Compression indicator' : 'Tension floor met'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DepthStressHeatmap;
