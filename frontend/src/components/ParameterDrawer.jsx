import React, { useCallback, useEffect, useRef } from 'react';
import { X, RotateCcw, Check, SlidersHorizontal } from 'lucide-react';

/**
 * Case-input drawer.
 *
 * Slider bounds below are the ranges the backend actually validates, so the
 * control can never post a value the API will reject:
 *   cooling_multiplier 0.2–5.0 · elapsed_days 0–720 · target_spm 0.5–8.0
 *   water_cut 0–1 · steam_quality 0.1–1.0 · plunger_sand_wear 0–1
 *   stroke_length_m 1.0–4.0
 *
 * a11y: `aria-modal` is now backed by a real focus trap plus focus restoration
 * to whatever opened the drawer, and the scrim uses a theme token instead of a
 * hardcoded light-mode slate.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const SolverNames = { surrogate: 'Fast surrogate', transient: 'Transient PDE' };

/** Label / value / range row. Bounds are the server-validated bounds. */
function SliderRow({ id, label, note, value, min, max, step, format, onChange, badge }) {
  const safeValue = typeof value === 'number' && Number.isFinite(value) ? value : min;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <label htmlFor={id} className="text-[12.5px] text-muted font-medium">
          {label}
        </label>
        <span className="readout text-[12.5px] text-interactive font-semibold shrink-0">{format(safeValue)}</span>
      </div>
      <input
        id={id}
        type="range"
        className="slider"
        min={min}
        max={max}
        step={step}
        value={safeValue}
        aria-describedby={note ? `${id}-note` : undefined}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <div className="flex items-center justify-between gap-2 mt-1.5">
        <span className="eyebrow">
          {format(min)} — {format(max)}
        </span>
        {badge}
      </div>
      {note ? (
        <p id={`${id}-note`} className="caption mt-1.5 leading-snug">
          {note}
        </p>
      ) : null}
    </div>
  );
}

function Group({ title, children }) {
  return (
    <section className="panel-nested p-4 space-y-4">
      <h4 className="panel-title pb-2.5 border-b border-hairline">{title}</h4>
      {children}
    </section>
  );
}

