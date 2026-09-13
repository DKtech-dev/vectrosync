import React, { forwardRef, useImperativeHandle, useMemo, useRef, useId } from 'react';
import { FRAME, UNIT, STROKE_IN, surfaceState } from './pumpingUnit.js';
import {
  WELL,
  STRATA,
  ROD_TAPERS,
  makeDepthScale,
  helicalBuckling,
  radialClearanceMm,
  clamp,
  axialStressMpa,
  ENDURANCE_MPA,
  FATIGUE_CYCLES_TO_PART,
} from './wellModel.js';
import { ParticleField } from './ParticleField.jsx';

/**
 * ============================================================================
 * MACHINE BAY — one complete CSS-SRP well, drawn to scale and animated
 * ============================================================================
 *
 * Two of these run side by side against one clock: the UNGOVERNED baseline and
 * the CATENARY-GOVERNED case. Identical machine, identical fluid, identical
 * formation — the only difference is the commanded pump speed.
 *
 * SCALES. There are three, and each is stated on the drawing rather than being
 * silently blended, which is what engineering drawings do and what the previous
 * schematic did not:
 *
 *   1. SURFACE   true proportion, 1 scene unit = 1.136 in of real machine.
 *   2. SUBSURFACE  vertical: linear in depth, 1 unit = 2.56 m over 0-1150 m.
 *                  horizontal: 1 unit = 4.90 mm  -> exaggerated ~522x, which
 *                  is the only way a 76 mm tubing bore is visible next to a
 *                  1150 m column. The exaggeration factor is printed.
 *   3. DETAILS   two magnified windows at true 1:1 aspect, because the 2.54 m
 *                stroke is 0.22% of the column and simply cannot be animated
 *                at full-column scale. Pretending otherwise is how you end up
 *                with a pump barrel that bounces.
 *
 * The scale break between (1) and (2) is drawn explicitly.
 * ==========================================================================*/

/* ---- Scene frame ---------------------------------------------------------- */
export const SCENE_W = 480;
export const SCENE_H = 880;

const S = 0.88; // scene units per inch, surface region
const TX = 200.8;
const GROUND_Y = 296;

const X = (inches) => TX + S * inches;
const Y = (inches) => GROUND_Y - S * inches;
const Lp = (inches) => S * inches;

const WELL_X = X(FRAME.wellCentreX); // 412 — the polished rod line
const SADDLE = { x: X(UNIT.I), y: Y(UNIT.H) };
const CRANK = { x: X(0), y: Y(UNIT.G) };
const A_SCENE = Lp(UNIT.A);
const TANGENT = { x: SADDLE.x + A_SCENE, y: SADDLE.y };
const WIRELINE_TOTAL = Lp(150);
const HEAD_HALF_DEG = 26;

const SUB_TOP = 322;
const SUB_BOTTOM = 772;
const depthY = makeDepthScale(SUB_TOP, SUB_BOTTOM);
const MM = 0.2035; // scene units per mm, horizontal, subsurface
const H_EXAG = Math.round(1000 / depthY.pxPerM / (1 / MM));

/* Axial force profile plot. The domain is derived per bay from that bay's own
   envelope, because the two branches differ by an order of magnitude and a
   shared fixed domain would either clip branch A or flatten branch B. */
const FP = { x0: 52, x1: 212 };

function makeForceScale(profile) {
  // Floored at -25 kN. Once F crosses zero the string is buckled into wall
  // contact and the linear-drag balance is out of its validity envelope, so
  // letting a -60 kN excursion set the domain would squash the region that is
  // still quantitative in order to show one that is not. Clipping is marked.
  const raw = Number.isFinite(profile?.minKn) ? profile.minKn : -2;
  const lo = Math.max(-25, Math.min(-2, raw));
  const hi = Math.max(10, Number.isFinite(profile?.maxKn) ? profile.maxKn : 10);
  const pad = (hi - lo) * 0.06;
  const fMin = lo - pad;
  const fMax = hi + pad;
  const fx = (kn) => FP.x0 + ((clamp(kn, fMin, fMax) - fMin) / (fMax - fMin)) * (FP.x1 - FP.x0);
  fx.fMin = fMin;
  fx.fMax = fMax;
  fx.clipped = raw < fMin;
  // Round grid values that actually fall inside this domain.
  const step = niceStep((fMax - fMin) / 5);
  const ticks = [];
  for (let v = Math.ceil(fMin / step) * step; v <= fMax; v += step) ticks.push(Math.round(v * 100) / 100);
  fx.ticks = ticks;
  return fx;
}

function niceStep(raw) {
  const mag = 10 ** Math.floor(Math.log10(Math.abs(raw) || 1));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
}

/* Detail windows. Held clear of the annotation gutter at x 344-386 so the
   wellbore callouts have somewhere to live. */
const PUMP_WIN = { x: 216, y: 330, w: 126, h: 218 };
const BUCK_WIN = { x: 216, y: 566, w: 126, h: 202 };
const ANNO_X = 386; // right-anchored wellbore labels

const RAD = Math.PI / 180;
const fmt = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '—');

/* -------------------------------------------------------------------------- */

