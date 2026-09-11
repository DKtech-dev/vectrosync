import React from 'react';
import { Play, Pause, SlidersHorizontal, AlertTriangle } from 'lucide-react';

// Resolve the backend supervisory state into one of the four fixed levels.
function resolveLevel(failsafeLevel, isModbusSevered) {
  if (failsafeLevel && failsafeLevel.includes('LEVEL_3')) return 'L3';
  if (isModbusSevered || (failsafeLevel && failsafeLevel.includes('LEVEL_2'))) return 'L2';
  if (failsafeLevel && failsafeLevel.includes('LEVEL_1')) return 'L1';
  return 'L0';
}

const LEVEL_META = {
  L0: { label: 'Nominal', pill: 'bg-safe/10 text-safe' },
  L1: { label: 'Stale data', pill: 'bg-caution/10 text-caution' },
  L2: { label: 'Fallback active', pill: 'bg-caution/10 text-caution' },
  L3: { label: 'Stop advised', pill: 'bg-critical/10 text-critical' },
};

const SCENARIOS = [
  { id: 'SCENARIO_A_BASELINE_FAILURE', label: 'Freeze stress' },
  { id: 'SCENARIO_B_COUPLED_TWIN', label: 'Coupled advisory' },
  { id: 'SCENARIO_C_TELEMETRY_SEVERED', label: 'Telemetry loss' },
  { id: 'DEFAULT_OPERATION', label: 'Resume live feed' },
];

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
  edgeSolveTimeMs = 3.2,
  isWsLive = false,
  solverType = 'surrogate',
  onToggleSolverType,
  tabs = [],
  activeTab,
  onSelectTab,
}) {
  const level = resolveLevel(failsafeLevel, isModbusSevered);
  const meta = LEVEL_META[level];
  const activeLabel = tabs.find((t) => t.id === activeTab)?.label || 'Overview';

  return (
    <header className="bg-surface-1 border-b border-hairline">
      {/* Row 1: title + control cluster */}
      <div className="px-6 py-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[19px] font-extrabold tracking-[-0.02em] text-ink leading-tight">{activeLabel}</h1>
          <p className="caption mt-0.5 truncate">
            Well&nbsp;#14 · Baghewala-inspired synthetic case · 1,150&nbsp;m TVD
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Supervisory state */}
          <span
            key={level}
            role="status"
            aria-label={`Supervisory state: ${meta.label}`}
            className={`vs-badge-change pill ${meta.pill} ${level === 'L3' ? 'vs-estop' : ''}`}
          >
            {level === 'L3' ? (
              <AlertTriangle className="w-3.5 h-3.5" />
            ) : (
              <span className={`chip-dot ${level === 'L0' && isWsLive ? 'vs-live-dot' : ''}`} />
            )}
            {meta.label}
          </span>

          {/* Solver quick filter -- the only genuine solver-mode switch; a
              real difference in solve_time_ms is measurable when toggled. */}
          <button
            type="button"
            onClick={onToggleSolverType}
            className={`btn px-3 py-2 ${
              solverType === 'transient' ? 'bg-interactive/10 text-interactive border border-interactive/30' : 'btn-ghost'
            }`}
            title="Toggle Fast Surrogate (~2 ms) / Transient PDE solver (validated <=85°C reservoir temperature)"
          >
            {solverType === 'transient' ? 'Transient PDE' : 'Fast surrogate'}
            <span className="readout text-[11px] opacity-70">
              {typeof edgeSolveTimeMs === 'number' ? `${edgeSolveTimeMs.toFixed(1)}ms` : edgeSolveTimeMs}
            </span>
          </button>

          <button type="button" onClick={onToggleDrawer} className="btn btn-primary px-4 py-2">
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">Case inputs</span>
          </button>
        </div>
      </div>

      {/* Row 2: scenario segmented control + playback */}
      <div className="px-6 pb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="segmented" role="group" aria-label="Synthetic scenarios">
          {SCENARIOS.map((sc) => (
            <button
              type="button"
              key={sc.id}
              aria-pressed={scenarioId === sc.id}
              onClick={() => onApplyScenario(sc.id)}
              disabled={loading}
              className="segmented-item"
            >
              {sc.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className={`pill ${isWsLive ? 'bg-safe/10 text-safe' : 'bg-surface-2 text-muted'}`}>
            <span className={`chip-dot ${isWsLive ? 'vs-live-dot' : ''}`} />
            {isModbusSevered ? 'Link lost' : isWsLive ? 'Live stream' : 'Local loop'}
          </span>

          <div className="segmented">
            <button
              type="button"
              aria-pressed={isPlaying}
              aria-label={isPlaying ? 'Pause animation' : 'Play animation'}
              onClick={onTogglePlay}
              className="segmented-item px-3"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
            {[1, 2, 5].map((spd) => (
              <button
                type="button"
                key={spd}
                aria-pressed={simSpeed === spd}
                aria-label={`Speed ${spd}x`}
                onClick={() => onChangeSpeed(spd)}
                className="segmented-item readout px-3"
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile view switcher */}
      {tabs.length > 0 && (
        <div className="lg:hidden px-6 pb-3 flex gap-2 overflow-x-auto" role="tablist" aria-label="Analysis views">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              id={`mobile-tab-${tab.id}`}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className="segmented-item shrink-0 border border-hairline"
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}

export default ScadaHeader;
