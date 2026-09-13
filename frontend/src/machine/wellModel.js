/**
 * ============================================================================
 * WELL COMPLETION MODEL — Baghewala-inspired CSS heavy-oil producer
 * ============================================================================
 *
 * Every depth in the drawing comes from this file, and every depth is mapped
 * through ONE function (`makeDepthScale`). The previous schematic hand-placed
 * y-coordinates, which produced three different depth scales in a single
 * drawing and taper markers ~100 m away from the depths they were labelled
 * with. Nothing here is hand-placed.
 *
 * Dimensions are pinned to the solver configuration so the picture and the
 * physics cannot disagree:
 *
 *   total depth / pump setting depth   1150 m TVD   (src/rod_conservative.py)
 *   tubing ID                          76.0 mm      -> 3-1/2" 9.3 lb/ft tubing
 *                                                      (OD 88.9, ID 75.99 mm)
 *   plunger bore                       44.45 mm     -> 1.75 in
 *   net pay                            15 m         -> perforations 1135-1150 m
 *   rod string                         1.0" / 7/8" / 3/4" at 350 / 400 / 400 m
 *   surface stroke                     2.54 m
 * ==========================================================================*/

import { surfaceState } from './pumpingUnit.js';

export const WELL = Object.freeze({
  totalDepthM: 1150,
  pumpSettingDepthM: 1150,
  netPayM: 15,
  perfTopM: 1135,
  perfBottomM: 1150,
  formation: 'Jodhpur Sandstone',
  reservoirTempC: 48,
  steamTempC: 260,

  tubingOdMm: 88.9, // 3-1/2" 9.3 lb/ft
  tubingIdMm: 76.0,
  productionCasingOdMm: 177.8, // 7" 26 lb/ft
  productionCasingIdMm: 157.1,
  surfaceCasingOdMm: 244.5, // 9-5/8"
  surfaceCasingShoeM: 250,
  conductorOdMm: 339.7, // 13-3/8"
  conductorShoeM: 30,
  holeDiameterMm: 215.9, // 8-1/2" bit through the pay

  plungerBoreMm: 44.45, // 1.75 in
  plungerLengthM: 1.83, // 6 ft
  barrelLengthM: 6.1, // 20 ft
  pumpDesignation: '30-175-RHAC',
});

/**
 * Lithologic column. Depths are the boundaries of each unit in m TVD.
 * The Jodhpur Sandstone pay is the bottom unit; the section above it is the
 * Bilara/Hanseran evaporite-carbonate succession typical of the
 * Bikaner-Nagaur basin. Synthetic, but stratigraphically ordered.
 */
export const STRATA = Object.freeze([
  { top: 0, base: 120, name: 'Alluvium / Nagaur Gp.', short: 'Alluvium', pattern: 'sand' },
  { top: 120, base: 430, name: 'Bilara Carbonate', short: 'Bilara Carb.', pattern: 'carbonate' },
  { top: 430, base: 780, name: 'Hanseran Evaporite', short: 'Hanseran Evap.', pattern: 'evaporite' },
  { top: 780, base: 1100, name: 'Upper Jodhpur Shale', short: 'Jodhpur Shale', pattern: 'shale' },
  { top: 1100, base: 1150, name: 'Jodhpur Sandstone (pay)', short: 'Jodhpur SS — PAY', pattern: 'pay' },
]);

/** Rod string tapers. Mirrors `get_default_baghewala_rod_string()`. */
export const ROD_TAPERS = Object.freeze([
  { index: 1, top: 0, base: 350, nominal: '1"', odMm: 25.4, couplingOdMm: 60.3, areaM2: 5.067e-4 },
  { index: 2, top: 350, base: 750, nominal: '7/8"', odMm: 22.225, couplingOdMm: 46.0, areaM2: 3.879e-4 },
  { index: 3, top: 750, base: 1150, nominal: '3/4"', odMm: 19.05, couplingOdMm: 41.3, areaM2: 2.85e-4 },
]);

