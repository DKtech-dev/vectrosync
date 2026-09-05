# Original User Request

## 2026-09-01T10:08:57Z

# Teamwork Project Prompt

A 100% offline, production-grade Well-to-Surface Digital Twin for Cyclic Steam Stimulation (CSS) and Sucker Rod Pump (SRP) optimization in the Baghewala heavy-oil field (Oil India Limited, Rajasthan), coupling reservoir thermal decay, non-Newtonian multiphase rheology, 1D tapered-rod elastodynamics, predictive anti-float MPC, 3-tier failsafe state machine, and a Streamlit industrial dashboard.

Working directory: /home/DK_TECH/sih final
Integrity mode: development

---

## Technical Specifications & Domain Physics

### 1. Asset & Physical Domain Anchors
- **Field & Reservoir:** Jodhpur Sandstone at ~1,150 m TVD, $T_R = 48^\circ\text{C}$ (321.15 K), steam temperature $T_s = 260^\circ\text{C}$ (533.15 K), rock thermal diffusivity $\alpha = 0.0036\text{ m}^2/\text{hr}$ ($1.0 \times 10^{-6}\text{ m}^2/\text{s}$), net pay $h = 15\text{ m}$, steam radius $r_h = 12\text{ m}$, convective removal factor $\delta = 0.05$.
- **Heavy Oil Rheology:** Arrhenius two-point calibrated anchors: $\mu_1 = 12.0\text{ Pa}\cdot\text{s}$ (12,000 cP) at $50^\circ\text{C}$ (323.15 K), $\mu_2 = 0.045\text{ Pa}\cdot\text{s}$ (45 cP) at $200^\circ\text{C}$ (473.15 K). Multiphase water-cut mixing: $\mu_{\text{mix}} = \mu(T)(1 - f_w) + \mu_{\text{water}} f_w$.
- **Couette Shear Drag:** $\beta(x, t) = f_{\text{eccentric}} \frac{2\pi \mu_{\text{mix}}(T)}{\ln(r_{\text{tubing}} / r_{\text{rod}}(x))}$ with $f_{\text{eccentric}} = 1.25$.
- **Rod String Taper (L = 1,150 m):**
  - Section 1 (0 to 350 m): 1.0 in rod ($D_1 = 0.0254\text{ m}$, $A_1 = 5.067 \times 10^{-4}\text{ m}^2$).
  - Section 2 (350 to 750 m): 7/8 in rod ($D_2 = 0.022225\text{ m}$, $A_2 = 3.879 \times 10^{-4}\text{ m}^2$).
  - Section 3 (750 to 1,150 m): 3/4 in rod ($D_3 = 0.01905\text{ m}$, $A_3 = 2.850 \times 10^{-4}\text{ m}^2$).
  - Tubing ID: $D_{\text{tubing}} = 0.076\text{ m}$ (2.992 in), $E = 2.07 \times 10^{11}\text{ Pa}$, $\rho = 7,850\text{ kg/m}^3$, $c = \sqrt{E/\rho} \approx 5,135\text{ m/s}$.

---

## Requirements

### R1. Reservoir Thermal Decay Engine (`src/thermal.py`)
Implement the analytical Boberg-Lantz decay formulation with exact singularity limits:
- Radial factor $\bar{v}_r(b^2) = 2 \int_0^\infty \exp(-b^2 y^2) \frac{J_1^2(y)}{y} dy$, with singularity identity $\lim_{b^2 \to 0^+} \bar{v}_r = 1.0$ (when $b^2 \le 10^{-10}$) and cached 1D cubic spline interpolator.
- Vertical factor $\bar{v}_z(w, h) = \operatorname{erf}(h/\sqrt{w}) + \frac{\sqrt{w}}{h\sqrt{\pi}} [\exp(-h^2/w) - 1]$, with singularity limit $\lim_{w \to 0^+} \bar{v}_z = 1.0$ and `expm1(-h^2/w)` underflow protection.
- Dynamic calibrated temperature: $T_{\text{cal}}(t) = T_R + \hat{k}(t)[T_{\text{avg}}(t) - T_R]$ with time scaling $\hat{k}(t)$, strictly clamped $T_R \le T_{\text{cal}}(t) \le T_s$.

