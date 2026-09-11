import React, { useMemo } from 'react';
import { Flame, Thermometer, Droplet, Gauge, ArrowUpRight, Send } from 'lucide-react';
import { AnimatedNumber } from './AnimatedNumber';

/**
 * The hero visualization: an animated, always-live causal chain from steam
 * soak through to the advisory speed command. Built for a non-domain judge
 * to grasp the failure mechanism in ~20 seconds by watching it, not reading
 * a dynacard.
 *
 * Every node is a real field from simState -- nothing here is decorative.
 * Connector flow speed is driven by drag_beta (thicker oil -> visibly slower
 * flow), and the chain re-propagates left-to-right with a short stagger
 * whenever the underlying scenario/data changes (via the `propagateKey`).
 */
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
  const meetsFloor = minTensionKn >= 0.5;
  const tone = isBuckling ? 'critical' : meetsFloor ? 'safe' : 'caution';
  const toneClass = {
    safe: 'text-safe',
    caution: 'text-caution',
    critical: 'text-critical',
  }[tone];
  const toneBg = {
    safe: 'bg-safe/10',
    caution: 'bg-caution/10',
    critical: 'bg-critical/10',
  }[tone];

  // Flow speed: viscous oil visibly slows the animation (2.4s idle -> ~0.5s
  // at extreme drag). Clamped so it never fully stops or races unreadably.
  const flowSeconds = useMemo(() => {
    const s = 2.4 - Math.min(1.9, dragBeta / 60);
    return Math.max(0.5, Number.isFinite(s) ? s : 1.2);
  }, [dragBeta]);

  const nodes = [
    {
      key: 'soak',
      icon: Flame,
      label: 'Steam soak',
      value: elapsedDays,
      format: (v) => v.toFixed(0),
      unit: 'days',
      tone: 'text-muted',
    },
    {
      key: 'temp',
      icon: Thermometer,
      label: 'Reservoir temp',
      value: temperatureC,
      format: (v) => v.toFixed(1),
      unit: '\u00b0C',
      tone: 'text-ink',
    },
    {
      key: 'visc',
      icon: Droplet,
      label: 'Oil viscosity',
      value: viscosityCp,
      format: (v) => (v > 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)),
      unit: 'cP',
      tone: 'text-caution',
    },
    {
      key: 'drag',
      icon: Droplet,
      label: 'Annular drag',
      value: dragBeta,
      format: (v) => v.toFixed(1),
      unit: 'N\u00b7s/m\u00b2',
      tone: 'text-caution',
    },
    {
      key: 'tension',
      icon: ArrowUpRight,
      label: 'Min rod tension',
      value: minTensionKn,
      format: (v) => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2)),
      unit: 'kN',
      tone: toneClass,
      alert: isBuckling,
    },
    {
      key: 'command',
      icon: Send,
      label: 'Advisory speed',
      value: effectiveSpm,
      format: (v) => v.toFixed(2),
      unit: 'SPM',
      tone: 'text-interactive',
    },
  ];

  const caption = isBuckling
    ? `Oil is ${(viscosityCp / 830).toFixed(0)}\u00d7 thicker than at soak temperature. Drag now exceeds the rod's submerged weight on the downstroke -- the string is modeled in compression. The advisory speed of ${effectiveSpm.toFixed(2)} SPM is the supervisor's protective response.`
    : meetsFloor
      ? `Viscous drag from the cooling reservoir is offset by throttling to ${effectiveSpm.toFixed(2)} SPM (requested ${targetSpm.toFixed(1)} SPM), holding ${minTensionKn >= 0 ? '+' : ''}${minTensionKn.toFixed(2)} kN of tension -- ${(minTensionKn - 0.5).toFixed(2)} kN above the anti-float floor.`
      : `Tension is below the +0.50 kN screening floor at the current advisory speed. The supervisor is evaluating a protective ramp-down.`;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <span className={`icon-badge w-9 h-9 ${toneBg} ${toneClass}`}>
            <Gauge className="w-[18px] h-[18px]" />
          </span>
          <div>
            <h2 className="card-title">Causal chain</h2>
            <p className="caption">Live physics, steam to speed command</p>
          </div>
        </div>
        <span className={`pill ${toneBg} ${toneClass}`}>
          <span className="chip-dot" />
          {isBuckling ? 'Compression risk' : meetsFloor ? 'Tension held' : 'Below floor'}
        </span>
      </div>

      {/* Node row with animated connectors */}
      <div className="relative flex items-stretch justify-between gap-1 sm:gap-2">
        {nodes.map((node, i) => {
          const Icon = node.icon;
          return (
            <React.Fragment key={node.key}>
              <div
                key={`${node.key}-${propagateKey}`}
                className="vs-propagate flex flex-col items-center text-center gap-2 min-w-0 flex-1"
                style={{ animationDelay: `${i * 90}ms` }}
              >
                <span
                  className={`icon-badge w-10 h-10 bg-surface-2 ${node.tone} ${node.alert ? 'vs-node-alert' : ''}`}
                >
                  <Icon className="w-[18px] h-[18px]" />
                </span>
                <div className="min-w-0">
                  <div className={`readout text-[15px] font-bold leading-tight ${node.tone}`}>
                    <AnimatedNumber value={node.value} format={node.format} />
                    <span className="text-[11px] font-medium text-muted ml-1">{node.unit}</span>
                  </div>
                  <div className="unit-label mt-0.5 truncate">{node.label}</div>
                </div>
              </div>

              {i < nodes.length - 1 && (
                <svg
                  className="flex-none w-6 sm:w-10 self-center"
                  height="8"
                  viewBox="0 0 40 8"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <line
                    x1="0"
                    y1="4"
                    x2="40"
                    y2="4"
                    className="vs-flow"
                    style={{ stroke: 'rgb(var(--accent-interactive))', strokeWidth: 2, animationDuration: `${flowSeconds}s` }}
                  />
                </svg>
              )}
            </React.Fragment>
          );
        })}
      </div>

      <p className="caption mt-5 pt-4 border-t border-hairline leading-relaxed">{caption}</p>
    </div>
  );
}

export default CausalChain;
