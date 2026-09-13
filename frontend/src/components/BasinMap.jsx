import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Navigation } from 'lucide-react';
import { AnimatedNumber } from './AnimatedNumber';

/**
 * Conceptual sector layout for the Baghewala heavy-oil field (Jodhpur
 * Sandstone, Bikaner–Nagaur Basin, Rajasthan): 23 producing wells at ~1150 m
 * TVD, arranged on a schematic steam-header grid.
 *
 * The node positions are a *drawing*, not a survey — this is stated in the
 * panel, in the SVG <desc>, and on the layout itself. Well 14 is the only node
 * carrying live values; it mirrors the active model pass.
 *
 * a11y: the 23 nodes form a single composite widget (`role="toolbar"` +
 * roving tabindex), so the map is one tab stop rather than 23. Selection is
 * exposed with `aria-pressed`, and focus is drawn as an explicit SVG ring
 * because CSS `outline` does not render usefully on `<g>` in most engines.
 */

const ACTIVE_WELL = 'W14';

/* Schematic grid: five rows hung off three horizontal steam headers and one
   vertical trunk from the central steam plant. 5 + 6 + 5 + 6 + 1 = 23. */
const LAYOUT = [
  ['W01', 120, 72], ['W02', 190, 72], ['W03', 260, 72], ['W04', 330, 72], ['W05', 400, 72],
  ['W06', 85, 140], ['W07', 155, 140], ['W08', 225, 140], ['W09', 295, 140], ['W10', 365, 140], ['W11', 435, 140],
  ['W12', 120, 205], ['W13', 190, 205], ['W14', 260, 205], ['W15', 330, 205], ['W16', 400, 205],
  ['W17', 85, 272], ['W18', 155, 272], ['W19', 225, 272], ['W20', 295, 272], ['W21', 365, 272], ['W22', 435, 272],
  ['W23', 260, 336],
];

/* Per-node modelled state. Well 14 is overridden with the live pass. */
const STATE = {
  W01: [185, 4.2], W02: [120, 3.8], W03: [210, 4.5], W04: [95, 3.5], W05: [160, 4.0],
  W06: [190, 4.1], W07: [75, 3.2], W08: [220, 4.4], W09: [110, 3.6], W10: [170, 4.0], W11: [58, 2.8],
  W12: [65, 3.0], W13: [205, 4.3], W14: [260, 4.7], W15: [145, 3.9], W16: [130, 3.7],
  W17: [240, 4.6], W18: [90, 3.4], W19: [180, 4.1], W20: [112, 3.6], W21: [155, 3.9], W22: [70, 3.1],
  W23: [198, 4.2],
};

function phaseFor(tempC) {
  if (tempC >= 230) return { label: 'Steam injection', tone: 'thermal' };
  if (tempC >= 170) return { label: 'Post-soak production', tone: 'thermal' };
  if (tempC >= 110) return { label: 'Cooling drawdown', tone: 'caution' };
  return { label: 'Near native temperature', tone: 'faint' };
}

const FILL = {
  thermal: 'rgb(var(--accent-thermal))',
  caution: 'rgb(var(--accent-caution))',
  faint: 'rgb(var(--text-tertiary))',
};

