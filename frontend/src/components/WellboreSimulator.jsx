import React, { useEffect, useState, useMemo } from 'react';

export function WellboreSimulator({
  spm = 3.5,
  temperatureC = 260.0,
  minTensionKn = 0.65,
  isBuckling = false,
  isModbusSevered = false,
  failsafeLevel = 'LEVEL_0_NORMAL',
  isPlaying = true,
  simSpeed = 1,
  stressHeatmap = null,
  dynacard = null,
}) {
  const [phaseDeg, setPhaseDeg] = useState(0);
  const [inspectedDepth, setInspectedDepth] = useState(950);
  const [showStrata, setShowStrata] = useState(true);

  // Real-time kinematics clock driven by SPM and speed multiplier
  useEffect(() => {
    if (!isPlaying) return;

    let animationFrame;
    let lastTime = performance.now();
    const degPerSec = (spm * 360 * simSpeed) / 60;

    const animate = (currentTime) => {
      const dt = (currentTime - lastTime) / 1000;
      lastTime = currentTime;
      setPhaseDeg((prev) => (prev + degPerSec * dt) % 360);
      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [spm, isPlaying, simSpeed]);

  // Geometric Kinematics
  const phaseRad = (phaseDeg * Math.PI) / 180;
  const beamAngle = Math.sin(phaseRad) * 8.5; // Walking beam mechanical tilt angle (+/- 8.5 deg)
  const rodOffset = Math.sin(phaseRad) * 18;  // Polished rod vertical reciprocation stroke (+/- 18 px)

  // Map phase angle into stress heatmap column index (144 angle slices)
  const angleIdx = useMemo(() => {
    if (!stressHeatmap?.angles_deg?.length) return 0;
    const normDeg = ((phaseDeg % 360) + 360) % 360;
    const numAngles = stressHeatmap.angles_deg.length;
    const step = 360 / numAngles;
    return Math.min(numAngles - 1, Math.max(0, Math.floor(normDeg / step)));
  }, [phaseDeg, stressHeatmap]);

  // Section Midpoint Depths and Cross-sectional Areas
  // Section 1: 0 - 350 m, 1.0" rod, A1 = 5.067 cm2 (5.067e-4 m2) -> Midpoint: 175 m (node 18)
  // Section 2: 350 - 750 m, 7/8" rod, A2 = 3.879 cm2 (3.879e-4 m2) -> Midpoint: 550 m (node 55)
  // Section 3: 750 - 1150 m, 3/4" rod, A3 = 2.850 cm2 (2.850e-4 m2) -> Midpoint: 950 m (node 95)
  const computeSectionState = (depthMidM, areaM2, isSection3 = false) => {
    const nodeIdx = Math.min(115, Math.max(0, Math.round(depthMidM / 10)));
    let stressMpa = 0.0;

    if (stressHeatmap?.stress_matrix_mpa?.[nodeIdx]) {
      const row = stressHeatmap.stress_matrix_mpa[nodeIdx];
      stressMpa = row[angleIdx] !== undefined ? row[angleIdx] : row[0];
    } else if (dynacard?.downhole_load_kn?.length > 0) {
      // Direct physics calculation from dynacard if heatmap is initializing
      const loadSlice = isSection3 ? dynacard.downhole_load_kn : dynacard.surface_load_kn;
      const idx = Math.min(loadSlice.length - 1, Math.floor((phaseDeg / 360) * loadSlice.length));
      const forceEstKn = loadSlice[idx] || (isSection3 ? minTensionKn : 45.0);
      stressMpa = (forceEstKn * 1000) / (areaM2 * 1e6);
    } else {
      stressMpa = isSection3 ? (minTensionKn * 1000) / (areaM2 * 1e6) : 65.0;
    }

    const forceKn = (stressMpa * 1e6 * areaM2) / 1000;

    // Requirement 5 Color Classification:
    // sigma > +2.0 kN: Sky/Cyan (#0284c7)
    // +0.5 to +2.0 kN: Amber (#d97706)
    // < 0.0 kN: Red (#dc2626) buckling animation
    // 0.0 to 0.5 kN: Orange protective alert (#ea580c)
    let fill = '#0284c7'; // Sky default
    let stroke = '#0369a1';
    let buckle = false;

    if (forceKn < 0.0 || (isSection3 && (isBuckling || minTensionKn < 0.0))) {
      fill = '#dc2626'; // Red
      stroke = '#991b1b';
      buckle = isSection3;
    } else if (forceKn < 0.5) {
      fill = '#ea580c'; // Orange
      stroke = '#c2410c';
    } else if (forceKn <= 2.0) {
      fill = '#d97706'; // Amber
      stroke = '#b45309';
    } else {
      fill = '#0284c7'; // Sky
      stroke = '#0369a1';
    }

    return {
      stressMpa,
      forceKn,
      fill,
      stroke,
      buckle,
    };
  };

  const sec1 = computeSectionState(175, 5.067e-4, false);
  const sec2 = computeSectionState(550, 3.879e-4, false);
  const sec3 = computeSectionState(950, 2.850e-4, true);

  // Inspected Telemetry Node at Chosen Depth
  const getInspectedTelemetry = (depth) => {
    let section = 'Section 3: 3/4" Rod';
    let areaCm2 = 2.850;
    let areaM2 = 2.850e-4;
    const yieldStrengthMpa = 586.0; // API Grade D sucker rod yield strength (586 MPa)

    if (depth <= 350) {
      section = 'Section 1: 1.0" Rod';
      areaCm2 = 5.067;
      areaM2 = 5.067e-4;
    } else if (depth <= 750) {
      section = 'Section 2: 7/8" Rod';
      areaCm2 = 3.879;
      areaM2 = 3.879e-4;
    }

    const nodeIdx = Math.min(115, Math.max(0, Math.round(depth / 10)));
    let stressMpa = 0.0;

    if (stressHeatmap?.stress_matrix_mpa?.[nodeIdx]) {
      const row = stressHeatmap.stress_matrix_mpa[nodeIdx];
      stressMpa = row[angleIdx] !== undefined ? row[angleIdx] : row[0];
    } else {
      stressMpa = (minTensionKn * 1000) / (areaM2 * 1e6);
    }

    const forceKn = (stressMpa * 1e6 * areaM2) / 1000;

    let safetyFactor = 1.0;
    if (stressMpa < 0 || forceKn < 0) {
      safetyFactor = 0.42; // Unstable compressive buckling
    } else if (forceKn < 0.5) {
      safetyFactor = 0.88; // Anti-float margin violated
    } else {
      safetyFactor = Math.min(4.0, Math.max(1.0, yieldStrengthMpa / Math.max(1.0, Math.abs(stressMpa))));
    }

    return {
      section,
      areaCm2,
      stressMpa,
      forceKn,
      safetyFactor,
    };
  };

  const insp = getInspectedTelemetry(inspectedDepth);

  return (
    <div className="hmi-panel p-4 flex flex-col h-full bg-white border border-slate-200 rounded-lg shadow-xs">
      {/* Viewport Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-2.5">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse"></span>
          <span className="text-xs font-mono font-bold text-slate-800 uppercase tracking-wide">
            Subsurface Wellbore Schematic &mdash; 2D Physics Twin
          </span>
        </div>

        {/* Viewport Info */}
        <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
          <button
            onClick={() => setShowStrata(!showStrata)}
            className={`px-2 py-0.5 rounded text-[10.5px] border transition ${
              showStrata ? 'bg-slate-100 border-slate-300 text-sky-700 font-bold' : 'bg-white border-slate-200 text-slate-400'
            }`}
          >
            STRATA
          </button>
          <span>θ = {phaseDeg.toFixed(1)}°</span>
          <span>&middot;</span>
          <span className="text-sky-700 font-bold">{spm.toFixed(1)} SPM</span>
        </div>
      </div>

      {/* Main SCADA Schematic Viewport */}
      <div className="relative flex-1 min-h-[580px] bg-slate-50 rounded-lg border border-slate-200 overflow-hidden flex flex-col justify-between">
        {/* SVG Wellbore Drafting Canvas */}
        <div className="relative w-full h-[520px] flex justify-center">
          <svg
            viewBox="0 0 480 620"
            className="w-full h-full max-w-[480px]"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              {/* Thermal Steam Plume Gradient */}
              <radialGradient id="scadaThermalPlume" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.30" />
                <stop offset="60%" stopColor="#f59e0b" stopOpacity="0.08" />
                <stop offset="100%" stopColor="#f8fafc" stopOpacity="0.0" />
              </radialGradient>

              {/* Heavy Oil Column Gradient */}
              <linearGradient id="fluidColumnGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#f1f5f9" />
                <stop offset="50%" stopColor="#e2e8f0" />
                <stop offset="100%" stopColor="#f1f5f9" />
              </linearGradient>
            </defs>

            {/* GEOLOGICAL STRATIGRAPHY */}
            {showStrata && (
              <g id="geology-layers" opacity="0.6">
                {/* Overburden (0 - 300 m) */}
                <rect x="0" y="140" width="480" height="110" fill="#f1f5f9" />
                <text x="415" y="195" className="text-[8.5px] fill-slate-500 font-mono">Overburden</text>

                {/* Nagaur Shale (300 - 650 m) */}
                <rect x="0" y="250" width="480" height="130" fill="#e2e8f0" />
                <text x="395" y="315" className="text-[8.5px] fill-slate-500 font-mono">Nagaur Shale</text>

                {/* Bilara Carbonate (650 - 950 m) */}
                <rect x="0" y="380" width="480" height="130" fill="#f1f5f9" />
                <text x="385" y="445" className="text-[8.5px] fill-slate-500 font-mono">Bilara Carbonate</text>

                {/* Jodhpur Sandstone Target Reservoir (950 - 1,150 m) */}
                <rect x="0" y="510" width="480" height="100" fill="#fef3c7" />
                <text x="330" y="555" className="text-[9px] fill-amber-800 font-mono font-bold">
                  Jodhpur Sandstone (1,150 m)
                </text>
              </g>
            )}

            {/* Surface Ground Level Line */}
            <line x1="0" y1="140" x2="480" y2="140" stroke="#94a3b8" strokeWidth="1.5" />
            <rect x="185" y="132" width="110" height="8" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
            <text x="420" y="136" className="text-[9px] fill-slate-600 font-mono font-semibold">GL (0 m)</text>

            {/* Technical Depth Ruler Grid (Left Rail) */}
            <g className="text-[9px] fill-slate-500 font-mono">
              <line x1="55" y1="140" x2="55" y2="580" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 3" />
              
              <line x1="50" y1="140" x2="60" y2="140" stroke="#64748b" strokeWidth="1" />
              <text x="22" y="143">0 m</text>
              
              <line x1="50" y1="260" x2="60" y2="260" stroke="#64748b" strokeWidth="1" />
              <text x="14" y="263">350 m</text>
              
              <line x1="50" y1="390" x2="60" y2="390" stroke="#64748b" strokeWidth="1" />
              <text x="14" y="393">750 m</text>
              
              <line x1="50" y1="580" x2="60" y2="580" stroke="#64748b" strokeWidth="1" />
              <text x="8" y="583">1,150 m</text>
            </g>

            {/* SURFACE PUMPING UNIT */}
            <g id="surface-unit">
              {/* Samson Post (A-Frame) */}
              <polygon points="130,140 155,55 180,140" fill="#e2e8f0" stroke="#475569" strokeWidth="1.5" />
              <line x1="142" y1="98" x2="168" y2="98" stroke="#475569" strokeWidth="1" />

              {/* Walking Beam Pivot Assembly */}
              <g transform={`rotate(${beamAngle}, 155, 55)`}>
                {/* Main Walking Beam */}
                <rect x="75" y="50" width="160" height="10" rx="1" fill="#cbd5e1" stroke="#0284c7" strokeWidth="1.5" />
                
                {/* Horsehead Arc */}
                <path d="M 235,55 Q 248,70 240,105 L 230,105 Q 238,70 225,55 Z" fill="#0284c7" stroke="#0369a1" />
                
                {/* Counterweight */}
                <rect x="80" y="42" width="28" height="26" rx="1" fill="#475569" stroke="#334155" strokeWidth="1" />
                <text x="86" y="58" className="text-[7.5px] fill-white font-mono font-bold">CW</text>

                {/* Pitman Pin */}
                <circle cx="95" cy="55" r="3" fill="#64748b" stroke="#334155" strokeWidth="1" />
              </g>

              {/* Center Pivot Bearing */}
              <circle cx="155" cy="55" r="4.5" fill="#0284c7" stroke="#ffffff" strokeWidth="1.5" />

              {/* Carrier Bar & Bridle Wireline */}
              <line x1="240" y1="100" x2="240" y2="135" stroke="#64748b" strokeWidth="1.5" />
              <rect x="232" y="135" width="16" height="5" rx="0.5" fill="#64748b" />
            </g>

            {/* SUBSURFACE WELLBORE & CASING */}
            {/* 7" Production Casing */}
            <rect x="210" y="140" width="60" height="445" fill="#ffffff" stroke="#475569" strokeWidth="1.5" />
            
            {/* Annular Heavy Crude Fluid Column */}
            <rect x="215" y="140" width="50" height="445" fill="url(#fluidColumnGrad)" opacity="0.9" />

            {/* Thermal Steam Plume (Jodhpur Sandface 1,100 to 1,150 m) */}
            <ellipse cx="240" cy="570" rx="95" ry="35" fill="url(#scadaThermalPlume)" />

            {/* TAPER SECTION INTERFACE MARKERS */}
            <line x1="210" y1="260" x2="270" y2="260" stroke="#64748b" strokeWidth="1.5" strokeDasharray="3 2" />
            <text x="278" y="263" className="text-[9px] fill-slate-500 font-mono">
              Taper 1: 1.0" → 7/8" (350 m)
            </text>

            <line x1="210" y1="390" x2="270" y2="390" stroke="#64748b" strokeWidth="1.5" strokeDasharray="3 2" />
            <text x="278" y="393" className="text-[9px] fill-slate-500 font-mono">
              Taper 2: 7/8" → 3/4" (750 m)
            </text>

            {/* SUCKER ROD STRING (Kinematic Stroke Driven with Pure Tensor Stress Colors) */}
            <g transform={`translate(0, ${rodOffset})`}>
              {/* Polished Rod */}
              <rect x="238" y="130" width="4" height="20" fill="#475569" />

              {/* Section 1: 1.0" Rod (0 to 350 m -> y=140 to 260) */}
              <rect 
                x="237" 
                y="140" 
                width="6" 
                height="120" 
                fill={sec1.fill} 
                stroke={sec1.stroke} 
                strokeWidth="1" 
              />
              <circle cx="240" cy="180" r="4.5" fill="#ffffff" fillOpacity="0.6" />
              <circle cx="240" cy="220" r="4.5" fill="#ffffff" fillOpacity="0.6" />

              {/* Section 2: 7/8" Rod (350 to 750 m -> y=260 to 390) */}
              <rect 
                x="237.5" 
                y="260" 
                width="5" 
                height="130" 
                fill={sec2.fill} 
                stroke={sec2.stroke} 
                strokeWidth="1" 
              />
              <circle cx="240" cy="305" r="4" fill="#ffffff" fillOpacity="0.6" />
              <circle cx="240" cy="350" r="4" fill="#ffffff" fillOpacity="0.6" />

              {/* Section 3: 3/4" Rod (750 to 1,150 m -> y=390 to 550) */}
              <g className={sec3.buckle ? 'animate-buckling' : ''}>
                <rect
                  x="238"
                  y="390"
                  width="4"
                  height="160"
                  fill={sec3.fill}
                  stroke={sec3.stroke}
                  strokeWidth={sec3.buckle ? '2' : '1'}
                />
                <circle cx="240" cy="430" r="3.5" fill={sec3.buckle ? '#fecaca' : '#ffffff'} fillOpacity="0.7" />
                <circle cx="240" cy="480" r="3.5" fill={sec3.buckle ? '#fecaca' : '#ffffff'} fillOpacity="0.7" />
                <circle cx="240" cy="520" r="3.5" fill={sec3.buckle ? '#fecaca' : '#ffffff'} fillOpacity="0.7" />
              </g>

              {/* DOWNHOLE PLUNGER PUMP (1,150 m TVD) */}
              <g id="pump-assembly">
                {/* Pump Barrel */}
                <rect x="231" y="545" width="18" height="35" fill="#ffffff" stroke="#0284c7" strokeWidth="1.5" />
                
                {/* Plunger Body */}
                <rect x="233" y="550" width="14" height="24" fill="#cbd5e1" stroke="#64748b" />

                {/* Traveling Valve (TV) */}
                <circle
                  cx="240"
                  cy="557"
                  r="3"
                  fill={phaseDeg >= 180 ? '#059669' : '#94a3b8'}
                  stroke="#ffffff"
                  strokeWidth="1"
                />
                <text x="252" y="559" className="text-[7.5px] fill-slate-600 font-mono">TV</text>

                {/* Standing Valve (SV) */}
                <circle
                  cx="240"
                  cy="573"
                  r="3"
                  fill={phaseDeg < 180 ? '#059669' : '#94a3b8'}
                  stroke="#ffffff"
                  strokeWidth="1"
                />
                <text x="252" y="575" className="text-[7.5px] fill-slate-600 font-mono">SV</text>
              </g>
            </g>

            {/* Perforations at Jodhpur Sandstone */}
            <g stroke="#d97706" strokeWidth="2">
              <line x1="205" y1="565" x2="210" y2="565" />
              <line x1="205" y1="575" x2="210" y2="575" />
              <line x1="270" y1="565" x2="275" y2="565" />
              <line x1="270" y1="575" x2="275" y2="575" />
            </g>

            {/* Compressive Buckling Alert Callout */}
            {(sec3.buckle || isBuckling) && (
              <g transform="translate(65, 430)">
                <rect x="0" y="0" width="145" height="52" rx="4" fill="#fef2f2" stroke="#dc2626" strokeWidth="1.5" />
                <text x="8" y="16" className="text-[9.5px] fill-rose-700 font-mono font-bold">
                  COMPRESSIVE BUCKLING
                </text>
                <text x="8" y="30" className="text-[8.5px] fill-rose-800 font-mono">
                  F_down = {minTensionKn.toFixed(2)} kN (&lt; 0.0 kN)
                </text>
                <text x="8" y="42" className="text-[8px] fill-slate-500 font-mono">
                  Section 3 float on downstroke
                </text>
              </g>
            )}
          </svg>
        </div>

        {/* Technical Depth Inspector Tool (Bottom Rail) */}
        <div className="bg-white border-t border-slate-200 p-2.5 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-3">
            <span className="text-slate-500 font-sans font-medium text-[11px]">Depth node:</span>
            <select
              value={inspectedDepth}
              onChange={(e) => setInspectedDepth(parseInt(e.target.value))}
              className="text-xs font-mono bg-slate-50 border border-slate-300 rounded px-2 py-0.5 text-slate-800 focus:outline-none focus:border-sky-500"
            >
              <option value="200">200 m (Sec 1 - 1.000")</option>
              <option value="550">550 m (Sec 2 - 0.875")</option>
              <option value="950">950 m (Sec 3 - 0.750")</option>
              <option value="1150">1,150 m (Plunger Sandface)</option>
            </select>
          </div>

          <div className="flex items-center gap-4 text-[11px] tabular-nums">
            <div>
              <span className="text-slate-500">Stress: </span>
              <span className={`font-bold ${insp.stressMpa < 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                {insp.stressMpa.toFixed(1)} MPa
              </span>
            </div>
            <div>
              <span className="text-slate-500">Axial Force: </span>
              <span className={`font-semibold ${
                insp.forceKn < 0 ? 'text-rose-600' : insp.forceKn < 0.5 ? 'text-orange-600' : insp.forceKn <= 2.0 ? 'text-amber-600' : 'text-sky-700'
              }`}>
                {insp.forceKn >= 0 ? `+${insp.forceKn.toFixed(2)}` : insp.forceKn.toFixed(2)} kN
              </span>
            </div>
            <div>
              <span className="text-slate-500">Safety factor: </span>
              <span className={`font-bold ${insp.safetyFactor < 1.0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {insp.safetyFactor.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WellboreSimulator;
