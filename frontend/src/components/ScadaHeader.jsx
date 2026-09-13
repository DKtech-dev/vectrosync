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
    <header className="bg-surface-1 border-b border-hairline">
      {/* -- Row 1: asset identity + supervisory state + primary action ----- */}
      <div className="px-5 lg:px-6 py-3.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <p className="eyebrow truncate">WELL 14 · BAGHEWALA SECTOR · JODHPUR SANDSTONE · 1150 M TVD</p>
          <h1 className="text-[18px] font-extrabold tracking-[-0.02em] text-ink leading-tight mt-0.5 truncate">
            {activeLabel}
          </h1>
        </div>

        <div className="flex items-center gap-3 shrink-0">
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
          {failsafeLevel ? (
            <span className="pill hidden xl:inline-flex" title="Raw failsafe enum reported by the supervisor">
              {failsafeLevel}
            </span>
          ) : null}

          <button type="button" onClick={onToggleDrawer} className="btn btn-primary">
            <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Case inputs</span>
          </button>
        </div>
      </div>

      {/* -- Row 2: readout strip ------------------------------------------- */}
      <div className="px-5 lg:px-6 py-2.5 border-t border-hairline blueprint-fine">
        <div className="flex flex-wrap items-end gap-x-7 gap-y-3">
        <Readout
          label="ADVISED SPM"
          value={spmText}
          unit="spm"
          tone={isNum(currentSpm) ? 'text-interactive' : 'text-faint'}
        />
        <Readout label="SOLVE TIME" value={solveText} unit="ms" describedBy="solver-help" />

        <div className="flex flex-col gap-1">
          <span className="eyebrow">SOLVER MODE</span>
          <div className="segmented" role="group" aria-label="Solver mode">
            {SOLVERS.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={solverType === s.id}
                aria-describedby="solver-help"
                disabled={loading}
                onClick={() => {
                  if (solverType !== s.id) onToggleSolverType?.();
                }}
                className="segmented-item"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="eyebrow">TELEMETRY LINK</span>
          <span className={`pill ${linkTone}`}>
            <span className={`chip-dot ${isWsLive && !isModbusSevered ? 'vs-live-dot' : ''}`} aria-hidden="true" />
            {linkLabel}
          </span>
        </div>

        <div className="flex flex-col gap-1 ml-auto">
          <span className="eyebrow">PLAYBACK</span>
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
                className="segmented-item readout px-2.5"
              >
                {spd}×
              </button>
            ))}
          </div>
        </div>
        </div>

        {/* Visible (not title-only) explanation of the solver modes, referenced
            by aria-describedby from both solver buttons and the solve readout. */}
        <p id="solver-help" className="caption mt-2.5 max-w-[80ch] leading-relaxed">
          {SOLVER_HELP}
        </p>
      </div>

      {/* -- Row 3: scenario dispatch --------------------------------------- */}
      <div className="px-5 lg:px-6 py-2.5 border-t border-hairline flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="eyebrow">SCENARIO</span>
        <div className="segmented" role="group" aria-label="Synthetic scenario presets">
          {SCENARIOS.map((sc) => (
            <button
              type="button"
              key={sc.id}
              aria-pressed={scenarioId === sc.id}
              onClick={() => onApplyScenario?.(sc.id)}
              disabled={loading}
              className="segmented-item"
            >
              {sc.label}
            </button>
          ))}
        </div>
        {scenarioId ? (
          <span className="pill hidden lg:inline-flex" title="Raw scenario enum applied by the backend">
            {scenarioId}
          </span>
        ) : null}
        {loading ? <span className="caption">Re-solving…</span> : null}
      </div>

      {/* -- Mobile view switcher: same roving-tabindex contract as the rail - */}
      {tabs.length > 0 && (
        <div
          className="lg:hidden px-5 pb-3 pt-1 flex gap-2 overflow-x-auto no-scrollbar border-t border-hairline"
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
                className="segmented-item shrink-0 border border-hairline"
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
