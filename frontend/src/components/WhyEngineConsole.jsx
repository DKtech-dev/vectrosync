import React from 'react';
import { Terminal, Shield, AlertTriangle } from 'lucide-react';

export function WhyEngineConsole({ diagnostics, isBuckling }) {
  if (!diagnostics) {
    return (
      <div className="hmi-panel p-4 text-xs text-slate-400 font-mono bg-white border border-slate-200 rounded-lg">
        Awaiting synthetic model explanation trace...
      </div>
    );
  }

  const {
    trigger_event,
    forward_horizon,
    dispatched_action,
    structural_outcome,
    provenance_tag,
    timestamp_iso,
  } = diagnostics;

  return (
    <div className={`hmi-panel p-4 flex flex-col justify-between border-l-4 rounded-lg shadow-xs transition ${
      isBuckling ? 'border-l-rose-500 bg-rose-50/40 border-slate-200' : 'border-l-sky-500 bg-white border-slate-200'
    }`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2.5 border-b border-slate-200 mb-3 gap-2">
        <div className="flex items-center gap-2">
          <Terminal className={`w-4 h-4 ${isBuckling ? 'text-rose-600' : 'text-sky-600'}`} />
          <span className="text-xs font-mono font-bold text-slate-800 uppercase tracking-wide">
            Model Explanation Trace &mdash; Synthetic Advisory
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 font-mono text-[10.5px] text-slate-500">
          <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-sky-700 font-medium">
            {provenance_tag}
          </span>
          <span>&middot;</span>
          <span>{timestamp_iso?.slice(11, 19)} UTC</span>
        </div>
      </div>

      {/* 4-Step Diagnostic Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs font-mono">
        {/* Step 1: Trigger Event */}
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 flex flex-col justify-between">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-600"></span>
            1. Model Input Trigger
          </div>
          <p className="text-slate-700 leading-relaxed text-[11px]">{trigger_event}</p>
        </div>

        {/* Step 2: Forward Horizon Assessment */}
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 flex flex-col justify-between">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-600"></span>
            2. Model Horizon Assessment
          </div>
          <p className="text-slate-700 leading-relaxed text-[11px]">{forward_horizon}</p>
        </div>

        {/* Step 3: Advisory recommendation */}
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 flex flex-col justify-between">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1.5 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            3. Recommendation (Not Dispatched)
          </div>
          <p className="text-slate-700 font-medium leading-relaxed text-[11px]">{dispatched_action}</p>
        </div>

        {/* Step 4: Modeled constraint result */}
        <div className={`rounded-lg p-3 border flex flex-col justify-between ${
          isBuckling 
            ? 'bg-rose-50 text-rose-800 border-rose-300' 
            : 'bg-emerald-50 text-emerald-800 border-emerald-300'
        }`}>
          <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1">
            {isBuckling ? <AlertTriangle className="w-3 h-3 text-rose-600" /> : <Shield className="w-3 h-3 text-emerald-600" />}
            4. Modeled Constraint Result
          </div>
          <p className="leading-relaxed text-[11px] font-medium">{structural_outcome}</p>
        </div>
      </div>
      <div className="mt-3 text-[10.5px] font-mono text-slate-600 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5">
        Explanation of reduced-order software outputs only; no action was dispatched and no structural condition or outcome is confirmed.
      </div>
    </div>
  );
}

export default WhyEngineConsole;
