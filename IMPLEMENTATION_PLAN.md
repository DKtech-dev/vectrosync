# VectroSync — Winning Implementation Plan
### Target: TSM TECHNOVA 2026 · National AI Innovation Challenge
**Document status:** Executable specification. Written so any competent AI agent or developer can implement it without further context.
**Last updated:** 2026-09-11

---

## 0. How to use this document

This plan is ordered by **leverage**, not by convenience. Phases P0 → P5 are sequential. Do **not** start UI polish (P2+) before P0 integrity fixes land — a beautiful UI on top of a hardcoded number is the single fastest way to lose this competition.

Each task has: `[ID] Title · files · what to do · acceptance criteria`.

> **Golden rule for every task:** never change the *meaning* of a number. If the model says 4.45 SPM, the UI shows 4.45 SPM. Every fix below moves the project *toward* truth, never away from it.

---

## 1. Competition intelligence (this changes the strategy)

### 1.1 What TECHNOVA 2026 actually is

| Fact | Implication for us |
|---|---|
| **"National AI Innovation Challenge"** run by **Thiagarajar School of Management** + TSOM Innovation & Incubation Centre | Judges are **management, innovation, and AI** people — **not** petroleum engineers. Domain depth impresses nobody who can't parse it. **Clarity of mechanism wins.** |
| Theme: **"Solving Tomorrow's Problems Today"** | Frame as *predictive/preventive*, not *monitoring*. Our entire thesis is "see the failure 12 h before it happens." Perfect fit — say it in these words. |
| Tracks include **Industry 5.0**, **Sustainability**, fintech, robotics | **Industry 5.0 = human-centric + resilient + sustainable industry.** VectroSync is literally a human-in-the-loop advisory system that refuses to act autonomously. This is our primary track. |
| Prize categories: National Champion, **Best AI Innovation**, **Best Industry Solution**, **Best Sustainability Innovation**, **Best Startup Potential**, Best Social Impact, Jury Special | We can credibly target **4 of 8** categories. Build explicitly for each (§7). |
| Stages: Campus Prelims (online) → Zonal (physical) → **National Grand Finale** (physical, Madurai) | Multi-round. The **deck** carries prelims; the **live prototype** carries zonal + finale. Both must be first-class. |
| Deliverables: *"Prototype documentation/codebase and presentation deck"* | Codebase quality is explicitly judged. The README and repo hygiene are scored artifacts, not afterthoughts. |
| Incubation + **patent filing support** offered | Signals they reward **defensible IP + startup viability**. Our novelty statement (§4.3) must be crisp and honest. |

### 1.2 The judging reality

Typical weighted rubric for this class of event (use as our internal scorecard):

| Criterion | Weight | Our current state | Target |
|---|---|---|---|
| Innovation & creativity | ~30% | Strong physics, **weak AI story** | Reframe as Physics-Informed Industrial AI |
| Technical implementation | ~25% | Genuinely deep, **but flagship number is hardcoded** | Fix P0, then it's a weapon |
| Impact / business value | ~25% | Economics exist but are constant + invisible | Surface sensitivity band + CO₂ |
| Presentation & demo | ~20% | UI has ~12 critical defects | P2–P4 |

**The 3-minute test:** a judge walks up, gets ~3–4 minutes. They will (a) look at the screen, (b) click something, (c) ask "what's the AI?", (d) ask "who pays for this?". Everything in this plan optimizes those four moments.

---

## 2. Brutal current-state assessment

A full backend and frontend audit was performed. **Verified findings** (with file:line). This is the honest baseline.

### 2.1 🔴 P0 — Credibility-destroying (fix before anything else)

| ID | Finding | Evidence | Why it's fatal |
|---|---|---|---|
| **C1** | **Scenario B's headline "2.8 SPM" is hardcoded**, not computed. The MPC actually returns **4.45 SPM**; the server overwrites it with `preset.expected_spm`. | `backend/server.py:260` → `proposed_spm = advisory_spm if advisory_spm <= 3.5 else preset.expected_spm`; `src/scenario_runner.py:109` | The one number the entire demo rests on is a constant. Any judge who opens `server.py` finds it in 15 lines. **Instant disqualification from serious contention.** |
| **C2** | **The SLSQP MPC never runs.** `mpc_solver_mode: "optimization"` only changes a **label string**. | `server.py:82` builds `FastMPCController()` with `solver_mode="surrogate"`; `server.py:418` swaps only the display name. Measured: `solve_time_ms = 0.859` (surrogate), not ~178 ms (SLSQP) | We advertise "nonlinear constrained SLSQP MPC" in an **AI** challenge and don't execute it. This is the worst possible finding here. |
| **C3** | **Transient PDE solver is numerically invalid at default conditions.** At 207.9 °C it returns **PPRL 222–272 kN against a 110 kN rating**, and the answer is **non-monotonic in `dx`** (252→222→272 for dx=10/15/20) ⇒ not grid-converged. | Measured cross-run; `src/rod_transient.py` | `solver_type=transient` with defaults **trips LEVEL_3_EMERGENCY**. If a judge clicks the solver toggle, the demo self-destructs. |
| **C4** | **The two solvers disagree 10× on min tension** — the single quantity the product thesis rests on. (+16.25 kN transient vs +1.64 kN surrogate at 75 °C). PPRL agrees within 2%. | Measured | Whichever you present, the other refutes it. |
| **C5** | **EKF is not wired into the server at all.** Imported only by tests. | `grep state_estimator backend/` → no hits | Our single strongest *genuine* AI asset is dormant. |
| **C6** | **25 Hz WebSocket stream is two hardcoded sinusoids** at a fixed 3.5 SPM, ignoring `effective_spm`. | `server.py:660-665` | Judge changes SPM, animation doesn't respond → "digital twin" framing collapses on contact. |

