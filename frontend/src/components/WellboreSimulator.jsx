import React, { useEffect, useState, useMemo, useRef } from 'react';
import { getApiKey } from '../utils/api';
import { AnimatedNumber } from './AnimatedNumber';

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
  onWsStatusChange = null,
}) {
  const [phaseDeg, setPhaseDeg] = useState(0);
  const [inspectedDepth, setInspectedDepth] = useState(950);
  const [showStrata, setShowStrata] = useState(true);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const wsRef = useRef(null);

  // WebSocket Live Stream consumer (/ws/live-stream)
  useEffect(() => {
    let ws;
    let isMounted = true;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const apiKey = getApiKey();
      const query = apiKey ? `?api_key=${encodeURIComponent(apiKey)}` : '';
      const wsUrl = `${protocol}//${window.location.host}/ws/live-stream${query}`;
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isMounted) {
          setIsWsConnected(true);
          if (onWsStatusChange) onWsStatusChange(true);
        }
      };

      ws.onmessage = (event) => {
        if (!isMounted || !isPlaying) return;
        try {
          const packet = JSON.parse(event.data);
          if (typeof packet.phase_deg === 'number') {
            setPhaseDeg(packet.phase_deg);
          }
        } catch {
          // Ignore parse errors on raw stream
        }
      };

      ws.onerror = () => {
        if (isMounted) {
          setIsWsConnected(false);
          if (onWsStatusChange) onWsStatusChange(false);
        }
      };

      ws.onclose = () => {
        if (isMounted) {
          setIsWsConnected(false);
          if (onWsStatusChange) onWsStatusChange(false);
        }
      };
    } catch {
      if (isMounted) {
        setIsWsConnected(false);
        if (onWsStatusChange) onWsStatusChange(false);
      }
    }

    return () => {
      isMounted = false;
      if (ws) {
        ws.close();
      }
    };
  }, [isPlaying, onWsStatusChange]);

  // Real-time kinematics clock fallback when WebSocket is offline
  useEffect(() => {
    if (!isPlaying || isWsConnected) return;

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
  }, [spm, isPlaying, simSpeed, isWsConnected]);

  // Geometric Kinematics
  const phaseRad = (phaseDeg * Math.PI) / 180;
  const beamAngle = Math.sin(phaseRad) * 8.5; // Walking beam mechanical tilt angle (+/- 8.5 deg)
  const rodOffset = Math.sin(phaseRad) * 18; // Polished rod vertical reciprocation stroke (+/- 18 px)

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

    // Visual screening only: color by the implemented axial-force thresholds.
    // Semantics: tension OK -> safe, marginal/below-floor -> caution, compression -> critical.
    let fill = 'rgb(var(--accent-safe))';
    let stroke = 'rgb(var(--accent-safe))';
    let compressionAlert = false;

    if (forceKn < 0.0 || (isSection3 && (isBuckling || minTensionKn < 0.0))) {
      fill = 'rgb(var(--accent-critical))';
      stroke = 'rgb(var(--accent-critical))';
      compressionAlert = isSection3;
    } else if (forceKn <= 2.0) {
      // below the +0.5 kN floor or marginal tension band
      fill = 'rgb(var(--accent-caution))';
      stroke = 'rgb(var(--accent-caution))';
    } else {
      fill = 'rgb(var(--accent-safe))';
      stroke = 'rgb(var(--accent-safe))';
    }

    return {
      stressMpa,
      forceKn,
      fill,
      stroke,
      compressionAlert,
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

    const tensionScreen =
      forceKn < 0.0 ? 'Modeled compression' : forceKn < 0.5 ? 'Below advisory floor' : 'Advisory floor met';

    return {
      section,
      areaCm2,
      stressMpa,
      forceKn,
      tensionScreen,
    };
  };

  const insp = getInspectedTelemetry(inspectedDepth);

  return (
    <div className="card p-5 flex flex-col gap-4">
      {/* Header — one title plus the single real-state live pill. */}
      <div className="flex items-center justify-between gap-3">
        <span className="card-title truncate">Wellbore schematic</span>
        {isWsConnected ? (
          <span className="pill bg-safe/10 text-safe shrink-0">
            <span className="chip-dot vs-live-dot" />
            Live
          </span>
        ) : (
          <span className="pill bg-surface-2 text-muted shrink-0">
            <span className="chip-dot" />
            Local
          </span>
        )}
      </div>

      {/* Compact control + kinematics readout row */}
      <div className="flex items-center justify-between gap-3">
        <div className="segmented">
          <button
            type="button"
            aria-pressed={showStrata}
            onClick={() => setShowStrata(!showStrata)}
            className="segmented-item"
          >
            Strata
          </button>
        </div>

        <div className="flex items-baseline gap-2 text-[12px]">
          <span className="readout text-muted">θ {phaseDeg.toFixed(1)}°</span>
          <span className="text-faint">·</span>
          <span className="readout font-semibold text-interactive">
            <AnimatedNumber value={spm} format={(v) => v.toFixed(1)} /> SPM
          </span>
        </div>
      </div>

      {/* Schematic bed */}
      <div className="card-nested p-4">
        {/* aspect-ratio-locked to the viewBox instead of a fixed pixel height,
            so the schematic never letterboxes or squashes regardless of the
            column width it renders in. */}
        <div className="relative w-full flex justify-center" style={{ aspectRatio: '480 / 620' }}>
          <svg
            viewBox="0 0 480 620"
            role="img"
            aria-labelledby="wellbore-model-title wellbore-model-desc"
            className="w-full h-full"
            xmlns="http://www.w3.org/2000/svg"
          >
            <title id="wellbore-model-title">Animated synthetic wellbore model</title>
            <desc id="wellbore-model-desc">
              Illustrative pumping-unit and three-section rod-string schematic driven by reduced-order model values; not a
              field visualization.
            </desc>
            <defs>
              {/* Thermal Steam Plume Gradient — maps to formation thermal state (caution hue) */}
              <radialGradient id="scadaThermalPlume" cx="50%" cy="50%" r="50%">
                <stop offset="0%" style={{ stopColor: 'rgb(var(--accent-caution))', stopOpacity: 0.3 }} />
                <stop offset="60%" style={{ stopColor: 'rgb(var(--accent-caution))', stopOpacity: 0.08 }} />
                <stop offset="100%" style={{ stopColor: 'rgb(var(--bg-surface-2))', stopOpacity: 0 }} />
              </radialGradient>

              {/* Heavy Oil Column Gradient */}
              <linearGradient id="fluidColumnGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" style={{ stopColor: 'rgb(var(--bg-surface-1))' }} />
                <stop offset="50%" style={{ stopColor: 'rgb(var(--text-tertiary))', stopOpacity: 0.16 }} />
                <stop offset="100%" style={{ stopColor: 'rgb(var(--bg-surface-1))' }} />
              </linearGradient>
            </defs>

            {/* GEOLOGICAL STRATIGRAPHY */}
            {showStrata && (
              <g id="geology-layers">
                <rect x="0" y="140" width="480" height="110" style={{ fill: 'rgb(var(--bg-surface-1))' }} />
                <text x="415" y="195" className="text-[8.5px] fill-faint">Overburden</text>

                <rect x="0" y="250" width="480" height="130" style={{ fill: 'rgb(var(--text-tertiary) / 0.07)' }} />
                <text x="395" y="315" className="text-[8.5px] fill-faint">Nagaur Shale</text>

                <rect x="0" y="380" width="480" height="130" style={{ fill: 'rgb(var(--bg-surface-1))' }} />
                <text x="385" y="445" className="text-[8.5px] fill-faint">Bilara Carbonate</text>

                {/* Jodhpur Sandstone Target Reservoir (950 - 1,150 m) */}
                <rect x="0" y="510" width="480" height="100" style={{ fill: 'rgb(var(--accent-caution) / 0.1)' }} />
                <text x="330" y="555" className="text-[9px] fill-caution font-semibold">
                  Jodhpur Sandstone (1,150 m)
                </text>
              </g>
            )}

            {/* Surface Ground Level Line */}
            <line x1="0" y1="140" x2="480" y2="140" className="stroke-faint" strokeWidth="1.25" />
            <rect x="185" y="132" width="110" height="8" className="fill-surface-2 stroke-faint" strokeWidth="1" />
            <text x="420" y="136" className="text-[9px] fill-faint font-mono">GL (0 m)</text>

            {/* Technical Depth Ruler Grid (Left Rail) */}
            <g className="text-[9px] fill-faint font-mono">
              <line x1="55" y1="140" x2="55" y2="580" className="stroke-grid" strokeWidth="1" strokeDasharray="3 3" />

              <line x1="50" y1="140" x2="60" y2="140" className="stroke-faint" strokeWidth="1" />
              <text x="22" y="143">0 m</text>

              <line x1="50" y1="260" x2="60" y2="260" className="stroke-faint" strokeWidth="1" />
              <text x="14" y="263">350 m</text>

              <line x1="50" y1="390" x2="60" y2="390" className="stroke-faint" strokeWidth="1" />
              <text x="14" y="393">750 m</text>

              <line x1="50" y1="580" x2="60" y2="580" className="stroke-faint" strokeWidth="1" />
              <text x="8" y="583">1,150 m</text>
            </g>

            {/* SURFACE PUMPING UNIT */}
            <g id="surface-unit">
              {/* Samson Post (A-Frame) */}
              <polygon points="130,140 155,55 180,140" className="fill-surface-1 stroke-faint" strokeWidth="1.25" />
              <line x1="142" y1="98" x2="168" y2="98" className="stroke-faint" strokeWidth="1" />

              {/* Walking Beam Pivot Assembly */}
              <g transform={`rotate(${beamAngle}, 155, 55)`}>
                <rect x="75" y="50" width="160" height="10" rx="1" className="fill-surface-1 stroke-interactive" strokeWidth="1.5" />

                {/* Horsehead Arc */}
                <path d="M 235,55 Q 248,70 240,105 L 230,105 Q 238,70 225,55 Z" className="fill-interactive stroke-interactive" />

                {/* Counterweight */}
                <rect x="80" y="42" width="28" height="26" rx="1" className="fill-interactive stroke-interactive" strokeWidth="1" />
                <text x="86" y="58" className="text-[7.5px] fill-surface-1 font-semibold">CW</text>

                {/* Pitman Pin */}
                <circle cx="95" cy="55" r="3" className="fill-surface-1 stroke-interactive" strokeWidth="1" />
              </g>

              {/* Center Pivot Bearing */}
              <circle cx="155" cy="55" r="4.5" className="fill-interactive stroke-surface-1" strokeWidth="1.5" />

              {/* Carrier Bar & Bridle Wireline */}
              <line x1="240" y1="100" x2="240" y2="135" className="stroke-faint" strokeWidth="1.25" />
              <rect x="232" y="135" width="16" height="5" rx="0.5" className="fill-faint" />
            </g>

            {/* SUBSURFACE WELLBORE & CASING */}
            <rect x="210" y="140" width="60" height="445" className="fill-surface-1 stroke-interactive/50" strokeWidth="1.5" />

            {/* Annular Heavy Crude Fluid Column */}
            <rect x="215" y="140" width="50" height="445" fill="url(#fluidColumnGrad)" opacity="0.8" />

            {/* Thermal Steam Plume (Jodhpur Sandface 1,100 to 1,150 m) */}
            <ellipse cx="240" cy="570" rx="95" ry="35" fill="url(#scadaThermalPlume)" />

            {/* TAPER SECTION INTERFACE MARKERS */}
            <line x1="210" y1="260" x2="270" y2="260" className="stroke-faint" strokeWidth="1.25" strokeDasharray="3 2" />
            <text x="278" y="263" className="text-[9px] fill-faint font-mono">Taper 1: 1.0" → 7/8" (350 m)</text>

            <line x1="210" y1="390" x2="270" y2="390" className="stroke-faint" strokeWidth="1.25" strokeDasharray="3 2" />
            <text x="278" y="393" className="text-[9px] fill-faint font-mono">Taper 2: 7/8" → 3/4" (750 m)</text>

            {/* SUCKER ROD STRING (Kinematic Stroke Driven with Tensor Stress Colors) */}
            <g transform={`translate(0, ${rodOffset})`}>
              {/* Polished Rod */}
              <rect x="238" y="130" width="4" height="20" className="fill-faint" />

              {/* Section 1: 1.0" Rod (0 to 350 m -> y=140 to 260) */}
              <rect x="237" y="140" width="6" height="120" style={{ fill: sec1.fill, stroke: sec1.stroke }} strokeWidth="1" />
              <circle cx="240" cy="180" r="4.5" className="fill-surface-1" fillOpacity="0.6" />
              <circle cx="240" cy="220" r="4.5" className="fill-surface-1" fillOpacity="0.6" />

              {/* Section 2: 7/8" Rod (350 to 750 m -> y=260 to 390) */}
              <rect x="237.5" y="260" width="5" height="130" style={{ fill: sec2.fill, stroke: sec2.stroke }} strokeWidth="1" />
              <circle cx="240" cy="305" r="4" className="fill-surface-1" fillOpacity="0.6" />
              <circle cx="240" cy="350" r="4" className="fill-surface-1" fillOpacity="0.6" />

              {/* Section 3: 3/4" Rod (750 to 1,150 m -> y=390 to 550) */}
              <g>
                <rect
                  x="238"
                  y="390"
                  width="4"
                  height="160"
                  style={{ fill: sec3.fill, stroke: sec3.stroke }}
                  strokeWidth={sec3.compressionAlert ? '2' : '1'}
                />
                <circle cx="240" cy="430" r="3.5" style={sec3.compressionAlert ? { fill: 'rgb(var(--accent-critical) / 0.4)' } : undefined} className={sec3.compressionAlert ? '' : 'fill-surface-1'} fillOpacity="0.7" />
                <circle cx="240" cy="480" r="3.5" style={sec3.compressionAlert ? { fill: 'rgb(var(--accent-critical) / 0.4)' } : undefined} className={sec3.compressionAlert ? '' : 'fill-surface-1'} fillOpacity="0.7" />
                <circle cx="240" cy="520" r="3.5" style={sec3.compressionAlert ? { fill: 'rgb(var(--accent-critical) / 0.4)' } : undefined} className={sec3.compressionAlert ? '' : 'fill-surface-1'} fillOpacity="0.7" />
              </g>

              {/* DOWNHOLE PLUNGER PUMP (1,150 m TVD) */}
              <g id="pump-assembly">
                <rect x="231" y="545" width="18" height="35" className="fill-surface-1 stroke-interactive" strokeWidth="1.5" />
                <rect x="233" y="550" width="14" height="24" className="fill-surface-2 stroke-faint" />

                {/* Traveling Valve (TV) */}
                <circle
                  cx="240"
                  cy="557"
                  r="3"
                  style={{ fill: phaseDeg >= 180 ? 'rgb(var(--accent-safe))' : 'rgb(var(--text-tertiary))' }}
                  className="stroke-surface-1"
                  strokeWidth="1"
                />
                <text x="252" y="559" className="text-[7.5px] fill-faint font-semibold">TV</text>

                {/* Standing Valve (SV) */}
                <circle
                  cx="240"
                  cy="573"
                  r="3"
                  style={{ fill: phaseDeg < 180 ? 'rgb(var(--accent-safe))' : 'rgb(var(--text-tertiary))' }}
                  className="stroke-surface-1"
                  strokeWidth="1"
                />
                <text x="252" y="575" className="text-[7.5px] fill-faint font-semibold">SV</text>
              </g>
            </g>

            {/* Perforations at Jodhpur Sandstone */}
            <g className="stroke-caution" strokeWidth="2">
              <line x1="205" y1="565" x2="210" y2="565" />
              <line x1="205" y1="575" x2="210" y2="575" />
              <line x1="270" y1="565" x2="275" y2="565" />
              <line x1="270" y1="575" x2="275" y2="575" />
            </g>

            {/* Reduced-order compression-screen callout */}
            {(sec3.compressionAlert || isBuckling) && (
              <g transform="translate(65, 430)">
                <rect
                  x="0"
                  y="0"
                  width="145"
                  height="52"
                  rx="6"
                  style={{ fill: 'rgb(var(--bg-surface-1))', stroke: 'rgb(var(--accent-critical) / 0.45)' }}
                  strokeWidth="1"
                />
                <text x="8" y="16" className="text-[9.5px] fill-critical font-semibold">Modeled compression screen</text>
                <text x="8" y="30" className="text-[8.5px] fill-critical font-mono">
                  F_down = {minTensionKn.toFixed(2)} kN (&lt; 0.0 kN)
                </text>
                <text x="8" y="42" className="text-[8px] fill-faint">Investigate section 3 assumption</text>
              </g>
            )}
          </svg>
        </div>
      </div>

      {/* Depth inspector — stacked for the narrow column */}
      <div className="card-nested p-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="modeled-depth-node" className="unit-label">
            Modeled depth node
          </label>
          <select
            id="modeled-depth-node"
            value={inspectedDepth}
            onChange={(e) => setInspectedDepth(parseInt(e.target.value))}
            className="readout text-[12.5px] w-full bg-surface-1 border border-hairline rounded-[10px] px-3 py-2 text-ink focus:border-interactive"
          >
            <option value="200">200 m (Sec 1 - 1.000")</option>
            <option value="550">550 m (Sec 2 - 0.875")</option>
            <option value="950">950 m (Sec 3 - 0.750")</option>
            <option value="1150">1,150 m (Plunger Sandface)</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-hairline">
          <div className="flex flex-col gap-1">
            <span className="unit-label">Stress &middot; MPa</span>
            <span className={`readout text-[17px] font-bold ${insp.stressMpa < 0 ? 'text-critical' : 'text-ink'}`}>
              {insp.stressMpa.toFixed(1)}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="unit-label">Axial force &middot; kN</span>
            <span
              className={`readout text-[17px] font-bold ${
                insp.forceKn < 0.5 ? 'text-critical' : insp.forceKn <= 2.0 ? 'text-caution' : 'text-safe'
              }`}
            >
              {insp.forceKn >= 0 ? `+${insp.forceKn.toFixed(2)}` : insp.forceKn.toFixed(2)}
            </span>
          </div>

          <div className="col-span-2 flex flex-col gap-1.5">
            <span className="unit-label">Tension screen</span>
            <span
              className={`pill self-start ${
                insp.forceKn < 0.5 ? 'bg-critical/10 text-critical' : 'bg-safe/10 text-safe'
              }`}
            >
              <span className="chip-dot" />
              {insp.tensionScreen}
            </span>
          </div>

          <div className="col-span-2 caption border-t border-hairline pt-3">{insp.section}</div>
        </div>
      </div>

      <p className="caption">
        Synthetic animated schematic. Geometry, strata, stress, and force are model assumptions, not live downhole
        observations. Buckling, contact, fatigue, and safety factor are not evaluated.
      </p>
    </div>
  );
}

export default WellboreSimulator;
