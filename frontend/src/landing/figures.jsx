import React from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useReveal } from './hooks.js';
import { AB_EXPERIMENT, LOAD_LEDGER, LOAD_NET, TEST_TIERS, TEST_TOTAL } from './data.js';

/* ============================================================================
   Small authored data figures. All bars are scaled from the dossier numbers
   and carry their literal value as text, so nothing depends on reading a
   length. Bar growth is a CSS transform triggered by the reveal observer and
   is neutralised under prefers-reduced-motion.
   ========================================================================== */

const TONE_VAR = {
  safe: 'var(--accent-safe)',
  thermal: 'var(--accent-thermal)',
  critical: 'var(--accent-critical)',
  signal: 'var(--accent-interactive)',
};

function Meter({ fraction, tone }) {
  return (
    <div className="cat-meter well">
      <span
        className="cat-meter-fill"
        style={{ '--fill': fraction, background: `rgb(${TONE_VAR[tone]} / 0.85)` }}
      />
    </div>
  );
}

/** Fig. 02 — downstroke axial load ledger. */
export function LoadLedger() {
  const ref = useReveal();
  const scale = Math.max(...LOAD_LEDGER.map((r) => Math.abs(r.value)), Math.abs(LOAD_NET.value));

  return (
    <figure className="panel cat-reveal" ref={ref}>
      <div className="panel-rail">
        <span className="eyebrow">Fig. 02 — downstroke axial load ledger</span>
        <span className="unit-label">kN</span>
      </div>
      <div className="p-4 sm:p-5 space-y-4">
        {LOAD_LEDGER.map((row) => (
          <div key={row.id} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,1fr)_112px] sm:items-center">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`icon-badge w-[22px] h-[22px] tone-${row.tone === 'safe' ? 'safe' : 'thermal'}`}>
                  {row.id === 'weight' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />}
                </span>
                <span className="panel-title">{row.label}</span>
              </div>
              <p className="caption mt-1 pl-[30px]">{row.direction}</p>
            </div>
            <div className="text-right sm:text-right">
              <span className="metric-secondary" style={{ color: `rgb(${TONE_VAR[row.tone]})` }}>
                {row.value.toFixed(1)}
              </span>
            </div>
            <div className="col-span-2">
              <Meter fraction={Math.abs(row.value) / scale} tone={row.tone} />
            </div>
          </div>
        ))}

        <div className="border-t border-hairline pt-4">
          <div className="well tone-critical p-3.5 sm:p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <span className="eyebrow" style={{ color: 'inherit' }}>
                  {LOAD_NET.label}
                </span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="metric-hero">{`\u2212${Math.abs(LOAD_NET.value).toFixed(1)}`}</span>
                  <span className="unit-label" style={{ color: 'inherit' }}>
                    kN
                  </span>
                </div>
              </div>
              <p className="caption max-w-[19rem]" style={{ color: 'inherit' }}>
                {LOAD_NET.note}
              </p>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="border-t border-hairline px-4 py-3 caption">
        Reference configuration, cooled near-wellbore. Drag from the reciprocating rod string shearing
        emulsified fluid in the tubing annulus acts upward during the downstroke; it exceeds the submerged
        rod weight, so the string is loaded in compression rather than tension.
      </figcaption>
    </figure>
  );
}

/** Fig. 03 — verification tiers. */
export function TierChart() {
  const ref = useReveal();
  const max = Math.max(...TEST_TIERS.map((t) => t.count));

  return (
    <figure className="panel cat-reveal h-full flex flex-col" ref={ref}>
      <div className="panel-rail">
        <span className="eyebrow">Fig. 03 — automated tests by tier</span>
        <span className="unit-label">{TEST_TOTAL} total</span>
      </div>
      <div className="p-4 sm:p-5 flex-1">
        <div className="flex items-end gap-2 sm:gap-3 h-[150px]">
          {TEST_TIERS.map((t) => (
            <div key={t.tier} className="flex-1 flex flex-col items-center justify-end gap-2 h-full">
              <span className="readout text-[12px] font-semibold text-ink">{t.count}</span>
              <div className="w-full flex-1 flex items-end">
                <span
                  className="cat-column"
                  style={{ '--fill': t.count / max, background: 'rgb(var(--accent-interactive) / 0.7)' }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 sm:gap-3 mt-2.5 border-t border-hairline pt-2.5">
          {TEST_TIERS.map((t) => (
            <span key={t.tier} className="flex-1 unit-label text-center">
              {t.tier.replace('Tier ', 'T')}
            </span>
          ))}
        </div>
      </div>
      <figcaption className="border-t border-hairline px-4 py-3 caption">
        Five verification tiers, {TEST_TOTAL} passing assertions. Tier names and internal structure are
        documented in the repository test suite.
      </figcaption>
    </figure>
  );
}

/** Fig. 04 — shared-seed A/B. */
export function AbCompare() {
  const ref = useReveal();
  const { seed, steps, baselineFloats, twinFloats } = AB_EXPERIMENT;
  const rows = [
    { id: 'base', label: 'Uncontrolled baseline', floats: baselineFloats, tone: 'critical' },
    { id: 'twin', label: 'Coupled advisory twin', floats: twinFloats, tone: 'safe' },
  ];

  return (
    <figure className="panel cat-reveal h-full flex flex-col" ref={ref}>
      <div className="panel-rail">
        <span className="eyebrow">Fig. 04 — rod-float events, shared seed {seed}</span>
        <span className="unit-label">{steps} steps</span>
      </div>
      <div className="p-4 sm:p-5 space-y-5 flex-1">
        {rows.map((row) => (
          <div key={row.id}>
            <div className="flex items-end justify-between gap-3 mb-2">
              <span className="panel-title">{row.label}</span>
              <span className="flex items-baseline gap-1">
                <span className="metric-secondary" style={{ color: `rgb(${TONE_VAR[row.tone]})` }}>
                  {row.floats}
                </span>
                <span className="unit-label">/ {steps} steps</span>
              </span>
            </div>
            <Meter fraction={row.floats / steps} tone={row.tone} />
            {row.floats === 0 && (
              <p className="caption mt-2 text-safe">No float event on any step of the run.</p>
            )}
          </div>
        ))}
      </div>
      <figcaption className="border-t border-hairline px-4 py-3 caption">
        Deterministic A/B at seed {seed} over {steps} steps. Both arms see an identical latent cooling
        trajectory and identical noise draws; the only difference is whether the advisory schedule is
        applied.
      </figcaption>
    </figure>
  );
}