### 2.2 🟠 P1 — High (visible to a probing judge)

| ID | Finding | Evidence |
|---|---|---|
| H1 | `w_bottom_sub = 8500.0 N` — undocumented magic number that **determines whether the well floats** | `src/rod_conservative.py:421` |
| H2 | MPC's internal plant model (`3.5 − 0.10·μ·spm`) **contradicts the card model** it advises on (−1.74 vs +2.36 kN) | `src/controller.py` |
| H3 | 12 h forecast **bypasses the thermal engine** — it's `np.linspace(T, T−12, 24)`, a fixed ramp | `server.py:248` |
| H4 | `configs/well_baghewala_14.yaml` is **never loaded by any code** | grep-verifiable |
| H5 | Failsafe latching/hysteresis **unreachable over HTTP** (fresh instance per request) | `server.py:216` |
| H6 | `telemetry_age = 75.0 if severed else 1.2` — hardcoded, no telemetry clock | `server.py:272` |
| H7 | **A/B benchmark (19 float events → 0) has no endpoint.** Our best evidence is `pytest`-only | `src/generator.py:100` |
| H8 | `diagnostics.timestamp_iso` is **always `""`** | `src/why_engine.py:20` |
| H9 | Economics is **100% constant** — identical for every scenario, temperature, and SPM | `src/economics.py:79-122` |

### 2.3 🔴 Frontend — Critical defects

| ID | Finding | File:line |
|---|---|---|
| F1 | **BasinMap nodes teleport to (0,0) on hover** — Tailwind `hover:scale-125` emits a CSS `transform` that overrides the SVG `transform` attribute | `BasinMap.jsx:105` |
| F2 | **Wellbore SVG letterboxes**: viewBox 480×620 in `h-[380px]` → ~200 px dead space, labels render at 4.6 px (illegible) | `WellboreSimulator.jsx:256` |
| F3 | **Blank white page if the API fails** — every panel gated on `simState &&`, so child skeletons are unreachable | `App.jsx:218,256,290` |
| F4 | **No ErrorBoundary anywhere**; unguarded `.toFixed()` on API fields → one missing field white-screens the demo | `App.jsx:204`, `MetricCards.jsx:80` |
| F5 | `AnimatedNumber` safety check is a **no-op** — passes non-numbers into `v.toFixed(1)` → TypeError | `AnimatedNumber.jsx:14` |
| F6 | **EconomicsWaterfall hardcodes a complete fake financial result** as destructuring defaults (₹14.96 Cr) | `EconomicsWaterfall.jsx:16-23` |
| F7 | **Rated load contradiction visible simultaneously**: 110 kN (GaugePanel) vs 314.2 kN (Dynacard) vs 150 kN (axis) | `GaugePanel.jsx:59`, `DynacardStudio.jsx:674` |
| F8 | **6 dead controls**: search, bell (permanent unread dot), "Next 12 h" picker, Ask-bar submit, suggestion chips, avatar | `ScadaHeader.jsx:77-118`, `WhyEngineConsole.jsx:92` |
| F9 | **Triple titles per view** (h1 + card header + component header) and **triple link-state badges** with 3 vocabularies that can disagree | `App.jsx:248` + all view components |
| F10 | Contrast failures: `.caption` **2.56:1**, status pills **2.15–3.76:1** (AA needs 4.5:1) — and `.caption` carries every legal disclaimer | `index.css:19` |
| F11 | `lg`→`xl` gap: at 1280 px the main card **shrinks 1106→724 px**. Content gets smaller as the window gets bigger | `App.jsx:234` |
| F12 | Global `overflow-x:hidden` turns overflow into **silent clipping** — scenario pills become unreachable below ~700 px | `index.css:72` |

---

## 3. The winning thesis

> **VectroSync is a Physics-Informed Industrial AI that prevents a mechanical failure by predicting it 12 hours before any sensor could detect it — and it is engineered to refuse its own recommendation when it isn't sure.**

Three pillars, each mapped to a prize category:

| Pillar | One-liner | Prize target |
|---|---|---|
| **Predict** | Physics-informed AI (EKF + chance-constrained NMPC) turns a thermal forecast into a safe speed command | Best AI Innovation |
| **Prove** | Deterministic shared-seed A/B: 19 failures → 0, same noise, same disturbance, reproducible live | Best Industry Solution |
| **Protect** | A supervisor that can only ever *reduce* the command, plus fail-closed data gating and a hash-chained audit trail | Industry 5.0 / Jury Special |

