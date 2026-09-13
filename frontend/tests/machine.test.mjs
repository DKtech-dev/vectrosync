/**
 * ============================================================================
 * Machine-module verification            run with:  npm run test:machine
 * ============================================================================
 * The visualisation makes quantitative claims on screen -- exact stroke, exact
 * linkage closure, correct valve phasing, a calibration pinned to the solver.
 * These tests are what entitle it to make them. Node's built-in runner, no
 * dependencies.
 * ==========================================================================*/

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  UNIT,
  K_GROUND,
  FRAME,
  STROKE_IN,
  PSI_MIN,
  PSI_MAX,
  THETA_BDC,
  THETA_TDC,
  UPSTROKE_DEG,
  DOWNSTROKE_DEG,
  surfaceState,
  polishedRodPosition,
  torqueFactor,
  velocityEnvelope,
  verifyLinkageClosure,
  IN_TO_M,
} from '../src/machine/pumpingUnit.js';

import {
  WELL,
  ROD_TAPERS,
  STRATA,
  makeDepthScale,
  taperAt,
  radialClearanceMm,
  weightBelowKn,
  dragShapeBelow,
  fluidLoadKn,
  makeCalibratedProfile,
  solveMaxSafeSpm,
  helicalBuckling,
  pumpState,
} from '../src/machine/wellModel.js';

const TAU = Math.PI * 2;
const deg = (r) => (r * 180) / Math.PI;

/* ========================================================================== */
/* Published API geometry                                                     */
/* ========================================================================== */

test('C-320D-256-100 dimensions match the published API geometry table', () => {
  assert.equal(UNIT.A, 129);
  assert.equal(UNIT.C, 111.07);
  assert.equal(UNIT.P, 132);
  assert.equal(UNIT.R, 42);
  assert.equal(UNIT.I, 111);
  assert.equal(UNIT.H, 211);
  assert.equal(UNIT.G, 75);
  // Ground link, independently tabulated as 175.548 in.
  assert.ok(Math.abs(K_GROUND - 175.548) < 0.001, `K = ${K_GROUND}`);
});

test('exact four-bar stroke reproduces the published 100 in stroke', () => {
  // The API approximation 2AR/C gives 97.56 in and is ~2.4% low; the exact
  // dead-centre solution gives 100.71 against a published (rounded) 100.
  assert.ok(Math.abs(STROKE_IN - 100.71) < 0.02, `stroke = ${STROKE_IN}`);
  assert.ok(Math.abs(STROKE_IN - 100) / 100 < 0.01);
});

test('max torque factor is close to the published TF_max of 47.48 in', () => {
  let maxTf = 0;
  for (let i = 0; i < 3600; i += 1) maxTf = Math.max(maxTf, Math.abs(torqueFactor((i / 3600) * TAU)));
  assert.ok(maxTf > 45 && maxTf < 55, `TF_max = ${maxTf}`);
});

/* ========================================================================== */
/* Kinematics                                                                 */
/* ========================================================================== */

test('the four-bar loop closes at every phase', () => {
  const worst = verifyLinkageClosure(3600);
  // The pitman must hold its rated length between two independently driven
  // bodies. This is the test that caught the rotation-sense error.
  assert.ok(worst.pitman < 1e-6, `pitman closure error ${worst.pitman} in`);
  assert.ok(worst.rearArm < 1e-9, `rear arm ${worst.rearArm}`);
  assert.ok(worst.frontArm < 1e-9, `front arm ${worst.frontArm}`);
  assert.ok(worst.stroke < 1e-6, `stroke ${worst.stroke}`);
});

test('polished rod position is continuous and periodic', () => {
  assert.equal(polishedRodPosition(0), polishedRodPosition(TAU));
  let maxStep = 0;
  let prev = polishedRodPosition(0);
  for (let i = 1; i <= 36000; i += 1) {
    const s = polishedRodPosition((i / 36000) * TAU);
    maxStep = Math.max(maxStep, Math.abs(s - prev));
    prev = s;
  }
  // No branch flip anywhere: 100.71 in over 36000 samples means a smooth
  // traverse can never step more than ~0.01 in.
  assert.ok(maxStep < 0.02, `max step ${maxStep} in — arccos branch discontinuity?`);
});

