import React from 'react';
import { Play, Pause, SlidersHorizontal, AlertTriangle } from 'lucide-react';

/* -- Enum -> human label maps. The raw token stays visible in a mono pill
      next to the label because operators read the tokens in log output. --- */

const FAILSAFE_LABELS = {
  LEVEL_0_NORMAL: 'Nominal',
  LEVEL_1_DEGRADED: 'Degraded data',
  LEVEL_2_PROTECTIVE: 'Protective fallback',
  LEVEL_3_EMERGENCY: 'Stop advised',
};

const SCENARIOS = [
  { id: 'SCENARIO_A_BASELINE_FAILURE', label: 'Freeze stress' },
  { id: 'SCENARIO_B_COUPLED_TWIN', label: 'Coupled advisory' },
  { id: 'SCENARIO_C_TELEMETRY_SEVERED', label: 'Telemetry loss' },
  { id: 'DEFAULT_OPERATION', label: 'Nominal case' },
];

const SOLVERS = [
  { id: 'surrogate', label: 'Surrogate' },
  { id: 'transient', label: 'Transient' },
];

const SOLVER_HELP =
  'Surrogate: reduced-order algebraic closed form, ~2 ms. Transient: 1-D elastodynamic wave PDE along the rod string, ~120 ms — downgraded to surrogate above 85 °C, with the reason reported in model_status.solver_fallback_reason.';

// Resolve the backend supervisory state into one of the four fixed levels.
function resolveLevel(failsafeLevel, isModbusSevered) {
  if (failsafeLevel && failsafeLevel.includes('LEVEL_3')) return 'L3';
  if (isModbusSevered || (failsafeLevel && failsafeLevel.includes('LEVEL_2'))) return 'L2';
  if (failsafeLevel && failsafeLevel.includes('LEVEL_1')) return 'L1';
  return 'L0';
}

const LEVEL_TONE = {
  L0: 'tone-safe',
  L1: 'tone-caution',
  L2: 'tone-caution',
  L3: 'tone-critical',
};

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** A label / value / unit stack — the atom of the readout strip. */
function Readout({ label, value, unit, tone = 'text-ink', describedBy }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0" aria-describedby={describedBy}>
      <span className="eyebrow whitespace-nowrap">{label}</span>
      <span className="flex items-baseline gap-1">
        <span className={`readout text-[15px] font-semibold leading-none ${tone}`}>{value}</span>
        {unit ? <span className="unit-label leading-none">{unit}</span> : null}
      </span>
    </div>
  );
}

