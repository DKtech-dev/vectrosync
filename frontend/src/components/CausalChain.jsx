import React, { useMemo } from 'react';
import { Flame, Thermometer, Droplets, Waves, MoveVertical, Gauge, Send } from 'lucide-react';
import { AnimatedNumber } from './AnimatedNumber';

/**
 * The hero visualization: the failure mechanism drawn as a signal path, not a
 * row of cards. Six instrument tags run left to right, and every connector is
 * annotated with the transfer that produces the next stage — so a reader can
 * see *why* elapsed soak days end up as a pump-speed command.
 *
 *   CSS day --Boberg-Lantz--> sandface T --Arrhenius x emulsion--> viscosity
 *     --annular Couette--> drag beta --rod statics--> min tension
 *     --MPC constraint--> advised SPM
 *
 * Every node is a live field from simState; nothing here is decorative.
 * Connector flow speed is driven by drag_beta (thicker oil visibly slows the
 * flow), and the chain re-propagates left-to-right with a short stagger when
 * the underlying scenario/data changes (via `propagateKey`).
 */

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

const NODE_MIN = 108;
const EDGE_W = 68;

function Connector({ model, seconds }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 self-center" aria-hidden="true">
      <span className="eyebrow text-center leading-[1.2] break-words px-0.5">{model}</span>
      <svg viewBox="0 0 68 10" className="w-full h-[10px]" preserveAspectRatio="none">
        <line
          x1="0"
          y1="5"
          x2="58"
          y2="5"
          className="vs-flow"
          style={{
            stroke: 'rgb(var(--accent-interactive))',
            strokeWidth: 1.5,
            animationDuration: `${seconds}s`,
          }}
        />
        <path d="M 58 1.5 L 66 5 L 58 8.5 Z" fill="rgb(var(--accent-interactive))" opacity="0.85" />
      </svg>
    </div>
  );
}

