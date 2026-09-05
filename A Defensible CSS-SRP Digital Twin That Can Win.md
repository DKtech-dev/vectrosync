# A Defensible CSS-SRP Digital Twin That Can Win

## Executive Summary

- **Core Verdict**: The architecture has a strong integration thesis, but several headline claims are currently indefensible. Commercial systems already perform predictive diagnostics and autonomous SPM or VSD control, while SRP digital-twin prior art also exists [executive_summary[0]] [10][executive_summary[1]] [26][executive_summary[2]] [30]. -> Claim novelty only for the publicly unreported intersection of calibrated CSS thermal forecasting, temperature-dependent rod mechanics, and uncertainty-aware control.
- **Field Grounding**: OIL publicly describes Baghewala's Jodhpur Sandstone at an average depth of about 1,150 m, oil viscosity of 10,000-13,000 cP at 50 deg C, CSS use, and SRP lifting [executive_summary[3]] [11]. It also reports 35 wells drilled, 23 producing, and more than 600 bbl/d total production [executive_summary[3]] [11]. -> Replace every conflicting number in the pitch with an explicitly labeled field fact or team assumption.
- **Thermal Model Correction**: Safari et al.'s reported 42% late-time overestimate came from one synthetic two-dimensional finite-element comparison, not a universal Boberg-Lantz bias or a CMG STARS/ECLIPSE benchmark [executive_summary[4]] [13]. -> Use field-calibrated temperature-rise scaling with uncertainty, not a hard-coded 0.58 subtraction.
- **Mechanics Correction**: A linear Gibbs wave model can estimate tension while rods remain tensile, but it cannot represent post-buckling contact after computed tension becomes negative. Modern three-dimensional work specifically identifies the uniform one-dimensional model's limitations for tapered strings, guides, deviation, and contact. -> Make predicted compression a control-envelope violation and switch to a conservative safe state before buckling.
- **Control Correction**: The proposed fixed damping range is dimensionally and physically weak. Viscosity must first produce distributed drag with units, then `nu = beta/(rho_r A)` in `1/s`; gas, water, eccentricity, taper, and wear must enter the estimator. -> Enforce robust constraints on force distributions, not a single deterministic trajectory.
- **Open-Source Correction**: BYU-PRISM USTAR contains relevant MPC and MHE rod-pump code, but its repository exposes no license [executive_summary[5]] [28]. -> Cite the paper and repository as prior art, but clean-room implement the equations; do not copy USTAR code or call it open source.
- **Winning Demo**: The strongest finale demonstration is an offline A/B experiment in which identical disturbances drive a card-only baseline and the coupled controller. Every trace must carry `[measured]`, `[model]`, `[synthetic]`, or `[calibrated]` provenance, and the advertised 12-hour warning must be labeled a scenario result until field validation exists.
- **Business-Case Discipline**: INR 1.75-2.80 Cr can be reproduced as a transparent scenario, but it is not yet a forecast. OIL's public page supports 23 currently producing wells rather than an unqualified 30-well producing fleet [executive_summary[3]] [11]. -> Present the 30-well case as a planning scope, disclose every cost and savings assumption, and show realized savings only after a controlled pilot.
- **Competition Strategy**: SIH's published evaluation categories emphasize innovation, technical soundness and feasibility, functionality and relevance, final-demo performance, and presentation, without published numerical weights [executive_summary[6]] [35]. -> Spend most of the eight minutes on a repeatable live test, safety behavior, and evidence rather than novelty superlatives.

## 1. Adversarial Ground-Truth Audit

The proposal's problem mechanism is plausible but overconfident. OIL's own material supports CSS and SRP at Baghewala and gives the public field anchors above [1_adversarial_ground_truth_audit[0]] [11]. It also says conventional and hydraulic SRP systems, thermal wellheads, and vacuum-insulated tubing are used [1_adversarial_ground_truth_audit[0]] [11]. Those facts make a coupled thermal-lift prototype relevant. They do not prove that viscosity alone causes every rod part, that every producing well has the same completion, or that annual failures cost the stated INR 90 lakh-1.5 Cr.

The proposed causal chain must therefore be treated as a hypothesis:

`steam history -> near-wellbore thermal state -> local rheology and multiphase state -> pump fillage and distributed drag -> rod-load envelope -> intervention`

Each arrow needs a measurable validation variable. Temperature may be inferred from injection history, but casing pressure, tubing pressure, fluid level, water cut, gas fraction, polished-rod load and position, motor current, SPM, and well configuration are also required. Without them, cooling becomes a convenient explanation for any card change.

A second problem is sign language. Negative calculated axial force indicates that the tension-only operating assumption has failed. It does not mean the one-dimensional string solution remains quantitatively valid deep into compression. Field failure guidance associates axial compression with buckling and identifies fluid pound, sticking, insufficient sinker-bar weight, and buckling as causes of aggressive contact and fatigue. Corrosion also remains a major competing failure mechanism. A jury member will correctly reject a claim that thermal drag is the sole cause unless failed rods, corrosion morphology, completion tallies, and workover reports support it.

### Go/no-go framing

| Statement | Audit result | Defensible replacement |
|---|---|---|
| "Cooling causes Baghewala rod failures" | Unverified causal assertion | "Cooling-induced rheology is one testable contributor to loss of downstroke tension." |
| "All commercial tools react after dynacard failure" | False | "Public products already predict faults and control speed, but we found no public disclosure of this exact CSS-thermal coupling." |
| "Gibbs forecasts buckling and impact" | False beyond tensile regime | "Gibbs forecasts approach to a compression boundary; the controller avoids entering it." |
| "42% correction is exact" | False | "42% is one published case result and supplies, at most, one calibration anchor." |
| "The prototype is 100% zero-cost" | True only for software licenses | "The laptop demo has zero license and cloud cost; field instrumentation, certification, integration, and maintenance are not free." |
| "First digital twin for SRP" | False | "A differentiated, auditable integration for CSS-SRP coordination." |

**Decision-ready insight:** Keep the problem, but replace certainty with a falsifiable hypothesis and a validation plan. That honesty strengthens technical soundness rather than weakening the pitch.

## 2. Commercial and Patent Prior-Art Teardown

The requested "exact triggers" generally are not publicly disclosed. Marketing pages describe signal families, fault classes, and control actions, not proprietary threshold values, state equations, control horizons, or safety interlocks. Inventing those details would be worse than admitting they are unavailable.

| Platform | Publicly documented diagnostics and action | What the proposal gets wrong | Publicly visible gap relevant here |
|---|---|---|---|
| ChampionX XSPOC and SMARTEN | Physics-based diagnostics plus AI identify issues and recommend remediation; SMARTEN makes real-time remote adjustments as downhole conditions change [2_commercial_and_patent_prior_art_teardown[0]] [10]. Custom alarms and KPIs are supported [2_commercial_and_patent_prior_art_teardown[0]] [10]. XSPOC also ingests production, temperature, load, and shutdown information for wellsite optimization [2_commercial_and_patent_prior_art_teardown[1]] [7]. | It is not merely a passive dynacard viewer. | No public equation or product claim found that propagates a CSS thermal-decay state into forward SRP downstroke tension. Exact alarm thresholds are undisclosed. |
| Weatherford ForeSite | A published 16-well rod-lift pilot used high-frequency edge data, pattern matching, and models to adjust VSD limits autonomously. A vibration control logic changed speed to reduce rod-part and surface-failure risk. | Calling it purely reactive is false. | The public case does not disclose a Boberg-Lantz-type reservoir state, viscosity coupling, numerical trigger thresholds, or control horizon. |
| SLB Lift IQ | Continuous surveillance supports high-viscosity wells; engineers monitor alarms, use motor temperature and flow information, diagnose events, and recommend action within minutes. SLB describes real-time analytics and optimization. | It is broader than card-only surveillance. | Public material reviewed does not disclose autonomous CSS-to-SRP control equations or rod-downstroke force constraints. |
| Baker Hughes Leucipa | Predictive analytics and diagnostics use torque, pressure, flow, reservoir, and well data to provide surveillance-by-exception and recommendations. | "Reactive dynacard approach" does not describe this platform accurately. | Exact triggers, forecast horizons, control authority, and a CSS thermal-to-rod model are not publicly stated. |
| Ambyint InfinityRL | Public fault classes include rod part, worn pump, fluid pound, and gas interference; the platform autonomously recommends or changes SPM and idle settings [2_commercial_and_patent_prior_art_teardown[2]] [26]. Ambyint also reports change-in-condition alerts weeks or months early and rod-part alerts one or two days early [2_commercial_and_patent_prior_art_teardown[3]] [8]. | It directly defeats the assertion that autonomous and anticipatory rod-pump optimization does not exist. | Its public material does not expose a CSS heat-transfer model or uncertainty-tightened downstroke-tension constraint. |