test('phase 0 is bottom of stroke and the commanded stroke is exact', () => {
  const bdc = surfaceState(0, 4.7, 2.54);
  assert.ok(Math.abs(bdc.positionM) < 1e-6, `s(0) = ${bdc.positionM}`);
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < 7200; i += 1) {
    const p = surfaceState((i / 7200) * TAU, 4.7, 2.54).positionM;
    lo = Math.min(lo, p);
    hi = Math.max(hi, p);
  }
  assert.ok(Math.abs(lo) < 1e-6);
  assert.ok(Math.abs(hi - 2.54) < 1e-6, `top of stroke ${hi} m`);
});

test('a different commanded stroke scales exactly', () => {
  let hi = -Infinity;
  for (let i = 0; i < 3600; i += 1) hi = Math.max(hi, surfaceState((i / 3600) * TAU, 4.7, 3.2).positionM);
  assert.ok(Math.abs(hi - 3.2) < 1e-5, `${hi}`);
});

test('dead centres are NOT at 0 and 180 degrees of crank angle', () => {
  // A sine-wave animation implicitly assumes they are. They are not, and the
  // whole asymmetry argument rests on that.
  assert.ok(Math.abs(deg(THETA_BDC) - 322.95) < 0.1, `BDC ${deg(THETA_BDC)}`);
  assert.ok(Math.abs(deg(THETA_TDC) - 147.27) < 0.1, `TDC ${deg(THETA_TDC)}`);
});

test('the conventional unit downstroke is shorter in crank degrees than the upstroke', () => {
  assert.ok(Math.abs(UPSTROKE_DEG - 184.32) < 0.05, `${UPSTROKE_DEG}`);
  assert.ok(Math.abs(DOWNSTROKE_DEG - 175.68) < 0.05, `${DOWNSTROKE_DEG}`);
  assert.ok(UPSTROKE_DEG + DOWNSTROKE_DEG > 359.99 && UPSTROKE_DEG + DOWNSTROKE_DEG < 360.01);
  // Mean downstroke speed is therefore ~4.9% higher than mean upstroke speed.
  const ratio = UPSTROKE_DEG / DOWNSTROKE_DEG;
  assert.ok(ratio > 1.045 && ratio < 1.055, `ratio ${ratio}`);
});

test('the exact motion departs materially from simple harmonic motion', () => {
  // If this ever falls below a few percent the exact solver is not earning its
  // keep and something has regressed to a sine.
  let maxDiff = 0;
  for (let i = 0; i < 3600; i += 1) {
    const p = (i / 3600) * TAU;
    const exact = surfaceState(p, 4.7, 2.54).positionM;
    const shm = 1.27 * (1 - Math.cos(p));
    maxDiff = Math.max(maxDiff, Math.abs(exact - shm));
  }
  assert.ok(maxDiff > 0.2, `only ${maxDiff} m from SHM`);
  assert.ok(maxDiff / 2.54 > 0.08, 'expected >8% of stroke');
});

test('velocity is the derivative of position, and scales linearly with SPM', () => {
  const spm = 4.7;
  const omega = (spm * TAU) / 60;
  for (const ph of [0.4, 1.3, 2.9, 4.4, 5.8]) {
    const h = 1e-5;
    const num =
      ((surfaceState(ph + h, spm, 2.54).positionM - surfaceState(ph - h, spm, 2.54).positionM) / (2 * h)) * omega;
    const v = surfaceState(ph, spm, 2.54).velocityMps;
    assert.ok(Math.abs(num - v) < 1e-6, `phase ${ph}: ${num} vs ${v}`);
  }
  const a = velocityEnvelope(2, 2.54);
  const b = velocityEnvelope(4, 2.54);
  assert.ok(Math.abs(b.peakDownMps / a.peakDownMps - 2) < 1e-9, 'drag scales with SPM via velocity');
});

test('the wireline tangent point is fixed in space at (I + A, H)', () => {
  // This is the entire reason the horsehead face is an arc centred on the
  // saddle bearing: the polished rod must stay on one vertical line.
  assert.equal(FRAME.bridleTangent.x, UNIT.I + UNIT.A);
  assert.equal(FRAME.bridleTangent.y, UNIT.H);
  assert.equal(FRAME.wellCentreX, 240);
});

