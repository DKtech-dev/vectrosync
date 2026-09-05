import React, { useState, useEffect, useRef } from 'react';
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
};

export default function App() {
  const [activeTab, setActiveTab] = useState('dynacard');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [simSpeed, setSimSpeed] = useState(1);
  const [simParams, setSimParams] = useState(DEFAULT_PARAMS);
  const [simState, setSimState] = useState(null);
  const [edgeSolveTimeMs, setEdgeSolveTimeMs] = useState(3.2);

  // Fetch simulation state from backend
  const loadSimulation = async (paramsToRun) => {
    setLoading(true);
    const tStart = performance.now();
    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paramsToRun),
      });
      const data = await res.json();
      const tEnd = performance.now();
      const roundtripMs = Math.max(1.2, tEnd - tStart);
      setEdgeSolveTimeMs(data?.edge_solve_time_ms || data?.solve_time_ms || roundtripMs);
      setSimState(data);
    } catch (err) {
      console.error('Simulation fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Apply Scenario Preset
  const handleApplyScenario = async (scenarioId) => {
    setLoading(true);
    const tStart = performance.now();
    try {
      const res = await fetch(`/api/scenarios/${scenarioId}/apply`, {
        method: 'POST',
      });
      const data = await res.json();
      const tEnd = performance.now();
      const roundtripMs = Math.max(1.4, tEnd - tStart);
      setEdgeSolveTimeMs(data?.edge_solve_time_ms || data?.solve_time_ms || roundtripMs);
      setSimState(data);

      if (scenarioId === 'SCENARIO_A_BASELINE_FAILURE') {
        setSimParams((prev) => ({ ...prev, cooling_multiplier: 2.2, elapsed_days: 16.0, target_spm: 4.7, modbus_severed: false }));
      } else if (scenarioId === 'SCENARIO_B_COUPLED_TWIN') {
        setSimParams((prev) => ({ ...prev, cooling_multiplier: 2.2, elapsed_days: 16.0, target_spm: 4.7, modbus_severed: false }));
      } else if (scenarioId === 'SCENARIO_C_TELEMETRY_SEVERED') {
        setSimParams((prev) => ({ ...prev, modbus_severed: true }));
      } else {
        setSimParams(DEFAULT_PARAMS);
      }
    } catch (err) {
      console.error('Scenario apply error:', err);
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
    { id: 'dynacard', label: 'Dynamometer P-V Loop Studio', icon: Activity },
    { id: 'stress', label: 'Spatiotemporal Depth-Stress Map', icon: Layers },
    { id: 'forecast', label: '12-Hour Multi-Physics Horizon', icon: TrendingUp },
    { id: 'basin', label: 'Geospatial Basin Sector (23 Wells)', icon: Map },
    { id: 'csv', label: 'SCADA Telemetry Ingestion', icon: UploadCloud },
    { id: 'audit', label: 'SHA-256 Provenance Ledger', icon: Shield },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans antialiased">
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
      />

      {/* Main SCADA Workspace Container */}
      <main className="flex-1 max-w-[1780px] w-full mx-auto p-4 lg:p-6 space-y-4">
        {/* Active Scenario Banner */}
        {simState?.scenario_name && (
          <div className="bg-white border border-slate-200 rounded-lg shadow-xs p-3 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-sky-700">{simState.scenario_name}:</span>
              <span className="text-slate-700 font-sans">
                {simState.scenario_id === 'SCENARIO_A_BASELINE_FAILURE' &&
                  '16-day unmitigated thermal decay to ~50°C causing heavy crude viscosity surge (>12,000 cP) and downhole compressive rod float (< 0.0 kN).'}
                {simState.scenario_id === 'SCENARIO_B_COUPLED_TWIN' &&
                  'Fast-Loop MPC anticipates viscosity surge ahead of time and proactively modulates speed to ~2.8 SPM, preserving safe tension (+0.65 kN).'}
                {simState.scenario_id === 'SCENARIO_C_TELEMETRY_SEVERED' &&
                  'Modbus TCP cable severance (>60s latency) triggers Level 2 Supervisory protective 3-stroke ramp to safe 2.0 SPM fallback.'}
                {simState.scenario_id === 'DEFAULT_OPERATION' &&
                  'Calibrated nominal operating conditions for Baghewala Well #14 under cyclic steam stimulation.'}
              </span>
            </div>
            <span className="font-mono text-[11px] font-semibold text-slate-600 shrink-0 px-2.5 py-0.5 rounded bg-slate-100 border border-slate-200">
              Jodhpur Sandstone (1,150 m TVD)
            </span>
          </div>
        )}

        {/* 4-KPI Primary Metric Strip */}
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

        {/* Center 2-Column Split: Wellbore Simulator (Left) + Multi-Tab Engineering Workspace (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Left Column (5/12): Subsurface Digital Twin Engine */}
          <div className="lg:col-span-5 h-full">
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
              />
            )}
          </div>

          {/* Right Column (7/12): Multi-Tab Engineering Console */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg shadow-xs p-4 flex flex-col justify-between">
            {/* Underline-Style Active Tab Bar */}
            <div className="flex border-b border-slate-200 gap-1 mb-3 overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-mono font-medium border-b-2 transition whitespace-nowrap rounded-t ${
                      isActive
                        ? 'border-sky-600 text-sky-700 font-bold bg-sky-50'
                        : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Active Tab Content */}
            <div className="min-h-[470px]">
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
            <WhyEngineConsole
              diagnostics={simState.diagnostics}
              isBuckling={simState.is_buckling_active}
            />
          )}

          {/* 23-Well Asset Economics Waterfall */}
          {simState && <EconomicsWaterfall economics={simState.economics} />}
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
      <footer className="bg-[#0b0f17] border-t border-[#1e293b] py-3 px-6 text-[11px] text-slate-400 font-mono mt-auto">
        <div className="max-w-[1780px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <span>Oil India Limited &middot; Baghewala Heavy Oil Asset (Well #14, Bikaner-Nagaur Basin)</span>
            <span className="mx-2 text-slate-600">&middot;</span>
            <span className="text-cyan-400 font-bold">VectroSync Enterprise Industrial Twin</span>
          </div>
          <div className="flex items-center gap-3 text-[10.5px]">
            <span className="text-emerald-400 font-semibold">100% Offline Localhost Architecture</span>
            <span className="text-slate-600">&middot;</span>
            <span>FastAPI + React 18 + Canvas Wave PDE</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