Representative patents also occupy much of the generic control territory: published records cover flow-based pump displacement control, continuous position control, VSD cycle-speed or load calculation, and operation from computed downhole dynacards [2_commercial_and_patent_prior_art_teardown[4]] [38]. Therefore, claims such as "using a downhole card to adjust speed," "predicting rod load," or "optimizing SPM" are poor novelty claims.

### Why a card-only controller can still fail in CSS

A card is an observation of an already evolved mechanical state. If a controller has no thermal or fluid-state forecast, it may discover rising drag only after card shape, motor load, or fillage changes. Yet this is not proof that every named commercial system lacks predictive exogenous features. The defensible argument is narrower: an explicitly calibrated CSS state can extend the useful forecast horizon and distinguish thermal deterioration from gas interference, water-cut change, sand wear, or sensor faults.

### The only legally defensible novelty statement

> To our knowledge, based on a documented review of public vendor literature, peer-reviewed publications, and representative patent records available through September 1, 2026, prior art exists for every component separately, including CSS heat models, SRP wave-equation cards, SRP digital twins, predictive diagnostics, and autonomous speed control. We did not identify a public implementation that closes the loop from a calibrated CSS thermal-state forecast, through temperature-dependent multiphase and tapered-rod mechanics, to uncertainty-tightened SRP speed commands. Our claimed contribution is this auditable integration and its Baghewala-specific validation workflow, not the novelty of Boberg-Lantz, Gibbs, MPC, Bayesian optimization, CNNs, dynacards, or rod-pump control.

Add verbally: "This is a research-positioning statement, not a patentability or freedom-to-operate opinion." No finite public search can establish that no undisclosed commercial implementation or patent claim exists.

**Decision-ready insight:** The proposal survives prior art only as a narrow systems-integration claim. Presenting anything broader invites an immediate and justified jury teardown.

## 3. Academic State of the Art, 2018-2026

The literature also prevents a broad "first" claim.

| Work | What it contributes | What it does not establish |
|---|---|---|
| Hansen et al., 2018, with BYU-PRISM USTAR | Simulation-oriented MHE, PI, and MPC concepts for artificial-lift control are represented in the associated repository [3_academic_state_of_the_art_2018_2026[0]] [28]. | No public repository license is exposed, and it does not establish the proposed CSS thermal coupling. |
| Safari et al., 2020 | Compares CSS analytical temperature models with a two-dimensional finite-element model and reports late-time analytical overprediction in its synthetic case [3_academic_state_of_the_art_2018_2026[1]] [13]. | It is not a published full-field 3D CMG STARS/ECLIPSE validation and not a closed-loop rod-pump controller. |
| Cheng et al., 2020 | Uses an AlexNet-SVM pipeline on 8,000 labeled cards across eight operating classes, with a random 80/20 split and reported 99.5% performance. | It is not simply a lightweight 2D CNN, does not forecast thermal state, and its random card split may overstate transfer to unseen wells or future time periods. |
| Teodoriu et al., 2021 | Proposes an SRP digital-twin concept with physical replica, rod and well-fluid models, sensors, analytics, and failure prediction [3_academic_state_of_the_art_2018_2026[2]] [30]. | The work is described as early-stage and does not provide the full validated CSS-to-control chain [3_academic_state_of_the_art_2018_2026[2]] [30]. |
| Eisner and Langbauer, 2021 | Develops a dynamic 3D finite-element rod-string model with contact, friction, stress, and motion; validates the model against measurements [3_academic_state_of_the_art_2018_2026[3]] [33]. | It is computationally heavier than the desired edge controller, but it exposes what a uniform Gibbs model omits. |

Cheng's study is useful for a post-facto visual classifier, especially because its classes include fluid pound, gas interference, insufficient supply, sand production, and valve or stroke abnormalities. The model must not sit in the safety loop. Rebuild the evaluation using grouped splits by well and chronological holdout, report calibration and confusion matrices, and include an "unknown" or out-of-distribution state. A model trained on synthetic images should never be represented as field-validated.

Teodoriu's paper makes the term "SRP digital twin" prior art. Eisner and Langbauer make a valuable architectural point: use a fast reduced one-dimensional model for estimation and control, but use a slower 3D or high-fidelity offline model to generate envelopes, discrepancy bounds, and adversarial cases. That is multi-fidelity modeling, not pretending the reduced model is exact.

No reviewed publication established the complete claimed loop with field evidence. That supports the narrow novelty statement, but it does not prove global absence. Search scope, databases, query strings, dates, and exclusions should be placed in an appendix so the jury can inspect the process.

**Decision-ready insight:** The strongest academic positioning is "multi-fidelity, uncertainty-aware integration," while the strongest credibility move is to cite and delimit every reused component explicitly.

## 4. Boberg-Lantz Mathematics: Correct Limit, Correct Bias Treatment

Let `tau = t - ti >= 0`, reservoir temperature be `TR`, effective steam temperature be `Ts`, heated radius be `rh`, thermal diffusivity be `alpha`, and heated thickness be `h`. Safari's reproduced structure is [4_boberg_lantz_mathematics_correct_limit_correct_bias_treatment[0]] [27]:

```text
Tavg(t) = TR + (Ts - TR) * [vbar_r(t) * vbar_z(t) * (1 - delta(t)) - delta(t)]

vbar_r(b2) = 2 * integral_0^infinity exp(-b2*y^2) * J1(y)^2 / y dy
b2 = alpha * tau / rh^2

vbar_z(w) = erf(h/sqrt(w))
              + sqrt(w)/(h*sqrt(pi)) * [exp(-h^2/w) - 1]
w = 4 * alpha * tau
```

### Dimensional and numerical audit

`b2` is dimensionless because `alpha*tau` and `rh^2` both have units of area. `w` has units of area, so both `h/sqrt(w)` and `sqrt(w)/h` are dimensionless. Any transcription using `h*sqrt(w)` inside `erf`, or multiplying the Bessel integrand by `y` rather than dividing by `y`, is dimensionally or asymptotically suspect.

The source model also relies on restrictive assumptions, and Safari states that the analytical formulations are not valid outside their prescribed temperature interval [4_boberg_lantz_mathematics_correct_limit_correct_bias_treatment[1]] [13]. Do not apply the equation during active injection, phase-change-dominated transients, or after the heated-zone abstraction has collapsed without stating the approximation.

### Exact start-time limit

As `tau -> 0+`, `b2 -> 0` and `w -> 0`. The standard Bessel identity is

```text
integral_0^infinity J1(y)^2 / y dy = 1/2.
```

Therefore,

```text
lim_(b2->0+) vbar_r = 2 * (1/2) = 1.
```

For the vertical term set `z = h/sqrt(w)`. Then `z -> infinity`, `erf(z) -> 1`, `exp(-z^2) -> 0`, and

```text
vbar_z = 1 - sqrt(w)/(h*sqrt(pi)) + exponentially small terms,
lim_(w->0+) vbar_z = 1.
```

Consequently,

```text
lim_(t->ti+) Tavg
 = TR + (Ts - TR) * [(1 - delta_i) - delta_i]
 = TR + (Ts - TR) * (1 - 2*delta_i),
```

where `delta_i = lim delta(t)`. The model starts at `Ts` only if `delta_i = 0`. That is an important initialization test, not a coding detail.

Use the exact branch:

```python
if tau <= tau_eps:
    vr, vz = 1.0, 1.0
else:
    b2 = alpha * tau / rh**2
    w = 4.0 * alpha * tau
    vr = radial_quadrature(b2)
    z = h / np.sqrt(w)
    vz = erf(z) + np.sqrt(w)/(h*np.sqrt(np.pi)) * (np.exp(-z*z) - 1.0)
```

For small positive `w`, use `expm1(-h*h/w)` instead of `exp(...) - 1` to avoid cancellation. Cache `vbar_r` on a monotone `b2` grid and interpolate; do not integrate to infinity every control step.

### The Bentsen-Donohue subscript trap

Safari's surrounding prose says the Bentsen-Donohue approximation replaces the radial factor, while the printed left-side label appears as `vbar_z` [4_boberg_lantz_mathematics_correct_limit_correct_bias_treatment[0]] [27]. That inconsistency should be treated as a typographical hazard. The approximation depends on radial dimensionless time `b2`; therefore it belongs to `vbar_r`, not the vertical slab factor `vbar_z(w,h)`. Do not use a pasted series until its powers, signs, and regime switch have been checked against the typeset article. In production code, the safer reference is direct quadrature of the Bessel integral, with the analytical limit at zero and unit tests against a high-accuracy lookup table.

