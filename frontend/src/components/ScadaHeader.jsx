import React from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SlidersHorizontal,
  Radio,
  AlertTriangle,
  ShieldCheck,
  Activity,
  Cpu,
  Server,
  Zap,
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

// Resolve the backend supervisory state into one of the four fixed levels.
function resolveLevel(failsafeLevel, isModbusSevered) {
  if (failsafeLevel && failsafeLevel.includes('LEVEL_3')) return 'L3';
  if (isModbusSevered || (failsafeLevel && failsafeLevel.includes('LEVEL_2'))) return 'L2';
  if (failsafeLevel && failsafeLevel.includes('LEVEL_1')) return 'L1';
  return 'L0';
}

// Full literal class strings per tone so Tailwind's scanner emits them
// (dynamic `text-${tone}` template classes would be purged).
const TONE = {
  safe: { chip: 'text-safe bg-safe/10 border-safe/40', dot: 'bg-safe', activeBtn: 'text-safe bg-safe/10 border border-safe/40', pulse: 'rgb(var(--accent-safe) / 0.55)' },
  caution: { chip: 'text-caution bg-caution/10 border-caution/40', dot: 'bg-caution', activeBtn: 'text-caution bg-caution/10 border border-caution/40', pulse: 'rgb(var(--accent-caution) / 0.55)' },
  critical: { chip: 'text-critical bg-critical/10 border-critical/40', dot: 'bg-critical', activeBtn: 'text-critical bg-critical/10 border border-critical/40', pulse: 'rgb(var(--accent-critical) / 0.55)' },
  interactive: { chip: 'text-interactive bg-interactive/10 border-interactive/40', dot: 'bg-interactive', activeBtn: 'text-interactive bg-interactive/10 border border-interactive/40', pulse: 'rgb(var(--accent-interactive) / 0.55)' },
};

