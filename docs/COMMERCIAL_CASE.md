# Commercial Case and Pilot Design

## Positioning

Catenary's defensible novelty is not a claim that predictive rod-pump control, thermal EOR modeling, or digital twins are individually new. The differentiated thesis is:

> An auditable operator workflow that connects CSS thermal-state hypotheses to viscosity-sensitive SRP load surveillance, constraint-aware speed advice, explainable scenario comparison, and explicit evidence provenance.

That integration thesis should be tested against incumbents and prior art before any patent or “industry first” statement.

## Economic model

`src/economics.py` evaluates low/base/high planning cases. Each result includes every assumption, avoided failures, recaptured barrels, component values, platform cost, and evidence status.

The model intentionally distinguishes:

- **workover cost avoidance** from fewer rod failures;
- **energy savings** from reduced consumption;
- **deferment recapture** from avoided downtime at the well's ordinary oil rate.

It does not simultaneously count a continuous production uplift unless a separate causal field study supports one.

### Base-case hypotheses

| Assumption | Base value | Evidence required |
|---|---:|---|
| Wells | 23 | Current operator well inventory |
| Baseline failures | 2.40/well-year | 3–5 years of coded intervention history |
| Residual failures | 0.35/well-year | Controlled pilot/post-period estimate |
| Workover cost | ₹850,000/event | Contracts, materials, rig, logistics, deferred production rules |
| Energy saving | 48 kWh/well-day | Revenue-grade meter baseline with weather/production adjustment |
| Avoided downtime | 18 days/well-year | Event-level production accounting |
| Deferred oil rate | 42 BOPD | Allocated well tests with uncertainty |
| Oil price / FX | $75/bbl / ₹83.5/$ | Finance-approved planning deck |
| Annual platform cost | ₹3,000,000 | Vendor implementation and support quote |

These are hypotheses, not facts about Oil India Limited or Baghewala.

## Pilot proposal

### Phase 0 — Data qualification (4–6 weeks)

- sign data-use, confidentiality, cybersecurity, and non-affiliation terms;
- inventory sensors, timestamps, units, historians, dynacard quality, and interventions;
- agree success metrics and a frozen evaluation protocol;
- perform prior-art and freedom-to-operate review.

### Phase 1 — Offline retrospective (6–8 weeks)

- train/calibrate on earlier cycles only;
- evaluate on held-out cycles/wells;
- compare against persistence, threshold, and incumbent baselines;
- quantify false alarms, missed events, lead time, load/card errors, and uncertainty coverage.

**Go/no-go:** statistically useful lead time without unacceptable false alarms, plus stable predictions across held-out wells.

### Phase 2 — Shadow mode (8–12 weeks)

- read-only historian integration;
- recommendations visible to engineers but no automatic write path;
- capture operator acceptance/rejection and rationale;
- weekly model drift and safety review.

**Go/no-go:** pre-agreed availability, calibration, alarm burden, and economic leading indicators.

### Phase 3 — Supervised limited actuation

Only after HAZOP/LOPA, MOC, independent SIS review, HIL fault injection, cybersecurity approval, rollback procedures, and operator training. Actuation limits remain in the PLC/SIS, not this application.

## Measurement plan

Primary technical metrics:

- temperature MAE/bias and 90% interval coverage;
- PPRL/MPRL and card-shape error;
- float-risk event precision, recall, lead time, and false alarms per well-month;
- recommendation feasibility under an independent model;
- API availability, stale-data rejection, and recovery time.

Commercial metrics:

- intervention frequency and severity;
- deferred barrels recaptured using approved allocation rules;
- metered kWh per produced barrel;
- operator time per diagnosis;
- implementation/support cost.

Use matched wells or stepped-wedge deployment where randomization is impractical. Publish confidence intervals, not only point estimates.
