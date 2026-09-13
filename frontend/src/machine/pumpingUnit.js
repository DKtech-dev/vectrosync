/**
 * ============================================================================
 * EXACT KINEMATICS — API Class I (conventional, crank-balanced) beam pumping unit
 * ============================================================================
 *
 * Reference machine: C-320D-256-100
 *   320,000 in-lb gearbox · 25,600 lb structural rating · 100 in (2.54 m) stroke
 *
 * This is the same 2.54 m surface stroke the Catenary rod model uses
 * (`surface_stroke_m = 2.54`, `src/rod_conservative.py`), so the drawing and the
 * solver describe the same machine.
 *
 * Dimensional data — API Spec 11E / API RP 11L nomenclature, from the
 * conventional-unit geometry table reproduced in Guo, *Petroleum Production
 * Engineering*, Table 1-1. All lengths in inches.
 *
 *   A  129     saddle bearing  -> polished rod        (front / horsehead arm)
 *   C  111.07  saddle bearing  -> equalizer bearing   (rear / tail arm)
 *   P  132     equalizer bearing -> crank pin         (pitman)
 *   R  42      crankshaft -> crank pin                (crank radius, long hole)
 *   I  111     horizontal, saddle bearing -> crankshaft
 *   H  211     saddle bearing height above base rails
 *   G  75      crankshaft centreline height above base rails
 *
 * Cross-checks that this data set is internally consistent:
 *   K = sqrt(I^2 + (H-G)^2) = 175.548 in  (matches the published K)
 *   exact stroke at R=42 -> 100.77 in     (published 100 in; the tabulated
 *                                          integer R is rounded, true R ~41.7)
 *   max torque factor A*R/C = 48.78 in    (published 47.48 in)
 *
 * -----------------------------------------------------------------------------
 * WHY THE EXACT SOLUTION MATTERS
 * -----------------------------------------------------------------------------
 * The usual shortcut is to animate the polished rod as `sin(theta)`. On this
 * machine that is wrong by up to 0.229 m -- 9.0% of the stroke -- and it is
 * wrong in the region that matters. A real four-bar crank-rocker produces an
 * ASYMMETRIC stroke: this unit spends 184.32 crank degrees on the upstroke and
 * only 175.68 on the downstroke, so the rod string is driven down 4.9% faster
 * on average than it is lifted. Annular Couette drag is linear in rod velocity,
 * so the drag that floats the rod string is set by the fast half of a motion
 * that a sine wave does not reproduce. The velocity peak also sits at a
 * different phase (66 deg / 277 deg, not 90 deg / 270 deg), which shifts where
 * in the stroke minimum tension actually occurs.
 *
 * The closed-form below is the standard vector-loop solution (the formulation
 * behind Svinos, SPE 12201; see also Takacs, Kis & Koncz, J Petrol Explor Prod
 * Technol 6:101-110, 2015, which states the exact relation s(t) = A * theta_b).
 * ==========================================================================*/

const TWO_PI = Math.PI * 2;

export const IN_TO_M = 0.0254;
export const M_TO_IN = 1 / IN_TO_M;

/** C-320D-256-100 structural geometry, inches. */
export const UNIT = Object.freeze({
  designation: 'C-320D-256-100',
  gearboxRatingInLb: 320000,
  structuralRatingLb: 25600,
  A: 129.0,
  C: 111.07,
  P: 132.0,
  R: 42.0,
  I: 111.0,
  H: 211.0,
  G: 75.0,
});

/** Ground link: crankshaft centre -> saddle bearing. */
export const K_GROUND = Math.hypot(UNIT.I, UNIT.H - UNIT.G); // 175.548 in

/**
 * Scene frame used by every drawing component.
 *
 * Origin (0, 0) = crankshaft centreline, projected onto the base rails.
 * +x  = toward the wellhead (drawn to the right)
 * +y  = UP  (SVG components flip this once, at the outermost transform, so all
 *            downstream geometry can be reasoned about in real-world terms)
 *
 * Everything here is derived, never hand-placed, so the drawing cannot drift
 * out of agreement with the kinematics.
 */
export const FRAME = Object.freeze({
  crankshaft: { x: 0, y: UNIT.G },
  saddleBearing: { x: UNIT.I, y: UNIT.H },
  /**
   * The wireline bridle is tangent to the horsehead face. The horsehead face is
   * a circular arc CENTRED ON THE SADDLE BEARING with radius A (US 4,466,301:
   * "a segment of a circle having a radius measured from the Sampson post
   * journal"). The unique vertical tangent to that circle touches at x = I + A,
   * y = H -- a point FIXED IN SPACE. That is the whole purpose of the arc: the
   * polished rod stays on one vertical line through the stuffing box for the
   * entire stroke, no matter where the beam is.
   */
  bridleTangent: { x: UNIT.I + UNIT.A, y: UNIT.H },
  /** Well centreline. Falls out of the tangency condition above. */
  wellCentreX: UNIT.I + UNIT.A, // 240 in
  baseRailY: 0,
  baseFrontX: UNIT.I + UNIT.A - 34,
  baseRearX: -74,
});