export function BasinMap({ currentTempC = 260.0, currentSpm = 4.7 }) {
  const [selectedWell, setSelectedWell] = useState(ACTIVE_WELL);
  const [focusedWell, setFocusedWell] = useState(null);
  const svgRef = useRef(null);

  const wells = useMemo(
    () =>
      LAYOUT.map(([id, x, y]) => {
        const isActive = id === ACTIVE_WELL;
        const temp = isActive ? currentTempC : STATE[id][0];
        const spm = isActive ? currentSpm : STATE[id][1];
        return { id, x, y, temp, spm, isActive, phase: phaseFor(temp) };
      }),
    [currentTempC, currentSpm],
  );

  const selected = wells.find((w) => w.id === selectedWell) || wells[0];

  const moveSelection = useCallback(
    (fromIndex, delta) => {
      const next = (fromIndex + delta + wells.length) % wells.length;
      const nextId = wells[next].id;
      setSelectedWell(nextId);
      requestAnimationFrame(() => svgRef.current?.querySelector(`#well-node-${nextId}`)?.focus());
    },
    [wells],
  );

  const handleKeyDown = (event, index) => {
    const { key } = event;
    if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      setSelectedWell(wells[index].id);
      return;
    }
    let delta = null;
    if (key === 'ArrowRight' || key === 'ArrowDown') delta = 1;
    if (key === 'ArrowLeft' || key === 'ArrowUp') delta = -1;
    if (key === 'Home') delta = -index;
    if (key === 'End') delta = wells.length - 1 - index;
    if (delta === null) return;
    event.preventDefault();
    moveSelection(index, delta);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Map */}
      <div className="panel-nested p-4">
        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-3 pb-3.5 mb-3.5 border-b border-hairline">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="icon-badge w-6 h-6 tone-signal">
              <Navigation className="w-3.5 h-3.5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h3 className="panel-title">Sector layout · 23 producing wells</h3>
              <p className="caption">Jodhpur Sandstone · 1150 m TVD · Bikaner–Nagaur Basin</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <span className="pill tone-signal">
              <span className="chip-dot" aria-hidden="true" />
              W14 · live pass
            </span>
            <span className="pill tone-thermal">≥170 °C</span>
            <span className="pill tone-caution">110–170 °C</span>
            <span className="pill">&lt;110 °C</span>
          </div>
        </div>

        <p className="caption mb-3.5">
          Schematic layout: node positions follow the steam-header grid, not surveyed coordinates. Every value except
          Well 14 is a fixed illustrative figure. Use arrow keys to step between wells.
        </p>

        <svg
          ref={svgRef}
          viewBox="0 0 520 380"
          role="group"
          aria-labelledby="sector-map-title"
          aria-describedby="sector-map-desc"
          className="w-full h-auto well"
        >
          <title id="sector-map-title">Baghewala sector layout, 23 selectable wells</title>
          <desc id="sector-map-desc">
            A schematic drawing of 23 producing wells on a steam-header grid, coloured by modelled near-wellbore
            temperature. Positions are illustrative, not surveyed coordinates.
          </desc>

          <defs>
            <radialGradient id="sectorPlume" cx="50%" cy="40%" r="38%">
              <stop offset="0%" stopColor="rgb(var(--accent-thermal))" stopOpacity="0.18" />
              <stop offset="70%" stopColor="rgb(var(--accent-thermal))" stopOpacity="0.05" />
              <stop offset="100%" stopColor="rgb(var(--accent-thermal))" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Lease boundary */}
          <path
            d="M 55,55 Q 260,18 470,62 Q 498,215 452,352 Q 250,374 72,320 Q 32,180 55,55 Z"
            fill="rgb(var(--bg-surface-2))"
            stroke="rgb(var(--border-strong))"
            strokeWidth="1"
            strokeDasharray="5 4"
          />

          {/* Thermal plume around the active pattern */}
          <circle cx="260" cy="180" r="150" fill="url(#sectorPlume)" />

          {/* Steam header network */}
          <g stroke="rgb(var(--border-strong))" strokeWidth="1" strokeDasharray="3 3" fill="none">
            <line x1="260" y1="36" x2="260" y2="336" />
            <line x1="72" y1="140" x2="448" y2="140" />
            <line x1="105" y1="205" x2="415" y2="205" />
            <line x1="72" y1="272" x2="448" y2="272" />
          </g>

          {/* Central steam generation facility */}
          <g>
            <rect
              x="236"
              y="16"
              width="48"
              height="20"
              rx="2"
              fill="rgb(var(--bg-surface-1))"
              stroke="rgb(var(--accent-interactive))"
              strokeWidth="1"
            />
            <text x="260" y="30" fontSize="10" fontWeight="700" fill="rgb(var(--accent-interactive))" textAnchor="middle">
              CSGF
            </text>
            <text x="292" y="30" fontSize="9.5" fill="rgb(var(--text-tertiary))">
              central steam generation · 260 °C
            </text>
          </g>

          {/* Well nodes — one composite widget, one tab stop */}
          <g role="toolbar" aria-label="Well selector, 23 wells" aria-orientation="horizontal">
            {wells.map((well, index) => {
              const isSelected = selectedWell === well.id;
              const isFocused = focusedWell === well.id;
              const radius = well.isActive ? 7 : isSelected ? 6 : 4.5;

              return (
                <g
                  key={well.id}
                  id={`well-node-${well.id}`}
                  transform={`translate(${well.x}, ${well.y})`}
                  role="button"
                  aria-pressed={isSelected}
                  aria-label={`Well ${well.id.slice(1)}, ${well.phase.label}, ${well.temp.toFixed(0)} degrees Celsius, ${well.spm.toFixed(1)} strokes per minute`}
                  tabIndex={isSelected ? 0 : -1}
                  className="cursor-pointer focus:outline-none"
                  onClick={() => setSelectedWell(well.id)}
                  onFocus={() => setFocusedWell(well.id)}
                  onBlur={() => setFocusedWell(null)}
                  onKeyDown={(event) => handleKeyDown(event, index)}
                >
                  {/* Explicit focus ring: `outline` is unreliable on <g>. */}
                  {isFocused && (
                    <rect
                      x="-14"
                      y="-14"
                      width="28"
                      height="28"
                      rx="3"
                      fill="none"
                      stroke="rgb(var(--accent-interactive))"
                      strokeWidth="1.5"
                      strokeDasharray="3 2"
                      pointerEvents="none"
                    />
                  )}

                  {/* Generous invisible hit target — the marker itself is 9–14 px. */}
                  <circle cx="0" cy="0" r="16" fill="transparent" pointerEvents="all" />

                  {isSelected && (
                    <circle
                      cx="0"
                      cy="0"
                      r={radius + 4}
                      fill="none"
                      stroke="rgb(var(--accent-interactive))"
                      strokeWidth="1.25"
                      pointerEvents="none"
                    />
                  )}

                  <circle
                    cx="0"
                    cy="0"
                    r={radius}
                    fill={well.isActive ? 'rgb(var(--accent-interactive))' : FILL[well.phase.tone]}
                    stroke="rgb(var(--bg-surface-1))"
                    strokeWidth="1.5"
                    pointerEvents="none"
                  />

                  <text
                    x="0"
                    y="20"
                    fontSize="10"
                    fontWeight={well.isActive || isSelected ? 700 : 500}
                    fill={
                      well.isActive
                        ? 'rgb(var(--accent-interactive))'
                        : isSelected
                          ? 'rgb(var(--text-primary))'
                          : 'rgb(var(--text-secondary))'
                    }
                    textAnchor="middle"
                    pointerEvents="none"
                  >
                    {well.id}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Selected-well inspector */}
      <div className="panel-nested p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="icon-badge w-9 h-9 tone-signal readout text-[11px] font-bold">
            {selected.id.replace('W', '')}
          </span>
          <div className="flex flex-col gap-1.5 min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="panel-title">Well {selected.id.slice(1)}</span>
              <span className={`pill ${selected.phase.tone === 'faint' ? '' : `tone-${selected.phase.tone}`}`}>
                <span className="chip-dot" aria-hidden="true" />
                {selected.phase.label}
              </span>
            </span>
            <span className="caption">
              {selected.isActive
                ? 'Mirrors the active model pass — the only node with live values.'
                : 'Fixed illustrative node · 7″ casing / 3-taper rod string assumed.'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-start gap-6 shrink-0">
          <div className="flex flex-col gap-1">
            <span className="unit-label">Near-wellbore T · °C</span>
            <AnimatedNumber value={selected.temp} format={(v) => v.toFixed(1)} className="metric-secondary text-thermal" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="unit-label">Pumping speed · SPM</span>
            <AnimatedNumber value={selected.spm} format={(v) => v.toFixed(2)} className="metric-secondary text-ink" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default BasinMap;