export const STEEL_E_PA = 2.0e11;
export const STEEL_RHO = 7850;

/* -------------------------------------------------------------------------- */
/* Depth scale — the single source of truth                                    */
/* -------------------------------------------------------------------------- */

/**
 * Build a strictly linear depth -> y mapping.
 * @param yTop    y of 0 m TVD (ground level)
 * @param yBottom y of `depthBottom`
 */
export function makeDepthScale(yTop, yBottom, depthBottom = WELL.totalDepthM) {
  const span = yBottom - yTop;
  const scale = (m) => yTop + (m / depthBottom) * span;
  scale.invert = (y) => ((y - yTop) / span) * depthBottom;
  scale.pxPerM = span / depthBottom;
  scale.yTop = yTop;
  scale.yBottom = yBottom;
  scale.depthBottom = depthBottom;
  return scale;
}

/** Which taper is at this depth. */
export function taperAt(depthM) {
  return ROD_TAPERS.find((t) => depthM >= t.top && depthM <= t.base) ?? ROD_TAPERS[ROD_TAPERS.length - 1];
}

/** Rod-to-tubing radial clearance at a depth, in mm. Sets the buckling amplitude. */
export function radialClearanceMm(depthM) {
  return (WELL.tubingIdMm - taperAt(depthM).odMm) / 2;
}

/* -------------------------------------------------------------------------- */
/* Axial force field                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Sample the solver's sigma(depth, phase) field and convert to axial force.
 *
 * `stress_heatmap.stress_matrix_mpa` is row-major [depth_i][angle_j] with
 * `depths_m` of length 116 (surrogate) or 78 (transient) and 144 angle bins.
 * Force = sigma * A(depth), which is why the taper area lookup has to be by
 * depth and not by row index.
 *
 * @returns {(depthM:number, phaseDeg:number) => number} axial force in kN,
 *          positive = tension. Returns NaN when no field is available, so
 *          callers can distinguish "no data" from "zero load".
 */
export function makeForceField(stressHeatmap) {
  const depths = stressHeatmap?.depths_m;
  const angles = stressHeatmap?.angles_deg;
  const matrix = stressHeatmap?.stress_matrix_mpa;
  if (!Array.isArray(depths) || !Array.isArray(matrix) || matrix.length !== depths.length) {
    const f = () => NaN;
    f.available = false;
    return f;
  }
  const nAngles = angles?.length ?? matrix[0]?.length ?? 144;
  const maxDepth = depths[depths.length - 1] || WELL.totalDepthM;

  const field = (depthM, phaseDeg) => {
    const d = clamp(depthM, 0, maxDepth);
    // Bilinear in (depth, phase) so the animation doesn't visibly quantise to
    // the 2.5-degree solver bins.
    const dPos = (d / maxDepth) * (depths.length - 1);
    const d0 = Math.floor(dPos);
    const d1 = Math.min(depths.length - 1, d0 + 1);
    const dt = dPos - d0;

    const aPos = (((phaseDeg % 360) + 360) % 360) * (nAngles / 360);
    const a0 = Math.floor(aPos) % nAngles;
    const a1 = (a0 + 1) % nAngles;
    const at = aPos - Math.floor(aPos);

    const row0 = matrix[d0];
    const row1 = matrix[d1];
    if (!row0 || !row1) return NaN;
    const s0 = row0[a0] * (1 - at) + row0[a1] * at;
    const s1 = row1[a0] * (1 - at) + row1[a1] * at;
    const sigmaMpa = s0 * (1 - dt) + s1 * dt;

    return (sigmaMpa * 1e6 * taperAt(d).areaM2) / 1000; // kN
  };
  field.available = true;
  field.maxDepth = maxDepth;
  field.nDepths = depths.length;
  field.nAngles = nAngles;
  return field;
}

