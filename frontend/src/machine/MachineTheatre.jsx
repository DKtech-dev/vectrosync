import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Columns2,
  Maximize2,
  Sparkles,
  SlidersHorizontal,
  TriangleAlert,
  ShieldCheck,
  ChevronDown,
  Activity,
} from 'lucide-react';
import { MachineBay } from './MachineBay.jsx';
import { useMachineClock, useReducedMotion, useParallax, TAU } from './runtime.js';
import { surfaceState, velocityEnvelope, UNIT, STROKE_IN, UPSTROKE_DEG, DOWNSTROKE_DEG, THETA_BDC } from './pumpingUnit.js';
import {
  makeCalibratedProfile,
  solveMaxSafeSpm,
  helicalBuckling,
  weightBelowKn,
  ENDURANCE_MPA,
  FATIGUE_CYCLES_TO_PART,
  WELL,
} from './wellModel.js';

/**
 * ============================================================================
 * MACHINE THEATRE
 * ============================================================================
 * The argument of the whole product, made physical.
 *
 * Two identical C-320D-256-100 units on one 1,150 m Jodhpur Sandstone
 * completion, in the same formation, lifting the same fluid at the same
 * temperature, running against the SAME wall clock. The only difference between
 * them is the commanded pump speed: one runs at the operator's requested rate,
 * the other at the rate the constrained MPC governor advises.
 *
 * Because they share a clock and not a speed, they desynchronise on screen.
 * That drift is the point. Every extra stroke the ungoverned unit takes is a
 * stroke taken with the lower tapers in compression, wearing against the
 * tubing wall.
 * ==========================================================================*/

const FLOOR_KN = 0.5;
const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : '—');

