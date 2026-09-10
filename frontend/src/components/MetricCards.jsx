import React from 'react';
import { Flame, Droplet, Gauge, AlertTriangle, ShieldCheck } from 'lucide-react';
import { AnimatedNumber } from './AnimatedNumber';

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
  const speedConstrained = effectiveSpm < targetSpm;

  return (
    <div className="space-y-2">
      <div className="readout text-[10.5px] text-caution bg-caution/10 border border-caution/30 rounded-md px-3 py-1.5">
        Synthetic reduced-order outputs · screening/advisory use only · not measurements or certified safety determinations
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Formation Temperature — informational (no alarm state) */}
        <div className="panel p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold flex items-center gap-2 text-muted">
              <Flame className="w-3.5 h-3.5 text-faint" />
              Modeled Formation Temp
            </span>
            <span className="readout text-[11px] text-faint">CSS Day {elapsedDays.toFixed(1)}</span>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <AnimatedNumber value={temperatureC} format={(v) => v.toFixed(1)} className="text-3xl font-bold text-ink tracking-tight" />
              <span className="text-sm font-medium text-muted">°C</span>
            </div>
            <div className="flex items-center justify-between mt-2 text-[11px] text-muted">
              <span className="readout">{temperatureC - 48.0 >= 0 ? `+${(temperatureC - 48.0).toFixed(1)}` : (temperatureC - 48.0).toFixed(1)}°C vs native</span>
              <span className="chip text-muted bg-surface-2 border-hairline">Boberg-Lantz</span>
            </div>
          </div>
        </div>

        {/* 2. Heavy Crude Viscosity & Drag — informational */}
        <div className="panel p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold flex items-center gap-2 text-muted">
              <Droplet className="w-3.5 h-3.5 text-faint" />
              Crude Viscosity
            </span>
            <span className="readout text-[11px] text-faint">Arrhenius</span>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <AnimatedNumber
                value={viscosityCp}
                format={(v) => (v > 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0))}
                className="text-3xl font-bold text-ink tracking-tight"
              />
              <span className="text-sm font-medium text-muted">cP</span>
            </div>
            <div className="flex items-center justify-between mt-2 text-[11px] text-muted">
              <span className="readout">{(viscosityCp / 1000).toFixed(3)} Pa·s</span>
              <span className="chip text-muted bg-surface-2 border-hairline">β = {dragBeta.toFixed(2)} N·s/m²</span>
            </div>
          </div>
        </div>

        {/* 3. Minimum Rod Tension — the reactive tile (safe / critical) */}
        <div
          className={`panel p-4 flex flex-col gap-3 border-l-2 ${
            meetsModeledTensionFloor ? 'border-l-safe' : 'border-l-critical'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold flex items-center gap-2 text-muted">
              {meetsModeledTensionFloor ? (
                <ShieldCheck className="w-3.5 h-3.5 text-safe" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-critical animate-pulse" />
              )}
              Modeled Min Tension
            </span>
            <span className="readout text-[11px] text-faint">Floor: +0.50 kN</span>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <AnimatedNumber
                value={minTensionKn}
                format={(v) => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2))}
                className={`text-3xl font-bold tracking-tight ${meetsModeledTensionFloor ? 'text-safe' : 'text-critical'}`}
              />
              <span className="text-sm font-medium text-muted">kN</span>
            </div>
            <div className="flex items-center justify-between mt-2 text-[11px]">
              {meetsModeledTensionFloor ? (
                <span className="chip text-safe bg-safe/10 border-safe/30">Above floor (+{(minTensionKn - 0.5).toFixed(2)} kN)</span>
              ) : (
                <span className="chip text-critical bg-critical/10 border-critical/40 animate-pulse">Modeled compression screen</span>
              )}
              <span className="readout text-faint">Depth 1,150 m</span>
            </div>
          </div>
        </div>

        {/* 4. Operating Speed — caution only when a constraint advisory is applied */}
        <div className="panel p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold flex items-center gap-2 text-muted">
              <Gauge className="w-3.5 h-3.5 text-faint" />
              Advisory Speed
            </span>
            <span className="readout text-[11px] text-faint">Target: {targetSpm.toFixed(1)} SPM</span>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <AnimatedNumber value={effectiveSpm} format={(v) => v.toFixed(1)} className="text-3xl font-bold text-ink tracking-tight" />
              <span className="text-sm font-medium text-muted">SPM</span>
            </div>
            <div className="flex items-center justify-between mt-2 text-[11px] text-muted">
              <span className="readout">Period: {(60 / (effectiveSpm || 1)).toFixed(1)}s / cycle</span>
              {speedConstrained ? (
                <span className="chip text-caution bg-caution/10 border-caution/30">Constraint advisory applied</span>
              ) : (
                <span className="readout text-faint">Requested setpoint retained</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MetricCards;