/* -------------------------------------------------------------------------- */
/* Beam angle psi(theta)                                                       */
/* -------------------------------------------------------------------------- */

/**
 * `psi` is the angle at the saddle bearing between
 *   S -> crankshaft   (the fixed ground link K), and
 *   S -> equalizer bearing (the rear arm C, i.e. the walking beam itself).
 *
 * Because the beam is rigid and straight through the saddle bearing, psi fully
 * determines the attitude of the whole beam, the horsehead, and therefore the
 * polished rod. psi INCREASES as the tail rises, i.e. as the horsehead — and
 * the polished rod — goes DOWN.
 *
 * @param theta crank angle in radians, measured at the crankshaft from the
 *              direction crankshaft -> saddle bearing, positive in the
 *              direction of rotation.
 */
export function beamAngle(theta) {
  const { C, P, R } = UNIT;
  const K = K_GROUND;

  // |S -> crank pin|, by the law of cosines in triangle (S, crankshaft, pin).
  const J = Math.sqrt(K * K + R * R - 2 * K * R * Math.cos(theta));

  // Angle at S between S->crankshaft and S->crank pin. Signed: the crank pin
  // swings to either side of the ground link over a revolution, and arccos only
  // returns the magnitude.
  const rho = Math.acos(clamp((K * K + J * J - R * R) / (2 * K * J), -1, 1)) * Math.sign(Math.sin(theta) || 1);

  // Angle at S between S->crank pin and S->equalizer bearing, in the pitman
  // triangle (S, equalizer, crank pin). Principal branch: an assembled
  // crank-rocker never passes a change point, so beta stays in (0, pi) for the
  // whole revolution and the solution is continuous.
  const beta = Math.acos(clamp((J * J + C * C - P * P) / (2 * J * C), -1, 1));

  return beta - rho;
}

/** Beam angle at the two dead centres (crank and pitman collinear). */
export const PSI_MAX = Math.acos(
  clamp((K_GROUND ** 2 + UNIT.C ** 2 - (UNIT.P + UNIT.R) ** 2) / (2 * K_GROUND * UNIT.C), -1, 1),
); // tail highest  -> polished rod at BOTTOM of stroke
export const PSI_MIN = Math.acos(
  clamp((K_GROUND ** 2 + UNIT.C ** 2 - (UNIT.P - UNIT.R) ** 2) / (2 * K_GROUND * UNIT.C), -1, 1),
); // tail lowest   -> polished rod at TOP of stroke

/** Exact stroke, inches. 100.71 in for the tabulated R = 42 in. */
export const STROKE_IN = UNIT.A * (PSI_MAX - PSI_MIN);

/**
 * Polished rod position, inches ABOVE bottom of stroke.
 * s(theta) = A * (psi_max - psi(theta))   -- exact, no small-angle assumption.
 */
export function polishedRodPosition(theta) {
  return UNIT.A * (PSI_MAX - beamAngle(theta));
}

/**
 * Crank angle of bottom dead centre, found by bisecting the torque-factor sign
 * change. On a real four-bar the dead centres do NOT fall at 0 and 180 degrees
 * -- here they are at 322.95 and 147.27 -- so the datum has to be measured, not
 * assumed.
 */
function findDeadCentre(kind) {
  const N = 2880;
  let prev = torqueFactor(0);
  for (let i = 1; i <= N; i += 1) {
    const th = (i / N) * TWO_PI;
    const cur = torqueFactor(th);
    if (Math.sign(cur) !== Math.sign(prev)) {
      // bottom dead centre: TF crosses from negative (descending) to positive
      const isBottom = cur > 0;
      if ((kind === 'bottom') === isBottom) {
        let lo = ((i - 1) / N) * TWO_PI;
        let hi = th;
        for (let k = 0; k < 60; k += 1) {
          const mid = (lo + hi) / 2;
          if (Math.sign(torqueFactor(mid)) === Math.sign(torqueFactor(lo))) lo = mid;
          else hi = mid;
        }
        return (lo + hi) / 2;
      }
    }
    prev = cur;
  }
  return 0;
}