export function ScadaHeader({
  scenarioId,
  failsafeLevel,
  isModbusSevered,
  onApplyScenario,
  onToggleDrawer,
  loading,
  isPlaying,
  onTogglePlay,
  simSpeed,
  onChangeSpeed,
  currentSpm,
  edgeSolveTimeMs = 3.2,
  isWsLive = false,
  solverType = 'surrogate',
  onToggleSolverType,
  tabs = [],
  activeTab,
  onSelectTab,
}) {
  const level = resolveLevel(failsafeLevel, isModbusSevered);
  const levelLabel = FAILSAFE_LABELS[failsafeLevel] || FAILSAFE_LABELS.LEVEL_0_NORMAL;
  const activeLabel = tabs.find((t) => t.id === activeTab)?.label || 'Overview';

  const solveText = isNum(edgeSolveTimeMs) ? edgeSolveTimeMs.toFixed(1) : String(edgeSolveTimeMs ?? '—');
  const spmText = isNum(currentSpm) ? currentSpm.toFixed(2) : '—';

  const linkLabel = isModbusSevered ? 'Link severed' : isWsLive ? 'Live stream' : 'Local loop';
  const linkTone = isModbusSevered ? 'tone-critical' : isWsLive ? 'tone-safe' : '';

  /**
   * The mobile tablist gets the same keyboard contract as the desktop rail:
   * the shared `onTabKeyDown` owns selection + preventDefault, and we move DOM
   * focus to *our* button afterwards (the desktop `#tab-*` nodes are
   * `display:none` at this breakpoint, so they cannot take focus).
   */
  const handleMobileTabKeyDown = (event, currentIndex) => {
    let nextIndex = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;

    if (typeof onTabKeyDown === 'function') {
      onTabKeyDown(event, currentIndex);
    } else if (nextIndex !== null) {
      event.preventDefault();
      onSelectTab?.(tabs[nextIndex].id);
    }

    if (nextIndex === null) return;
    const nextId = tabs[nextIndex]?.id;
    if (!nextId) return;
    requestAnimationFrame(() => document.getElementById(`mobile-tab-${nextId}`)?.focus());
  };

  return (
    <header className="bg-surface-1">
      {/* --- Top Bar: Identity & Supervisory Status --- */}
      <div className="px-5 lg:px-6 py-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 bg-surface-1">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-ink">Well 14</span>
            <span className="text-xs text-muted">/</span>
            <span className="text-xs text-muted">Baghewala Heavy Oil Sector</span>
            <span className="text-xs text-faint hidden sm:inline">(1,150 m Jodhpur Sandstone)</span>
          </div>
          <h1 className="text-base font-bold text-ink tracking-tight mt-0.5 truncate">
            {activeLabel}
          </h1>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {/* Telemetry link status */}
          <span className={`pill ${linkTone}`}>
            <span className={`chip-dot ${isWsLive && !isModbusSevered ? 'vs-live-dot' : ''}`} aria-hidden="true" />
            {linkLabel}
          </span>

          {/* Supervisory state badge */}
          <span
            key={level}
            role="status"
            aria-label={`Supervisory state: ${levelLabel}`}
            className={`vs-badge-change pill ${LEVEL_TONE[level]} ${level === 'L3' ? 'vs-estop' : ''}`}
          >
            {level === 'L3' ? (
              <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <span className={`chip-dot ${level === 'L0' && isWsLive ? 'vs-live-dot' : ''}`} aria-hidden="true" />
            )}
            {levelLabel}
          </span>

          <button type="button" onClick={onToggleDrawer} className="btn btn-primary ml-1 text-xs">
            <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Case inputs</span>
          </button>
        </div>
      </div>

      {/* --- Main Instrument Strip: Primary Hero Advised SPM & Functional Controls --- */}
      <div className="px-5 lg:px-6 py-3.5 bg-surface-2 flex flex-wrap items-center justify-between gap-x-8 gap-y-4 shadow-sm">
        {/* PRIMARY HERO: Advised Pump Speed */}
        <div className="flex items-baseline gap-4 min-w-[220px]">
          <div>
            <div className="text-xs font-semibold text-muted">Advised pump speed</div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-4xl lg:text-5xl font-bold font-mono text-hero tracking-tight">
                {spmText}
              </span>
              <span className="text-sm font-bold text-muted font-mono">SPM</span>
            </div>
          </div>
          <div className="text-xs text-muted leading-tight border-l border-hairline/60 pl-3.5 py-0.5">
            <div>Solve latency: <span className="font-mono text-ink font-semibold">{solveText} ms</span></div>
            <div className="text-[11px] text-muted mt-0.5">
              {solverType === 'transient' ? 'Transient wave PDE' : 'Closed-form surrogate'}
            </div>
          </div>
        </div>

        {/* Solver Mode Segmented Toggle */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Solver fidelity</span>
          <div className="segmented" role="group" aria-label="Solver mode">
            {SOLVERS.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={solverType === s.id}
                disabled={loading}
                onClick={() => {
                  if (solverType !== s.id) onToggleSolverType?.();
                }}
                className="segmented-item text-xs"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Operational Scenario Dispatch */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted">Operating scenario</span>
            {loading && <span className="text-[11px] text-muted animate-pulse">Re-solving…</span>}
          </div>
          <div className="segmented" role="group" aria-label="Scenario presets">
            {SCENARIOS.map((sc) => (
              <button
                type="button"
                key={sc.id}
                aria-pressed={scenarioId === sc.id}
                onClick={() => onApplyScenario?.(sc.id)}
                disabled={loading}
                className="segmented-item text-xs"
              >
                {sc.label}
              </button>
            ))}
          </div>
        </div>

        {/* Animation Transport */}
        <div className="flex flex-col gap-1 ml-auto">
          <span className="text-xs font-medium text-muted">Animation clock</span>
          <div className="segmented" role="group" aria-label="Animation playback">
            <button
              type="button"
              aria-pressed={Boolean(isPlaying)}
              aria-label={isPlaying ? 'Pause animation' : 'Play animation'}
              onClick={onTogglePlay}
              className="segmented-item px-2.5"
            >
              {isPlaying ? (
                <Pause className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <Play className="w-3.5 h-3.5" aria-hidden="true" />
              )}
            </button>
            {[1, 2, 5].map((spd) => (
              <button
                key={spd}
                type="button"
                aria-pressed={simSpeed === spd}
                aria-label={`Playback speed ${spd} times`}
                onClick={() => onChangeSpeed?.(spd)}
                className="segmented-item font-mono text-xs px-2"
              >
                {spd}×
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile view switcher */}
      {tabs.length > 0 && (
        <div
          className="lg:hidden px-5 pb-2.5 pt-1.5 flex gap-2 overflow-x-auto no-scrollbar border-t border-hairline bg-surface-1"
          role="tablist"
          aria-label="Analysis views"
        >
          {tabs.map((tab, tabIndex) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`mobile-tab-${tab.id}`}
                role="tab"
                aria-selected={isActive}
                aria-controls={isActive ? `panel-${tab.id}` : undefined}
                tabIndex={isActive ? 0 : -1}
                type="button"
                onClick={() => onSelectTab?.(tab.id)}
                onKeyDown={(event) => handleMobileTabKeyDown(event, tabIndex)}
                className="segmented-item shrink-0 border border-hairline text-xs"
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
}

export default ScadaHeader;
