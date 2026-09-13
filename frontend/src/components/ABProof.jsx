import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Play, GitCompareArrows } from 'lucide-react';
import { AnimatedNumber } from './AnimatedNumber';
import { SkeletonPanel } from './Skeleton';
import { apiFetch } from '../utils/api';

/**
 * Deterministic shared-seed A/B benchmark, fetched live from
 * GET /api/experiment/ab. Both branches are driven by the identical latent
 * cooling trajectory and the identical measurement-noise draws; the only
 * difference is whether the controller is allowed to look ahead. That shared
 * seed is what makes the comparison fair, so the UI states it explicitly and
 * lets a reader re-seed and watch the result hold.
 *
 * Every number on this panel — float counts, tension minima, the SPM bands,
 * the cooling span, and the chart's y-domain — is derived from the response.
 * Nothing is hardcoded.
 */

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const STEP_OPTIONS = [24, 48, 96]; // API accepts 4..96; outside that it 422s.

const CHART_W = 720;
const CHART_H = 220;
const PAD = { top: 14, right: 14, bottom: 26, left: 46 };
const PLOT_W = CHART_W - PAD.left - PAD.right;
const PLOT_H = CHART_H - PAD.top - PAD.bottom;

/** Min/max of a numeric field across a record array, or null if unavailable. */
function extent(records, key) {
  const values = (records || []).map((r) => r?.[key]).filter(isNum);
  if (!values.length) return null;
  return { min: Math.min(...values), max: Math.max(...values) };
}

function StatBlock({ label, value, tone, footnote }) {
  return (
    <div className="panel-nested p-3.5 flex flex-col gap-1">
      <span className="eyebrow">{label}</span>
      <div className={`metric-hero ${tone}`}>
        {isNum(value) ? (
          <AnimatedNumber value={value} format={(v) => Math.round(v).toString()} />
        ) : (
          <>
            <span aria-hidden="true">{'\u2014'}</span>
            <span className="sr-only">not reported</span>
          </>
        )}
      </div>
      <span className="caption">{footnote}</span>
    </div>
  );
}