/* ========================================================================== */
/* Well model                                                                 */
/* ========================================================================== */

test('depth scale is linear and invertible', () => {
  const s = makeDepthScale(100, 550, 1150);
  assert.equal(s(0), 100);
  assert.equal(s(1150), 550);
  assert.ok(Math.abs(s(575) - 325) < 1e-9, 'midpoint must be at the midpoint');
  assert.ok(Math.abs(s.invert(s(350)) - 350) < 1e-9);
  // Equal depth intervals must map to equal pixel intervals.
  assert.ok(Math.abs(s(700) - s(600) - (s(200) - s(100))) < 1e-9);
});

test('rod string totals 1150 m in three contiguous tapers', () => {
  assert.equal(ROD_TAPERS[0].top, 0);
  assert.equal(ROD_TAPERS[ROD_TAPERS.length - 1].base, WELL.totalDepthM);
  for (let i = 1; i < ROD_TAPERS.length; i += 1) assert.equal(ROD_TAPERS[i].top, ROD_TAPERS[i - 1].base);
  assert.equal(taperAt(0).nominal, '1"');
  assert.equal(taperAt(500).nominal, '7/8"');
  assert.equal(taperAt(1150).nominal, '3/4"');
  // Areas must agree with the nominal diameters the solver uses.
  for (const t of ROD_TAPERS) {
    const a = (Math.PI / 4) * (t.odMm / 1000) ** 2;
    assert.ok(Math.abs(a - t.areaM2) / t.areaM2 < 0.005, `${t.nominal}: ${a} vs ${t.areaM2}`);
  }
});

test('strata are contiguous and cover the whole column', () => {
  assert.equal(STRATA[0].top, 0);
  assert.equal(STRATA[STRATA.length - 1].base, WELL.totalDepthM);
  for (let i = 1; i < STRATA.length; i += 1) assert.equal(STRATA[i].top, STRATA[i - 1].base);
  // The pay must be the net pay thickness quoted by the thermal model.
  const pay = STRATA[STRATA.length - 1];
  assert.ok(pay.base - pay.top >= WELL.netPayM);
});

test('tubing and rod dimensions match the solver configuration', () => {
  assert.equal(WELL.tubingIdMm, 76.0); // src/rod_conservative.py tubing_id_m
  assert.equal(WELL.plungerBoreMm, 44.45); // 1.75 in
  assert.equal(WELL.totalDepthM, 1150);
  // 3-1/2 in 9.3 lb/ft tubing really does have a 75.99 mm drift-nominal ID.
  assert.ok(WELL.tubingOdMm > WELL.tubingIdMm);
  assert.ok(radialClearanceMm(1000) > 0, 'rod must fit inside the tubing');
  assert.ok(radialClearanceMm(100) < radialClearanceMm(1000), 'the 1" top taper has the least clearance');
});

test('buoyant rod weight and drag shape are monotone and physical', () => {
  assert.ok(Math.abs(weightBelowKn(0) - 30.16) < 0.05, `${weightBelowKn(0)}`);
  assert.ok(Math.abs(weightBelowKn(750) - 7.7) < 0.05, `${weightBelowKn(750)}`);
  assert.equal(weightBelowKn(1150), 0);
  assert.equal(dragShapeBelow(1150), 0);
  for (let d = 0; d < 1150; d += 50) {
    assert.ok(weightBelowKn(d) >= weightBelowKn(d + 50));
    assert.ok(dragShapeBelow(d) >= dragShapeBelow(d + 50));
  }
  // Dossier check: 14.0 kN of idealised Couette drag on the isolated bottom
  // 400 m at 9.5 Pa.s and 0.65 m/s.
  const dragKn = (dragShapeBelow(750) * 9.5 * 0.65) / 1000;
  assert.ok(Math.abs(dragKn - 14.0) < 0.5, `bottom-section drag ${dragKn} kN, dossier says 14.0`);
});

test('fluid load on the plunger matches rho.g.L.A', () => {
  const expected = (965 * 9.81 * 1150 * (Math.PI / 4) * 0.04445 ** 2) / 1000;
  assert.ok(Math.abs(fluidLoadKn() - expected) < 1e-6);
  assert.ok(fluidLoadKn() > 16 && fluidLoadKn() < 18, `${fluidLoadKn()} kN`);
});