export function ParameterDrawer({ isOpen, onClose, params, onChangeParam, onApply, onReset, loading }) {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const restoreFocusRef = useRef(null);

  const focusableNodes = useCallback(() => {
    if (!dialogRef.current) return [];
    return Array.from(dialogRef.current.querySelectorAll(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement,
    );
  }, []);

  // Remember the trigger, move focus in, and restore it on close.
  useEffect(() => {
    if (!isOpen) return undefined;

    restoreFocusRef.current = document.activeElement;
    const raf = requestAnimationFrame(() => closeButtonRef.current?.focus());

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = previousOverflow;
      const trigger = restoreFocusRef.current;
      if (trigger && typeof trigger.focus === 'function' && document.contains(trigger)) {
        trigger.focus();
      }
    };
  }, [isOpen]);

  // Escape to dismiss + Tab cycling confined to the dialog.
  useEffect(() => {
    if (!isOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose?.();
        return;
      }
      if (event.key !== 'Tab') return;

      const nodes = focusableNodes();
      if (nodes.length === 0) return;

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      const inside = dialogRef.current?.contains(active);

      if (event.shiftKey && (active === first || !inside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !inside)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [isOpen, onClose, focusableNodes]);

  if (!isOpen) return null;

  const p = params || {};

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden flex justify-end p-3 sm:p-5 vs-overlay-in"
      style={{ backgroundColor: 'rgb(var(--bg-canvas) / 0.78)' }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="parameter-drawer-title"
        aria-describedby="parameter-drawer-desc"
        className="panel w-full max-w-md h-full flex flex-col overflow-hidden shadow-float vs-slide-in-right"
      >
        {/* Header */}
        <div className="panel-rail shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="icon-badge tone-signal">
              <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h3 id="parameter-drawer-title" className="panel-title truncate">
                Case inputs
              </h3>
              <p className="caption truncate">Model assumptions · re-solves on apply</p>
            </div>
          </div>
          <button ref={closeButtonRef} type="button" aria-label="Close case inputs" onClick={onClose} className="btn-icon">
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-4 overflow-y-auto flex-1 space-y-4">
          <p id="parameter-drawer-desc" className="caption">
            Every bound below is the range the API validates. Applying re-runs the reduced-order model only — no
            setpoint is written and no bus is connected.
          </p>

          <Group title="Thermal &amp; steam">
            <SliderRow
              id="param-cooling"
              label="Cooling rate multiplier k̂"
              value={p.cooling_multiplier}
              min={0.2}
              max={5.0}
              step={0.05}
              format={(v) => `${v.toFixed(2)}×`}
              onChange={(v) => onChangeParam('cooling_multiplier', v)}
              note="Scales the Boberg–Lantz near-wellbore cooldown toward the 48 °C native reservoir temperature."
            />
            <SliderRow
              id="param-elapsed"
              label="CSS cycle elapsed"
              value={p.elapsed_days}
              min={0}
              max={720}
              step={0.5}
              format={(v) => `${v.toFixed(1)} d`}
              onChange={(v) => onChangeParam('elapsed_days', v)}
              note="Days since the 260 °C steam injection ended."
            />
            <SliderRow
              id="param-steam-quality"
              label="Steam quality"
              value={p.steam_quality}
              min={0.1}
              max={1.0}
              step={0.01}
              format={(v) => `${(v * 100).toFixed(0)}%`}
              onChange={(v) => onChangeParam('steam_quality', v)}
              badge={<span className="pill tone-caution">NOT COUPLED</span>}
              note="Accepted and echoed back, but no downstream term consumes it: the backend lists it under model_status.uncoupled_inputs. Moving it will not change any output."
            />
          </Group>

          <Group title="Fluid rheology &amp; erosion">
            <SliderRow
              id="param-water-cut"
              label="Water cut fw"
              value={p.water_cut}
              min={0}
              max={1}
              step={0.01}
              format={(v) => `${(v * 100).toFixed(0)}%`}
              onChange={(v) => onChangeParam('water_cut', v)}
              note="Drives the emulsion viscosity multiplier on top of the Arrhenius temperature term."
            />
            <SliderRow
              id="param-sand-wear"
              label="Plunger sand wear"
              value={p.plunger_sand_wear}
              min={0}
              max={1}
              step={0.01}
              format={(v) => v.toFixed(2)}
              onChange={(v) => onChangeParam('plunger_sand_wear', v)}
              note="0 = new clearance, 1 = fully worn fit; reduces modelled pump fillage."
            />
          </Group>

          <Group title="Surface kinematics">
            <SliderRow
              id="param-target-spm"
              label="Requested pumping speed"
              value={p.target_spm}
              min={0.5}
              max={8.0}
              step={0.1}
              format={(v) => `${v.toFixed(1)} SPM`}
              onChange={(v) => onChangeParam('target_spm', v)}
              note="The operator request. The supervisor may advise lower — its own authority band is 1.0–5.5 SPM."
            />
            <SliderRow
              id="param-stroke"
              label="Stroke length"
              value={p.stroke_length_m}
              min={1.0}
              max={4.0}
              step={0.01}
              format={(v) => `${v.toFixed(2)} m`}
              onChange={(v) => onChangeParam('stroke_length_m', v)}
            />
          </Group>

          <Group title="Supervisor &amp; telemetry">
            <div className="flex items-start justify-between gap-3">
              <label htmlFor="param-mpc" className="text-[12.5px] text-muted font-medium cursor-pointer select-none">
                Constraint supervisor (MPC)
                <p className="caption mt-1">
                  Holds minimum rod tension above the +0.50 kN anti-float floor and peak load under the 99 kN ceiling
                  (110 kN PPRL rating). Disabling it runs the request open-loop.
                </p>
              </label>
              <input
                id="param-mpc"
                type="checkbox"
                checked={Boolean(p.mpc_enabled)}
                onChange={(e) => onChangeParam('mpc_enabled', e.target.checked)}
                className="mt-0.5 w-4 h-4 shrink-0 rounded-xs accent-interactive cursor-pointer"
              />
            </div>

            <div className="well tone-critical p-3">
              <div className="flex items-start justify-between gap-3">
                <label htmlFor="param-modbus" className="text-[12.5px] font-semibold cursor-pointer select-none">
                  Sever Modbus telemetry
                  <p className="caption mt-1 text-[11.5px]" style={{ color: 'rgb(var(--accent-critical) / 0.85)' }}>
                    Simulates a stale-data condition past the 60 s timeout and reports the Level 2 protective fallback
                    of 2.0 SPM. No bus is attached.
                  </p>
                </label>
                <input
                  id="param-modbus"
                  type="checkbox"
                  checked={Boolean(p.modbus_severed)}
                  onChange={(e) => onChangeParam('modbus_severed', e.target.checked)}
                  className="mt-0.5 w-4 h-4 shrink-0 rounded-xs accent-critical cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-[12.5px] text-muted font-medium">Solver mode</span>
              <span className="flex items-center gap-2">
                <span className="readout text-[12.5px] text-ink">{SolverNames[p.solver_type] || SolverNames.surrogate}</span>
                <span className="pill">{p.solver_type || 'surrogate'}</span>
              </span>
            </div>
            <p className="caption -mt-2">Switched from the header rail, where it applies immediately.</p>
          </Group>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-4 py-3 border-t border-hairline flex items-center justify-between gap-3">
          <button type="button" onClick={onReset} disabled={loading} className="btn btn-ghost">
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            Reset defaults
          </button>

          <button type="button" onClick={onApply} disabled={loading} className="btn btn-primary">
            <Check className="w-3.5 h-3.5" aria-hidden="true" />
            {loading ? 'Re-solving…' : 'Apply inputs'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ParameterDrawer;