export function ABProof() {
  const clipId = `ab-plot-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const [data, setData] = useState(null);
  const [seed, setSeed] = useState(42);
  const [seedInput, setSeedInput] = useState('42');
  const [steps, setSteps] = useState(24);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchExperiment = useCallback(async (s, n) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/experiment/ab?seed=${encodeURIComponent(s)}&n_steps=${encodeURIComponent(n)}`);
      if (!res.ok) throw new Error(`Experiment request failed (${res.status})`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message || 'The experiment service is unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExperiment(seed, steps);
  }, [seed, steps, fetchExperiment]);

  const chart = useMemo(() => {
    const hours = data?.hours;
    if (!Array.isArray(hours) || hours.length === 0) return null;

    const series = [
      { key: 'baseline', records: data.baseline, stroke: 'rgb(var(--accent-critical))', width: 2 },
      { key: 'coupled', records: data.coupled, stroke: 'rgb(var(--accent-safe))', width: 2.5 },
    ];

    // Y-domain from the actual tension values, always including 0 kN: the
    // compression boundary is the entire point of the chart.
    const tensions = series.flatMap((s) => (s.records || []).map((r) => r?.min_tension_kn)).filter(isNum);
    if (!tensions.length) return null;

    const rawMin = Math.min(0, ...tensions);
    const rawMax = Math.max(0, ...tensions);
    const pad = Math.max(0.25, (rawMax - rawMin) * 0.08);
    const yMin = rawMin - pad;
    const yMax = rawMax + pad;

    const scaleY = (v) => PAD.top + PLOT_H - ((v - yMin) / (yMax - yMin)) * PLOT_H;
    const scaleX = (i) => PAD.left + (i / Math.max(1, hours.length - 1)) * PLOT_W;

    const path = (records) =>
      (records || [])
        .map((r, i) => (isNum(r?.min_tension_kn) ? `${i === 0 ? 'M' : 'L'} ${scaleX(i).toFixed(1)},${scaleY(r.min_tension_kn).toFixed(1)}` : ''))
        .filter(Boolean)
        .join(' ');

    const floats = (records) =>
      (records || [])
        .map((r, i) => (r?.is_floating && isNum(r?.min_tension_kn) ? { i, x: scaleX(i), y: scaleY(r.min_tension_kn) } : null))
        .filter(Boolean);

    const yTicks = [yMin, yMin + (yMax - yMin) / 3, yMin + (2 * (yMax - yMin)) / 3, yMax];
    const xTickIdx = Array.from(new Set([0, Math.round((hours.length - 1) / 3), Math.round((2 * (hours.length - 1)) / 3), hours.length - 1]));

    return {
      hours,
      zeroY: scaleY(0),
      baselinePath: path(data.baseline),
      coupledPath: path(data.coupled),
      baselineFloats: floats(data.baseline),
      coupledFloats: floats(data.coupled),
      yTicks: yTicks.map((v) => ({ v, y: scaleY(v) })),
      xTicks: xTickIdx.map((i) => ({ i, x: scaleX(i), hour: hours[i] })),
    };
  }, [data]);

  if (!data && loading) return <SkeletonPanel title="Running deterministic A/B benchmark" lines={4} height={300} />;

  const baseTension = extent(data?.baseline, 'min_tension_kn');
  const coupledTension = extent(data?.coupled, 'min_tension_kn');
  const baseSpm = extent(data?.baseline, 'spm');
  const coupledSpm = extent(data?.coupled, 'spm');
  const trueTemp = extent(data?.baseline, 'temperature_true_c');

  const spmLabel = (e) => {
    if (!e) return 'SPM not reported';
    return Math.abs(e.max - e.min) < 0.005
      ? `fixed ${e.min.toFixed(1)} SPM`
      : `${e.min.toFixed(1)}–${e.max.toFixed(1)} SPM`;
  };

  const stepCount = Array.isArray(data?.hours) ? data.hours.length : null;
  const chartSummary =
    data && chart
      ? `Minimum rod tension per step. Baseline (${spmLabel(baseSpm)}) records ${data.baseline_float_count} float events and bottoms at ${baseTension ? baseTension.min.toFixed(2) : '—'} kN. Coupled twin (${spmLabel(coupledSpm)}) records ${data.coupled_float_count} float events and bottoms at ${coupledTension ? coupledTension.min.toFixed(2) : '—'} kN.`
      : 'Benchmark chart unavailable.';

  return (
    <section className="panel registered overflow-hidden" aria-labelledby="ab-proof-heading">
      <div className="panel-rail flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="icon-badge w-6 h-6 text-interactive">
            <GitCompareArrows className="w-3.5 h-3.5" />
          </span>
          <div className="min-w-0">
            <h2 id="ab-proof-heading" className="panel-title truncate">
              Deterministic A/B proof
            </h2>
            <p className="caption truncate">Same latent cooling, same noise draws — only the controller differs</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="segmented" role="group" aria-label="Benchmark horizon in steps">
            {STEP_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                className="segmented-item"
                aria-pressed={steps === n}
                disabled={loading}
                onClick={() => setSteps(n)}
              >
                {n}
              </button>
            ))}
          </div>

          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const parsed = Number.parseInt(seedInput, 10);
              setSeed(Number.isFinite(parsed) ? parsed : 42);
            }}
          >
            <label htmlFor="ab-seed" className="unit-label">
              Seed
            </label>
            <input
              id="ab-seed"
              type="number"
              value={seedInput}
              onChange={(e) => setSeedInput(e.target.value)}
              className="readout text-[13px] w-20 bg-surface-2 border border-hairline rounded-[5px] px-2 py-1 text-ink focus:border-interactive"
            />
            <button type="submit" className="btn btn-ghost px-2.5 py-1" disabled={loading}>
              <Play className="w-3.5 h-3.5" />
              Run
            </button>
          </form>
        </div>
      </div>

      {error && (
        <div className="px-4 pt-4">
          <span className="pill tone-critical">
            <span className="chip-dot" />
            {error}
          </span>
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4">
            <StatBlock
              label="Fixed-speed baseline"
              value={data.baseline_float_count}
              tone="text-critical"
              footnote={stepCount ? `float events / ${stepCount} steps · ${spmLabel(baseSpm)}` : 'float events'}
            />
            <StatBlock
              label="Coupled MPC twin"
              value={data.coupled_float_count}
              tone="text-safe"
              footnote={stepCount ? `float events / ${stepCount} steps · ${spmLabel(coupledSpm)}` : 'float events'}
            />
            <div className="panel-nested p-3.5 flex flex-col gap-1">
              <span className="eyebrow">Tension floor reached</span>
              <div className="flex items-baseline gap-3">
                <span className="metric-secondary text-critical">
                  {baseTension ? `${baseTension.min >= 0 ? '+' : ''}${baseTension.min.toFixed(2)}` : '\u2014'}
                </span>
                <span className="metric-secondary text-safe">
                  {coupledTension ? `${coupledTension.min >= 0 ? '+' : ''}${coupledTension.min.toFixed(2)}` : '\u2014'}
                </span>
                <span className="unit-label">kN</span>
              </div>
              <span className="caption">baseline vs coupled minimum</span>
            </div>
          </div>

          <div className="px-4 pb-4">
            <div className="well p-3 blueprint-fine">
              <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full h-auto" role="img" aria-label={chartSummary}>
                <defs>
                  <clipPath id={clipId}>
                    <rect x={PAD.left} y={PAD.top} width={PLOT_W} height={PLOT_H} />
                  </clipPath>
                </defs>

                {chart && (
                  <>
                    {/* Compression half-plane */}
                    <rect
                      x={PAD.left}
                      y={chart.zeroY}
                      width={PLOT_W}
                      height={Math.max(0, PAD.top + PLOT_H - chart.zeroY)}
                      fill="rgb(var(--accent-critical) / 0.07)"
                    />

                    {chart.yTicks.map((t) => (
                      <g key={`y-${t.v}`}>
                        <line x1={PAD.left} y1={t.y} x2={PAD.left + PLOT_W} y2={t.y} className="stroke-grid" strokeWidth="1" />
                        <text x={PAD.left - 8} y={t.y + 3} textAnchor="end" className="text-[9px] fill-faint">
                          {t.v.toFixed(1)}
                        </text>
                      </g>
                    ))}

                    {chart.xTicks.map((t) => (
                      <text key={`x-${t.i}`} x={t.x} y={CHART_H - 8} textAnchor="middle" className="text-[9px] fill-faint">
                        {isNum(t.hour) ? `${t.hour.toFixed(1)} h` : ''}
                      </text>
                    ))}

                    {/* 0 kN compression boundary */}
                    <line
                      x1={PAD.left}
                      y1={chart.zeroY}
                      x2={PAD.left + PLOT_W}
                      y2={chart.zeroY}
                      stroke="rgb(var(--accent-critical))"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                    />
                    <text x={PAD.left + PLOT_W} y={chart.zeroY - 5} textAnchor="end" className="text-[9px] fill-critical">
                      0 kN · rod float boundary
                    </text>

                    <g clipPath={`url(#${clipId})`}>
                      <path
                        key={`base-${data.seed}-${stepCount}`}
                        d={chart.baselinePath}
                        fill="none"
                        className="vs-draw"
                        style={{ stroke: 'rgb(var(--accent-critical))', '--draw-length': 1400 }}
                        strokeWidth="2"
                      />
                      <path
                        key={`coupled-${data.seed}-${stepCount}`}
                        d={chart.coupledPath}
                        fill="none"
                        className="vs-draw"
                        style={{ stroke: 'rgb(var(--accent-safe))', '--draw-length': 1400 }}
                        strokeWidth="2.5"
                      />
                      {chart.baselineFloats.map((p) => (
                        <circle key={`bf-${p.i}`} cx={p.x} cy={p.y} r="2.4" fill="rgb(var(--accent-critical))" />
                      ))}
                      {chart.coupledFloats.map((p) => (
                        <circle key={`cf-${p.i}`} cx={p.x} cy={p.y} r="2.4" fill="rgb(var(--accent-safe))" />
                      ))}
                    </g>
                  </>
                )}
              </svg>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-2 px-1">
                <span className="flex items-center gap-1.5 caption">
                  <span className="w-3 h-[2px] bg-critical inline-block" aria-hidden="true" />
                  Baseline · {spmLabel(baseSpm)}
                </span>
                <span className="flex items-center gap-1.5 caption">
                  <span className="w-3 h-[2px] bg-safe inline-block" aria-hidden="true" />
                  Coupled twin · MPC-governed, {spmLabel(coupledSpm)}
                </span>
                <span className="caption">Dots mark steps flagged as rod float.</span>
              </div>
            </div>
          </div>

          <p className="caption px-4 py-3 border-t border-hairline">
            Seed {data.seed} over {stepCount ?? '\u2014'} steps
            {trueTemp ? `, under an identical ${trueTemp.max.toFixed(0)}→${trueTemp.min.toFixed(0)} °C latent cooling trajectory` : ''} and
            shared measurement-noise draws. Both branches see the same disturbance sequence, so the float-count difference is
            attributable to the controller alone. Synthetic benchmark, unit-verified; see docs/VERIFICATION.md.
          </p>
        </>
      )}
    </section>
  );
}

export default ABProof;