### The 42% claim and the only valid correction

Safari's 42% result is a case-specific late-time comparison near 300 days [4_boberg_lantz_mathematics_correct_limit_correct_bias_treatment[1]] [13]. If and only if its meaning is

```text
DeltaT_BL = 1.42 * DeltaT_ref,
DeltaT = T - TR,
```

then the corresponding one-point correction is

```text
Tcal(300 d) = TR + [TBL(300 d) - TR] / 1.42,
              = TR + 0.70422535 * [TBL(300 d) - TR].
```

Never divide a Celsius temperature by 1.42. Never use `Tcal = 0.58*TBL`. The percentage applies to the stated comparison quantity, and calibration should operate on temperature rise in kelvin or deg C, which has the same increment.

With reference observations `Tref_j`, estimate a constrained rise multiplier:

```text
x_j = TBL_j - TR
z_j = Tref_j - TR

k_hat = clip[0,1]( sum_j q_j*x_j*z_j / sum_j q_j*x_j^2 )
Tcal(t) = TR + k_hat * [TBL(t) - TR].
```

Prefer a slowly varying `k(t)` estimated by weighted regularized least squares, and propagate residual variance. One data point at 300 days cannot identify a unique time-varying correction.

**Decision-ready insight:** Implement the singular limit exactly, treat the equation-label inconsistency as a source hazard, and turn the 42% number into a calibration observation rather than a universal constant.

## 5. Gibbs Solver: Discretization, Boundaries, and Failure Envelope

For a uniform tensile rod, write

```text
u_tt = c^2*u_xx - nu*u_t + g,
c = sqrt(E/rho_r),
```

where `nu` must have units `1/s`. With `lambda = c*dt/dx`, centered differences give

```text
(1 + nu*dt/2) * u_i^(n+1)
 = 2*u_i^n - (1 - nu*dt/2)*u_i^(n-1)
   + lambda^2*(u_(i+1)^n - 2*u_i^n + u_(i-1)^n)
   + g*dt^2.
```

For the undamped scheme the CFL requirement is

```text
lambda = c*dt/dx <= 1.
```

Damping does not permit violating the wave CFL condition. With `E = 200 GPa` and `rho_r = 7,850 kg/m3`, `c` is approximately 5,048 m/s. A 10 m cell therefore requires `dt <= 1.98 ms`. The 144 dynacard points are output samples, not valid PDE time steps. Internally subcycle at the CFL-safe step, then phase-resample to 144 points.

### Surface-to-downhole inverse transformation

At the polished rod, after unit, buoyancy, carrier-bar, and transducer corrections:

```text
u(0,t) = s_surface(t)
N(0,t) = E*A*u_x(0,t) = F_surface(t).
```

A second-order spatial start is

```text
u_1^n = u_0^n + dx*F_0^n/(E*A)
        + dx^2/(2*c^2) * [u_tt(0,n) + nu*u_t(0,n) - g].
```

Then march downward:

```text
u_(i+1)^n = 2*u_i^n - u_(i-1)^n
            + dx^2/c^2 * [Dtt*u_i^n + nu*Dt*u_i^n - g].
```

This Cauchy continuation amplifies high-frequency load and position noise. CFL is not a cure because the inverse problem itself is ill-conditioned. Before marching, synchronize channels, remove drift, fit a periodic cubic or Fourier representation, enforce cycle closure, and regularize derivatives. A better prototype uses MHE to estimate the downhole state and damping with measurement covariance, rather than presenting a raw inverse card as ground truth.

### Forward forecasting boundaries

For forward simulation, prescribe only the commanded top kinematics:

```text
u(0,t) = s_cmd(t).
```

At the plunger, impose a dynamic force balance with a declared sign convention:

```text
N(L,t) = E*A*u_x(L,t)
       = A_p*(p_discharge - p_intake)
         + F_valve + F_plunger_friction + m_p*u_tt(L,t).
```

Gas compression, valve states, pump fillage, leakage, and fluid pound determine the bottom load. Do not prescribe both downhole displacement and downhole force in the same forward problem. Measured downhole displacement, if available, is a validation channel.

### Tapers require the conservative equation

For changing area and thermal strain:

```text
rho_r*A(x)*u_tt + beta(x,t)*u_t
 - d/dx { E*A(x)*[u_x - alpha_s*DeltaT_rod] }
 = rho_r*A(x)*g + f_contact.
```

At every taper interface enforce

```text
u_left = u_right,
N_left = N_right.
```

Approximate solid areas are `5.067e-4 m2` for 1 in, `3.879e-4 m2` for 7/8 in, and `2.850e-4 m2` for 3/4 in. Impedance changes create wave reflections; averaging the diameters destroys those effects. Load actual section order, grade, length, sinker bars, couplings, guides, and pump depth from the well tally. Eisner and Langbauer's work is the appropriate warning that uniform one-dimensional elements omit taper and contact physics.

**Decision-ready insight:** Use Gibbs as a fast estimator inside its tensile validity envelope, a conservative variable-area model for the prototype, and an offline high-fidelity model to quantify discrepancy near compression.

## 6. Hidden Physics and Superior Mitigations

### Viscosity is not a damping coefficient

For two viscosity measurements in kelvin,

```text
B = [ln(mu1) - ln(mu2)] / [1/T1 - 1/T2]
A_mu = ln(mu1) - B/T1
mu(T) = exp(A_mu + B/T).
```

This two-point model is interpolation, not a complete rheology. It must be bounded to the tested temperature interval and replaced by lab PVT or a multi-point correlation when available. Heavy oil may be shear-dependent or emulsion-sensitive.

For ideal concentric axial Couette flow, one starting approximation for drag per unit rod length is

```text
f_drag = -beta*v_rel,
beta = 2*pi*mu / ln(r_tubing/r_rod),
nu = beta/(rho_r*A_rod).
```

Now `nu` has units `1/s`. Couplings, eccentricity, temperature gradients, non-Newtonian behavior, gas, and water make the ideal expression only a prior. Estimate a bounded correction factor with MHE. An unexplained clip to `[0.002, 0.20]` is not defensible.

### Multiphase, taper, and sand state model

| Blind spot | Mathematical failure | Minimum prototype state and mitigation | Control consequence |
|---|---|---|---|
| Water-cut change | Changes density, viscosity, hydrostatic pressure, and heat capacity; may reduce oil viscosity effect while increasing hydraulic load. | Estimate liquid mixture properties from measured water cut: `rho_l = alpha_o*rho_o + alpha_w*rho_w`; update thermal and pump-load terms. | Tighten force uncertainty when water cut is stale. |
| Gas breakout | Gas holdup and compressibility alter pump fillage, intake pressure, valve timing, and card shape. | Use casing/tubing pressure and fluid level; add a drift-flux or bounded gas-holdup state and gas spring in the plunger boundary. | Distinguish gas interference from thermal drag before slowing the unit. |
| Fluid pound | Bottom-load discontinuity is phase-dependent, not linear viscous damping. | Implement a fillage fraction and traveling-valve transition; inject pound by truncating fillage during part of the upstroke. | Reduce acceleration or SPM, then verify fillage recovery. |
| Tapered rods | Uniform `EA` and impedance misplace waves and stress. | Conservative variable-area finite differences with interface continuity and per-section material data. | Constrain force and stress per section, not only at the pump. |
| Sand ingress | Abrasion enlarges plunger clearance, increases leakage, sticks valves, and can mimic poor fillage. | Add sand concentration and wear state `dc/dt = k_w*C_s*abs(v_rel)^m`; infer rising leakage from volumetric efficiency. | Raise maintenance alert; speed control cannot repair worn hardware. |
| Eccentric contact | Compression or deviation creates nonlinear friction and buckling. | Treat predicted compression as an invalid-model boundary; offline FEM sets conservative discrepancy margins. | Independent trip or ramp-down before zero tension. |
| Corrosion/fatigue | A mechanically acceptable card can coexist with material damage. | Integrate workover history, corrosion inspection, stress range, and Miner-type fatigue proxy. | Do not attribute all rod parts to cooling. |

Sand-tolerant commercial pump designs use protected sealing edges, larger clearances, or pathways intended to reduce abrasion and pass particulates [6_hidden_physics_and_superior_mitigations[0]] [32]. This confirms that sand is a hardware and maintenance problem as well as an analytics problem.

### Robust fast-loop formulation