Plus the commercial wrapper: **402,960 kWh and ~289 t CO₂e avoided per year** across 23 wells → Best Sustainability Innovation + Best Startup Potential.

### 3.1 The AI story (this is the reframe)

**Do NOT say "we use AI."** Say:

> "Three AI components: an **Extended Kalman Filter** that infers downhole state nobody can measure, a **chance-constrained nonlinear MPC** that plans 12 hours ahead under a 90% confidence bound, and a **reachability planner** that knows a constraint 6 hours away must be obeyed *now* because the actuator can only ramp 0.5 SPM/hour."

**Honest AI inventory** (from the audit — use exactly this framing):

| Component | Defensibility | Status |
|---|---|---|
| Chance-constrained NMPC (SLSQP, 72 vars, 96 constraints, 90% tightening) | **HIGH** — constrained optimization under uncertainty is core OR/AI | ⚠️ must wire in (C2) |
| Extended Kalman Filter (analytic Arrhenius Jacobian, Joseph-form covariance) | **HIGH** — recursive Bayesian inference, genuinely adapts online | ⚠️ must wire in (C5) |
| Backward-reachability governor | **MEDIUM** — legitimate AI planning. Call it "constraint-propagation planner", **never** "MPC" | ✅ runs today |
| Arrhenius/thermal regression (`polyfit`, ridge) | MEDIUM-LOW — real supervised learning, trivially simple | tests only |
| PINN/SIREN surrogate | **LOW / DANGEROUS** — it's an Extreme Learning Machine that discards the network when `trained=False` (the default), and trains on its own analytical model's output | **Do not present as a neural net** |
| WhyEngine "XAI" | **NONE** — three f-string templates. Its own docstring says *"it is not an AI model"* | **Never call this XAI** |

**Rule:** we claim exactly two AI systems (EKF + NMPC) and one planning technique. That's more than enough, and every word survives cross-examination.

---

## 4. P0 — Integrity fixes (backend)

> **Nothing else matters until these land.** Estimated total: 1 focused day.

### `[P0-1]` Remove the hardcoded scenario SPM
**File:** `backend/server.py:257-262`
**Do:** Delete the `preset.expected_spm` substitution entirely. Report whatever the controller returns.
```python
# BEFORE (server.py:260)
proposed_spm = advisory_spm if advisory_spm <= 3.5 else preset.expected_spm
# AFTER
proposed_spm = advisory_spm
```
**Consequence:** Scenario B will now show ~4.45 SPM instead of 2.8. **This is correct and you must accept it.** If the demo needs a more dramatic throttle, achieve it by tuning the *scenario conditions* (`cooling_multiplier`, `elapsed_days`) so the controller genuinely computes a low SPM — never by overwriting the output.
**Acceptance:** `grep -n "expected_spm" backend/server.py` returns nothing. Scenario B's `effective_spm` equals `mpc_plan.optimal_spm` (± failsafe clamping).

### `[P0-2]` Actually run the SLSQP MPC
**File:** `backend/server.py:82`, `~205`
**Do:** Construct the controller per-request honoring the request field.
```python
from src.controller import FastMPCController, MPCConfig
cfg = MPCConfig(solver_mode=params.mpc_solver_mode)   # "surrogate" | "optimization"
mpc_controller = FastMPCController(cfg)
```
**Also:** `solve_time_ms` must report the real solve time (~178 ms for SLSQP).
**Acceptance:** `POST /api/simulate {"mpc_solver_mode":"optimization"}` returns `solve_time_ms > 100` and `model_status.controller == "nonlinear_constrained_slsqp_mpc"`. Add a test asserting this (see `[P0-7]`).

### `[P0-3]` Gate or fix the transient solver
**File:** `src/rod_transient.py`, `backend/server.py`
**Option A (safe, 1 h):** Restrict `solver_type=transient` to the validated viscosity band. Outside it, return `409` or fall back to surrogate **with an explicit `model_status.solver_fallback_reason`**. Surface this in the UI as an honesty feature.
**Option B (better, ~half day):** Increase damping floor / reduce `dx` / add artificial viscosity so the low-μ regime is stable, then re-run the `dx` convergence check until monotone.
**Acceptance:** No parameter combination reachable from the UI produces PPRL > rating. Add a test sweeping T ∈ [60, 220] °C asserting `20 ≤ pprl ≤ 110`.

### `[P0-4]` Turn the solver disagreement into evidence
**Files:** `tests/test_solver_agreement.py` (new), `docs/`
**Do:** Add an explicit cross-solver test and **publish the result openly**, including the disagreement.
> "Our two independent solvers agree on peak rod load within 2%. They disagree on minimum tension by 10×, which is why the **surrogate is authoritative for the control loop** and the transient solver is used for verification only. We disclose this rather than hide it."

This converts C4 from a liability into a **verification story** — exactly the kind of engineering honesty that wins Jury Special Recognition.
**Acceptance:** Test exists; `docs/VERIFICATION.md` states which solver is authoritative and why.

