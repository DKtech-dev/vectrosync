# MEMORANDUM: TECHNICAL PILOT EVALUATION PROTOCOL

**TO:**
Office of the General Manager / Asset Head (Production & Artificial Lift)
Oil India Limited (Bikaner-Nagaur Basin Asset, Rajasthan)
Oil and Natural Gas Corporation (ONGC, Cambay Basin Heavy Oil Assets, Gujarat)

**FROM:**
Team Catenary Engineering Directorate

**DATE:**
September 12, 2026

**SUBJECT:**
Proposal for Zero-Risk, Read-Only Shadow Pilot Evaluation of the Catenary Physics-Informed Cybernetic AI Platform on Cyclic Steam Stimulated (CSS) Sucker-Rod Pumping (SRP) Wells

---

### 1. Executive Summary & Purpose

Cyclic Steam Stimulation (CSS) of heavy crude reservoirs (such as the Baghewala field, 16°–19° API, 12,000 cP dead crude) faces severe mechanical failures during post-injection production cooldown cycles. As downhole fluids cool from 260°C to 50°C, apparent viscosity surges non-linearly by up to 1,000-fold, generating extreme hydrodynamic Couette drag against reciprocating sucker rods.

When downward viscous drag exceeds the buoyant self-weight of the rod string, downhole tension plunges into compression (observed down to $-16.45\text{ kN}$ in unmitigated operations), inducing compressive rod buckling, fluid pound, and fatigue parting. Across a typical 23-well heavy oil cluster, this failure mode causes approximately 46 premature workovers per year and defers over 34,500 barrels of production.

**Team Catenary respectfully submits this Memorandum proposing a four-phase, zero-risk pilot evaluation protocol** designed to benchmark and validate the Catenary Cybernetic AI Twin against actual field production telemetry, without requiring direct actuator control or modifying existing wellhead safety systems.

---

### 2. The Catenary Technological Architecture

Catenary bridges downhole thermal depletion, non-Newtonian multiphase rheology, and rod elastodynamics into a unified, real-time edge platform:

1. **Layer 1 (State Estimation AI):** A Physics-Constrained Extended Kalman Filter (EKF) tracking volumetric heated-zone temperature and apparent fluid viscosity from standard wellhead surface sensors.
2. **Layer 2 (Perception & Diagnostic AI):**
   - **Dynacard Feature Classifier:** Extracts 16 SPE-standard geometric and Fourier harmonic descriptors, providing interpretable failure precursor warnings (`ROD_FLOAT_PRECURSOR`, `FLUID_POUND`, `GAS_INTERFERENCE`, `PARTED_ROD`) in < 0.15 ms on edge hardware.
   - **Telemetry Autoencoder:** An unsupervised bottleneck model monitoring the 5-channel SCADA stream to detect anomalous thermo-mechanical decoupling hours before high/low threshold trips.
3. **Layer 3 (Predictive Wave AI):** A Physics-Trained Neural Wave Surrogate predicting dynamic rod loads in **5.89 $\mu$s** (~49,000× faster than finite-difference wave solvers), enabling continuous candidate screening.
4. **Layer 4 (Decision & Governance AI):** A Model Predictive Control (MPC) governor calculating optimal VFD pumping speed setpoints to maintain downhole tension safely above $+0.50\text{ kN}$.

---

### 3. Four-Phase, Risk-Gated Pilot Evaluation Protocol

