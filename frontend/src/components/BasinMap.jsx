import React, { useState } from 'react';
import { Navigation } from 'lucide-react';

export function BasinMap({ currentTempC = 260.0, currentSpm = 4.7 }) {
  const [selectedWell, setSelectedWell] = useState('Case-W14');

  const wells = [
    { id: 'Case-W14', x: 240, y: 150, type: 'active', spm: currentSpm, temp: currentTempC, status: 'Active model case' },
    { id: 'Case-W01', x: 140, y: 80, type: 'css', spm: 4.2, temp: 185, status: 'Modeled soak' },
    { id: 'Case-W02', x: 240, y: 70, type: 'css', spm: 3.8, temp: 120, status: 'Modeled pumping' },
    { id: 'Case-W03', x: 340, y: 80, type: 'css', spm: 4.5, temp: 210, status: 'Modeled pumping' },
    { id: 'Case-W04', x: 90, y: 140, type: 'css', spm: 3.5, temp: 95, status: 'Modeled pumping' },
    { id: 'Case-W05', x: 170, y: 140, type: 'css', spm: 4.0, temp: 160, status: 'Modeled pumping' },
    { id: 'Case-W06', x: 310, y: 140, type: 'css', spm: 4.1, temp: 190, status: 'Modeled pumping' },
    { id: 'Case-W07', x: 390, y: 140, type: 'css', spm: 3.2, temp: 75, status: 'Modeled pumping' },
    { id: 'Case-W08', x: 140, y: 210, type: 'css', spm: 4.4, temp: 220, status: 'Modeled pumping' },
    { id: 'Case-W09', x: 240, y: 220, type: 'css', spm: 3.6, temp: 110, status: 'Modeled pumping' },
    { id: 'Case-W10', x: 340, y: 210, type: 'css', spm: 4.0, temp: 170, status: 'Modeled pumping' },
    { id: 'Case-W11', x: 90, y: 270, type: 'css', spm: 3.0, temp: 65, status: 'Modeled cooldown' },
    { id: 'Case-W12', x: 170, y: 270, type: 'css', spm: 4.3, temp: 205, status: 'Modeled pumping' },
    { id: 'Case-W13', x: 310, y: 270, type: 'css', spm: 3.9, temp: 145, status: 'Modeled pumping' },
    { id: 'Case-W15', x: 390, y: 270, type: 'css', spm: 3.7, temp: 130, status: 'Modeled pumping' },
    { id: 'Case-W16', x: 140, y: 320, type: 'css', spm: 4.6, temp: 240, status: 'Modeled injection' },
    { id: 'Case-W17', x: 240, y: 330, type: 'css', spm: 3.4, temp: 90, status: 'Modeled pumping' },
    { id: 'Case-W18', x: 340, y: 320, type: 'css', spm: 4.1, temp: 180, status: 'Modeled pumping' },
  ];

  const activeWellObj = wells.find((w) => w.id === selectedWell) || wells[0];

  return (
    <div className="flex flex-col gap-3 font-sans">
      {/* Basin Map Viewport */}
      <div className="bg-white rounded-lg border border-slate-200 p-3.5 relative shadow-xs">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between pb-2.5 border-b border-slate-200 text-xs font-medium gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Navigation className="w-4 h-4 text-sky-600" />
            <span className="font-bold text-slate-800 font-mono uppercase tracking-wide">
              Synthetic Sector Layout &mdash; 23-Well Planning Assumption
            </span>
            <span className="font-mono text-[10.5px] text-slate-500">Baghewala-inspired case &middot; not geospatial data</span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono">
            <span className="flex items-center gap-1.5 text-sky-700 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-600"></span> Active synthetic case (W14)
            </span>
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span> Illustrative nodes
            </span>
          </div>
        </div>

        <div className="mt-2.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[10.5px] font-mono text-amber-900">
          Synthetic display only: 18 illustrative nodes are shown. Positions, names, temperatures, speeds, and states are not field inventory or surveyed coordinates; the 23-well figure is a separate planning assumption.
        </div>

        <div className="relative pt-2.5">
          <svg viewBox="0 0 520 370" role="group" aria-labelledby="synthetic-map-title synthetic-map-desc" className="w-full h-auto bg-slate-50 rounded-lg border border-slate-200">
            <title id="synthetic-map-title">Synthetic illustrative sector layout</title>
            <desc id="synthetic-map-desc">Eighteen selectable demonstration nodes arranged in a conceptual layout. This is not a real well map.</desc>
            <defs>
              <radialGradient id="fieldThermalDark" cx="46%" cy="41%" r="35%">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
                <stop offset="70%" stopColor="#f59e0b" stopOpacity="0.06" />
                <stop offset="100%" stopColor="#f8fafc" stopOpacity="0.0" />
              </radialGradient>
            </defs>

            {/* Reservoir Geological Boundary Contours */}
            <path
              d="M 60,60 Q 260,20 460,70 Q 480,240 440,340 Q 240,360 80,310 Q 40,180 60,60 Z"
              fill="#f1f5f9"
              stroke="#cbd5e1"
              strokeWidth="1.2"
              strokeDasharray="4 3"
            />

            {/* Thermal Plume Gradient Contour */}
            <circle cx="240" cy="150" r="115" fill="url(#fieldThermalDark)" />

            {/* Steam Header Pipelines Network */}
            <g stroke="#cbd5e1" strokeWidth="1" strokeDasharray="2 2" fill="none">
              <line x1="240" y1="20" x2="240" y2="350" />
              <line x1="60" y1="140" x2="440" y2="140" />
              <line x1="60" y1="270" x2="440" y2="270" />
            </g>

            {/* Central Steam Generation Plant (CSGF) */}
            <rect x="225" y="15" width="30" height="18" fill="#ffffff" stroke="#0284c7" strokeWidth="1" />
            <text x="240" y="27" className="text-[7.5px] fill-sky-700 font-mono font-bold" textAnchor="middle">CSGF</text>
            <text x="260" y="27" className="text-[8px] fill-slate-500 font-mono">Central Steam Plant</text>

            {/* Field Wells Nodes */}
            {wells.map((well) => {
              const isSelected = selectedWell === well.id;
              const isActiveTwin = well.id === 'Case-W14';

              return (
                <g
                  key={well.id}
                  transform={`translate(${well.x}, ${well.y})`}
                  className="cursor-pointer transition-transform hover:scale-125 focus:outline-none"
                  role="button"
                  tabIndex="0"
                  aria-label={`Select ${well.id}, ${well.status}`}
                  onClick={() => setSelectedWell(well.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedWell(well.id);
                    }
                  }}
                >
                  {/* Well Marker */}
                  <circle
                    cx="0"
                    cy="0"
                    r={isActiveTwin ? '7' : isSelected ? '5.5' : '4'}
                    fill={isActiveTwin ? '#0284c7' : isSelected ? '#38bdf8' : '#94a3b8'}
                    stroke={isActiveTwin ? '#ffffff' : '#e2e8f0'}
                    strokeWidth="1.5"
                  />

                  {/* Well Label */}
                  <text
                    x="0"
                    y="13"
                    className={`text-[8px] font-mono ${
                      isActiveTwin ? 'fill-sky-800 font-bold' : isSelected ? 'fill-slate-900 font-bold' : 'fill-slate-500'
                    }`}
                    textAnchor="middle"
                  >
                    {well.id.replace('Case-', '')}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Selected Well Telemetry Inspector */}
      <div className="hmi-panel p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-white border border-slate-200 rounded-lg shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-300 text-sky-700 flex items-center justify-center font-mono font-bold text-xs shadow-xs">
            {activeWellObj.id.replace('Case-W', 'W-')}
          </div>
          <div>
            <div className="font-bold text-slate-800 font-mono">{activeWellObj.id} &middot; illustrative case node</div>
            <div className="text-[11px] text-slate-500 font-mono">
              Model state: <span className="font-semibold text-sky-700">{activeWellObj.status}</span> &middot; assumed 7&quot; casing / 3-section string
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[11px] tabular-nums">
          <div>
            <span className="text-slate-500">Modeled temperature: </span>
            <span className="font-bold text-slate-800">{activeWellObj.temp.toFixed(1)}°C</span>
          </div>
          <div>
            <span className="text-slate-500">Case speed: </span>
            <span className="font-bold text-sky-700">{activeWellObj.spm.toFixed(1)} SPM</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BasinMap;