### `[P0-5]` Wire in the EKF (unlocks the AI claim)
**Files:** `backend/server.py`, `src/state_estimator.py`
**Do:**
1. Instantiate a module-level `DownholeKalmanEstimator`.
2. In `run_physics_pass`, run `predict(dt)` then `update(...)` using the synthetic measurements already available.
3. Expose new response fields: `estimator.t_sandface_c`, `estimator.viscosity_pas`, `estimator.covariance_trace`, `estimator.innovation`.
4. **Fix the structural bug:** `H` column 3 is all zeros ⇒ `water_cut` is unobservable. Either add a water-cut measurement row or drop it from the state vector and say so.
**Acceptance:** Response contains a non-zero, evolving `estimator.*` block. UI renders an uncertainty band (§6.4).

### `[P0-6]` Make the live stream real
**File:** `backend/server.py:655-680`
**Do:** Drive the WebSocket from the **last computed simulation state**, not constants.
```python
phase_step = (last_state.effective_spm * 360.0 / 60.0) / 25.0   # deg per 25 Hz frame
# sample surface/downhole load from last_state.dynacard at this phase index
```
**Acceptance:** Changing SPM in the UI visibly changes the stroke rate of the schematic within one second.

### `[P0-7]` Close the 7 test gaps that let C1–C4 survive
**File:** `tests/`
Add: (1) SLSQP actually invoked when requested; (2) cross-solver agreement; (3) transient plausibility sweep; (4) scenario SPM comes from the model, not a preset; (5) a WebSocket test; (6) `solve_time_ms` bounded; (7) forecast consistent with the thermal engine.
**Acceptance:** All 7 present and passing. Test count rises from 304 → ~315.

### `[P0-8]` Quick truth fixes
| Fix | File |
|---|---|
| Use `thermal.predict_decay_trajectory` for the 12 h forecast instead of `linspace` | `server.py:248` |
| Load `configs/well_baghewala_14.yaml` and delete duplicated Python defaults | `src/`, `server.py` |
| Set `diagnostics.timestamp_iso` | `src/why_engine.py:20` |
| Document `w_bottom_sub = 8500.0` with a derivation, or compute it from geometry | `rod_conservative.py:421` |
| Vectorize `compute_spatiotemporal_stress_matrix` (10.5 ms → ~0.1 ms) | `src/depth_stress.py:34` |

---

## 5. P1 — New backend capability (the differentiators)

### `[P1-1]` Expose the A/B benchmark live — **highest-value single addition**
**File:** `backend/server.py`
```python
@api_router.get("/experiment/ab")
async def ab_benchmark(n_steps: int = 24, seed: int = 42):
    return DEFAULT_DATA_GENERATOR.generate_ab_benchmark_experiment(n_steps=n_steps, seed=seed)
```
Returns the verified `baseline_float_count: 19`, `coupled_float_count: 0`, `min_baseline_tension: -16.45`, `min_coupled_tension: +1.58`.
**Why:** This is the most persuasive quantitative evidence in the entire project and it is currently only reachable from `pytest`. Exposing it enables the **hero visualization** (§6.3) and lets a judge **change the seed** — proving it isn't cherry-picked.
**Acceptance:** `GET /api/experiment/ab?seed=7` returns a different but structurally identical result.

### `[P1-2]` Energy + CO₂ (Best Sustainability Innovation)
**Files:** `src/rod_conservative.py` (already computes these, then discards them), `backend/server.py`, `src/economics.py`
1. Expose `dynacard.power_kw` and `dynacard.hydraulic_power_kw` (computed at `rod_conservative.py:519-520`, currently dropped before serialization).
2. Do the same for the baseline card → gives **energy saved by the advisory**, live.
3. Add to `economics.py`:
```python
GRID_EMISSION_FACTOR_KG_CO2_PER_KWH = 0.716   # CEA India, FY2023-24 — cite explicitly
energy_saved_kwh_year = well_count * energy_saved_kwh_well_day * 365      # 402,960
co2_avoided_tonnes_year = energy_saved_kwh_year * 0.716 / 1000            # ≈ 288.5
```
**Derived metrics now available for the UI:** energy per barrel (`power_kw*24/oil_bopd`), system efficiency (`hydraulic/mechanical`), daily CO₂.
**Acceptance:** Response contains `co2_avoided_tonnes_per_year` and both power fields. Every constant is in `assumptions` and editable.

### `[P1-3]` Make economics respond to state
**File:** `src/economics.py`
Today it's constant for every scenario. Tie `avoided_failures_per_year` to the **actual float events** in the current run, so the money changes when the physics changes.
**Acceptance:** Running Scenario A vs B produces different economics.

### `[P1-4]` Surface the honesty metadata (free differentiation)
These are **already computed and returned but unused by the UI**:
`control_authority`, `advisory_command_spm`, `model_status.{data_provenance, rod_model, controller, controller_status, field_validated, hil_validated, uncoupled_inputs}`, `failsafe_reason`, `supervisory_state`, `stress_tensor.sections[]`, `economics.sensitivity.{low,base,high}`, `economics.avoided_failures_per_year`, `economics.recaptured_barrels_per_year`.
**Highest value:** `model_status.controller_status` (`OPTIMAL` vs `INFEASIBLE_SAFE_FALLBACK`) and `economics.sensitivity` (turns one unjustifiable number into a defensible range).