Let reduced state `x` include modal rod coordinates, thermal state, damping correction, fillage, gas fraction, wear proxy, and bias terms. Let control `a` parameterize SPM, dwell, and acceleration-limited stroke profile. Solve

```text
min sum_k [w_q*(q_target-q_k)^2 + w_E*P_k + w_du*(a_k-a_(k-1))^2
           + w_s*(sF_k^2+sP_k^2)]

subject to:
x_(k+1) = f_ROM(x_k,a_k,d_k)
E[Fmin_k] - z_p*sigma(Fmin_k) + sF_k >= 0.5 kN
E[Fpeak_k] + z_p*sigma(Fpeak_k) - sP_k <= 0.90*F_rating
SPM_min <= SPM_k <= SPM_max
abs(delta_SPM) <= ramp_limit
motor torque, speed, and acceleration limits.
```

Optimization slacks keep the numerical problem feasible, but an independent safety layer must never soften hardware limits. The `0.5 kN` and `90%` numbers are design hypotheses until OIL supplies rod grade, load rating, uncertainty tolerance, and operating procedure.

The slow Bayesian optimizer should not autonomously change seven CSS variables in real time. One CSS outcome arrives over weeks, so seven-dimensional learning is sparse and safety-critical. Use constrained Bayesian optimization offline, with a Matérn-5/2 GP, prior engineering bounds, oil/steam ratio and risk objectives, and operator approval between cycles.

**Decision-ready insight:** The superior design estimates several competing fluid and equipment states, controls the probability of a force violation, and sends sand, corrosion, and post-buckling behavior to maintenance or safety logic rather than hiding them inside damping.

## 7. License-Safe, Zero-Fee Prototype Stack

"Zero-cost" means no software-license or cloud bill for the finale laptop. It does not mean zero field-deployment cost.

| Layer | Recommended project | License evidence and use |
|---|---|---|
| Rod solver | New clean-room Python/NumPy/SciPy implementation | Do not copy USTAR. Its useful MHE/MPC code is publicly readable, but no license is exposed [7_license_safe_zero_fee_prototype_stack[0]] [28]. |
| Numerical routines | SciPy | BSD-3-Clause [7_license_safe_zero_fee_prototype_stack[1]] [16]. Use integration, interpolation, sparse matrices, and signal processing. |
| Fast MPC modeling | CasADi | LGPL-3.0 [7_license_safe_zero_fee_prototype_stack[2]] [20]. Use for nonlinear derivatives and a reduced model. Keep license notices and dynamic-linking obligations in release documentation. |
| Convex QP | OSQP | Apache-2.0 [7_license_safe_zero_fee_prototype_stack[3]] [23]. Use after linearization for deterministic local solves. |
| Bayesian optimization | BoTorch | MIT [7_license_safe_zero_fee_prototype_stack[4]] [17]. Run locally with PyTorch; no hosted service. |
| Card classifier | PyTorch | BSD-style license. Train a small CNN only for advisory fault classification. |
| UI | Streamlit | Apache-2.0 [7_license_safe_zero_fee_prototype_stack[5]] [18]. Fastest for a six-person finale build. |
| Optional API | FastAPI | MIT [7_license_safe_zero_fee_prototype_stack[6]] [22]. Use only if UI and engine need process isolation. |
| Schemas | Pydantic | MIT [7_license_safe_zero_fee_prototype_stack[7]] [14]. Validate adapters, configurations, and provenance. |
| Modbus simulator | pymodbus | BSD. Run a local server and client. |
| MQTT broker | Eclipse Mosquitto | EPL-2.0/EDL-1.0 dual licensing. Bundle installers and configuration offline. |

Recommended repository layout:

```text
css_srp_twin/
  pyproject.toml
  LICENSE                 # team-selected Apache-2.0 or MIT
  THIRD_PARTY_NOTICES.md
  configs/well_demo.yaml
  src/thermal.py
  src/rheology.py
  src/rod_conservative.py
  src/pump_boundary.py
  src/estimator.py
  src/mpc.py
  src/bo_offline.py
  src/simulator.py
  src/adapter.py
  src/provenance.py
  src/gateway.py
  app.py
  tests/test_limits.py
  tests/test_cfl.py
  tests/test_units.py
  tests/test_taper_interfaces.py
  tests/test_failsafe.py
  data/demo_seed_001.csv
```

Pin all dependency versions, cache wheels locally, ship a tested virtual environment or container, include every license notice, and start all processes with one script. Do not add GPL-incompatible copied code casually. Do not advertise USTAR as an open-source dependency.

**Decision-ready insight:** A clean-room solver removes the largest licensing vulnerability and gives the team a more defensible engineering story: equations are prior art, implementation and validation are theirs.

## 8. Coupled Synthetic Telemetry Generator

The generator must create a controlled experiment, not fake field evidence. Every generated record receives `[synthetic]`; parameters estimated against a reference become `[calibrated]`; model forecasts remain `[model]`.

### End-to-end algorithm

1. Generate an injection schedule: steam rate, quality, pressure, injection duration, soak duration, and production start.
2. Convert steam quality and losses into an effective `Ts`, effective heated radius `rh`, and uncertain initial thermal state. Do not claim this is a full steam simulator.
3. Evaluate corrected Boberg-Lantz temperature at each production time.
4. Map temperature to oil viscosity using the Kelvin Arrhenius fit.
5. Combine oil, water, and gas states into local fluid properties and distributed drag.
6. Generate an acceleration-limited polished-rod trajectory for chosen SPM.
7. Solve the variable-area rod PDE with the pump force boundary at a CFL-safe internal step.
8. Compute surface and downhole displacement-load pairs and phase-resample each cycle to 144 points.
9. Add measurement effects after solving the clean physics: correlated load noise, encoder drift, timestamp jitter, quantization, missing samples, and bias.
10. Inject anomalies through physical states, not by drawing arbitrary card shapes.

### Core implementation skeleton

```python
import numpy as np
from scipy.integrate import quad
from scipy.special import erf, j1

PI = np.pi

def radial_factor(b2: float) -> float:
    if b2 <= 1e-10:
        return 1.0
    f = lambda y: np.exp(-b2*y*y) * j1(y)**2 / y
    return 2.0 * quad(f, 0.0, np.inf, epsabs=1e-9, epsrel=1e-8)[0]

def vertical_factor(w: float, h: float) -> float:
    if w <= 1e-12*h*h:
        return 1.0
    z = h/np.sqrt(w)
    return erf(z) + np.sqrt(w)/(h*np.sqrt(PI))*np.expm1(-z*z)

def temperature_bl(t, ti, TR, Ts, alpha, rh, h, delta, k_rise=1.0):
    tau = max(0.0, t-ti)
    if tau == 0.0:
        vr = vz = 1.0
    else:
        vr = radial_factor(alpha*tau/rh**2)
        vz = vertical_factor(4.0*alpha*tau, h)
    raw = TR + (Ts-TR)*(vr*vz*(1.0-delta)-delta)
    return TR + k_rise*(raw-TR)

def arrhenius_fit(T1_K, mu1_Pas, T2_K, mu2_Pas):
    B = (np.log(mu1_Pas)-np.log(mu2_Pas))/(1.0/T1_K-1.0/T2_K)
    A = np.log(mu1_Pas)-B/T1_K
    return A, B

def oil_viscosity(T_K, A, B, Tmin, Tmax):
    Tc = np.clip(T_K, Tmin, Tmax)
    return np.exp(A+B/Tc)

def drag_beta(mu, rt, rr, eccentric_factor=1.0):
    return eccentric_factor*2.0*PI*mu/np.log(rt/rr)
```

The rod kernel should implement the conservative equation. At cell `i`, define `m_i = rho_r*A_i`, `b_i = beta_i`, and face stiffness `K_(i+1/2) = E*A_face/dx`. A centered update is

```text
D_i^n = [E*A_(i+1/2)*(u_(i+1)^n-u_i^n)/dx
         - E*A_(i-1/2)*(u_i^n-u_(i-1)^n)/dx] / dx + q_i^n

u_i^(n+1) = {2*m_i*u_i^n/dt^2
             - [m_i/dt^2-b_i/(2*dt)]*u_i^(n-1)
             + D_i^n}
             / [m_i/dt^2+b_i/(2*dt)].
```

Apply top displacement and bottom-force ghost cells each substep. Compute `dt = 0.8*min(dx_i/c_i)` and reject configurations that violate the check.

### Physically meaningful fault injection

