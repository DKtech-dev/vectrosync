import React, { useState, useEffect } from 'react';
import { ScadaHeader } from './components/ScadaHeader';
import { MetricCards } from './components/MetricCards';
import { WellboreSimulator } from './components/WellboreSimulator';
import { DynacardStudio } from './components/DynacardStudio';
import { DepthStressHeatmap } from './components/DepthStressHeatmap';
import { ForecastPanel } from './components/ForecastPanel';
import { BasinMap } from './components/BasinMap';
import { CsvIngestor } from './components/CsvIngestor';
import { AuditLedgerView } from './components/AuditLedgerView';
import { WhyEngineConsole } from './components/WhyEngineConsole';
import { EconomicsWaterfall } from './components/EconomicsWaterfall';
import { ParameterDrawer } from './components/ParameterDrawer';
import { Activity, Layers, TrendingUp, Map, UploadCloud, Shield, CheckCircle2, AlertOctagon } from 'lucide-react';
import { apiFetch } from './utils/api';

const DEFAULT_PARAMS = {
  cooling_multiplier: 1.0,
  elapsed_days: 12.0,
  target_spm: 4.7,
  water_cut: 0.30,
  steam_quality: 0.75,
  plunger_sand_wear: 0.0,
  stroke_length_m: 2.54,
  mpc_enabled: true,
  modbus_severed: false,
  solver_type: 'surrogate',
};