---

## 6. P2 — Information architecture & the hero moment

### 6.1 Layout principle

Judges get 3 minutes. The screen must answer, top to bottom: **What's wrong? → Why? → What should we do? → What's it worth?**

```
┌──────────────────────────────────────────────────────────────────────┐
│ RAIL │  TOPBAR: asset · live status · scenario segmented · actions   │
│      ├───────────────────────────────────────────────────────────────┤
│ 🏠   │  ① CAUSAL CHAIN STRIP  (the hero — animated, always visible)   │
│ 📊   │     Steam → Temp → Viscosity → Drag → Rod force → Command     │
│ 🔬   ├───────────────────────────────────────────────────────────────┤
│ 🗺️   │  ② KPI ROW  (4 micro-cards, count-up, delta pills)            │
│ 📈   ├────────────────────────────────────────┬──────────────────────┤
│ 🛡️   │  ③ ACTIVE ANALYSIS VIEW (8 col)        │ ④ HEALTH RAIL (4col) │
│      │     dynacard / heatmap / forecast …    │   3 ring gauges      │
│      │                                        │   wellbore schematic │
│      ├────────────────────────────────────────┴──────────────────────┤
│      │  ⑤ A/B PROOF STRIP   19 failures → 0   (live, re-seedable)    │
│      ├───────────────────────────────────────────────────────────────┤
│      │  ⑥ IMPACT BAR  ₹ Cr/yr · kWh · t CO₂ · avoided workovers      │
│      ├───────────────────────────────────────────────────────────────┤
│      │  ⑦ COPILOT  "Ask VectroSync Twin…"  (grounded, real)          │
└──────┴───────────────────────────────────────────────────────────────┘
```

### 6.2 🏆 THE HERO: Animated Causal Chain (`CausalChain.jsx` — **new**)

**This is the single most important thing you will build.** It solves the core problem: *management judges cannot read a dynacard.* A horizontal, animated, always-visible pipeline that shows physics flowing in real time.

Six nodes, each a live value fed from `simState`:

| Node | Field | Unit |
|---|---|---|
| Steam soak | `elapsed_days` | days since soak |
| Reservoir temp | `temperature_c` | °C |
| Oil viscosity | `viscosity_cp` | cP |
| Annular drag | `drag_beta` | N·s/m² |
| Min rod tension | `actual_min_tension_kn` | kN |
| Advisory speed | `effective_spm` | SPM |

**Behaviour:**
- Connectors carry **animated flowing particles** (SVG `<circle>` on `animateMotion`, or a dashed stroke with `stroke-dashoffset` animation). Flow **speed scales with `drag_beta`** — the chain visibly "thickens and slows" as oil gets viscous. This is the moment a judge *gets it*.
- On scenario switch, values **count-up** and the chain **re-propagates left→right with a 120 ms stagger**, so you literally watch causality travel.
- The node that breaches its threshold **turns critical and pulses**; downstream nodes desaturate until the command node shows the mitigation.
- Each node is **clickable** → scrolls/links to the panel that proves it (viscosity → forecast; tension → dynacard).
- Include a one-line plain-English caption under the chain that rewrites itself per state:
  > *"Oil is 140× thicker than at soak temperature. Drag now exceeds rod weight on the downstroke — the string would go into compression. Slowing to 4.45 SPM restores +2.36 kN of tension."*

**Acceptance:** A non-technical person can explain the failure mechanism after 20 seconds of watching it. Test this on someone outside the team.

### 6.3 A/B Proof Strip (`ABProof.jsx` — **new**)

Consumes `[P1-1]`. Two overlaid 24-step tension traces (baseline red, coupled green) with the 0 kN boundary as a hard line. Big count-up: **19 → 0 float events**. A **seed input** so a judge can type any number and watch it hold.

> Say: *"Same disturbance, same noise seed, same physics. The only difference is whether the controller is allowed to look ahead."*

### 6.4 Uncertainty band (from `[P0-5]`)
Render the EKF covariance as a shaded band on the forecast chart. This is the visual proof that the system **knows what it doesn't know** — and it's the natural lead-in to explaining chance constraints.

### 6.5 The Copilot — make it real, never fake
**File:** `WhyEngineConsole.jsx` (currently a dead input — F8)

Two acceptable options. **Do not ship the current fake.**
- **Option A (safe, 2 h):** Delete the input. Render the diagnostics trace as a clean "Model explanation" card. Honest and clean.
- **Option B (impressive, ~1 day):** A **grounded** copilot. Intent-match the question against a fixed set, and answer **only** by templating live `simState` values + the existing `diagnostics` fields. Show the exact fields used as source chips beneath the answer ("computed from `viscosity_cp`, `drag_beta`, `actual_min_tension_kn`"). Add a streaming token effect.
  - **Rule:** every sentence must be traceable to a field. No free-form generation. If the intent doesn't match, say *"I can only answer from the current model state; try one of these."*
  - This is defensible as **grounded NLG over a physics state**, and the source chips make it *more* impressive than an LLM wrapper, not less.

---

## 7. P3 — Motion system ("animation like Google")