```python
def apply_disturbance(state, cooling_mult=1.0, steam_quality=1.0,
                      water_cut=0.2, gas_fraction=0.0,
                      pound_start=None, wear_rate=0.0):
    state.alpha_eff *= cooling_mult
    state.Ts_eff = state.TR + steam_quality*(state.Ts_eff-state.TR)
    state.water_cut = water_cut
    state.gas_fraction = gas_fraction
    state.clearance += wear_rate*state.dt
    if pound_start is not None and state.phase >= pound_start:
        state.fillage = min(state.fillage, pound_start)
    return state

def corrupt_measurement(load_N, pos_m, t_s, rng):
    load = load_N + rng.normal(0.0, 0.005*np.ptp(load_N), load_N.size)
    drift = rng.normal(0.0, 2e-6)*t_s
    pos = pos_m + drift + rng.normal(0.0, 2e-4, pos_m.size)
    return load, pos
```

Use fixed random seeds and save both latent truth and noisy observations. The baseline and digital-twin branches must receive the same latent disturbances and noise seed. Otherwise the A/B comparison is theatrical rather than experimental.

**Decision-ready insight:** The synthetic generator wins only if it is reproducible, causal, and visibly separated from field evidence. A beautiful but hand-drawn fault card will lose trust instantly.

## 9. Universal Ingestion Without Dangerous Guessing

A genuinely arbitrary SCADA CSV cannot be interpreted safely. `Load` may mean lbf, klbf, N, kN, percent, or ADC counts. `Temp` may be casing, motor, tubing, or ambient temperature. The correct feature is therefore an assisted adapter: auto-detect likely mappings, display confidence and units, require confirmation for ambiguity, and inhibit control on unsafe data.

```python
import re
from typing import Literal
import numpy as np
import pandas as pd
from pydantic import BaseModel, Field

ALIASES = {
    "time": {"time", "timestamp", "datetime", "date_time", "ts"},
    "load": {"load", "polished_rod_load", "prl", "force", "rodload"},
    "position": {"position", "pos", "stroke", "displacement", "encoder"},
    "temperature": {"temperature", "temp", "well_temp", "tubing_temp"},
    "spm": {"spm", "strokes_per_minute", "speed", "pump_rate"},
}

def canon(s):
    return re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")

class Channel(BaseModel):
    source: str
    quantity: Literal["time", "load", "position", "temperature", "spm"]
    unit: str
    confidence: float = Field(ge=0.0, le=1.0)
    confirmed: bool = False

class AdapterReport(BaseModel):
    channels: list[Channel]
    warnings: list[str]
    control_valid: bool

UNIT_HINTS = {
    "load": {"n", "kn", "lbf", "klbf"},
    "position": {"m", "mm", "in", "ft"},
    "temperature": {"k", "c", "f"},
    "spm": {"spm"},
}

def candidates(columns):
    out = []
    for original in columns:
        c = canon(original)
        tokens = set(c.split("_"))
        for q, names in ALIASES.items():
            score = 1.0 if c in names else max(
                [len(tokens & set(n.split("_")))/max(1, len(set(n.split("_"))))
                 for n in names]
            )
            if score >= 0.5:
                out.append((score, original, q))
    return sorted(out, reverse=True)

def to_si(x, quantity, unit):
    u = unit.lower()
    a = np.asarray(x, dtype=float)
    if quantity == "load":
        return a*{"n":1.0, "kn":1000.0, "lbf":4.4482216153,
                  "klbf":4448.2216153}[u]
    if quantity == "position":
        return a*{"m":1.0, "mm":0.001, "in":0.0254, "ft":0.3048}[u]
    if quantity == "temperature":
        return a if u == "k" else a+273.15 if u == "c" else (a-32)*5/9+273.15
    if quantity == "spm":
        return a
    raise ValueError("unsupported quantity or unit")

def bounded_impute(series, max_gap=3):
    # For visualization and estimation only, never conceal long control gaps.
    return series.interpolate(limit=max_gap, limit_area="inside")
```

Required adapter workflow:

1. Detect delimiter, decimal style, encoding, and timestamp candidates.
2. Rank column mappings and parse unit hints from headers such as `load_klbf`.
3. Show a confirmation modal if unit or semantic confidence is below 0.95.
4. Convert to SI internally and preserve raw values unchanged.
5. Sort by time, reject duplicate or backward timestamps, and detect clock gaps.
6. Impute only short interior gaps for display or state estimation. Add an `imputed` bit per value.
7. Mark control invalid if load, position, time, or command age exceeds configured limits.
8. Produce an adapter report containing mappings, unit conversions, missingness, sample rate, range violations, and hash of the source file.

**Decision-ready insight:** The jury will trust a system that refuses an ambiguous `Load` column more than one that confidently converts the wrong unit and issues a dangerous command.

## 10. Dashboard, Provenance, and Offline Edge Gateway

### Winning screen layout

Use one Streamlit page at 1920 x 1080:

- Top strip: well ID, replay/live mode, controller state, data freshness, model version, minimum forecast tension, peak-load utilization, and provenance legend.
- Left column: disturbance controls for cooling multiplier, steam quality, water cut, gas fraction, sand/wear rate, sensor dropout, and fluid-pound onset. Include `Reset deterministic seed`.
- Center: synchronized baseline and coupled-controller dynacards, rod-force heat maps by depth and phase, and 12-hour thermal/viscosity/force forecast with uncertainty bands.
- Right column: current MPC command, active constraints, why the action changed, state-estimator residuals, and three-level failsafe status.
- Bottom: raw telemetry strip chart, event timeline, A/B metrics, and append-only provenance/audit table.

The 12-hour phrase must appear as `simulation forecast horizon: 12 h`, not `proven 12 h early warning`. The final demonstration should first replay the nominal case, then let a judge increase cooling or water cut, then pull the Modbus feed to force a safe degradation.

### Tamper-evident audit chain

```python
import hashlib, json, time

def append_event(previous_hash, counter, source, payload, model_hash, config_hash):
    record = {
        "counter": counter,
        "monotonic_ns": time.monotonic_ns(),
        "source": source,  # measured, model, synthetic, calibrated
        "payload": payload,
        "model_hash": model_hash,
        "config_hash": config_hash,
        "previous_hash": previous_hash,
    }
    canonical = json.dumps(record, sort_keys=True, separators=(",", ":"))
    record["hash"] = hashlib.sha256(canonical.encode()).hexdigest()
    return record
```

A SHA-256 hash chain is tamper-evident, not authenticated or nonrepudiable. For a field pilot, sign records with a protected key or HMAC, secure time, role-based access, and export to immutable storage.

### Local edge topology

```text
Process A: well simulator -> Modbus TCP localhost:5020, 20-100 Hz
Process B: pymodbus collector -> normalized in-memory bus or MQTT localhost:1883
Process C: cycle/MHE estimator -> 1 Hz plus end-of-stroke update
Process D: OSQP/CasADi controller -> command proposal and constraint proof
Process E: safety supervisor -> final command authority
Process F: Streamlit -> read-only state plus signed operator actions
```

Ship Mosquitto, Python wheels, configuration, demo data, and documentation locally. Bind services to loopback by default. If a LAN demo is needed, use TLS, credentials, least-privilege topics, and a firewall. Do not call ordinary Python on a laptop a certified sub-second safety controller. Show measured solver latency and missed-deadline handling; deterministic field control belongs in an industrial PLC or real-time controller after qualification.

### Three-tier state machine

| Level | Trigger examples | Automatic response |
|---|---|---|
| 0 - Normal | Fresh synchronized data, bounded residuals, feasible robust MPC | Apply ramp-limited command. |
| 1 - Degraded | Short telemetry gap, estimator residual warning, thermal-model discrepancy | Freeze adaptation, widen uncertainty, use conservative schedule, notify operator. |
| 2 - Protective | Predicted robust force breach, repeated infeasibility, long stale data, unit/config mismatch | Ramp to validated minimum safe SPM or approved fallback; block optimizer. |
| 3 - Emergency | Independent overload, overspeed, E-stop, impossible sensor contradiction, hardware protection | De-energize or hand control to certified site protection; latch and require authorized reset. |

The software command path must never bypass the existing pump controller's overloads, guards, or E-stop.

**Decision-ready insight:** The live dropout test is more persuasive than another AI graphic because it proves that the prototype understands operational failure, not only nominal prediction.

## 11. Verification Plan and Acceptance Gates

The finale prototype should make claims in four maturity tiers:

| Tier | Evidence | Permitted wording |
|---|---|---|
| Unit verified | Analytical limits, dimensions, conservation, CFL, taper-interface tests | "The implementation satisfies these numerical tests." |
| Synthetic validated | Known latent parameters recovered across seeded disturbances | "Recovered in simulation under stated noise and model mismatch." |
| Historical replay | Blind held-out field cycles, no control actuation | "Retrospectively detected or forecast the event." |
| Prospective pilot | Shadow mode, then approved limited actuation | "Demonstrated on these wells under this operating envelope." |

