# Catenary (formerly VectroSync) → Top-Notch: The Complete Plan

> **Purpose.** Turn VectroSync from *"a well-crafted prototype whose presentation runs ahead of its
> substance"* into a **defensible, validated, no-regret engineering artifact** — one that survives a
> hostile domain expert and stands on its own regardless of the venue you pick later.
>
> **Sources for this plan:** (1) live code analysis of `src/`, `backend/`, `frontend/`; (2) the in-repo
> sourced landscape audit [`A Defensible CSS-SRP Digital Twin That Can Win.md`](A%20Defensible%20CSS-SRP%20Digital%20Twin%20That%20Can%20Win.md)
> (40 references: ChampionX, Weatherford, SLB, Baker Hughes, Ambyint + Safari, Cheng, Teodoriu,
> Eisner & Langbauer, USTAR); (3) `ORIGINAL_REQUEST.md` and `docs/MODEL_CARD.md`.
> Web search was unavailable when this was written — see the last section for what to re-verify online.

---

## 0. The one-paragraph thesis

The project's fatal-if-unfixed weakness is a **vocabulary-vs-substance gap**: the code advertises a
transient wave solver, an MPC optimizer, and a PINN, but ships a 144-point *algebraic* card estimator,
a closed-form *surrogate* with a clamp, and an *untrained* network that discards its own output. A sharp
judge finds this in ten minutes — and your own "hostile jury" list predicts exactly that. **The entire
plan reduces to one move: make the substance match the words, then earn the right to every claim through
a tiered validation ladder.** Everything else — UI polish, more features — is secondary and, right now,
a trap.

**The ceiling (be honest with yourself):** executed perfectly *without real field data*, the ceiling is
"**excellent, validated-in-simulation twin + genuinely novel auditable integration + credible pilot
proposal.**" That is legitimately top-tier for a solo/small-team engineering project. The single biggest
lever that raises the ceiling further is **getting any real or public benchmark data** (§7).

---

## 1. Guiding principle: earn every claim (the maturity ladder)

Adopt this four-tier language and never let a claim outrun its tier. This one discipline is what makes it
"no-regret."

| Tier | Evidence required | Permitted wording |
|---|---|---|
| **T1 Unit-verified** | Analytical limits, dimensions, conservation, CFL, taper continuity | "The implementation satisfies these numerical tests." |
| **T2 Synthetic-validated** | Known latent params recovered across seeded disturbances + noise | "Recovered in simulation under stated noise and model mismatch." |
| **T3 Historical replay** | Blind held-out real/benchmark cards, no actuation | "Retrospectively detected/forecast the event." |
| **T4 Prospective pilot** | Shadow mode → approved limited actuation | "Demonstrated on these wells under this envelope." |

Today the project is a partial **T1**. The plan drives it to a solid **T2**, with a real path to **T3**.

---

## PHASE 0 — Credibility triage (fix what discredits you) · ~3–5 days · **do first**

These are cheap, and each one is a landmine a reviewer *will* step on. Fixing them buys disproportionate trust.

