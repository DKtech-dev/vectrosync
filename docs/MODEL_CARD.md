# VectroSync Model Card

**Version:** 2.0.0 research prototype  
**Decision scope:** Synthetic CSS–SRP what-if analysis and UI demonstration  
**Control authority:** Advisory only  
**Validation status:** No field, HIL, SIL, or safety certification evidence is included in this repository

## Intended use

VectroSync demonstrates how reservoir cooldown, temperature-dependent viscosity, annular drag, rod-load estimates, a speed governor, supervisory logic, provenance, and commercial assumptions can be presented in one operator workflow.

It may be used for:

- software architecture demonstrations;
- deterministic sensitivity studies;
- test-data ingestion experiments;
- designing a shadow-mode field validation campaign;
- evaluating human factors and explainability concepts.

It must not be used to command a PLC/VFD, set operating envelopes, certify rod integrity, forecast reserves, or approve an investment without independent engineering review and operator data.

## Executed model inventory

| Output | Executed implementation | Evidence level | Principal limitations |
|---|---|---|---|
| Average heated-zone temperature | Bessel quadrature/spline radial factor, vertical conduction factor, empirical heat-removal and calibration factors in `src/thermal.py` | Analytical/numerical research model | Initial heated-zone energy balance, steam quality, layered geology, pressure, flow, and field calibration are absent |
| Dry-oil viscosity | Two-point Arrhenius interpolation in `src/rheology.py` | Exact fit at two configured points | Extrapolation uncertainty is not quantified |
| Emulsion viscosity | Piecewise empirical water-cut multiplier with fixed inversion at 0.60 | Synthetic constitutive assumption | No shear-rate, hysteresis, salinity, droplet-size, or rheometer validation |
| Annular drag | Concentric Couette coefficient multiplied by fixed eccentricity factor | Reduced-order assumption | Couplings, tubing contact, turbulence, inclination, and non-Newtonian shear are absent |
| Surface/downhole cards | Phase-resolved algebraic force balance in `ConservativeRodWaveSolver.simulate_card` | Reduced-order synthetic estimator | Despite retained mesh/CFL utilities, the production path does not time-march the rod-wave PDE |
| Depth stress map | Linear interpolation of endpoint card loads divided by local section area | Visualization surrogate | Not nodal stress recovery; not a buckling/contact model |
| Pump boundary | Hydrostatic load and illustrative valve/fluid-pound modes | Synthetic boundary model | No pressure-volume chamber or valve hysteresis calibration |
| Speed recommendation | Fast reduced-order horizon governor in `src/controller.py` | Advisory surrogate | Coefficients are not field identified; infeasibility is now explicit |
| Supervisory state | Four-level software demonstration in `src/failsafe.py` | Logic prototype | Not an IEC 61511 SIS or independent protection layer |
| State estimator | Physics prior plus experimental EKF in `src/state_estimator.py` | Experimental | SIREN weights are untrained by default; module is not in the control path |
| Audit chain | Thread-safe in-memory SHA-256 hash chain | Tamper-evidence demo | No persistence, signature, WORM storage, trusted timestamp, or external anchor |
| Economics | Low/base/high assumption model in `src/economics.py` | Commercial hypothesis | Inputs require operator approval and pilot evidence |

## Thermal formulation actually implemented

For elapsed time `t`, the uncalibrated average temperature is

\[
T_{avg}(t)=T_R+(T_s-T_R)V_r(t)V_z(t)(1-D_f(t)),
\]

where

\[
D_f(t)=\delta\frac{t_d}{t_d+5},\qquad
b^2=\frac{\alpha t}{r_h^2},\qquad w=4\alpha t.
\]

The radial factor is evaluated as

\[
V_r(b^2)=2\int_0^\infty e^{-b^2y^2}\frac{J_1(y)^2}{y}\,dy,
\]

with explicit small/large-argument branches. `radial_factor(..., use_fast_spline=False)` is an independent quadrature route used by regression tests. The vertical factor is

\[
V_z(w)=\operatorname{erf}\left(\frac{h}{\sqrt w}\right)
+\frac{\sqrt w}{h\sqrt\pi}\operatorname{expm1}\left(-\frac{h^2}{w}\right).
\]

The calibrated result scales excess temperature above `T_R` by `k_hat`. `cooling_multiplier` consistently scales thermal diffusivity in `predict_temperature`; it is not a field-estimated parameter.

## Rheology formulation actually implemented

Dry oil:

\[
\ln\mu_o=A+\frac{B}{T_K}.
\]

For water cut `f_w ≤ 0.60`:

\[
\mu_m=\mu_o(1+2.5f_w+10.05f_w^2).
\]

Above 0.60, the code applies a smooth empirical decay toward configured water viscosity. This is not a general Brinkman–Vand or non-Newtonian constitutive law and should not be labeled one without supporting derivation and data.

## Control contract

`FastMPCController` preserves the historical API name, but its current algorithm is a reduced-order governor. It now:

- validates finite, positive state inputs;
- applies slew limits in SPM/hour × horizon-step hours;
- evaluates both modeled tension and PPRL bounds;
- reports `INFEASIBLE_SAFE_FALLBACK` when no compliant trajectory exists;
- emits per-step violation indices and minimum constraint residuals;
- sets `certified_for_direct_control=false`.

The API independently evaluates the proposed speed with the displayed card model before assigning a supervisory state. Negative modeled tension produces a Level 3 advisory trip and a 0 SPM command, while Scenario A intentionally retains the pre-trip snapshot for comparison.

## Provenance labels

- `[measured]`: supplied by a user; not independently authenticated by this software.
- `[model]`: deterministic model output.
- `[synthetic]`: generated demonstration data or disturbances.
- `[calibrated]`: may only be used when a calibration procedure and source are identified.

## Required validation before a shadow pilot

1. Freeze a versioned configuration and unit dictionary.
2. Collect synchronized surface load/position, VFD, pressure, temperature, fluid sample, well-test, and intervention history.
3. Fit only on a training period; reserve wells/cycles for blinded validation.
4. Report MAE/RMSE/bias and interval coverage for temperature, viscosity, PPRL, MPRL, card shape, and minimum inferred tension.
5. Perform mesh/time convergence and energy/momentum residual studies for a true transient rod solver.
6. Propagate parameter and measurement uncertainty into constraint margins.
7. Run shadow mode with no actuator write access.
8. Complete HAZOP/LOPA, cybersecurity review, management of change, and independent SIS design before any closed-loop trial.

## Known gaps tracked as non-claims

- no field dataset or operator authorization;
- no trained PINN artifact;
- no Modbus client/server or register map;
- no real-time broker integration;
- no durable signed audit store;
- no hardware-in-the-loop evidence;
- no Euler/helical buckling or tubing-contact mechanics;
- no certified economic benefit.