### R2. Non-Newtonian Rheology & Shear Drag (`src/rheology.py`)
- Two-point Kelvin Arrhenius dynamic viscosity model with water-cut mixing.
- Distributed Couette shear drag coefficient $\beta(x, t)$ and damping $\nu(x, t) = \beta / (\rho A) \in [0.01, 3.00]\text{ s}^{-1}$.

### R3. Conservative 1D Elastodynamic Wave Solver & Pump Boundary (`src/rod_conservative.py`, `src/pump_boundary.py`)
- 1D damped wave PDE with spatial discretization $\Delta x = 10\text{ m}$ ($N = 116$ nodes), strict CFL time subcycling $\Delta t \le 0.8 \frac{\Delta x}{c} \approx 0.00155\text{ s}$.
- Explicit centered time-integration enforcing displacement and axial force continuity across taper interfaces.
- Kinematic surface crank boundary with second harmonic inertia; plunger boundary handling traveling/standing valve states, hydrostatic heads, buoyancy, and fluid pound fillage truncation.
- Multi-stroke settling (3 strokes) and phase-resampling to 144 uniform crank-angle points for surface and downhole dynamometer cards.

### R4. Fast-Loop MPC & 3-Tier Failsafe State Machine (`src/controller.py`, `src/failsafe.py`)
- Fast-Loop Model Predictive Controller optimizing SPM over a 12-hour horizon maximizing fluid production while penalizing motor power and SPM variance, subject to hard structural constraints (downhole tension $\ge +0.5\text{ kN}$, PPRL $\le 90\%$ rod rating, $1.0 \le \text{SPM} \le 5.5$).
- Failsafe State Machine with transitions across LEVEL-0 (Normal, telemetry <10s), LEVEL-1 (Degraded, 10s-60s), LEVEL-2 (Protective Fallback, >60s telemetry loss or tension violation $\to$ ramp down to 2.0 SPM in 3 strokes), and LEVEL-3 (Emergency Stop, PPRL > 95% rating).

### R5. Data Adapter & SHA-256 Provenance Ledger (`src/adapter.py`, `src/audit.py`)
- Pydantic ingestion schema with regex heuristic header auto-mapping and multi-unit conversion matrix.
- Cryptographic SHA-256 event chaining with immutable provenance tagging (`[measured]`, `[model]`, `[synthetic]`, `[calibrated]`).

### R6. High-Density Industrial Dashboard & Orchestration (`app.py`, `configs/`, `run_demo.sh`)
- Streamlit interactive 1920x1080 dark theme dashboard featuring:
  - Live disturbance injection controls (cooling multiplier, steam quality, water cut, plunger wear, Modbus disconnect simulation).
  - Live A/B dynamometer card overlays (Uncoupled Baseline with rod floating vs. Coupled Digital Twin with anti-float SPM throttling).
  - 12-hour predictive causal timeline ($T(t)$, $\mu(t)$, $\beta(t)$, SPM actions).
  - Adaptive CSV drag-and-drop port with dynamic confidence mapping.
  - Audit event hash chain & 23-well economic waterfall analysis.
- Configuration YAML (`configs/well_baghewala_14.yaml`), `requirements.txt`, `README.md`, and executable `run_demo.sh`.

---

## Acceptance Criteria

### Mathematical & Physical Defensibility
- [ ] $\lim_{t \to t_i} \bar{v}_r = 1.0$ and $\lim_{t \to t_i} \bar{v}_z = 1.0$ verified analytically and numerically.
- [ ] Calculated temperature strictly satisfies $T_R \le T_{\text{cal}}(t) \le T_s$ across 1,000 randomized time steps.
- [ ] CFL stability condition $\Delta t \le 0.8 \frac{\Delta x}{c}$ rigorously enforced across all 3 taper sections.
- [ ] Displacement $u(x)$ and internal force $E A \frac{\partial u}{\partial x}$ continuous within $\Delta < 10^{-5}$ across rod taper interfaces.