export default function App() {
  const [activeTab, setActiveTab] = useState('dynacard');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isWsLive, setIsWsLive] = useState(false);
  const [simSpeed, setSimSpeed] = useState(1);
  const [simParams, setSimParams] = useState(DEFAULT_PARAMS);
  const [simState, setSimState] = useState(null);
  const [edgeSolveTimeMs, setEdgeSolveTimeMs] = useState(3.2);
  const [error, setError] = useState(null);

  const handleToggleSolverType = () => {
    const nextType = simParams.solver_type === 'transient' ? 'surrogate' : 'transient';
    const updated = { ...simParams, solver_type: nextType };
    setSimParams(updated);
    loadSimulation(updated);
  };

  // Fetch simulation state from backend
  const loadSimulation = async (paramsToRun) => {
    setLoading(true);
    setError(null);
    const tStart = performance.now();
    try {
      const res = await apiFetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paramsToRun),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || `Simulation request failed (${res.status})`);
      const tEnd = performance.now();
      const roundtripMs = Math.max(1.2, tEnd - tStart);
      setEdgeSolveTimeMs(data?.solve_time_ms ?? roundtripMs);
      setSimState(data);
    } catch (err) {
      console.error('Simulation fetch error:', err);
      setError(err.message || 'The simulation service is unavailable.');
    } finally {
      setLoading(false);
    }
  };

  // Apply Scenario Preset
  const handleApplyScenario = async (scenarioId) => {
    setLoading(true);
    setError(null);
    const tStart = performance.now();
    try {
      const res = await apiFetch(`/api/scenarios/${scenarioId}/apply`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || `Scenario request failed (${res.status})`);
      const tEnd = performance.now();
      const roundtripMs = Math.max(1.4, tEnd - tStart);
      setEdgeSolveTimeMs(data?.solve_time_ms ?? roundtripMs);
      setSimState(data);

      if (scenarioId === 'SCENARIO_A_BASELINE_FAILURE') {
        setSimParams((prev) => ({ ...prev, cooling_multiplier: 2.2, elapsed_days: 490.94, target_spm: 4.7, modbus_severed: false }));
      } else if (scenarioId === 'SCENARIO_B_COUPLED_TWIN') {
        setSimParams((prev) => ({ ...prev, cooling_multiplier: 2.2, elapsed_days: 490.94, target_spm: 4.7, modbus_severed: false }));
      } else if (scenarioId === 'SCENARIO_C_TELEMETRY_SEVERED') {
        setSimParams((prev) => ({ ...prev, modbus_severed: true }));
      } else {
        setSimParams(DEFAULT_PARAMS);
      }
    } catch (err) {
      console.error('Scenario apply error:', err);
      setError(err.message || 'The scenario could not be applied.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSimulation(simParams);
  }, []);

  const handleChangeParam = (key, value) => {
    setSimParams((prev) => ({ ...prev, [key]: value }));
  };

  const handleApplyCustomParams = () => {
    setIsDrawerOpen(false);
    loadSimulation(simParams);
  };

  const handleResetParams = () => {
    setSimParams(DEFAULT_PARAMS);
    loadSimulation(DEFAULT_PARAMS);
  };

  // Technical Tab Navigation
  const tabs = [
    { id: 'dynacard', label: 'Reduced-Order Dynacard', icon: Activity },
    { id: 'stress', label: 'Modeled Depth-Stress Map', icon: Layers },
    { id: 'forecast', label: '12-Hour Model Projection', icon: TrendingUp },
    { id: 'basin', label: 'Synthetic Sector Layout', icon: Map },
    { id: 'csv', label: 'CSV Engineering Preview', icon: UploadCloud },
    { id: 'audit', label: 'Application Hash Ledger', icon: Shield },
  ];

  const handleTabKeyDown = (event, currentIndex) => {
    let nextIndex = null;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    setActiveTab(tabs[nextIndex].id);
    requestAnimationFrame(() => document.getElementById(`tab-${tabs[nextIndex].id}`)?.focus());
  };

  return (
    <div className="theme-transition min-h-screen bg-canvas text-ink flex flex-col font-sans antialiased">
      {/* Top SCADA Industrial Mission Control Header */}
      <ScadaHeader
        scenarioId={simState?.scenario_id}
        failsafeLevel={simState?.failsafe_level}
        isModbusSevered={simState?.is_modbus_severed || simParams.modbus_severed}
        onApplyScenario={handleApplyScenario}
        onToggleDrawer={() => setIsDrawerOpen(true)}
        loading={loading}
        isPlaying={isPlaying}
        onTogglePlay={() => setIsPlaying(!isPlaying)}
        simSpeed={simSpeed}
        onChangeSpeed={(spd) => setSimSpeed(spd)}
        currentSpm={simState?.effective_spm || 4.7}
        edgeSolveTimeMs={edgeSolveTimeMs}
        isWsLive={isWsLive}
        solverType={simParams.solver_type || 'surrogate'}
        onToggleSolverType={handleToggleSolverType}
      />

      {/* Main SCADA Workspace Container */}
      <main aria-busy={loading} className="flex-1 max-w-[1780px] w-full mx-auto p-4 lg:p-6 space-y-4">
        <div role="status" className="chip w-full justify-between bg-caution/10 border border-caution/30 text-caution rounded-lg p-3 text-xs flex flex-wrap gap-2">
          <strong className="section-title text-caution">Research prototype · Synthetic model output · Advisory only</strong>
          <span className="font-sans font-normal text-muted">No field/HIL validation and no direct PLC/VFD control authority.</span>
        </div>

        {error && (
          <div role="alert" className="bg-critical/10 border border-critical/40 rounded-lg p-3 text-sm text-ink flex items-center justify-between gap-3">
            <span>{error}</span>
            <button type="button" onClick={() => loadSimulation(simParams)} className="font-semibold text-critical underline underline-offset-2 rounded">Retry</button>
          </div>
        )}

        {/* Active Scenario Banner */}
        {simState?.scenario_name && (
          <div className="panel p-3 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="readout font-bold text-interactive">{simState.scenario_name}:</span>
              <span className="text-muted font-sans">
                {simState.scenario_id === 'SCENARIO_A_BASELINE_FAILURE' &&
                  `Synthetic freeze stress case: reduced-order model returns ${simState.temperature_c.toFixed(1)}°C and ${simState.actual_min_tension_kn.toFixed(2)} kN minimum tension.`}
                {simState.scenario_id === 'SCENARIO_B_COUPLED_TWIN' &&
                  `Constraint-aware advisory case: modeled speed ${simState.effective_spm.toFixed(2)} SPM and minimum tension ${simState.actual_min_tension_kn.toFixed(2)} kN.`}
                {simState.scenario_id === 'SCENARIO_C_TELEMETRY_SEVERED' &&
                  'Synthetic telemetry timeout (>60 s) triggers the Level 2 protective 2.0 SPM fallback advisory.'}
                {simState.scenario_id === 'DEFAULT_OPERATION' &&
                  'Synthetic nominal case for exploring the reduced-order thermal, rheology, and rod-load assumptions.'}
              </span>
            </div>
            <span className="chip text-muted bg-surface-2 border-hairline shrink-0">
              Illustrative strata/depth assumption: 1,150 m TVD
            </span>
          </div>
        )}

        {/* 4-KPI Primary Metric Strip */}
        {simState && (
          <div className="vs-enter" style={{ animationDelay: '0ms' }}>
          <MetricCards
            temperatureC={simState.temperature_c}
            viscosityCp={simState.viscosity_cp}
            dragBeta={simState.drag_beta}
            minTensionKn={simState.actual_min_tension_kn}
            effectiveSpm={simState.effective_spm}
            targetSpm={simState.target_spm}
            isBuckling={simState.is_buckling_active}
            elapsedDays={simParams.elapsed_days}
          />
          </div>
        )}

        {/* Center 2-Column Split: Wellbore Simulator (Left) + Multi-Tab Engineering Workspace (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Left Column (5/12): Subsurface Digital Twin Engine */}
          <div className="lg:col-span-5 h-full vs-enter" style={{ animationDelay: '40ms' }}>
            {simState && (
              <WellboreSimulator
                spm={simState.effective_spm}
                temperatureC={simState.temperature_c}
                minTensionKn={simState.actual_min_tension_kn}
                isBuckling={simState.is_buckling_active}
                isModbusSevered={simState.is_modbus_severed}
                failsafeLevel={simState.failsafe_level}
                isPlaying={isPlaying}
                simSpeed={simSpeed}
                stressHeatmap={simState.stress_heatmap}
                dynacard={simState.dynacard}
                onWsStatusChange={setIsWsLive}
              />
            )}
          </div>

          {/* Right Column (7/12): Multi-Tab Engineering Console */}
          <div className="lg:col-span-7 panel p-4 flex flex-col justify-between vs-enter" style={{ animationDelay: '80ms' }}>
            {/* Underline-Style Active Tab Bar */}
            <div role="tablist" aria-label="Engineering analysis views" className="flex border-b border-hairline gap-1 mb-3 overflow-x-auto">
              {tabs.map((tab, tabIndex) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    id={`tab-${tab.id}`}
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`panel-${tab.id}`}
                    tabIndex={isActive ? 0 : -1}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    onKeyDown={(event) => handleTabKeyDown(event, tabIndex)}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition whitespace-nowrap rounded-t ${
                      isActive
                        ? 'border-interactive text-interactive font-bold bg-interactive/10'
                        : 'border-transparent text-muted hover:text-ink hover:border-hairline'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Active Tab Content */}
            <div id={`panel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`} tabIndex="0" className="min-h-[470px]">
              {activeTab === 'dynacard' && simState && (
                <DynacardStudio
                  dynacard={simState.dynacard}
                  isBuckling={simState.is_buckling_active}
                  minTensionKn={simState.actual_min_tension_kn}
                />
              )}

              {activeTab === 'stress' && simState && (
                <DepthStressHeatmap
                  stressHeatmap={simState.stress_heatmap}
                  isBuckling={simState.is_buckling_active}
                />
              )}

              {activeTab === 'forecast' && simState && (
                <ForecastPanel forecast12h={simState.forecast_12h} />
              )}

              {activeTab === 'basin' && simState && (
                <BasinMap
                  currentTempC={simState.temperature_c}
                  currentSpm={simState.effective_spm}
                />
              )}

              {activeTab === 'csv' && <CsvIngestor />}

              {activeTab === 'audit' && <AuditLedgerView />}
            </div>
          </div>
        </div>

        {/* Bottom Strategic Intelligence: Why Engine & Economics Waterfall */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-1">
          {/* Causal Reasoning Diagnostic Console */}
          {simState && (
            <div className="vs-enter" style={{ animationDelay: '120ms' }}>
              <WhyEngineConsole
                diagnostics={simState.diagnostics}
                isBuckling={simState.is_buckling_active}
              />
            </div>
          )}

          {/* Unvalidated multi-well planning-case economics */}
          {simState && (
            <div className="vs-enter" style={{ animationDelay: '160ms' }}>
              <EconomicsWaterfall economics={simState.economics} />
            </div>
          )}
        </div>
      </main>

      {/* Parameter Control Drawer */}
      <ParameterDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        params={simParams}
        onChangeParam={handleChangeParam}
        onApply={handleApplyCustomParams}
        onReset={handleResetParams}
        loading={loading}
      />

      {/* Technical Enterprise SCADA Footer */}
      <footer className="theme-transition bg-surface-1 border-t border-hairline py-3 px-6 text-[11px] text-faint readout mt-auto">
        <div className="max-w-[1780px] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <span>Baghewala-inspired research case study &middot; No operator affiliation or deployment implied</span>
            <span className="mx-2 text-hairline">&middot;</span>
            <span className="text-interactive font-bold">VectroSync Advisory Research Prototype</span>
          </div>
          <div className="flex items-center gap-3 text-[10.5px]">
            <span className="text-caution font-semibold">Synthetic · Reduced-order · Advisory only</span>
            <span className="text-hairline">&middot;</span>
            <span>FastAPI + React 18 + deterministic card surrogate</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