/**
 * Analytic fallback / baseline force profile.
 *
 * Used for the UNGOVERNED branch of the A/B comparison, where by definition
 * there is no solver output because the whole point is that the operator never
 * ran the twin. Same physics the backend uses, reduced to its closed form:
 *
 *   F(x) = buoyant rod weight above x  -  accumulated Couette drag above x
 *
 *   beta   = 2*pi*eps_f*mu_m / ln(r_t/r_r)      [N.s/m per metre of rod]
 *   F_drag = integral of beta * v_rod  dx
 *
 * with eps_f = 1.25 (eccentricity multiplier) per the project dossier. Drag is
 * signed against motion: it RESISTS the rod, so on the downstroke it acts
 * upward and eats into the available buoyant weight. That is rod float.
 */
export function makeAnalyticForceField({ viscosityCp, spm, strokeM = 2.54, fluidDensity = 965 }) {
  const muPas = Math.max(0.001, (viscosityCp ?? 1000) / 1000);
  const rT = WELL.tubingIdMm / 2000; // m
  const epsF = 1.25;

  const field = (depthM, phaseDeg, velocityMps) => {
    const d = clamp(depthM, 0, WELL.totalDepthM);
    let weightN = 0;
    let dragCoeff = 0; // N.s/m accumulated above depth d
    for (const t of ROD_TAPERS) {
      const seg = Math.max(0, Math.min(d, t.base) - t.top);
      if (seg <= 0) continue;
      weightN += t.areaM2 * seg * (STEEL_RHO - fluidDensity) * 9.81;
      const rR = t.odMm / 2000;
      dragCoeff += ((2 * Math.PI * epsF * muPas) / Math.log(rT / rR)) * seg;
    }
    const v =
      velocityMps ??
      // fall back to the exact surface velocity law if the caller didn't supply one
      -Math.sin((phaseDeg * Math.PI) / 180) * ((strokeM / 2) * ((spm * 2 * Math.PI) / 60));
    // Drag opposes motion. v > 0 is the upstroke (rod moving up).
    const dragN = dragCoeff * v;
    return (weightN - dragN) / 1000; // kN
  };
  field.available = true;
  field.analytic = true;
  return field;
}

/* -------------------------------------------------------------------------- */
/* Calibrated axial force profile  F(depth, phase)                             */
/* -------------------------------------------------------------------------- */

/**
 * Cumulative buoyant rod weight BELOW a depth, in kN.
 * Tension at depth d has to carry everything hanging under it.
 */
export function weightBelowKn(depthM, fluidDensity = 965) {
  let n = 0;
  for (const t of ROD_TAPERS) {
    const seg = Math.max(0, t.base - Math.max(depthM, t.top));
    if (seg <= 0) continue;
    n += t.areaM2 * seg * (STEEL_RHO - fluidDensity) * 9.81;
  }
  return n / 1000;
}

/**
 * Cumulative annular Couette drag coefficient BELOW a depth, per Pa.s of
 * mixture viscosity:
 *
 *     beta(x) = 2 * pi * eps_f * mu_m / ln(r_t / r_r)      [N.s/m per metre]
 *
 * with the eccentricity multiplier eps_f = 1.25 from the project dossier.
 * Returned with mu factored out so a single scalar can be calibrated against
 * the solver instead of guessing an effective viscosity.
 */
export function dragShapeBelow(depthM) {
  const rT = WELL.tubingIdMm / 2000;
  let c = 0;
  for (const t of ROD_TAPERS) {
    const seg = Math.max(0, t.base - Math.max(depthM, t.top));
    if (seg <= 0) continue;
    const rR = t.odMm / 2000;
    c += ((2 * Math.PI * 1.25) / Math.log(rT / rR)) * seg;
  }
  return c; // N.s/m per Pa.s
}