export const MachineBay = forwardRef(function MachineBay(
  {
    clock,
    branch, // 'baseline' | 'governed'
    spm,
    strokeM = 2.54,
    profile, // from makeCalibratedProfile
    temperatureC = 200,
    fluidLevelM = 430,
    tone = 'signal',
    reduced = false,
    parallax,
    showParticles = true,
    simSpeed = 1,
  },
  ref,
) {
  const uid = useId().replace(/:/g, '');
  const emitters = useRef({});

  /* --- refs on every moving part ---------------------------------------- */
  const beamRef = useRef(null);
  const crankRef = useRef(null);
  const pitmanRef = useRef(null);
  const pitmanCapRef = useRef(null);
  const bridleRef = useRef(null);
  const bridle2Ref = useRef(null);
  const carrierRef = useRef(null);
  const clampRodRef = useRef(null);
  const gapMarkerRef = useRef(null);
  const gapLabelRef = useRef(null);
  const shockRingRef = useRef(null);
  const forceCurveRef = useRef(null);
  const forceDotRef = useRef(null);
  const neutralRef = useRef(null);
  const bucklePathRef = useRef(null);
  const buckleGlowRef = useRef(null);
  const partedMarkRef = useRef(null);
  const plungerRef = useRef(null);
  const tvRef = useRef(null);
  const svRef = useRef(null);
  const tvBallRef = useRef(null);
  const svBallRef = useRef(null);
  const chamberRef = useRef(null);
  const parallaxNear = useRef(null);
  const parallaxFar = useRef(null);
  const strokeMarkRef = useRef(null);

  /* --- persistent animation/failure state (plain refs, not DOM nodes) --- */
  const floatRef = useRef({ lag: 0, wasFloating: false });
  const shockRef = useRef({ t: Infinity });
  const cycleRef = useRef({ lastPhase: 0, strokeCompressed: false, sigmaMax: -Infinity, sigmaMin: Infinity });
  const statsRef = useRef({ compressionCycles: 0, contactMetreStrokes: 0, floatImpacts: 0, fatigueCycles: 0, parted: false, partDepthM: null });

  /* --- force scale, derived from this bay's own envelope ---------------- */
  const fx = useMemo(() => makeForceScale(profile), [profile]);
  const FX_ZERO = fx(0);

  /* --- precomputed static geometry -------------------------------------- */
  const geom = useMemo(() => buildStaticGeometry({ fluidLevelM, uid, fx }), [fluidLevelM, uid, fx]);

  /* --- envelope band (min/max force over the stroke, per depth) ---------- */
  const envelope = useMemo(() => {
    if (!profile) return null;
    const lo = [];
    const hi = [];
    for (let d = 0; d <= WELL.totalDepthM; d += 25) {
      const [mn, mx] = profile.envelope(d);
      lo.push(`${fx(mn).toFixed(1)},${depthY(d).toFixed(1)}`);
      hi.push(`${fx(mx).toFixed(1)},${depthY(d).toFixed(1)}`);
    }
    return `${lo.join(' ')} ${hi.reverse().join(' ')}`;
  }, [profile, fx]);

  /* --- imperative per-frame update -------------------------------------- */
  useImperativeHandle(
    ref,
    () => ({
      update(phase, dtS) {
        const st = surfaceState(phase, spm, strokeM);
        const tiltDeg = st.beamTiltDeg;
        const stats = statsRef.current;
        // Every failure indicator below (rod float, buckling, compression
        // cycles, wall wear, the "Compression" pill) is gated on THIS depth --
        // the same 750 m taper checkpoint the governor's own anti-float floor
        // protects, and the same one MachineTheatre's headline text uses for
        // "String in compression". The profile's raw depth-0 minimum is an
        // anchoring artifact (see wellModel.js: only the surface PEAK is
        // calibrated, never its trough) that goes negative at unrealistically
        // low speed on BOTH branches alike, which used to make every failure
        // animation fire identically for governed and ungoverned. Gating here
        // instead makes the drawing agree with the numbers next to it.
        const checkDepthM = profile?.checkDepthM ?? 750;

        // Walking beam + horsehead rotate rigidly about the saddle bearing.
        beamRef.current?.setAttribute('transform', `rotate(${tiltDeg} ${SADDLE.x} ${SADDLE.y})`);
        // Crank + counterweights rotate about the crankshaft.
        crankRef.current?.setAttribute('transform', `rotate(${st.crankAngleDeg} ${CRANK.x} ${CRANK.y})`);

        // Pitman: recomputed, never rotated — its endpoints belong to two
        // different rotating bodies.
        const px = X(st.crankPin.x);
        const py = Y(st.crankPin.y);
        const ex = X(st.equalizer.x);
        const ey = Y(st.equalizer.y);
        if (pitmanRef.current) {
          pitmanRef.current.setAttribute('x1', ex);
          pitmanRef.current.setAttribute('y1', ey);
          pitmanRef.current.setAttribute('x2', px);
          pitmanRef.current.setAttribute('y2', py);
        }
        if (pitmanCapRef.current) {
          pitmanCapRef.current.setAttribute('cx', px);
          pitmanCapRef.current.setAttribute('cy', py);
        }

        /* ---- Rod float, animated at the surface -----------------------------
           Driven by the checkpoint tension, not the raw polished-rod load: when
           the string goes into compression at the taper the governor actually
           protects, the bridle can no longer stay taut all the way to surface,
           so the clamp + rod lag behind the beam's commanded rate, opening a
           real gap below the (still rigid) carrier bar, until tension returns
           and it slams shut again. */
        const checkLoadKn = profile ? profile.force(checkDepthM, phase) : NaN;
        const floating = Number.isFinite(checkLoadKn) && checkLoadKn < 0;
        const flt = floatRef.current;
        const MAX_LAG = 5.5; // scene units, ~6 in of real clamp travel
        const targetLag = floating ? clamp(Math.abs(checkLoadKn) / 4, 0, 1) * MAX_LAG : 0;
        const approachRate = floating ? 9 : 30; // opens gradually, snaps shut fast
        flt.lag += (targetLag - flt.lag) * clamp(dtS * approachRate, 0, 1);
        const justImpacted = flt.wasFloating && !floating && flt.lag > 0.05;
        flt.wasFloating = floating;
        const shk = shockRef.current;
        if (justImpacted) {
          shk.t = 0;
          stats.floatImpacts += 1;
        }
        shk.t = Math.min(shk.t + dtS, 4);
        const shockFlash = Math.exp(-shk.t * 7);

        clampRodRef.current?.setAttribute('transform', `translate(0 ${(-flt.lag).toFixed(2)})`);
        if (gapMarkerRef.current) {
          const show = flt.lag > 0.3;
          gapMarkerRef.current.setAttribute('opacity', show ? String(clamp(flt.lag / 2.5, 0.25, 0.95)) : '0');
          gapMarkerRef.current.setAttribute('y2', (TANGENT.y + 7.5 - flt.lag).toFixed(2));
        }
        gapLabelRef.current?.setAttribute('opacity', flt.lag > 1.2 ? '0.9' : '0');
        if (shockRingRef.current) {
          shockRingRef.current.setAttribute('r', (2.5 + shk.t * 46).toFixed(1));
          shockRingRef.current.setAttribute('opacity', (shockFlash * 0.85).toFixed(3));
        }

        // Wireline bridle. The tangent point is FIXED in space; the horsehead
        // face slides beneath it. Wireline paid out = A * swept angle, which is
        // exactly why the polished rod travels A*dpsi and stays vertical. The
        // same float event slackens the cable: it bows instead of running taut.
        const anchorDeg = tiltDeg - HEAD_HALF_DEG;
        const ax = SADDLE.x + A_SCENE * Math.cos(anchorDeg * RAD);
        const ay = SADDLE.y + A_SCENE * Math.sin(anchorDeg * RAD);
        const arcLen = A_SCENE * Math.abs(anchorDeg * RAD);
        const carrierY = SADDLE.y + (WIRELINE_TOTAL - arcLen);
        const bow = flt.lag * 0.9;
        const midY = (TANGENT.y + carrierY) / 2;
        const d =
          bow > 0.15
            ? `M ${ax.toFixed(2)} ${ay.toFixed(2)} A ${A_SCENE} ${A_SCENE} 0 0 1 ${TANGENT.x.toFixed(2)} ${TANGENT.y.toFixed(2)} Q ${(TANGENT.x + bow * 2.4).toFixed(2)} ${midY.toFixed(2)} ${TANGENT.x.toFixed(2)} ${carrierY.toFixed(2)}`
            : `M ${ax.toFixed(2)} ${ay.toFixed(2)} A ${A_SCENE} ${A_SCENE} 0 0 1 ${TANGENT.x.toFixed(2)} ${TANGENT.y.toFixed(2)} L ${TANGENT.x.toFixed(2)} ${carrierY.toFixed(2)}`;
        bridleRef.current?.setAttribute('d', d);
        bridle2Ref.current?.setAttribute('d', d);
        bridleRef.current?.setAttribute('opacity', bow > 0.15 ? '0.5' : '0.85');
        carrierRef.current?.setAttribute('transform', `translate(0 ${(carrierY - TANGENT.y).toFixed(2)})`);
        strokeMarkRef.current?.setAttribute('transform', `translate(0 ${(carrierY - TANGENT.y).toFixed(2)})`);

        /* ---- Axial force profile ---------------------------------------- */
        // The curve itself is still drawn over the FULL column -- that is a
        // faithful plot of the reconstruction, off-model excursion and all,
        // and the panel already labels where it goes off-model ("clipped" /
        // validity note). But minKn/neutralM, which decide whether the string
        // is treated as BUCKLED, only look from checkDepthM down to the pump:
        // see the comment above checkDepthM for why the shallow column can't
        // be trusted for that decision.
        let minKn = NaN;
        let neutralM = null;
        if (profile && !stats.parted) {
          let path = '';
          for (let dd = 0; dd <= WELL.totalDepthM; dd += 25) {
            const f = profile.force(dd, phase);
            path += `${path ? 'L' : 'M'}${fx(f).toFixed(1)},${depthY(dd).toFixed(1)}`;
            if (dd < checkDepthM) continue;
            if (!Number.isNaN(f) && (Number.isNaN(minKn) || f < minKn)) minKn = f;
            if (f < 0 && neutralM === null) neutralM = dd;
          }
          forceCurveRef.current?.setAttribute('d', path);
          forceCurveRef.current?.setAttribute('opacity', '1');
          const fPump = profile.force(WELL.totalDepthM, phase);
          if (forceDotRef.current) {
            forceDotRef.current.setAttribute('cx', fx(fPump));
            forceDotRef.current.setAttribute('cy', depthY(WELL.totalDepthM));
            forceDotRef.current.setAttribute('opacity', '1');
          }
          if (neutralRef.current) {
            if (neutralM !== null) {
              neutralRef.current.setAttribute('transform', `translate(0 ${depthY(neutralM).toFixed(1)})`);
              neutralRef.current.setAttribute('opacity', '1');
            } else {
              neutralRef.current.setAttribute('opacity', '0');
            }
          }
        } else if (stats.parted) {
          // A parted string transmits no force below the break. Showing a
          // profile here would imply a continuous rod that no longer exists.
          forceCurveRef.current?.setAttribute('opacity', '0');
          forceDotRef.current?.setAttribute('opacity', '0');
          neutralRef.current?.setAttribute('opacity', '0');
        }

        /* ---- Buckling ---------------------------------------------------- */
        // The trigger itself is gated on checkLoadKn -- the EXACT checkpoint
        // depth, matching "F @750 M" on the headline and predictedTaperTensionKn
        // bit for bit. minKn (the deeper scan) is only used below, once this is
        // already true, to size the severity/extent of the buckling drawing --
        // never to decide whether the event is happening at all. With the real
        // (non-synthetic) downhole card, some depth strictly below the taper top
        // can dip more negative than the checkpoint itself even while the
        // checkpoint stays positive; letting THAT drive "Compression" is exactly
        // what made the governed branch flag a failure the headline denied.
        // minKn's scan starts AT checkDepthM, so it is always <= checkLoadKn --
        // whenever the checkpoint itself is negative, minKn is too, and stays a
        // safe, meaningful magnitude for sizing the buckling drawing below.
        const compressed = !stats.parted && Number.isFinite(checkLoadKn) && checkLoadKn < 0;
        const severity = compressed ? clamp(Math.abs(minKn) / 12, 0.08, 1) : 0;
        if (bucklePathRef.current) {
          if (compressed) {
            const top = neutralM ?? checkDepthM;
            const buck = helicalBuckling(Math.abs(minKn), Math.max(top, 760));
            // Drawn at a decimated spatial frequency: the true pitch is
            // sub-pixel here. The detail window below carries the true pitch.
            const drawnPeriodM = Math.max(28, buck.pitchM * 3.2);
            const amp = radialClearanceMm(Math.max(top, 760)) * MM;
            let p = '';
            for (let dd = top; dd <= WELL.totalDepthM; dd += 4) {
              const t = (dd - top) / drawnPeriodM;
              const ramp = clamp((dd - top) / 160, 0, 1);
              const xx = WELL_X + Math.sin(t * Math.PI * 2) * amp * ramp * severity;
              p += `${p ? 'L' : 'M'}${xx.toFixed(2)},${depthY(dd).toFixed(1)}`;
            }
            bucklePathRef.current.setAttribute('d', p);
            bucklePathRef.current.setAttribute('opacity', '1');
            buckleGlowRef.current?.setAttribute('d', p);
            buckleGlowRef.current?.setAttribute('opacity', String(0.28 * severity));
          } else {
            bucklePathRef.current.setAttribute('opacity', '0');
            buckleGlowRef.current?.setAttribute('opacity', '0');
          }
        }

        /* ---- Fatigue: Δσ at the 750 m checkpoint over one full stroke, vs
           an illustrative endurance limit (wellModel.ENDURANCE_MPA). Also
           where compression cycles and wall-contact wear are tallied, both
           per-bay and symmetric between the two branches. --------------- */
        const cyc = cycleRef.current;
        if (!stats.parted) {
          if (compressed) {
            cyc.strokeCompressed = true;
            const contactM = WELL.totalDepthM - (neutralM ?? WELL.totalDepthM);
            stats.contactMetreStrokes += contactM * (spm / 60) * dtS * simSpeed;
          }
          if (profile) {
            const sigma750 = axialStressMpa(profile.force(checkDepthM, phase), checkDepthM);
            if (Number.isFinite(sigma750)) {
              cyc.sigmaMax = Math.max(cyc.sigmaMax, sigma750);
              cyc.sigmaMin = Math.min(cyc.sigmaMin, sigma750);
            }
          }
          if (phase < cyc.lastPhase) {
            if (cyc.strokeCompressed) stats.compressionCycles += 1;
            const dSigma = cyc.sigmaMax - cyc.sigmaMin;
            if (Number.isFinite(dSigma) && dSigma > ENDURANCE_MPA) {
              stats.fatigueCycles += 1;
              if (stats.fatigueCycles >= FATIGUE_CYCLES_TO_PART) {
                stats.parted = true;
                stats.partDepthM = neutralM ?? 900;
              }
            }
            cyc.strokeCompressed = false;
            cyc.sigmaMax = -Infinity;
            cyc.sigmaMin = Infinity;
          }
          cyc.lastPhase = phase;
        }
        if (partedMarkRef.current) {
          if (stats.parted) {
            partedMarkRef.current.setAttribute('transform', `translate(0 ${depthY(stats.partDepthM ?? 900).toFixed(1)})`);
            partedMarkRef.current.setAttribute('opacity', '1');
          } else {
            partedMarkRef.current.setAttribute('opacity', '0');
          }
        }

        /* ---- Downhole pump detail (true stroke scale) --------------------- */
        // Elastic lag plus the float penalty; see wellModel.pumpState. A
        // parted string can no longer move a plunger at all -- frozen dead.
        let travelRatio = 0;
        let tvOpen = false;
        let svOpen = false;
        let pf = 0;
        if (stats.parted) {
          plungerRef.current?.setAttribute('transform', 'translate(0 0)');
          chamberRef.current?.setAttribute('height', '0');
          setValve(tvRef.current, false, geom.pump.ballR);
          setValve(svRef.current, false, geom.pump.ballR);
        } else {
          const lagDeg = 6.3 + 46 * severity;
          travelRatio = clamp(0.93 - 0.6 * severity, 0.1, 1);
          const lagged = ((((st.phaseDeg - lagDeg) % 360) + 360) % 360) * RAD;
          pf = surfaceState(lagged, 1, strokeM).fraction * travelRatio;
          // The plunger group is authored at the BOTTOM of its travel and
          // lifted from there, so travelRatio < 1 shortens the stroke from the
          // top -- which is what elastic lag and float physically do.
          const lift = pf * geom.pump.strokePx;
          plungerRef.current?.setAttribute('transform', `translate(0 ${(-lift).toFixed(2)})`);
          // Barrel chamber between the traveling and standing valves.
          if (chamberRef.current) {
            const top = geom.pump.chamberBaseY - lift;
            chamberRef.current.setAttribute('y', top.toFixed(2));
            chamberRef.current.setAttribute('height', Math.max(0, geom.pump.svY - top).toFixed(2));
          }

          // Valve phasing — textbook, and lagged behind the dead centres
          // because barrel pressure must first cross the hydrostatic head
          // above the valve.
          const laggedDeg = (lagged / RAD) % 360;
          tvOpen = laggedDeg > 184 && severity < 0.92;
          svOpen = laggedDeg <= 184;
          setValve(tvRef.current, tvOpen, geom.pump.ballR);
          setValve(svRef.current, svOpen, geom.pump.ballR);
          chamberRef.current?.setAttribute('opacity', svOpen ? '0.3' : '0.14');
        }

        /* ---- Particle emitters ------------------------------------------- */
        const heat = clamp((temperatureC - WELL.reservoirTempC) / (WELL.steamTempC - WELL.reservoirTempC), 0, 1);
        const lifting = !stats.parted && st.velocityMps > 0 && !tvOpen;
        const dischargeRate = stats.parted ? 0 : Math.max(0, (lifting ? 13 : 3) * travelRatio * (1 - 0.7 * severity));
        emitters.current = {
          steam: { x: WELL_X, y: depthY(WELL.perfTopM) - 4, spread: 40, rate: 8 + 26 * heat },
          inflow: {
            x: WELL_X,
            y: depthY(1142),
            spread: 36,
            height: depthY(WELL.perfBottomM) - depthY(WELL.perfTopM),
            rate: stats.parted ? 0 : 6 + 14 * travelRatio,
          },
          lift: {
            x: WELL_X,
            y0: SUB_TOP + 4,
            y1: depthY(WELL.totalDepthM) - 10,
            spread: WELL.tubingIdMm * MM * 0.7,
            speed: 26 + 90 * Math.max(0, st.velocityMps),
            hot: heat > 0.45,
            rate: stats.parted ? 0 : lifting ? 22 : 3,
          },
          wear: {
            x: WELL_X,
            y0: depthY(neutralM ?? 800),
            y1: depthY(WELL.totalDepthM),
            spread: WELL.tubingIdMm * MM * 0.5,
            rate: !stats.parted && compressed && st.velocityMps < 0 ? 18 * severity : 0,
          },
          discharge: {
            x: WELL_X + Lp(30),
            y: Y(38),
            spread: 3,
            hot: heat > 0.45,
            dir: 'right',
            rate: dischargeRate,
          },
          mote: { y0: 40, y1: GROUND_Y, rate: 1.4 },
        };

        /* ---- Parallax + impact shake --------------------------------------- */
        const shakeAmp = reduced ? 0 : shockFlash * 3.2;
        const shakeX = shakeAmp * Math.sin(shk.t * 70);
        const shakeY = shakeAmp * 0.4 * Math.cos(shk.t * 55);
        const parOx = parallax && !reduced ? parallax.current.x : 0;
        const parOy = parallax && !reduced ? parallax.current.y : 0;
        parallaxFar.current?.setAttribute('transform', `translate(${(parOx * -7).toFixed(2)} ${(parOy * -4).toFixed(2)})`);
        parallaxNear.current?.setAttribute(
          'transform',
          `translate(${(parOx * 5.5 + shakeX).toFixed(2)} ${(parOy * 3 + shakeY).toFixed(2)})`,
        );

        return {
          st,
          minKn,
          neutralM,
          compressed,
          severity,
          tvOpen,
          svOpen,
          travelRatio,
          plungerFraction: pf,
          checkLoadKn,
          floating,
          floatLag: flt.lag,
          compressionCycles: stats.compressionCycles,
          contactMetreStrokes: stats.contactMetreStrokes,
          floatImpacts: stats.floatImpacts,
          fatigueCycles: stats.fatigueCycles,
          parted: stats.parted,
          partDepthM: stats.partDepthM,
        };
      },
      /** Clears every accumulated failure statistic -- called from the
       *  transport bar's reset button. Does not touch clock phase, which
       *  the clock itself owns. */
      reset() {
        floatRef.current = { lag: 0, wasFloating: false };
        shockRef.current = { t: Infinity };
        cycleRef.current = { lastPhase: 0, strokeCompressed: false, sigmaMax: -Infinity, sigmaMin: Infinity };
        statsRef.current = {
          compressionCycles: 0,
          contactMetreStrokes: 0,
          floatImpacts: 0,
          fatigueCycles: 0,
          parted: false,
          partDepthM: null,
        };
      },
    }),
    [spm, strokeM, profile, temperatureC, geom, parallax, reduced, fx, simSpeed],
  );

  const toneVar =
    tone === 'critical' ? '--accent-critical' : tone === 'safe' ? '--accent-safe' : '--accent-interactive';

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${SCENE_W} ${SCENE_H}`}
        className="w-full h-auto block select-none"
        role="img"
        aria-label={`${branch === 'baseline' ? 'Uncontrolled baseline' : 'Catenary governed'} well: API C-320D-256-100 conventional pumping unit at ${fmt(spm, 2)} strokes per minute over a 1,150 metre Jodhpur Sandstone completion.`}
      >
        <defs>
          <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={`rgb(var(${toneVar}))`} stopOpacity="0.05" />
            <stop offset="100%" stopColor={`rgb(var(${toneVar}))`} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${uid}-crude`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(var(--accent-thermal))" stopOpacity="0.10" />
            <stop offset="100%" stopColor="rgb(var(--accent-thermal))" stopOpacity="0.34" />
          </linearGradient>
          <radialGradient id={`${uid}-plume`} cx="50%" cy="50%">
            <stop offset="0%" stopColor="rgb(var(--accent-thermal))" stopOpacity="0.2" />
            <stop offset="60%" stopColor="rgb(var(--accent-thermal))" stopOpacity="0.07" />
            <stop offset="100%" stopColor="rgb(var(--accent-thermal))" stopOpacity="0" />
          </radialGradient>
          {/* Cement sheath — standard stipple. */}
          <pattern id={`${uid}-cement`} width="5" height="5" patternUnits="userSpaceOnUse">
            <rect width="5" height="5" fill="rgb(var(--text-tertiary))" fillOpacity="0.09" />
            <circle cx="1.4" cy="1.4" r="0.55" fill="rgb(var(--text-tertiary))" fillOpacity="0.4" />
            <circle cx="3.8" cy="3.6" r="0.45" fill="rgb(var(--text-tertiary))" fillOpacity="0.32" />
          </pattern>

          {/* USGS-convention lithology hatching for the stratigraphic column. */}
          <pattern id={`${uid}-lith-sand`} width="6" height="6" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill="rgb(var(--text-tertiary))" fillOpacity="0.06" />
            <circle cx="1.5" cy="1.5" r="0.5" fill="rgb(var(--text-tertiary))" fillOpacity="0.55" />
            <circle cx="4.5" cy="4.5" r="0.5" fill="rgb(var(--text-tertiary))" fillOpacity="0.55" />
          </pattern>
          <pattern id={`${uid}-lith-carbonate`} width="10" height="7" patternUnits="userSpaceOnUse">
            <rect width="10" height="7" fill="rgb(var(--text-tertiary))" fillOpacity="0.05" />
            <path d="M0 0 H10 M0 3.5 H10 M0 7 H10 M5 0 V3.5 M0 3.5 V7 M10 3.5 V7" stroke="rgb(var(--text-tertiary))" strokeWidth="0.4" strokeOpacity="0.6" fill="none" />
          </pattern>
          <pattern id={`${uid}-lith-evaporite`} width="7" height="7" patternUnits="userSpaceOnUse">
            <rect width="7" height="7" fill="rgb(var(--text-tertiary))" fillOpacity="0.05" />
            <path d="M0 7 L7 0 M-1 1 L1 -1 M6 8 L8 6" stroke="rgb(var(--text-tertiary))" strokeWidth="0.45" strokeOpacity="0.6" />
          </pattern>
          <pattern id={`${uid}-lith-shale`} width="6" height="4" patternUnits="userSpaceOnUse">
            <rect width="6" height="4" fill="rgb(var(--text-tertiary))" fillOpacity="0.07" />
            <path d="M0 1 H6 M0 3 H6" stroke="rgb(var(--text-tertiary))" strokeWidth="0.45" strokeOpacity="0.55" />
          </pattern>
          <pattern id={`${uid}-lith-pay`} width="6" height="6" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill="rgb(var(--accent-thermal))" fillOpacity="0.16" />
            <circle cx="1.5" cy="1.5" r="0.6" fill="rgb(var(--accent-thermal))" fillOpacity="0.85" />
            <circle cx="4.5" cy="4.5" r="0.6" fill="rgb(var(--accent-thermal))" fillOpacity="0.85" />
          </pattern>
          <clipPath id={`${uid}-pumpwin`}>
            <rect x={PUMP_WIN.x} y={PUMP_WIN.y} width={PUMP_WIN.w} height={PUMP_WIN.h} rx="4" />
          </clipPath>
          <clipPath id={`${uid}-buckwin`}>
            <rect x={BUCK_WIN.x} y={BUCK_WIN.y} width={BUCK_WIN.w} height={BUCK_WIN.h} rx="4" />
          </clipPath>
          <marker id={`${uid}-arrow`} viewBox="0 0 8 8" refX="6.5" refY="4" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0 0 L8 4 L0 8 z" fill="rgb(var(--accent-interactive))" />
          </marker>
        </defs>

        {/* ======================= SURFACE ================================= */}
        <rect x="0" y="0" width={SCENE_W} height={GROUND_Y} fill={`url(#${uid}-sky)`} />

        <g ref={parallaxFar} opacity="0.55">
          <BandLabel x={6} y={34} text={`SURFACE · API ${UNIT.designation} · 1 UNIT = ${(1 / S).toFixed(2)} in`} />
          {geom.horizon}
        </g>
        {geom.partKey}

        <g ref={parallaxNear}>
          {geom.foundation}
          {geom.gearbox}
          {geom.samsonPost}
          {geom.wellhead}
          {geom.edgeCabinet}

          {/* Crank + counterweights — one rigid body about the crankshaft */}
          <g ref={crankRef}>{geom.crank}</g>

          {/* Pitman connects two different rotating bodies, so it is solved
              each frame rather than being carried by either transform. */}
          <line
            ref={pitmanRef}
            stroke="rgb(var(--text-secondary))"
            strokeWidth="5"
            strokeLinecap="round"
            opacity="0.92"
          />
          <circle ref={pitmanCapRef} r="3.4" fill="rgb(var(--bg-surface-1))" stroke="rgb(var(--text-secondary))" strokeWidth="1.6" />

          {/* Walking beam + horsehead — one rigid body about the saddle bearing */}
          <g ref={beamRef}>{geom.beam}</g>

          {/* Wireline bridle: two legs, 11 in apart, overlapping in elevation */}
          <path ref={bridle2Ref} fill="none" stroke="rgb(var(--text-tertiary))" strokeWidth="2.6" opacity="0.35" />
          <path ref={bridleRef} fill="none" stroke="rgb(var(--text-primary))" strokeWidth="1.1" opacity="0.85" />

          <g ref={carrierRef}>
            {geom.carrierBar}
            <g ref={clampRodRef}>{geom.clampRod}</g>
            {/* Rod-float gap: opens between the (rigid) carrier bar and the
                (lagging) clamp + polished rod below it. */}
            <line
              ref={gapMarkerRef}
              x1={TANGENT.x + 8}
              y1={TANGENT.y + 7.5}
              x2={TANGENT.x + 8}
              y2={TANGENT.y + 7.5}
              stroke="rgb(var(--accent-critical))"
              strokeWidth="1"
              strokeDasharray="1.4 1.4"
              opacity="0"
            />
            <text ref={gapLabelRef} x={TANGENT.x + 11} y={TANGENT.y + 6} fontSize="4.6" fill="rgb(var(--accent-critical))" letterSpacing="0.06em" opacity="0">
              ROD FLOAT
            </text>
            {/* Impact shock ring: flashes once when the gap slams shut. */}
            <circle ref={shockRingRef} cx={TANGENT.x} cy={TANGENT.y + 7.5} r="0" fill="none" stroke="rgb(var(--accent-critical))" strokeWidth="1.3" opacity="0" />
          </g>
          {geom.saddleBearing}
          {geom.balloons}
        </g>

        {/* Scale break */}
        {geom.scaleBreak}

        {/* ======================= SUBSURFACE ============================== */}
        {geom.strata}
        {geom.depthRuler}

        {/* --- axial force profile plot --- */}
        <g>
          <rect x={FP.x0} y={SUB_TOP} width={FP.x1 - FP.x0} height={SUB_BOTTOM - SUB_TOP} fill="rgb(var(--bg-canvas))" opacity="0.55" />
          {/* compression half-plane */}
          <rect x={FP.x0} y={SUB_TOP} width={FX_ZERO - FP.x0} height={SUB_BOTTOM - SUB_TOP} fill="rgb(var(--accent-critical))" fillOpacity="0.09" />
          {geom.forceGrid}
          {envelope && <polygon points={envelope} fill={`rgb(var(${toneVar}))`} fillOpacity="0.14" />}
          <line x1={FX_ZERO} y1={SUB_TOP} x2={FX_ZERO} y2={SUB_BOTTOM} stroke="rgb(var(--accent-critical))" strokeWidth="1" opacity="0.75" />
          <line x1={fx(0.5)} y1={SUB_TOP} x2={fx(0.5)} y2={SUB_BOTTOM} stroke="rgb(var(--accent-caution))" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.8" />
          <path ref={forceCurveRef} fill="none" stroke={`rgb(var(${toneVar}))`} strokeWidth="1.9" strokeLinejoin="round" />
          <circle ref={forceDotRef} r="2.6" fill={`rgb(var(${toneVar}))`} />
          <g ref={neutralRef} opacity="0">
            <line x1={FP.x0} y1="0" x2={WELL_X + 26} y2="0" stroke="rgb(var(--accent-critical))" strokeWidth="0.7" strokeDasharray="2 3" opacity="0.85" />
            <rect x={FP.x0 + 1} y="-9" width="62" height="9" rx="2" fill="rgb(var(--accent-critical))" fillOpacity="0.9" />
            <text x={FP.x0 + 4} y="-2.4" fontSize="6.2" fill="rgb(var(--bg-canvas))" letterSpacing="0.06em">NEUTRAL POINT</text>
          </g>
          <text x={FP.x0} y={SUB_TOP - 5} fontSize="6" fill="rgb(var(--text-tertiary))" letterSpacing="0.1em">
            AXIAL FORCE F(x, θ) — kN
          </text>
          <text x={FP.x1} y={SUB_BOTTOM + 18} fontSize="5.2" textAnchor="end" fill="rgb(var(--text-tertiary))">
            band = envelope over one full stroke
          </text>
          {fx.clipped && (
            <>
              <rect x={FP.x0} y={SUB_TOP} width="5" height={SUB_BOTTOM - SUB_TOP} fill="rgb(var(--accent-critical))" fillOpacity="0.35" />
              <text x={FP.x0} y={SUB_BOTTOM + 27} fontSize="5.2" fill="rgb(var(--accent-critical))">
                clipped at −25 kN — off-model
              </text>
            </>
          )}
        </g>

        {/* --- wellbore cross-section --- */}
        {geom.wellbore}
        <path ref={buckleGlowRef} fill="none" stroke="rgb(var(--accent-critical))" strokeWidth="7" strokeLinecap="round" opacity="0" />
        <path ref={bucklePathRef} fill="none" stroke="rgb(var(--accent-critical))" strokeWidth="1.5" opacity="0" />
        {/* Fatigue parting mark: the string has snapped, the pump below is
            isolated, and the surface unit keeps cycling over nothing. */}
        <g ref={partedMarkRef} opacity="0">
          <line x1={WELL_X - 15} y1="0" x2={WELL_X + 15} y2="0" stroke="rgb(var(--accent-critical))" strokeWidth="2.4" strokeLinecap="round" />
          <line x1={WELL_X - 9} y1="-4" x2={WELL_X + 9} y2="4" stroke="rgb(var(--accent-critical))" strokeWidth="1.4" />
          <line x1={WELL_X - 9} y1="4" x2={WELL_X + 9} y2="-4" stroke="rgb(var(--accent-critical))" strokeWidth="1.4" />
          <rect x={WELL_X + 18} y="-5" width="46" height="10" rx="2" fill="rgb(var(--accent-critical))" fillOpacity="0.92" />
          <text x={WELL_X + 21} y="2.6" fontSize="5.6" fill="rgb(var(--bg-canvas))" letterSpacing="0.06em">
            PARTED
          </text>
        </g>
        {geom.perforations}

        {/* --- detail window: downhole pump, true stroke scale --- */}
        <g clipPath={`url(#${uid}-pumpwin)`}>
          <rect x={PUMP_WIN.x} y={PUMP_WIN.y} width={PUMP_WIN.w} height={PUMP_WIN.h} fill="rgb(var(--bg-canvas))" />
          {geom.pump.static}
          <rect
            ref={chamberRef}
            x={geom.pump.cx - geom.pump.boreHalf}
            y={geom.pump.chamberY}
            width={geom.pump.boreHalf * 2}
            height={geom.pump.chamberH}
            fill="rgb(var(--accent-thermal))"
            opacity="0.16"
          />
          {/* The traveling valve lives INSIDE the plunger, so it is inside the
              moving group. The barrel and the standing valve are outside it and
              never move -- the previous schematic had the whole pump bouncing. */}
          <g ref={plungerRef}>
            {geom.pump.plunger}
            <g ref={tvRef}>{geom.pump.tv}</g>
          </g>
          <g ref={svRef}>{geom.pump.sv}</g>
        </g>
        {geom.pump.frame}

        {/* --- detail window: rod / tubing contact, true Lubinski scale --- */}
        <g clipPath={`url(#${uid}-buckwin)`}>
          <rect x={BUCK_WIN.x} y={BUCK_WIN.y} width={BUCK_WIN.w} height={BUCK_WIN.h} fill="rgb(var(--bg-canvas))" />
          {geom.buckle.static}
          <BuckleDetail branch={branch} profile={profile} geom={geom} />
        </g>
        {geom.buckle.frame}

        {geom.leaders}
        {geom.footNotes}
      </svg>

      {showParticles && (
        <ParticleField clock={clock} bay={branch} sceneW={SCENE_W} sceneH={SCENE_H} emittersRef={emitters} reduced={reduced} />
      )}
    </div>
  );
});

