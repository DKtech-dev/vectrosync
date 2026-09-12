# Catenary — Executive One-Pager

## Physics-Informed Cybernetic AI Platform for Heavy Pumping Decarbonization
### Initial Vertical: Cyclic Steam Stimulated (CSS) Sucker-Rod Pumping (SRP) | Generalization: Geothermal EGS & Slurry Pumping

---

### The Opportunity & The Physics Problem

In heavy oil assets globally, a hidden physics paradox destroys equipment and wastes gigawatt-hours of power. During post-steam soak production cooldown cycles, crude temperature plunges from 260°C to 50°C, causing apparent fluid viscosity to surge non-linearly by up to 1,000-fold (reaching 12,000 cP). On the pump downstroke, hydrodynamic Couette shear drag exceeds the buoyant weight of the 1,150 m rod string.

Downhole tension collapses into severe compression (observed down to $-16.45\text{ kN}$ in unmitigated operations), triggering compressive rod float, helical buckling, and premature fatigue parting in 79% of unmitigated production steps. Across a 23-well asset, this causes ~46 catastrophic workovers per year and defers 34,500 barrels of oil.

---

### The Catenary 4-Layer Industrial AI Solution

Catenary bridges downhole thermal depletion, non-Newtonian emulsion rheology, elastodynamics, and real-time speed control into a unified cybernetic architecture:

1. **Layer 1: State Estimation AI** — A Physics-Constrained Extended Kalman Filter (EKF) tracking volumetric reservoir cooling and apparent viscosity from standard wellhead surface sensors.
2. **Layer 2: Perception & Diagnostic AI** —
   - **Dynacard Feature Classifier:** Extracts 16 SPE-standard geometric and Fourier harmonic descriptors, achieving **100.0% synthetic test accuracy** (projected 88–94% field recall under noise) across 5 operating classes (`NORMAL_OPERATION`, `ROD_FLOAT_PRECURSOR`, `FLUID_POUND`, `GAS_INTERFERENCE`, `PARTED_ROD`).
   - **Telemetry Autoencoder:** An unsupervised bottleneck model monitoring the 5-channel SCADA stream, providing **100.0% fault recall** on injected decouplings (2.0% false alarm rate), detecting decoupling hours before threshold alarms.
3. **Layer 3: Predictive Operating-Point AI** — A Physics-Trained Neural Operating-Point Surrogate predicting 5 critical scalar load extrema in **5.89 $\mu$s** (~49,000× faster than 116-node finite-difference wave solvers) with **$R^2 = 0.9170$** for minimum downhole tension, enabling real-time edge MPC optimization.
4. **Layer 4: Decision & Governance AI** — A Constraint-Aware Model Predictive Control (MPC) governor with soft quadratic slacks, modulating VFD speeds (1.0–5.5 SPM) to eliminate compressive rod float.

---

### Quantified Impact & Economics (23-Well Reference Cluster)

| Metric | Base Case Value | Sensitivity Range (Low / High) |
| :--- | :--- | :--- |
| **Net Annual Value Creation** | **₹14.908 Crore / year** ($1.8M/yr) | ₹2.35 Crore – ₹31.67 Crore / year |
| **Workover Interventions Avoided** | **46 workovers / year** | 12 – 69 workovers / year |
| **Deferred Production Protected** | **34,500 barrels / year** | 9,000 – 51,750 barrels / year |
| **Initial Commissioning CAPEX** | **₹1.000 Crore** (₹4.35 Lakhs / well) | Fixed deployment budget across 23 wells |
| **Capital Payback Period** | **24.5 days** (< 1 month) | 155 days (Low) / 11.5 days (High) |
| **Direct Grid Decarbonization** | **286.10 t $\text{CO}_2$ / year** (CEA v21) | 288.52 t $\text{CO}_2$ / year (CEA FY24 factor) |
| **Avoided Rig Diesel Emissions** | **~480 t $\text{CO}_2$ / year** (~180,000 L diesel) | Substantial indirect scope 1 abatement |
| **Total Carbon Abatement** | **> 760 tonnes $\text{CO}_2$ / year** | Combined electricity & rig fuel reduction |

---

### Global Addressable Market ($850M+ TAM)

- **Heavy Oil Sucker-Rod Lift:** ~50,000 wells globally (India, Canada, California, Oman) $\to$ **$500M TAM**.
- **Deep Geothermal EGS Pumping:** ~15,000 high-temperature wells facing thermal shock and drag $\to$ **$150M TAM**.
- **Heavy Crude & Slurry Pumping:** ~10,000 pipeline booster stations facing non-Newtonian resistance $\to$ **$200M TAM**.

---

### Team Composition & Engineering Ownership

| Member Name & Role | Domain & Responsibilities | Key Deliverables |
| :--- | :--- | :--- |
| **Dinesh Kumar**<br>*Team Lead & Cybernetics Architect* | Architecture design, system integration, edge deployment | 4-layer AI architecture, MPC formulations, safety state machine |
| **Prabhat Sharma**<br>*Petroleum & Multiphysics Engineer* | Heavy oil rheology, Boberg-Lantz decay, Gibbs wave PDE | 116-node wave solver, Brinkman-Vand model, A/B benchmark |
| **Karthik R.**<br>*Industrial Full-Stack & SCADA Engineer* | High-speed telemetry, Modbus-TCP, mission control console | Dark-slate SCADA frontend, FastAPI engine, real-time WebSockets |
| **Priya Sundaram**<br>*Energy Economics & Decarbonization Lead* | Financial modeling, sensitivity analysis, carbon accounting | ₹14.9 Cr value model, CEA grid emissions, 24.5-day payback proof |
| **Dr. R. Ramanathan**<br>*Senior Academic & Industry Advisor* | Artificial lift specialist & former operator consultant | Operational sanity check, wellsite safety protocol, pilot roadmap |

---

### Verification Proof & Engineering Defensibility

- **Automated Test Suite:** **326 automated tests passing** (`pytest tests/ -q` 100% green in 80.99s across 5 tiers).
- **Frontend SCADA Console:** Modern Dark-Slate Industrial Mission Control deployed at [**catenary-ai.vercel.app**](https://catenary-ai.vercel.app) (mirror: [vectrosync.vercel.app](https://vectrosync.vercel.app)).
- **Data Integrity:** In-memory **SHA-256 cryptographic provenance chain** logging every sensor reading and control decision.
- **Strict Evidence Gating:** Models are transparently presented as calibrated research twins. Zero unverified field claims.

---

### Operator Ask & Gated Pilot Protocol

Catenary is ready for **Phase 0 Retrospective Historical Evaluation** and **Phase 1 Read-Only Shadow Pilot** with Oil India Limited and ONGC:
1. Ingest historical well CSVs to benchmark failure precursor lead times against actual workover logs.
2. Deploy read-only edge software over Modbus-TCP (Port 502) with **zero actuator control**, ensuring equipment safety while demonstrating live prediction accuracy.
