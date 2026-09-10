import React, { useEffect, useRef } from 'react';
import { X, RotateCcw, Check, SlidersHorizontal } from 'lucide-react';

export function ParameterDrawer({
  isOpen,
  onClose,
  params,
  onChangeParam,
  onApply,
  onReset,
  loading,
}) {
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/30 backdrop-blur-xs flex justify-end">
      <div role="dialog" aria-modal="true" aria-labelledby="parameter-drawer-title" className="w-full max-w-md bg-white text-slate-900 h-full shadow-2xl flex flex-col justify-between border-l border-slate-200">
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-sky-600" />
            <h3 id="parameter-drawer-title" className="font-sans font-bold text-sm text-slate-900 uppercase tracking-wide">
              Synthetic Case Inputs &mdash; Model Assumptions
            </h3>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Close parameter drawer"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="p-4 overflow-y-auto flex-1 space-y-5 text-xs bg-white">
          <p className="text-[11px] font-mono leading-relaxed text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
            Changes rerun an unvalidated reduced-order model only. They do not command equipment or alter a live control system.
          </p>
          {/* Thermal & Steam */}
          <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="font-bold text-sky-800 text-[11px] pb-1.5 border-b border-slate-200 uppercase tracking-wider">
              Thermal &amp; Steam Dynamics
            </div>

            <div>
              <div className="flex justify-between text-slate-600 font-medium mb-1">
                <span>Cooling rate multiplier (k̂):</span>
                <span className="font-bold font-mono text-sky-700">{params.cooling_multiplier.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                aria-label="Cooling rate multiplier"
                min="0.5"
                max="3.0"
                step="0.05"
                value={params.cooling_multiplier}
                onChange={(e) => onChangeParam('cooling_multiplier', parseFloat(e.target.value))}
                className="w-full accent-sky-600 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-600 font-medium mb-1">
                <span>Steam quality (reserved; not coupled):</span>
                <span className="font-bold font-mono text-sky-700">{(params.steam_quality * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                aria-label="Reserved steam quality input"
                min="0.4"
                max="0.95"
                step="0.05"
                value={params.steam_quality}
                disabled
                title="Reserved until a steam-energy balance is implemented"
                onChange={(e) => onChangeParam('steam_quality', parseFloat(e.target.value))}
                className="w-full accent-sky-600 cursor-not-allowed opacity-50"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-600 font-medium mb-1">
                <span>CSS cycle elapsed:</span>
                <span className="font-bold font-mono text-sky-700">{params.elapsed_days.toFixed(1)} days</span>
              </div>
              <input
                type="range"
                aria-label="Synthetic CSS cycle elapsed days"
                min="0.0"
                max="60.0"
                step="0.5"
                value={params.elapsed_days}
                onChange={(e) => onChangeParam('elapsed_days', parseFloat(e.target.value))}
                className="w-full accent-sky-600 cursor-pointer"
              />
            </div>
          </div>

          {/* Fluid & Sand Wear */}
          <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="font-bold text-amber-800 text-[11px] pb-1.5 border-b border-slate-200 uppercase tracking-wider">
              Fluid Rheology &amp; Plunger Erosion
            </div>

            <div>
              <div className="flex justify-between text-slate-600 font-medium mb-1">
                <span>Water cut (fw):</span>
                <span className="font-bold font-mono text-amber-700">{(params.water_cut * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                aria-label="Water cut assumption"
                min="0.05"
                max="0.85"
                step="0.05"
                value={params.water_cut}
                onChange={(e) => onChangeParam('water_cut', parseFloat(e.target.value))}
                className="w-full accent-amber-600 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-600 font-medium mb-1">
                <span>Plunger sand wear factor:</span>
                <span className="font-bold font-mono text-amber-700">{params.plunger_sand_wear.toFixed(2)}</span>
              </div>
              <input
                type="range"
                aria-label="Plunger sand wear assumption"
                min="0.0"
                max="1.0"
                step="0.05"
                value={params.plunger_sand_wear}
                onChange={(e) => onChangeParam('plunger_sand_wear', parseFloat(e.target.value))}
                className="w-full accent-amber-600 cursor-pointer"
              />
            </div>
          </div>

          {/* Kinematics */}
          <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="font-bold text-emerald-800 text-[11px] pb-1.5 border-b border-slate-200 uppercase tracking-wider">
              Surface Pumping Kinematics
            </div>

            <div>
              <div className="flex justify-between text-slate-600 font-medium mb-1">
                <span>Target pumping speed:</span>
                <span className="font-bold font-mono text-emerald-700">{params.target_spm.toFixed(1)} SPM</span>
              </div>
              <input
                type="range"
                aria-label="Requested pumping speed for the model"
                min="1.0"
                max="6.0"
                step="0.1"
                value={params.target_spm}
                onChange={(e) => onChangeParam('target_spm', parseFloat(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-600 font-medium mb-1">
                <span>Stroke length:</span>
                <span className="font-bold font-mono text-emerald-700">{params.stroke_length_m.toFixed(2)} m</span>
              </div>
              <input
                type="range"
                aria-label="Assumed stroke length"
                min="1.5"
                max="3.2"
                step="0.05"
                value={params.stroke_length_m}
                onChange={(e) => onChangeParam('stroke_length_m', parseFloat(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
            </div>
          </div>

          {/* Modbus Disconnect Simulator */}
          <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={params.modbus_severed}
                onChange={(e) => onChangeParam('modbus_severed', e.target.checked)}
                className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
              />
              <span className="font-bold text-rose-800 text-xs">Simulate Modbus Cable Severance</span>
            </label>
            <p className="text-[11px] text-rose-700/80 mt-1 pl-6 leading-relaxed">
              Configures a synthetic stale-data case (&gt;60 s) and reports the model's Level 2 fallback recommendation of 2.0 SPM; no bus is connected.
            </p>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onReset}
            disabled={loading}
            className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>

          <button
            type="button"
            onClick={onApply}
            disabled={loading}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
          >
            <Check className="w-3.5 h-3.5" />
            {loading ? 'Running Reduced-Order Model...' : 'Apply Model Inputs'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ParameterDrawer;
