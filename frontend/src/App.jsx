import React, { useCallback, useEffect, useState } from 'react';
import { Activity, Layers, TrendingUp, Map, UploadCloud, Shield, Cpu } from 'lucide-react';

import { ScadaHeader } from './components/ScadaHeader';
import { Sidebar } from './components/Sidebar';
import { GaugePanel } from './components/GaugePanel';
import { MetricCards } from './components/MetricCards';
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
import { MachineTheatre } from './machine/MachineTheatre.jsx';
import { apiFetch } from './utils/api';

const DEFAULT_PARAMS = {
  cooling_multiplier: 1.0,
  elapsed_days: 12.0,
  target_spm: 4.7,
  water_cut: 0.3,
  steam_quality: 0.75,
  plunger_sand_wear: 0.0,
  stroke_length_m: 2.54,
  mpc_enabled: true,
  modbus_severed: false,
  solver_type: 'surrogate',
};

const SCENARIO_BLURB = {
  SCENARIO_A_BASELINE_FAILURE: (s) =>
    `Deep-cooldown stress case. The reduced-order model returns ${s.temperature_c?.toFixed(1)} °C sandface and ${s.actual_min_tension_kn?.toFixed(2)} kN minimum tension — below the +0.50 kN anti-float floor.`,
  SCENARIO_B_COUPLED_TWIN: (s) =>
    `Constraint-aware advisory case. The governor advises ${s.effective_spm?.toFixed(2)} SPM and recovers ${s.actual_min_tension_kn?.toFixed(2)} kN of minimum tension.`,
  SCENARIO_C_TELEMETRY_SEVERED: () =>
    'Telemetry timeout beyond 60 s. The supervisory state machine falls back to the Level 2 protective 2.0 SPM advisory without operator input.',
  DEFAULT_OPERATION: () =>
    'Nominal operating point for exploring the thermal, rheological and rod-load assumptions.',
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
  const [edgeSolveTimeMs, setEdgeSolveTimeMs] = useState(null);
  const [error, setError] = useState(null);

  const loadSimulation = useCallback(async (paramsToRun) => {
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
      setEdgeSolveTimeMs(data?.solve_time_ms ?? Math.max(1.2, performance.now() - tStart));
      setSimState(data);
    } catch (err) {
      console.error('Simulation fetch error:', err);
      setError(err.message || 'The simulation service is unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleApplyScenario = useCallback(
    async (scenarioId) => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch(`/api/scenarios/${scenarioId}/apply`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.detail || `Scenario request failed (${res.status})`);
        setEdgeSolveTimeMs(data?.solve_time_ms ?? null);
        setSimState(data);

        // Mirror the preset back into the drawer so the two never disagree.
        if (scenarioId === 'SCENARIO_A_BASELINE_FAILURE' || scenarioId === 'SCENARIO_B_COUPLED_TWIN') {
          setSimParams((p) => ({ ...p, cooling_multiplier: 2.2, elapsed_days: 490.94, target_spm: 4.7, modbus_severed: false }));
        } else if (scenarioId === 'SCENARIO_C_TELEMETRY_SEVERED') {
          setSimParams((p) => ({ ...p, modbus_severed: true }));
        } else {
          setSimParams(DEFAULT_PARAMS);
        }
      } catch (err) {
        console.error('Scenario apply error:', err);
        setError(err.message || 'The scenario could not be applied.');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    loadSimulation(DEFAULT_PARAMS);
  }, [loadSimulation]);

  useEffect(() => {
    document.title = 'Console — Catenary CSS–SRP Advisory Twin';
  }, []);

  const handleChangeParam = (key, value) => setSimParams((prev) => ({ ...prev, [key]: value }));
  const handleApplyCustomParams = () => {
    setIsDrawerOpen(false);
    loadSimulation(simParams);
  };
  const handleResetParams = () => {
    setSimParams(DEFAULT_PARAMS);
    loadSimulation(DEFAULT_PARAMS);
  };
  const handleToggleSolverType = () => {
    const next = { ...simParams, solver_type: simParams.solver_type === 'transient' ? 'surrogate' : 'transient' };
    setSimParams(next);
    loadSimulation(next);
  };

  const tabs = [
    { id: 'dynacard', label: 'Dynamometer cards', icon: Activity },
    { id: 'stress', label: 'Depth–phase stress', icon: Layers },
    { id: 'forecast', label: '12-hour projection', icon: TrendingUp },
    { id: 'basin', label: 'Field layout', icon: Map },
    { id: 'csv', label: 'Telemetry ingest', icon: UploadCloud },
    { id: 'audit', label: 'Provenance ledger', icon: Shield },
  ];

  const handleTabKeyDown = (event, currentIndex) => {
    let next = null;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (currentIndex + 1) % tabs.length;
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next === null) return;
    event.preventDefault();
    setActiveTab(tabs[next].id);
    requestAnimationFrame(() => document.getElementById(`tab-${tabs[next].id}`)?.focus());
  };

  const activeTabMeta = tabs.find((t) => t.id === activeTab);
  const blurb = simState?.scenario_id ? SCENARIO_BLURB[simState.scenario_id]?.(simState) : null;

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-canvas text-ink font-sans antialiased">
        {/* One global disclosure, stated once and prominently, instead of the
            same hedging caption repeated under every panel. */}
        <div className="w-full bg-surface-2 border-b border-hairline px-4 py-1.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">
          <span className="pill tone-caution">
            <span className="chip-dot" />
            Class II advisory
          </span>
          <span className="caption">
            Synthetic reduced-order research prototype · advisory only, non-actuating, not an IEC 61511 safety function ·
            Baghewala-inspired configuration with no operator affiliation or deployment implied
          </span>
        </div>

        <div className="flex min-h-[calc(100vh-30px)]">
          <Sidebar tabs={tabs} activeTab={activeTab} onSelectTab={setActiveTab} onTabKeyDown={handleTabKeyDown} />

          <div className="flex-1 min-w-0 flex flex-col content-bed">
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
              onTogglePlay={() => setIsPlaying((p) => !p)}
              simSpeed={simSpeed}
              onChangeSpeed={setSimSpeed}
              currentSpm={simState?.effective_spm}
              edgeSolveTimeMs={edgeSolveTimeMs}
              isWsLive={isWsLive}
              solverType={simParams.solver_type}
              onToggleSolverType={handleToggleSolverType}
            />

            <main aria-busy={loading} className="flex-1 w-full p-4 lg:p-5 space-y-4 overflow-x-hidden">
              {error && (
                <div role="alert" className="panel tone-critical p-3.5 flex flex-wrap items-center justify-between gap-3">
                  <span className="flex items-center gap-2.5 text-[13px]">
                    <span className="pill tone-critical">
                      <span className="chip-dot" />
                      Link
                    </span>
                    {error}
                  </span>
                  <button type="button" onClick={() => loadSimulation(simParams)} className="btn btn-primary">
                    Retry
                  </button>
                </div>
              )}

              {blurb && (
                <div className="flex flex-col lg:flex-row lg:items-baseline gap-x-3 gap-y-1 px-0.5">
                  <span className="text-[13px] font-bold text-interactive shrink-0">{simState.scenario_name}</span>
                  <span className="caption">{blurb}</span>
                </div>
              )}

              {!simState && !error && <SkeletonPanel title="Solving the twin" lines={6} height={320} />}

              {/* ---- THE MACHINE. Everything else on this page is a readout of
                       what is happening here. ---- */}
              {simState && (
                <MachineTheatre
                  simState={simState}
                  simParams={simParams}
                  isPlaying={isPlaying}
                  onTogglePlay={() => setIsPlaying((p) => !p)}
                  simSpeed={simSpeed}
                  onChangeSpeed={setSimSpeed}
                />
              )}

              {simState && (
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
              )}

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
                  propagateKey={`${simState.scenario_id}-${simState.effective_spm}`}
                />
              )}

              {/* ---- analysis workspace ---- */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
                <div className="xl:col-span-8 panel min-w-0">
                  <div className="panel-rail">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {activeTabMeta?.icon && (
                        <span className="icon-badge tone-signal">
                          <activeTabMeta.icon className="w-3.5 h-3.5" />
                        </span>
                      )}
                      <h2 className="panel-title truncate">{activeTabMeta?.label}</h2>
                    </div>
                    <span className="pill">
                      <Cpu className="w-3 h-3" />
                      {simState?.solver_type === 'transient' ? 'Transient PDE' : 'Surrogate'}
                    </span>
                  </div>

                  <div id={`panel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`} tabIndex={0} className="p-4">
                    {activeTab === 'dynacard' && simState && (
                      <DynacardStudio
                        dynacard={simState.dynacard}
                        isBuckling={simState.is_buckling_active}
                        minTensionKn={simState.actual_min_tension_kn}
                        aiDiagnostics={simState.ai_diagnostics}
                      />
                    )}
                    {activeTab === 'stress' && simState && (
                      <DepthStressHeatmap stressHeatmap={simState.stress_heatmap} isBuckling={simState.is_buckling_active} />
                    )}
                    {activeTab === 'forecast' && simState && <ForecastPanel forecast12h={simState.forecast_12h} />}
                    {activeTab === 'basin' && simState && (
                      <BasinMap currentTempC={simState.temperature_c} currentSpm={simState.effective_spm} />
                    )}
                    {activeTab === 'csv' && <CsvIngestor />}
                    {activeTab === 'audit' && <AuditLedgerView />}
                  </div>
                </div>

                <div className="xl:col-span-4 flex flex-col gap-4 min-w-0">
                  {simState && (
                    <GaugePanel
                      pprlKn={simState.dynacard?.pprl_kn}
                      minTensionKn={simState.actual_min_tension_kn}
                      isWsLive={isWsLive}
                      isModbusSevered={simState.is_modbus_severed || simParams.modbus_severed}
                      failsafeLevel={simState.failsafe_level}
                    />
                  )}
                  {simState && <WhyEngineConsole diagnostics={simState.diagnostics} isBuckling={simState.is_buckling_active} />}
                </div>
              </div>

              <ABProof />
              {simState && <EconomicsWaterfall economics={simState.economics} />}
            </main>

            <footer className="border-t border-hairline py-3 px-5 mt-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <span className="caption">Catenary · physics-informed CSS–SRP advisory twin · FastAPI + React 18</span>
              <span className="caption">
                {simState?.model_status?.data_provenance === 'synthetic' ? 'Synthetic data provenance' : '—'} ·{' '}
                {simState?.control_authority === 'advisory_only_not_for_direct_actuation' ? 'No actuation authority' : '—'}
              </span>
            </footer>
          </div>
        </div>

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