/* ========================================================================== */
/* Calibrated force profile                                                   */
/* ========================================================================== */

function syntheticCard(fluidKn) {
  return Array.from({ length: 144 }, (_, i) => {
    const ph = (i / 144) * TAU;
    return surfaceState(ph, 1, 2.54).velocityMps > 0 ? fluidKn : 0;
  });
}

test('calibration reproduces the solver PPRL exactly', () => {
  const v = (p) => surfaceState(p, 4.7, 2.54).velocityMps;
  const prof = makeCalibratedProfile({ pumpCardKn: syntheticCard(16.89), pprlKn: 66.78, velocityAt: v });
  assert.ok(prof.calibrated);
  assert.ok(Math.abs(prof.impliedPprlKn - 66.78) < 1e-3, `${prof.impliedPprlKn}`);
  assert.ok(prof.effectiveViscosityPas > 0);
});

test('the two-anchor fit hits BOTH solver anchors exactly', () => {
  // Real values pulled from three live /api/simulate responses.
  const cases = [
    { name: 'DEFAULT', spm: 1.0, pprl: 66.78, minTen: 5.48, fluid: 16.89 },
    { name: 'SCENARIO_A', spm: 4.7, pprl: 112.94, minTen: -1.81, fluid: 16.89 },
    { name: 'SCENARIO_B', spm: 1.0, pprl: 60.01, minTen: 6.31, fluid: 16.89 },
  ];
  for (const c of cases) {
    const prof = makeCalibratedProfile({
      pumpCardKn: syntheticCard(c.fluid),
      pprlKn: c.pprl,
      targetMinKn: c.minTen,
      velocityAt: (p) => surfaceState(p, c.spm, 2.54).velocityMps,
    });
    assert.ok(prof.calibrated, `${c.name}: surface anchor failed`);
    assert.ok(prof.deepAnchored, `${c.name}: deep anchor failed`);
    assert.ok(Math.abs(prof.impliedPprlKn - c.pprl) < 1e-2, `${c.name} PPRL ${prof.impliedPprlKn}`);
    assert.ok(Math.abs(prof.predictedTaperTensionKn - c.minTen) < 1e-2, `${c.name} T750 ${prof.predictedTaperTensionKn}`);
    // The drag weighting must never turn drag into a tension source.
    assert.ok(prof.lambda >= -1 && prof.lambda <= 1, `${c.name} lambda ${prof.lambda}`);
  }
});

test('constraint solver finds the fastest speed that holds the anti-float floor', () => {
  const card = syntheticCard(16.89);
  const seed = makeCalibratedProfile({
    pumpCardKn: card,
    pprlKn: 112.94,
    targetMinKn: -1.81,
    velocityAt: (p) => surfaceState(p, 4.7, 2.54).velocityMps,
  });
  const buildAt = (spm) =>
    makeCalibratedProfile({
      pumpCardKn: card,
      velocityAt: (p) => surfaceState(p, spm, 2.54).velocityMps,
      fixedViscosityPas: seed.effectiveViscosityPas,
      fixedLambda: seed.lambda,
    });

  const sol = solveMaxSafeSpm(buildAt, 0.5, [1.0, 5.5]);
  assert.ok(sol.spm >= 1.0 && sol.spm <= 5.5, `out of MPC bounds: ${sol.spm}`);
  assert.ok(sol.limited, 'this case must be constrained');
  // The returned speed holds the floor...
  assert.ok(buildAt(sol.spm).predictedTaperTensionKn >= 0.5, `floor violated at ${sol.spm}`);
  // ...and it is genuinely the fastest such speed.
  assert.ok(buildAt(sol.spm + 0.2).predictedTaperTensionKn < 0.5, 'not maximal');
  // The requested 4.7 SPM must be strictly worse than the advisory.
  assert.ok(buildAt(4.7).predictedTaperTensionKn < buildAt(sol.spm).predictedTaperTensionKn);
});

