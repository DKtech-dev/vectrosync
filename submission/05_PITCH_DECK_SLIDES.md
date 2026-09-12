# Catenary: Winning Pitch Deck & 5-Minute Presentation Script
## Competition Track: TECHNOVA 2026 / Industrial Cybernetics & AI Decarbonization
### Platform: Physics-Informed Cybernetic AI for Heavy Pumping Systems
### Target Asset: Heavy Oil CSS-SRP (Baghewala Reference Asset) | Generalization: Geothermal EGS & Mining Slurry

---

## Slide-by-Slide Deck Outline & 5-Minute Pitch Script

### Slide 1: Title & The Hook [0:00 - 0:35]
- **Slide Visual:** Catenary Dark-Slate SCADA Console hero with dynamic dynacards and live QR code to `catenary-ai.vercel.app`.
- **Key Metrics:** 326 Automated Verification Tests Passing | 4-Layer Industrial AI Architecture | 24.5-Day Payback.
- **Presenter Script:**
  > *"Judges, in heavy industrial pumping across the globe, a silent physics paradox destroys $1.8 million in equipment and wastes gigawatt-hours of electricity per field every single year. When 260°C steam cools downhole in cyclic steam wells, fluid viscosity surges by up to 1,000-fold. Suddenly, viscous Couette drag exceeds the buoyant self-weight of the steel rods. The rods float, slam, and buckle on the downstroke—plunging into catastrophic failure in 79% of production cycles.*
  >
  > *Existing SCADA systems are blind to this until after the rod parts. We built **Catenary**: a Physics-Informed Cybernetic AI platform that predicts downhole drag hours ahead and governs pump dynamics in real time to prevent failure before it starts."*

---

### Slide 2: The Core Problem: The Downstroke Viscous Drag Paradox [0:35 - 1:15]
- **Slide Visual:** Cross-section diagram showing 1,150 m tapered rod string inside tubing; thermal decay curve $T(t)$ dropping from 260°C to 50°C; non-linear Brinkman-Vand emulsion viscosity spiking to 12,000 cP; Couette shear stress $\tau = \mu \frac{\partial v}{\partial r}$ exceeding rod gravitational weight ($W_{\text{buoyant}} = 38.6\text{ kN}$).
- **The Failure Chain:**
  1. Reservoir cooling from steam soak ($260^\circ\text{C} \to 50^\circ\text{C}$).
  2. Non-linear emulsion viscosity surge ($\mu_{\text{mix}} = 12.4\text{ cP} \to 12,000\text{ cP}$).
  3. Hydrodynamic Couette drag rises above rod buoyant weight ($F_{\text{drag}} > W_{\text{submerged}}$).
  4. Minimum downhole tension drops below $0.0\text{ kN}$ (compressive buckling at $-16.45\text{ kN}$).
  5. Parted rods, tubing splits, and unscheduled workover rig dispatches.
- **Presenter Script:**
  > *"Here is the root physics: as steam condenses and cools, oil viscosity does not rise linearly—it follows a steep Two-Point Arrhenius law and a non-linear Brinkman-Vand emulsion peak at 60% water cut. The fluid becomes as thick as cold asphalt. On the downstroke, fluid shear drag drags the rod string upward. If the pump runs at standard operational speeds, downhole tension plunges into negative compression—dropping to -16.45 kN. The rods buckle like dry spaghetti, destroying the pump barrel."*

---

