# Assurance Case

This document uses a lightweight Goal Structuring Notation style to distinguish demonstrated software properties from future engineering claims.

## Top claim

> **G0:** Catenary 2.0.0 is a reproducible synthetic advisory prototype suitable for software evaluation and planning a shadow-mode validation campaign.

It does **not** claim fitness for direct well control, functional-safety credit, field accuracy, or realized commercial savings.

## Argument and evidence

| ID | Claim | Evidence | Status |
|---|---|---|---|
| G1 | The repository is buildable and testable | `requirements-dev.txt`, `frontend/package-lock.json`, CI workflow, pytest and Vite commands | Demonstrated in local validation |
| G2 | Core scalar models enforce input/boundary checks | Unit and boundary tests under `tests/`; new `test_assurance_regressions.py` | Demonstrated for tested domains |
| G3 | The thermal radial spline is checked against independent quadrature | `ThermalDecayEngine.radial_factor(use_fast_spline=False)` and regression test | Demonstrated numerically over sampled range |
| G4 | The governor does not report violated trajectories as optimal | Explicit residuals/status in `src/controller.py`; extreme-viscosity regression | Demonstrated for implemented surrogate |
| G5 | CSV ingestion fails closed for missing channels, bad time order, non-finite values, and physical-range violations | `src/adapter.py`; assurance regressions | Demonstrated for configured schema/ranges |
| G6 | Concurrent in-process audit appends preserve hash-chain ordering | `RLock` in `src/audit.py`; 500-event concurrency regression | Demonstrated in one process only |
| G7 | API outputs identify synthetic/advisory limitations | `control_authority` and `model_status` in every simulation response | Demonstrated |
| G8 | Commercial arithmetic is internally traceable | Immutable assumptions and low/base/high cases in `src/economics.py` | Demonstrated arithmetic; benefits unvalidated |
| G9 | Deployment defaults reduce avoidable exposure | Optional API key, CORS allowlist, upload/WebSocket limits, non-root container, localhost Compose bindings | Implemented; penetration test not performed |

## Defeaters and controls

| Defeater | Why it matters | Current control | Closure evidence required |
|---|---|---|---|
| D1: model-form error | Synthetic cards may not represent downhole mechanics | Advisory-only labeling; explicit model card | Blinded field comparison and uncertainty bounds |
| D2: common-model safety failure | Governor and checker can share bad assumptions | Displayed card is rechecked, but still same software family | Independent plant model/HIL and independent SIS |
| D3: invalid configuration | Conflicting limits can invalidate decisions | Configuration is labeled synthetic; critical runtime values are explicit | Typed single-source config and operator sign-off |
| D4: audit rewrite/restart loss | In-memory hashes are not immutable records | Claims restricted to in-process tamper evidence | Signed durable append-only store and external anchoring |
| D5: cyber compromise | Public endpoints can be abused | Optional key, bounded inputs/fanout, reduced CORS | mTLS/OIDC, RBAC, gateway rate limiting, OT segmentation, pen test |
| D6: economic optimism | Point estimates can mislead investment | Low/base/high model and evidence status | Procurement, production, failure, and pilot data |
| D7: affiliation confusion | Branding could imply operator approval | UI/readme disclaimer | Written authorization before using operator marks or deployment claims |

## Verification hierarchy

1. **Unit/property checks:** dimensions, bounds, monotonicity, finite values.
2. **Numerical verification:** independent quadrature, convergence, conservation residuals.
3. **Model validation:** held-out field measurements and uncertainty coverage.
4. **Control validation:** independent plant, Monte Carlo, SIL/HIL, fault injection.
5. **Operational assurance:** HAZOP/LOPA, cybersecurity, MOC, training, incident response.

The repository currently has meaningful evidence at levels 1–2 for selected components. Levels 3–5 remain future gates.

## Release gate

A release may retain the label **research prototype** when tests/build pass and the limitations remain visible. The labels **field validated**, **HIL verified**, **autonomous**, **safety guaranteed**, or **production ready** require linked evidence reviewed by an independent competent person.
