# Catenary Verification Ledger

This document states, in one place, what is verified, what is validated, what
is authoritative, and what is explicitly out of scope. It exists so that no
claim in the README, the deck, or the UI outruns what the code actually does.
Every number below was measured against the running code on 2026-09-11 and is
reproducible via `pytest tests/`.

## 1. Maturity ladder

| Tier | Meaning | Applies to |
|---|---|---|
| **Unit verified** | Analytical limits, conservation, CFL, taper-interface continuity, cross-solver agreement all pass automated tests | Thermal decay, rheology, rod card estimator, transient PDE (within its validated band), MPC constraints, failsafe transitions, audit hash chain |
| **Synthetic validated** | Behavior is correct under seeded synthetic disturbances with known ground truth | The A/B benchmark (`GET /api/experiment/ab`), EKF parameter recovery |
| **Historical replay** | Not performed | — no field data available |
| **Prospective pilot** | Not performed | — requires an operator partnership |

No claim in this project should be stated more strongly than "unit verified"
or "synthetic validated." Nothing here is field-validated.

## 2. Which solver is authoritative, and why

Catenary ships two independent rod-load estimators:

- **Surrogate** (`ConservativeRodWaveSolver`): a 144-point algebraic
  force-balance card estimator, ~2 ms per call. **This is the solver used by
  the control loop** (`FastMPCController`, `SupervisoryFailsafe`, the
  reachability governor).
- **Transient** (`TransientRodWaveSolver`): a full 1D explicit finite-volume
  elastodynamic wave PDE, ~120-250 ms per call. Used for independent
  cross-verification and high-fidelity visualization.

### Measured agreement (`tests/test_solver_agreement.py`)

At 3.8 SPM, 25% water cut, across the reservoir temperature band **55-85°C**:

| T (°C) | Surrogate PPRL (kN) | Transient PPRL (kN) | Relative difference |
|---|---|---|---|
| 55 | 142.50 | 135.48 | 4.9% |
| 60 | 120.61 | 116.72 | 3.2% |
| 66 | 101.42 | 99.30 | 2.1% |
| 70 | 91.75 | 90.26 | 1.6% |
| 80 | 74.99 | 74.11 | 1.2% |

The two independently-implemented solvers agree on peak polished rod load
within **5%** across this band. This is treated as a genuine cross-validation
result.

### Where they disagree, and why that's disclosed rather than hidden

Above ~85°C the two solvers diverge sharply (measured up to **76%** PPRL
disagreement at 120°C), and the transient solver's PPRL becomes **non-grid-convergent**
(the answer changes non-monotonically as the mesh is refined — a sign of
numerical instability, not a physical prediction). The two solvers also
persistently disagree on **minimum downhole tension** by a wide margin at every
temperature (the transient solver's inertial/wave effects report higher
tension than the algebraic surrogate).

**Consequence — `TRANSIENT_VALIDATED_MAX_TEMP_C = 85.0`** (`backend/server.py`):
requests for `solver_type: "transient"` above 85°C reservoir temperature are
automatically served by the surrogate instead, and the response discloses
this via `model_status.requested_solver_type` and
`model_status.solver_fallback_reason`. The API never serves a
non-grid-convergent PPRL/tension pair labeled "transient."

**The surrogate is authoritative for the control loop and for minimum
tension.** The transient solver is presented for PPRL cross-verification
only, within its validated band.

## 3. What is genuinely AI, and how it is scoped

| Component | Method | Adapts from data? | Wired into the serving path? |
|---|---|---|---|
| `FastMPCController` (optimization mode) | Chance-constrained nonlinear program, SLSQP, 72 decision variables, 96 constraints, 90% one-sided confidence tightening | No (fixed weights) | **Yes** — `mpc_solver_mode: "optimization"` genuinely invokes `ConstrainedMPC.solve()` (verified: real solve time >100ms, not the surrogate's <1ms) |
| `DownholeKalmanEstimator` | Extended Kalman Filter, analytic Arrhenius Jacobian, Joseph-form covariance update with eigenvalue-floor symmetrization | **Yes** — recursive Bayesian state update from streaming measurements | **Yes** — every `/api/simulate` call runs one predict+update cycle against a persistent, process-lifetime filter state |
| `FastMPCController` (surrogate mode, default) | Backward-reachability constraint propagation + rate-limited forward tracking | No | Yes (default path) |
| `PINNSurrogate` / `SIRENLayer` | Frozen random sinusoidal network + ridge-solved linear readout (an Extreme Learning Machine) | Only via explicit `train_on_synthetic_ground_truth()`; **default `trained=False` discards the network output entirely** and returns the analytical prior | No — test-only, not presented as "AI in the loop" |
| `WhyEngine` | Three-branch f-string template selection | No | Yes, but its own docstring states: *"it is not an AI model"* |

**We claim exactly two AI systems: the EKF and the chance-constrained NMPC.**
Both are genuinely reachable through the API today (see
`tests/test_api_endpoints.py::test_api_mpc_solver_mode_optimization_actually_runs_slsqp`
and `::test_api_estimator_and_sustainability_fields_present`). Everything else
in the physics stack (thermal decay, rheology, card estimator, PDE solver,
failsafe state machine) is closed-form or deterministic numerical simulation,
not AI.

## 4. Known, disclosed limitations

- The EKF's measurement model treats `water_cut` as observable in its state
  vector, but its measurement Jacobian's third column is structurally zero —
  `water_cut` cannot actually be corrected by the current measurement set.
  The response's `estimator.water_cut_observable` field is `false`.
- The EKF's synthetic measurement-expectation coefficients
  (`T_surf = 0.75·T_sandface`, `P = 15+3μ`, `PPRL = 120+8μ`) are illustrative
  and not calibrated against the card estimator's own PPRL formula; they
  require field calibration before any accuracy claim.
- The reduced-order governor's internal plant model
  (`min_tension = 3.5 - 0.10·μ·SPM`, `PPRL = 47 + 10·SPM + 4·μ`) is a hand-fit
  affine surrogate for fast reachability screening. It is cross-checked
  against the real card model before any command is applied
  (`SupervisoryFailsafe.evaluate_state` runs on the card estimator's own
  output, not the governor's internal approximation).
- `steam_quality` is accepted, range-validated, and intentionally uncoupled
  from the rest of the model (`model_status.uncoupled_inputs`).
- Economics figures are a disclosed planning hypothesis
  (`economics.evidence_status == "commercial_hypothesis_not_field_validated"`),
  reported as a low/base/high sensitivity band, never a point forecast.
- The CO2-avoided figure uses a single disclosed grid emission factor
  (`economics.grid_emission_factor_kg_co2_per_kwh = 0.716`, CEA India
  FY2023-24) and inherits all upstream energy-saving assumptions.

## 5. Reproducing this document

```bash
pytest tests/test_solver_agreement.py -v
pytest tests/test_api_endpoints.py -v
python -c "from src.generator import DEFAULT_DATA_GENERATOR as g; r = g.generate_ab_benchmark_experiment(seed=42); print(r['baseline_float_count'], r['coupled_float_count'])"
```