/* ========================================================================== */
/* Valve helper                                                               */
/* ========================================================================== */

function setValve(group, open, r) {
  if (!group) return;
  const ball = group.querySelector('[data-ball]');
  const seat = group.querySelector('[data-seat]');
  if (!ball) return;
  // A ball-and-seat check valve: the ball is unseated by flow, so the travel is
  // small and the cue is the lift plus the seat colour, not a rotating flap.
  const seatY = Number(ball.getAttribute('data-seat-y'));
  ball.setAttribute('cy', String(seatY - (open ? r * 1.6 : 0)));
  ball.setAttribute('fill', open ? 'rgb(var(--accent-safe))' : 'rgb(var(--text-secondary))');
  seat?.setAttribute('stroke', open ? 'rgb(var(--accent-safe))' : 'rgb(var(--text-tertiary))');
}

/* ========================================================================== */
/* Buckling detail — true Lubinski pitch                                      */
/* ========================================================================== */

function BuckleDetail({ profile, geom }) {
  const min = profile?.minKn ?? NaN;
  const compressed = Number.isFinite(min) && min < 0;
  const depth = profile?.minDepthM ?? 900;
  const buck = helicalBuckling(Math.abs(compressed ? min : 1), depth);
  const g = geom.buckle;

  // 1:1 magnified window. Vertical scale chosen to show ~2 helix pitches.
  const spanM = compressed ? Math.min(buck.pitchM * 2.2, 40) : 12;
  const uPerM = g.h / spanM;
  const amp = compressed ? buck.amplitudeMm * g.uPerMm : 0;

  // The rod is drawn as an outlined member with a centreline, not a fat stroke:
  // at true scale a 19.05 mm rod in a 76 mm bore is a quarter of the window
  // wide, and a bare round-capped stroke that thick reads as a jelly bean.
  const half = g.rodW / 2;
  const N = 120;
  const left = [];
  const right = [];
  const centre = [];
  const contacts = [];
  for (let i = 0; i <= N; i += 1) {
    const yy = g.y + (i / N) * g.h;
    const m = (i / N) * spanM;
    const off = compressed ? Math.sin((m / buck.pitchM) * Math.PI * 2) * amp : 0;
    left.push(`${(g.cx + off - half).toFixed(2)},${yy.toFixed(2)}`);
    right.push(`${(g.cx + off + half).toFixed(2)},${yy.toFixed(2)}`);
    centre.push(`${i ? 'L' : 'M'}${(g.cx + off).toFixed(2)},${yy.toFixed(2)}`);
    if (compressed && Math.abs(Math.abs(off) - amp) < amp * 0.015) {
      const last = contacts[contacts.length - 1];
      if (!last || yy - last.y > 10) contacts.push({ x: g.cx + off + Math.sign(off) * half, y: yy });
    }
  }
  const tone = compressed ? 'rgb(var(--accent-critical))' : 'rgb(var(--accent-safe))';

  return (
    <>
      <polygon points={`${left.join(' ')} ${right.slice().reverse().join(' ')}`} fill={tone} fillOpacity="0.2" stroke={tone} strokeWidth="0.8" />
      <path d={centre.join('')} fill="none" stroke={tone} strokeWidth="0.5" strokeDasharray="3 2" opacity="0.8" />
      {contacts.slice(0, 8).map((c, i) => (
        <g key={i}>
          <circle cx={c.x} cy={c.y} r="4" fill="rgb(var(--accent-critical))" fillOpacity="0.2" />
          <circle cx={c.x} cy={c.y} r="1.4" fill="rgb(var(--accent-critical))" />
        </g>
      ))}
      <rect x={g.x + 3} y={g.y + g.h - 21} width={g.w - 40} height="19" fill="rgb(var(--bg-canvas))" fillOpacity="0.82" rx="2" />
      <text x={g.x + 6} y={g.y + g.h - 13} fontSize="5.2" fill={tone} letterSpacing="0.05em">
        {compressed ? `HELIX PITCH ${buck.pitchM.toFixed(1)} m` : 'AXIAL TENSION HELD'}
      </text>
      <text x={g.x + 6} y={g.y + g.h - 5} fontSize="5.2" fill="rgb(var(--text-secondary))" letterSpacing="0.05em">
        {compressed
          ? `σ_bend ${buck.bendingStressMpa.toFixed(0)} MPa · wall contact @ ${depth} m`
          : 'no neutral point · no wall contact'}
      </text>
      {/* true-scale bar — proves the window really is 1:1 */}
      <line x1={g.x + g.w - 26} y1={g.y + 14} x2={g.x + g.w - 26} y2={g.y + 14 + uPerM} stroke="rgb(var(--text-secondary))" strokeWidth="1" />
      <line x1={g.x + g.w - 29} y1={g.y + 14} x2={g.x + g.w - 23} y2={g.y + 14} stroke="rgb(var(--text-secondary))" strokeWidth="1" />
      <line x1={g.x + g.w - 29} y1={g.y + 14 + uPerM} x2={g.x + g.w - 23} y2={g.y + 14 + uPerM} stroke="rgb(var(--text-secondary))" strokeWidth="1" />
      <text x={g.x + g.w - 20} y={g.y + 18 + uPerM / 2} fontSize="5.2" fill="rgb(var(--text-secondary))">
        1 m
      </text>
      <rect x={g.x + 3} y={g.y + 3} width={g.w - 34} height="10" rx="2" fill="rgb(var(--bg-canvas))" fillOpacity="0.82" />
      <text x={g.x + 6} y={g.y + 10} fontSize="4.4" fill="rgb(var(--text-tertiary))">
        ¾″ rod in {WELL.tubingIdMm} mm bore · clr {radialClearanceMm(depth).toFixed(1)} mm
      </text>
      {/* a coupling gives the window an unambiguous size reference */}
      <rect
        x={g.cx - (ROD_TAPERS[2].couplingOdMm * g.uPerMm) / 2}
        y={g.y + g.h * 0.42}
        width={ROD_TAPERS[2].couplingOdMm * g.uPerMm}
        height={g.h * 0.045}
        fill={tone}
        fillOpacity="0.55"
        stroke={tone}
        strokeWidth="0.6"
      />
    </>
  );
}