/**
 * STROKE PHASE DATUM.
 *
 * Every other part of this system -- the 144-bin dynacard, the sigma(x, theta)
 * stress heatmap angle axis, and the live WebSocket `phase_deg` -- uses
 * phase 0 = bottom of stroke, increasing through the upstroke. So does this
 * module's public API: callers pass a STROKE PHASE, and the mechanical crank
 * angle is recovered by adding the measured BDC offset. That keeps the drawing
 * and the solver on one clock.
 */
export const THETA_BDC = findDeadCentre('bottom');
export const THETA_TDC = findDeadCentre('top');
/** Crank degrees spent on the upstroke. > 180 on a conventional unit. */
export const UPSTROKE_DEG = (((THETA_TDC - THETA_BDC) * 180) / Math.PI + 360) % 360;
export const DOWNSTROKE_DEG = 360 - UPSTROKE_DEG;

/** Convert a stroke phase (0 = BDC) to the mechanical crank angle. */
export function phaseToCrank(phase) {
  return phase + THETA_BDC;
}

/**
 * Torque factor TF = ds/dtheta, inches of polished rod travel per radian of
 * crank rotation. This is the real API torque factor and it is also exactly the
 * velocity transfer function: v_pr = TF * omega.
 *
 * Central difference — the analytic derivative buys nothing at animation
 * fidelity and the numerical form cannot disagree with `polishedRodPosition`.
 */
export function torqueFactor(theta, h = 1e-5) {
  return (polishedRodPosition(theta + h) - polishedRodPosition(theta - h)) / (2 * h);
}

/* -------------------------------------------------------------------------- */
/* Full state at a crank angle                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Complete surface kinematic state.
 *
 * @param theta  crank angle, radians (any value; wrapped internally)
 * @param spm    strokes per minute — sets the time scale for velocity/accel
 * @param strokeM  commanded surface stroke in metres. The drawing is built for
 *                 the machine's own 2.54 m stroke; a different commanded stroke
 *                 is represented by scaling, which is what changing the crank
 *                 pin hole physically does.
 */
export function surfaceState(phase, spm = 4.7, strokeM = 2.54) {
  const ph = ((phase % TWO_PI) + TWO_PI) % TWO_PI;
  const t = ((phaseToCrank(ph) % TWO_PI) + TWO_PI) % TWO_PI;
  const psi = beamAngle(t);

  const strokeScale = (strokeM * M_TO_IN) / STROKE_IN;
  const sIn = UNIT.A * (PSI_MAX - psi) * strokeScale;
  const tf = torqueFactor(t) * strokeScale;

  const omega = (spm * TWO_PI) / 60; // rad/s
  const vIn = tf * omega; // in/s, + = up

  // Beam attitude in scene coordinates. saddle -> crankshaft points down-and-
  // rearward at atan2(G - H, -I) = -129.2 deg. psi opens from that ray toward
  // the horizontal, so the rear arm sits at groundDir - psi: at psi = 50.8 deg
  // (mid-stroke) the beam is level, at psi_max = 70.7 deg the tail is up and
  // the polished rod is at the bottom of its stroke.
  const groundDir = Math.atan2(UNIT.G - UNIT.H, -UNIT.I);
  const rearArmDir = groundDir - psi;
  // 0 = level, + = tail up / horsehead down. Wrapped to (-180, 180].
  const beamTiltRad = wrapPi(Math.PI - rearArmDir);

  const S = FRAME.saddleBearing;
  const equalizer = {
    x: S.x + UNIT.C * Math.cos(rearArmDir),
    y: S.y + UNIT.C * Math.sin(rearArmDir),
  };
  /** Horsehead pin: the beam is rigid and straight, so this is diametrically
   *  opposite the equalizer about the saddle bearing. */
  const headPin = {
    x: S.x - UNIT.A * Math.cos(rearArmDir),
    y: S.y - UNIT.A * Math.sin(rearArmDir),
  };
  const O = FRAME.crankshaft;
  // Crank pin. theta is measured at the crankshaft from the O -> S ray, and it
  // opens CLOCKWISE in scene coordinates (wellhead to the right). That sense is
  // forced, not chosen: `beamAngle` signs rho by sin(theta), which only closes
  // the pitman loop for one direction of rotation. The unit test at the bottom
  // of this file checks |crankPin - equalizer| == P for all phases, which is
  // what pins it down.
  const groundFromCrank = Math.atan2(S.y - O.y, S.x - O.x);
  const pinDir = groundFromCrank - t;
  const crankPin = {
    x: O.x + UNIT.R * Math.cos(pinDir),
    y: O.y + UNIT.R * Math.sin(pinDir),
  };
  // On a CONVENTIONAL unit the counterweight offset angle tau is zero: the
  // counterweight centre of gravity lies on the crank arm centreline, 180 deg
  // from the crank pin. (Takacs et al. 2015, eq. 1: T_cb = T_cbmax * sin(theta).)
  // A Mark II or reverse-Mark would need tau != 0 here.
  const counterweight = {
    x: O.x - 0.74 * UNIT.R * Math.cos(pinDir),
    y: O.y - 0.74 * UNIT.R * Math.sin(pinDir),
    angleDeg: -((pinDir * 180) / Math.PI), // SVG deg, y already flipped by caller
  };
  const crankAngleDeg = -((pinDir * 180) / Math.PI);

  const strokeIn = STROKE_IN * strokeScale;
  const fraction = strokeIn > 0 ? sIn / strokeIn : 0;

  return {
    /** Stroke phase, 0 = bottom of stroke (matches the backend card bins). */
    phase: ph,
    phaseDeg: (ph * 180) / Math.PI,
    /** Mechanical crank angle. */
    theta: t,
    thetaDeg: (t * 180) / Math.PI,
    psi,
    beamTiltRad,
    beamTiltDeg: (beamTiltRad * 180) / Math.PI,
    /** Polished rod position above bottom of stroke. */
    positionIn: sIn,
    positionM: sIn * IN_TO_M,
    /** 0 at bottom of stroke, 1 at top. */
    fraction,
    /** + = upstroke. */
    velocityIps: vIn,
    velocityMps: vIn * IN_TO_M,
    torqueFactorIn: tf,
    isUpstroke: vIn >= 0,
    equalizer,
    headPin,
    crankPin,
    crankAngleDeg,
    counterweight,
    strokeIn,
    strokeM,
  };
}