test('constraint solver reports infeasibility instead of returning an unsafe speed', () => {
  const card = syntheticCard(16.89);
  // Absurdly viscous fluid: even the MPC minimum cannot hold the floor.
  const buildAt = (spm) =>
    makeCalibratedProfile({
      pumpCardKn: card,
      velocityAt: (p) => surfaceState(p, spm, 2.54).velocityMps,
      fixedViscosityPas: 400,
      fixedLambda: 1,
    });
  const sol = solveMaxSafeSpm(buildAt, 0.5, [1.0, 5.5]);
  assert.equal(sol.infeasible, true);
  assert.equal(sol.spm, 1.0, 'must fall back to the actuator minimum, not to zero or NaN');
});

test('an unconstrained case returns the actuator maximum, not a fitted value', () => {
  const card = syntheticCard(16.89);
  const buildAt = (spm) =>
    makeCalibratedProfile({
      pumpCardKn: card,
      velocityAt: (p) => surfaceState(p, spm, 2.54).velocityMps,
      fixedViscosityPas: 0.05,
      fixedLambda: 1,
    });
  const sol = solveMaxSafeSpm(buildAt, 0.5, [1.0, 5.5]);
  assert.equal(sol.limited, false);
  assert.equal(sol.spm, 5.5);
});

test('the profile is pinned to the pump card at total depth', () => {
  const v = (p) => surfaceState(p, 4.7, 2.54).velocityMps;
  const card = syntheticCard(16.89);
  const prof = makeCalibratedProfile({ pumpCardKn: card, pprlKn: 66.78, velocityAt: v });
  for (const i of [0, 20, 72, 100, 143]) {
    const ph = (i / 144) * TAU;
    assert.ok(Math.abs(prof.force(WELL.totalDepthM, ph) - card[i]) < 1e-6, `bin ${i}`);
  }
});

test('negative card values are treated as tension readings, not pump load', () => {
  // The solver folds compressive tension into the downhole card during float.
  // Feeding that back in as a pump load would double-count it.
  const v = (p) => surfaceState(p, 4.7, 2.54).velocityMps;
  const card = syntheticCard(16.89).map((x, i) => (i > 80 ? -20 : x));
  const prof = makeCalibratedProfile({ pumpCardKn: card, pprlKn: 66.78, velocityAt: v });
  assert.ok(prof.force(WELL.totalDepthM, (100 / 144) * TAU) >= 0, 'pump load must not go negative');
});

test('raising speed at constant viscosity drives the string into compression', () => {
  // This IS the A/B experiment: identical fluid, identical well, speed only.
  const card = syntheticCard(16.89);
  const slow = makeCalibratedProfile({
    pumpCardKn: card,
    pprlKn: 66.78,
    velocityAt: (p) => surfaceState(p, 1.0, 2.54).velocityMps,
  });
  const fast = makeCalibratedProfile({
    pumpCardKn: card,
    velocityAt: (p) => surfaceState(p, 4.7, 2.54).velocityMps,
    fixedViscosityPas: slow.effectiveViscosityPas,
  });
  assert.ok(fast.predictedTaperTensionKn < slow.predictedTaperTensionKn, 'faster must mean less tension');
  assert.ok(slow.predictedTaperTensionKn > 0, 'the governed branch should hold tension');
  assert.ok(fast.predictedTaperTensionKn < 0, 'the ungoverned branch should reach compression');
  assert.ok(fast.impliedPprlKn > slow.impliedPprlKn, 'and it should also cost more peak rod load');
});

test('the envelope brackets the instantaneous profile at every depth', () => {
  const v = (p) => surfaceState(p, 4.7, 2.54).velocityMps;
  const prof = makeCalibratedProfile({ pumpCardKn: syntheticCard(16.89), pprlKn: 66.78, velocityAt: v });
  for (const d of [0, 175, 350, 750, 1000, 1150]) {
    const [lo, hi] = prof.envelope(d);
    for (let i = 0; i < 36; i += 1) {
      const f = prof.force(d, (i / 36) * TAU);
      assert.ok(f >= lo - 1e-6 && f <= hi + 1e-6, `depth ${d} bin ${i}: ${f} outside [${lo}, ${hi}]`);
    }
  }
});

test('minimum tension always occurs on the downstroke', () => {
  // Drag can only subtract from tension while the rod is moving down. If the
  // minimum ever lands on the upstroke, a sign has been inverted.
  const v = (p) => surfaceState(p, 4.7, 2.54).velocityMps;
  const prof = makeCalibratedProfile({ pumpCardKn: syntheticCard(16.89), pprlKn: 90, velocityAt: v });
  assert.ok(v(prof.minPhaseRad) < 0, `min at phase ${deg(prof.minPhaseRad)}deg, velocity ${v(prof.minPhaseRad)}`);
});