| # | Fix | Where | Why it matters |
|---|---|---|---|
| 0.1 | **One rod rating, one source of truth.** Collapse the three coexisting ratings (314.15 / 282.7 / 110 kN) into the typed config; derive everywhere. | `src/failsafe.py`, `src/controller.py` (`MPCConfig`), `backend/server.py:205`, `app.py:288`, `configs/` | Three ratings = "they don't understand their own limits." Instant credibility hit. |
| 0.2 | **Kill the hardcoded 66 °C.** Scenarios A/B must flow through the thermal model like everything else, or the scenario must physically *produce* 66 °C. | `backend/server.py:220-222` | This is a synthetic override in a project whose whole thesis is "no synthetic overrides" (your own R3). |
| 0.3 | **Make API and Streamlit agree.** They compute different temperatures for the "same" scenario because only the API pins 66 °C. Single physics entry point. | `backend/server.py` vs `app.py` | Two front-ends disagreeing on the headline number destroys trust in a live demo. |
| 0.4 | **Fix auth-breaks-UI.** Frontend must send `X-API-Key` when configured, or document that the key is off in demo mode. | `frontend/src/App.jsx`, `CsvIngestor.jsx`, `AuditLedgerView.jsx` | Enabling `VECTROSYNC_API_KEY` currently 401s the entire console. |
| 0.5 | **WebSocket: wire it or remove it.** Either make the console consume `/ws/live-stream` for real live telemetry (preferred — see Phase 4), or delete the "live" framing. | `backend/server.py:614`, `frontend/src/` (no consumer today) | "Live" that isn't live is the easiest overclaim to expose. |
| 0.6 | **Remove phantom fields & dead code.** `edge_solve_time_ms` never exists; `pump_boundary.py` is imported everywhere but never called. Delete or activate. | `App.jsx:54,77`; `src/pump_boundary.py`, `src/rod_conservative.py:15` | Dead imports and phantom fields read as "unfinished / untidy." |
| 0.7 | **Failsafe: make the real one live.** The stateful latching/ramp `evaluate` is test-only; the live path uses the snapshot `evaluate_state`. Put the real state machine on the request path. | `src/failsafe.py:118` vs `:240` | You demo a "3-tier state machine" that isn't the one actually running. |

**Phase 0 done =** no synthetic overrides, one config source, the app works with auth on, and every
number on screen comes from the same physics the docs describe.

---

## PHASE 1 — Make the substance real · ~3–5 weeks · **the heart of the project**

This is where "presentation ahead of substance" gets fixed. Use **multi-fidelity**: keep the fast
estimator, but back it with a real solver and label which is which.

### 1.1 A genuine transient tapered-rod solver (the flagship deliverable)
Right now `simulate_card` never time-marches. Build the real thing next to it.
- Implement the **conservative variable-area damped wave PDE**:
  `ρA(x)·u_tt + β(x,t)·u_t − ∂/∂x[EA(x)(u_x − α_s·ΔT_rod)] = ρA(x)·g + f_contact`
- **CFL-safe subcycling**: `c=√(E/ρ)≈5,050 m/s`, `dx=10 m` ⇒ `dt ≤ 0.8·dx/c ≈ 1.56 ms`. The 144 card
  points are *output samples*, not timesteps — subcycle internally, then phase-resample.
- **Taper interface continuity**: enforce `u_left=u_right` and `N=EA·u_x` continuous at each section
  boundary (1.0″ / 0.875″ / 0.75″). Impedance changes create reflections; do not average diameters.
- **Boundaries**: prescribe *only* top kinematics (crank) + a downhole *force* balance (pump). Never
  prescribe both downhole displacement and force in the forward problem.
- **Keep the algebraic estimator** as an explicitly-labeled "fast surrogate, tensile-envelope only."
- **T1 validation gate (all in CI):** manufactured-solution test, grid/time convergence study,
  undamped energy conservation, static equilibrium, taper force-continuity `< 1e-5`, CFL-violation
  rejection. → *File:* `src/rod_transient.py` + `tests/test_rod_convergence.py`.

### 1.2 A real constrained optimizer (make "MPC" true)
`FastMPCController.solve` is surrogates + a clamp and never calls the card model.
- Replace with an **actual constrained optimization** (OSQP after linearization, or CasADi NLP) that
  uses the ROM/solver in the loop.
- **Robust (uncertainty-tightened) constraints** with slacks for feasibility:
  `E[F_min] − z·σ(F_min) + s ≥ 0.5 kN`; `E[F_peak] + z·σ(F_peak) − s ≤ 0.9·F_rating`; SPM bounds; slew limit.
- Keep the surrogate as a **warm start**, not the answer. Keep `INFEASIBLE_SAFE_FALLBACK` honesty.
- **Never let the optimizer soften a hardware limit** — that stays in the independent supervisor.
- → *File:* `src/mpc.py` (real solver) wrapping the ROM; retire the surrogate to `mpc_surrogate.py`.

### 1.3 Thermal: calibration with uncertainty (keep the good parts)
The thermal model is your *strongest* real component — keep the exact singular limits and quadrature
verification. Upgrade the correction:
- Replace any fixed bias with a **fitted rise-multiplier `k(t)`** via regularized least squares against
  reference points, and **propagate residual variance**. Never divide a Celsius temperature by 1.42;
  calibrate the *rise* `(T−T_R)`.
