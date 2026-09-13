import React from 'react';
import { IndianRupee, Leaf, Scale } from 'lucide-react';
import { AnimatedNumber } from './AnimatedNumber';
import { SkeletonPanel } from './Skeleton';

/**
 * Commercial hypothesis panel. Three rules govern this component:
 *
 * 1. No numeric fallback defaults. If the backend omits a field it renders an
 *    em-dash — fabricated money must never appear as a model result.
 * 2. Never a bare point estimate. The backend ships a low/base/high
 *    sensitivity band alongside its own `evidence_status` warning, so the band
 *    and the decision rule are shown with the headline, not buried.
 * 3. Cr = crore INR (1 Cr = 10,000,000 INR); stated in the footer because the
 *    unit is not universal.
 */

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const DASH = '\u2014';

/** Em-dash + text equivalent for any absent field. */
function Unavailable({ className = '' }) {
  return (
    <span className={className} title="Not reported by the model">
      <span aria-hidden="true">{DASH}</span>
      <span className="sr-only">not reported</span>
    </span>
  );
}

function SpecRow({ label, value, unit, format = (v) => v.toFixed(2) }) {
  return (
    <div className="px-3 py-2.5 border-t border-l border-hairline">
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 flex items-baseline gap-1">
        {isNum(value) ? (
          <span className="readout text-[15px] font-semibold text-ink">{format(value)}</span>
        ) : (
          <Unavailable className="readout text-[15px] font-semibold text-faint" />
        )}
        {unit && <span className="unit-label">{unit}</span>}
      </dd>
    </div>
  );
}

/** Low/base/high band for the net annual value. */
function SensitivityBand({ sensitivity }) {
  const low = sensitivity?.low?.total_annual_value_cr_inr;
  const base = sensitivity?.base?.total_annual_value_cr_inr;
  const high = sensitivity?.high?.total_annual_value_cr_inr;

  if (!isNum(low) || !isNum(base) || !isNum(high)) {
    return (
      <p className="caption mt-3">
        Sensitivity band not reported by the model — treat the headline as a single unbounded point estimate.
      </p>
    );
  }

  const min = Math.min(low, base, high);
  const max = Math.max(low, base, high);
  const span = max - min || 1;
  const basePos = ((base - min) / span) * 100;

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="eyebrow">sensitivity band · net ₹Cr/yr</span>
        {sensitivity?.status && <span className="eyebrow">{String(sensitivity.status)}</span>}
      </div>

      <div className="relative h-[9px] rounded-[2px] well overflow-hidden">
        <div className="absolute inset-y-0 left-0 right-0" style={{ background: 'rgb(var(--accent-safe) / 0.22)' }} />
        <span
          className="absolute top-0 bottom-0 w-[2px]"
          style={{ left: `calc(${basePos}% - 1px)`, background: 'rgb(var(--accent-safe))' }}
          aria-hidden="true"
        />
      </div>

      <div className="flex items-baseline justify-between gap-2 mt-1.5">
        <span className="eyebrow">low {low.toFixed(2)}</span>
        <span className="eyebrow text-safe">base {base.toFixed(2)}</span>
        <span className="eyebrow">high {high.toFixed(2)}</span>
      </div>
    </div>
  );
}

