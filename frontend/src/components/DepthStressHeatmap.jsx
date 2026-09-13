import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Layers } from 'lucide-react';
import { useTheme } from '../utils/theme';

/* ============================================================================
   Colour mapping constants
   ----------------------------------------------------------------------------
   These ARE the normalisation used by the canvas, and the legend reads them
   directly so the key can never contradict the ramp again.
   ========================================================================== */
const COMPRESSION_FULL_SCALE_MPA = 25;
const TENSION_FULL_SCALE_MPA = 130;

/** Rod taper interfaces, measured depth below the polished rod. */
const TAPERS = [
  { depth: 350, from: '1.000', to: '0.875' },
  { depth: 750, from: '0.875', to: '0.750' },
];

/** Section geometry derived from nominal rod diameters (no typed-in areas). */
const SECTIONS = [
  { name: 'Section 1', dia_in: 1.0, top: 0, bottom: 350 },
  { name: 'Section 2', dia_in: 0.875, top: 350, bottom: 750 },
  { name: 'Section 3', dia_in: 0.75, top: 750, bottom: 1150 },
];
const areaCm2 = (dia_in) => (Math.PI / 4) * (dia_in * 2.54) ** 2;

const PLOT_H = 300;
const EM = '\u2014';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const lerp = (a, b, t) => Math.round(a + (b - a) * t);

/** Value -> rgb(). Compression fades surface→critical; tension surface→signal. */
function colorFor(val, pal) {
  if (!pal) return 'rgb(0,0,0)';
  const { base, critical, hi } = pal;
  if (val < 0) {
    const t = Math.min(1, Math.abs(val) / COMPRESSION_FULL_SCALE_MPA);
    return `rgb(${lerp(base[0], critical[0], t)},${lerp(base[1], critical[1], t)},${lerp(base[2], critical[2], t)})`;
  }
  const t = Math.min(1, val / TENSION_FULL_SCALE_MPA);
  return `rgb(${lerp(base[0], hi[0], t)},${lerp(base[1], hi[1], t)},${lerp(base[2], hi[2], t)})`;
}

const sectionAt = (depth) => SECTIONS.find((s) => depth < s.bottom) || SECTIONS[SECTIONS.length - 1];