/** Fluid load carried by the plunger on the upstroke, kN. */
export function fluidLoadKn(fluidDensity = 965) {
  const aP = (Math.PI / 4) * (WELL.plungerBoreMm / 1000) ** 2;
  return (fluidDensity * 9.81 * WELL.pumpSettingDepthM * aP) / 1000;
}

/**
 * Build F(depth, phase) for one branch of the A/B comparison.
 *
 * TWO-POINT BOUNDARY RECONSTRUCTION. The solver already publishes the axial
 * load at both ends of the string: the DOWNHOLE card is the load at the pump
 * (depth 1150 m) and the SURFACE card is the load at the polished rod
 * (depth 0). This function reconstructs the profile in between rather than
 * inventing one, by imposing the quasi-static force balance that connects them:
 *
 *     F(x, phi) = F_pump(phi)                    solver's downhole card
 *               + W_below(x)                     buoyant weight hanging below x
 *               + k . c_below(x) . v(phi)        annular Couette drag, SIGNED
 *
 * `v` is the exact four-bar polished rod velocity, positive up. On the upstroke
 * drag acts downward and ADDS to tension -- that is what sets PPRL. On the
 * downstroke it acts upward and SUBTRACTS. Where the subtraction exceeds the
 * buoyant weight of the tapers below, F goes negative and the string is in
 * compression. Rod float can only ever happen on the downstroke, and this term
 * is the reason.
 *
 * CALIBRATION -- TWO ANCHORS, TWO PARAMETERS.
 *
 * The solver publishes the axial load at both ends of the string, and it
 * computes them with DIFFERENT drag lengths:
 *
 *     surface   f_surf       = w_buoyant + f_fluid + total_beta_L * s_vel + inertia
 *     downhole  down_tension = w_bottom_sub + f_fluid - beta_lower * 200 * v_down
 *
 * The first integrates drag over the whole 1150 m string; the second uses a
 * 200 m effective length on the bottom taper only -- about half the drag the
 * full integral would give there. A single uniform drag coefficient therefore
 * cannot reproduce both ends, and forcing one anchor throws the other out by
 * 19% (PPRL) or 7x (deep tension). That is a property of the solver, not of
 * this reconstruction, and pretending otherwise would put numbers on the
 * drawing that contradict the rest of the console.
 *
 * So the reconstruction carries the same structure, with a drag weighting that
 * decays linearly with depth:
 *
 *     w(x) = 1 - (1 - lambda) * x / L        w(0) = 1
 *     F(x, phi) = F_pump(phi) + W_below(x) + k * c_below(x) * w(x) * v(phi)
 *
 * `k` is bisected at surface, where w = 1, against `pprl_kn`.
 * `lambda` is then bisected at 750 m against `min_tension_kn`.
 * The two are decoupled, so both anchors are hit exactly.
 *
 * Physically `lambda` is a drag-concentration factor: hot, mobile fluid near
 * the sandface shears less than the cooled fluid higher up the annulus.
 *
 * ONE UNFITTED CHECK SURVIVES, and it is the informative one:
 * `effectiveViscosityPas` is never shown the rheology engine's answer, yet it
 * lands within a stable +21% of the reported `viscosity_cp` across all three
 * scenarios (19,680 vs 16,233 / 14,269 vs 11,775 / 14,275 vs 11,775 cP). A
 * consistent offset across independent operating points is evidence the
 * surface-side reconstruction is structurally right; a scattered one would not
 * be. It is reported with its residual.
 *
 * VALIDITY. The drag term is linear in velocity, which holds while the string
 * is straight. Once F crosses zero the string buckles into wall contact and
 * picks up Coulomb friction the model does not carry, so negative values are a
 * correct indication of compression but not a quantitative one. Where F(0)
 * itself goes negative the polished rod has gone slack -- the documented
 * carrier-bar separation failure mode -- and the quasi-static balance no longer
 * describes the machine at all. `validityFloorKn` reports where that begins.
 *
 * @param pumpCardKn  144-bin downhole card (index 0 = bottom of stroke). Only
 *                    its non-negative part is pump load: the solver folds the
 *                    compressive tension into the card during float, so
 *                    max(card, 0) recovers the fluid load f_fluid exactly.
 * @param pprlKn      peak polished rod load reported by the solver
 * @param velocityAt  (phaseRad) => polished rod velocity in m/s, + = up
 */