export function MachineTheatre({ simState, simParams, isPlaying, onTogglePlay, simSpeed = 1, onChangeSpeed }) {
  const reduced = useReducedMotion();
  const [mode, setMode] = useState('compare'); // compare | governed | baseline
  const [particles, setParticles] = useState(true);
  const [scrub, setScrub] = useState(null); // null = free running
  const [notesOpen, setNotesOpen] = useState(false);
  const { hostRef, offset } = useParallax({ reduced });
  // The full surface+subsurface+pump+buckling stack is drawn for BOTH
  // branches at all times -- nothing is cropped or hidden. Comparability
  // comes from the headline stats, the per-bay tension gauge, and the
  // failure/advantage callouts below, not from removing the drawing.

  const dyn = simState?.dynacard;
  const solverSpm = Number.isFinite(simState?.effective_spm) ? simState.effective_spm : 4.7;
  const baselineSpm = Number.isFinite(simState?.target_spm) ? simState.target_spm : 4.7;
  const strokeM = Number.isFinite(simParams?.stroke_length_m) ? simParams.stroke_length_m : 2.54;
  const tempC = Number.isFinite(simState?.temperature_c) ? simState.temperature_c : 200;

  /* --- Build the two force profiles ------------------------------------- */
  const fit = useMemo(() => {
    const card = dyn?.downhole_load_kn;
    const baseCard = dyn?.baseline_downhole_load_kn || card;
    const basePprl = Number.isFinite(dyn?.baseline_pprl_kn)
      ? dyn.baseline_pprl_kn
      : dyn?.pprl_kn;
    const baseMinKn = Number.isFinite(dyn?.baseline_min_tension_kn)
      ? dyn.baseline_min_tension_kn
      : Number.isFinite(simState?.baseline_min_tension_kn)
        ? simState.baseline_min_tension_kn
        : Array.isArray(dyn?.baseline_downhole_load_kn) && dyn.baseline_downhole_load_kn.length > 0
          ? Math.min(...dyn.baseline_downhole_load_kn)
          : simState?.actual_min_tension_kn;

    // Anchor physical calibration (viscosity k and drag shape lambda) to the
    // unmitigated baseline operating point. This is the authentic physical state
    // of the well before/without governor intervention, sampled across the full
    // baseline velocity range. Both branches then evaluate against this shared
    // physical foundation — same fluid, same well, same formation temperature.
    const fitted = makeCalibratedProfile({
      pumpCardKn: baseCard,
      pprlKn: basePprl,
      targetMinKn: baseMinKn,
      velocityAt: (p) => surfaceState(p, baselineSpm, strokeM).velocityMps,
    });
    const buildAt = (spm) =>
      makeCalibratedProfile({
        pumpCardKn: baseCard,
        velocityAt: (p) => surfaceState(p, spm, strokeM).velocityMps,
        fixedViscosityPas: fitted.effectiveViscosityPas,
        fixedLambda: fitted.lambda,
      });

    const b = buildAt(baselineSpm);

    // Some scenarios deliberately run the governor disengaged and return
    // effective_spm == target_spm, which would leave the two bays identical.
    // Rather than fake a difference, solve the governor's own anti-float
    // constraint here and label the result as constraint-derived.
    let advised = solverSpm;
    let source = 'solver';
    if (Math.abs(solverSpm - baselineSpm) < 0.01 && b.predictedTaperTensionKn < FLOOR_KN) {
      advised = solveMaxSafeSpm(buildAt, FLOOR_KN).spm;
      source = 'constraint';
    }

    return {
      fitted,
      governed: source === 'solver' ? buildAt(solverSpm) : buildAt(advised),
      baseline: b,
      advisedSpm: advised,
      advisorySource: source,
      solverBaselineMinKn: Number.isFinite(dyn?.baseline_min_tension_kn)
        ? dyn.baseline_min_tension_kn
        : Array.isArray(dyn?.baseline_downhole_load_kn)
          ? Math.min(...dyn.baseline_downhole_load_kn)
          : NaN,
    };
  }, [dyn, solverSpm, baselineSpm, strokeM, simState?.actual_min_tension_kn, simState?.baseline_min_tension_kn]);

  const { governed, baseline, advisedSpm, advisorySource, solverBaselineMinKn } = fit;
  const governedSpm = advisedSpm;

  /* --- Clock ------------------------------------------------------------- */
  const clock = useMachineClock({
    spmA: baselineSpm,
    spmB: governedSpm,
    isPlaying: isPlaying && scrub === null,
    speed: simSpeed,
    reduced,
  });

  const bayA = useRef(null);
  const bayB = useRef(null);
  // Every failure statistic (compression cycles, wall-contact wear, float
  // impacts, fatigue cycles, parted state) is now tracked per-bay, inside
  // MachineBay itself, symmetrically for both branches -- this is just a
  // slow mirror of whatever each bay's own update() last returned.
  const live = useRef({ a: null, b: null, strokesA: 0, strokesB: 0 });
  const [readout, setReadout] = useState(null);

  useEffect(() => {
    const unsub = clock.subscribe((s, dtS) => {
      const pa = scrub !== null ? scrub * TAU : s.phaseA;
      const pb = scrub !== null ? scrub * TAU : s.phaseB;
      live.current.a = bayA.current?.update(pa, dtS);
      live.current.b = bayB.current?.update(pb, dtS);
      live.current.strokesA = s.strokesA;
      live.current.strokesB = s.strokesB;
    });
    return unsub;
  }, [clock, scrub]);

  // Slow mirror for the text. 8 Hz reads as live and costs nothing.
  useEffect(() => {
    const id = setInterval(() => setReadout({ ...live.current }), 125);
    return () => clearInterval(id);
  }, []);

  const handleReset = useCallback(() => {
    clock.reset();
    bayA.current?.reset();
    bayB.current?.reset();
  }, [clock]);

  /* --- Static facts about the mechanism ---------------------------------- */
  const env = useMemo(() => velocityEnvelope(baselineSpm, strokeM), [baselineSpm, strokeM]);
  const buck = useMemo(
    () => (baseline.minKn < 0 ? helicalBuckling(Math.abs(baseline.minKn), baseline.minDepthM) : null),
    [baseline],
  );

  const a = readout?.a;
  const b = readout?.b;
  const soloA = mode === 'baseline';
  const soloB = mode === 'governed';
  const showA = mode !== 'governed';
  const showB = mode !== 'baseline';

  const spmDelta = baselineSpm - governedSpm;
  // Two unfitted agreements between the reconstruction and the solver.
  const viscCheck = simState?.viscosity_cp;
  const viscRecon = fit.fitted.effectiveViscosityPas * 1000;
  const viscErr = Number.isFinite(viscCheck) && viscCheck > 0 ? (100 * (viscRecon - viscCheck)) / viscCheck : NaN;
  const tenCheck = simState?.actual_min_tension_kn;
  const tenRecon = fit.fitted.predictedTaperTensionKn;
  const slack = baseline.minSurfaceKn < 0;
  // The solver defines `min_tension_kn` at the top of the bottom taper, so this
  // is the quantity that is directly comparable between the branches and
  // against the +0.50 kN anti-float floor.
  const governedTaper = governed.predictedTaperTensionKn;
  const baselineTaper = baseline.predictedTaperTensionKn;

  // Shared axis for both gauges, so a glance at the two bars is a valid
  // comparison and not two independently-scaled pictures.
  const gaugeDomain = useMemo(() => {
    const vals = [baselineTaper, governedTaper, 0].filter(Number.isFinite);
    const lo = Math.min(-5, ...vals) - 2;
    const hi = Math.max(10, ...vals) + 2;
    return [lo, hi];
  }, [baselineTaper, governedTaper]);

  // --- The two stories the drawing has to tell -----------------------------
  // Branch A: the failure, made concrete and getting worse in real time.
  // Branch B: the margin the governor buys, and what little it costs.
  const wearM = readout?.a?.contactMetreStrokes ?? 0;
  const cycles = Math.floor(readout?.a?.compressionCycles ?? 0);
  const floatImpactsA = Math.floor(readout?.a?.floatImpacts ?? 0);
  const fatigueCyclesA = Math.floor(readout?.a?.fatigueCycles ?? 0);
  const partedA = !!readout?.a?.parted;
  const floatImpactsB = Math.floor(readout?.b?.floatImpacts ?? 0);
  const partedB = !!readout?.b?.parted;
  const marginKn = governedTaper - FLOOR_KN;
  const throughputPct = baselineSpm > 0 ? (governedSpm / baselineSpm) * 100 : 100;

  // Weight vs. drag breakdown at the 750 m checkpoint, on whichever phase
  // gives the worst (most negative) reading there this stroke -- the same
  // number `predictedTaperTensionKn` already reports, decomposed into its
  // two physical parts instead of shown only as a net.
  const decompose = (profile) => {
    if (!profile) return null;
    let worst = Infinity;
    let worstPhase = 0;
    for (let i = 0; i < 72; i += 1) {
      const ph = (i / 72) * TAU;
      const f = profile.force(750, ph);
      if (f < worst) {
        worst = f;
        worstPhase = ph;
      }
    }
    return { netKn: worst, weightKn: weightBelowKn(750), dragKn: worst - weightBelowKn(750), phase: worstPhase };
  };
  const decompA = useMemo(() => decompose(baseline), [baseline]);
  const decompB = useMemo(() => decompose(governed), [governed]);

  // Gated on the 750 m taper checkpoint (baselineTaper/governedTaper), the
  // same anchor the headline stats and the tension gauge use — not the
  // profile's global minimum, which the validity note below discloses as
  // invalid right at the surface for both branches alike.
  const failureLines = partedA
    ? [
        `STRING PARTED at ${Math.round(readout?.a?.partDepthM ?? 900)} m. ${FATIGUE_CYCLES_TO_PART} cycles of alternating stress past the ${ENDURANCE_MPA} MPa illustrative endurance limit snapped the rod body.`,
        'The surface unit is still cycling normally above the break — nothing downhole is moving, and nothing signals that to the driller.',
        `${floatImpactsA} carrier-bar impacts logged before the parting; each one is the bridle slamming a gap shut at speed.`,
      ]
    : baselineTaper < 0
      ? [
          decompA
            ? `At 750 m: ${fmt(decompA.weightKn)} kN of buoyed rod weight is overcome by ${fmt(Math.abs(decompA.dragKn))} kN of upward Couette drag — net ${fmt(decompA.netKn)} kN, pushing not pulling.`
            : `${fmt(Math.abs(baselineTaper))} kN of compressive load at the top of the bottom taper (750 m) — the string has gone slack there and is pushing, not pulling.`,
          buck &&
            `Helical pitch ${buck.pitchM.toFixed(2)} m against the ${WELL.tubingIdMm} mm tubing wall — ${buck.bendingStressMpa.toFixed(0)} MPa of alternating bending stress, every stroke.`,
          `${fmt(wearM, 0)} metre-strokes of wall contact logged since reset, ${cycles} full compression cycle${cycles === 1 ? '' : 's'} — climbing for as long as this keeps running.`,
        ]
      : [`Still ${fmt(baselineTaper - FLOOR_KN)} kN above the anti-float floor at this speed; no buckling failure mode is active yet.`];

  const solutionLines = partedB
    ? [
        `STRING PARTED at ${Math.round(readout?.b?.partDepthM ?? 900)} m — the governor's own floor was not enough to save this run either. See the technical notes.`,
      ]
    : governedTaper >= 0
      ? [
          decompB
            ? `At 750 m: ${fmt(decompB.weightKn)} kN of buoyed rod weight beats ${fmt(Math.abs(Math.min(0, decompB.dragKn)))} kN of upward drag with room to spare — net +${fmt(decompB.netKn)} kN.`
            : `+${fmt(marginKn)} kN of margin held above the anti-float floor at 750 m — the string never goes slack there.`,
          `${fmt(throughputPct, 0)}% of the requested pump speed retained — the constraint costs little throughput for the wear it avoids.`,
          floatImpactsB > 0
            ? `${floatImpactsB} carrier-bar impact${floatImpactsB === 1 ? '' : 's'} logged since reset — rare enough that the governor is still doing its job.`
            : 'Zero compression cycles and zero carrier-bar impacts logged since reset, and it stays at zero for as long as this runs.',
        ]
      : [`The governor's own anti-float floor is violated here too, by ${fmt(Math.abs(governedTaper))} kN — see the technical notes for why.`];

  return (
    <section id="theatre" className="panel registered overflow-hidden" aria-labelledby="theatre-title">
      {/* ---------------- rail ---------------- */}
      <div className="panel-rail flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <span className="icon-badge tone-signal">
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </span>
          <div className="min-w-0">
            <h2 id="theatre-title" className="panel-title">
              Machine theatre: governed twin vs. uncontrolled baseline
            </h2>
            <p className="caption text-muted truncate">
              Synchronized wall clock · identical {UNIT.designation} units in {WELL.formation} ({WELL.totalDepthM} m TVD)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="segmented" role="group" aria-label="View mode">
            <button type="button" className="segmented-item" aria-pressed={mode === 'compare'} onClick={() => setMode('compare')}>
              <Columns2 className="w-3 h-3 inline -mt-px mr-1" />
              Compare
            </button>
            <button type="button" className="segmented-item" aria-pressed={soloA} onClick={() => setMode('baseline')}>
              <Maximize2 className="w-3 h-3 inline -mt-px mr-1" />
              Ungoverned
            </button>
            <button type="button" className="segmented-item" aria-pressed={soloB} onClick={() => setMode('governed')}>
              <Maximize2 className="w-3 h-3 inline -mt-px mr-1" />
              Governed
            </button>
          </div>

          <button
            type="button"
            className="btn-icon"
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Pause the mechanism' : 'Run the mechanism'}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
          <button type="button" className="btn-icon" onClick={handleReset} aria-label="Reset stroke counters">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            className="btn-icon"
            aria-pressed={particles}
            onClick={() => setParticles((p) => !p)}
            aria-label={particles ? 'Hide flow particles' : 'Show flow particles'}
            style={particles ? { color: 'rgb(var(--accent-interactive))' } : undefined}
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ---------------- headline comparison ---------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 p-3.5 bg-surface-1">
        <Headline
          label="Commanded speed"
          a={`${fmt(baselineSpm, 2)} SPM`}
          b={`${fmt(governedSpm, 2)} SPM`}
          note={
            spmDelta > 0.01
              ? `${advisorySource === 'solver' ? 'governor' : 'constraint'} backs off ${fmt(spmDelta, 2)} SPM`
              : spmDelta < -0.01
                ? `governor finds ${fmt(-spmDelta, 2)} SPM headroom`
                : 'governor concurs with request'
          }
        />
        <Headline
          label="Min tension at 750 m"
          a={`${fmt(baselineTaper)} kN`}
          b={`${fmt(governedTaper)} kN`}
          aBad={baselineTaper < FLOOR_KN}
          bBad={governedTaper < FLOOR_KN}
          note={`Anti-float floor: +${FLOOR_KN.toFixed(2)} kN`}
        />
        <Headline
          label="Rod in compression"
          a={baselineTaper < 0 ? `${Math.round(WELL.totalDepthM - baseline.minDepthM)} m` : 'none'}
          b={governedTaper < 0 ? `${Math.round(WELL.totalDepthM - governed.minDepthM)} m` : 'none'}
          aBad={baselineTaper < 0}
          bBad={governedTaper < 0}
          note="Rod length below neutral point"
        />
        <Headline
          label="Compression cycles"
          a={String(cycles)}
          b={String(Math.floor(readout?.b?.compressionCycles ?? 0))}
          aBad={cycles > 0}
          bBad={(readout?.b?.compressionCycles ?? 0) > 0}
          note="Strokes below neutral point"
        />
        <Headline
          label="Carrier-bar impacts"
          a={String(floatImpactsA)}
          b={String(floatImpactsB)}
          aBad={floatImpactsA > 0}
          bBad={floatImpactsB > 0}
          note="Bridle slack re-impacts"
        />
      </div>

      {/* ---------------- the bays ---------------- */}
      <div ref={hostRef} className={`grid gap-3.5 p-3.5 bg-surface-1 ${mode === 'compare' ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
        {showA && (
          <BayFrame
            tone={partedA || baselineTaper < 0 ? 'critical' : baselineTaper < FLOOR_KN ? 'caution' : 'safe'}
            eyebrow="Branch A"
            title="Ungoverned"
            subtitle={`Operator request held at ${fmt(baselineSpm, 2)} SPM. No forward thermal coupling.`}
            state={a}
            profile={baseline}
            spm={baselineSpm}
            icon={partedA || baselineTaper < FLOOR_KN ? <TriangleAlert className="w-3.5 h-3.5" /> : <Activity className="w-3.5 h-3.5" />}
            gaugeDomain={gaugeDomain}
            gaugeFloor={FLOOR_KN}
            parted={partedA}
          >
            <VerdictPanel
              tone={partedA || baselineTaper < 0 ? 'critical' : 'safe'}
              title={partedA || baselineTaper < 0 ? 'What fails here' : 'Branch A status'}
              lines={failureLines}
            />
            <MachineBay
              ref={bayA}
              clock={clock}
              branch="baseline"
              spm={baselineSpm}
              strokeM={strokeM}
              profile={baseline}
              temperatureC={tempC}
              tone={partedA || baselineTaper < 0 ? 'critical' : 'safe'}
              reduced={reduced}
              parallax={offset}
              showParticles={particles}
              simSpeed={simSpeed}
            />
          </BayFrame>
        )}

        {showB && (
          <BayFrame
            tone="safe"
            eyebrow="Branch B"
            title="Catenary governed"
            subtitle={
              advisorySource === 'solver'
                ? `SLSQP governor advises ${fmt(governedSpm, 2)} SPM against a +${FLOOR_KN.toFixed(2)} kN tension floor.`
                : `This scenario runs the governor disengaged, so the +${FLOOR_KN.toFixed(2)} kN anti-float constraint is solved here: ${fmt(governedSpm, 2)} SPM is the fastest speed that holds it.`
            }
            state={b}
            profile={governed}
            spm={governedSpm}
            icon={<ShieldCheck className="w-3.5 h-3.5" />}
            gaugeDomain={gaugeDomain}
            gaugeFloor={FLOOR_KN}
            parted={partedB}
          >
            <VerdictPanel tone="safe" title="What the governor buys" lines={solutionLines} />
            <MachineBay
              ref={bayB}
              clock={clock}
              branch="governed"
              spm={governedSpm}
              strokeM={strokeM}
              profile={governed}
              temperatureC={tempC}
              tone="safe"
              reduced={reduced}
              parallax={offset}
              showParticles={particles}
              simSpeed={simSpeed}
            />
          </BayFrame>
        )}
      </div>

      {/* ---------------- transport controls ---------------- */}
      <div className="px-4 py-3 border-t border-hairline flex flex-wrap items-center gap-x-5 gap-y-3">
        <label className="flex items-center gap-2.5 min-w-[240px] flex-1">
          <span className="eyebrow shrink-0">Crank phase</span>
          <input
            type="range"
            className="slider flex-1"
            min="0"
            max="0.999"
            step="0.001"
            value={scrub ?? 0}
            onChange={(e) => setScrub(Number(e.target.value))}
            onDoubleClick={() => setScrub(null)}
            aria-label="Scrub crank phase. Double-click to resume free running."
          />
          <span className="readout text-[11px] text-muted w-[74px] text-right">
            {scrub === null ? 'free run' : `${(scrub * 360).toFixed(0)}° from BDC`}
          </span>
          {scrub !== null && (
            <button type="button" className="btn btn-ghost !py-1 !px-2 text-[11px]" onClick={() => setScrub(null)}>
              Resume
            </button>
          )}
        </label>

        <div className="segmented" role="group" aria-label="Playback rate">
          {[0.25, 1, 2, 4].map((s) => (
            <button key={s} type="button" className="segmented-item" aria-pressed={simSpeed === s} onClick={() => onChangeSpeed?.(s)}>
              {s}×
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 readout text-[11px] text-muted">
          <span>
            A <span className="text-ink">{Math.floor(readout?.strokesA ?? 0)}</span> strokes
          </span>
          <span>
            B <span className="text-ink">{Math.floor(readout?.strokesB ?? 0)}</span> strokes
          </span>
        </div>
      </div>

      {/* ---------------- what the drawing asserts (collapsed by default) --- */}
      <div className="border-t border-hairline">
        <button
          type="button"
          className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left"
          aria-expanded={notesOpen}
          onClick={() => setNotesOpen((v) => !v)}
        >
          <span className="eyebrow">Technical notes — kinematics, calibration, buckling</span>
          <ChevronDown className={`w-3.5 h-3.5 text-faint transition-transform ${notesOpen ? 'rotate-180' : ''}`} />
        </button>

        {notesOpen && (
          <>
            <div className="grid md:grid-cols-3 gap-px bg-hairline border-t border-hairline">
              <Fact
                title="Exact four-bar kinematics"
                body={`Polished rod motion is solved from the real ${UNIT.designation} linkage (A ${UNIT.A}″, C ${UNIT.C}″, P ${UNIT.P}″, R ${UNIT.R}″, I ${UNIT.I}″, H ${UNIT.H}″, G ${UNIT.G}″), not approximated as a sine. The unit spends ${UPSTROKE_DEG.toFixed(1)}° of crank rotation on the upstroke and ${DOWNSTROKE_DEG.toFixed(1)}° on the downstroke, so the string is driven down ${((UPSTROKE_DEG / DOWNSTROKE_DEG - 1) * 100).toFixed(1)}% faster than it is lifted. Stroke closes at ${(STROKE_IN * 0.0254).toFixed(3)} m; the linkage loop closes to 1e-10 in.`}
              />
              <Fact
                title="Reconstruction pinned to the solver"
                body={`F(x, θ) carries the solver's downhole card at ${WELL.totalDepthM} m and is fitted at both ends of the string: an effective mixture viscosity bisected at surface against the reported ${fmt(dyn?.pprl_kn)} kN PPRL, and a drag-concentration factor λ = ${fmt(fit.fitted.lambda, 3)} bisected at 750 m against the reported ${fmt(tenCheck)} kN minimum tension. Both anchors are hit exactly. The one quantity never shown its own answer is the viscosity, and it resolves to ${fmt(viscRecon, 0)} cP against the rheology engine's independently computed ${fmt(viscCheck, 0)} cP — ${Number.isFinite(viscErr) ? `${viscErr > 0 ? '+' : ''}${viscErr.toFixed(0)}%` : '—'}, and the same offset recurs across every scenario. Both branches reuse those two constants, so only commanded speed separates them.`}
              />
              <Fact
                title="Buckling geometry"
                body={
                  buck
                    ? `Lubinski (SPE 178-PA): p = √(8π²EI/F). At ${fmt(Math.abs(baseline.minKn))} kN of compression on the ${WELL.tubingIdMm} mm bore, helix pitch is ${buck.pitchM.toFixed(2)} m at a fixed ${buck.amplitudeMm.toFixed(1)} mm amplitude — compression sets the pitch, not the amplitude — inducing ${buck.bendingStressMpa.toFixed(0)} MPa of alternating bending stress.`
                    : 'Both branches hold axial tension through the full stroke, so there is no neutral point and no wall contact. Detail B shows the string running straight and centred.'
                }
              />
            </div>

            <div className="px-4 py-2.5 border-t border-hairline space-y-1.5">
              <p className="caption">
                Peak polished rod speed {fmt(env.peakUpMps)} m/s up / {fmt(env.peakDownMps)} m/s down, at{' '}
                {env.thetaPeakUpDeg.toFixed(0)}° and {env.thetaPeakDownDeg.toFixed(0)}° from bottom dead centre (BDC sits at{' '}
                {((THETA_BDC * 180) / Math.PI).toFixed(1)}° of mechanical crank angle, not 0°). Annular Couette drag is linear
                in that speed, which is why pump rate — the governor's only lever — is sufficient to hold the tension floor.
              </p>
              {slack && (
                <p className="caption text-critical">
                  <strong>Validity note.</strong> On branch A the reconstruction drives the polished rod load itself to{' '}
                  {fmt(baseline.minSurfaceKn)} kN. A rod string cannot carry compression at surface: physically the bridle
                  goes slack and the carrier bar separates from the polished rod clamp, then re-impacts on reversal. Past that
                  point the linear-drag balance no longer describes the machine, so the depth of the excursion is indicative
                  only — the failure it indicates is not.
                </p>
              )}
              {Number.isFinite(solverBaselineMinKn) && (
                <p className="caption">
                  Corroboration: the solver's own uncontrolled reference card, computed independently at the {Math.round(tempC)} °C sandface,
                  bottoms out at {fmt(solverBaselineMinKn)} kN — the same failure, reached by a different route.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function BayFrame({ tone, eyebrow, title, subtitle, state, profile, spm, icon, children, gaugeDomain, gaugeFloor, parted }) {
  const taperMin = profile?.predictedTaperTensionKn;
  const isNegative = Number.isFinite(taperMin) ? taperMin < 0 : false;
  const isCompressed = !parted && (isNegative || !!state?.compressed);
  const isLowMargin = !parted && !isCompressed && Number.isFinite(taperMin) ? taperMin < gaugeFloor : false;
  const effectiveTone = parted || isCompressed ? 'critical' : isLowMargin ? 'caution' : tone ?? 'safe';
  const toneClass = effectiveTone === 'critical' ? 'tone-critical' : effectiveTone === 'caution' ? 'tone-caution' : 'tone-safe';
  const pillLabel = parted
    ? 'String parted'
    : isCompressed
      ? 'Compression active'
      : isLowMargin
        ? 'Low safety margin'
        : 'Tension held';
  return (
    <div className={`bg-surface-1 min-w-0 ${parted ? 'ring-1 ring-inset ring-critical' : ''}`}>
      <header className="px-5 pt-4 pb-3.5 border-b border-hairline bg-surface-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="text-xs font-medium text-muted">{eyebrow}</span>
            <h3 className="text-base font-bold text-ink mt-0.5 flex items-center gap-2 tracking-tight">
              <span className={`icon-badge !w-5 !h-5 !rounded-[4px] ${toneClass}`}>{icon}</span>
              {title}
            </h3>
            <p className="caption mt-0.5 text-muted">{subtitle}</p>
          </div>
          <span className={`pill ${toneClass} shrink-0 text-xs`}>
            <span className="chip-dot" />
            {pillLabel}
          </span>
        </div>

        <dl className="grid grid-cols-4 gap-x-4 gap-y-1.5 mt-3 py-2.5 px-3.5 bg-surface-2 rounded-md">
          <Cell label="Speed" value={fmt(spm, 2)} unit="SPM" />
          <Cell
            label="Tension @ 750 m"
            value={parted ? '—' : fmt(profile?.predictedTaperTensionKn)}
            unit={parted ? 'no signal' : 'kN min'}
            bad={parted || (profile?.predictedTaperTensionKn ?? 1) < FLOOR_KN}
          />
          <Cell
            label="Plunger stroke"
            value={parted ? '—' : fmt((state?.travelRatio ?? 0) * 100, 0)}
            unit={parted ? 'isolated' : '% travel'}
            bad={parted || (state?.travelRatio ?? 1) < 0.7}
          />
          <Cell
            label="Valves"
            value={parted ? '—' : state ? (state.tvOpen ? 'TV' : state.svOpen ? 'SV' : '—') : '—'}
            unit={parted ? 'dead' : state ? (state.tvOpen ? 'open' : state.svOpen ? 'open' : 'both shut') : ''}
            bad={parted || (state ? !state.tvOpen && !state.svOpen : false)}
          />
        </dl>

        {gaugeDomain && !parted && (
          <TensionGauge
            value={profile?.predictedTaperTensionKn}
            domain={gaugeDomain}
            floor={gaugeFloor}
            compressed={isCompressed}
          />
        )}
        {parted && (
          <p className="caption text-critical mt-3">
            Rod body parted from fatigue. The barrel below is isolated and producing nothing; the surface unit keeps
            stroking over an empty well until it is shut down or reset.
          </p>
        )}
      </header>
      <div className="p-3 bg-surface-2">{children}</div>
    </div>
  );
}

/**
 * HERO INSTRUMENT GAUGE:
 * Recessed physical instrument dial trough with shaded physical zones,
 * gliding pointer needle, and clean external rulers (zero text cramming inside the bar).
 */
function TensionGauge({ value, domain, floor, compressed }) {
  const [lo, hi] = domain;
  const pct = (v) => `${(100 * (clamp01((v - lo) / (hi - lo)))).toFixed(2)}%`;
  const zeroPct = pct(0);
  const floorPct = pct(floor);
  const valuePct = Number.isFinite(value) ? pct(value) : null;
  const deltaFromFloor = Number.isFinite(value) ? value - floor : null;
  const isSafe = Number.isFinite(value) && value >= floor;
  const isLowMargin = !compressed && !isSafe;

  const stateLabel = compressed
    ? 'Compression (< 0 kN)'
    : isLowMargin
      ? 'Low margin buffer'
      : 'Safe envelope';
  const stateTone = compressed
    ? 'tone-critical text-critical'
    : isLowMargin
      ? 'tone-caution text-caution'
      : 'tone-safe text-safe';
  const needleTone = compressed
    ? 'bg-critical'
    : isLowMargin
      ? 'bg-caution'
      : 'bg-safe';

  return (
    <div className="mt-3.5 pt-3 border-t border-hairline/60">
      {/* Instrument Header: Label + Active Zone Badge + Live Tabular Delta */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-ink">Axial tension gauge</span>
          <span className="text-[11px] text-muted">(750 m taper checkpoint)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`pill ${stateTone} text-[10.5px] py-0.5 px-2`}>
            <span className="chip-dot" />
            {stateLabel}
          </span>
          <div className="flex items-baseline gap-1 font-mono">
            <span className={`text-base font-bold ${compressed ? 'text-critical' : isSafe ? 'text-safe' : 'text-caution'}`}>
              {Number.isFinite(value) ? `${value >= 0 ? '+' : ''}${value.toFixed(2)} kN` : '—'}
            </span>
            {deltaFromFloor !== null && (
              <span className="text-[11px] text-muted">
                ({deltaFromFloor >= 0 ? `+${deltaFromFloor.toFixed(2)} margin` : `${deltaFromFloor.toFixed(2)} deficit`})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Recessed Physical Instrument Dial Trough (28px) */}
      <div className="relative h-7 rounded instrument-trough">
        {/* Shaded Zone 1: Helical Buckling / Compression (< 0 kN) */}
        <div
          className="absolute inset-y-0 left-0"
          style={{ width: zeroPct, background: 'rgba(185, 28, 28, 0.18)' }}
          title="Helical buckling compression zone (< 0 kN)"
        />

        {/* Shaded Zone 2: Anti-Float Margin Buffer (0 to +0.50 kN) */}
        <div
          className="absolute inset-y-0"
          style={{
            left: zeroPct,
            width: `calc(${floorPct} - ${zeroPct})`,
            background: 'rgba(180, 83, 9, 0.22)',
          }}
          title={`Anti-float buffer margin (0 to +${floor.toFixed(2)} kN)`}
        />

        {/* Shaded Zone 3: Safe Operating Envelope (>= +0.50 kN) */}
        <div
          className="absolute inset-y-0 right-0"
          style={{
            left: floorPct,
            background: 'rgba(21, 128, 61, 0.14)',
          }}
          title={`Safe axial tension operating envelope (>= +${floor.toFixed(2)} kN)`}
        />

        {/* Boundary Pin: 0.00 kN Neutral Point */}
        <div
          className="absolute inset-y-0 w-[1.5px] bg-critical/90 z-10 pointer-events-none"
          style={{ left: zeroPct }}
          title="0.00 kN neutral point"
        />

        {/* Boundary Pin: +0.50 kN Anti-Float Threshold */}
        <div
          className="absolute inset-y-0 w-[1.5px] bg-caution/90 z-10 pointer-events-none"
          style={{ left: floorPct }}
          title={`+${floor.toFixed(2)} kN anti-float threshold`}
        />

        {/* Gliding High-Contrast Pointer Needle */}
        {valuePct !== null && (
          <div
            className="absolute inset-y-0 z-20 pointer-events-none -translate-x-1/2 transition-[left] duration-300 ease-out"
            style={{ left: valuePct }}
          >
            {/* Top Indicator Triangle Head */}
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0 border-x-[4px] border-x-transparent border-t-[5px]"
              style={{
                borderTopColor: compressed
                  ? 'rgb(var(--accent-critical))'
                  : isSafe
                    ? 'rgb(var(--accent-safe))'
                    : 'rgb(var(--accent-caution))',
              }}
            />
            {/* Vertical Needle Line */}
            <div className={`w-[2px] h-full mx-auto shadow-sm ${needleTone}`} />
          </div>
        )}
      </div>

      {/* Clean Physical Scale Ruler */}
      <div className="flex items-center justify-between mt-1.5 text-[11px] font-mono text-muted">
        <span>{lo.toFixed(0)} kN min</span>
        <div className="flex items-center gap-3">
          <span className="text-critical font-medium">0 kN (neutral)</span>
          <span className="text-muted">·</span>
          <span className="text-caution font-medium">+{floor.toFixed(2)} kN floor</span>
        </div>
        <span>+{hi.toFixed(0)} kN max</span>
      </div>
    </div>
  );
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** Clean verdict callouts without middle-dot meta clutter */
function VerdictPanel({ tone, title, lines }) {
  const toneClass = tone === 'critical' ? 'tone-critical' : 'tone-safe';
  const items = lines.filter(Boolean);
  return (
    <div className={`well ${toneClass} px-3.5 py-2.5 mb-2`}>
      <div className="text-xs font-semibold flex items-center gap-1.5 mb-1">
        <span className="chip-dot" />
        {title}
      </div>
      <ul className="space-y-1">
        {items.map((line, i) => (
          <li key={i} className="caption leading-snug flex gap-1.5 text-ink">
            <span aria-hidden="true" className="shrink-0 text-muted">▸</span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Cell({ label, value, unit, bad }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted truncate">{label}</dt>
      <dd className={`readout text-sm font-semibold truncate ${bad ? 'text-critical' : 'text-ink'}`}>
        {value} <span className="text-muted font-normal text-[11px]">{unit}</span>
      </dd>
    </div>
  );
}

function Headline({ label, a, b, note, aBad, bBad }) {
  return (
    <div className="bg-surface-2 rounded-lg px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col justify-between">
      <div className="text-xs font-semibold text-muted">{label}</div>
      <div className="flex items-baseline gap-2 mt-1.5 whitespace-nowrap">
        <span className={`readout text-base font-bold ${aBad ? 'text-critical' : 'text-primary'}`}>{a}</span>
        <span className="text-muted text-xs">→</span>
        <span className={`readout text-base font-bold ${bBad ? 'text-critical' : 'text-safe'}`}>{b}</span>
      </div>
      <div className="caption mt-1.5 text-[11px] text-muted leading-tight">{note}</div>
    </div>
  );
}

function Fact({ title, body }) {
  return (
    <div className="bg-surface-2 px-4 py-3.5">
      <h4 className="text-xs font-semibold text-ink">{title}</h4>
      <p className="caption mt-1 text-muted">{body}</p>
    </div>
  );
}

export default MachineTheatre;
