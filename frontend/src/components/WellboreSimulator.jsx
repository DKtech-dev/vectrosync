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
    <div className="panel-hero theme-transition p-4 flex flex-col h-full">
      {/* Viewport Header — the single hero panel gets one title + one live chip. */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-hairline mb-3 gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-interactive" />
          <span className="section-title">Animated Wellbore Schematic — Reduced-Order Model</span>
        </div>

        <div className="flex items-center gap-2 readout text-[11px] text-muted">
          {isWsConnected ? (
            <span className="chip text-safe bg-safe/10 border-safe/30">
              <span className="w-1.5 h-1.5 rounded-full bg-safe vs-live-dot" />
              WS STREAM (25Hz)
            </span>
          ) : (
            <span className="chip text-muted bg-surface-2 border-hairline">LOCAL KINEMATICS</span>
          )}
          <button
            type="button"
            aria-pressed={showStrata}
            onClick={() => setShowStrata(!showStrata)}
            className={`btn px-2 py-0.5 rounded text-[10.5px] border ${
              showStrata ? 'bg-surface-2 border-hairline text-interactive' : 'bg-surface-1 border-hairline text-faint'
            }`}
          >
            CASE STRATA
          </button>
          <span>θ = {phaseDeg.toFixed(1)}°</span>
          <span>·</span>
          <span className="text-interactive font-bold">
            <AnimatedNumber value={spm} format={(v) => v.toFixed(1)} /> SPM
          </span>
        </div>
      </div>

      {/* Main SCADA Schematic Viewport */}
      <div className="relative flex-1 min-h-[580px] panel-inset overflow-hidden flex flex-col justify-between">
        {/* SVG Wellbore Drafting Canvas */}
        <div className="relative w-full h-[520px] flex justify-center">
          <svg
            viewBox="0 0 480 620"
            role="img"
            aria-labelledby="wellbore-model-title wellbore-model-desc"
            className="w-full h-full max-w-[480px]"
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
                <stop offset="0%" style={{ stopColor: 'rgb(var(--bg-surface-2))' }} />
                <stop offset="50%" style={{ stopColor: 'rgb(var(--border-hairline))' }} />
                <stop offset="100%" style={{ stopColor: 'rgb(var(--bg-surface-2))' }} />
              </linearGradient>
            </defs>

            {/* GEOLOGICAL STRATIGRAPHY */}
            {showStrata && (
              <g id="geology-layers" opacity="0.6">
                <rect x="0" y="140" width="480" height="110" className="fill-surface-1" />
                <text x="415" y="195" className="text-[8.5px] fill-faint font-mono">Overburden</text>

                <rect x="0" y="250" width="480" height="130" className="fill-surface-2" />
                <text x="395" y="315" className="text-[8.5px] fill-faint font-mono">Nagaur Shale</text>

                <rect x="0" y="380" width="480" height="130" className="fill-surface-1" />
                <text x="385" y="445" className="text-[8.5px] fill-faint font-mono">Bilara Carbonate</text>

                {/* Jodhpur Sandstone Target Reservoir (950 - 1,150 m) */}
                <rect x="0" y="510" width="480" height="100" style={{ fill: 'rgb(var(--accent-caution) / 0.16)' }} />
                <text x="330" y="555" className="text-[9px] fill-caution font-mono font-bold">
                  Jodhpur Sandstone (1,150 m)
                </text>
              </g>
            )}

            {/* Surface Ground Level Line */}
            <line x1="0" y1="140" x2="480" y2="140" className="stroke-muted" strokeWidth="1.5" />
            <rect x="185" y="132" width="110" height="8" className="fill-surface-2 stroke-muted" strokeWidth="1" />
            <text x="420" y="136" className="text-[9px] fill-muted font-mono font-semibold">GL (0 m)</text>

            {/* Technical Depth Ruler Grid (Left Rail) */}
            <g className="text-[9px] fill-faint font-mono">
              <line x1="55" y1="140" x2="55" y2="580" className="stroke-hairline" strokeWidth="1" strokeDasharray="3 3" />

              <line x1="50" y1="140" x2="60" y2="140" className="stroke-muted" strokeWidth="1" />
              <text x="22" y="143">0 m</text>

              <line x1="50" y1="260" x2="60" y2="260" className="stroke-muted" strokeWidth="1" />
              <text x="14" y="263">350 m</text>

              <line x1="50" y1="390" x2="60" y2="390" className="stroke-muted" strokeWidth="1" />
              <text x="14" y="393">750 m</text>

              <line x1="50" y1="580" x2="60" y2="580" className="stroke-muted" strokeWidth="1" />
              <text x="8" y="583">1,150 m</text>
            </g>

            {/* SURFACE PUMPING UNIT */}
            <g id="surface-unit">
              {/* Samson Post (A-Frame) */}
              <polygon points="130,140 155,55 180,140" className="fill-surface-2 stroke-muted" strokeWidth="1.5" />
              <line x1="142" y1="98" x2="168" y2="98" className="stroke-muted" strokeWidth="1" />

              {/* Walking Beam Pivot Assembly */}
              <g transform={`rotate(${beamAngle}, 155, 55)`}>
                <rect x="75" y="50" width="160" height="10" rx="1" className="fill-surface-2 stroke-interactive" strokeWidth="1.5" />

                {/* Horsehead Arc */}
                <path d="M 235,55 Q 248,70 240,105 L 230,105 Q 238,70 225,55 Z" className="fill-interactive stroke-interactive" />

                {/* Counterweight */}
                <rect x="80" y="42" width="28" height="26" rx="1" className="fill-muted stroke-muted" strokeWidth="1" />
                <text x="86" y="58" className="text-[7.5px] fill-surface-1 font-mono font-bold">CW</text>

                {/* Pitman Pin */}
                <circle cx="95" cy="55" r="3" className="fill-muted stroke-muted" strokeWidth="1" />
              </g>

              {/* Center Pivot Bearing */}
              <circle cx="155" cy="55" r="4.5" className="fill-interactive stroke-surface-1" strokeWidth="1.5" />

              {/* Carrier Bar & Bridle Wireline */}
              <line x1="240" y1="100" x2="240" y2="135" className="stroke-muted" strokeWidth="1.5" />
              <rect x="232" y="135" width="16" height="5" rx="0.5" className="fill-muted" />
            </g>

            {/* SUBSURFACE WELLBORE & CASING */}
            <rect x="210" y="140" width="60" height="445" className="fill-surface-1 stroke-muted" strokeWidth="1.5" />

            {/* Annular Heavy Crude Fluid Column */}
            <rect x="215" y="140" width="50" height="445" fill="url(#fluidColumnGrad)" opacity="0.9" />

            {/* Thermal Steam Plume (Jodhpur Sandface 1,100 to 1,150 m) */}
            <ellipse cx="240" cy="570" rx="95" ry="35" fill="url(#scadaThermalPlume)" />

            {/* TAPER SECTION INTERFACE MARKERS */}
            <line x1="210" y1="260" x2="270" y2="260" className="stroke-muted" strokeWidth="1.5" strokeDasharray="3 2" />
            <text x="278" y="263" className="text-[9px] fill-faint font-mono">Taper 1: 1.0" → 7/8" (350 m)</text>

            <line x1="210" y1="390" x2="270" y2="390" className="stroke-muted" strokeWidth="1.5" strokeDasharray="3 2" />
            <text x="278" y="393" className="text-[9px] fill-faint font-mono">Taper 2: 7/8" → 3/4" (750 m)</text>

            {/* SUCKER ROD STRING (Kinematic Stroke Driven with Tensor Stress Colors) */}
            <g transform={`translate(0, ${rodOffset})`}>
              {/* Polished Rod */}
              <rect x="238" y="130" width="4" height="20" className="fill-muted" />

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
                <rect x="233" y="550" width="14" height="24" className="fill-surface-2 stroke-muted" />

                {/* Traveling Valve (TV) */}
                <circle
                  cx="240"
                  cy="557"
                  r="3"
                  style={{ fill: phaseDeg >= 180 ? 'rgb(var(--accent-safe))' : 'rgb(var(--text-tertiary))' }}
                  className="stroke-surface-1"
                  strokeWidth="1"
                />
                <text x="252" y="559" className="text-[7.5px] fill-muted font-mono">TV</text>

                {/* Standing Valve (SV) */}
                <circle
                  cx="240"
                  cy="573"
                  r="3"
                  style={{ fill: phaseDeg < 180 ? 'rgb(var(--accent-safe))' : 'rgb(var(--text-tertiary))' }}
                  className="stroke-surface-1"
                  strokeWidth="1"
                />
                <text x="252" y="575" className="text-[7.5px] fill-muted font-mono">SV</text>
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
                <rect x="0" y="0" width="145" height="52" rx="4" style={{ fill: 'rgb(var(--accent-critical) / 0.12)', stroke: 'rgb(var(--accent-critical))' }} strokeWidth="1.5" />
                <text x="8" y="16" className="text-[9.5px] fill-critical font-mono font-bold">MODELED COMPRESSION SCREEN</text>
                <text x="8" y="30" className="text-[8.5px] fill-critical font-mono">
                  F_down = {minTensionKn.toFixed(2)} kN (&lt; 0.0 kN)
                </text>
                <text x="8" y="42" className="text-[8px] fill-faint font-mono">Investigate section 3 assumption</text>
              </g>
            )}
          </svg>
        </div>

        {/* Technical Depth Inspector Tool (Bottom Rail) */}
        <div className="bg-surface-1 border-t border-hairline p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-3">
            <label htmlFor="modeled-depth-node" className="text-muted font-medium text-[11px]">
              Modeled depth node:
            </label>
            <select
              id="modeled-depth-node"
              value={inspectedDepth}
              onChange={(e) => setInspectedDepth(parseInt(e.target.value))}
              className="readout text-xs bg-surface-2 border border-hairline rounded px-2 py-1 text-ink focus:border-interactive"
            >
              <option value="200">200 m (Sec 1 - 1.000")</option>
              <option value="550">550 m (Sec 2 - 0.875")</option>
              <option value="950">950 m (Sec 3 - 0.750")</option>
              <option value="1150">1,150 m (Plunger Sandface)</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 readout text-[11px]">
            <div>
              <span className="text-muted">Stress: </span>
              <span className={`font-bold ${insp.stressMpa < 0 ? 'text-critical' : 'text-ink'}`}>
                {insp.stressMpa.toFixed(1)} MPa
              </span>
            </div>
            <div>
              <span className="text-muted">Axial Force: </span>
              <span
                className={`font-semibold ${
                  insp.forceKn < 0.5 ? 'text-critical' : insp.forceKn <= 2.0 ? 'text-caution' : 'text-safe'
                }`}
              >
                {insp.forceKn >= 0 ? `+${insp.forceKn.toFixed(2)}` : insp.forceKn.toFixed(2)} kN
              </span>
            </div>
            <div>
              <span className="text-muted">Tension screen: </span>
              <span className={`font-bold ${insp.forceKn < 0.5 ? 'text-critical' : 'text-safe'}`}>{insp.tensionScreen}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-3 readout text-[10.5px] text-caution bg-caution/10 border border-caution/30 rounded px-3 py-1.5">
        Synthetic animated schematic; geometry, strata, stress, and force are model assumptions/outputs, not live downhole
        observations. Buckling, contact, fatigue, and safety factor are not evaluated.
      </div>
    </div>
  );
}

export default WellboreSimulator;
