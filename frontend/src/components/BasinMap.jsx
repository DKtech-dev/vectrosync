import React, { useState } from 'react';
import { MapPin, Navigation } from 'lucide-react';

export function BasinMap({ currentTempC = 260.0, currentSpm = 4.7 }) {
  const [selectedWell, setSelectedWell] = useState('Baghewala-14');

  const wells = [
    { id: 'Baghewala-14', x: 240, y: 150, type: 'active', spm: currentSpm, temp: currentTempC, status: 'Online' },
    { id: 'Baghewala-01', x: 140, y: 80, type: 'css', spm: 4.2, temp: 185, status: 'Soaking' },
    { id: 'Baghewala-02', x: 240, y: 70, type: 'css', spm: 3.8, temp: 120, status: 'Pumping' },
    { id: 'Baghewala-03', x: 340, y: 80, type: 'css', spm: 4.5, temp: 210, status: 'Pumping' },
    { id: 'Baghewala-04', x: 90, y: 140, type: 'css', spm: 3.5, temp: 95, status: 'Pumping' },
    { id: 'Baghewala-05', x: 170, y: 140, type: 'css', spm: 4.0, temp: 160, status: 'Pumping' },
    { id: 'Baghewala-06', x: 310, y: 140, type: 'css', spm: 4.1, temp: 190, status: 'Pumping' },
    { id: 'Baghewala-07', x: 390, y: 140, type: 'css', spm: 3.2, temp: 75, status: 'Pumping' },
    { id: 'Baghewala-08', x: 140, y: 210, type: 'css', spm: 4.4, temp: 220, status: 'Pumping' },
    { id: 'Baghewala-09', x: 240, y: 220, type: 'css', spm: 3.6, temp: 110, status: 'Pumping' },
    { id: 'Baghewala-10', x: 340, y: 210, type: 'css', spm: 4.0, temp: 170, status: 'Pumping' },
    { id: 'Baghewala-11', x: 90, y: 270, type: 'css', spm: 3.0, temp: 65, status: 'Cooldown' },
    { id: 'Baghewala-12', x: 170, y: 270, type: 'css', spm: 4.3, temp: 205, status: 'Pumping' },
    { id: 'Baghewala-13', x: 310, y: 270, type: 'css', spm: 3.9, temp: 145, status: 'Pumping' },
    { id: 'Baghewala-15', x: 390, y: 270, type: 'css', spm: 3.7, temp: 130, status: 'Pumping' },
    { id: 'Baghewala-16', x: 140, y: 320, type: 'css', spm: 4.6, temp: 240, status: 'Injecting' },
    { id: 'Baghewala-17', x: 240, y: 330, type: 'css', spm: 3.4, temp: 90, status: 'Pumping' },
    { id: 'Baghewala-18', x: 340, y: 320, type: 'css', spm: 4.1, temp: 180, status: 'Pumping' },
  ];

  const activeWellObj = wells.find((w) => w.id === selectedWell) || wells[0];

  return (
    <div className="flex flex-col gap-3 font-sans">
      {/* Basin Map Viewport */}
      <div className="bg-white rounded-lg border border-slate-200 p-3.5 relative shadow-xs">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 text-xs font-medium">
          <div className="flex items-center gap-2">
            <Navigation className="w-4 h-4 text-sky-600" />
            <span className="font-bold text-slate-800 font-mono uppercase tracking-wide">
              Baghewala Field Geospatial Sector (23-Well CSS Cluster)
            </span>
            <span className="font-mono text-[10.5px] text-slate-500">Bikaner-Nagaur Basin &middot; Rajasthan</span>
          </div>

          <div className="flex items-center gap-4 text-[11px] font-mono">
            <span className="flex items-center gap-1.5 text-sky-700 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-600 animate-pulse"></span> Digital Twin (Well #14)
            </span>
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span> Sector Wells
            </span>
          </div>
        </div>

        <div className="relative pt-2.5">
          <svg viewBox="0 0 520 370" className="w-full h-auto bg-slate-50 rounded-lg border border-slate-200">
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
              const isActiveTwin = well.id === 'Baghewala-14';

              return (
                <g
                  key={well.id}
                  transform={`translate(${well.x}, ${well.y})`}
                  className="cursor-pointer transition-transform hover:scale-125"
                  onClick={() => setSelectedWell(well.id)}
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
                    {well.id.replace('Baghewala-', 'W-')}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Selected Well Telemetry Inspector */}
      <div className="hmi-panel p-3.5 flex items-center justify-between text-xs bg-white border border-slate-200 rounded-lg shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-300 text-sky-700 flex items-center justify-center font-mono font-bold text-xs shadow-xs">
            W-14
          </div>
          <div>
            <div className="font-bold text-slate-800 font-mono">{activeWellObj.id} &middot; Jodhpur Sandstone</div>
            <div className="text-[11px] text-slate-500 font-mono">
              Status: <span className="font-semibold text-emerald-700">{activeWellObj.status}</span> &middot; 7" Casing &middot; 3-Section String
            </div>
          </div>
        </div>

        <div className="flex items-center gap-5 font-mono text-[11px] tabular-nums">
          <div>
            <span className="text-slate-500">Sandface temperature: </span>
            <span className="font-bold text-slate-800">{activeWellObj.temp.toFixed(1)}°C</span>
          </div>
          <div>
            <span className="text-slate-500">Operating speed: </span>
            <span className="font-bold text-sky-700">{activeWellObj.spm.toFixed(1)} SPM</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BasinMap;
