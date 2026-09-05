# Project: Well-to-Surface Digital Twin

> **Legacy design brief — not the current assurance statement.** Treat aspirational production/PDE/MPC/field claims below as historical requirements. The executed model status and limitations are authoritative in `README.md` and `docs/MODEL_CARD.md`.

## Architecture
A 100% offline, production-grade Well-to-Surface Digital Twin for Cyclic Steam Stimulation (CSS) and Sucker Rod Pump (SRP) optimization in the Baghewala heavy-oil field (Oil India Limited, Rajasthan).

```
+---------------------------------------------------------------------------------------------------+
|                                       STREAMLIT INDUSTRIAL DASHBOARD (app.py)                     |
|  - KPI Ribbon (SPM, Flow, F_min, PPRL, BHT, Viscosity, State)   - Live Disturbance Panel (Cooling,|
|  - A/B Dynacards (Surface & Downhole: Baseline vs. Twin)           Steam, Water-Cut, Wear, Modbus)|
|  - 12-Hour Predictive Causal Timeline (T, mu, beta, F_min, SPM) - Adaptive CSV Ingestion Port     |
|  - SHA-256 Block Explorer & 23-Well Economic Waterfall          - Dark Industrial 1920x1080 Layout|
+---------------------------------------------------------------------------------------------------+
                                                  ^
                                                  | (Reactive Visual State & Control Triggers)
                                                  v
+---------------------------------------------------------------------------------------------------+
|                                     ORCHESTRATION & CONTROL LAYER                                 |
|                                                                                                   |
|  +--------------------------------------------+    +--------------------------------------------+ |
|  |       src/controller.py (Fast-Loop MPC)    |    |      src/failsafe.py (3-Tier State Machine)| |
|  | - Horizon: 12 Hours (Dynamic SPM selection)|    | - LEVEL-0: Normal (<10s latency)           | |
|  | - Objective: Maximize fluid production     |    | - LEVEL-1: Degraded (10s - 60s latency)    | |
|  | - Penalty: Motor power & SPM jerk/variance |    | - LEVEL-2: Protective (>60s or F_min <0.5k)| |
|  | - Constraints: F_min >= +0.5 kN, PPRL<=90% |    | - LEVEL-3: Emergency Stop (PPRL > 95%)     | |
|  +--------------------------------------------+    +--------------------------------------------+ |
+---------------------------------------------------------------------------------------------------+
                                                  ^
                                                  | (State Feedback: F_min, PPRL, Work, Card)
                                                  v
+---------------------------------------------------------------------------------------------------+
|                                      PHYSICS SOLVER & BOUNDARY ENGINES                            |
|                                                                                                   |
|  +--------------------------------------------+    +--------------------------------------------+ |
|  |   src/rod_conservative.py (Wave PDE Solver)|    |     src/pump_boundary.py (Downhole Model)  | |
|  | - Conservative 1D wave equation:          |    | - Standing/Traveling Valve switching logic | |
|  |   rho*A*u_tt + beta*u_t - d/dx(E*A*u_x)=rho|    | - Hydrostatic intake/discharge heads       | |
|  | - Spatial step dx=10m (116 nodes, 3 tapers)|    | - Buoyancy & fluid pound fillage truncation| |
|  | - CFL subcycling: dt <= 0.8 * dx / c       |    | - Multi-stroke settling (3 strokes)        | |
|  | - Interface continuity: u_l=u_r, N_l=N_r   |    | - 144-point uniform crank phase resampling | |
|  +--------------------------------------------+    +--------------------------------------------+ |
|                                       ^                                                           |
|                                       | (Distributed Shear Drag beta(x,t) & Damping nu(x,t))      |
|  +--------------------------------------------+    +--------------------------------------------+ |
|  |      src/rheology.py (Multiphase Drag)     |    |    src/thermal.py (Boberg-Lantz Thermal)   | |
|  | - Two-Point Kelvin-Arrhenius Viscosity     |    | - Radial decay v_r(b^2) with Bessel quad & | |
|  |   mu(T) = exp(A + B/T)                     |    |   singularity limit lim(b^2->0) v_r = 1.0  | |
|  | - Water-cut mixing: mu_mix = mu(1-fw)+mu_w*|    | - Vertical slab factor v_z(w, h) with      | |
|  | - Couette shear drag beta(x,t) & damping nu|    |   singularity limit lim(w->0) v_z = 1.0    | |
|  +--------------------------------------------+    +--------------------------------------------+ |
+---------------------------------------------------------------------------------------------------+
                                                  ^
                                                  | (Telemetry, CSV Batches & Event Logging)
                                                  v
+---------------------------------------------------------------------------------------------------+
|                                      DATA ADAPTATION & AUDIT PROVENANCE                           |
|                                                                                                   |
|  +--------------------------------------------+    +--------------------------------------------+ |
|  |     src/adapter.py (Dynamic CSV Adapter)   |    |    src/audit.py (SHA-256 Event Ledger)     | |
|  | - Pydantic telemetry & well configuration  |    | - Cryptographic SHA-256 event chaining     | |
|  | - Regex heuristic column auto-mapping      |    | - Provenance tagging: [measured], [model], | |
|  | - Multi-unit SI conversion matrix (lbf->N) |    |   [synthetic], [calibrated]                | |
|  | - Fuzzy confidence scoring & validation    |    | - Immutable tamper-evident audit history   | |
|  +--------------------------------------------+    +--------------------------------------------+ |
+---------------------------------------------------------------------------------------------------+
```

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Boberg-Lantz Radial Decay $\bar{v}_r(b^2)$ | Analytical Bessel integral with exact singularity limit $\lim_{b^2 \to 0} \bar{v}_r = 1.0$ ($b^2 \le 10^{-10}$) and cached 1D cubic spline | M1 | survey |
| 2 | Boberg-Lantz Vertical Factor $\bar{v}_z(w,h)$ | Heat loss across overburden/underburden with $\lim_{w \to 0} \bar{v}_z = 1.0$ and `expm1` underflow protection | M1 | survey |
| 3 | Calibrated Temperature Clamping | $T_{\text{cal}}(t) = T_R + \hat{k}(t)[T_{\text{avg}}(t) - T_R]$ strictly clamped in $[T_R, T_s]$ across 1,000 randomized steps | M1 | survey |
| 4 | Arrhenius Two-Point Viscosity | Kelvin-Arrhenius dynamic viscosity calibrated at $50^\circ\text{C}$ ($12\text{ Pa}\cdot\text{s}$) and $200^\circ\text{C}$ ($0.045\text{ Pa}\cdot\text{s}$) | M2 | survey |
| 5 | Multiphase Water-Cut Viscosity Mixing | Dynamic linear emulsion mixing $\mu_{\text{mix}} = \mu_{\text{oil}}(1 - f_w) + \mu_{\text{water}} f_w$ | M2 | survey |
| 6 | Distributed Couette Shear Drag | $\beta(x,t) = f_{\text{eccentric}} \frac{2\pi \mu_{\text{mix}}}{\ln(r_{\text{tubing}}/r_{\text{rod}}(x))}$ with $f_{\text{eccentric}} = 1.25$ | M2 | survey |
| 7 | Mass Damping Ratio $\nu(x,t)$ | Damping per unit mass $\nu = \beta / (\rho A)$ clamped within $[0.01, 3.00]\text{ s}^{-1}$ | M2 | survey |
| 8 | 3-Section Tapered Rod Geometry | Discrete rod tally ($1.0\text{ in}$ 0-350m, $7/8\text{ in}$ 350-750m, $3/4\text{ in}$ 750-1150m, $E=2.07\times 10^{11}\text{ Pa}$, $\rho=7850\text{ kg/m}^3$) | M3 | survey |
| 9 | Strict CFL Time Subcycling | $\Delta x = 10\text{ m}$ ($N=116$), $\Delta t \le 0.8 \frac{\Delta x}{c} \approx 0.001558\text{ s}$ enforced rigorously across all tapers | M3 | survey |
| 10 | Finite-Volume Interface Continuity | Preserves displacement $u$ and force $EA \frac{\partial u}{\partial x}$ continuity with error $\Delta < 10^{-5}$ across taper interfaces | M3 | survey |
| 11 | Kinematic Surface Crank Boundary | Second harmonic crank kinematics: $u_0(t) = \frac{S}{2}[(1 - \cos\theta) + \frac{\lambda}{4}(1 - \cos 2\theta)]$ | M3 | survey |
| 12 | Plunger Boundary & Valve States | Traveling/standing valve switching logic, buoyancy, hydrostatic differential heads | M3 | survey |
| 13 | Fluid Pound Fillage Truncation | Downhole load impact truncation during incomplete pump fillage ($\phi_{\text{fill}} \in [0.1, 1.0]$) | M3 | survey |
| 14 | Multi-Stroke Settling & Resampling | 3-stroke settling to steady limit cycle and phase-resampling to 144 uniform crank-angle points for surface/downhole cards | M3 | survey |
| 15 | 12-Hour Fast-Loop Anti-Float MPC | QP optimization maximizing production, penalizing motor power and SPM variance; constraints: $F_{\min} \ge +0.5\text{ kN}$, $\text{PPRL} \le 90\%$, $1.0 \le \text{SPM} \le 5.5$ | M4 | survey |
| 16 | 3-Tier Failsafe State Machine | LEVEL-0 Normal (<10s), LEVEL-1 Degraded (10-60s), LEVEL-2 Protective Fallback (>60s or $F_{\min} < 0.5\text{ kN} \to$ ramp to 2.0 SPM in 3 strokes), LEVEL-3 E-Stop (PPRL > 95%) | M4 | survey |
| 17 | Pydantic Telemetry Data Adapter | Ingestion schemas with regex heuristic auto-mapping across aliases (`pos`, `prl`, `temp`, `bht`, `spm`) with confidence scoring | M5 | survey |
| 18 | Multi-Unit SI Conversion Matrix | Exact conversions for `lbf`, `klbf`, `psi`, `bar`, `degF`, `cP`, `gpm`, `bpd`, `ft`, `in` to SI base units | M5 | survey |
| 19 | SHA-256 Provenance Audit Ledger | Cryptographic block chaining with canonical JSON hashing, genesis block, and tamper detection | M5 | survey |
| 20 | Immutable Provenance Tagging | 4-tier provenance metadata tags (`[measured]`, `[model]`, `[synthetic]`, `[calibrated]`) | M5 | survey |
| 21 | High-Density Streamlit Dashboard | 1920x1080 dark theme operations dashboard with KPI ribbon, disturbance injection panel, A/B dynacards, 12h timeline, CSV port, audit ledger, and 23-well economic waterfall | M6 | survey |
| 22 | Configuration Management | YAML domain configuration (`configs/well_baghewala_14.yaml`) for Baghewala heavy oil well | M6 | survey |
| 23 | Offline Packaging & Launcher | `requirements.txt`, executable `run_demo.sh`, and industrial `README.md` for 100% offline execution | M6 | survey |
| 24 | E2E Testing Suite (Tiers 1-4) | Comprehensive unit, boundary, integration, and scenario tests covering 100% acceptance criteria | Test Track | survey |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Thermal Engine | `src/thermal.py` | None | PLANNED |
| M2 | Rheology & Drag | `src/rheology.py` | M1 | PLANNED |
| M3 | Wave Solver & Pump | `src/rod_conservative.py`, `src/pump_boundary.py` | M2 | PLANNED |
| M4 | MPC & Failsafe | `src/controller.py`, `src/failsafe.py` | M3 | PLANNED |
| M5 | Adapter & Audit | `src/adapter.py`, `src/audit.py` | None | PLANNED |
| M6 | Dashboard & Packaging | `app.py`, `configs/well_baghewala_14.yaml`, `run_demo.sh`, `requirements.txt`, `README.md` | M1, M2, M3, M4, M5 | PLANNED |
| E2E | E2E Testing Suite | `tests/conftest.py`, `tests/tier1_feature_coverage/`, `tests/tier2_boundary_corner_cases/`, `tests/tier3_cross_feature_combinations/`, `tests/tier4_real_world_workload_scenarios/` | None | PLANNED |
| M-Final | Acceptance & Adversarial Hardening | Full test pass (Phase 1) + Tier 5 Adversarial Coverage Hardening (Phase 2) | M6, E2E | PLANNED |

