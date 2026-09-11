import React, { useState, useEffect } from 'react';
import { ScadaHeader } from './components/ScadaHeader';
import { Sidebar } from './components/Sidebar';
import { GaugePanel } from './components/GaugePanel';
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
import { CausalChain } from './components/CausalChain';
import { ABProof } from './components/ABProof';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SkeletonPanel } from './components/Skeleton';
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

  useEffect(() => {
    document.title = 'Console — VectroSync CSS-SRP Advisory Twin';
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
    { id: 'dynacard', label: 'Dynacard', icon: Activity },
    { id: 'stress', label: 'Depth-stress map', icon: Layers },
    { id: 'forecast', label: '12-hour projection', icon: TrendingUp },
    { id: 'basin', label: 'Sector layout', icon: Map },
    { id: 'csv', label: 'CSV preview', icon: UploadCloud },
    { id: 'audit', label: 'Hash ledger', icon: Shield },
  ];

  const handleTabKeyDown = (event, currentIndex) => {
    let nextIndex = null;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    setActiveTab(tabs[nextIndex].id);
    requestAnimationFrame(() => document.getElementById(`tab-${tabs[nextIndex].id}`)?.focus());
  };

  return (
    <ErrorBoundary>
    <div className="min-h-screen bg-canvas text-ink font-sans antialiased p-3 sm:p-5">
      {/* Floating master container */}
      <div className="master flex min-h-[calc(100vh-40px)]">
      {/* Left navigation rail (desktop) */}
      <Sidebar
        tabs={tabs}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onTabKeyDown={handleTabKeyDown}
      />

      <div className="flex-1 min-w-0 flex flex-col content-bed">
      {/* Top bar: asset context, live status, actions, scenario dispatch */}
      <ScadaHeader
        tabs={tabs}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
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

      {/* Main Workspace */}
      <main aria-busy={loading} className="flex-1 w-full p-5 lg:p-6 space-y-5 overflow-x-hidden">
        {error && (
          <div role="alert" className="card border-critical/30 p-4 text-[13px] text-ink flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <span className="pill bg-critical/10 text-critical"><span className="chip-dot" />Link</span>
              {error}
            </span>
            <button type="button" onClick={() => loadSimulation(simParams)} className="btn btn-primary px-4 py-2">Retry</button>
          </div>
        )}

        {/* Active Scenario context line */}
        {simState?.scenario_name && (
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 px-1">
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="text-[13px] font-bold text-interactive shrink-0">{simState.scenario_name}</span>
              <span className="caption">
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
            <span className="caption shrink-0">Synthetic reduced-order output · advisory only · not a measurement</span>
          </div>
        )}

        {/* First load: a visible skeleton instead of a blank page while the
            initial /api/simulate request is in flight or has not resolved. */}
        {!simState && !error && (
          <SkeletonPanel title="Loading VectroSync twin" lines={6} height={360} />
        )}

        {/* Hero: the animated causal chain, steam through to speed command */}
        {simState && (
          <CausalChain
            elapsedDays={simParams.elapsed_days}
            temperatureC={simState.temperature_c}
            viscosityCp={simState.viscosity_cp}
            dragBeta={simState.drag_beta}
            minTensionKn={simState.actual_min_tension_kn}
            effectiveSpm={simState.effective_spm}
            targetSpm={simState.target_spm}
            isBuckling={simState.is_buckling_active}
            propagateKey={simState.scenario_id + simState.effective_spm}
          />
        )}

        {/* 4-KPI Primary Metric Strip */}
        {simState && (
          <div>
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

        {/* Main analytics grid: active view (left) + health gauges & schematic (right) */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          {/* Active analysis view */}
          <div className="xl:col-span-8 card p-5 flex flex-col">
            <div className="flex items-center justify-between gap-3 pb-4 mb-4 border-b border-hairline">
              <div className="flex items-center gap-3 min-w-0">
                {(() => {
                  const ActiveIcon = tabs.find((t) => t.id === activeTab)?.icon;
                  return ActiveIcon ? (
                    <span className="icon-badge w-9 h-9 bg-interactive/10 text-interactive">
                      <ActiveIcon className="w-4 h-4" />
                    </span>
                  ) : null;
                })()}
                <div className="min-w-0">
                  <div className="card-title truncate">{tabs.find((t) => t.id === activeTab)?.label}</div>
                  <div className="caption">Reduced-order model output</div>
                </div>
              </div>
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

          {/* Right summary column: health gauges + wellbore schematic */}
          <div className="xl:col-span-4 flex flex-col gap-5">
            {simState && (
              <GaugePanel
                pprlKn={simState.dynacard?.pprl_kn ?? 0}
                minTensionKn={simState.actual_min_tension_kn}
                isWsLive={isWsLive}
                isModbusSevered={simState.is_modbus_severed || simParams.modbus_severed}
                failsafeLevel={simState.failsafe_level || ''}
              />
            )}

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
        </div>

        {/* Deterministic, re-seedable A/B proof */}
        <ABProof />

        {/* Commercial summary bar */}
        {simState && <EconomicsWaterfall economics={simState.economics} />}

        {/* Conversational explanation surface */}
        {simState && (
          <WhyEngineConsole
            diagnostics={simState.diagnostics}
            isBuckling={simState.is_buckling_active}
          />
        )}
      </main>

      {/* Technical Enterprise SCADA Footer */}
      <footer className="border-t border-hairline py-3 px-6 mt-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <span className="caption">
            Baghewala-inspired research case study &middot; no operator affiliation or deployment implied
          </span>
          <span className="caption">
            Synthetic &middot; reduced-order &middot; advisory only &middot; FastAPI + React 18
          </span>
        </div>
      </footer>
      </div>
      </div>

      {/* Parameter Control Drawer lives at root so it overlays the rail too */}
      <ParameterDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        params={simParams}
        onChangeParam={handleChangeParam}
        onApply={handleApplyCustomParams}
        onReset={handleResetParams}
        loading={loading}
      />
    </div>
    </ErrorBoundary>
  );
}