/**
 * Self-check. Verifies that the four-bar loop actually closes: the pitman must
 * hold its rated length P between the crank pin and the equalizer bearing at
 * every phase, and the two beam arms must hold C and A about the saddle
 * bearing. Any sign or datum error in the derivation shows up here immediately.
 * Returns the worst-case error in inches. Called by the machine test suite.
 */
export function verifyLinkageClosure(samples = 3600) {
  let worst = { pitman: 0, rearArm: 0, frontArm: 0, stroke: 0 };
  let lo = Infinity;
  let hi = -Infinity;
  const S = FRAME.saddleBearing;
  for (let i = 0; i < samples; i += 1) {
    const st = surfaceState((i / samples) * TWO_PI, 4.7, 2.54);
    worst.pitman = Math.max(worst.pitman, Math.abs(Math.hypot(st.crankPin.x - st.equalizer.x, st.crankPin.y - st.equalizer.y) - UNIT.P));
    worst.rearArm = Math.max(worst.rearArm, Math.abs(Math.hypot(S.x - st.equalizer.x, S.y - st.equalizer.y) - UNIT.C));
    worst.frontArm = Math.max(worst.frontArm, Math.abs(Math.hypot(S.x - st.headPin.x, S.y - st.headPin.y) - UNIT.A));
    lo = Math.min(lo, st.positionM);
    hi = Math.max(hi, st.positionM);
  }
  worst.stroke = Math.abs(hi - lo - 2.54);
  return worst;
}

/**
 * Peak up / peak down polished rod speed and the crank angles at which they
 * occur. The ratio of these two is the asymmetry that a sine wave throws away,
 * and it is the reason the downstroke is the dangerous half of the cycle.
 */
export function velocityEnvelope(spm = 4.7, strokeM = 2.54, samples = 1440) {
  let vUp = 0;
  let vDown = 0;
  let thetaUp = 0;
  let thetaDown = 0;
  for (let i = 0; i < samples; i += 1) {
    const th = (i / samples) * TWO_PI;
    const v = surfaceState(th, spm, strokeM).velocityIps;
    if (v > vUp) {
      vUp = v;
      thetaUp = th;
    }
    if (v < vDown) {
      vDown = v;
      thetaDown = th;
    }
  }
  return {
    peakUpMps: vUp * IN_TO_M,
    peakDownMps: Math.abs(vDown) * IN_TO_M,
    thetaPeakUpDeg: (thetaUp * 180) / Math.PI,
    thetaPeakDownDeg: (thetaDown * 180) / Math.PI,
    asymmetry: vUp > 0 ? Math.abs(vDown) / vUp : 1,
  };
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Wrap an angle into (-pi, pi]. */
function wrapPi(a) {
  let x = a;
  while (x > Math.PI) x -= TWO_PI;
  while (x <= -Math.PI) x += TWO_PI;
  return x;
}
