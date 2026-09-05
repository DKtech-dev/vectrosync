import React from 'react';
import { DollarSign, TrendingUp, Award } from 'lucide-react';

export function EconomicsWaterfall({ economics }) {
  if (!economics) {
    return (
      <div className="hmi-panel p-4 text-xs text-slate-500 font-mono bg-[#111827] border-[#1e293b]">
        Computing sector economics...
      </div>
    );
  }

  const {
    well_count = 23,
    workover_avoidance_cr_inr = 4.01,
    power_efficiency_cr_inr = 0.23,
    oil_uplift_cr_inr = 10.72,
    total_annual_value_cr_inr = 14.96,
  } = economics;

  const items = [
    { label: 'Workover Avoidance', value: workover_avoidance_cr_inr, sub: '2.05 fewer pulls/yr @ ₹8.5L', barColor: 'bg-emerald-500' },
    { label: 'Power Efficiency', value: power_efficiency_cr_inr, sub: '48 kWh/day @ ₹7.5/unit', barColor: 'bg-cyan-500' },
    { label: 'Oil Rate Uplift', value: oil_uplift_cr_inr, sub: '+4.2 BOPD/well @ $75/bbl', barColor: 'bg-blue-500' },
    { label: 'Total Annual ROI', value: total_annual_value_cr_inr, sub: '23-Well Baghewala Sector', total: true, barColor: 'bg-gradient-to-r from-cyan-400 to-emerald-400' },
  ];

  return (
    <div className="hmi-panel p-4 flex flex-col justify-between bg-white border border-slate-200 rounded-lg shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 mb-3">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-emerald-600" />
          <span className="text-xs font-mono font-bold text-slate-800 uppercase tracking-wide">
            23-Well Asset ROI Ribbon &mdash; Field Economics Waterfall
          </span>
        </div>
        <div className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 border border-emerald-300 rounded-md tabular-nums flex items-center gap-1 shadow-xs">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
          <span>₹{total_annual_value_cr_inr.toFixed(2)} Cr / Year Net Uplift</span>
        </div>
      </div>

      {/* Value Creation Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
        {items.map((item, idx) => {
          const maxVal = total_annual_value_cr_inr || 15;
          const barHeightPct = Math.min(100, Math.max(12, (item.value / maxVal) * 100));

          return (
            <div
              key={idx}
              className={`rounded-lg p-3 border flex flex-col justify-between ${
                item.total
                  ? 'bg-emerald-50/80 text-emerald-950 border-emerald-300 shadow-xs'
                  : 'bg-slate-50 text-slate-800 border-slate-200'
              }`}
            >
              <div>
                <span className={`text-[10.5px] font-medium uppercase tracking-wider ${
                  item.total ? 'text-emerald-800 font-bold' : 'text-slate-500'
                }`}>
                  {item.label}
                </span>
                <div className={`text-lg font-bold font-mono my-0.5 tabular-nums ${item.total ? 'text-emerald-800' : 'text-slate-900'}`}>
                  ₹{item.value.toFixed(2)} <span className="text-xs font-normal text-slate-500">Cr</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className={`w-full rounded-full h-1.5 my-2 overflow-hidden ${item.total ? 'bg-emerald-200' : 'bg-slate-200'}`}>
                <div
                  className={`h-full rounded-full ${item.barColor}`}
                  style={{ width: `${barHeightPct}%` }}
                ></div>
              </div>

              <span className={`text-[10px] font-mono leading-tight ${
                item.total ? 'text-emerald-700 font-medium' : 'text-slate-500'
              }`}>
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