### 7.1 Adopt Material 3 Expressive spring tokens

Google replaced easing/duration with a **physics spring system** in M3 Expressive. Use their official web conversion curves:

| Token | cubic-bezier | Duration | Use for |
|---|---|---|---|
| Expressive fast spatial | `0.42, 1.67, 0.21, 0.90` | 350 ms | KPI cards, chips, small movement |
| Expressive default spatial | `0.38, 1.21, 0.22, 1.00` | 500 ms | Panel/layout transitions |
| Expressive slow spatial | `0.39, 1.29, 0.35, 0.98` | 650 ms | Hero/causal-chain propagation |
| Expressive fast effects | `0.31, 0.94, 0.34, 1.00` | 150 ms | Hover, press, opacity |
| Expressive default effects | `0.34, 0.80, 0.34, 1.00` | 200 ms | Color/theme changes |

Add as CSS custom properties in `index.css`:
```css
--ease-spatial-fast: cubic-bezier(0.42, 1.67, 0.21, 0.90);  /* 350ms */
--ease-spatial:      cubic-bezier(0.38, 1.21, 0.22, 1.00);  /* 500ms */
--ease-spatial-slow: cubic-bezier(0.39, 1.29, 0.35, 0.98);  /* 650ms */
--ease-effects-fast: cubic-bezier(0.31, 0.94, 0.34, 1.00);  /* 150ms */
--ease-effects:      cubic-bezier(0.34, 0.80, 0.34, 1.00);  /* 200ms */
```
> Note the **>1 second control points** — that's the intentional overshoot that makes Google motion feel alive. Use spatial springs for anything that *moves*, effects springs for anything that *fades or recolors*. Never mix.

### 7.2 Install Motion
```bash
npm install motion --prefix frontend
```
Import path is `motion/react` (the library was renamed from `framer-motion` in late 2024).

**What to use it for (and only these — motion must map to a state change):**

| Pattern | API | Where |
|---|---|---|
| Shared-element tab indicator | `layoutId="nav-indicator"` | Nav rail active pill — glides between items |
| View crossfade | `<AnimatePresence mode="wait">` keyed on `activeTab` | Analysis view switching |
| Staggered entrance (once) | `variants` + `staggerChildren: 0.08` | KPI row on first load only |
| Card reflow | `layout` prop | Any grid that reorders |
| Alarm state | `animate={{scale:[1,1.03,1]}}` spring | Supervisory badge on L-level change |
| Number ticker | existing `useCountUp` (keep) | All telemetry |
| Reduced motion | `useReducedMotion()` from `motion/react` | Global guard |

### 7.3 The signature animations (what judges remember)

1. **Causal chain flow** — particles traveling along connectors, speed inversely proportional to viscosity. *Always running.* This is the ambient "alive" signal.
2. **Scenario switch cascade** — press "Freeze stress": chain re-propagates L→R (120 ms stagger) → KPIs count-up → dynacard curves redraw (stroke-dashoffset, 620 ms) → gauges sweep → badge pulses red. One orchestrated ~1.2 s sequence. **Choreograph it; don't let each component animate independently.**
3. **Draw-in charts** — path reveal on data change (already implemented, keep).
4. **Gauge sweep** — ring gauges animate from 0 on mount and tween between values.
5. **Copilot streaming** — token-by-token answer reveal.

**Hard rules:**
- Nothing animates on hover except 150 ms color/opacity. No hover-lift.
- Nothing loops except the live-stream dot (2 s breathe) and the causal-chain flow.
- Everything collapses to instant under `prefers-reduced-motion`.
- 60 fps or cut it. Animate `transform`/`opacity` only.

### 7.4 Performance guard
`WellboreSimulator` currently calls `setPhaseDeg` **every animation frame**, re-rendering the whole component at 60 fps (3× `computeSectionState` + inspector). **Fix:** drive the transform via a `ref` + rAF directly on the DOM node; throttle the θ readout to ~5 Hz.

---

## 8. P4 — Frontend defect remediation

Work in this exact order.

### 8.1 Truthfulness (do first — judges probe these)
- [ ] **F8** Remove or wire all 6 dead controls. A dead search icon says "this is a mockup" louder than anything else.
- [ ] **F6** Delete `EconomicsWaterfall` fake defaults; render "not computed" when absent.
- [ ] **F7** One `RATED_LOAD_KN` constant from `simState`, used by gauge, card, and axis.
- [ ] Remove `WellboreSimulator` invented fallbacks (`minTensionKn = 0.65`, `temperatureC = 260`, magic 45.0/65.0 stresses) → render `—`.
- [ ] **F3/F4** Add an `ErrorBoundary`; render child skeletons when `!simState`; add a retry path.
- [ ] `AuditLedgerView`: add error + empty states (today a backend failure shimmers forever).

