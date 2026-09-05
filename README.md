# VectroSync Enterprise Industrial Twin: Interactive Well-to-Surface Cybernetics Platform
## Enterprise Digital Twin Architecture — Baghewala Field, Oil India Limited
**Asset: Well #14, Baghewala Heavy Oil Asset, Bikaner-Nagaur Basin, Rajasthan | Operator: Oil India Limited**

[![100% Offline Localhost](https://img.shields.io/badge/Operation-100%25%20Offline%20Localhost-brightgreen.svg)](#)
[![Zero Placeholders](https://img.shields.io/badge/Codebase-Zero%20Placeholders%20%2F%20100%25%20Exact-blue.svg)](#)
[![246 Tests Passing](https://img.shields.io/badge/Test%20Suite-246%2F246%20Passed%20(100%25)-success.svg)](#)
[![Interactive Simulator](https://img.shields.io/badge/UI-Interactive%20Industrial%20Flight%20Simulator-orange.svg)](#)

---

## 📌 Executive Summary

This repository delivers the **production-grade, 100% executable interactive digital twin industrial console** for **OIL-BAGHEWALA-EOR-V2: "Well-to-Surface Digital Twin for CSS + SRP Optimization, Baghewala Field (Oil India Limited)"**.

The application moves beyond flat static dashboards into a **real-time industrial simulator** featuring:
1. **Live Animated 2D Physical Wellbore Twin:** Real-time reciprocating surface pumping unit (synced with SPM), $1,150\text{ m}$ tapered rod string ($1''$, $7/8''$, $3/4''$), near-wellbore thermal steam plume decay, downhole plunger valves, and visual failure effects (rod buckling & carrier bar separation).
2. **One-Click Supervisory Scenario Runner:** Top-level guided SCADA controller with Scenario A (Baseline Float Failure), Scenario B (Coupled Twin Safe Intervention), Scenario C (Telemetry Severance & Failsafe Tripping), and Reset.
3. **Causal "Why Engine" (Explainable Engineering Copilot):** Real-time plain-language petroleum engineering diagnostics tracing physical causes and dispatches.
4. **2D Spatio-Temporal Depth-Stress Heatmap:** $\sigma(x, \theta)$ contour map across depth ($0\text{ to } 1,150\text{ m}$) and crank angle ($0^\circ\text{ to } 360^\circ$) with 3-taper inspection panels.
5. **Baghewala 23-Well Asset ROI Waterfall:** Asset-scale economic impact showing **₹14.96 Cr / year net value creation (ROI > 450%)**.

```
                        MULTI-PHYSICS CAUSAL CHAIN
┌────────────────────┐     ┌─────────────────────┐     ┌──────────────────────┐
│  Reservoir Thermal │ ──> │ Heavy Oil Arrhenius │ ──> │ Annular Couette Drag │
│  Boberg-Lantz PDE  │     │ Non-Newtonian μ(T)  │     │ β = 2π f μ / ln(ro/r)│
└────────────────────┘     └─────────────────────┘     └──────────────────────┘
                                                                   │
                                                                   ▼
┌────────────────────┐     ┌─────────────────────┐     ┌──────────────────────┐
│  Fast-Loop MPC     │ <── │ Downhole Sucker Rod │ <── │ Downhole Rod Float   │
│  Tension Guard     │     │ 1D Wave PDE Solver  │     │ Compression Risk     │
│  (≥ +0.5 kN floor) │     │ (CFL Subcycling)    │     │ (Buckling / Parting) │
└────────────────────┘     └─────────────────────┘     └──────────────────────┘
```

---

## 🏛️ Application Layout & Core Pillars

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  🛢️ OIL INDIA LIMITED | WELL-TO-SURFACE DIGITAL TWIN (WELL #14, BAGHEWALA)   [OIL-BAGHEWALA-EOR-V2]│
│  Supervisory State: ● LEVEL 0 NORMAL  |  Model: COUPLED PHYSICS TWIN  |  Data Provenance: [calibrated] │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  ⚡ INTERACTIVE SCENARIO CONTROLLER FOR OPERATIONAL SCADA                                              │
│  [ ▶ Play Scenario A: Baseline Float Failure ]  [ ▶ Play Scenario B: Coupled Twin Safe Intervention ]  │
│  [ ⚡ Simulate Modbus Cable Severance ]          [ 🔄 Reset All Disturbances to Default ]               │
├──────────────────────────────────────────────────┬─────────────────────────────────────────────────────┤
│  LEFT: 2D ANIMATED PHYSICAL WELL TWIN            │  RIGHT: INTERACTIVE DYNAMOMETER & STRESS SIMULATOR  │
│  • Surface Pumping Unit (Reciprocating Motion)   │  [ Tab 1: Live A/B Dynacards (Baseline vs Twin) ]   │
│  • 1,150 m Wellbore Taper Profile (1", 7/8", 3/4)│  [ Tab 2: 2D Depth-Stress Spatiotemporal Heatmap ]  │
│  • Near-Wellbore Thermal Plume Decay             │  [ Tab 3: 12-Hour Predictive Causal Timeline ]      │
│  • Plunger Valve Action & Rod Float Visualizer   │  [ Tab 4: CSV Drag-and-Drop Auto Ingestion Port ]   │
│                                                  │  [ Tab 5: Cryptographic SHA-256 Audit Ledger ]      │
├──────────────────────────────────────────────────┴─────────────────────────────────────────────────────┤
│  BOTTOM: EXPLAINABLE AI "WHY ENGINE" & ASSET FINANCIAL WATERFALL                                       │
│  • Real-Time Physics Reasoning Log (Thermal Decay → Arrhenius Viscosity → Couette Drag → MPC Action)   │
│  • Baghewala 23-Well Asset ROI Waterfall (₹3.61 Cr Workovers + ₹30.2L Power + ₹11.05 Cr Uplift)       │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🧪 Comprehensive Verification Suite (100% Pass Rate)

| Test Suite Category | Test File Path | Tests | Pass Rate |
| :--- | :--- | :---: | :---: |
| **Interactive Simulator Suite** | `tests/test_interactive_simulator.py` | 13 | **100%** |
| **R1: Thermal Engine** | `tests/test_thermal.py`, `tests/tier1_feature_coverage/test_thermal_tier1.py` | 38 | **100%** |
| **R2: Rheology & Drag** | `tests/test_rheology.py`, `tests/tier1_feature_coverage/test_rheology_arrhenius.py` | 27 | **100%** |
| **R3: Wave PDE & Pump** | `tests/test_rod_conservative.py`, `tests/tier1_feature_coverage/test_rod_cfl_wave.py` | 42 | **100%** |
| **R4: MPC & Failsafe** | `tests/test_failsafe_trips.py`, `tests/tier1_feature_coverage/test_failsafe_state_machine.py` | 34 | **100%** |
| **R5: Adapter & Audit** | `tests/tier1_feature_coverage/test_adapter.py`, `tests/tier2_boundary_corner_cases/test_audit_boundaries.py` | 48 | **100%** |
| **Tier 2: Boundary Cases**| `tests/tier2_boundary_corner_cases/` | 32 | **100%** |
| **Tier 3: Combinations** | `tests/tier3_cross_feature_combinations/` | 12 | **100%** |
| **TOTAL VERIFIED SUITE** | **`tests/` (All Suites)** | **246** | **100% (246/246)** |

---

## 🚀 Quickstart & One-Click Launch

```bash
# One-click demo launch on localhost:8501
./run_demo.sh
```
Or manually:
```bash
streamlit run app.py --server.port 8501 --server.headless true
```
Navigate to `http://localhost:8501` in your browser.