## Interface Contracts
### `src/thermal.py` ↔ `src/rheology.py`
- Function: `ThermalDecayEngine.temperature_calibrated(tau_seconds: float, k_hat: float = 1.0) -> float`
- Return: Bottomhole temperature $T_{\text{cal}}$ in Kelvin ($321.15\text{ K} \le T_{\text{cal}} \le 533.15\text{ K}$).

### `src/rheology.py` ↔ `src/rod_conservative.py`
- Functions:
  - `HeavyOilRheology.mixture_viscosity(T_K: float, fw: float) -> float`
  - `HeavyOilRheology.couette_drag_beta(mu_mix: float, r_rod: float) -> float`
  - `HeavyOilRheology.damping_nu(beta: float, A_rod: float) -> float`
- Return: $\beta(x,t)$ in $\text{N}\cdot\text{s/m}^2$, $\nu(x,t) \in [0.01, 3.00]\text{ s}^{-1}$.

### `src/rod_conservative.py` ↔ `src/pump_boundary.py`
- Downhole dynamic force coupling: `PlungerBoundary.compute_plunger_force(v_plunger: float, u_plunger: float, S: float, theta: float, fillage: float) -> Tuple[float, str]`
- Returns $(F_{\text{plunger}}, \text{valve\_state})$.

