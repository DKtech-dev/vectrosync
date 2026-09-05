# Business Case — Hypothesis and Pilot Economics

No commercial outcome in this document is realized or operator-validated.

## Value equation

Annual net value is modeled as:

\[
V=N_w(\lambda_b-\lambda_r)C_w
+N_w E_d 365 C_e
+N_w D_a q_o P_o FX
-C_p.
\]

Where failures, cost/event, energy reduction, avoided downtime, deferred oil rate, oil price, FX, and platform cost are explicit assumptions. The model avoids double-counting sustained uplift and downtime recapture.

## Cases

`src/economics.py` contains immutable low/base/high assumptions and returns every input with each result. The base values—23 wells, 2.40→0.35 failures/well-year, ₹850k/event, 48 kWh/well-day, 18 avoided days, 42 BOPD deferred rate, $75/bbl, ₹83.5/$, ₹3.0m platform cost—are planning hypotheses only.

Do not quote the resulting point value without the full assumption table and sensitivity range.

## Evidence required

- coded intervention history and causal failure classification;
- full workover cost including logistics and approved deferment accounting;
- allocated well tests and uptime;
- revenue-grade energy baseline normalized by production;
- implementation, cybersecurity, support, and lifecycle cost;
- pilot counterfactual or matched-control design;
- confidence intervals and downside case.

## Commercialization sequence

1. paid data-qualification and retrospective study;
2. read-only shadow pilot with success gates;
3. engineering integration only after model and cyber approval;
4. supervised limited actuation only after HAZOP/LOPA, HIL, SIS, MOC, and rollback evidence;
5. fleet expansion after statistically and financially reviewed results.

See `docs/COMMERCIAL_CASE.md` for metrics and experimental design.