export function EconomicsWaterfall({ economics }) {
  if (!economics || typeof economics.total_annual_value_cr_inr !== 'number') {
    return <SkeletonPanel title="Computing planning-case arithmetic" lines={3} height={200} />;
  }

  const {
    well_count,
    currency,
    workover_avoidance_cr_inr,
    power_efficiency_cr_inr,
    oil_uplift_cr_inr,
    gross_annual_value_cr_inr,
    annual_platform_cost_cr_inr,
    total_annual_value_cr_inr,
    initial_commissioning_capex_cr_inr,
    payback_period_days,
    avoided_failures_per_year,
    recaptured_barrels_per_year,
    evidence_status,
    co2_avoided_tonnes_per_year,
    energy_saved_kwh_per_year,
    grid_emission_factor_kg_co2_per_kwh,
    assumptions,
    sensitivity,
  } = economics;

  const asm = assumptions && typeof assumptions === 'object' ? assumptions : {};
  const num = (v, digits = 2) => (isNum(v) ? v.toFixed(digits) : DASH);

  const components = [
    {
      label: 'Workover avoidance',
      value: workover_avoidance_cr_inr,
      tag: `${num(asm.baseline_failures_per_well_year, 2)} → ${num(asm.residual_failures_per_well_year, 2)} failures / well-yr`,
    },
    {
      label: 'Power efficiency',
      value: power_efficiency_cr_inr,
      tag: `${num(asm.energy_saved_kwh_well_day, 1)} kWh / well-day at ₹${num(asm.electricity_tariff_inr_kwh, 2)} / kWh`,
    },
    {
      label: 'Deferment recovery',
      value: oil_uplift_cr_inr,
      tag: `${num(asm.avoided_downtime_days_per_well_year, 1)} d × ${num(asm.deferred_oil_rate_bopd, 1)} BOPD`,
    },
  ];

  // Shares are taken against gross value (components sum to gross, not net).
  const shareBasis = isNum(gross_annual_value_cr_inr)
    ? gross_annual_value_cr_inr
    : components.reduce((acc, c) => (isNum(c.value) ? acc + c.value : acc), 0) || null;

  const evidenceLabel = evidence_status ? String(evidence_status).replaceAll('_', ' ') : 'evidence status not reported';

  return (
    <section className="panel overflow-hidden" aria-labelledby="economics-heading">
      <div className="panel-rail">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="icon-badge w-6 h-6 text-caution">
            <Scale className="w-3.5 h-3.5" />
          </span>
          <div className="min-w-0">
            <h2 id="economics-heading" className="panel-title truncate">
              Commercial hypothesis
            </h2>
            <p className="caption truncate">
              {isNum(well_count) ? `${well_count}-well planning case` : 'Planning case'} · scenario arithmetic, not a forecast
            </p>
          </div>
        </div>
        <span className="pill tone-caution shrink-0">
          <span className="chip-dot" />
          {evidence_status ? 'Not field validated' : 'Evidence unreported'}
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12">
        {/* Headline + band */}
        <div className="xl:col-span-4 p-4 xl:border-r border-hairline">
          <h3 className="eyebrow">Net annual value</h3>
          <div className="flex items-baseline gap-1.5 mt-2">
            <IndianRupee className="w-4 h-4 text-muted shrink-0 self-center" aria-hidden="true" />
            <AnimatedNumber
              value={total_annual_value_cr_inr}
              format={(v) => v.toFixed(2)}
              className="metric-hero text-ink"
            />
            <span className="unit-label">Cr / yr</span>
          </div>
          <p className="sr-only">
            {`Net annual value ${num(total_annual_value_cr_inr)} crore ${currency || 'INR'} per year.`}
          </p>
          <SensitivityBand sensitivity={sensitivity} />
        </div>

        {/* Components */}
        <div className="xl:col-span-8 p-4">
          <h3 className="eyebrow mb-3">Gross value components</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {components.map((item) => {
              const share = isNum(item.value) && shareBasis ? (item.value / shareBasis) * 100 : null;
              return (
                <div key={item.label} className="min-w-0">
                  <div className="flex items-baseline justify-between gap-2 mb-1.5">
                    <span className="unit-label truncate">{item.label}</span>
                    <span className="pill readout shrink-0">{share === null ? DASH : `${share.toFixed(0)}%`}</span>
                  </div>

                  <div className="flex items-baseline gap-1">
                    <span className="text-[13px] font-semibold text-muted">₹</span>
                    {isNum(item.value) ? (
                      <AnimatedNumber value={item.value} format={(v) => v.toFixed(2)} className="metric-secondary text-ink" />
                    ) : (
                      <Unavailable className="metric-secondary text-faint" />
                    )}
                    <span className="unit-label">Cr</span>
                  </div>

                  <div className="h-[5px] rounded-[2px] bg-surface-2 border border-hairline mt-2.5 overflow-hidden">
                    {share !== null && (
                      <div
                        className="h-full transition-[width] duration-500 ease-instrument"
                        style={{
                          width: `${Math.max(2, Math.min(100, share))}%`,
                          background: 'rgb(var(--accent-safe) / 0.85)',
                        }}
                      />
                    )}
                  </div>

                  <div className="caption mt-2" title={item.tag}>
                    {item.tag}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Case arithmetic */}
      <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <SpecRow label="gross value" value={gross_annual_value_cr_inr} unit="₹Cr/yr" />
        <SpecRow label="platform cost" value={annual_platform_cost_cr_inr} unit="₹Cr/yr" />
        <SpecRow label="commissioning capex" value={initial_commissioning_capex_cr_inr} unit="₹Cr" />
        <SpecRow label="payback" value={payback_period_days} unit="days" format={(v) => v.toFixed(1)} />
        <SpecRow label="avoided failures" value={avoided_failures_per_year} unit="/yr" />
        <SpecRow
          label="recaptured oil"
          value={recaptured_barrels_per_year}
          unit="bbl/yr"
          format={(v) => Math.round(v).toLocaleString('en-US')}
        />
      </dl>

      {(isNum(co2_avoided_tonnes_per_year) || isNum(energy_saved_kwh_per_year)) && (
        <div className="flex items-center gap-4 px-4 py-3 border-t border-hairline">
          <span className="icon-badge w-6 h-6 text-safe shrink-0">
            <Leaf className="w-3.5 h-3.5" />
          </span>
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
            {isNum(co2_avoided_tonnes_per_year) && (
              <div className="flex items-baseline gap-1.5">
                <AnimatedNumber
                  value={co2_avoided_tonnes_per_year}
                  format={(v) => v.toFixed(0)}
                  className="metric-secondary text-safe"
                />
                <span className="unit-label">t CO₂e / yr avoided</span>
              </div>
            )}
            {isNum(energy_saved_kwh_per_year) && (
              <div className="flex items-baseline gap-1.5">
                <AnimatedNumber
                  value={energy_saved_kwh_per_year}
                  format={(v) => (v / 1000).toFixed(0)}
                  className="metric-secondary text-ink"
                />
                <span className="unit-label">MWh / yr saved</span>
              </div>
            )}
            <span className="caption">
              {isNum(grid_emission_factor_kg_co2_per_kwh)
                ? `Grid factor ${grid_emission_factor_kg_co2_per_kwh} kg CO₂/kWh (disclosed assumption)`
                : 'Grid emission factor not reported'}
            </span>
          </div>
        </div>
      )}

      <p className="caption px-4 py-3 border-t border-hairline">
        {evidenceLabel} · Cr = crore {currency || 'INR'} (1 Cr = 10,000,000).
        {sensitivity?.decision_rule ? ` Decision rule: ${sensitivity.decision_rule}.` : ''}
      </p>
    </section>
  );
}

export default EconomicsWaterfall;