### `src/rod_conservative.py` ↔ `src/controller.py`
- Function: `ConservativeRodWaveSolver.solve_stroke_cycle(SPM: float, stroke_length: float, T_res_K: float, fw: float, fillage: float) -> DynacardResult`
- Returns `DynacardResult` with `min_tension_N`, `pprl_N`, `surface_load_N`, `downhole_load_N`, `theta_deg` (144 points).

### `src/controller.py` & `src/failsafe.py` ↔ `app.py`
- MPC controller computes optimal SPM trajectory subject to $F_{\min} \ge 0.5\text{ kN}$; failsafe machine tracks latency and overrides to 2.0 SPM on $>60\text{s}$ latency or tension drop.

### `src/audit.py` ↔ All Modules & `app.py`
- Function: `AuditLedger.record_event(event_type: str, provenance: str, payload: dict) -> AuditBlock`
- Provenance tags: `[measured]`, `[model]`, `[synthetic]`, `[calibrated]`.

## Code Layout
```
/home/DK_TECH/sih final/
├── ORIGINAL_REQUEST.md                  # Authoritative user requirements
├── PROJECT.md                           # Master project architecture & status
├── TEST_INFRA.md                        # E2E test suite specifications
├── requirements.txt                     # 100% offline pinned dependencies
├── run_demo.sh                          # Executable demo script
├── README.md                            # Industrial documentation
├── configs/
│   └── well_baghewala_14.yaml           # Complete Baghewala-14 domain configuration
├── src/
│   ├── __init__.py
│   ├── thermal.py                       # R1: Reservoir Thermal Decay Engine
│   ├── rheology.py                      # R2: Non-Newtonian Rheology & Couette Drag
│   ├── rod_conservative.py              # R3: 1D Wave PDE Solver & Interface Continuity
│   ├── pump_boundary.py                 # R3: Plunger Valve Dynamics & Fluid Pound
│   ├── controller.py                    # R4: Fast-Loop Anti-Float MPC Controller
│   ├── failsafe.py                      # R4: 3-Tier/4-Level Failsafe State Machine
│   ├── adapter.py                       # R5: Pydantic Schema & CSV Auto-Mapping
│   └── audit.py                         # R5: SHA-256 Provenance Audit Ledger
├── tests/
│   ├── __init__.py
│   ├── conftest.py                      # Test fixtures & YAML loader
│   ├── tier1_feature_coverage/          # R1-R5 Feature tests
│   ├── tier2_boundary_corner_cases/     # Boundary, singularity & continuity tests
│   ├── tier3_cross_feature_combinations/# Disturbance chains & failsafe transitions
│   └── tier4_real_world_workload_scenarios/# 24-hr CSS & 23-well economic tests
└── app.py                               # R6: High-Density Streamlit Dashboard
```