### Slide 3: The Catenary Solution: The 4-Layer Cybernetic AI Architecture [1:15 - 2:05]
- **Slide Visual:** Layered architectural diagram showing data flow from wellhead sensors to edge PLC.
```
┌────────────────────────────────────────────────────────────────────────┐
│  LAYER 4: DECISION & GOVERNANCE AI                                     │
│  Constraint-Aware MPC Governor with Soft Quadratic Barrier Slacks      │
│  (12-hr predictive lookahead, 1.0–5.5 SPM throttling, failsafe fallback)│
├────────────────────────────────────────────────────────────────────────┤
│  LAYER 3: PREDICTIVE OPERATING-POINT AI                                │
│  Physics-Trained Neural Operating-Point Surrogate (4-32-32-5 MLP)      │
│  (5.9 µs edge inference, ~49,000× faster than 116-node Gibbs PDE solver)│
├────────────────────────────────────────────────────────────────────────┤
│  LAYER 2: PERCEPTION & DIAGNOSTIC AI                                   │
│  • Dynacard Feature Classifier: 16-D Geometric/Fourier Softmax Head    │
│    (100.0% synthetic test accuracy, ~92% expected field recall)        │
│  • Telemetry Autoencoder: 5-2-5 Bottleneck Subspace                    │
│    (100% synthetic recall; 2% synthetic FAR; field validation pending) │
├────────────────────────────────────────────────────────────────────────┤
│  LAYER 1: STATE ESTIMATION & UNCERTAINTY AI                            │
│  Physics-Constrained Extended Kalman Filter (EKF) + Bayesian Band      │
│  (Tracks volumetric thermal depletion & mixture viscosity unobservables)│
└────────────────────────────────────────────────────────────────────────┘
```
- **Presenter Script:**
  > *"To solve this, Catenary does not rely on a single black box. We engineered a **4-Layer Cybernetic AI Architecture**:*
  > - *At Layer 1, an Extended Kalman Filter estimates downhole reservoir temperature and viscosity from flowline telemetry.*
  > - *At Layer 2, our Dynacard Feature Classifier extracts 16 SPE-standard geometric and Fourier descriptors, achieving 100% held-out synthetic test accuracy across 5 operational regimes. Working alongside it, an Unsupervised Telemetry Autoencoder detects abnormal thermo-mechanical decoupling hours before alarms trip.*
  > - *At Layer 3, our Physics-Trained Neural Operating-Point Surrogate predicts the 5 critical load extrema in just 5.9 microseconds—49,000 times faster than the 116-node finite-difference PDE solver, enabling real-time optimization.*
  > - *At Layer 4, a Constrained MPC Governor modulates VFD speed setpoints to keep downhole tension safely above +0.50 kN."*

---

### Slide 4: Empirical AI Benchmarks & Rigorous Defensibility [2:05 - 2:45]
- **Slide Visual:** Confusion matrix table, surrogate $R^2$ regression curves, and latency distribution graphs from `docs/AI_BENCHMARK_REPORT.md`.
- **Measured Results (Empirically Verified):**
  - **Dynacard Classifier Test Accuracy:** **100.0%** across 100 held-out test cards (synthetic benchmark; 88–94% projected under field noise).
  - **Operating-Point Surrogate Speed & Accuracy:** **5.89 $\mu$s latency** (< 0.01 ms), **$R^2 = 0.9170$** for minimum downhole tension, **6.19% NRMSE**.
  - **Anomaly Detection Recall:** **100.0% synthetic recall**, **2.0% synthetic false alarm rate**, **6.87 $\mu$s execution time** (field validation pending).
  - **Codebase Health:** **326 automated pytest tests passing** (100% green across 5 rigorous tiers in 80.99s).
- **Presenter Script:**
  > *"We take engineering defensibility seriously. Every number we present is backed by executable code in our repository. Our classifier was trained on 500 ground-truth elastodynamic cards and achieved 100% precision on held-out test data. We treat this as an algorithmic benchmark; in active fields, sensor noise will cause mild degradation to ~92%. Why geometric features instead of a black-box image CNN? Because petroleum production engineers require interpretable physics—our system explicitly explains that downstroke minimum load collapsed to -12 kN with a 24 kN·m compression integral, running in microseconds on standard industrial PLCs without GPU hardware."*

---

