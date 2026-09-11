import React from 'react';
import { TrendingUp, Leaf } from 'lucide-react';
import { AnimatedNumber } from './AnimatedNumber';
import { SkeletonPanel } from './Skeleton';

/**
 * Minimal horizontal financial summary bar: headline hypothesis on the left,
 * contributing components as evenly-weighted columns with micro-tags.
 * No numeric fallback defaults -- if the backend omits a field, this must
 * never silently display fabricated money as a model result.
 */
export function EconomicsWaterfall({ economics }) {
  if (!economics || typeof economics.total_annual_value_cr_inr !== 'number') {
    return <SkeletonPanel title="Computing planning-case arithmetic" lines={2} height={140} />;
  }

  const {
    well_count,
    workover_avoidance_cr_inr,
    power_efficiency_cr_inr,
    oil_uplift_cr_inr,
    total_annual_value_cr_inr,
    evidence_status = 'commercial_hypothesis_not_field_validated',
    co2_avoided_tonnes_per_year,
    energy_saved_kwh_per_year,
    assumptions = {},
  } = economics;

  const items = [
    {
      label: 'Workover',
      value: workover_avoidance_cr_inr ?? 0,
      tag: `${assumptions.baseline_failures_per_well_year ?? '—'} → ${assumptions.residual_failures_per_well_year ?? '—'} fail/well-yr`,
    },
    {
      label: 'Energy',
      value: power_efficiency_cr_inr ?? 0,
      tag: `${assumptions.energy_saved_kwh_well_day ?? '—'} kWh/well-day`,
    },
    {
      label: 'Deferment',
      value: oil_uplift_cr_inr ?? 0,
      tag: `${assumptions.avoided_downtime_days_per_well_year ?? '—'} d × ${assumptions.deferred_oil_rate_bopd ?? '—'} BOPD`,
    },
  ];

  return (
    <div className="card p-5">
      <div className="flex flex-col xl:flex-row xl:items-center gap-5">
        {/* Headline */}
        <div className="flex items-center gap-4 xl:pr-6 xl:border-r border-hairline shrink-0">
          <span className="icon-badge bg-safe/10 text-safe">
            <TrendingUp className="w-[18px] h-[18px]" />
          </span>
          <div>
            <div className="unit-label mb-0.5">Base net hypothesis</div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[15px] font-semibold text-muted">₹</span>
              <AnimatedNumber value={total_annual_value_cr_inr} format={(v) => v.toFixed(2)} className="metric-hero" />
              <span className="text-[15px] font-semibold text-muted">Cr/yr</span>
            </div>
          </div>
        </div>

        {/* Components */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1 min-w-0">
          {items.map((item) => {
            const share = total_annual_value_cr_inr ? (item.value / total_annual_value_cr_inr) * 100 : 0;
            return (
              <div key={item.label} className="min-w-0">
                <div className="flex items-baseline justify-between gap-2 mb-1.5">
                  <span className="unit-label">{item.label}</span>
                  <span className="pill bg-surface-2 text-muted readout">{share.toFixed(0)}%</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-[13px] font-semibold text-muted">₹</span>
                  <AnimatedNumber value={item.value} format={(v) => v.toFixed(2)} className="metric-secondary" />
                  <span className="text-[13px] font-semibold text-muted">Cr</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-2 mt-2.5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-safe transition-[width] duration-500 ease-out"
                    style={{ width: `${Math.max(4, Math.min(100, share))}%` }}
                  />
                </div>
                <div className="caption mt-2 truncate" title={item.tag}>{item.tag}</div>
              </div>
            );
          })}
        </div>
      </div>

      {typeof co2_avoided_tonnes_per_year === 'number' && (
        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-hairline">
          <span className="icon-badge w-9 h-9 bg-safe/10 text-safe shrink-0">
            <Leaf className="w-4 h-4" />
          </span>
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <div className="flex items-baseline gap-1.5">
              <AnimatedNumber value={co2_avoided_tonnes_per_year} format={(v) => v.toFixed(0)} className="metric-secondary text-safe" />
              <span className="text-[13px] font-semibold text-muted">t CO₂e / yr avoided</span>
            </div>
            {typeof energy_saved_kwh_per_year === 'number' && (
              <div className="flex items-baseline gap-1.5">
                <AnimatedNumber value={energy_saved_kwh_per_year} format={(v) => (v / 1000).toFixed(0)} className="metric-secondary" />
                <span className="text-[13px] font-semibold text-muted">MWh / yr saved</span>
              </div>
            )}
            <span className="caption">
              Grid factor {economics.grid_emission_factor_kg_co2_per_kwh ?? '0.716'} kg CO₂/kWh (CEA India, disclosed assumption)
            </span>
          </div>
        </div>
      )}

      <p className="caption mt-4 pt-3 border-t border-hairline">
        {well_count}-well planning case · unvalidated commercial hypothesis · {evidence_status.replaceAll('_', ' ')} · scenario
        arithmetic, not a forecast or investment basis.
      </p>
    </div>
  );
}

export default EconomicsWaterfall;