### 8.2 Geometry
- [ ] **F1** BasinMap hover: move `translate` to a parent `<g>`, put `hover:scale-125` on an inner `<g>` with `transform-box: fill-box; transform-origin: center`.
- [ ] **F2** Wellbore: crop viewBox to `0 40 480 560`, container `aspect-[480/620]` not `h-[380px]`, in-SVG type ≥ 11 viewBox px.
- [ ] Dynacard single-view collapse: add `w-full max-w-3xl`; keep viewBox constant (660×420) and let CSS size it.
- [ ] Clamp the hover popover: `px = Math.max(marginLeft+4, Math.min(..., width - marginRight - POP_W - 4))`.
- [ ] Move heatmap taper callouts out of the data area into the depth gutter.
- [ ] Heatmap canvas: size backing store by `devicePixelRatio` via `ResizeObserver` (currently blurry + horizontally stretched).

### 8.3 Layout system
- [ ] **F11** Move the two-column grid from `xl:` to `lg:` so it starts where the rail appears.
- [ ] Convert the four `xl:flex-row` internal headers to **container queries** (`@container`) — they currently key off viewport while living in a container that's *wider* at `lg` than at `xl`.
- [ ] **F12** Remove global `overflow-x: hidden`; wrap each `.segmented` in `overflow-x-auto` + `min-w-0`.
- [ ] Mirror the theme toggle into the topbar (below 1024 px it's currently unreachable).

### 8.4 Hierarchy & tokens
- [ ] **F9** Kill the triple title. `h1` = asset/well name; card header = view title; **delete every component's internal header.**
- [ ] **F9** One link-state badge, one vocabulary. Remove the other two.
- [ ] Show `is_buckling_active` **once per view**, not five times.
- [ ] **F10** `.caption` → `--text-secondary` (4.86:1). Darken status pill text tokens (`#047857`, `#B45309`, `#B91C1C`) while keeping bright hues for fills.
- [ ] Migrate the last 4 files off legacy `panel*`/`chip`; **delete the alias block** in `index.css`.
- [ ] Add `readout` to the ~10 unmarked numeric sites (delta pills, captions, scenario blurb).
- [ ] Use a true mono stack for hashes/IDs — `.readout` currently sets only `font-variant-numeric`, **no font-family**, so "mono" readouts are actually Plus Jakarta Sans.

### 8.5 Accessibility
- [ ] Fix the tablist: mobile tabs have no `id`/`aria-controls`, so `aria-labelledby` points at a hidden rail button and arrow-key nav is dead below 1024 px.
- [ ] BasinMap: `radiogroup` + roving tabindex + explicit focus `<rect>` (18 sequential tab stops today).
- [ ] ParameterDrawer: focus trap, focus restore, backdrop click-to-close, body scroll lock.
- [ ] `ThemeToggle` uses `aria-checked` but `.nav-pill` styles `[aria-selected]` → the switch never shows state.

---

## 9. P5 — Narrative, deck & repo

### 9.1 Reposition the README (it is a judged artifact)
Current README opens with *"enterprise-grade industrial cybernetics digital twin"* — impenetrable to this jury. Restructure:
1. **One sentence a non-engineer understands.** *"VectroSync predicts a specific oil-well failure 12 hours before it happens, and slows the pump just enough to prevent it."*
2. A 30-second **problem → mechanism → result** section with the causal chain diagram.
3. **The AI section** (EKF + NMPC, honestly scoped per §3.1).
4. The A/B evidence table.
5. Sustainability numbers.
6. *Then* the deep physics, for the one judge who wants it.
7. Keep the honesty box — but move it below the value proposition, not above it.

### 9.2 Deck structure (8 min, prelims + finale)
| Time | Slide | Content |
|---|---|---|
| 0:00–0:40 | Problem | Heavy oil, CSS, the rod goes into compression. One diagram. |
| 0:40–1:20 | Why now / why AI | It's *predictable* from cooling — a reactive system physically cannot solve it (0.5 SPM/h ramp limit) |
| 1:20–2:10 | Architecture | 5 blocks: thermal → rheology → rod → EKF+NMPC → supervisor |
| 2:10–4:00 | **LIVE DEMO** | Causal chain → freeze scenario → watch cascade → A/B proof |
| 4:00–4:40 | **LIVE FAILURE INJECTION** | Pull Modbus → L2 fallback → *"the optimizer cannot override the supervisor"* |
| 4:40–5:20 | Evidence ladder | 315 tests, what's verified vs validated vs unproven |
| 5:20–6:10 | Impact | ₹ Cr range (sensitivity band), 403 MWh, 289 t CO₂ |
| 6:10–7:00 | Industry 5.0 + startup | Human-in-loop, advisory-only, pilot path, GTM |
| 7:00–8:00 | Ask + limitations | What we need; what we do **not** claim |

### 9.3 Demo choreography (rehearse until muscle memory)
1. Land on nominal. Let the causal chain breathe for 5 seconds. Say nothing.
2. **Hand the laptop to a judge.** "Press Freeze stress." — the cascade does the talking.
3. Show the A/B strip. **Let them change the seed.**
4. Pull the Modbus toggle. Show L2. Say: *"the optimizer output cannot bypass the supervisor."*
5. Open the audit ledger. *"Every one of those decisions is hash-chained to the model version."*
6. Close on the impact bar.

**Failure protection:** everything runs on `localhost` (no venue Wi-Fi). Record a 90-second fallback video from the same deterministic seed. Second laptop, packaged env. **Freeze the branch after rehearsal starts.**

### 9.4 Repo hygiene
- [ ] Delete `frontend/src/components/Header.jsx` (dead pass-through).
- [ ] Remove `clsx` + `tailwind-merge` (zero imports).
- [ ] Remove unused imports (`CheckCircle2`, `AlertOctagon`, dead globals `wave_solver`, `failsafe`, `ConstrainedMPC`).
- [ ] Delete or load `configs/well_baghewala_14.yaml`.
- [ ] `docs/VERIFICATION.md` with the maturity ladder (unit-verified / synthetic-validated / not-field-validated).

---

## 10. Hostile question defense

| Question | Answer |
|---|---|
| "Where's the AI? This is just physics." | "Two AI systems: an EKF doing recursive Bayesian inference on downhole state nobody can measure, and a chance-constrained nonlinear MPC solving a 72-variable NLP with 96 constraints at 90% confidence. The physics is the *model*; the AI is the *estimation and decision* layer. We deliberately keep neural networks out of the safety path." |
| "Is this novel? Ambyint/Weatherford do pump control." | "No individual primitive is novel and we don't claim otherwise. The contribution is the auditable coupling: CSS thermal state → rheology → tapered-rod mechanics → uncertainty-aware command, with a supervisor that can refuse. We did not identify a disclosed implementation of that specific chain." |
| "Your numbers are synthetic." | "Correct, and every screen says so. We claim *unit-verified* and *synthetic-validated* — not field-validated. Here is the maturity ladder and exactly what a shadow-mode pilot would have to prove." |
| "Why should I believe 19 → 0?" | "Change the seed." *(then do it live)* |
| "₹14.9 Cr — real?" | "It's a disclosed scenario with a low/base/high band; every input is editable on screen. Credit is only claimed after a controlled pilot." |
| "What if the model is wrong?" | "Then the supervisor still holds. It can only ever reduce the command, it trips on any non-finite value, and it latches at L3 until a human clears it." |

---

## 11. Execution schedule

| Phase | Scope | Effort | Gate |
|---|---|---|---|
| **P0** | Integrity fixes C1–C6 + 7 tests | 1–1.5 days | No hardcoded outputs; SLSQP runs; nothing reachable from UI is numerically invalid |
| **P1** | A/B endpoint, CO₂/energy, honesty metadata, dynamic economics | 1 day | `GET /api/experiment/ab` live; CO₂ in response |
| **P2** | Causal Chain hero + A/B strip + copilot decision | 2 days | Non-technical person explains the mechanism in 20 s |
| **P3** | Motion system (M3 springs + Motion lib + choreographed cascade) | 1.5 days | 60 fps; reduced-motion clean; one orchestrated scenario cascade |
| **P4** | Frontend defects §8.1→8.5 | 2 days | Zero dead controls; zero contrast failures; no clipping at 1024/1280/1920 |
| **P5** | README, deck, docs, repo hygiene, rehearsal | 1.5 days | Demo runs offline twice, back to back, no operator intervention |

**Total ≈ 9–10 focused days.** If time is cut, the non-negotiable minimum is **P0 + P2 + §8.1** — truth, the hero visual, and no fake controls.

---

## 12. Definition of Done

- [ ] No number displayed anywhere is a hardcoded constant substituted for a model output.
- [ ] Every advertised capability executes when the corresponding button is pressed.
- [ ] `grep -rn "expected_spm" backend/` → no substitution sites.
- [ ] Every interactive control does something, or has been removed.
- [ ] A judge can change a seed, a slider, and a scenario, and the system responds correctly to all three.
- [ ] Killing the backend mid-demo degrades gracefully (skeletons + retry), never a white screen.
- [ ] Full keyboard traversal with visible focus at every stop.
- [ ] AA contrast on all text, verified.
- [ ] Runs fully offline on `localhost`.
- [ ] `pytest` green (~315 tests), `npm run build` clean.
- [ ] A non-technical person, given 60 seconds unattended, can state what the product does.

---

## 13. One-paragraph pitch (memorize this)

> Heavy-oil wells in Rajasthan are steamed to 260 °C so tar-like crude will flow. As the heat bleeds away over weeks, the oil thickens **exponentially** — 140× in our model. The pump's 1,150-metre steel rod string has to *fall* under its own weight on the downstroke, and thick oil resists that fall. Past a threshold the rod stops being pulled and starts being **pushed** — a wire rope in compression — so it buckles, saws against the tubing, and snaps. That's a multi-lakh workover and a week of lost production. Because the thickening is **predictable from the cooling curve**, VectroSync sees the failure coming twelve hours out: a Kalman filter infers the downhole state nobody can measure, a chance-constrained optimizer plans a speed schedule that stays safe at 90% confidence, and an independent supervisor can veto any command it produces. In a deterministic shared-seed benchmark — same disturbance, same noise — the uncontrolled well fails 19 times out of 24 and ours fails zero. Across 23 wells that's roughly 47 avoided workovers, 403 megawatt-hours, and 289 tonnes of CO₂ a year. It runs entirely offline, it recommends rather than acts, and it can explain and cryptographically prove every decision it has ever made.
