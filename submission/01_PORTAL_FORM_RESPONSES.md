# Portal Form Responses — Evidence-Safe Version

## Project

- **Name:** VectroSync
- **Category:** Industrial analytics / digital-twin research prototype
- **Stage:** TRL 3–4 software demonstrator; no field or HIL validation
- **Repository validation:** 271 automated tests passing; React production build passing
- **Control authority:** Advisory only; no actuator write path

## Problem statement (≤200 words)

Thermal recovery and sucker-rod pumping are often analyzed in separate workflows. As a CSS well cools, fluid mobility and apparent viscosity can change significantly, altering annular drag and dynamometer-card behavior. Operators need earlier, explainable indications of changing load risk, but a credible solution must also distinguish model output from measurements, reject poor telemetry, report uncertainty and infeasibility, and preserve independent safety authority. VectroSync addresses this workflow gap through an integrated research prototype. It does not assert a measured failure rate or operator loss for Baghewala; those quantities require intervention history, allocated production, energy meters, and approved cost data.

## Proposed solution (≤250 words)

VectroSync is a full-stack synthetic advisory twin. A thermal research model estimates average heated-zone cooldown. Two-point Arrhenius and empirical water-cut relations estimate viscosity, which feeds a Couette drag assumption and a reduced-order phase-resolved rod-load card. A 12-hour speed governor applies operating bounds, per-hour slew limits, and reduced-order tension/PPRL constraints. Unlike the previous prototype, it explicitly reports infeasible trajectories and constraint residuals rather than labeling every result optimal. The proposed speed is checked against the same card model displayed in the console before a four-level supervisory software state is assigned.

The React and Streamlit interfaces expose scenario comparison, cards, depth/phase visualization, forecast, telemetry ingestion, provenance, and low/base/high commercial assumptions. Every API simulation identifies itself as synthetic, unvalidated, and advisory only. CSV ingestion fails closed for missing channels, bad timestamps, non-finite values, excessive gaps, ambiguous mappings, and physical-range violations. A thread-safe SHA-256 chain demonstrates in-process tamper evidence.

A credible deployment path begins with retrospective held-out validation and read-only shadow mode. PLC/VFD authority, hard trips, and functional-safety credit remain in independently engineered controls.

## Use of AI (≤250 words)

The submitted operational path is deterministic; it does not rely on a trained AI model. The repository contains an experimental SIREN-shaped surrogate and Extended Kalman Filter research module. SIREN weights are randomly initialized and therefore disabled as learned evidence by default; predictions use the analytical prior unless a future version loads a versioned, trained, independently validated artifact. The EKF rejects non-finite data and uses a numerically safer covariance update, but its observation coefficients remain synthetic and it is not integrated into the control path.

Future AI work would train only on governed historical data, reserve wells/cycles for blinded validation, compare against simple baselines, report calibration/coverage and drift, and retain deterministic safety envelopes. This explicit separation prevents “AI” branding from obscuring model status.

## Innovation

The defensible innovation is workflow integration: CSS thermal hypotheses → viscosity-sensitive SRP surveillance → explicit constraint feasibility → explainable operator advice → safety/data-quality gates → provenance and pilot economics. Component-level novelty and freedom to operate require a formal prior-art review.

## Expected impact

Impact is a hypothesis to test. `src/economics.py` provides low/base/high cases with visible assumptions for avoided workovers, energy, deferment recapture, and platform cost. No value, payback, failure reduction, or emissions outcome is represented as realized. The proposed pilot measures predictive error, event precision/recall, lead time, false alarms, energy per produced barrel, interventions, deferment, operator acceptance, and full implementation cost.

## Evidence

- 271/271 tests passed locally.
- Frontend production build passed.
- Streamlit full-script import smoke test passed.
- No field dataset, HIL report, Modbus register map, or trained model artifact is included.
