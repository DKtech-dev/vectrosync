import React from 'react';
import { Terminal, Shield, AlertTriangle } from 'lucide-react';
import { SkeletonPanel } from './Skeleton';

export function WhyEngineConsole({ diagnostics, isBuckling }) {
  if (!diagnostics) {
    return <SkeletonPanel title="Awaiting model explanation trace" lines={2} />;
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
    <div className={`panel p-4 flex flex-col justify-between border-l-4 ${
      isBuckling ? 'border-l-critical' : 'border-l-safe'
    }`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-hairline mb-3 gap-2">
        <div className="flex items-center gap-2">
          <Terminal className={`w-4 h-4 ${isBuckling ? 'text-critical' : 'text-safe'}`} />
          <span className="section-title">
            Model Explanation Trace &mdash; Synthetic Advisory
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 readout text-[10.5px] text-muted">
          <span className="chip text-muted bg-surface-2 border-hairline">
            {provenance_tag}
          </span>
          <span>&middot;</span>
          <span className="readout">{timestamp_iso?.slice(11, 19)} UTC</span>
        </div>
      </div>

      {/* 4-Step Diagnostic Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
        {/* Step 1: Trigger Event */}
        <div className="panel-inset p-3 flex flex-col justify-between">
          <div className="text-[11px] text-muted mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-interactive"></span>
            1. Model input trigger
          </div>
          <p className="text-muted leading-relaxed text-[11px]">{trigger_event}</p>
        </div>

        {/* Step 2: Forward Horizon Assessment */}
        <div className="panel-inset p-3 flex flex-col justify-between">
          <div className="text-[11px] text-muted mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-interactive"></span>
            2. Model horizon assessment
          </div>
          <p className="text-muted leading-relaxed text-[11px]">{forward_horizon}</p>
        </div>

        {/* Step 3: Advisory recommendation */}
        <div className="panel-inset p-3 flex flex-col justify-between">
          <div className="text-[11px] text-muted mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-caution"></span>
            3. Recommendation (not dispatched)
          </div>
          <p className="text-ink font-medium leading-relaxed text-[11px]">{dispatched_action}</p>
        </div>

        {/* Step 4: Modeled constraint result */}
        <div className={`rounded-lg p-3 border flex flex-col justify-between ${
          isBuckling
            ? 'bg-critical/10 text-ink border-critical/30'
            : 'bg-safe/10 text-ink border-safe/30'
        }`}>
          <div className="text-[11px] text-muted mb-2 flex items-center gap-2">
            {isBuckling ? <AlertTriangle className="w-3 h-3 text-critical" /> : <Shield className="w-3 h-3 text-safe" />}
            4. Modeled constraint result
          </div>
          <p className="leading-relaxed text-[11px] font-medium text-ink">{structural_outcome}</p>
        </div>
      </div>
      <div className="mt-3 readout text-[10.5px] text-muted bg-surface-2 border border-hairline rounded px-3 py-2">
        Explanation of reduced-order software outputs only; no action was dispatched and no structural condition or outcome is confirmed.
      </div>
    </div>
  );
}

export default WhyEngineConsole;
