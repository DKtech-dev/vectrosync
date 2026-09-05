# VectroSync Pilot Proposal

## Proposal

Evaluate VectroSync as an evidence-aware CSS–SRP advisory research prototype through a governed retrospective study and read-only shadow pilot.

## Current deliverable

A working React/FastAPI/Streamlit demonstrator integrating thermal and rheology assumptions, reduced-order rod-load cards, explicit governor feasibility, supervisory logic, telemetry quality gates, provenance, and transparent commercial sensitivity. The repository passes 271 tests and a production frontend build.

## Explicit exclusions

No field calibration, HIL verification, active Modbus connection, actuator authority, safety certification, trained PINN, guaranteed outcome, or official operator affiliation.

## Work packages

1. **Data governance and qualification:** ownership, confidentiality, timestamp/unit/channel audit, intervention taxonomy.
2. **Retrospective validation:** train/calibrate on historical period; blind holdout by cycle/well; compare against simple and incumbent baselines.
3. **Model improvement:** uncertainty, true transient structural solver benchmarks, drift and residual monitoring.
4. **Shadow deployment:** read-only ingestion; operator recommendations; acceptance/rejection capture; weekly safety review.
5. **Business validation:** intervention, energy, deferment, adoption, and lifecycle cost with approved accounting.

## Success criteria

Pre-agreed thresholds for temperature/load/card error, interval coverage, event precision/recall, lead time, false alarms per well-month, availability, stale-data rejection, operator acceptance, and economic downside/base/upside evidence.

## Governance

Independent PLC/SIS retains final authority. Any later actuation requires HAZOP/LOPA, HIL fault injection, cybersecurity approval, MOC, rollback procedures, training, and an independent competent-person review.

## Decision requested

Approve a limited data-qualification workshop and retrospective feasibility study—not a production control deployment.