Minimum automated tests are: `T(ti)` limit; monotonic cooling under fixed assumptions; viscosity monotonicity; Kelvin-unit rejection; radial lookup agreement; grid-convergence study; CFL rejection; static rod equilibrium; undamped energy behavior; tapered-interface force continuity; mass and unit checks; 144-point phase closure; noise and drift recovery; gas-versus-cooling identifiability challenge; infeasible MPC fallback; stale-data transition; and deterministic A/B replay.

For field evaluation, freeze model and thresholds before scoring. Split data by well and time, not random cards. Report minimum tension error, peak-load error, temperature error, card reconstruction error, false protective trips per well-day, missed events, production effect, energy per barrel, and operator overrides. The Cheng study's random card split and very high reported accuracy provide a useful benchmark but not proof of unseen-well generalization.

A credible deployment sequence is:

1. Thirty to sixty days of data-quality assessment and failure-mode review.
2. Shadow thermal and card estimates with no commands.
3. Blind retrospective and prospective scoring.
4. Operator-advisory recommendations.
5. Limited actuation on one low-risk well inside existing controls.
6. Staged multiwell trial with a pre-agreed rollback and economic protocol.

**Decision-ready insight:** The product is not "validated" because a synthetic card looks realistic. The fastest route to credibility is a maturity ladder with explicit language and pass/fail metrics.

## 12. Top 15 Hostile Jury Questions and Winning Defenses

1. **"Is this really novel when Ambyint and Weatherford already change pump speed?"**
   - No individual control primitive is novel. The claimed contribution is the auditable, uncertainty-aware linkage from CSS thermal state to fluid and tapered-rod mechanics to a safe command. Ambyint and ForeSite already disprove any broader claim [12_top_15_hostile_jury_questions_and_winning_defenses[0]] [26].

2. **"Can you prove no commercial company has built this?"**
   - No. Public evidence can support only "we did not identify a disclosed implementation." Proprietary deployments may exist, and patent counsel would be required for a formal claim search and freedom-to-operate opinion.

3. **"Why would SLB or Weatherford not already do it?"**
   - Their public products already integrate many signals and predictive analytics. The likely issue is not inability; it is whether Baghewala-specific thermal coupling produces enough incremental value to justify calibration. Our pilot is designed to answer that question, not speculate about vendor roadmaps.

4. **"Your 42% correction is made up, is it not?"**
   - A universal correction would be made up. The publication reports a case-specific late-time overestimate in a 2D synthetic comparison [12_top_15_hostile_jury_questions_and_winning_defenses[1]] [13]. We use `0.7042` only as an illustrative temperature-rise anchor at that point, then fit `k(t)` from field or high-fidelity reference data with uncertainty.

5. **"How can a linear Gibbs model predict buckling after force becomes negative?"**
   - It cannot. Negative predicted tension is an envelope violation that triggers protective control. Post-buckling contact belongs to an offline 3D model or a conservative discrepancy bound, consistent with published limitations of uniform 1D models.

6. **"Why map viscosity into an arbitrary damping range?"**
   - We should not. The revised model derives distributed drag `beta` first and then `nu = beta/(rho*A)` in `1/s`, with an estimated correction for eccentric, multiphase, and non-Newtonian effects.

7. **"What happens with a 1 in, 7/8 in, and 3/4 in tapered string?"**
   - Each section receives its actual `A`, `EA`, mass, damping, and length. The solver enforces displacement and axial-force continuity at interfaces and constrains stress section by section. The well tally is mandatory input.

8. **"Your card changed because of gas, not cooling. How do you know?"**
   - We do not infer cause from card shape alone. Casing/tubing pressure, fluid level, water cut, fillage, thermal forecast, and estimator residuals compete as hypotheses. If they are not identifiable, uncertainty expands and the controller degrades rather than asserting a cause.

9. **"Where is your Baghewala training data?"**
   - We have none unless OIL supplies it. Synthetic data verifies software and controlled responses, not field accuracy. The CNN is advisory, and the physics estimator begins with explicit priors before shadow-mode calibration.

10. **"Why use deep learning at all?"**
    - Only to rank post-facto visual fault classes and unknown patterns. Safety constraints come from physics, uncertainty, and independent interlocks. Cheng's work shows classification feasibility across eight card classes, not control authority.

11. **"Where did the 12-hour warning come from?"**
    - It is the configured demo horizon. We will report whether synthetic and later field forecasts remain calibrated over that horizon. Until then, the UI labels it as a simulation target, not a measured performance claim.

12. **"Will this run in the Rajasthan desert without internet?"**
    - Yes for the prototype: Modbus, MQTT, estimator, controller, dashboard, configuration, and audit log all run on localhost. A field version needs industrial-temperature hardware, surge protection, watchdogs, secure remote access, and certified local protection.

13. **"What if the optimizer crashes or telemetry freezes?"**
    - The safety supervisor owns the final command. Stale data freezes adaptation; repeated infeasibility ramps to an approved fallback; independent overload or E-stop latches Level 3. The demo will prove this by disconnecting the feed.

14. **"How do you handle sand and plunger wear?"**
    - We estimate a wear/leakage health state and classify sand symptoms, but speed control is not represented as a repair. Rising leakage or sticking creates a maintenance recommendation, and sand-tolerant hardware remains a completion decision [12_top_15_hostile_jury_questions_and_winning_defenses[2]] [32].

15. **"Is INR 2.8 Cr savings a result or a sales number?"**
    - It is a disclosed scenario, not a result. Every input is editable, the range excludes unverified production upside, and economic credit is awarded only after a controlled pilot shows fewer events or lower steam and power at equivalent production.

**Decision-ready insight:** The winning answer pattern is "state the limit, show the safeguard, then show the evidence plan." Bluffing is much easier for a domain judge to punish than an explicit boundary.

## 13. Eight-Minute Finale Pitch Mapped to SIH Criteria

SIH's public criteria emphasize innovation, technical soundness and feasibility at initial evaluation, then functionality, relevance, performance, final demo, and presentation [13_eight_minute_finale_pitch_mapped_to_sih_criteria[0]] [35]. No official numerical weighting was found, so do not invent percentages.

| Time | Slide and visual | Exact spoken script | Criteria served |
|---|---|---|---|
| 0:00-0:45 | Slide 1: Baghewala fact card and failure chain | "Baghewala produces very viscous oil from Jodhpur Sandstone using CSS and sucker-rod pumping. OIL reports about 1,150 m average depth and 10,000 to 13,000 cP at 50 degrees C. Our question is not whether a card looks abnormal. It is whether cooling can warn us early enough to avoid a damaging load envelope." [13_eight_minute_finale_pitch_mapped_to_sih_criteria[1]] [11] | Relevance, problem clarity |
| 0:45-1:25 | Slide 2: prior-art boundary | "Commercial products already diagnose faults and some change speed autonomously. We will not claim otherwise. Our differentiator is the explicit, auditable bridge from CSS thermal state through fluid and tapered-rod mechanics to uncertainty-aware control." | Innovation, credibility |
| 1:25-2:20 | Slide 3: five-block architecture | "Steam history updates a calibrated thermal state. Temperature updates rheology and multiphase uncertainty. A CFL-safe variable-area wave solver estimates the rod envelope. Robust MPC changes only validated speed and acceleration variables. An independent supervisor can always refuse the command." | Technical soundness, feasibility |
| 2:20-3:00 | Slide 4: provenance | "Blue is measured, orange is model output, purple is calibrated, and gray is synthetic. The 12-hour horizon you see today is a simulation target, not a field claim. Every event is hash-chained to its configuration and model version." | Presentation, trust |
| 3:00-4:40 | Live demo A/B | "Both wells now receive the same cooling acceleration and noise seed. The card-only baseline waits for mechanical symptoms. The coupled branch forecasts its conservative force margin, reduces SPM within ramp limits, and stays above the demonstration threshold. Now, please move the water-cut or steam-quality slider." | Functionality, final-demo performance |
| 4:40-5:20 | Live failure injection | "I will now remove the Modbus feed. Data age rises, adaptation freezes, the controller enters its approved fallback, and no optimizer output can bypass the supervisor. This entire stack is local and needs no venue Wi-Fi." | Reliability, feasibility |
| 5:20-6:05 | Slide 5: model limitations | "Gibbs does not model post-buckling contact, so zero tension is a boundary, not a prediction region. The published 42 percent temperature error is one synthetic case, so we calibrate temperature rise instead of hard-coding it. Gas, water, taper, sand, and corrosion remain explicit states or maintenance risks." | Technical soundness |
| 6:05-6:50 | Slide 6: validation ladder | "Today we prove numerical and synthetic behavior. Next is shadow mode on historical and live wells, then advisory operation, then limited actuation under existing protection. We publish false trips, missed events, load error, energy per barrel, and operator overrides." | Feasibility, relevance |
| 6:50-7:35 | Slide 7: economic waterfall | "Our 30-well planning scenario spans INR 1.75 to 2.80 crore per year, but every number is an assumption. OIL publicly reports 23 producing wells, so we will resize the case to the nominated pilot. Savings receive credit only when a controlled trial verifies avoided work, steam, or power." [13_eight_minute_finale_pitch_mapped_to_sih_criteria[1]] [11] | Impact, scalability |
| 7:35-8:00 | Slide 8: ask | "We are not asking you to believe an AI promise. We are asking OIL for completion tallies, synchronized cards, injection histories, fluid and workover data, and one shadow-mode pilot. In return, we deliver an offline, auditable controller that can explain every estimate, every command, and every refusal." | Presentation, implementability |