- → *File:* `src/thermal.py` (extend, don't rewrite).

### 1.4 Rheology: bound it honestly
- Clamp Arrhenius to the **tested interval**; label the Brinkman-Vand emulsion branch as a *synthetic
  constitutive assumption* (mostly done). Add a multi-point/PVT hook for when lab data appears.
- Derive drag first (`β=2π·f_ecc·μ/ln(r_t/r_r)`), then `ν=β/(ρA)` in `1/s`. Kill any unexplained clip.

### 1.5 Estimator: train it or demote it
An untrained PINN that discards its own output is indefensible.
- **Option A (preferred):** train the surrogate/EKF on the synthetic ground truth from §2.1 and report
  parameter-recovery accuracy. **Option B:** rename it "analytical prior" and stop calling it a PINN.
- → *File:* `src/state_estimator.py`.

**Phase 1 done =** the words "wave solver," "MPC," and "estimator" are all *literally true*, each with a
passing numerical-verification test, and the fast paths are labeled as surrogates.

---

## PHASE 2 — The validation ladder (earn the claims) · ~2–3 weeks · **what makes it "no-regret"**

### 2.1 Coupled synthetic generator with latent truth (T2)
Build a reproducible experiment, not fake evidence.
- Seeded pipeline: injection schedule → Boberg-Lantz T → Arrhenius μ → distributed drag → CFL-safe rod
  PDE → surface+downhole cards → *then* add measurement effects (correlated load noise, encoder drift,
  jitter, quantization, dropouts). Save **both** latent truth and noisy observations.
- Inject faults through **physical states** (cooling, water cut, gas, fluid pound, wear), never by drawing
  card shapes.
- → *File:* `src/generator.py` (currently unused — make it the validation backbone) + `data/` seeds.

### 2.2 The deterministic shared-seed A/B experiment (your headline result)
- Baseline (card-only) and coupled controller receive the **same latent disturbances and the same noise
  seed**. Show the coupled branch holds tension `≥ 0.5 kN` where the baseline floats negative.
- This is the single most persuasive thing you can build. If the seeds differ, it's theater — make them
  identical and say so on screen.

### 2.3 Metrics + protocol (T2→T3)
- Freeze model/thresholds *before* scoring. Report: min-tension error, peak-load error, card
  reconstruction error, false-trip rate/well-day, missed events. Split by well/time, **never** random cards.

### 2.4 Multi-fidelity discrepancy bound
- Use a heavier offline model (or **published 3D-FEM results**, e.g. Eisner & Langbauer) to bound the
  reduced model's error near compression. Cite it; don't pretend the reduced model is exact.

### 2.5 Historical replay if data exists (T3)
- If you obtain public/benchmark dynacards (§7), run blind retrospective detection. This is the jump from
  "excellent prototype" to "demonstrated."

**Phase 2 done =** a one-command, seeded A/B experiment with a metrics table, plus a discrepancy bound —
i.e. defensible **T2** with the machinery for **T3**.

---

## PHASE 3 — Positioning & defensible novelty · ~2–3 days · (mostly writing; research already done)

- **Delete every overclaim:** "first SRP digital twin," "all commercial tools are reactive," any global
  patent-absence claim. (Your own audit lists these as instant-death.)
- **Adopt the narrow novelty statement** verbatim from the Win doc §2: *"prior art exists for every
  component separately; we did not identify a public implementation that closes the loop from a
  calibrated CSS thermal-state forecast → temperature-dependent tapered-rod mechanics →
  uncertainty-tightened SRP speed commands. Our contribution is this auditable integration."*
- Add a **prior-art appendix** (search method, databases, dates) so the review is inspectable.
- Reframe as **multi-fidelity, uncertainty-aware, auditable integration** — that's the true, winning story.

---

## PHASE 4 — The demonstration (where it actually wins) · ~3–5 days

- **Live A/B** (§2.2) as the centerpiece: judge moves a slider (cooling / water cut), both branches react
  from the same seed.
- **Live failure injection:** pull the Modbus/telemetry feed → data age rises → adaptation freezes →
  failsafe ramps to fallback → optimizer output cannot bypass the supervisor. This proves you understand
  *operational failure*, not just nominal prediction — more persuasive than any AI graphic.
- **Real live streaming:** consume the `/ws/live-stream` you fixed in 0.5 so "live" is true.
- **Provenance legend on screen:** measured / model / calibrated / synthetic, always visible.
- **Reproducible fallback video** from the same seed; run the live version first.

---

## Cross-cutting foundations (thread through all phases)

- **One typed config** = single source for geometry, section tally, limits, fluid props, units.
  (Kills 0.1/0.3 at the root.) → `configs/well_baghewala_14.yaml` becomes authoritative + validated by Pydantic.
- **Reproducibility:** fixed seeds, pinned deps (done), container (done), one-command cold start, saved
  latent+observed data.
- **Provenance & audit:** keep the SHA-256 chain; state clearly it's *tamper-evident, not authenticated*;
  note HMAC/signing is the pilot upgrade.
- **CI:** extend beyond "273 pass" to gate the new **convergence / conservation / CFL / A/B-recovery**
  tests. Add coverage reporting.
- **Safety framing:** keep advisory-only; keep the independent-supervisor separation; keep "not IEC 61511."

---

## The critical path & sequencing

```
Phase 0 (triage)  ──►  Phase 1.1 rod solver ──►  Phase 1.2 real MPC ──►  Phase 2 validation ──►  Phase 4 demo
   3–5 d               1.5–2 wk                    1 wk                    2–3 wk                  3–5 d
                    (1.3/1.4/1.5 run in parallel with 1.1)      Phase 3 positioning runs in parallel throughout
```

**Rough total:** ~6–9 weeks focused solo. The rod solver (1.1) is the long pole and the highest-value
single deliverable — start it the day Phase 0 lands.

---

## If you only do FIVE things (ranked by ROI)

1. **Make the rod solver actually time-march** (1.1) — collapses the biggest credibility gap in the repo.
2. **Ship the deterministic shared-seed A/B experiment** (2.2) — your one undeniable result.
3. **Phase 0 triage** (esp. 0.2 the 66 °C override, 0.1 rod ratings) — cheap, huge trust return.
4. **Make "MPC" a real optimizer** (1.2) — the second-biggest word-vs-substance gap.
5. **Adopt the narrow novelty statement + delete overclaims** (Phase 3) — turns an attackable pitch into an unattackable one.

---

## What "top-notch / no-regret" looks like when you're done

- Every advanced term in the README is **literally true** and backed by a numerical-verification test.
- A judge can run **one command** and watch a **seeded A/B experiment** + a **live failure trip**.
- Claims never exceed the **evidence tier** actually reached, and the novelty statement is **unattackable**.
- Zero synthetic overrides; one config; provenance on every value; reproducible container.
- The story is **"multi-fidelity, uncertainty-aware, auditable CSS→SRP integration, validated in
  simulation, with an honest pilot ladder"** — which is both true and genuinely differentiated.

That is a project you will **not regret**. "Greatest-ever" is subjective, but this is the legitimate route
to the top for *this* artifact — and the only thing beyond it is real field data.

---

## Appendix — what to re-verify online once web search works

When the environment has web again, run `/deep-research` on these to refresh/strengthen citations (the
Win doc already covers them but dates should be re-checked):
1. **Public dynacard datasets** for T3 replay (open SRP dynamometer-card sets; Cheng et al. class taxonomy).
2. **Canonical rod-pump wave-equation solvers** (Gibbs 1963; Everitt–Jennings) — to cite your method lineage.
3. **Published 3D-FEM rod-string results** (Eisner & Langbauer) — for the §2.4 discrepancy bound.
4. **Current commercial capability** (ChampionX/Weatherford/SLB/Baker Hughes/Ambyint) — confirm the
   prior-art boundary hasn't moved.
5. **CSS thermal-model validation** (Boberg-Lantz vs CMG STARS) — to anchor the §1.3 calibration.