const LEVEL_META = {
  L0: { tone: 'safe', label: 'MODEL L0 NOMINAL', icon: ShieldCheck },
  L1: { tone: 'caution', label: 'MODEL L1 STALE-DATA CASE', icon: Activity },
  L2: { tone: 'caution', label: 'MODEL L2 FALLBACK RECOMMENDATION', icon: Radio },
  L3: { tone: 'critical', label: 'MODEL L3 STOP RECOMMENDATION', icon: AlertTriangle },
};

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
}) {
  const level = resolveLevel(failsafeLevel, isModbusSevered);
  const meta = LEVEL_META[level];

  // Dynamic 4-Level Supervisory Safety Machine Badge.
  // Keyed on `level` so it re-mounts and re-runs the one-shot sweep/pulse on change.
  const renderSupervisoryBadge = () => {
    const Icon = meta.icon;
    const tone = TONE[meta.tone];
    const isL3 = level === 'L3';
    return (
      <div
        key={level}
        className={`vs-badge-change chip ${tone.chip} px-3 py-1 text-xs font-bold ${isL3 ? 'vs-estop' : ''}`}
        style={{ '--pulse-color': tone.pulse }}
        role="status"
        aria-label={`Supervisory ${level}`}
      >
        <span
          className={`w-2 h-2 rounded-full ${tone.dot} ${
            isL3 ? 'animate-ping' : level === 'L2' || level === 'L0' ? 'animate-pulse' : ''
          }`}
        />
        <Icon className="w-3.5 h-3.5" />
        <span className="tracking-wider">{meta.label}</span>
      </div>
    );
  };

  const scenarios = [
    {
      id: 'SCENARIO_A_BASELINE_FAILURE',
      label: 'Scenario A (Freeze)',
      hint: 'Synthetic freeze stress case → modeled compressive rod load',
      icon: AlertTriangle,
      tone: 'critical',
    },
    {
      id: 'SCENARIO_B_COUPLED_TWIN',
      label: 'Scenario B (Advisory)',
      hint: 'Reduced-order governor stress case → compare modeled tension margin',
      icon: ShieldCheck,
      tone: 'safe',
    },
    {
      id: 'SCENARIO_C_TELEMETRY_SEVERED',
      label: 'Telemetry-Loss Case',
      hint: 'Synthetic telemetry timeout (>60 s) → L2 fallback advisory',
      icon: Radio,
      tone: 'caution',
    },
    {
      id: 'DEFAULT_OPERATION',
      label: 'Reset',
      hint: 'Restore the nominal synthetic demonstration case',
      icon: RotateCcw,
      tone: 'interactive',
    },
  ];

  return (
    <header className="theme-transition bg-surface-1 border-b border-hairline sticky top-0 z-30">
      {/* Primary SCADA Top Bar */}
      <div className="max-w-[1780px] mx-auto px-4 lg:px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Brand & Asset Attribution */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-interactive/10 border border-interactive/30 flex items-center justify-center">
            <Zap className="w-5 h-5 text-interactive" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-sm text-ink tracking-tight">VectroSync CSS-SRP Advisory Twin</span>
              <span className="chip text-interactive bg-interactive/10 border-interactive/30">RESEARCH PROTOTYPE</span>
              <span className="hidden sm:inline-flex chip text-muted bg-surface-2 border-hairline">CSS+SRP ADVISORY MODEL</span>
            </div>
            <div className="readout text-[11px] text-faint mt-0.5 leading-relaxed">
              Synthetic case asset: Well #14 · Baghewala-inspired basin assumptions · no operator affiliation or field deployment
            </div>
          </div>
        </div>

        {/* Right: Diagnostics, Supervisory Badge, Controls, Theme */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap md:justify-end">
          {/* Edge Controller Solve Time */}
          <div
            className="chip text-muted bg-surface-2 border-hairline"
            title="Backend-reported model solve time, or measured API round-trip when unavailable"
          >
            <Cpu className="w-3.5 h-3.5 text-interactive" />
            <span className="text-faint">MODEL RESPONSE</span>
            <span className="font-bold text-ink">
              {typeof edgeSolveTimeMs === 'number' ? edgeSolveTimeMs.toFixed(1) : edgeSolveTimeMs}ms
            </span>
          </div>

          {/* Bus Architecture & Port Status */}
          <div
            className={`chip ${
              isModbusSevered ? 'text-critical bg-critical/10 border-critical/40' : 'text-muted bg-surface-2 border-hairline'
            }`}
          >
            <Server
              className={`w-3.5 h-3.5 ${
                isModbusSevered ? 'text-critical animate-ping' : isWsLive ? 'text-safe' : 'text-faint'
              }`}
            />
            <span>BUS: MODBUS-TCP</span>
            <span className="inline-flex items-center gap-1 font-bold">
              {isWsLive && !isModbusSevered && <span className="w-1.5 h-1.5 rounded-full bg-safe vs-live-dot" />}
              {isModbusSevered ? 'LOSS CASE' : isWsLive ? 'STREAM CONNECTED' : 'LOCAL LOOP'}
            </span>
          </div>

          {/* Multi-Fidelity Solver Mode Toggle */}
          <button
            type="button"
            onClick={onToggleSolverType}
            className={`chip btn ${
              solverType === 'transient'
                ? 'text-interactive bg-interactive/10 border-interactive/40'
                : 'text-muted bg-surface-2 border-hairline hover:text-ink'
            }`}
            title="Toggle between Fast Surrogate (~2 ms) and Full Transient Wave Solver (~150 ms)"
          >
            <Activity className={`w-3.5 h-3.5 ${solverType === 'transient' ? 'text-interactive' : 'text-faint'}`} />
            <span className="text-faint">SOLVER</span>
            <span className={solverType === 'transient' ? 'text-interactive font-bold' : 'text-ink'}>
              {solverType === 'transient' ? 'TRANSIENT PDE' : 'FAST SURROGATE'}
            </span>
          </button>

          {/* Supervisory Badge */}
          {renderSupervisoryBadge()}

          {/* Kinematic Clock Controller */}
          <div className="flex items-center bg-surface-2 rounded-lg p-0.5 border border-hairline text-xs">
            <button
              type="button"
              aria-pressed={isPlaying}
              aria-label={isPlaying ? 'Pause schematic animation' : 'Play schematic animation'}
              onClick={onTogglePlay}
              className={`btn px-2 py-0.5 rounded-md text-[11px] ${
                isPlaying ? 'bg-surface-1 border border-hairline text-interactive' : 'text-muted hover:text-ink'
              }`}
              title={isPlaying ? 'Pause schematic animation' : 'Play schematic animation'}
            >
              {isPlaying ? <Pause className="w-3 h-3 text-interactive" /> : <Play className="w-3 h-3 text-safe" />}
              <span>{isPlaying ? 'ANIMATE' : 'PAUSED'}</span>
            </button>

            <div className="flex items-center gap-0.5 px-1 border-l border-hairline ml-1">
              {[1, 2, 5].map((spd) => (
                <button
                  type="button"
                  key={spd}
                  aria-pressed={simSpeed === spd}
                  aria-label={`Set animation speed to ${spd} times`}
                  onClick={() => onChangeSpeed(spd)}
                  className={`btn px-1.5 py-0.5 rounded text-[10.5px] ${
                    simSpeed === spd ? 'bg-surface-1 border border-hairline text-interactive' : 'text-muted hover:text-ink'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>

          {/* Disturbance Cockpit Trigger */}
          <button
            type="button"
            onClick={onToggleDrawer}
            className="btn px-3 py-1.5 bg-interactive text-white hover:bg-interactive/90 text-xs"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>CASE INPUTS</span>
          </button>

          {/* Theme toggle */}
          <ThemeToggle />
        </div>
      </div>

      {/* 1-Click Scenario Execution Ribbon */}
      <div className="theme-transition bg-surface-2 border-t border-hairline px-4 lg:px-6 py-2">
        <div className="max-w-[1780px] mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-interactive" />
            <span className="section-title text-muted">Run synthetic scenario</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {scenarios.map((sc) => {
              const isActive = scenarioId === sc.id;
              const Icon = sc.icon;
              return (
                <button
                  type="button"
                  key={sc.id}
                  aria-pressed={isActive}
                  aria-label={`${sc.label}. ${sc.hint}`}
                  onClick={() => onApplyScenario(sc.id)}
                  disabled={loading}
                  title={sc.hint}
                  className={`btn px-3 py-1 text-xs ${
                    isActive
                      ? TONE[sc.tone].activeBtn
                      : 'bg-surface-1 border border-hairline text-muted hover:text-ink'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{sc.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
}

export default ScadaHeader;
