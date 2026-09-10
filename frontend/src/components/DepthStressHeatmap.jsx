import React, { useRef, useEffect } from 'react';
import { Layers } from 'lucide-react';

export function DepthStressHeatmap({ stressHeatmap, isBuckling }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!stressHeatmap || !stressHeatmap.stress_matrix_mpa || !canvasRef.current) return;

    const { angles_deg, depths_m, stress_matrix_mpa } = stressHeatmap;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const width = canvas.width;
    const height = canvas.height;

    const numDepths = depths_m.length;
    const numAngles = angles_deg.length;

    // Dark-Slate SCADA Color Mapping:
    // Compression (< 0 MPa): Deep Red to Bright Crimson
    // Low Tension (0 to 20 MPa): Deep Navy/Obsidian Slate
    // Normal Tension (20 to 80 MPa): Steel/Sky Blue
    // High Tension (> 80 MPa): Vibrant Cyan / Bright Highlight
    const getColor = (val) => {
      if (val < 0) {
        const t = Math.min(1.0, Math.abs(val) / 25.0);
        const r = Math.round(180 + t * 75);
        const g = Math.round((1 - t) * 35);
        const b = Math.round((1 - t) * 35);
        return `rgb(${r}, ${g}, ${b})`;
      } else {
        const t = Math.min(1.0, val / 130.0);
        // Gradient from dark navy (15, 23, 42) -> deep cyan (6, 110, 160) -> vibrant cyan (6, 182, 212)
        const r = Math.round((1 - t) * 11 + t * 6);
        const g = Math.round((1 - t) * 24 + t * 182);
        const b = Math.round((1 - t) * 45 + t * 212);
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

    // Taper Interface 1: 350 m
    const yTaper1 = (350 / 1150) * height;
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(0, yTaper1);
    ctx.lineTo(width, yTaper1);
    ctx.stroke();

    // Taper Interface 2: 750 m
    const yTaper2 = (750 / 1150) * height;
    ctx.strokeStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(0, yTaper2);
    ctx.lineTo(width, yTaper2);
    ctx.stroke();
    ctx.setLineDash([]);
  }, [stressHeatmap]);

  return (
    <div className="flex flex-col gap-3 font-sans">
      {/* 2D Contour Canvas */}
      <div className="bg-white rounded-lg border border-slate-200 p-3.5 relative shadow-xs">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between pb-2.5 border-b border-slate-200 text-xs font-medium gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Layers className="w-4 h-4 text-sky-600" />
            <span className="font-bold text-slate-800 font-mono uppercase tracking-wide">
              Reduced-Order Modeled Axial Stress &mdash; σ(x, θ)
            </span>
            <span className="font-mono text-[10.5px] text-slate-500">116 Nodes &times; 144 Crank Angles</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10.5px]">
            <span className="flex items-center gap-1.5 text-rose-600 font-semibold">
              <span className="w-2.5 h-2.5 rounded-xs bg-rose-600"></span> Compression (&lt;0 MPa)
            </span>
            <span className="flex items-center gap-1.5 text-sky-600 font-semibold">
              <span className="w-2.5 h-2.5 rounded-xs bg-sky-600"></span> Tension (&gt;50 MPa)
            </span>
          </div>
        </div>

        <div className="relative flex pt-2.5">
          {/* Depth Axis Labels */}
          <div className="w-14 h-[280px] flex flex-col justify-between text-[9.5px] font-mono text-slate-600 py-1 text-right pr-2">
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
              className="w-full h-[280px] rounded-lg border border-slate-300 bg-slate-950"
            >
              Synthetic modeled axial stress heatmap.
            </canvas>
            <div className="absolute top-[28%] right-2 bg-white/95 border border-sky-300 rounded px-1.5 py-0.5 text-[9px] font-mono text-sky-800 font-bold shadow-xs">
              Taper 1: 1.000" → 0.875" (350 m)
            </div>
            <div className="absolute top-[63%] right-2 bg-white/95 border border-sky-300 rounded px-1.5 py-0.5 text-[9px] font-mono text-sky-800 font-bold shadow-xs">
              Taper 2: 0.875" → 0.750" (750 m)
            </div>
          </div>
        </div>

        {/* Phase Angle X-Axis */}
        <div className="flex justify-between text-[9.5px] font-mono text-slate-600 pl-16 pr-2 pt-2">
          <span>0° (TDC)</span>
          <span>90° (Mid-Downstroke)</span>
          <span>180° (BDC)</span>
          <span>270° (Mid-Upstroke)</span>
          <span>360°</span>
        </div>
      </div>

      <div className="text-[10.5px] font-mono text-amber-900 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5">
        Synthetic reduced-order stress screen; colors are not measured strain, inspection findings, fatigue results, or certified structural limits.
      </div>

      {/* 3-Section Taper Property Table Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs tabular-nums">
        <div className="hmi-panel p-3 bg-white border border-slate-200 rounded-lg shadow-xs">
          <div className="font-bold text-slate-800 mb-1 font-sans">Section 1 &mdash; 1.000 in. rod</div>
          <div className="flex justify-between py-1 text-[11px] text-slate-600 border-b border-slate-100">
            <span>Depth:</span> <span className="font-semibold text-slate-800">0 – 350 m</span>
          </div>
          <div className="flex justify-between py-1 text-[11px] text-slate-600 border-b border-slate-100">
            <span>Area:</span> <span className="font-semibold text-slate-800">5.067 cm²</span>
          </div>
          <div className="flex justify-between py-1 text-[11px] text-slate-600">
            <span>Fatigue / safety factor:</span> <span className="font-semibold text-slate-600">Not evaluated</span>
          </div>
        </div>

        <div className="hmi-panel p-3 bg-white border border-slate-200 rounded-lg shadow-xs">
          <div className="font-bold text-slate-800 mb-1 font-sans">Section 2 &mdash; 0.875 in. rod</div>
          <div className="flex justify-between py-1 text-[11px] text-slate-600 border-b border-slate-100">
            <span>Depth:</span> <span className="font-semibold text-slate-800">350 – 750 m</span>
          </div>
          <div className="flex justify-between py-1 text-[11px] text-slate-600 border-b border-slate-100">
            <span>Area:</span> <span className="font-semibold text-slate-800">3.879 cm²</span>
          </div>
          <div className="flex justify-between py-1 text-[11px] text-slate-600">
            <span>Fatigue / safety factor:</span> <span className="font-semibold text-slate-600">Not evaluated</span>
          </div>
        </div>

        <div className={`hmi-panel p-3 border-l-4 rounded-lg shadow-xs ${
          isBuckling ? 'border-l-rose-500 bg-rose-50/60 border-slate-200' : 'border-l-sky-500 bg-white border-slate-200'
        }`}>
          <div className="font-bold text-slate-800 mb-1 font-sans">Section 3 &mdash; 0.750 in. rod</div>
          <div className="flex justify-between py-1 text-[11px] text-slate-600 border-b border-slate-100">
            <span>Depth:</span> <span className="font-semibold text-slate-800">750 – 1,150 m</span>
          </div>
          <div className="flex justify-between py-1 text-[11px] text-slate-600 border-b border-slate-100">
            <span>Area:</span> <span className="font-semibold text-slate-800">2.850 cm²</span>
          </div>
          <div className="flex justify-between py-1 text-[11px] text-slate-600">
            <span>Model screen:</span>{' '}
            <span className={`font-bold ${isBuckling ? 'text-rose-600' : 'text-sky-700'}`}>
              {isBuckling ? 'Compression indicator' : 'Tension floor met'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DepthStressHeatmap;
