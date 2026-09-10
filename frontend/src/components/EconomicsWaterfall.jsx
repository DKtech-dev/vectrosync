import React from 'react';
import { TrendingUp, Award } from 'lucide-react';
import { AnimatedNumber } from './AnimatedNumber';
import { SkeletonPanel } from './Skeleton';

export function EconomicsWaterfall({ economics }) {
  if (!economics) {
    return <SkeletonPanel title="Computing planning-case arithmetic" lines={3} height={180} />;
  }

  const {
    well_count = 23,
    workover_avoidance_cr_inr = 4.01,
    power_efficiency_cr_inr = 0.23,
    oil_uplift_cr_inr = 10.72,
    total_annual_value_cr_inr = 14.96,
    evidence_status = 'commercial_hypothesis_not_field_validated',
    assumptions = {},
  } = economics;

  const items = [
    { label: 'Workover hypothesis', value: workover_avoidance_cr_inr, sub: `${assumptions.baseline_failures_per_well_year ?? '—'} → ${assumptions.residual_failures_per_well_year ?? '—'} failures/well-year` },
    { label: 'Energy hypothesis', value: power_efficiency_cr_inr, sub: `${assumptions.energy_saved_kwh_well_day ?? '—'} kWh/well-day` },
    { label: 'Deferment hypothesis', value: oil_uplift_cr_inr, sub: `${assumptions.avoided_downtime_days_per_well_year ?? '—'} days × ${assumptions.deferred_oil_rate_bopd ?? '—'} BOPD` },
    { label: 'Base net hypothesis', value: total_annual_value_cr_inr, sub: `${well_count}-well planning case; unvalidated`, total: true },
  ];

  return (
    <div className="panel p-4 flex flex-col justify-between">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-hairline mb-3 gap-2">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-safe" />
          <span className="section-title">
            Commercial Sensitivity &mdash; Base Planning Hypothesis
          </span>
        </div>
        <div className="chip text-safe bg-safe/10 border-safe/30">
          <TrendingUp className="w-3.5 h-3.5 text-safe" />
          <span>
            ₹<AnimatedNumber value={total_annual_value_cr_inr} format={(v) => v.toFixed(2)} /> Cr/year assumption
          </span>
        </div>
      </div>

      <div className="readout text-[10.5px] text-caution bg-caution/10 border border-caution/30 rounded px-2 py-1 mb-3">
        Unvalidated commercial hypothesis · {evidence_status.replaceAll('_', ' ')} · Scenario arithmetic, not a forecast, realized benefit, or investment basis.
      </div>

      {/* Value Creation Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        {items.map((item, idx) => {
          const maxVal = total_annual_value_cr_inr || 15;
          const barWidthPct = Math.min(100, Math.max(12, (item.value / maxVal) * 100));

          return (
            <div
              key={idx}
              className={`rounded-lg p-3 border flex flex-col justify-between ${
                item.total
                  ? 'bg-safe/10 border-safe/30 text-ink'
                  : 'panel-inset text-ink'
              }`}
            >
              <div>
                <span className="text-[11px] text-muted">
                  {item.label}
                </span>
                <div className="readout text-lg font-bold my-0.5 text-ink">
                  ₹<AnimatedNumber value={item.value} format={(v) => v.toFixed(2)} /> <span className="text-xs font-normal text-muted">Cr</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full rounded-full h-1.5 my-2 overflow-hidden bg-surface-2">
                <div
                  className={`h-full rounded-full transition-[width] duration-500 ease-out ${item.total ? 'bg-safe' : 'bg-safe/70'}`}
                  style={{ width: `${barWidthPct}%` }}
                ></div>
              </div>

              <span className="readout text-[10px] leading-tight text-muted">
                {item.sub}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default EconomicsWaterfall;
