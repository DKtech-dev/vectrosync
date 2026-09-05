# VectroSync Technical Whitepaper

## Abstract

VectroSync is a synthetic CSS–SRP advisory twin integrating a heated-zone thermal model, temperature/water-cut viscosity assumptions, annular Couette drag, reduced-order phase cards, a constraint-aware speed governor, supervisory logic, data-quality gates, and provenance. This paper defines the executed implementation and the evidence required to progress from software demonstrator to field shadow pilot.

## 1. Model chain

\[
t \rightarrow T_{avg} \rightarrow \mu_o(T),\mu_m(T,f_w)
\rightarrow \beta(\mu,r_t,r_r) \rightarrow \hat F(\theta)
\rightarrow u_{SPM} \rightarrow \text{supervisory state}.
\]

The chain is deterministic. Outputs are `[model]` or `[synthetic]`; no field observations ship with the repository.

## 2. Thermal model

The implemented average temperature is

\[
T_{avg}=T_R+(T_s-T_R)V_rV_z(1-D_f),\quad
D_f=\delta t_d/(t_d+5).
\]

\[
V_r(b^2)=2\int_0^\infty e^{-b^2y^2}J_1(y)^2/y\,dy,
\quad b^2=\alpha t/r_h^2,
\]

with explicit asymptotic branches and a PCHIP cache. An independent quadrature route is regression-tested against the fast route. `V_z` uses an error-function expression with a numerically stable `expm1` term. Steam quality and a full injection-energy balance are not implemented.

## 3. Rheology and drag

Dry oil uses `ln μ=A+B/T_K`, fit exactly to two configured points. The water-cut branch is an empirical polynomial below 0.60 and a smooth decay toward water viscosity above 0.60. It is not shear-rate dependent and is not presented as a validated general emulsion law.

Couette drag uses `β=2π ε μ / ln(r_t/r_r)` and `F_drag=βLv`. Eccentricity, coupling, contact, and turbulent effects are not independently resolved.

## 4. Rod-load model

The executed `simulate_card` path is a 144-phase algebraic force balance. The class retains tapered mesh, mass, harmonic face-area, equilibrium, and CFL utilities, but no displacement/velocity state is time-marched in the production card path. The depth map interpolates endpoint card loads and divides by section area. Therefore the current system does not claim elastodynamic PDE convergence, nodal stress recovery, lateral buckling, or fatigue prediction.

## 5. Governor and supervisory logic

The 24-step governor computes viscosity over a 12-hour horizon, derives reduced-order tension/PPRL speed bounds, performs backward reachability under an SPM/hour slew limit, and emits a forward trajectory. It reports `INFEASIBLE_SAFE_FALLBACK` and residuals whenever bounds or reachability fail.

The API evaluates the proposed speed using the displayed card model. Negative modeled tension, overload, or non-finite safety input generates a Level 3 advisory trip. This is software logic only, not an independent SIS.

## 6. Data and provenance

CSV ingestion validates timestamp order/uniqueness, required channels, mapping confidence, finite values, gap length, edge gaps, units, and physical ranges. Invalid data may be analyzed but receives `control_valid=false`.

The SHA-256 ledger is process-local and thread-safe. It detects mutation of its current chain but is not persistent, signed, WORM, externally anchored, or restart-proof.

## 7. Verification

The current suite has 271 passing tests, including an independent radial quadrature comparison, extreme-viscosity infeasibility, audit concurrency, unit correction, fail-closed ingestion, economic arithmetic, non-finite estimator rejection, API model-status checks, and stroke propagation.

This is software/numerical verification, not field validation.

## 8. Validation program

A defensible program requires operator-approved configuration, synchronized field data, blinded holdouts, baseline comparisons, error and interval metrics, a true transient structural solver with convergence/conservation evidence, uncertainty propagation, independent closed-loop simulation, read-only shadow mode, HIL fault injection, HAZOP/LOPA, cybersecurity approval, and management of change.

Full model status: `docs/MODEL_CARD.md`. Assurance argument: `docs/ASSURANCE_CASE.md`.
