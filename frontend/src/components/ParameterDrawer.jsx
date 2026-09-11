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
    <div className="fixed inset-0 z-50 overflow-hidden bg-[rgb(15_23_42/0.35)] backdrop-blur-sm flex justify-end p-3 sm:p-5 vs-overlay-in">
      <div role="dialog" aria-modal="true" aria-labelledby="parameter-drawer-title" className="w-full max-w-md bg-surface-1 text-ink h-full flex flex-col justify-between rounded-[24px] border border-hairline shadow-float overflow-hidden vs-slide-in-right">
        {/* Drawer Header */}
        <div className="px-5 py-4 border-b border-hairline flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="icon-badge w-9 h-9 bg-interactive/10 text-interactive">
              <SlidersHorizontal className="w-4 h-4" />
            </span>
            <div>
              <h3 id="parameter-drawer-title" className="card-title">Case inputs</h3>
              <p className="caption">Model assumptions</p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Close parameter drawer"
            onClick={onClose}
            className="btn-icon"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="px-5 py-4 overflow-y-auto flex-1 space-y-4 text-[13px]">
          <p className="caption">
            Changes rerun an unvalidated reduced-order model only. They do not command equipment or alter a live control system.
          </p>
          {/* Thermal & Steam */}
          <div className="space-y-3 card-nested p-4">
            <div className="text-[13px] font-semibold text-ink pb-2 border-b border-hairline">
              Thermal &amp; steam
            </div>

            <div>
              <div className="flex justify-between text-muted font-medium mb-1">
                <span>Cooling rate multiplier (k̂):</span>
                <span className="readout text-interactive">{params.cooling_multiplier.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                aria-label="Cooling rate multiplier"
                min="0.5"
                max="3.0"
                step="0.05"
                value={params.cooling_multiplier}
                onChange={(e) => onChangeParam('cooling_multiplier', parseFloat(e.target.value))}
                className="w-full accent-interactive cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-muted font-medium mb-1">
                <span>Steam quality (reserved; not coupled):</span>
                <span className="readout text-interactive">{(params.steam_quality * 100).toFixed(0)}%</span>
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
                className="w-full accent-interactive cursor-not-allowed opacity-50"
              />
            </div>

            <div>
              <div className="flex justify-between text-muted font-medium mb-1">
                <span>CSS cycle elapsed:</span>
                <span className="readout text-interactive">{params.elapsed_days.toFixed(1)} days</span>
              </div>
              <input
                type="range"
                aria-label="Synthetic CSS cycle elapsed days"
                min="0.0"
                max="60.0"
                step="0.5"
                value={params.elapsed_days}
                onChange={(e) => onChangeParam('elapsed_days', parseFloat(e.target.value))}
                className="w-full accent-interactive cursor-pointer"
              />
            </div>
          </div>

          {/* Fluid & Sand Wear */}
          <div className="space-y-3 card-nested p-4">
            <div className="text-[13px] font-semibold text-ink pb-2 border-b border-hairline">
              Fluid rheology &amp; erosion
            </div>

            <div>
              <div className="flex justify-between text-muted font-medium mb-1">
                <span>Water cut (fw):</span>
                <span className="readout text-interactive">{(params.water_cut * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                aria-label="Water cut assumption"
                min="0.05"
                max="0.85"
                step="0.05"
                value={params.water_cut}
                onChange={(e) => onChangeParam('water_cut', parseFloat(e.target.value))}
                className="w-full accent-interactive cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-muted font-medium mb-1">
                <span>Plunger sand wear factor:</span>
                <span className="readout text-interactive">{params.plunger_sand_wear.toFixed(2)}</span>
              </div>
              <input
                type="range"
                aria-label="Plunger sand wear assumption"
                min="0.0"
                max="1.0"
                step="0.05"
                value={params.plunger_sand_wear}
                onChange={(e) => onChangeParam('plunger_sand_wear', parseFloat(e.target.value))}
                className="w-full accent-interactive cursor-pointer"
              />
            </div>
          </div>

          {/* Kinematics */}
          <div className="space-y-3 card-nested p-4">
            <div className="text-[13px] font-semibold text-ink pb-2 border-b border-hairline">
              Surface kinematics
            </div>

            <div>
              <div className="flex justify-between text-muted font-medium mb-1">
                <span>Target pumping speed:</span>
                <span className="readout text-interactive">{params.target_spm.toFixed(1)} SPM</span>
              </div>
              <input
                type="range"
                aria-label="Requested pumping speed for the model"
                min="1.0"
                max="6.0"
                step="0.1"
                value={params.target_spm}
                onChange={(e) => onChangeParam('target_spm', parseFloat(e.target.value))}
                className="w-full accent-interactive cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-muted font-medium mb-1">
                <span>Stroke length:</span>
                <span className="readout text-interactive">{params.stroke_length_m.toFixed(2)} m</span>
              </div>
              <input
                type="range"
                aria-label="Assumed stroke length"
                min="1.5"
                max="3.2"
                step="0.05"
                value={params.stroke_length_m}
                onChange={(e) => onChangeParam('stroke_length_m', parseFloat(e.target.value))}
                className="w-full accent-interactive cursor-pointer"
              />
            </div>
          </div>

          {/* Modbus Disconnect Simulator */}
          <div className="p-4 bg-critical/10 rounded-[14px] border border-critical/25">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={params.modbus_severed}
                onChange={(e) => onChangeParam('modbus_severed', e.target.checked)}
                className="rounded border-hairline accent-critical"
              />
              <span className="font-semibold text-critical text-[13px]">Simulate Modbus cable severance</span>
            </label>
            <p className="text-[12px] text-critical/80 mt-1.5 pl-7 leading-relaxed">
              Configures a synthetic stale-data case (&gt;60 s) and reports the model's Level 2 fallback recommendation of 2.0 SPM; no bus is connected.
            </p>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="px-5 py-4 border-t border-hairline flex items-center justify-between gap-3">
          <button type="button" onClick={onReset} disabled={loading} className="btn btn-ghost px-4 py-2">
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>

          <button type="button" onClick={onApply} disabled={loading} className="btn btn-primary px-4 py-2">
            <Check className="w-3.5 h-3.5" />
            {loading ? 'Running model…' : 'Apply model inputs'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ParameterDrawer;
