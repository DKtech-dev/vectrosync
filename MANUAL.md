# Well-to-Surface Digital Twin — Prototype & Application Manual

> **Legacy operating manual.** Use the root `README.md` for current setup, advisory-only scope, endpoint behavior, and security configuration.

**SIH26120: CSS + SRP Optimization for Baghewala Heavy Oil Field**  
**Operator:** Oil India Limited (OIL), Rajasthan, India  
**Stack:** Modern Full-Stack (FastAPI + React 18 + Vite + TailwindCSS) & Streamlit Desktop

---

## 1. Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+ (Node v22 installed)
- Pip packages from `requirements.txt`

### Launch the Modern Web Application (Recommended)
Run the automated launcher:
```bash
./run_app.sh
```
Or start via Uvicorn:
```bash
uvicorn backend.server:app --host 0.0.0.0 --port 8000
```
Open **`http://localhost:8000`** in your browser.

*(Optional: You can also run the alternate Streamlit interface on port 8501 using `./run_demo.sh`)*

### Run the Complete Automated Test Suite (255 Tests)
```bash
pytest tests/ -v
```
Expected output: **`255 passed, 0 failed` (100% Green)**.

---

## 2. Modern Application Layout

The user interface follows modern industrial SCADA desktop standards (Palantir Foundry / Schlumberger Petrel grade):

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ HEADER: Asset Context (Baghewala-14) | State Badge | Telemetry Link | Scenario Buttons │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 4-KPI METRIC STRIP: Formation Temp | Crude Viscosity | Min Rod Tension | Operating SPM │
├────────────────────────────────────────┬───────────────────────────────────────────────┤
│ LEFT COLUMN (5/12):                    │ RIGHT COLUMN (7/12): MULTI-VIEW DECK          │
│ 2D Physics Wellbore Cross-Section      │ • Dynamometer Cards (Surface vs Downhole)     │
│ • 60 FPS Walking Beam Kinematics       │ • Depth-Stress Contour Heatmap Matrix         │
│ • 3-Tier Rod Taper (1.0" → 7/8" → 3/4")│ • 12-Hour 4-Physics Predictive Horizon        │
│ • Thermal Plume Gradient               │ • SCADA CSV Telemetry Ingestion               │
│ • Plunger Traveling & Standing Valves  │ • SHA-256 Cryptographic Audit Ledger          │
│ • Compressive Buckling Vibration FX    │                                               │
├────────────────────────────────────────┴───────────────────────────────────────────────┤
│ BOTTOM STRATEGIC INTELLIGENCE DECK:                                                    │
│ • Causal Reasoning "Why Engine" (Trigger → Horizon → Dispatched Action → Outcome)      │
│ • 23-Well Field Asset Economics Waterfall (₹14.96 Cr / year Net Annual Value Creation) │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Judge Evaluation Scenario Walkthrough (Step-by-Step)

Follow this 5-minute script to demonstrate the full capabilities to the Smart India Hackathon jury:

### Step 1 — Start at Nominal Baseline
- Click **Reset Nominal** in the top scenario toolbar.
- **What to Observe:** The operational state reads `NOMINAL OPERATION` (green). The animated wellbore shows smooth 4.7 SPM kinematics, and downhole tension is healthy ($+3.49\text{ kN}$).

### Step 2 — Demonstrate Conventional Failure (Scenario A)
- Click **Scenario A: Baseline Failure**.
- **What this demonstrates:** What happens when an uncoupled, fixed-speed controller operates the well during reservoir cooldown without a digital twin.
- **What to Observe:**
  1. The top badge turns red: `BASELINE FAILURE`.
  2. The 3/4" rod section (750 to 1,150 m) turns **red and vibrates (compressive buckling)**.
  3. The Min Rod Tension drops to **$-1.80\text{ kN}$** (compressive float on downstroke).
  4. In the **Dynamometer Cards** tab, the red dashed baseline card dips below the $+0.5\text{ kN}$ safety threshold line.
  5. The **Why Engine** explains the root cause: thermal decay to 50°C caused viscosity to surge to $>12,000\text{ cP}$, generating massive Couette drag that caused rod floating and ₹8.5 Lakhs workover risk.

### Step 3 — Demonstrate Autonomous Twin Intervention (Scenario B)
- Click **Scenario B: Coupled Twin (MPC)**.
- **What this demonstrates:** Under identical severe cooling, the Fast-Loop Model Predictive Controller intervenes proactively.
- **What to Observe:**
  1. The top badge returns to green: `NOMINAL OPERATION`.
  2. The rod string returns to **solid blue/green** — buckling is completely eliminated.
  3. The pumping speed is autonomously throttled from **4.7 $\to$ 2.8 SPM**.
  4. Min Rod Tension is preserved at **$+0.65\text{ kN}$** (safely above the $+0.5\text{ kN}$ limit).
  5. In the **Dynamometer Cards** tab, the green solid downhole card remains safely above the orange safety line.
  6. The **Why Engine** explains: MPC foresaw tension collapse 4.2 hours ahead, modulated SPM, and cut fatigue damage by 68%.

### Step 4 — Demonstrate Communication Loss Failsafe (Scenario C)
- Click **Scenario C: Telemetry Dropout**.
- **What this demonstrates:** Modbus serial cable severance ($>60\text{ s}$ telemetry timeout).
- **What to Observe:**
  1. The top telemetry link shows **Modbus Severed (>60s)** in red.
  2. The state badge turns amber: **FAILSAFE PROTECTIVE (L2)**.
  3. Pumping speed automatically executes a 3-stroke deterministic ramp-down to a safe **2.0 SPM** baseline.
  4. The **Why Engine** confirms the supervisory safety takeover.

---

## 4. Deep-Dive Analysis Tabs

1. **Dynamometer Cards (Dynacard Studio):**
   - High-precision vector plotting comparing Surface load (blue) vs Downhole elastic load (green) vs Baseline uncoupled (red dashed).
   - Horizontal $+0.5\text{ kN}$ structural safety floor.
   - Peak Polished Rod Load (PPRL), Minimum Polished Rod Load (MPRL), and Net Oil Production (BOPD).

2. **Depth-Stress Heatmap:**
   - 2D canvas contour of axial stress $\sigma(x, \theta)$ across 116 spatial nodes (0 to 1,150 m) and 144 stroke phase angles.
   - Blue = Tensile stress (safe), Red = Compressive stress (buckling).
   - Taper interface markers at 350 m (1.0" $\to$ 7/8") and 750 m (7/8" $\to$ 3/4").

3. **12-Hour Multi-Physics Predictive Horizon:**
   - 4 synchronized sparkline trajectories showing Formation Temperature decay, Viscosity surge, Couette drag coefficient, and MPC speed modulation over a 12-hour future window.

4. **CSV Telemetry Ingestor:**
   - Drag-and-drop SCADA telemetry upload with automatic regex header recognition, Imperial/SI unit conversions, and linear gap imputation.

5. **SHA-256 Cryptographic Audit Ledger:**
   - Visual block explorer verifying the cryptographic hash chain. Tamper-evident architecture guarantees complete provenance.

---

## 5. Engineering Specifications

| Parameter | Value |
| :--- | :--- |
| **Asset Location** | Oil India Limited, Baghewala Field, Bikaner-Nagaur Basin, Rajasthan |
| **Reservoir Target** | Jodhpur Sandstone at 1,150 m TVD |
| **Crude Properties** | Heavy crude (14°–19° API), dynamic viscosity 10,000–13,000 cP at 50°C |
| **Tapered Rod String** | Section 1: 0–350 m (1.0" rod, $5.067\text{ cm}^2$)<br>Section 2: 350–750 m (7/8" rod, $3.879\text{ cm}^2$)<br>Section 3: 750–1,150 m (3/4" rod, $2.850\text{ cm}^2$) |
| **Thermal Stimulation** | Cyclic Steam Stimulation (CSS) at 260°C initial injection |
| **Wave PDE Mesh** | 116 spatial nodes ($\Delta x = 10\text{ m}$), acoustic speed $c = 5,135.1\text{ m/s}$, CFL timestep $\Delta t = 1.56\text{ ms}$ |
| **Annual Value Creation** | ₹14.96 Cr / year across 23-well Baghewala sector |