/* ========================================================================== */
/* Static geometry                                                            */
/* ========================================================================== */

function BandLabel({ x, y, text }) {
  return (
    <text x={x} y={y} fontSize="6.2" fill="rgb(var(--text-tertiary))" letterSpacing="0.14em">
      {text}
    </text>
  );
}

/**
 * Numbered balloon, the way a real assembly drawing indexes its parts.
 * Every surface component used to carry its own inline caption, which produced
 * eight overlapping strings on top of the mechanism. Balloons plus a key move
 * all of that text into empty space and let the drawing be a drawing.
 */
function Balloon({ n, x, y, tone = 'rgb(var(--text-secondary))' }) {
  return (
    <g>
      <circle cx={x} cy={y} r="5.4" fill="rgb(var(--bg-canvas))" fillOpacity="0.88" stroke={tone} strokeWidth="0.7" />
      <text x={x} y={y + 2} fontSize="5.6" textAnchor="middle" fill={tone} fontWeight="600">
        {n}
      </text>
    </g>
  );
}

const PART_KEY = [
  ['1', 'Prime mover, NEMA D'],
  ['2', 'V-belt & unit sheave'],
  ['3', 'Reducer, 320k in·lb'],
  ['4', 'Crank & counterweight'],
  ['5', 'Pitman, P = 132″'],
  ['6', 'Equalizer, C = 111″'],
  ['7', 'Samson post / saddle'],
  ['8', 'Walking beam'],
  ['9', 'Horsehead, r = A = 129″'],
  ['10', 'Wireline bridle'],
  ['11', 'Carrier bar & clamp'],
  ['12', 'Stuffing box & tee'],
  ['13', 'Tubing / casing head'],
  ['14', 'Edge node (advisory)'],
];

