import React, { useState } from 'react';
import { Navigation } from 'lucide-react';
import { AnimatedNumber } from './AnimatedNumber';

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
    <div className="flex flex-col gap-4 font-sans">
      {/* Basin Map Viewport */}
      <div className="card-nested p-4 relative">
        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-3 pb-4 mb-4 border-b border-hairline">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Navigation className="w-4 h-4 text-muted" />
              <span className="text-[13px] font-semibold text-ink">23-well planning assumption</span>
            </div>
            <span className="caption">Baghewala-inspired case &middot; not geospatial data</span>
          </div>

          {/* Legend: active node reads as interactive, everything else is tertiary */}
          <div className="flex flex-wrap items-center gap-4">
            <span className="caption flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-interactive"></span>
              Active synthetic case (W14)
            </span>
            <span className="caption flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-tertiary"></span>
              Illustrative nodes
            </span>
          </div>
        </div>

        <p className="caption mb-4">
          Synthetic display only: 18 illustrative nodes shown. Positions, names, temperatures, speeds, and states are not field inventory or surveyed coordinates; the 23-well figure is a separate planning assumption.
        </p>

        <div className="relative">
          <svg viewBox="0 0 520 370" role="group" aria-labelledby="synthetic-map-title synthetic-map-desc" className="w-full h-auto panel-nested">
            <title id="synthetic-map-title">Synthetic illustrative sector layout</title>
            <desc id="synthetic-map-desc">Eighteen selectable demonstration nodes arranged in a conceptual layout. This is not a real well map.</desc>
            <defs>
              <radialGradient id="fieldThermalDark" cx="46%" cy="41%" r="35%">
                <stop offset="0%" style={{ stopColor: 'rgb(var(--accent-caution))' }} stopOpacity="0.25" />
                <stop offset="70%" style={{ stopColor: 'rgb(var(--accent-caution))' }} stopOpacity="0.06" />
                <stop offset="100%" style={{ stopColor: 'rgb(var(--bg-surface-2))' }} stopOpacity="0.0" />
              </radialGradient>
            </defs>

            {/* Reservoir Geological Boundary Contours */}
            <path
              d="M 60,60 Q 260,20 460,70 Q 480,240 440,340 Q 240,360 80,310 Q 40,180 60,60 Z"
              style={{ fill: 'rgb(var(--bg-surface-2))', stroke: 'rgb(var(--border-hairline))' }}
              strokeWidth="1.2"
              strokeDasharray="4 3"
            />

            {/* Thermal Plume Gradient Contour */}
            <circle cx="240" cy="150" r="115" fill="url(#fieldThermalDark)" />

            {/* Steam Header Pipelines Network */}
            <g style={{ stroke: 'rgb(var(--border-hairline))' }} strokeWidth="1" strokeDasharray="2 2" fill="none">
              <line x1="240" y1="20" x2="240" y2="350" />
              <line x1="60" y1="140" x2="440" y2="140" />
              <line x1="60" y1="270" x2="440" y2="270" />
            </g>

            {/* Central Steam Generation Plant (CSGF) */}
            <rect x="225" y="15" width="30" height="18" style={{ fill: 'rgb(var(--bg-surface-1))', stroke: 'rgb(var(--accent-interactive))' }} strokeWidth="1" />
            <text x="240" y="27" className="text-[7.5px] fill-interactive font-mono font-bold" textAnchor="middle">CSGF</text>
            <text x="260" y="27" className="text-[8px] fill-tertiary font-mono">Central Steam Plant</text>

            {/* Field Wells Nodes */}
            {wells.map((well) => {
              const isSelected = selectedWell === well.id;
              const isActiveTwin = well.id === 'Case-W14';

              return (
                <g
                  key={well.id}
                  transform={`translate(${well.x}, ${well.y})`}
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
                  {/* Inner group carries the hover scale so it never fights
                      the outer translate() (CSS transform overrides the SVG
                      transform attribute on the same element). */}
                  <g
                    className="cursor-pointer transition-transform hover:scale-125"
                    style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                  >
                    {/* Well Marker */}
                    <circle
                      cx="0"
                      cy="0"
                      r={isActiveTwin ? '7' : isSelected ? '5.5' : '4'}
                      fill={isActiveTwin ? 'rgb(var(--accent-interactive))' : isSelected ? 'rgb(var(--accent-interactive))' : 'rgb(var(--text-tertiary))'}
                      stroke="rgb(var(--bg-surface-1))"
                      strokeWidth="1.5"
                    />

                    {/* Well Label */}
                    <text
                      x="0"
                      y="13"
                      className={`text-[8px] font-mono ${
                        isActiveTwin ? 'fill-interactive font-bold' : isSelected ? 'fill-ink font-bold' : 'fill-tertiary'
                      }`}
                      textAnchor="middle"
                    >
                      {well.id.replace('Case-', '')}
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Selected Well Telemetry Inspector — label -> number -> caption */}
      <div className="card-nested p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-interactive/10 border border-interactive/30 text-interactive flex items-center justify-center readout text-[11px] font-semibold">
            {activeWellObj.id.replace('Case-W', 'W-')}
          </div>
          <div className="flex flex-col gap-1">
            <span className="readout text-[13px] font-medium text-ink">{activeWellObj.id}</span>
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip">
                <span className="chip-dot" />
                {activeWellObj.status}
              </span>
              <span className="caption">
                Illustrative case node &middot; assumed 7&quot; casing / 3-section string
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-start gap-6">
          <div className="flex flex-col gap-1">
            <span className="unit-label text-tertiary">Modeled temp &middot; °C</span>
            <AnimatedNumber value={activeWellObj.temp} format={(v) => v.toFixed(1)} className="metric-secondary text-ink" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="unit-label text-tertiary">Case speed &middot; SPM</span>
            <AnimatedNumber value={activeWellObj.spm} format={(v) => v.toFixed(1)} className="metric-secondary text-ink" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default BasinMap;
