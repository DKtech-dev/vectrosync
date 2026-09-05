# E2E Test Infra: Well-to-Surface Digital Twin

> **Historical test design.** The current suite count and interpretation are in `README.md` and `submission/07_TEST_VERIFICATION_LOG.txt`; passing tests do not establish field validity or functional safety.

## Test Philosophy
- Opaque-box, requirement-driven. Derived from `ORIGINAL_REQUEST.md`.
- Methodology: Category-Partition + Boundary Value Analysis (BVA) + Pairwise Combinatorial Testing + Real-World Workload Scenarios.
- 100% automated offline test execution via `pytest tests/`.

## Feature Inventory
| # | Feature | Source (requirement) | Tier 1 | Tier 2 | Tier 3 |
|---|---------|---------------------|:------:|:------:|:------:|
| 1 | Boberg-Lantz Radial Decay $\bar{v}_r(b^2)$ | ORIGINAL_REQUEST § R1 | 5 | 5 | ✓ |
| 2 | Boberg-Lantz Vertical Factor $\bar{v}_z(w, h)$ | ORIGINAL_REQUEST § R1 | 5 | 5 | ✓ |
| 3 | Calibrated Temperature Clamping | ORIGINAL_REQUEST § R1 | 5 | 5 | ✓ |
| 4 | Arrhenius Two-Point Dynamic Viscosity | ORIGINAL_REQUEST § R2 | 5 | 5 | ✓ |
| 5 | Multiphase Water-Cut Viscosity Mixing | ORIGINAL_REQUEST § R2 | 5 | 5 | ✓ |
| 6 | Distributed Couette Shear Drag $\beta(x,t)$ | ORIGINAL_REQUEST § R2 | 5 | 5 | ✓ |
| 7 | Mass Damping Ratio $\nu(x,t)$ | ORIGINAL_REQUEST § R2 | 5 | 5 | ✓ |
| 8 | 3-Section Tapered Rod Geometry | ORIGINAL_REQUEST § R3 | 5 | 5 | ✓ |
| 9 | Strict CFL Time Subcycling | ORIGINAL_REQUEST § R3 | 5 | 5 | ✓ |
| 10 | Finite-Volume Interface Continuity | ORIGINAL_REQUEST § R3 | 5 | 5 | ✓ |
| 11 | Kinematic Surface Crank Boundary | ORIGINAL_REQUEST § R3 | 5 | 5 | ✓ |
| 12 | Plunger Valve States & Hydrostatic Head | ORIGINAL_REQUEST § R3 | 5 | 5 | ✓ |
| 13 | Fluid Pound Fillage Truncation | ORIGINAL_REQUEST § R3 | 5 | 5 | ✓ |
| 14 | Multi-Stroke Settling & 144-Point Card | ORIGINAL_REQUEST § R3 | 5 | 5 | ✓ |
| 15 | 12-Hour Fast-Loop Anti-Float MPC | ORIGINAL_REQUEST § R4 | 5 | 5 | ✓ |
| 16 | 3-Tier Failsafe State Machine | ORIGINAL_REQUEST § R4 | 5 | 5 | ✓ |
| 17 | Pydantic Schema & Fuzzy Column Mapping | ORIGINAL_REQUEST § R5 | 5 | 5 | ✓ |
| 18 | Multi-Unit SI Conversion Matrix | ORIGINAL_REQUEST § R5 | 5 | 5 | ✓ |
| 19 | Cryptographic SHA-256 Block Chaining | ORIGINAL_REQUEST § R5 | 5 | 5 | ✓ |
| 20 | Immutable Provenance Tagging | ORIGINAL_REQUEST § R5 | 5 | 5 | ✓ |

## Test Architecture
- Test Runner: `python3 -m pytest tests/ -v`
- Pass/Fail Semantics: 100% passing tests with exit code 0.
- Directory Layout:
  - `tests/conftest.py`: Configuration fixtures, sample CSV files, synthetic telemetry.
  - `tests/tier1_feature_coverage/`: 8 test modules covering all features in isolation (>=5 tests per module).
  - `tests/tier2_boundary_corner_cases/`: 5 test modules covering singularity asymptotic limits, taper interface continuity ($< 10^{-5}$ error), extreme temperatures (1,000 randomized steps), CFL rejection, and corrupt data.
  - `tests/tier3_cross_feature_combinations/`: 3 test modules covering causal cooling disturbance chain, live A/B baseline vs twin dynacards, and Modbus telemetry dropout trip.
  - `tests/tier4_real_world_workload_scenarios/`: 3 test modules covering full 24-hr CSS cooldown simulation, 23-well economic waterfall arithmetic, and CSV drag-and-drop end-to-end replay.

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | 24-Hr CSS Cooldown Dynamic Simulation | F1-F7, F8-F16, F19-F20 | High |
| 2 | 23-Well Baghewala Fleet Economic Waterfall | F15-F16, F21-F23 | Medium |
| 3 | End-to-End Raw SCADA CSV Ingestion & Dynacard Replay | F17-F18, F8-F14, F19-F20 | High |

## Coverage Thresholds
- Tier 1: ≥40 test cases across 8 test suites.
- Tier 2: ≥25 test cases across 5 test suites.
- Tier 3: ≥10 cross-feature tests across 3 test suites.
- Tier 4: ≥5 realistic workload scenario tests across 3 test suites.
- Total Target: ≥80 passing tests.