Prepare a 90-second fallback video recorded from the same deterministic seed, but run the real demo first. Keep a second laptop with the packaged environment and never modify the main branch after rehearsal begins.

**Decision-ready insight:** Honesty about prior art and limitations creates room for the live system to carry the innovation score. The A/B disturbance and feed-loss tests should occupy nearly half the pitch.

## 14. Transparent INR 1.75-2.80 Cr Scenario

OIL publicly reports 35 drilled and 23 producing wells, so the user's approximately 30-well case is a planning scenario, not a verified current producing-well count [14_transparent_inr_1_75_2_80_cr_scenario[0]] [11]. Use the following identity:

```text
Annual gross benefit
 = N_avoided_workovers*C_workover
 + Annual_steam_cost*Steam_saving_fraction
 + Annual_power_cost*Power_saving_fraction.

Annual net benefit
 = Annual gross benefit
 - annual software, instrumentation, support, and amortized deployment cost.
```

| Component | Low scenario | High scenario | Status |
|---|---:|---:|---|
| Avoided workover-equivalent events | `1.10 * INR 0.95 Cr = INR 1.045 Cr` | `1.50 * INR 1.20 Cr = INR 1.800 Cr` | Team assumption, not a Baghewala result |
| Steam/fuel saving | `15% * INR 4.00 Cr = INR 0.600 Cr` | `16% * INR 5.00 Cr = INR 0.800 Cr` | Team assumption |
| Power saving | `7.5% * INR 1.40 Cr = INR 0.105 Cr` | `12.5% * INR 1.60 Cr = INR 0.200 Cr` | Team assumption |
| **Gross annual benefit** | **INR 1.750 Cr** | **INR 2.800 Cr** | Arithmetic scenario |
| Deployment and recurring cost | Not yet supplied | Not yet supplied | Must be subtracted before ROI claim |

The range exactly reconstructs the requested numbers without pretending they were discovered in OIL accounts. It excludes production uplift, deferred-failure probability, downtime barrels, carbon value, and salvage because those data are unavailable. If the team wants a probability model, let event count be Poisson or negative-binomial and failure reduction be uncertain; use Monte Carlo only after distributions are disclosed.

Pilot measurement must normalize steam and power to equivalent operating time and production. A workover avoided cannot be observed directly in a short trial, so use pre-agreed leading indicators plus a longer survival analysis, with matched wells and censoring. Report gross and net savings separately.

**Decision-ready insight:** The economic slide becomes defensible when the team shows the formula, assumptions, and missing costs on screen. Hiding them would turn a useful scenario into an unsupported promise.

## 15. Thirty-Six-Hour Execution Plan and Six-Person Split

| Member | Primary role | Deliverables | Backup duty |
|---|---|---|---|
| 1 | Tech Lead | Repository contract, conservative rod solver, MPC interface, integration decisions | Gateway and release build |
| 2 | Integration Engineer | Modbus/MQTT simulator, process supervisor, data bus, offline packaging | Adapter support |
| 3 | Frontend/UI Owner | Streamlit A/B display, sliders, KPI cards, failure-state visualization | Demo operator |
| 4 | Domain Modeler | Thermal limit, Arrhenius/drag model, multiphase and taper parameters, economic sheet | Jury domain answers |
| 5 | QA/Stress Tester | Unit tests, deterministic scenarios, data-dropout tests, latency benchmark, provenance audit | Release manager |
| 6 | Pitch Lead | Eight-minute script, evidence labels, slides, demo choreography, question matrix | Frontend content |

### Hour-by-hour critical path

| Hours | Non-negotiable output |
|---|---|
| 0-4 | Freeze schemas, signs, SI units, topics, ports, random seed, safety states, and one golden end-to-end scenario. |
| 4-12 | Vertical slice: simulator -> Modbus -> adapter -> estimator stub -> controller stub -> dashboard. Nothing else outranks this. |
| 12-20 | Replace stubs with thermal model, tapered rod kernel, deterministic A/B controller, and 144-point cards. |
| 20-26 | Add disturbances, provenance, unit confirmation, feed loss, constraint infeasibility, and fallback logic. |
| 26-31 | Run test matrix, benchmark latency, freeze dependencies, package offline, and record fallback video. |
| 31-34 | Script rehearsal, hostile questions, economic sensitivity, and operator handoffs. No new features. |
| 34-36 | Code freeze, two full cold starts on both laptops, cable/power check, final eight-minute rehearsals. |

Definition of done is one command from a clean machine, no internet, deterministic A/B replay, visible source tags, an intentional telemetry failure, and a complete audit export. Every member must know the reset procedure. Maintain two USB copies, two chargers, local documentation, and printed architecture/economics pages.

**Decision-ready insight:** A stable vertical slice by hour 12 is more valuable than seven half-built models. Feature freeze at hour 31 protects final-demo performance, one of SIH's explicit categories [15_thirty_six_hour_execution_plan_and_six_person_split[0]] [35].

## Synthesis: What Is Actually Differentiated

| Dimension | Commercial predictive/autonomous lift platforms | Academic component models | Proposed revised twin |
|---|---|---|---|
| Mechanism | Multisignal diagnostics, alarms, recommendations, and in some cases autonomous speed changes [synthesis_what_is_actually_differentiated[0]] [10][synthesis_what_is_actually_differentiated[1]] [26]. | Thermal analytics, wave models, classifiers, conceptual twins, and 3D mechanics studied separately [synthesis_what_is_actually_differentiated[2]] [13][synthesis_what_is_actually_differentiated[3]] [30][synthesis_what_is_actually_differentiated[4]] [33]. | Calibrated thermal-state forecast feeds multiphase drag and tapered-rod estimation, then robust control and an independent safety supervisor. |
| Scope | Production optimization across many lift environments and fleets. | Usually one mechanism, model, dataset, or conceptual architecture. | Narrowly tailored to the CSS-SRP interaction and auditable field validation. |
| Evidence base | Vendor case studies and proprietary deployments; internal equations and triggers are not public. | Public methods, but often synthetic, conceptual, random-split, or limited geometry. | Initially analytical and synthetic; must progress through shadow and pilot tiers. |
| Time horizon | Some products report early warnings from days to months, so "commercial tools are reactive" is false [synthesis_what_is_actually_differentiated[5]] [8]. | Varies from post-facto classification to dynamic simulation. | Explicit 12-hour simulation horizon, with calibration and uncertainty scored before it becomes a field claim. |
| Trade-off | Mature operations but opaque internals and unknown CSS-specific coupling. | Transparent methods but incomplete system integration or expensive high fidelity. | Explainable integration and local operation, but presently unvalidated and model-mismatch-sensitive. |
| Safety boundary | Product-specific and largely undisclosed publicly. | Gibbs is weak in contact/buckling; 3D FEM is richer but heavier. | Fast 1D control model inside a tensile envelope, offline high-fidelity discrepancy analysis, and independent failsafe. |

The non-obvious tension is that adding thermal physics can improve anticipation while worsening confidence if the thermal model is poorly calibrated. The 42% case result demonstrates that more physics is not automatically more truth. Likewise, adding a CNN may improve fault labels while making the system less defensible if random card splits or synthetic training leakage are hidden.

The revised design resolves both tensions through separation of authority. Thermal, CNN, and Bayesian components contribute forecasts or advisory information. Robust MPC acts only inside quantified uncertainty and validated limits. The safety supervisor retains command authority. Provenance makes measured, calibrated, modeled, and synthetic values impossible to confuse on stage.