function buildStaticGeometry({ fluidLevelM, uid, fx }) {
  const hair = 'rgb(var(--border-strong))';
  const steel = 'rgb(var(--text-secondary))';
  const faint = 'rgb(var(--text-tertiary))';

  /* ---------------- surface: horizon + foundation ---------------------- */
  const horizon = (
    <g>
      <line x1="0" y1={GROUND_Y} x2={SCENE_W} y2={GROUND_Y} stroke={steel} strokeWidth="1.1" />
      {Array.from({ length: 26 }, (_, i) => (
        <line key={i} x1={i * 19} y1={GROUND_Y} x2={i * 19 - 7} y2={GROUND_Y + 6} stroke={faint} strokeWidth="0.6" opacity="0.55" />
      ))}
    </g>
  );

  const foundation = (
    <g>
      {/* concrete pier + base rails (skid beams) */}
      <rect x={X(-124)} y={Y(0)} width={Lp(190)} height={Lp(16)} fill="rgb(var(--bg-surface-3))" stroke={hair} strokeWidth="0.7" />
      <rect x={X(-124)} y={Y(10)} width={Lp(408)} height={Lp(10)} fill="rgb(var(--bg-surface-2))" stroke={hair} strokeWidth="0.7" />
    </g>
  );

  /* ---------------- part key (replaces all inline surface captions) ------ */
  const partKey = (
    <g>
      <rect x="2" y="44" width="84" height={20 + PART_KEY.length * 10.5} rx="3" fill="rgb(var(--bg-canvas))" fillOpacity="0.72" stroke={hair} strokeWidth="0.5" />
      <text x="7" y="55" fontSize="5.4" fill={faint} letterSpacing="0.13em">
        PART KEY
      </text>
      {PART_KEY.map(([n, label], i) => (
        <g key={n}>
          <text x="7" y={66 + i * 10.5} fontSize="4.6" fill="rgb(var(--text-secondary))" fontWeight="600">
            {n}
          </text>
          <text x="19" y={66 + i * 10.5} fontSize="4.6" fill={faint}>
            {label}
          </text>
        </g>
      ))}
    </g>
  );

  /* Balloons sit on the parts themselves. Positions are derived from the same
     geometry that draws them, so they cannot drift. */
  const balloons = (
    <g>
      <Balloon n="1" x={X(-98)} y={Y(78)} />
      <Balloon n="2" x={X(-72)} y={Y(88)} />
      <Balloon n="3" x={X(2)} y={Y(112)} />
      <Balloon n="5" x={X(46)} y={Y(140)} />
      <Balloon n="7" x={X(86)} y={Y(118)} tone="rgb(var(--accent-interactive))" />
      <Balloon n="10" x={TANGENT.x - 15} y={TANGENT.y + 46} tone="rgb(var(--accent-interactive))" />
      <Balloon n="12" x={WELL_X + Lp(28)} y={Y(54)} />
      <Balloon n="13" x={WELL_X + Lp(28)} y={Y(18)} />
      <Balloon n="14" x={X(-73)} y={Y(132)} tone="rgb(var(--accent-interactive))" />
    </g>
  );

  /* ---------------- gearbox, sheaves, prime mover ----------------------- */
  const sheaveR = Lp(18);
  const gearbox = (
    <g>
      {/* reducer pedestal */}
      <rect x={X(-30)} y={Y(52)} width={Lp(60)} height={Lp(42)} fill="rgb(var(--bg-surface-3))" stroke={hair} strokeWidth="0.8" rx="1.5" />
      {/* double-reduction speed reducer housing; crankshaft is its output */}
      <rect x={X(-34)} y={Y(96)} width={Lp(68)} height={Lp(44)} fill="rgb(var(--bg-surface-2))" stroke={steel} strokeWidth="0.9" rx="2.5" />

      {/* unit sheave on the high-speed shaft + V-belt to the prime mover */}
      <circle cx={X(-52)} cy={Y(104)} r={sheaveR} fill="none" stroke={steel} strokeWidth="1.1" />
      <circle cx={X(-52)} cy={Y(104)} r={sheaveR * 0.28} fill="rgb(var(--bg-surface-3))" stroke={steel} strokeWidth="0.8" />
      <circle cx={X(-98)} cy={Y(46)} r={Lp(6.5)} fill="none" stroke={steel} strokeWidth="1" />
      <line x1={X(-52) - sheaveR} y1={Y(104)} x2={X(-98) - Lp(6.5)} y2={Y(46)} stroke={steel} strokeWidth="0.7" opacity="0.8" />
      <line x1={X(-52) + sheaveR * 0.1} y1={Y(104) + sheaveR} x2={X(-98)} y2={Y(46) + Lp(6.5)} stroke={steel} strokeWidth="0.7" opacity="0.8" />

      {/* NEMA D prime mover on a sliding base */}
      <rect x={X(-118)} y={Y(58)} width={Lp(40)} height={Lp(26)} rx="3" fill="rgb(var(--bg-surface-3))" stroke={steel} strokeWidth="0.9" />

      {/* crankshaft centreline mark */}
      <circle cx={CRANK.x} cy={CRANK.y} r="3.2" fill="rgb(var(--bg-surface-1))" stroke={steel} strokeWidth="1.2" />
      <circle cx={CRANK.x} cy={CRANK.y} r="0.9" fill={steel} />
    </g>
  );

  /* ---------------- crank + counterweights (rotating body) -------------- */
  const rPx = Lp(UNIT.R);
  // The cranks are outboard of the reducer on the ends of the slow-speed
  // shaft, so in side elevation they sit IN FRONT of the gearbox. Drawn with a
  // brighter stroke and an opaque fill so they read as a separate rotating
  // body rather than merging into the housing behind them.
  const crank = (
    <g>
      <path
        d={`M ${CRANK.x - 9} ${CRANK.y - 7.5} L ${CRANK.x + rPx + 5} ${CRANK.y - 4.4} L ${CRANK.x + rPx + 5} ${CRANK.y + 4.4} L ${CRANK.x - 9} ${CRANK.y + 7.5} Z`}
        fill="rgb(var(--bg-surface-3))"
        stroke="rgb(var(--text-primary))"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      {/* counterweight: tau = 0 on a conventional unit, so its CG sits on the
          crank centreline 180 deg from the pin */}
      <rect
        x={CRANK.x - 0.74 * rPx - Lp(15)}
        y={CRANK.y - Lp(14)}
        width={Lp(30)}
        height={Lp(28)}
        rx="2"
        fill="rgb(var(--bg-canvas))"
        stroke="rgb(var(--text-primary))"
        strokeWidth="1.2"
      />
      {[-6, 0, 6].map((o) => (
        <line
          key={o}
          x1={CRANK.x - 0.74 * rPx + Lp(o)}
          y1={CRANK.y - Lp(11)}
          x2={CRANK.x - 0.74 * rPx + Lp(o)}
          y2={CRANK.y + Lp(11)}
          stroke={steel}
          strokeWidth="0.6"
          opacity="0.7"
        />
      ))}
      <circle cx={CRANK.x + rPx} cy={CRANK.y} r="3" fill="rgb(var(--bg-surface-1))" stroke="rgb(var(--text-primary))" strokeWidth="1.1" />
      <Balloon n="4" x={CRANK.x - 0.74 * rPx} y={CRANK.y} />
    </g>
  );

  /* ---------------- Samson post ---------------------------------------- */
  const samsonPost = (
    <g>
      {/* rear rake leg takes the horizontal saddle-bearing reaction */}
      <line x1={SADDLE.x} y1={SADDLE.y} x2={X(58)} y2={Y(10)} stroke={steel} strokeWidth="2.6" />
      <line x1={SADDLE.x} y1={SADDLE.y} x2={X(166)} y2={Y(10)} stroke={steel} strokeWidth="2.6" />
      {/* laterally splayed pair, drawn faint for depth */}
      <line x1={SADDLE.x} y1={SADDLE.y} x2={X(76)} y2={Y(10)} stroke={steel} strokeWidth="1.4" opacity="0.35" />
      <line x1={SADDLE.x} y1={SADDLE.y} x2={X(148)} y2={Y(10)} stroke={steel} strokeWidth="1.4" opacity="0.35" />
      <line x1={X(80)} y1={Y(84)} x2={X(144)} y2={Y(84)} stroke={steel} strokeWidth="1.2" />
      <line x1={X(84)} y1={Y(84)} x2={X(140)} y2={Y(150)} stroke={steel} strokeWidth="0.7" opacity="0.5" />
      <line x1={X(140)} y1={Y(84)} x2={X(84)} y2={Y(150)} stroke={steel} strokeWidth="0.7" opacity="0.5" />
    </g>
  );

  const saddleBearing = (
    <g>
      <rect x={SADDLE.x - 6} y={SADDLE.y - 5.5} width="12" height="11" rx="2" fill="rgb(var(--bg-surface-3))" stroke={steel} strokeWidth="1" />
      <circle cx={SADDLE.x} cy={SADDLE.y} r="2.6" fill="rgb(var(--accent-interactive))" fillOpacity="0.25" stroke="rgb(var(--accent-interactive))" strokeWidth="0.9" />
    </g>
  );

  /* ---------------- walking beam + horsehead (rotating body) ------------ */
  const cPx = Lp(UNIT.C);
  const beamHalf = 9.5; // ~22 in deep wide-flange, correct for a 25,600 lb unit
  const hr = A_SCENE;
  const hCos = Math.cos(HEAD_HALF_DEG * RAD);
  const hSin = Math.sin(HEAD_HALF_DEG * RAD);
  const headTop = { x: SADDLE.x + hr * hCos, y: SADDLE.y - hr * hSin };
  const headBot = { x: SADDLE.x + hr * hCos, y: SADDLE.y + hr * hSin };
  const beam = (
    <g>
      {/* wide-flange walking beam: flanges heavier than the web */}
      <rect x={SADDLE.x - cPx - 10} y={SADDLE.y - beamHalf} width={cPx + A_SCENE - 26} height={beamHalf * 2} fill="rgb(var(--bg-surface-2))" stroke={steel} strokeWidth="0.7" />
      <line x1={SADDLE.x - cPx - 10} y1={SADDLE.y - beamHalf} x2={SADDLE.x + A_SCENE - 36} y2={SADDLE.y - beamHalf} stroke="rgb(var(--text-primary))" strokeWidth="1.5" />
      <line x1={SADDLE.x - cPx - 10} y1={SADDLE.y + beamHalf} x2={SADDLE.x + A_SCENE - 36} y2={SADDLE.y + beamHalf} stroke="rgb(var(--text-primary))" strokeWidth="1.5" />
      <Balloon n="8" x={SADDLE.x + 42} y={SADDLE.y} />

      {/* equalizer / tail bearing */}
      <rect x={SADDLE.x - cPx - 8} y={SADDLE.y - 8.5} width="17" height="17" rx="2" fill="rgb(var(--bg-surface-3))" stroke="rgb(var(--text-primary))" strokeWidth="1" />
      <circle cx={SADDLE.x - cPx} cy={SADDLE.y} r="2.6" fill="rgb(var(--bg-surface-1))" stroke={steel} strokeWidth="1" />
      <Balloon n="6" x={SADDLE.x - cPx - 16} y={SADDLE.y - 14} />

      {/* HORSEHEAD. The face is an arc of radius A centred on the saddle
          bearing (US 4,466,301) — that is what keeps the bridle tangent and the
          polished rod vertical through the whole stroke. Per the patent the
          arc does not run the full height: the ends break sharply away. */}
      <path
        d={`M ${headTop.x.toFixed(2)} ${headTop.y.toFixed(2)}
            A ${hr} ${hr} 0 0 1 ${headBot.x.toFixed(2)} ${headBot.y.toFixed(2)}
            L ${(headBot.x - 13).toFixed(2)} ${(headBot.y + 3).toFixed(2)}
            L ${(SADDLE.x + A_SCENE - 34).toFixed(2)} ${(SADDLE.y + beamHalf + 1).toFixed(2)}
            L ${(SADDLE.x + A_SCENE - 34).toFixed(2)} ${(SADDLE.y - beamHalf - 1).toFixed(2)}
            L ${(headTop.x - 13).toFixed(2)} ${(headTop.y - 3).toFixed(2)} Z`}
        fill="rgb(var(--bg-surface-2))"
        stroke={steel}
        strokeWidth="1"
        strokeLinejoin="round"
      />
      {/* lightening holes — every real horsehead has them, and they stop the
          head reading as a solid black fin */}
      {[-0.5, 0.16, 0.8].map((t) => (
        <circle
          key={t}
          cx={SADDLE.x + (A_SCENE - 22) * Math.cos(t * 0.34)}
          cy={SADDLE.y + (A_SCENE - 22) * Math.sin(t * 0.34)}
          r="7"
          fill="rgb(var(--bg-canvas))"
          stroke={steel}
          strokeWidth="0.6"
        />
      ))}
      <path
        d={`M ${headTop.x.toFixed(2)} ${headTop.y.toFixed(2)} A ${hr} ${hr} 0 0 1 ${headBot.x.toFixed(2)} ${headBot.y.toFixed(2)}`}
        fill="none"
        stroke="rgb(var(--accent-interactive))"
        strokeWidth="1.6"
        opacity="0.8"
      />
      <Balloon n="9" x={SADDLE.x + A_SCENE - 46} y={SADDLE.y - 30} tone="rgb(var(--accent-interactive))" />
    </g>
  );

  /* ---------------- carrier bar, polished rod, clamp -------------------- */
  // Split in two: the carrier bar is bolted to the bridle and is always
  // rigid. The clamp + polished rod below it is what a rod float lets slip
  // -- it is nested inside the carrier bar's own frame with an independent
  // ref, so a lag offset opens a real gap between the two.
  const carrierBar = (
    <g>
      <rect x={TANGENT.x - 11} y={TANGENT.y - 2.5} width="22" height="5" rx="1.4" fill="rgb(var(--bg-surface-3))" stroke={steel} strokeWidth="0.9" />
      <Balloon n="11" x={TANGENT.x + 17} y={TANGENT.y} />
    </g>
  );
  const clampRod = (
    <g>
      <rect x={TANGENT.x - 4.5} y={TANGENT.y + 2.5} width="9" height="5" rx="1" fill="rgb(var(--bg-surface-3))" stroke={steel} strokeWidth="0.8" />
      <line x1={TANGENT.x} y1={TANGENT.y + 6} x2={TANGENT.x} y2={Y(-10)} stroke="rgb(var(--text-primary))" strokeWidth="2" />
    </g>
  );

  /* ---------------- wellhead stack -------------------------------------- */
  const wellhead = (
    <g>
      <rect x={WELL_X - Lp(11)} y={Y(62)} width={Lp(22)} height={Lp(16)} rx="1.5" fill="rgb(var(--bg-surface-3))" stroke={steel} strokeWidth="0.9" />
      {/* pumping tee + flowline to the battery */}
      <rect x={WELL_X - Lp(9)} y={Y(46)} width={Lp(18)} height={Lp(18)} fill="rgb(var(--bg-surface-2))" stroke={steel} strokeWidth="0.9" />
      <path d={`M ${WELL_X + Lp(9)} ${Y(38)} L ${X(272)} ${Y(38)} L ${X(272)} ${Y(14)}`} fill="none" stroke={steel} strokeWidth="2.2" />
      {/* tubing head + casing head spools with annulus valve */}
      <rect x={WELL_X - Lp(13)} y={Y(28)} width={Lp(26)} height={Lp(18)} fill="rgb(var(--bg-surface-3))" stroke={steel} strokeWidth="0.9" />
      <rect x={WELL_X - Lp(15)} y={Y(10)} width={Lp(30)} height={Lp(18)} fill="rgb(var(--bg-surface-2))" stroke={steel} strokeWidth="0.9" />
      <line x1={WELL_X - Lp(15)} y1={Y(19)} x2={WELL_X - Lp(30)} y2={Y(19)} stroke={steel} strokeWidth="1.6" />
      <circle cx={WELL_X - Lp(33)} cy={Y(19)} r="2.6" fill="none" stroke={steel} strokeWidth="1" />
    </g>
  );

  const edgeCabinet = (
    <g>
      <rect x={X(-88)} y={Y(112)} width={Lp(30)} height={Lp(40)} rx="2" fill="rgb(var(--bg-surface-2))" stroke="rgb(var(--accent-interactive))" strokeWidth="0.9" strokeOpacity="0.55" />
      <circle cx={X(-80)} cy={Y(104)} r="1.5" fill="rgb(var(--accent-interactive))" className="vs-live-dot" />
    </g>
  );

  /* ---------------- scale break ---------------------------------------- */
  const scaleBreak = (
    <g>
      <rect x="0" y={GROUND_Y + 2} width={SCENE_W} height="14" fill="rgb(var(--bg-canvas))" />
      <path
        d={`M 0 ${GROUND_Y + 9} L 96 ${GROUND_Y + 9} L 112 ${GROUND_Y + 4} L 136 ${GROUND_Y + 14} L 160 ${GROUND_Y + 4} L 184 ${GROUND_Y + 14} L 208 ${GROUND_Y + 4} L 232 ${GROUND_Y + 14} L 248 ${GROUND_Y + 9} L ${SCENE_W} ${GROUND_Y + 9}`}
        fill="none"
        stroke={faint}
        strokeWidth="0.8"
      />
      <rect x={264} y={GROUND_Y + 3} width="92" height="12" fill="rgb(var(--bg-canvas))" />
      <text x={268} y={GROUND_Y + 12} fontSize="5.6" fill={faint} letterSpacing="0.1em">SCALE BREAK</text>
    </g>
  );

  /* ---------------- strata + lithology column --------------------------- */
  // Names run vertically in the right margin, the way a stratigraphic column
  // is actually drawn, so nothing collides with the wellbore at x = 412.
  const LITH_X = 442;
  const LITH_W = 20;
  const strata = (
    <g>
      {STRATA.map((s) => {
        const y0 = depthY(s.top);
        const y1 = depthY(s.base);
        const pay = s.pattern === 'pay';
        const mid = (y0 + y1) / 2;
        return (
          <g key={s.name}>
            <rect
              x="0"
              y={y0}
              width={SCENE_W}
              height={y1 - y0}
              fill={pay ? 'rgb(var(--accent-thermal))' : 'rgb(var(--text-tertiary))'}
              fillOpacity={pay ? 0.09 : 0.03}
            />
            <line x1="0" y1={y1} x2={SCENE_W} y2={y1} stroke={hair} strokeWidth="0.6" opacity="0.7" />
            {/* lithology strip */}
            <rect
              x={LITH_X}
              y={y0}
              width={LITH_W}
              height={y1 - y0}
              fill={`url(#${uid}-lith-${s.pattern})`}
              stroke={hair}
              strokeWidth="0.5"
            />
            {/* A bed thinner than its own label cannot carry a centred
               vertical caption without colliding with its neighbour. Thin beds
               get a top-anchored caption reading downward instead, which is
               free to run past the base of the column. */}
            {y1 - y0 >= 52 ? (
              <text
                x={LITH_X + LITH_W + 9}
                y={mid}
                fontSize="4.8"
                textAnchor="middle"
                fill={faint}
                letterSpacing="0.06em"
                transform={`rotate(-90 ${LITH_X + LITH_W + 9} ${mid})`}
              >
                {s.short.toUpperCase()}
              </text>
            ) : (
              <text
                x={LITH_X + LITH_W + 9}
                y={y0 + 2}
                fontSize="4.8"
                textAnchor="start"
                fill={pay ? 'rgb(var(--accent-thermal))' : faint}
                letterSpacing="0.06em"
                transform={`rotate(90 ${LITH_X + LITH_W + 9} ${y0 + 2})`}
              >
                {s.short.toUpperCase()}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );

  /* ---------------- depth ruler ---------------------------------------- */
  const ticks = [];
  for (let d = 0; d <= WELL.totalDepthM; d += 50) ticks.push(d);
  const labelled = new Set([0, 250, 350, 750, 1150]);
  const depthRuler = (
    <g>
      <line x1="40" y1={SUB_TOP} x2="40" y2={SUB_BOTTOM} stroke={steel} strokeWidth="0.8" />
      {ticks.map((d) => {
        const big = labelled.has(d);
        return (
          <g key={d}>
            <line x1={big ? 30 : 35} y1={depthY(d)} x2="40" y2={depthY(d)} stroke={big ? steel : faint} strokeWidth={big ? 0.9 : 0.5} />
            {big && (
              <text x="28" y={depthY(d) + 2} fontSize="5.8" textAnchor="end" fill={faint}>
                {d}
              </text>
            )}
          </g>
        );
      })}
      <text x="4" y={SUB_TOP - 5} fontSize="6" fill={faint} letterSpacing="0.1em">m TVD</text>
    </g>
  );

  /* ---------------- force plot grid ------------------------------------ */
  const forceGrid = (
    <g>
      {fx.ticks.map((v) => (
        <g key={v}>
          <line x1={fx(v)} y1={SUB_TOP} x2={fx(v)} y2={SUB_BOTTOM} stroke={hair} strokeWidth="0.4" opacity="0.5" />
          <text x={fx(v)} y={SUB_BOTTOM + 9} fontSize="5.4" textAnchor="middle" fill={faint}>
            {v}
          </text>
        </g>
      ))}
      {ROD_TAPERS.slice(1).map((t) => (
        <line key={t.index} x1={FP.x0} y1={depthY(t.top)} x2={WELL_X + 26} y2={depthY(t.top)} stroke={faint} strokeWidth="0.5" strokeDasharray="4 4" opacity="0.7" />
      ))}
    </g>
  );

  /* ---------------- wellbore cross-section ------------------------------ */
  const hw = (mm) => (mm * MM) / 2;
  const casingBottom = depthY(WELL.totalDepthM);
  const wellbore = (
    <g>
      {/* open hole + cement sheath */}
      <rect x={WELL_X - hw(WELL.holeDiameterMm)} y={SUB_TOP} width={hw(WELL.holeDiameterMm) * 2} height={casingBottom - SUB_TOP} fill={`url(#${uid}-cement)`} />
      {/* conductor + surface casing */}
      <rect x={WELL_X - hw(WELL.conductorOdMm)} y={SUB_TOP} width={hw(WELL.conductorOdMm) * 2} height={depthY(WELL.conductorShoeM) - SUB_TOP} fill="none" stroke={steel} strokeWidth="1.1" />
      <rect x={WELL_X - hw(WELL.surfaceCasingOdMm)} y={SUB_TOP} width={hw(WELL.surfaceCasingOdMm) * 2} height={depthY(WELL.surfaceCasingShoeM) - SUB_TOP} fill="none" stroke={steel} strokeWidth="1" />
      <line x1={WELL_X - hw(WELL.surfaceCasingOdMm)} y1={depthY(WELL.surfaceCasingShoeM)} x2={ANNO_X} y2={depthY(WELL.surfaceCasingShoeM)} stroke={faint} strokeWidth="0.5" />
      <text x={ANNO_X - 2} y={depthY(WELL.surfaceCasingShoeM) - 2} fontSize="4.6" textAnchor="end" fill={faint}>
        9⅝″ SHOE
      </text>
      {/* production casing to TD */}
      <line x1={WELL_X - hw(WELL.productionCasingOdMm)} y1={SUB_TOP} x2={WELL_X - hw(WELL.productionCasingOdMm)} y2={casingBottom} stroke={steel} strokeWidth="1.2" />
      <line x1={WELL_X + hw(WELL.productionCasingOdMm)} y1={SUB_TOP} x2={WELL_X + hw(WELL.productionCasingOdMm)} y2={casingBottom} stroke={steel} strokeWidth="1.2" />
      <line x1={WELL_X - hw(WELL.productionCasingOdMm)} y1={casingBottom} x2={WELL_X + hw(WELL.productionCasingOdMm)} y2={casingBottom} stroke={steel} strokeWidth="1.4" />
      {/* casing–tubing annulus fluid, with a working fluid level */}
      <rect
        x={WELL_X - hw(WELL.productionCasingIdMm)}
        y={depthY(fluidLevelM)}
        width={hw(WELL.productionCasingIdMm) * 2}
        height={casingBottom - depthY(fluidLevelM)}
        fill={`url(#${uid}-crude)`}
      />
      <line x1={ANNO_X} y1={depthY(fluidLevelM)} x2={WELL_X + hw(WELL.productionCasingIdMm)} y2={depthY(fluidLevelM)} stroke="rgb(var(--accent-thermal))" strokeWidth="0.9" strokeDasharray="3 2" />
      <text x={ANNO_X - 2} y={depthY(fluidLevelM) - 3} fontSize="4.6" textAnchor="end" fill="rgb(var(--accent-thermal))">
        FLUID LEVEL
      </text>
      <text x={ANNO_X - 2} y={depthY(fluidLevelM) + 5} fontSize="4.2" textAnchor="end" fill={faint}>
        illustrative
      </text>
      {/* rod taper interface callouts */}
      {ROD_TAPERS.slice(1).map((t) => (
        <text key={t.index} x={ANNO_X - 2} y={depthY(t.top) - 2} fontSize="4.6" textAnchor="end" fill={faint}>
          {ROD_TAPERS[t.index - 2].nominal} → {t.nominal}
        </text>
      ))}
      <text x={ANNO_X - 2} y={depthY(WELL.pumpSettingDepthM - 55)} fontSize="4.6" textAnchor="end" fill="rgb(var(--accent-interactive))">
        PUMP {WELL.pumpSettingDepthM} m
      </text>
      {/* tubing string */}
      <rect x={WELL_X - hw(WELL.tubingOdMm)} y={SUB_TOP} width={hw(WELL.tubingOdMm) * 2} height={casingBottom - SUB_TOP} fill="rgb(var(--bg-surface-2))" stroke={steel} strokeWidth="0.8" />
      <rect x={WELL_X - hw(WELL.tubingIdMm)} y={SUB_TOP} width={hw(WELL.tubingIdMm) * 2} height={casingBottom - SUB_TOP} fill="rgb(var(--accent-thermal))" fillOpacity="0.16" />
      {/* rod string, three tapers */}
      {ROD_TAPERS.map((t) => (
        <g key={t.index}>
          <rect x={WELL_X - hw(t.odMm)} y={depthY(t.top)} width={hw(t.odMm) * 2} height={depthY(t.base) - depthY(t.top)} fill="rgb(var(--text-secondary))" />
          <line x1={WELL_X - 22} y1={depthY(t.top)} x2={WELL_X + 22} y2={depthY(t.top)} stroke={faint} strokeWidth="0.5" opacity="0.8" />
        </g>
      ))}
      {/* couplings at the API 25 ft rod length */}
      {Array.from({ length: 44 }, (_, i) => {
        const d = (i + 1) * 25;
        if (d >= WELL.totalDepthM) return null;
        const t = ROD_TAPERS.find((x) => d >= x.top && d < x.base) ?? ROD_TAPERS[2];
        return <rect key={i} x={WELL_X - hw(t.couplingOdMm)} y={depthY(d) - 0.5} width={hw(t.couplingOdMm) * 2} height="1.1" fill="rgb(var(--text-primary))" opacity="0.5" />;
      })}
      {/* seating nipple / hold-down at the pump */}
      <rect x={WELL_X - hw(WELL.tubingIdMm)} y={depthY(WELL.pumpSettingDepthM - 40)} width={hw(WELL.tubingIdMm) * 2} height={4} fill="rgb(var(--accent-interactive))" fillOpacity="0.6" />
      {/* heated near-wellbore volume */}
      <ellipse cx={WELL_X} cy={depthY(1122)} rx="40" ry={depthY(1150) - depthY(1094)} fill={`url(#${uid}-plume)`} />
    </g>
  );

  const perforations = (
    <g>
      {Array.from({ length: 7 }, (_, i) => {
        const d = WELL.perfTopM + (i + 0.5) * ((WELL.perfBottomM - WELL.perfTopM) / 7);
        const yy = depthY(d);
        return (
          <g key={i}>
            <line x1={WELL_X - hw(WELL.productionCasingOdMm)} y1={yy} x2={WELL_X - 34} y2={yy - 1.5} stroke="rgb(var(--accent-thermal))" strokeWidth="1" />
            <line x1={WELL_X + hw(WELL.productionCasingOdMm)} y1={yy} x2={WELL_X + 34} y2={yy + 1.5} stroke="rgb(var(--accent-thermal))" strokeWidth="1" />
          </g>
        );
      })}
      <text x={ANNO_X - 2} y={depthY(WELL.perfTopM) + 5} fontSize="4.6" textAnchor="end" fill="rgb(var(--accent-thermal))" letterSpacing="0.05em">
        PERFS {WELL.perfTopM}–{WELL.perfBottomM}
      </text>
    </g>
  );

  /* ---------------- detail window: downhole pump ------------------------ */
  const pw = PUMP_WIN;
  const pumpCx = pw.x + pw.w / 2;
  const pumpSpanM = 5.6;
  const pumpUPerM = (pw.h - 26) / pumpSpanM; // 34.3 units per metre
  const pumpUPerMm = (pw.w - 46) / 92;
  const boreHalf = (WELL.plungerBoreMm * pumpUPerMm) / 2;
  const barrelHalf = (62 * pumpUPerMm) / 2;
  const tubIdHalf = (WELL.tubingIdMm * pumpUPerMm) / 2;
  const strokePx = 2.54 * pumpUPerM;
  const plungerH = 1.2 * pumpUPerM;
  const ballR = boreHalf * 0.42;
  const barrelTop = pw.y + 16;
  const barrelBot = pw.y + pw.h - 6;
  const svY = barrelBot - 9;
  // Authored at the BOTTOM of plunger travel; the frame loop lifts from here.
  const plungerTopAtBottom = barrelTop + 5 + strokePx;

  const pump = {
    cx: pumpCx,
    boreHalf,
    ballR,
    strokePx,
    svY,
    chamberBaseY: plungerTopAtBottom + plungerH,
    static: (
      <g>
        {/* tubing wall */}
        <line x1={pumpCx - tubIdHalf} y1={pw.y} x2={pumpCx - tubIdHalf} y2={pw.y + pw.h} stroke={steel} strokeWidth="1.4" />
        <line x1={pumpCx + tubIdHalf} y1={pw.y} x2={pumpCx + tubIdHalf} y2={pw.y + pw.h} stroke={steel} strokeWidth="1.4" />
        {/* top-anchor hold-down cups: the barrel hangs in TENSION from the
            seating nipple and does NOT reciprocate */}
        <rect x={pumpCx - tubIdHalf} y={barrelTop - 7} width={tubIdHalf * 2} height="6" fill="rgb(var(--accent-interactive))" fillOpacity="0.4" stroke="rgb(var(--accent-interactive))" strokeWidth="0.7" />
        {/* working barrel — STATIONARY. Heavy walls so it reads as the fixed
            member; the previous schematic reciprocated the whole pump. */}
        <rect x={pumpCx - barrelHalf} y={barrelTop} width={barrelHalf - boreHalf} height={barrelBot - barrelTop} fill="rgb(var(--bg-surface-3))" stroke={steel} strokeWidth="0.9" />
        <rect x={pumpCx + boreHalf} y={barrelTop} width={barrelHalf - boreHalf} height={barrelBot - barrelTop} fill="rgb(var(--bg-surface-3))" stroke={steel} strokeWidth="0.9" />
        <text x={pumpCx + barrelHalf + 3} y={barrelBot - 20} fontSize="4.8" fill={faint}>BARREL</text>
        <text x={pumpCx + barrelHalf + 3} y={barrelBot - 14} fontSize="4.8" fill={faint}>FIXED</text>
      </g>
    ),
    plunger: (
      <g>
        {/* pull rod / valve rod up to the rod string */}
        <line x1={pumpCx} y1={pw.y - 60} x2={pumpCx} y2={plungerTopAtBottom} stroke="rgb(var(--text-secondary))" strokeWidth="2.4" />
        <rect x={pumpCx - boreHalf} y={plungerTopAtBottom} width={boreHalf * 2} height={plungerH} rx="1" fill="rgb(var(--bg-surface-3))" stroke="rgb(var(--text-primary))" strokeWidth="1.2" />
        {[0.28, 0.5, 0.72].map((t) => (
          <line
            key={t}
            x1={pumpCx - boreHalf}
            y1={plungerTopAtBottom + plungerH * t}
            x2={pumpCx + boreHalf}
            y2={plungerTopAtBottom + plungerH * t}
            stroke={faint}
            strokeWidth="0.5"
          />
        ))}
        <text x={pumpCx - boreHalf - 3} y={plungerTopAtBottom + plungerH / 2 + 1.6} fontSize="4.8" textAnchor="end" fill="rgb(var(--text-primary))">
          PLUNGER
        </text>
      </g>
    ),
    tv: (
      <g>
        {/* TRAVELING valve — rides in the plunger, opens on the DOWNSTROKE */}
        <line data-seat="1" x1={pumpCx - boreHalf} y1={plungerTopAtBottom + plungerH} x2={pumpCx + boreHalf} y2={plungerTopAtBottom + plungerH} stroke={faint} strokeWidth="1.4" />
        <circle data-ball="1" data-seat-y={plungerTopAtBottom + plungerH - ballR} cx={pumpCx} cy={plungerTopAtBottom + plungerH - ballR} r={ballR} fill="rgb(var(--text-secondary))" />
        <text x={pumpCx + boreHalf + 3} y={plungerTopAtBottom + plungerH} fontSize="5" fill={faint}>TV</text>
      </g>
    ),
    sv: (
      <g>
        {/* STANDING valve — at the barrel base, never moves, opens on the UPSTROKE */}
        <line data-seat="1" x1={pumpCx - boreHalf} y1={svY} x2={pumpCx + boreHalf} y2={svY} stroke={faint} strokeWidth="1.4" />
        <circle data-ball="1" data-seat-y={svY - ballR} cx={pumpCx} cy={svY - ballR} r={ballR} fill="rgb(var(--text-secondary))" />
        <text x={pumpCx + boreHalf + 3} y={svY} fontSize="5" fill={faint}>SV</text>
        {/* gas / mud anchor tail below the seating nipple */}
        <line x1={pumpCx} y1={svY + 4} x2={pumpCx} y2={pw.y + pw.h} stroke={steel} strokeWidth="1" strokeDasharray="2 2" />
      </g>
    ),
    frame: (
      <g>
        <rect x={pw.x} y={pw.y} width={pw.w} height={pw.h} rx="4" fill="none" stroke="rgb(var(--accent-interactive))" strokeWidth="0.8" strokeOpacity="0.45" />
        <rect x={pw.x} y={pw.y - 11} width={pw.w} height="11" rx="2" fill="rgb(var(--accent-interactive))" fillOpacity="0.16" />
        <text x={pw.x + 4} y={pw.y - 3} fontSize="5.8" fill="rgb(var(--accent-interactive))" letterSpacing="0.08em">
          DETAIL A — PUMP {WELL.pumpDesignation}, 1:1
        </text>
        {/* stroke scale bar */}
        <line x1={pw.x + 7} y1={barrelTop + 5} x2={pw.x + 7} y2={barrelTop + 5 + strokePx} stroke="rgb(var(--accent-interactive))" strokeWidth="0.9" />
        <line x1={pw.x + 4} y1={barrelTop + 5} x2={pw.x + 10} y2={barrelTop + 5} stroke="rgb(var(--accent-interactive))" strokeWidth="0.9" />
        <line x1={pw.x + 4} y1={barrelTop + 5 + strokePx} x2={pw.x + 10} y2={barrelTop + 5 + strokePx} stroke="rgb(var(--accent-interactive))" strokeWidth="0.9" />
        <text
          x={pw.x + 6}
          y={barrelTop + 5 + strokePx / 2}
          fontSize="5"
          textAnchor="middle"
          fill="rgb(var(--accent-interactive))"
          transform={`rotate(-90 ${pw.x + 6} ${barrelTop + 5 + strokePx / 2})`}
        >
          STROKE 2.54 m
        </text>
        <text x={pw.x + 15} y={pw.y + 10} fontSize="4.6" fill="rgb(var(--accent-interactive))" letterSpacing="0.04em">
          SEATING NIPPLE — TOP ANCHOR
        </text>
      </g>
    ),
  };

  /* ---------------- detail window: buckling ----------------------------- */
  const bw = BUCK_WIN;
  const buckUPerMm = (bw.w - 40) / 92;
  const buckle = {
    x: bw.x,
    y: bw.y + 12,
    w: bw.w,
    h: bw.h - 24,
    cx: bw.x + bw.w / 2,
    uPerMm: buckUPerMm,
    rodW: Math.max(1.6, ROD_TAPERS[2].odMm * buckUPerMm),
    static: (
      <g>
        <line x1={bw.x + bw.w / 2 - (WELL.tubingIdMm * buckUPerMm) / 2} y1={bw.y} x2={bw.x + bw.w / 2 - (WELL.tubingIdMm * buckUPerMm) / 2} y2={bw.y + bw.h} stroke={steel} strokeWidth="1.6" />
        <line x1={bw.x + bw.w / 2 + (WELL.tubingIdMm * buckUPerMm) / 2} y1={bw.y} x2={bw.x + bw.w / 2 + (WELL.tubingIdMm * buckUPerMm) / 2} y2={bw.y + bw.h} stroke={steel} strokeWidth="1.6" />
        <rect x={bw.x + bw.w / 2 - (WELL.tubingIdMm * buckUPerMm) / 2} y={bw.y} width={WELL.tubingIdMm * buckUPerMm} height={bw.h} fill="rgb(var(--accent-thermal))" fillOpacity="0.08" />
      </g>
    ),
    frame: (
      <g>
        <rect x={bw.x} y={bw.y} width={bw.w} height={bw.h} rx="4" fill="none" stroke="rgb(var(--accent-critical))" strokeWidth="0.8" strokeOpacity="0.4" />
        <rect x={bw.x} y={bw.y - 11} width={bw.w} height="11" rx="2" fill="rgb(var(--accent-critical))" fillOpacity="0.14" />
        <text x={bw.x + 4} y={bw.y - 3} fontSize="5.8" fill="rgb(var(--accent-critical))" letterSpacing="0.08em">
          DETAIL B — ROD IN TUBING, LUBINSKI 1:1
        </text>
      </g>
    ),
  };

  /* ---------------- leaders + notes ------------------------------------- */
  const leaders = (
    <g opacity="0.6">
      <path
        d={`M ${pw.x + pw.w} ${pw.y + pw.h - 8} L ${WELL_X - 24} ${depthY(WELL.pumpSettingDepthM) - 3}`}
        fill="none"
        stroke="rgb(var(--accent-interactive))"
        strokeWidth="0.6"
        strokeDasharray="3 3"
      />
      <path
        d={`M ${bw.x + bw.w} ${bw.y + bw.h - 40} L ${WELL_X - 24} ${depthY(1000)}`}
        fill="none"
        stroke="rgb(var(--accent-critical))"
        strokeWidth="0.6"
        strokeDasharray="3 3"
      />
    </g>
  );

  const footNotes = (
    <g>
      <text x="4" y={SCENE_H - 20} fontSize="5.4" fill={faint} letterSpacing="0.05em">
        SUBSURFACE — vertical 1 unit = {(1 / depthY.pxPerM).toFixed(2)} m · horizontal 1 unit = {(1 / MM).toFixed(2)} mm
      </text>
      <text x="4" y={SCENE_H - 11} fontSize="5.4" fill={faint} letterSpacing="0.05em">
        horizontal scale exaggerated ×{H_EXAG} so a {WELL.tubingIdMm} mm bore is legible beside a {WELL.totalDepthM} m column
      </text>
      <text x="4" y={SCENE_H - 2} fontSize="5.4" fill={faint} letterSpacing="0.05em">
        detail windows A and B are magnified 1:1 — the 2.54 m stroke is 0.22% of the column
      </text>
    </g>
  );

  return {
    horizon,
    foundation,
    partKey,
    balloons,
    gearbox,
    crank,
    samsonPost,
    saddleBearing,
    beam,
    carrierBar,
    clampRod,
    wellhead,
    edgeCabinet,
    scaleBreak,
    strata,
    depthRuler,
    forceGrid,
    wellbore,
    perforations,
    pump,
    buckle,
    leaders,
    footNotes,
  };
}

export default MachineBay;
