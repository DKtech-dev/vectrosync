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
  Zap
} from 'lucide-react';

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
  // Dynamic 4-Level Supervisory Safety Machine Badge
  const renderSupervisoryBadge = () => {
    // Render only the supervisory state returned by the backend model.
    if (failsafeLevel && failsafeLevel.includes('LEVEL_3')) {
      return (
        <div className="flex items-center gap-2 px-3 py-1 bg-rose-50 border border-rose-400 text-rose-700 text-xs font-mono font-bold rounded-md scada-pulse-estop">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping"></span>
          <span className="tracking-wider">MODEL L3 STOP RECOMMENDATION</span>
        </div>
      );
    }
    // Level 2: Protective Fallback (Modbus severed or tension violation -> ramp to 2.0 SPM)
    if (isModbusSevered || (failsafeLevel && failsafeLevel.includes('LEVEL_2'))) {
      return (
        <div className="flex items-center gap-2 px-3 py-1 bg-orange-50 border border-orange-400 text-orange-800 text-xs font-mono font-bold rounded-md">
          <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
          <span className="tracking-wider">MODEL L2 FALLBACK RECOMMENDATION</span>
        </div>
      );
    }
    // Level 1: Degraded Surveillance (Telemetry age 10s-60s)
    if (failsafeLevel && failsafeLevel.includes('LEVEL_1')) {
      return (
        <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-400 text-amber-800 text-xs font-mono font-bold rounded-md">
          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          <span className="tracking-wider">MODEL L1 STALE-DATA CASE</span>
        </div>
      );
    }
    // Level 0: Nominal Operation
    return (
      <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-400 text-emerald-800 text-xs font-mono font-bold rounded-md">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <span className="tracking-wider">MODEL L0 NOMINAL</span>
      </div>
    );
  };

  const scenarios = [
    { 
      id: 'SCENARIO_A_BASELINE_FAILURE', 
      label: 'Scenario A (Freeze)', 
      hint: 'Synthetic freeze stress case → modeled compressive rod load',
      icon: AlertTriangle, 
      color: 'hover:bg-rose-50 hover:border-rose-400 text-rose-700',
      activeColor: 'bg-rose-100 border-rose-500 text-rose-800 shadow-sm font-bold ring-1 ring-rose-400'
    },
    { 
      id: 'SCENARIO_B_COUPLED_TWIN', 
      label: 'Scenario B (Advisory)',
      hint: 'Reduced-order governor stress case → compare modeled tension margin',
      icon: ShieldCheck, 
      color: 'hover:bg-sky-50 hover:border-sky-400 text-sky-700',
      activeColor: 'bg-sky-100 border-sky-500 text-sky-800 shadow-sm font-bold ring-1 ring-sky-400'
    },
    { 
      id: 'SCENARIO_C_TELEMETRY_SEVERED', 
      label: 'Telemetry-Loss Case',
      hint: 'Synthetic telemetry timeout (>60 s) → L2 fallback advisory',
      icon: Radio, 
      color: 'hover:bg-amber-50 hover:border-amber-400 text-amber-800',
      activeColor: 'bg-amber-100 border-amber-500 text-amber-900 shadow-sm font-bold ring-1 ring-amber-400'
    },
    { 
      id: 'DEFAULT_OPERATION', 
      label: 'Reset', 
      hint: 'Restore the nominal synthetic demonstration case',
      icon: RotateCcw, 
      color: 'hover:bg-slate-100 hover:border-slate-400 text-slate-700',
      activeColor: 'bg-slate-200 border-slate-400 text-slate-900 shadow-sm font-bold'
    },
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      {/* Primary SCADA Top Bar */}
      <div className="max-w-[1780px] mx-auto px-4 lg:px-6 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Enterprise Brand & Asset Attribution */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center font-mono font-bold text-xs text-sky-600 shadow-xs">
            <Zap className="w-5 h-5 text-sky-600" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-sm text-slate-900 tracking-tight font-sans">
                VectroSync CSS-SRP Advisory Twin
              </span>
              <span className="px-2 py-0.5 rounded text-[10.5px] font-mono font-bold bg-sky-50 text-sky-700 border border-sky-200">
                RESEARCH PROTOTYPE
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10.5px] font-mono font-medium bg-slate-100 text-slate-600 border border-slate-200">
                CSS+SRP ADVISORY MODEL
              </span>
            </div>
            <div className="text-[11px] text-slate-500 font-mono tracking-tight mt-0.5 leading-relaxed">
              Synthetic case asset: Well #14 · Baghewala-inspired basin assumptions · no operator affiliation or field deployment
            </div>
          </div>
        </div>

        {/* Right: Live Diagnostics, Supervisory Badge, Kinematic Controls, Cockpit */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap md:justify-end">
          {/* Diagnostic Indicator 1: Edge Controller Solve Time */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-[11px] font-mono tabular-nums text-slate-700" title="Backend-reported model solve time, or measured API round-trip when unavailable">
            <Cpu className="w-3.5 h-3.5 text-sky-600" />
            <span className="text-slate-500">MODEL RESPONSE:</span>
            <span className="font-bold text-sky-700">{typeof edgeSolveTimeMs === 'number' ? edgeSolveTimeMs.toFixed(1) : edgeSolveTimeMs}ms</span>
          </div>

          {/* Diagnostic Indicator 2: Bus Architecture & Port Status */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-mono ${
            isModbusSevered 
              ? 'border-rose-300 bg-rose-50 text-rose-800' 
              : 'border-slate-200 bg-slate-50 text-slate-700'
          }`}>
            <Server className={`w-3.5 h-3.5 ${isModbusSevered ? 'text-rose-600 animate-ping' : isWsLive ? 'text-emerald-600' : 'text-slate-500'}`} />
            <span>BUS: MODBUS-TCP</span>
            <span className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold ${
              isModbusSevered 
                ? 'bg-rose-200 text-rose-800' 
                : isWsLive 
                  ? 'bg-emerald-100 text-emerald-800' 
                  : 'bg-slate-200 text-slate-700'
            }`}>
              {isModbusSevered ? 'LOSS CASE' : isWsLive ? 'STREAM CONNECTED' : 'LOCAL LOOP'}
            </span>
          </div>

          {/* Diagnostic Indicator 3: Multi-Fidelity Wave Solver Mode Toggle */}
          <button
            type="button"
            onClick={onToggleSolverType}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-mono transition cursor-pointer ${
              solverType === 'transient'
                ? 'border-indigo-400 bg-indigo-50 text-indigo-800 font-bold shadow-xs'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
            title="Click to toggle between Fast Surrogate (~2 ms) and Full Transient Wave Solver (~150 ms)"
          >
            <Activity className={`w-3.5 h-3.5 ${solverType === 'transient' ? 'text-indigo-600' : 'text-sky-600'}`} />
            <span className="text-slate-500">SOLVER:</span>
            <span className={solverType === 'transient' ? 'text-indigo-700 font-bold' : 'text-slate-800'}>
              {solverType === 'transient' ? 'TRANSIENT PDE' : 'FAST SURROGATE'}
            </span>
          </button>

          {/* Dynamic 4-Level Supervisory Safety Machine Badge */}
          {renderSupervisoryBadge()}

          {/* Kinematic Clock Controller */}
          <div className="flex items-center bg-slate-100 rounded-md p-0.5 border border-slate-200 text-xs font-mono">
            <button
              type="button"
              aria-pressed={isPlaying}
              aria-label={isPlaying ? 'Pause schematic animation' : 'Play schematic animation'}
              onClick={onTogglePlay}
              className={`px-2 py-0.5 rounded flex items-center gap-1 transition ${
                isPlaying ? 'bg-white shadow-xs border border-slate-200 text-sky-700 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
              title={isPlaying ? 'Pause schematic animation' : 'Play schematic animation'}
            >
              {isPlaying ? <Pause className="w-3 h-3 text-sky-600" /> : <Play className="w-3 h-3 text-emerald-600" />}
              <span>{isPlaying ? 'ANIMATE' : 'PAUSED'}</span>
            </button>

            <div className="flex items-center gap-0.5 px-1 border-l border-slate-200 ml-1">
              {[1, 2, 5].map((spd) => (
                <button
                  type="button"
                  key={spd}
                  aria-pressed={simSpeed === spd}
                  aria-label={`Set animation speed to ${spd} times`}
                  onClick={() => onChangeSpeed(spd)}
                  className={`px-1.5 py-0.5 rounded text-[10.5px] transition ${
                    simSpeed === spd ? 'bg-white font-bold text-sky-700 shadow-xs border border-slate-200' : 'text-slate-500 hover:text-slate-800'
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
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold font-mono rounded-md transition shadow-xs"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-white" />
            <span>CASE INPUTS</span>
          </button>
        </div>
      </div>

      {/* 1-Click Scenario Execution Ribbon */}
      <div className="bg-slate-100/90 border-t border-slate-200 px-4 lg:px-6 py-2">
        <div className="max-w-[1780px] mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-sky-600" />
            <span className="text-[11px] font-mono font-bold text-slate-600 uppercase tracking-wider">
              RUN SYNTHETIC SCENARIO:
            </span>
          </div>

          {/* 1-Click Scenario Execution Button Strip */}
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
                  className={`px-3 py-1 text-xs font-mono font-bold rounded-md border transition flex items-center gap-1.5 shadow-xs ${
                    isActive
                      ? sc.activeColor
                      : `bg-white border-slate-300 text-slate-700 ${sc.color}`
                  } ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
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