export function DepthStressHeatmap({ stressHeatmap, isBuckling }) {
  const canvasRef = useRef(null);
  const bedRef = useRef(null);
  const { theme } = useTheme();

  const [palette, setPalette] = useState(null);
  const [size, setSize] = useState({ w: 0, h: PLOT_H });
  const [cursor, setCursor] = useState(null); // { di, ai }

  /* ---- Live theme channels ------------------------------------------- */
  useEffect(() => {
    const root = getComputedStyle(document.documentElement);
    const parse = (name) => {
      const trip = root.getPropertyValue(name).trim().split(/\s+/).map(Number);
      return trip.length === 3 && trip.every(Number.isFinite) ? trip : null;
    };
    const next = {
      base: parse('--bg-surface-2'),
      critical: parse('--accent-critical'),
      hi: parse('--accent-interactive'),
    };
    if (next.base && next.critical && next.hi) setPalette(next);
  }, [theme]);

  /* ---- Element-size tracking for a crisp, correctly-scaled bitmap ----- */
  useEffect(() => {
    const el = bedRef.current;
    if (!el) return undefined;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ---- Derived data --------------------------------------------------- */
  const data = useMemo(() => {
    const angles = stressHeatmap?.angles_deg;
    const depths = stressHeatmap?.depths_m;
    const matrix = stressHeatmap?.stress_matrix_mpa;
    if (!Array.isArray(angles) || !Array.isArray(depths) || !Array.isArray(matrix)) return null;
    if (angles.length === 0 || depths.length === 0 || matrix.length !== depths.length) return null;

    const maxDepth = depths[depths.length - 1];
    if (!isNum(maxDepth) || maxDepth <= 0) return null;

    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    let count = 0;
    let compressive = 0;
    for (let i = 0; i < depths.length; i += 1) {
      const row = matrix[i];
      if (!Array.isArray(row)) continue;
      for (let j = 0; j < row.length; j += 1) {
        const v = row[j];
        if (!isNum(v)) continue;
        if (v < min) min = v;
        if (v > max) max = v;
        if (v < 0) compressive += 1;
        sum += v;
        count += 1;
      }
    }
    if (count === 0) return null;

    return {
      angles,
      depths,
      matrix,
      maxDepth,
      nDepths: depths.length,
      nAngles: angles.length,
      min,
      max,
      mid: (min + max) / 2,
      mean: sum / count,
      compressiveFraction: compressive / count,
    };
  }, [stressHeatmap]);

  /* ---- Canvas paint --------------------------------------------------- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data || !palette || size.w < 2) return;

    const { angles, depths, matrix, maxDepth, nDepths, nAngles } = data;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const cssW = size.w;
    const cssH = size.h || PLOT_H;

    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    // Both axes are painted from the same linear scales the labels use.
    const yOf = (d) => (d / maxDepth) * cssH;
    const xOf = (a) => (a / 360) * cssW;

    for (let i = 0; i < nDepths; i += 1) {
      const row = matrix[i];
      if (!Array.isArray(row)) continue;
      const dTop = i === 0 ? 0 : (depths[i - 1] + depths[i]) / 2;
      const dBot = i === nDepths - 1 ? maxDepth : (depths[i] + depths[i + 1]) / 2;
      const y0 = yOf(dTop);
      const y1 = yOf(dBot);
      for (let j = 0; j < nAngles; j += 1) {
        const v = row[j];
        if (!isNum(v)) continue;
        const aStart = angles[j];
        const aEnd = j === nAngles - 1 ? 360 : angles[j + 1];
        const x0 = xOf(aStart);
        const x1 = xOf(aEnd);
        ctx.fillStyle = colorFor(v, palette);
        ctx.fillRect(x0, y0, x1 - x0 + 0.6, y1 - y0 + 0.6);
      }
    }

    // Taper interfaces, drawn on the identical depth scale as the axis labels.
    ctx.strokeStyle = `rgb(${palette.hi[0]},${palette.hi[1]},${palette.hi[2]})`;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    TAPERS.forEach((t) => {
      if (t.depth > maxDepth) return;
      const y = Math.round(yOf(t.depth)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(cssW, y);
      ctx.stroke();
    });
    ctx.setLineDash([]);
  }, [data, palette, size]);

  /* ---- Interaction ---------------------------------------------------- */
  const pick = useCallback(
    (fx, fy) => {
      if (!data) return null;
      const targetAngle = Math.min(359.999, Math.max(0, fx * 360));
      const targetDepth = Math.min(data.maxDepth, Math.max(0, fy * data.maxDepth));
      let ai = 0;
      for (let j = 0; j < data.nAngles; j += 1) {
        if (data.angles[j] <= targetAngle) ai = j;
        else break;
      }
      let di = 0;
      let best = Infinity;
      for (let i = 0; i < data.nDepths; i += 1) {
        const d = Math.abs(data.depths[i] - targetDepth);
        if (d < best) {
          best = d;
          di = i;
        }
      }
      return { di, ai };
    },
    [data],
  );

  const handlePointer = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    setCursor(pick((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height));
  };

  const handleKeyDown = (e) => {
    if (!data) return;
    const cur = cursor || { di: 0, ai: 0 };
    const wrapA = (v) => (v + data.nAngles) % data.nAngles;
    const clampD = (v) => Math.min(data.nDepths - 1, Math.max(0, v));
    let next = null;
    switch (e.key) {
      case 'ArrowRight':
        next = { di: cur.di, ai: wrapA(cur.ai + 1) };
        break;
      case 'ArrowLeft':
        next = { di: cur.di, ai: wrapA(cur.ai - 1) };
        break;
      case 'ArrowDown':
        next = { di: clampD(cur.di + 1), ai: cur.ai };
        break;
      case 'ArrowUp':
        next = { di: clampD(cur.di - 1), ai: cur.ai };
        break;
      case 'PageDown':
        next = { di: clampD(cur.di + 10), ai: cur.ai };
        break;
      case 'PageUp':
        next = { di: clampD(cur.di - 10), ai: cur.ai };
        break;
      case 'Home':
        next = { di: cur.di, ai: 0 };
        break;
      case 'End':
        next = { di: cur.di, ai: data.nAngles - 1 };
        break;
      case 'Escape':
        setCursor(null);
        return;
      default:
        return;
    }
    e.preventDefault();
    setCursor(next);
  };

  const reading = useMemo(() => {
    if (!data || !cursor) return null;
    const di = Math.min(cursor.di, data.nDepths - 1);
    const ai = Math.min(cursor.ai, data.nAngles - 1);
    const depth = data.depths[di];
    const angle = data.angles[ai];
    const value = data.matrix[di]?.[ai];
    return { di, ai, depth, angle, value, section: sectionAt(depth) };
  }, [data, cursor]);

  /* ---- Legend ramp, generated from the exact same mapping ------------- */
  const rampCss = useMemo(() => {
    if (!palette) return 'transparent';
    const lo = -COMPRESSION_FULL_SCALE_MPA;
    const hiV = TENSION_FULL_SCALE_MPA;
    const stops = [];
    for (let s = 0; s <= 16; s += 1) {
      const t = s / 16;
      const v = lo + t * (hiV - lo);
      stops.push(`${colorFor(v, palette)} ${(t * 100).toFixed(1)}%`);
    }
    return `linear-gradient(90deg, ${stops.join(', ')})`;
  }, [palette]);

  const rampPos = useCallback((v) => {
    const lo = -COMPRESSION_FULL_SCALE_MPA;
    const hiV = TENSION_FULL_SCALE_MPA;
    return Math.min(100, Math.max(0, ((v - lo) / (hiV - lo)) * 100));
  }, []);

  const maxDepth = data?.maxDepth ?? 1150;
  const depthTicks = useMemo(() => {
    const base = [0, 200, 350, 600, 750, 1000];
    const ticks = base.filter((d) => d < maxDepth - 60);
    ticks.push(maxDepth);
    return ticks;
  }, [maxDepth]);

  const angleTicks = [
    { deg: 0, label: '0° BDC', align: 'start' },
    { deg: 90, label: '90° upstroke', align: 'center' },
    { deg: 180, label: '180° TDC', align: 'center' },
    { deg: 270, label: '270° downstroke', align: 'center' },
    { deg: 360, label: '360°', align: 'end' },
  ];

  const summary = data
    ? `Axial stress screen over ${data.nDepths} rod nodes from 0 to ${maxDepth.toFixed(0)} metres depth and ` +
      `${data.nAngles} crank-phase bins from 0 to 360 degrees. Stress ranges from ${data.min.toFixed(1)} to ` +
      `${data.max.toFixed(1)} megapascals, mean ${data.mean.toFixed(1)} megapascals. ` +
      `${(data.compressiveFraction * 100).toFixed(1)} percent of cells are in compression below zero megapascals. ` +
      `Colour normalisation is ${COMPRESSION_FULL_SCALE_MPA} megapascals full-scale in compression and ` +
      `${TENSION_FULL_SCALE_MPA} megapascals full-scale in tension. ` +
      `Rod taper interfaces at ${TAPERS.map((t) => `${t.depth} metres`).join(' and ')}.`
    : 'Axial stress field not available.';

  return (
    <div className="flex flex-col gap-5 font-sans">
      <section className="flex flex-col gap-4" aria-labelledby="stress-heading">
        <header className="flex flex-col xl:flex-row xl:items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className="icon-badge text-interactive mt-0.5" aria-hidden="true">
              <Layers className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id="stress-heading" className="panel-title">
                  Modeled axial stress σ(x, θ)
                </h2>
                <span className="pill tone-caution">Visualization surrogate</span>
              </div>
              <p className="caption">
                Linear surface-to-pump load interpolation divided by local section area —{' '}
                {data ? `${data.nDepths} nodes × ${data.nAngles} crank-phase bins` : 'grid unavailable'}.
              </p>
            </div>
          </div>

          <span className={`pill shrink-0 ${isBuckling ? 'tone-critical' : 'tone-safe'}`}>
            <span className="chip-dot" />
            {isBuckling ? 'Compression screen' : 'Tension floor met'}
          </span>
        </header>

        <div className="panel-nested p-4 flex flex-col gap-3">
          <div className="flex">
            {/* Depth axis — absolutely positioned from the canvas depth scale */}
            <div className="relative w-16 shrink-0" style={{ height: PLOT_H }} aria-hidden="true">
              {depthTicks.map((d) => (
                <span
                  key={`d-${d}`}
                  className={`absolute right-3 readout text-[10px] whitespace-nowrap ${
                    TAPERS.some((t) => t.depth === d) ? 'text-interactive' : 'text-faint'
                  }`}
                  style={{ top: `${(d / maxDepth) * 100}%`, transform: 'translateY(-50%)' }}
                >
                  {d >= 1000 ? d.toLocaleString('en-US') : d} m
                </span>
              ))}
            </div>

            {/* Canvas bed */}
            <div
              ref={bedRef}
              className="relative flex-1 min-w-0 rounded-[5px] border border-hairline overflow-hidden"
              style={{ height: PLOT_H, background: 'rgb(var(--bg-surface-2))' }}
              role="img"
              aria-label="Axial stress heatmap by rod depth and crank phase. Focus and use arrow keys to move the probe: left and right step crank-phase bins, up and down step rod nodes."
              aria-describedby="stress-summary"
              tabIndex={0}
              onMouseMove={handlePointer}
              onMouseLeave={() => setCursor(null)}
              onKeyDown={handleKeyDown}
              onFocus={() => setCursor((c) => c || { di: 0, ai: 0 })}
              onBlur={() => setCursor(null)}
            >
              <canvas ref={canvasRef} className="block w-full h-full" style={{ width: '100%', height: '100%' }} />

              {/* Taper callouts pinned by the real depth scale */}
              {TAPERS.filter((t) => t.depth <= maxDepth).map((t) => (
                <span
                  key={`tap-${t.depth}`}
                  className="absolute right-2 panel-nested px-2 py-[3px] readout text-[9.5px] text-muted shadow-card pointer-events-none"
                  style={{ top: `${(t.depth / maxDepth) * 100}%`, transform: 'translateY(-50%)' }}
                >
                  {t.from}″ → {t.to}″ @ {t.depth} m
                </span>
              ))}

              {/* Probe crosshair */}
              {reading && (
                <>
                  <span
                    className="absolute top-0 bottom-0 w-px pointer-events-none"
                    style={{
                      left: `${(reading.angle / 360) * 100}%`,
                      background: 'rgb(var(--text-primary) / 0.55)',
                    }}
                  />
                  <span
                    className="absolute left-0 right-0 h-px pointer-events-none"
                    style={{
                      top: `${(reading.depth / maxDepth) * 100}%`,
                      background: 'rgb(var(--text-primary) / 0.55)',
                    }}
                  />
                </>
              )}
            </div>
          </div>

          {/* Crank-phase axis — proportional positions, not justify-between */}
          <div className="flex">
            <div className="w-16 shrink-0" aria-hidden="true" />
            <div className="relative flex-1 min-w-0 h-8" aria-hidden="true">
              {angleTicks.map((t) => (
                <span
                  key={`a-${t.deg}`}
                  className="absolute top-0 flex flex-col items-center"
                  style={{
                    left: `${(t.deg / 360) * 100}%`,
                    transform:
                      t.align === 'start' ? 'translateX(0)' : t.align === 'end' ? 'translateX(-100%)' : 'translateX(-50%)',
                  }}
                >
                  <span className="block w-px h-1.5 bg-hairline" />
                  <span className="readout text-[9.5px] text-faint whitespace-nowrap mt-1">{t.label}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Probe readout */}
          <div className="hairline-x py-2.5 flex flex-wrap items-baseline gap-x-5 gap-y-1" aria-live="polite">
            {reading ? (
              <>
                <span className="flex items-baseline gap-1.5">
                  <span className="eyebrow">Depth</span>
                  <span className="readout text-[11.5px] text-ink">{reading.depth.toFixed(1)} m</span>
                  <span className="caption text-faint">node {reading.di}</span>
                </span>
                <span className="flex items-baseline gap-1.5">
                  <span className="eyebrow">Phase</span>
                  <span className="readout text-[11.5px] text-ink">{reading.angle.toFixed(1)}°</span>
                  <span className="caption text-faint">bin {reading.ai}</span>
                </span>
                <span className="flex items-baseline gap-1.5">
                  <span className="eyebrow">σ axial</span>
                  <span
                    className={`readout text-[12px] font-semibold ${
                      isNum(reading.value) ? (reading.value < 0 ? 'text-critical' : 'text-ink') : 'text-faint'
                    }`}
                  >
                    {isNum(reading.value) ? `${reading.value.toFixed(2)} MPa` : EM}
                  </span>
                </span>
                <span className="flex items-baseline gap-1.5">
                  <span className="eyebrow">Section</span>
                  <span className="readout text-[11.5px] text-muted">
                    {reading.section.name} · {reading.section.dia_in.toFixed(3)}″
                  </span>
                </span>
              </>
            ) : (
              <p className="caption text-faint">
                Hover or focus the field and use ← → to step crank phase, ↑ ↓ to step rod nodes.
              </p>
            )}
          </div>
        </div>

        <p id="stress-summary" className="sr-only">
          {summary}
        </p>

        {/* Colour key — generated from the same mapping the canvas uses */}
        <div className="panel-nested p-4 flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <h3 className="panel-title">Colour key</h3>
            <span className="eyebrow">
              Full scale: {COMPRESSION_FULL_SCALE_MPA} MPa compression · {TENSION_FULL_SCALE_MPA} MPa tension
            </span>
          </div>

          <div className="relative">
            <div
              className="h-3 rounded-[3px] border border-hairline"
              style={{ background: rampCss }}
              aria-hidden="true"
            />
            <div className="relative h-9 mt-1" aria-hidden="true">
              {[
                { v: -COMPRESSION_FULL_SCALE_MPA, label: `−${COMPRESSION_FULL_SCALE_MPA}`, tone: 'text-critical' },
                { v: 0, label: '0', tone: 'text-faint' },
                { v: TENSION_FULL_SCALE_MPA, label: String(TENSION_FULL_SCALE_MPA), tone: 'text-interactive' },
              ].map((t, i, arr) => (
                <span
                  key={`k-${t.v}`}
                  className={`absolute top-0 flex flex-col items-center ${t.tone}`}
                  style={{
                    left: `${rampPos(t.v)}%`,
                    transform: i === 0 ? 'translateX(0)' : i === arr.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
                  }}
                >
                  <span className="block w-px h-1.5 bg-hairline" />
                  <span className="readout text-[9.5px] mt-0.5">{t.label} MPa</span>
                </span>
              ))}
            </div>
          </div>

          {data ? (
            <dl className="grid grid-cols-3 gap-3 pt-2 border-t border-hairline m-0">
              {[
                { k: 'Field minimum', v: data.min, tone: data.min < 0 ? 'text-critical' : 'text-ink' },
                { k: 'Field midpoint', v: data.mid, tone: 'text-ink' },
                { k: 'Field maximum', v: data.max, tone: 'text-ink' },
              ].map((row) => (
                <div key={row.k} className="flex flex-col gap-1">
                  <dt className="unit-label">{row.k}</dt>
                  <dd className={`readout text-[13px] m-0 ${row.tone}`}>{row.v.toFixed(2)} MPa</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="caption text-faint">Field statistics unavailable.</p>
          )}

          {data && (
            <p className="caption">
              {data.compressiveFraction > 0
                ? `${(data.compressiveFraction * 100).toFixed(1)}% of grid cells fall below 0 MPa (compression).`
                : 'No grid cell falls below 0 MPa.'}
            </p>
          )}
        </div>
      </section>

      {/* Rod taper property strip */}
      <section aria-labelledby="taper-heading" className="flex flex-col gap-3">
        <h3 id="taper-heading" className="panel-title">
          Rod string taper
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {SECTIONS.map((s, i) => (
            <div
              key={s.name}
              className={`panel-nested p-4 flex flex-col gap-3 ${
                i === SECTIONS.length - 1 ? `border-l-2 ${isBuckling ? 'border-l-critical' : 'border-l-safe'}` : ''
              }`}
            >
              <div className="flex items-baseline justify-between gap-2 pb-3 border-b border-hairline">
                <span className="unit-label">{s.name}</span>
                <span className="unit-label text-faint">{s.dia_in.toFixed(3)} in.</span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[11.5px] text-muted">Depth</span>
                <span className="readout text-[11.5px] text-ink">
                  {s.top.toLocaleString('en-US')} – {s.bottom.toLocaleString('en-US')} m
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[11.5px] text-muted">Cross-section</span>
                <span className="readout text-[11.5px] text-ink">{areaCm2(s.dia_in).toFixed(3)} cm²</span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[11.5px] text-muted">
                  {i === SECTIONS.length - 1 ? 'Model screen' : 'Fatigue / safety factor'}
                </span>
                {i === SECTIONS.length - 1 ? (
                  <span className={`readout text-[11.5px] ${isBuckling ? 'text-critical' : 'text-safe'}`}>
                    {isBuckling ? 'Compression indicator' : 'Tension floor met'}
                  </span>
                ) : (
                  <span className="readout text-[11.5px] text-faint">Not evaluated</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default DepthStressHeatmap;