export function makeCalibratedProfile({
  pumpCardKn,
  pprlKn,
  /** The solver's `min_tension_kn` — the deep anchor. */
  targetMinKn,
  /** Top of the bottom taper — where the solver defines `min_tension_kn`. */
  checkDepthM = 750,
  velocityAt,
  fluidDensity = 965,
  samples = 144,
  /**
   * Skip calibration and impose a viscosity solved elsewhere. Used for the
   * uncontrolled branch of the A/B: it is the same fluid in the same well, so
   * it MUST use the viscosity calibrated on the governed branch. Letting each
   * branch pick its own would let the comparison cheat.
   */
  fixedViscosityPas = null,
  /** Likewise for the drag-concentration factor. */
  fixedLambda = null,
}) {
  const card = Array.isArray(pumpCardKn) && pumpCardKn.length > 1 ? pumpCardKn : null;
  const W0 = weightBelowKn(0, fluidDensity);
  const Ctot = dragShapeBelow(0);

  /**
   * Fluid load at the pump, sampled continuously from the solver's card.
   * Negative card values are compressive TENSION readings the solver folds
   * into the card during float, not pump load, so they are clipped out.
   */
  const pumpLoad = (phaseRad) => {
    if (!card) {
      return velocityAt(phaseRad) > 0 ? fluidLoadKn(fluidDensity) : 0;
    }
    const n = card.length;
    const pos = ((((phaseRad / (Math.PI * 2)) % 1) + 1) % 1) * n;
    const i0 = Math.floor(pos) % n;
    const i1 = (i0 + 1) % n;
    const t = pos - Math.floor(pos);
    return Math.max(0, card[i0]) * (1 - t) + Math.max(0, card[i1]) * t;
  };

  const phases = [];
  for (let i = 0; i < samples; i += 1) phases.push((i / samples) * Math.PI * 2);

  /* ---- anchor 1: peak surface load, where the drag weighting is 1 -------- */
  const surfacePeak = (k) => {
    let m = -Infinity;
    for (const p of phases) {
      const f = pumpLoad(p) + W0 + (k * Ctot * velocityAt(p)) / 1000;
      if (f > m) m = f;
    }
    return m;
  };

  let k = 0;
  let calibrated = false;
  if (Number.isFinite(fixedViscosityPas)) {
    k = fixedViscosityPas;
    calibrated = true;
  } else if (Number.isFinite(pprlKn) && pprlKn > surfacePeak(0)) {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 80 && surfacePeak(hi) < pprlKn; i += 1) hi *= 2;
    for (let i = 0; i < 80; i += 1) {
      const mid = (lo + hi) / 2;
      if (surfacePeak(mid) < pprlKn) lo = mid;
      else hi = mid;
    }
    k = (lo + hi) / 2;
    calibrated = true;
  }

  /* ---- anchor 2: deep tension, via the drag-concentration factor -------- */
  const Wc = weightBelowKn(checkDepthM, fluidDensity);
  const Cc = dragShapeBelow(checkDepthM);
  // Clamped at zero: a negative drag weight would mean drag ADDING tension on
  // the downstroke, which is not a thing. lambda < 0 simply means the shear
  // contribution dies out before the pump -- a defensible reading of hot,
  // mobile fluid at the sandface.
  const wAt = (lam, d) => Math.max(0, 1 - (1 - lam) * (d / WELL.totalDepthM));
  const tensionAt = (lam) => {
    let m = Infinity;
    for (const p of phases) {
      const f = pumpLoad(p) + Wc + (k * Cc * wAt(lam, checkDepthM) * velocityAt(p)) / 1000;
      if (f < m) m = f;
    }
    return m;
  };

  let lambda = 1;
  let deepAnchored = false;
  if (Number.isFinite(fixedLambda)) {
    lambda = fixedLambda;
    deepAnchored = true;
  } else if (Number.isFinite(targetMinKn) && k > 0) {
    // tensionAt is monotonically DECREASING in lambda (more drag deep down).
    if (tensionAt(-1) >= targetMinKn && tensionAt(1) <= targetMinKn) {
      let lo = -1;
      let hi = 1;
      for (let i = 0; i < 80; i += 1) {
        const mid = (lo + hi) / 2;
        if (tensionAt(mid) > targetMinKn) lo = mid;
        else hi = mid;
      }
      lambda = (lo + hi) / 2;
      deepAnchored = true;
    }
  }

  const force = (depthM, phaseRad) => {
    const d = clamp(depthM, 0, WELL.totalDepthM);
    return (
      pumpLoad(phaseRad) +
      weightBelowKn(d, fluidDensity) +
      (k * dragShapeBelow(d) * wAt(lambda, d) * velocityAt(phaseRad)) / 1000
    );
  };

  /** Min / max of F over the whole stroke at a depth. The envelope band. */
  const envelope = (depthM) => {
    let mn = Infinity;
    let mx = -Infinity;
    for (const p of phases) {
      const f = force(depthM, p);
      if (f < mn) mn = f;
      if (f > mx) mx = f;
    }
    return [mn, mx];
  };

  // Global extrema over the whole (depth, phase) domain.
  let minKn = Infinity;
  let minDepthM = 0;
  let minPhaseRad = 0;
  let maxKn = -Infinity;
  for (let d = 0; d <= WELL.totalDepthM; d += 10) {
    for (const p of phases) {
      const f = force(d, p);
      if (f < minKn) {
        minKn = f;
        minDepthM = d;
        minPhaseRad = p;
      }
      if (f > maxKn) maxKn = f;
    }
  }

  return {
    force,
    envelope,
    /** Calibrated effective mixture viscosity, Pa.s. Surfaced in the UI. */
    effectiveViscosityPas: k,
    /** Drag-concentration factor. 1 = uniform along the string. */
    lambda,
    calibrated,
    deepAnchored,
    checkDepthM,
    fluidLoadKn: fluidLoadKn(fluidDensity),
    minKn,
    minDepthM,
    minPhaseRad,
    maxKn,
    /** Fitted: equals the solver's `pprl_kn` by construction. */
    impliedPprlKn: maxKn,
    /**
     * NOT fitted. Predicted minimum tension at the top of the bottom taper,
     * directly comparable with the solver's `min_tension_kn`.
     */
    predictedTaperTensionKn: tensionAt(lambda),
    /** Minimum polished rod load. Below zero the rod string has gone slack. */
    minSurfaceKn: (() => {
      let m = Infinity;
      for (const p of phases) {
        const f = pumpLoad(p) + W0 + (k * Ctot * velocityAt(p)) / 1000;
        if (f < m) m = f;
      }
      return m;
    })(),
  };
}