To guarantee absolute operational safety, equipment protection, and cybersecurity compliance, Catenary proposes a gated deployment structure:

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     PHASE 0     │  ──>  │     PHASE 1     │  ──>  │     PHASE 2     │  ──>  │     PHASE 3     │
│  Retrospective  │       │  Shadow Pilot   │       │ Supervised Loop │       │ Autonomous Edge │
│ Historical Audit│       │ (Read-Only)     │       │ (Operator Gated)│       │  (Full Cluster) │
└─────────────────┘       └─────────────────┘       └─────────────────┘       └─────────────────┘
```

#### Phase 0: Offline Retrospective Historical Audit (Duration: 3–4 Weeks)
- **Scope:** Complete offline evaluation on historical, anonymized well data.
- **Operator Data Requirements:** Historical CSV logs covering 1–2 complete CSS cycles (wellhead temperature, motor power, polished rod load, SPM, and recorded workover dates/failure reports).
- **Deliverables:**
  - Retrospective failure matching: Verification that Catenary’s Layer 2 Classifier correctly identifies precursors prior to historical rod parting events.
  - Model tuning: Calibration of Two-Point Arrhenius coefficients ($A, B$) and thermal decay parameters against field fluid samples.
  - Zero operational footprint: No field hardware or network connection required.

#### Phase 1: Read-Only Supervisory Shadow Pilot (Duration: 6–8 Weeks)
- **Scope:** Passive, non-intrusive edge deployment on 1–3 candidate wells.
- **Hardware Deployment:** One industrial edge computer (DIN-rail mounted, IP67 certified, low power < 25W) deployed inside the wellhead telemetry cabinet.
- **Network Interface:** Read-only Modbus-TCP connection (Port 502) to the existing SCADA RTU/PLC.
- **Safety Guarantee:**
  - **Zero Actuation:** Catenary has **no write permissions** to the VFD or PLC.
  - **Operator Display:** Advisory speed recommendations and dynacard diagnostics are displayed in shadow mode on the field operator console for observation only.
- **Evaluation Gate:** Measure precursor detection lead time (target: > 6 hours before failure), classification precision (> 95%), and false alarm rate (< 5%).

#### Phase 2: Supervised Closed-Loop Actuation (Duration: 8–12 Weeks)
- **Scope:** Controlled speed setpoint modulation on candidate wells under strict supervisory guardrails.
- **Control Handshake:**
  - The wellhead PLC retains 100% primary safety authority, emergency stop (E-STOP) circuits, and hard mechanical trip limits.
  - Catenary transmits advisory speed setpoints over Modbus register within an operator-defined, pre-approved band ($\pm 10\%$ of nominal SPM).
  - The field operator or PLC can revoke Catenary authority at any time with a single physical toggle switch.
- **Deliverables:** Measured reduction in downhole compressive cycles, elimination of rod-float alarms, and verified motor electricity savings.

#### Phase 3: Commercial Field-Wide Scale
- Deployment across the remaining 20+ wells in the asset cluster, enabling cluster-wide steam soak optimization and predictive rig scheduling.

---

### 4. Cybersecurity, Compliance & Data Governance

1. **Air-Gapped Operation:** The entire Catenary stack executes locally on edge hardware via lightweight Python/NumPy runtimes or Docker containers. **No cloud connection or outbound internet access is required.**
2. **Cryptographic Data Integrity:** Every sensory frame, model calculation, and advisory recommendation is immutably hashed and logged using in-memory **SHA-256 cryptographic provenance chains**, guaranteeing a tamper-evident audit trail for incident analysis.
3. **Fail-Closed Design:** In the event of sensor dropouts, network timeouts (> 60s), or out-of-range inputs, the supervisory state machine automatically drops to `LEVEL_2_PROTECTIVE`, executing a deterministic 3-stroke ramp down to safe conservative base speed.

---

### 5. Proposed Evaluation Candidate Wells & Pilot Timeline

| Milestone | Target Activity | Expected Output | Gating Decision |
| :--- | :--- | :--- | :--- |
| **Month 1** | Data Transfer & Phase 0 Retrospective | Historical correlation report & confusion matrix | Operator Sign-off on Phase 1 |
| **Month 2** | Hardware Mounting & Passive Telemetry Link | Read-only Modbus integration verified | Confirmation of zero interference |
| **Months 3–4** | Phase 1 Shadow Execution & Observation | Comparative dashboard vs operator actions | Joint Review of Precursor Lead Times |
| **Months 5–6** | Phase 2 Supervised Closed-Loop Pilot | Real-time speed governor active with $\pm 10\%$ band | Demonstration of Zero Float Events |

---

### 6. Official Request & Next Steps

Team Catenary invites the technical leadership of Oil India Limited / ONGC to:
1. Schedule a 45-minute technical presentation and live system demonstration.
2. Provide an initial non-sensitive historical dataset (CSV logs) for Phase 0 retrospective evaluation.
3. Review and execute a standard mutual non-disclosure and technical pilot evaluation agreement.

**Contact Information:**
Team Catenary Directorate
Repository: [github.com/DKtech-dev/vectrosync](https://github.com/DKtech-dev/vectrosync)
Live System Console: [catenary-ai.vercel.app](https://catenary-ai.vercel.app) (mirror: [vectrosync.vercel.app](https://vectrosync.vercel.app))
Verified Automated Test Suite: 326/326 Tests Passing