export function CausalChain({
  elapsedDays,
  temperatureC,
  viscosityCp,
  dragBeta,
  minTensionKn,
  effectiveSpm,
  targetSpm,
  isBuckling,
  propagateKey,
}) {
  const meetsFloor = isNum(minTensionKn) && minTensionKn >= 0.5;
  const tone = isBuckling || (isNum(minTensionKn) && minTensionKn < 0) ? 'critical' : meetsFloor ? 'safe' : 'caution';
  const toneClass = { safe: 'text-safe', caution: 'text-caution', critical: 'text-critical' }[tone];
  const tonePill = { safe: 'tone-safe', caution: 'tone-caution', critical: 'tone-critical' }[tone];

  // Flow speed: viscous oil visibly slows the animation (2.4 s idle -> ~0.5 s
  // at extreme drag). Clamped so it never fully stops or races unreadably.
  const flowSeconds = useMemo(() => {
    const s = 2.4 - Math.min(1.9, (isNum(dragBeta) ? dragBeta : 0) / 60);
    return Math.max(0.5, Number.isFinite(s) ? s : 1.2);
  }, [dragBeta]);

  const viscKilo = isNum(viscosityCp) && viscosityCp >= 1000;

  const stages = [
    {
      key: 'soak',
      tag: 'CSS-01',
      icon: Flame,
      label: 'Elapsed soak',
      value: elapsedDays,
      format: (v) => v.toFixed(0),
      unit: 'days',
      tone: 'text-thermal',
      edge: 'Boberg–Lantz',
    },
    {
      key: 'temp',
      tag: 'TI-101',
      icon: Thermometer,
      label: 'Sandface temp',
      value: temperatureC,
      format: (v) => v.toFixed(1),
      unit: '°C',
      tone: 'text-thermal',
      note: '48 °C native',
      edge: 'Arrhenius ×emulsion',
    },
    {
      key: 'visc',
      tag: 'VI-201',
      icon: Droplets,
      label: 'Mixture viscosity',
      value: viscosityCp,
      format: (v) => (viscKilo ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)),
      unit: 'cP',
      tone: 'text-caution',
      edge: 'annular Couette',
    },
    {
      key: 'drag',
      tag: 'FE-301',
      icon: Waves,
      label: 'Drag coefficient β',
      value: dragBeta,
      format: (v) => v.toFixed(1),
      unit: 'N·s/m²',
      tone: 'text-caution',
      note: 'up on downstroke',
      edge: 'rod statics',
    },
    {
      key: 'tension',
      tag: 'WE-401',
      icon: MoveVertical,
      label: 'Min rod tension',
      value: minTensionKn,
      format: (v) => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2)),
      unit: 'kN',
      tone: toneClass,
      note: 'floor +0.50 kN',
      alert: Boolean(isBuckling),
      edge: 'MPC constraint',
    },
    {
      key: 'command',
      tag: 'SIC-501',
      icon: Send,
      label: 'Advised speed',
      value: effectiveSpm,
      format: (v) => v.toFixed(2),
      unit: 'SPM',
      tone: 'text-interactive',
      note: isNum(targetSpm) ? `req ${targetSpm.toFixed(2)}` : 'req unavailable',
    },
  ];

  const gridTemplateColumns = stages.map(() => `minmax(${NODE_MIN}px, 1fr)`).join(` ${EDGE_W}px `);
  const minWidth = stages.length * NODE_MIN + (stages.length - 1) * EDGE_W;

  let caption;
  if (!isNum(minTensionKn) || !isNum(effectiveSpm)) {
    caption = 'Rod-tension or advised-speed output is unavailable, so the chain cannot be interpreted end to end.';
  } else if (isBuckling || minTensionKn < 0) {
    caption = `Annular drag now exceeds the submerged weight of the lower rod tapers on the downstroke: modelled minimum tension is ${minTensionKn.toFixed(2)} kN, so the string is in compression and helically buckling against the tubing. The advised ${effectiveSpm.toFixed(2)} SPM is the supervisor's protective response.`;
  } else if (meetsFloor) {
    caption = `Viscous drag from the cooling near-wellbore is absorbed by throttling to ${effectiveSpm.toFixed(2)} SPM${isNum(targetSpm) ? ` (requested ${targetSpm.toFixed(2)} SPM)` : ''}, holding +${minTensionKn.toFixed(2)} kN — ${(minTensionKn - 0.5).toFixed(2)} kN above the +0.50 kN anti-float floor.`;
  } else {
    caption = `Minimum tension is ${(0.5 - minTensionKn).toFixed(2)} kN below the +0.50 kN anti-float floor at the current advised speed. The supervisor is evaluating a protective ramp-down.`;
  }

  return (
    <section className="panel registered overflow-hidden" aria-labelledby="causal-chain-heading">
      <div className="panel-rail">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`icon-badge w-6 h-6 ${toneClass}`}>
            <Gauge className="w-3.5 h-3.5" />
          </span>
          <div className="min-w-0">
            <h2 id="causal-chain-heading" className="panel-title truncate">
              Causal chain
            </h2>
            <p className="caption truncate">Live signal path · steam soak to speed command</p>
          </div>
        </div>
        <span className={`pill ${tonePill} shrink-0`}>
          <span className="chip-dot" />
          {tone === 'critical' ? 'Compression risk' : tone === 'safe' ? 'Tension held' : 'Below floor'}
        </span>
      </div>

      <div className="overflow-x-auto blueprint">
        {/* A div-based list: the connectors between nodes are decorative, and
            an <ol> may only contain <li>, so semantics come from ARIA roles. */}
        <div className="grid items-stretch px-4 py-5" style={{ gridTemplateColumns, minWidth }} role="list">
          {stages.map((stage, i) => {
            const Icon = stage.icon;
            const available = isNum(stage.value);
            return (
              <React.Fragment key={stage.key}>
                <div
                  key={`${stage.key}-${propagateKey}`}
                  role="listitem"
                  className="vs-propagate min-w-0"
                  style={{ animationDelay: `${i * 90}ms` }}
                >
                  <div
                    className={`panel-nested h-full p-2.5 flex flex-col gap-2 ${stage.alert ? 'tone-critical vs-node-alert' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="eyebrow">{stage.tag}</span>
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${stage.tone}`} />
                    </div>

                    <div className="leading-none">
                      {available ? (
                        <AnimatedNumber value={stage.value} format={stage.format} className={`metric-secondary ${stage.tone}`} />
                      ) : (
                        <span className="metric-secondary text-faint">
                          <span aria-hidden="true">{'\u2014'}</span>
                          <span className="sr-only">unavailable</span>
                        </span>
                      )}
                      <div className="unit-label mt-1">{stage.unit}</div>
                    </div>

                    <div className="mt-auto">
                      <div className="caption leading-snug">{stage.label}</div>
                      {stage.note && <div className="eyebrow mt-1">{stage.note}</div>}
                    </div>
                  </div>
                </div>

                {i < stages.length - 1 && <Connector model={stage.edge} seconds={flowSeconds} />}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <p className="caption px-4 py-3.5 border-t border-hairline leading-relaxed">{caption}</p>
    </section>
  );
}

export default CausalChain;