/**
 * Largest pump speed that still holds a tension floor at the check depth.
 *
 * This is the MPC's own anti-float constraint, solved directly. It is used
 * where the backend deliberately runs the governor disengaged (the baseline
 * failure scenario returns `effective_spm == target_spm`), so the comparison
 * has an advisory speed to show instead of two identical branches. The result
 * is labelled in the UI as constraint-derived rather than solver-issued.
 *
 * @param buildAt      (spm) => a profile built at that speed with FIXED
 *                     calibration constants
 * @param floorKn      tension floor, +0.50 kN
 * @param bounds       MPC actuator range [min_spm, max_spm]
 */
export function solveMaxSafeSpm(buildAt, floorKn = 0.5, bounds = [1.0, 5.5]) {
  const [loB, hiB] = bounds;
  const tensionAtSpm = (spm) => buildAt(spm).predictedTaperTensionKn;
  if (tensionAtSpm(hiB) >= floorKn) return { spm: hiB, limited: false };
  if (tensionAtSpm(loB) < floorKn) return { spm: loB, limited: true, infeasible: true };
  let lo = loB;
  let hi = hiB;
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2;
    if (tensionAtSpm(mid) >= floorKn) lo = mid;
    else hi = mid;
  }
  // Respect the MPC's 0.25 SPM quantisation so the number looks like a command.
  return { spm: Math.floor(lo / 0.05) * 0.05, limited: true };
}