The strongest differentiator is therefore not a new equation. It is an inspectable chain in which every transformation has units, uncertainty, provenance, and a failure response. The weakest point is the still-unvalidated causal arrow from cooling to rod-failure risk. A winning team should place that weakness in the center of its pilot plan instead of concealing it.

## Final Go/No-Go Recommendation

Proceed, but only after these mandatory changes:

1. Delete "all commercial systems are reactive," "first SRP digital twin," and any categorical global-patent absence claim.
2. Replace the fixed 42% bias correction with temperature-rise calibration and uncertainty.
3. Replace arbitrary viscosity-to-damping clipping with a dimensionally consistent drag model and estimator.
4. Implement variable-area conservative rod mechanics and treat compression as a model-validity boundary.
5. Add gas, water cut, fillage, sand/wear, corrosion, and sensor quality as explicit states, risks, or maintenance outputs.
6. Clean-room implement the solver; do not copy unlicensed USTAR code.
7. Label all demo values by provenance and all financial inputs as assumptions.
8. Demonstrate the failsafe by breaking telemetry live.
9. Ask OIL for completion tallies, synchronized cards, steam histories, pressures, fluid data, workover causes, and equipment ratings.
10. Claim success only at the evidence tier actually reached.

No document can guarantee first place. This revised architecture can, however, remove the easiest reasons for an expert jury to reject the entry and replace them with a technically defensible, repeatable, offline demonstration.

## References

1. *SIH 2026 Problem Statements - Browse All 226*. https://sih2026.vuce.in/en/ps/SIH26120
2. *Production 4.0 Video Library | Weatherford International*. https://www.weatherford.com/production-and-intervention/production-4-0/production-4-0-video-library?wchannelid=ob2kd40wy6&wmediaid=14580p2w19
3. *News | ChampionX*. https://www.championx.com/news
4. *100 Years | SLB*. http://slb.com/about/who-we-are/our-history
5. *Autonomous Control*. https://intelligence.weatherford.com/autonomous-control
6. *Production Optimization Platform | Weatherford International*. http://weatherford.com/production-and-intervention/production-4-0/production-optimization-platform
7. *XSPOC 3.2.2 | ChampionX*. https://www.championx.com/products-and-solutions/artificial-lift-technologies/production-optimization-software-solutions/xspoc-3.2.2-production-optimization-software
8. *Rod Lift Optimization with AI-Powered Dynacard Classification*. https://www.ambyint.com/whitepapers/rod-lift-optimization-with-ai-powered-dynacard-classification
9. *Reciprocating Rod Lift Systems | Weatherford International*. http://weatherford.com/production-and-intervention/artificial-lift-solutions/reciprocating-rod-lift-systems
10. *Artificial Lift Optimization & Digital Solutions - Downhole Sensors | ChampionX*. https://www.championx.com/products-and-solutions/artificial-lift-technologies/production-optimization-software-solutions
11. *Rajasthan Fields | Oil India Limited*. https://www.oil-india.com/rajasthan-fields
12. *ForeSite® EDGE Increases Oil Gains Over 20% with Autonomous Control Logic | Weatherford International*. https://www.weatherford.com/real-results/production/foresite-edge-increases-oil-gains-over-20-with-autonomous-control-logic
13. *Petroleum Temperature profile estimation: A study on the Boberg and Lantz steam stimulation model*. http://journal.hep.com.cn/petroleum/EN/PDF/10.1016/j.petlm.2019.07.002
14. *GitHub - pydantic/pydantic: Data validation using Python type hints · GitHub*. https://github.com/pydantic/pydantic
15. *GitHub - pytorch/pytorch: Tensors and Dynamic neural networks in Python with strong GPU acceleration · GitHub*. https://github.com/pytorch/pytorch
16. *GitHub - scipy/scipy: SciPy library main repository · GitHub*. https://github.com/scipy/scipy
17. *GitHub - meta-pytorch/botorch: Bayesian optimization in PyTorch · GitHub*. https://github.com/pytorch/botorch
18. *GitHub - streamlit/streamlit: Streamlit — A faster way to build and share data apps. · GitHub*. https://github.com/streamlit/streamlit
19. *GitHub - pymodbus-dev/pymodbus: A full modbus protocol written in python · GitHub*. https://github.com/pymodbus-dev/pymodbus
20. *GitHub - casadi/casadi: CasADi is a symbolic framework for numeric optimization implementing automatic differentiation in forward and reverse modes on sparse matrix-valued computational graphs. It supports self-contained C-code generation and interfaces state-of-the-art codes such as SUNDIALS, IPOPT etc. It can be used from C++, Python, Matlab/Octave, Julia or Javascript · GitHub*. https://github.com/casadi/casadi
21. *ChampionX debuts preview of new production optimization digital solution | ChampionX*. https://www.championx.com/resource-library/championx-debuts-preview-of-new-production-optimization-digital-solution
22. *GitHub - fastapi/fastapi: FastAPI framework, high performance, easy to learn, fast to code, ready for production · GitHub*. https://github.com/fastapi/fastapi
23. *GitHub - osqp/osqp: The Operator Splitting QP Solver · GitHub*. https://github.com/osqp/osqp
24. *GitHub - eclipse-mosquitto/mosquitto: Eclipse Mosquitto - An open source MQTT broker · GitHub*. https://github.com/eclipse-mosquitto/mosquitto
25. *Leucipa Lift Optimizer | Baker Hughes*. https://www.bakerhughes.com/oilfield-services-and-equipment-digital/leucipa-automated-field-production-solution/leucipa-services/leucipa-lift-optimizer
26. *Rod Lift Optimization - InfinityRL™ | Ambyint*. https://www.ambyint.com/solutions/rod-lift-optimization
27. *Temperature profile estimation: A study on the Boberg and ...*. http://sciencedirect.com/science/article/pii/S2405656118301755
28. *GitHub - BYU-PRISM/USTAR-Artificial-Lift: Rod Pumping Artificial Lift Model Predictive Control and Moving Horizon Estimation · GitHub*. https://github.com/BYU-PRISM/USTAR-Artificial-Lift
29. *Case Study for Enhancement of Production of Heavy and Highly Viscous Crude Oil Using Electrical Downhole Heater | SPE Asia Pacific Oil and Gas Conference and Exhibition | OnePetro*. https://onepetro.org/SPEAPOG/proceedings/23APOG/23APOG/D012S001R010/535203
30. *In spite of Sucker rod pumps (SRP) being one of the most popular solutions for an artificial lift since their*. https://alrdc.com/wp-content/uploads/2021/03/Conceptual-Real-TIme-Digital-Twin-Driven-Sucker-Rod-Pumping-Unit-for-Academic-Learning-and-Commercial-Applications.pdf
31. *Sucker rod failure analysis*. https://www.championx.com/contents/NOR_Sucker%20Rod%20Failure%20Analysis_BR_0322.pdf
32. *Specialty Rod Pump & Systems - Rod Pump Systems - Rod Pumping System | ChampionX*. https://www.championx.com/products-and-solutions/artificial-lift-technologies/rod-lift/specialty-rod-pumps
33. *Sucker rod pump downhole dynamometer card determination based on a novel finite element method - Extrica*. https://www.extrica.com/article/22004
34. *Automatic Recognition of Sucker-Rod Pumping System Working Conditions Using Dynamometer Cards with Transfer Learning and SVM*. https://www.mdpi.com/1424-8220/20/19/5659
35. *Evaluation Guideline for Smart India Hackathon*. http://siceval.mic.gov.in/assets/img/Evaluation_Guidelines_for_sih2024.pdf
36. *SIH 2025 Guidelines *. https://www.sih.gov.in/letters/SIH2025-Guidelines-College-SPOC.pdf
37. *Article Pdf*. https://onepetro.org/SJ/article-pdf/doi/10.2118/233386-PA/5357260/spe-233386-pa.pdf
38. *(sucker rod pump dynamometer control) - Google Patents*. https://patents.google.com/?q=sucker+rod+pump+dynamometer+control
39. *(cyclic steam reservoir temperature sucker rod pump control) - Google Patents*. https://patents.google.com/?q=cyclic+steam+reservoir+temperature+sucker+rod+pump+control
40. *Oil & Gas Well Life Cycle Management - Real-Time Remote Monitoring | SLB*. https://www.slb.com/products-and-services/innovating-in-oil-and-gas/completions/artificial-lift/optimizing-artificial-lift/lift-iq-production-life-cycle-management-service