### Failsafe & Operational Safety
- [ ] Telemetry disconnect event ($>60\text{ s}$ gap) automatically trips LEVEL-2 protective fallback and ramps SPM to safe baseline (2.0 SPM).
- [ ] Coupled digital twin prevents rod floating ($F_{\text{axial}} \ge +0.5\text{ kN}$) under reservoir cooling disturbances where uncoupled baseline enters compression ($F_{\text{axial}} < 0\text{ kN}$).

### Software Quality & Execution
- [ ] Complete codebase executes 100% offline on localhost without API keys or cloud tokens.
- [ ] Zero placeholders (`pass`, `# TODO`, mock functions) across all modules.
- [ ] 100% passing automated test suite (`pytest tests/`).
- [ ] `streamlit run app.py` launches cleanly with interactive real-time updates on all slider adjustments.

## 2026-09-04T07:38:55Z

Overhaul the VectroSync Well-to-Surface Physics-Informed Digital Twin into an enterprise-grade, commercial industrial cybernetics system for Oil India Limited (Baghewala Well #14 CSS + SRP Optimization). Eliminate all synthetic mock data overrides, enforce rigorous first-principles physics, scrub all student competition branding, rebuild the frontend into a dark-slate SCADA mission control console, containerize for instant deployment, and ensure 100% test coverage.

Working directory: /home/dk/Documents/main
Integrity mode: demo

## Requirements

### R1. Global De-SIH Sanitization & Enterprise Rebranding
- Purge all occurrences of `SIH26120`, `SIH 2026`, `SIH2026`, `SIH`, and `Smart India Hackathon` across all source files, schemas, endpoints, configs, tests, and documentation.
- Rebrand internal schemas and configs to `OIL-BAGHEWALA-EOR-V2`.
- Rebrand UI and presentation headers to `VectroSync Enterprise Industrial Twin`.
- Update asset attribution to: `"Asset: Well #14, Baghewala Heavy Oil Asset, Bikaner-Nagaur Basin, Rajasthan | Operator: Oil India Limited"`.
- Rename `SIH2026_IDEA_Presentation_SIH26120_VectroSync.pptx` to `VectroSync_Enterprise_Industrial_Twin.pptx` and update `build_full_presentation.py` and `generate_deck_visuals.py` to remove competition branding and formatting constraints.

### R2. Core First-Principles Physics Refactor
- **Thermodynamics (`src/thermal.py`):** Correct the initial condition in Boberg-Lantz decay by eliminating the unphysical double-subtraction of convective loss parameter $\delta$. Fluid heat removal must accumulate dynamically with elapsed production time $t$ via $D_f = \delta \cdot \frac{t}{t + 5.0}$, ensuring $T(0) = T_{\text{steam}} = 260.0^\circ\text{C}$ at soak completion.
- **Rheology (`src/rheology.py`):** Replace the linear water-oil mixing law with the non-linear Brinkman-Vand emulsion model with phase inversion threshold at water cut $f_w = 0.60$. Water-in-oil emulsion droplet crowding must increase apparent viscosity up to $f_w \le 0.60$, followed by rapid inversion decay to oil-in-water rheology.
- **Elastodynamics (`src/rod_conservative.py`):** Eliminate the artificial lower force clamp `max(0.65 * 1000.0, ...)`. Dynamic axial tension must be governed directly by submerged rod self-weight minus hydrodynamic Couette drag: $F_{\text{down}} = W_{\text{submerged}} + F_{\text{fluid}} - (\beta \cdot L \cdot v_{\text{rod}})$, allowing the solver to compute natural negative compressive rod float ($< 0.0\text{ kN}$) when viscous drag dominates.
- **Controller Profiling (`src/controller.py`):** Replace the hardcoded constant `solve_time_ms = 8.5` with high-resolution execution time profiling using `time.perf_counter()`.

### R3. Backend API Purge (Zero Synthetic Overrides)
- In `backend/server.py` and `app.py`, completely eliminate hardcoded values such as `actual_min_tension = -1.80` and synthetic array slice injections (`uncoupled_load = [-1.80 if idx > 72 ...]`).
- Make all scenario transitions purely physical:
  - **Scenario A (Baseline Freeze):** Drive the physics pipeline with unmitigated cooling parameters (2.2x cooling, 4.7 SPM). The solver must naturally generate compressive downhole loads ($< 0.0\text{ kN}$) via Couette shear resistance.
  - **Scenario B (Coupled Twin):** Run the Fast-Loop MPC governor to throttle speed to $\approx 2.8\text{ SPM}$, holding calculated tension above $+0.50\text{ kN}$.
  - **Scenario C (Modbus Severance):** Trigger telemetry loss ($> 60\text{ s}$ latency), cleanly transitioning the failsafe state machine into `LEVEL_2_PROTECTIVE` with an automated 3-stroke ramp down to the 2.0 SPM fallback.
  - **Reset:** Restore nominal calibrated reservoir conditions.

### R4. Enterprise SCADA Frontend Overhaul (`frontend/`)
- Rebuild the dashboard layout into a dark-slate industrial mission control console (background `#0b0f17`, surface `#111827`, borders `#1e293b`, tabular monospace metrics).
- Implement `ScadaHeader.jsx` with enterprise branding, live diagnostic telemetry indicators (`EDGE CONTROLLER: {ms}`, `BUS: MODBUS-TCP // PORT 502`), dynamic 4-level supervisory badge (`L0 NORMAL`, `L1 DEGRADED`, `L2 PROTECTIVE`, `L3 E-STOP`), and 1-click scenario execution buttons.
- Update `WellboreSimulator.jsx` to bind rod section coloring directly to the backend axial stress tensor ($\sigma > +2.0\text{ kN}$ cyan, $+0.5\text{ to }+2.0\text{ kN}$ amber, $< 0.0\text{ kN}$ red buckling animation). Remove all client-side synthetic `Math.sin()` stress approximations.
- Update `DynacardStudio.jsx` with high-precision surface (0–3.5m vs 0–150kN) and downhole (0–3.5m vs -10 to +40kN) cards, displaying the Twin Safe Operational Envelope against the active operational stroke.
- Update Spatio-Temporal Heatmap, 12-Hour Forward Horizon, Why Engine console, and 23-Well Asset ROI ribbon.

### R5. Verification, Tests & Enterprise Containerization
- Update all test suites in `tests/` to align with the revised physics (Brinkman-Vand emulsion peak, natural negative compressive tension during high-drag downstroke, and exact $T(0) = 260^\circ\text{C}$ initial thermal state).
- Create a multi-stage production `Dockerfile` (Python 3.11 + FastAPI + Node.js/Vite frontend build).
- Create `docker-compose.yml` exposing ports 8000 and 8501.

## Acceptance Criteria

### Sanitization & Branding
- [ ] `grep -rnwi "sih" src/ backend/ frontend/ configs/ tests/ README.md` returns zero matches.
- [ ] All presentation scripts and docs reflect `VectroSync Enterprise Industrial Twin`.

### Mathematical & Physical Fidelity
- [ ] `src/thermal.py` produces $T_{\text{avg}}(0) = 260.0^\circ\text{C}$ at $t=0$ without artificial initial drop.
- [ ] `src/rheology.py` shows non-linear emulsion viscosity peaking at $f_w \approx 0.60$.
- [ ] `src/rod_conservative.py` computes downhole tension without artificial floors; downhole tension naturally drops below 0.0 kN under 4.7 SPM and 12,000 cP crude.
- [ ] `src/controller.py` reports dynamic `solve_time_ms` based on real execution time.

### Backend Integrity
- [ ] `grep -rn "\-1.80" backend/server.py src/rod_conservative.py app.py` returns zero manual array overrides.
- [ ] `/api/simulate` returns all dynacards and downhole tensions computed dynamically from physics.

### Frontend Quality
- [ ] React frontend builds cleanly via `npm run build` with 0 errors.
- [ ] 2D Wellbore Simulator derives rod coloring and stress directly from backend stress tensor.
- [ ] Interface follows dark-slate SCADA mission control theme (`#0b0f17`).

### Automated Test Suite & Packaging
- [ ] `python3 -m pytest tests/` passes with 100% green (0 failures, 0 errors).
- [ ] Root directory contains valid production `Dockerfile` and `docker-compose.yml`.