/* -------------------------------------------------------------------------- */
/* Buckling                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Lubinski helical buckling geometry.
 *
 * Lubinski & Althouse, "Helical Buckling of Tubing Sealed in Packers",
 * JPT 14(6):655-670, 1962 (SPE 178-PA):
 *
 *     p = sqrt( 8 * pi^2 * E * I / F )
 *
 * The important and frequently-botched part: F sets the PITCH, not the
 * amplitude. The buckled member is a constant-radius helix riding the confining
 * wall, so the lateral amplitude is fixed at the radial clearance and only the
 * pitch tightens as compression grows. A tight corkscrew with growing amplitude
 * is the wrong picture.
 *
 * @param compressionKn  magnitude of axial COMPRESSION, kN (pass a positive number)
 * @param depthM         depth, to pick the taper and its clearance
 */
export function helicalBuckling(compressionKn, depthM) {
  const taper = taperAt(depthM);
  const dM = taper.odMm / 1000;
  const I = (Math.PI * dM ** 4) / 64; // m^4
  const F = Math.max(1, compressionKn * 1000); // N
  const pitchM = Math.sqrt((8 * Math.PI ** 2 * STEEL_E_PA * I) / F);
  return {
    pitchM,
    amplitudeMm: radialClearanceMm(depthM),
    turnsPerMetre: 1 / pitchM,
    /** Bending stress amplitude induced by the helix, MPa. sigma = E*r*d2y/dx2. */
    bendingStressMpa: ((STEEL_E_PA * (dM / 2) * 4 * Math.PI ** 2) / pitchM ** 2 / 1e6) * (radialClearanceMm(depthM) / 1000),
  };
}

/**
 * Illustrative alternating-stress fatigue model for the sucker rod body.
 *
 * This is NOT a certified API RP11L / modified-Goodman service-factor
 * calculation -- it is a deliberately simple, clearly-labelled proxy so the
 * drawing can show *that* severe cyclic buckling eventually parts a rod, not
 * a validated remaining-life prediction. `ENDURANCE_MPA` is a representative
 * alternating-stress limit for a Grade D sucker rod; `FATIGUE_CYCLES_TO_PART`
 * is chosen for legibility in a running demo, not fitted to any S-N curve.
 */
export const ENDURANCE_MPA = 50;
export const FATIGUE_CYCLES_TO_PART = 30;

/** Axial stress in the rod body at `depthM`, from an axial load in kN. */
export function axialStressMpa(forceKn, depthM) {
  const taper = taperAt(depthM);
  return (forceKn * 1000) / taper.areaM2 / 1e6;
}

/**
 * Walk the string from surface down and find the neutral point — the shallowest
 * depth at which axial force crosses from tension into compression. Everything
 * below it is buckling-eligible.
 *
 * @returns {{ neutralPointM: number|null, minForceKn: number, minForceDepthM: number,
 *             compressedLengthM: number }}
 */
