import React from 'react';
import { Flame, Droplet, Gauge, AlertTriangle, ShieldCheck } from 'lucide-react';

export function MetricCards({
  temperatureC,
  viscosityCp,
  dragBeta,
  minTensionKn,
  effectiveSpm,
  targetSpm,
  isBuckling,
  elapsedDays = 12.0,
}) {
  const meetsModeledTensionFloor = minTensionKn >= 0.5;

  return (
    <div className="space-y-2 mb-4">
      <div className="text-[10.5px] font-mono text-amber-900 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5">
        Synthetic reduced-order outputs · screening/advisory use only · not measurements or certified safety determinations
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
      {/* 1. Formation Temperature */}
      <div className="hmi-panel p-4 flex flex-col justify-between border-l-4 border-l-sky-500 bg-white border-slate-200 rounded-lg shadow-xs">
        <div className="flex items-center justify-between text-slate-500 mb-1">
          <span className="text-xs font-semibold flex items-center gap-1.5 text-slate-700 font-sans">
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            Modeled Formation Temp
          </span>
          <span className="text-[11px] text-slate-400 font-mono">CSS Day {elapsedDays.toFixed(1)}</span>
        </div>
        <div className="mt-1">
          <div className="flex items-baseline gap-1.5 tabular-nums">
            <span className="text-3xl font-bold text-slate-900 tracking-tight">
              {temperatureC.toFixed(1)}
            </span>
            <span className="text-sm font-medium text-slate-500">°C</span>
          </div>
          <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500">
            <span>{(temperatureC - 48.0) >= 0 ? `+${(temperatureC - 48.0).toFixed(1)}` : (temperatureC - 48.0).toFixed(1)}°C vs native</span>
            <span className="text-sky-700 font-medium bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200 text-[10px]">
              Boberg-Lantz
            </span>
          </div>
        </div>
      </div>

      {/* 2. Heavy Crude Viscosity & Drag */}
      <div className="hmi-panel p-4 flex flex-col justify-between border-l-4 border-l-amber-500 bg-white border-slate-200 rounded-lg shadow-xs">
        <div className="flex items-center justify-between text-slate-500 mb-1">
          <span className="text-xs font-semibold flex items-center gap-1.5 text-slate-700 font-sans">
            <Droplet className="w-3.5 h-3.5 text-sky-600" />
            Crude Viscosity
          </span>
          <span className="text-[11px] text-slate-400 font-mono">Arrhenius</span>
        </div>
        <div className="mt-1">
          <div className="flex items-baseline gap-1.5 tabular-nums">
            <span className="text-3xl font-bold text-slate-900 tracking-tight">
              {viscosityCp > 1000 ? `${(viscosityCp / 1000).toFixed(1)}k` : viscosityCp.toFixed(0)}
            </span>
            <span className="text-sm font-medium text-slate-500">cP</span>
          </div>
          <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500">
            <span>{(viscosityCp / 1000).toFixed(3)} Pa·s</span>
            <span className="text-amber-800 font-semibold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[10px]">
              β = {dragBeta.toFixed(2)} N·s/m²
            </span>
          </div>
        </div>
      </div>

      {/* 3. Minimum Rod Tension */}
      <div className={`hmi-panel p-4 flex flex-col justify-between border-l-4 rounded-lg shadow-xs ${
        meetsModeledTensionFloor
          ? 'border-l-emerald-500 bg-white border-slate-200' 
          : 'border-l-rose-500 bg-rose-50/60 border-rose-200'
      }`}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold flex items-center gap-1.5 text-slate-700 font-sans">
            {meetsModeledTensionFloor ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> : <AlertTriangle className="w-3.5 h-3.5 text-rose-600 animate-pulse" />}
            Modeled Min Tension
          </span>
          <span className="text-[11px] text-slate-400 font-mono">Model floor: +0.50 kN</span>
        </div>
        <div className="mt-1">
          <div className="flex items-baseline gap-1.5 tabular-nums">
            <span className={`text-3xl font-bold tracking-tight ${meetsModeledTensionFloor ? 'text-emerald-600' : 'text-rose-600'}`}>
              {minTensionKn >= 0 ? `+${minTensionKn.toFixed(2)}` : minTensionKn.toFixed(2)}
            </span>
            <span className="text-sm font-medium text-slate-500">kN</span>
          </div>
          <div className="flex items-center justify-between mt-2 text-[11px]">
            {meetsModeledTensionFloor ? (
              <span className="text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-[10px]">
                Above model floor (+{(minTensionKn - 0.5).toFixed(2)} kN)
              </span>
            ) : (
              <span className="text-rose-700 font-bold bg-rose-100 px-1.5 py-0.5 rounded border border-rose-300 text-[10px] animate-pulse">
                MODELED COMPRESSION SCREEN
              </span>
            )}
            <span className="text-slate-500 font-mono">Depth 1,150 m</span>
          </div>
        </div>
      </div>

      {/* 4. Operating Speed */}
      <div className="hmi-panel p-4 flex flex-col justify-between border-l-4 border-l-indigo-500 bg-white border-slate-200 rounded-lg shadow-xs">
        <div className="flex items-center justify-between text-slate-500 mb-1">
          <span className="text-xs font-semibold flex items-center gap-1.5 text-slate-700 font-sans">
            <Gauge className="w-3.5 h-3.5 text-indigo-600" />
            Advisory Speed
          </span>
          <span className="text-[11px] text-slate-400 font-mono">Target: {targetSpm.toFixed(1)} SPM</span>
        </div>
        <div className="mt-1">
          <div className="flex items-baseline gap-1.5 tabular-nums">
            <span className="text-3xl font-bold text-slate-900 tracking-tight">
              {effectiveSpm.toFixed(1)}
            </span>
            <span className="text-sm font-medium text-slate-500">SPM</span>
          </div>
          <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500">
            <span>Period: {(60 / (effectiveSpm || 1)).toFixed(1)}s / cycle</span>
            {effectiveSpm < targetSpm ? (
              <span className="text-sky-700 font-semibold bg-sky-50 px-1.5 py-0.5 border border-sky-200 rounded text-[10px]">
                Constraint advisory applied
              </span>
            ) : (
              <span className="text-slate-500">Requested setpoint retained</span>
            )}
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}

export default MetricCards;