/* ========================================================================== */
/* Buckling                                                                   */
/* ========================================================================== */

test('Lubinski pitch follows p = sqrt(8.pi^2.E.I/F)', () => {
  const d = ROD_TAPERS[2].odMm / 1000;
  const I = (Math.PI * d ** 4) / 64;
  for (const F of [1, 5, 16.4, 40]) {
    const expected = Math.sqrt((8 * Math.PI ** 2 * 2.0e11 * I) / (F * 1000));
    assert.ok(Math.abs(helicalBuckling(F, 900).pitchM - expected) < 1e-9, `F = ${F}`);
  }
  // Pitch must SHORTEN as compression grows, by 1/sqrt(F).
  const a = helicalBuckling(4, 900);
  const b = helicalBuckling(16, 900);
  assert.ok(Math.abs(a.pitchM / b.pitchM - 2) < 1e-9, 'pitch must scale as 1/sqrt(F)');
});

test('buckling amplitude is the radial clearance and is INDEPENDENT of load', () => {
  // The classic mistake is to grow the amplitude with compression. In the
  // Lubinski solution the helix rides the wall: the load sets the pitch only.
  const lo = helicalBuckling(1, 900);
  const hi = helicalBuckling(50, 900);
  assert.equal(lo.amplitudeMm, hi.amplitudeMm);
  assert.equal(lo.amplitudeMm, radialClearanceMm(900));
  assert.ok(hi.bendingStressMpa > lo.bendingStressMpa, 'tighter helix must mean more bending stress');
});

/* ========================================================================== */
/* Downhole pump                                                              */
/* ========================================================================== */

test('valve phasing is upstroke SV-open / downstroke TV-open', () => {
  // The old schematic had this exactly backwards.
  let upSv = 0;
  let upTv = 0;
  let downTv = 0;
  let downSv = 0;
  for (let i = 0; i < 360; i += 1) {
    const st = surfaceState((i / 360) * TAU, 4.7, 2.54);
    const ps = pumpState(st, { floatSeverity: 0 });
    if (st.velocityMps > 0.05) {
      if (ps.svOpen) upSv += 1;
      if (ps.tvOpen) upTv += 1;
    } else if (st.velocityMps < -0.05) {
      if (ps.tvOpen) downTv += 1;
      if (ps.svOpen) downSv += 1;
    }
  }
  assert.ok(upSv > 120, `standing valve open for only ${upSv} deg of upstroke`);
  assert.equal(upTv, 0, 'traveling valve must never be open on the upstroke');
  assert.ok(downTv > 120, `traveling valve open for only ${downTv} deg of downstroke`);
  assert.equal(downSv, 0, 'standing valve must never be open on the downstroke');
});

test('rod float shortens plunger travel and eventually stops the traveling valve', () => {
  const st = surfaceState(4.2, 4.7, 2.54);
  const healthy = pumpState(st, { floatSeverity: 0 });
  const floating = pumpState(st, { floatSeverity: 0.8 });
  const locked = pumpState(st, { floatSeverity: 0.98 });
  assert.ok(floating.travelRatio < healthy.travelRatio);
  assert.ok(floating.lagDeg > healthy.lagDeg, 'float must delay valve action');
  assert.ok(floating.displacementM3 < healthy.displacementM3, 'and cut production');
  assert.equal(locked.tvOpen, false, 'at extreme float the TV never opens');
});

test('pump displacement matches the swept plunger volume', () => {
  const st = surfaceState(1.5, 4.7, 2.54);
  const ps = pumpState(st, { floatSeverity: 0, fillage: 1 });
  const swept = (Math.PI / 4) * 0.04445 ** 2 * 2.54 * ps.travelRatio;
  assert.ok(Math.abs(ps.displacementM3 - swept) < 1e-12);
});

/* ========================================================================== */
/* Unit conversion sanity                                                     */
/* ========================================================================== */

test('inch/metre conversion is exact', () => {
  assert.equal(IN_TO_M, 0.0254);
  assert.ok(Math.abs(STROKE_IN * IN_TO_M - 2.558) < 0.001);
});