### Slide 5: Live SCADA Mission Control Demonstration [2:45 - 3:45]
- **Slide Visual:** Live walkthrough of [catenary-ai.vercel.app](https://catenary-ai.vercel.app) (mirror: [vectrosync.vercel.app](https://vectrosync.vercel.app)).
- **Interactive Scenarios Demonstrated:**
  1. **Scenario A (Unmitigated Baseline):** Cold reservoir, 4.7 SPM. The downhole card plunges to $-16.45\text{ kN}$. The Dynacard Classifier triggers `ROD_FLOAT_PRECURSOR` (red alert). The Autoencoder flags `CRITICAL` decoupling.
  2. **Scenario B (Coupled Digital Twin):** MPC Governor throttles speed to $2.8\text{ SPM}$. Downhole card stabilizes at $+1.58\text{ kN}$ safe tension. Classifier transitions to `NORMAL_OPERATION` (green).
  3. **SHA-256 Provenance Ledger:** Every advisory event is chained with cryptographic SHA-256 hashes for auditability.
- **Presenter Script:**
  > *"Let's look at the live deployed console at catenary-ai.vercel.app.*
  >
  > *Under Scenario A—representing unmitigated field operations—watch the downhole card collapse into severe compression at -16.45 kN. The Layer 2 Classifier immediately raises a `ROD_FLOAT_PRECURSOR` alert, identifying that fluid drag exceeds rod weight.*
  >
  > *Now, we engage the Digital Twin in Scenario B. The MPC governor predicts the load horizon and throttles pump speed to 2.8 SPM. The downhole card immediately returns to safe positive tension at +1.58 kN. Compressive rod float drops from 79% of production steps to zero.*
  >
  > *Finally, every single control recommendation and sensor reading is immutably logged into an in-memory SHA-256 provenance chain for full regulatory compliance."*

---

### Slide 6: Field Economics & Payback Period [3:45 - 4:10]
- **Slide Visual:** Economic waterfall chart and 23-well field financial breakdown.
- **Key Financial Metrics (23-Well Reference Field):**
  - **Net Annual Value Creation:** **₹14.908 Crore / year** ($1.8M/yr) in Base Case (Low: ₹2.35 Cr, High: ₹31.67 Cr).
  - **Workover Failures Averted:** 46 catastrophic rod failures avoided annually (2 per well/yr).
  - **Deferred Production Saved:** 34,500 barrels of heavy crude protected.
  - **Initial Commissioning CAPEX:** ₹1.000 Crore total (₹4.35 Lakhs per well).
  - **Payback Period:** **24.5 days** (< 1 month) in Base Case (155 days Low Case, 11.5 days High Case).
- **Presenter Script:**
  > *"The financial return is compelling. For a standard 23-well heavy oil cluster like Baghewala, Catenary eliminates 46 catastrophic workovers per year and protects 34,500 barrels of deferred oil production. That unlocks ₹14.9 Crore in net annual value. Against a commissioning CAPEX of ₹1 Crore across all 23 wells, the capital payback period is under 25 days."*

---

### Slide 7: Industrial Decarbonization & ESG Impact [4:10 - 4:30]
- **Slide Visual:** Decarbonization infographic showing direct motor electricity savings and avoided diesel workover rig emissions.
- **Quantified Emissions Abatement:**
  - **Direct Grid Decarbonization:** **286.10 t $\text{CO}_2$/year** (CEA v21 grid factor $0.710\text{ t CO}_2/\text{MWh}$) to **288.52 t $\text{CO}_2$/year** (CEA FY24 factor $0.716\text{ kg CO}_2/\text{kWh}$).
  - **Diesel Workover Rig Emissions Avoidance:** Averting 46 workover mobilizations saves **~180,000 liters of heavy diesel**, preventing **~480 t $\text{CO}_2$/year**.
  - **Total Environmental Benefit:** **> 760 tonnes of $\text{CO}_2$ avoided annually** per field cluster.
- **Presenter Script:**
  > *"Catenary is an industrial decarbonization engine. By eliminating pump motor overload and throttling during high-viscosity phases, we save 403 MWh of grid power, avoiding 286 tonnes of CO₂ annually under Central Electricity Authority factors. Even more significantly, preventing 46 workover rig dispatches saves 180,000 liters of diesel fuel, bringing total field decarbonization to over 760 tonnes of CO₂ avoided each year."*

---

### Slide 8: Market Expansion: An $850M+ Global Platform [4:30 - 4:45]
- **Slide Visual:** Global TAM expansion map highlighting Heavy Oil, Geothermal EGS, and Slurry Pumping.
- **Market Sizing (Total Addressable Market: $850M+):**
  - **Global Heavy Oil Rod Lift:** 50,000 wells (India, Canada, California, Oman) $\to$ **$500M TAM**.
  - **Deep Geothermal EGS Pumping:** 15,000 high-enthalpy thermal wells $\to$ **$150M TAM**.
  - **Industrial Slurry & Heavy Pipeline Pumping:** 10,000 booster stations $\to$ **$200M TAM**.
- **Presenter Script:**
  > *"We built Catenary for the hardest fluid dynamics challenge on Earth: 260°C steam and 12,000 cP bitumen. But this is not a one-well solution. The identical non-Newtonian drag physics and thermal decay equations govern deep geothermal wells and mineral slurry pipelines. Across these three verticals, Catenary addresses a global market exceeding $850 Million."*

---

### Slide 9: Risk-Gated Field Deployment Roadmap [4:45 - 5:00]
- **Slide Visual:** 4-Phase deployment timeline with security gates.
- **Deployment Stages:**
  - **Phase 0 (Retrospective Audit):** Ingest historical well CSVs; validate dynacards against actual workover failure logs.
  - **Phase 1 (Advisory Shadow Mode):** Read-only telemetry ingestion over Modbus-TCP; twin recommendations displayed on operator screen with 0 direct actuation.
  - **Phase 2 (Supervised Closed-Loop):** Field PLC enforces local safety envelope; Catenary adjusts VFD speed setpoints within authorized $\pm 10\%$ band.
  - **Phase 3 (Autonomous Field Scale):** Cluster-wide coordination across 23 wells with automated steam soak cycling.
- **Presenter Script:**
  > *"To bring this to the field safely, we follow a strict 4-phase, risk-gated deployment roadmap. Catenary begins as a read-only advisory system in shadow mode. The local wellhead PLC retains 100% safety authority and hard trip limits. We never bypass field safety.*
  >
  > *We have prepared a formal Pilot Evaluation Memorandum for Oil India Limited and ONGC. We are ready for technical retrospective validation today."*

---

### Slide 10: Team Composition, Verification Proof & The Ask [5:00]
- **Slide Visual:** Team roles, verification badges (326/326 Tests Passing, Vercel Production URL, GitHub Repository, SHA-256 Provenance), and Pilot Call to Action.
- **Team Composition & Roles:**
  - **Dinesh Kumar (Team Lead & Cybernetics Architect):** Autonomous control, 4-layer AI stack, real-time MPC, edge deployment.
  - **Prabhat Sharma (Petroleum & Multiphysics Modeling Lead):** Thermal Boberg-Lantz decay, non-Newtonian rheology, Gibbs wave PDE.
  - **Karthik R. (Industrial Full-Stack & SCADA Engineer):** Dark-slate telemetry console, FastAPI backend, Modbus-TCP integration.
  - **Priya Sundaram (Energy Economics & Decarbonization Lead):** Techno-economic modeling, CEA carbon metrics, commercial scaling.
  - **Dr. R. Ramanathan (Senior Academic & Industry Advisor):** Artificial lift specialist & former operator consultant (field safety & pilot qualification).
- **The Ask:**
  - Technical retrospective pilot evaluation with Oil India Limited / ONGC.
  - Mentorship from artificial lift experts.
  - Incubation to deploy the Phase 1 Shadow Pilot on an active heavy oil asset.
- **Presenter Script:**
  > *"Catenary combines first-principles physics, real-time edge AI, verified economics, and measurable decarbonization. With 326 passing tests and a live production console, we have moved beyond theoretical concepts into working software.*
  >
  > *Our interdisciplinary team spans petroleum physics, cybernetic control, and industrial SCADA software. We invite you to test our live deployment at catenary-ai.vercel.app and join us in decarbonizing heavy industrial pumping. Thank you."*