export function analyseString(forceField, phaseDeg, velocityMps, step = 10) {
  let neutralPointM = null;
  let minForceKn = Infinity;
  let minForceDepthM = 0;
  let compressedLengthM = 0;

  for (let d = 0; d <= WELL.totalDepthM; d += step) {
    const f = forceField(d, phaseDeg, velocityMps);
    if (!Number.isFinite(f)) continue;
    if (f < minForceKn) {
      minForceKn = f;
      minForceDepthM = d;
    }
    if (f < 0) {
      compressedLengthM += step;
      if (neutralPointM === null) neutralPointM = d;
    }
  }
  return {
    neutralPointM,
    minForceKn: Number.isFinite(minForceKn) ? minForceKn : NaN,
    minForceDepthM,
    compressedLengthM,
  };
}

/* -------------------------------------------------------------------------- */
/* Downhole pump                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Pump state for a given surface state.
 *
 * The plunger does NOT follow the polished rod. Two effects separate them, and
 * both are visible in the animation:
 *
 *  1. ELASTIC LAG. The rod string is a 1150 m spring. Load transfer at each
 *     stroke reversal stretches or relaxes it before the plunger moves at all,
 *     so plunger travel is less than surface travel and lags it in phase. The
 *     acoustic transit time is L/c = 1150/5135 = 0.224 s -- at 4.7 SPM that is
 *     6.3 degrees of crank rotation, which is why valve action is late.
 *
 *  2. VISCOUS RETARDATION (the failure mode). On the downstroke the plunger has
 *     to fall through the fluid. If Couette drag exceeds the buoyant weight
 *     available to push it down, the plunger cannot keep up with the carrier
 *     bar, the rods below the neutral point go into compression, and the
 *     traveling valve opens late or not at all.
 *
 * VALVE PHASING is the textbook rule, and the old schematic had it backwards:
 *     UPSTROKE   -> traveling valve CLOSED, standing valve OPEN   (fluid load
 *                   on the rods, formation fluid drawn into the barrel)
 *     DOWNSTROKE -> traveling valve OPEN,   standing valve CLOSED (fluid
 *                   transfers through the plunger, rods carry weight only)
 * Valve events lag the dead centres because the barrel pressure has to cross
 * the hydrostatic head above the valve first.
 */
export function pumpState(surface, { floatSeverity = 0, fillage = 1 } = {}) {
  const acousticLagDeg = 6.3; // L/c at 4.7 SPM
  const sev = clamp(floatSeverity, 0, 1);

  // Travel efficiency: elastic losses plus the float penalty.
  const travelRatio = clamp(0.93 - 0.55 * sev, 0.12, 1);
  // Float delays the plunger further on the downstroke specifically.
  const lagDeg = acousticLagDeg + 42 * sev;

  const laggedPhase = (((surface.phaseDeg - lagDeg) % 360) + 360) % 360;
  const laggedRad = (laggedPhase * Math.PI) / 180;

  // Plunger position within the barrel, 0 = bottom of its travel. Uses the same
  // exact four-bar law as the surface, shifted in phase -- not a sine.
  const plungerFraction = surfaceState(laggedRad, 1, surface.strokeM).fraction;
  const plungerTravelM = plungerFraction * surface.strokeM * travelRatio;

  const rising = surface.velocityMps > 0;

  // Valve events, lagged. The TV cannot open until the plunger is genuinely
  // descending; under heavy float that never fully happens.
  const tvOpen = !rising && sev < 0.92 && laggedPhase > 184;
  const svOpen = rising && laggedPhase < 184 + acousticLagDeg && fillage > 0.05;

  return {
    plungerFraction,
    plungerTravelM,
    travelRatio,
    lagDeg,
    tvOpen,
    svOpen,
    /** Fluid is being displaced up the tubing only while the TV is shut and rising. */
    lifting: rising && !tvOpen,
    /** Effective volumetric displacement this stroke, m^3. */
    displacementM3: (Math.PI / 4) * (WELL.plungerBoreMm / 1000) ** 2 * surface.strokeM * travelRatio * fillage,
    fillage,
    floatSeverity: sev,
  };
}

/* -------------------------------------------------------------------------- */

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Linear interpolate. */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}
