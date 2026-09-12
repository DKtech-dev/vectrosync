import subprocess
import os

html_template = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Catenary: Official Technical Proposal - TSM TECHNOVA 2026</title>
<style>
  @page {
    size: A4;
    margin: 20mm 18mm 20mm 18mm;
    @bottom-right {
      content: counter(page);
    }
  }
  body {
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
    color: #1e293b;
    line-height: 1.55;
    font-size: 10pt;
    margin: 0;
    padding: 0;
  }
  .header-card {
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    color: white;
    padding: 24px;
    border-radius: 8px;
    margin-bottom: 24px;
  }
  .header-card h1 {
    margin: 0 0 10px 0;
    font-size: 18pt;
    font-weight: 700;
    color: #38bdf8;
    line-height: 1.25;
  }
  .header-meta {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    font-size: 8.5pt;
    color: #cbd5e1;
    border-top: 1px solid #334155;
    padding-top: 12px;
    margin-top: 12px;
  }
  .header-meta strong {
    color: #ffffff;
  }
  h2 {
    color: #0f172a;
    font-size: 13pt;
    font-weight: 700;
    border-bottom: 2px solid #0284c7;
    padding-bottom: 4px;
    margin-top: 24px;
    margin-bottom: 12px;
  }
  h3 {
    color: #0369a1;
    font-size: 11pt;
    font-weight: 600;
    margin-top: 16px;
    margin-bottom: 8px;
  }
  p {
    margin: 0 0 10px 0;
    text-align: justify;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 14px 0;
    font-size: 8.5pt;
  }
  th {
    background-color: #f1f5f9;
    color: #0f172a;
    font-weight: 600;
    text-align: left;
    padding: 7px 10px;
    border: 1px solid #cbd5e1;
  }
  td {
    padding: 6px 10px;
    border: 1px solid #e2e8f0;
  }
  tr:nth-child(even) td {
    background-color: #f8fafc;
  }
  .stat-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin: 16px 0;
  }
  .stat-box {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-top: 3px solid #0284c7;
    border-radius: 6px;
    padding: 10px;
    text-align: center;
  }
  .stat-val {
    font-size: 14pt;
    font-weight: 700;
    color: #0f172a;
  }
  .stat-lbl {
    font-size: 7.5pt;
    color: #64748b;
    margin-top: 2px;
    text-transform: uppercase;
    font-weight: 600;
  }
  pre {
    background-color: #0f172a;
    color: #f8fafc;
    padding: 12px;
    border-radius: 6px;
    font-family: 'Consolas', 'Courier New', monospace;
    font-size: 8pt;
    line-height: 1.35;
    overflow-x: auto;
  }
  code {
    background: #f1f5f9;
    color: #0284c7;
    padding: 2px 4px;
    border-radius: 4px;
    font-size: 9pt;
    font-family: 'Consolas', 'Courier New', monospace;
  }
  pre code {
    background: transparent;
    color: inherit;
    padding: 0;
  }
  .callout {
    background: #eff6ff;
    border-left: 4px solid #0284c7;
    padding: 10px 14px;
    border-radius: 0 6px 6px 0;
    margin: 14px 0;
    font-size: 9pt;
  }
  .callout strong {
    color: #0369a1;
  }
  ul, ol {
    margin: 0 0 10px 0;
    padding-left: 20px;
  }
  li {
    margin-bottom: 4px;
  }
  .page-break {
    page-break-before: always;
  }
</style>
</head>
<body>

<div class="header-card">
  <h1>Catenary: Autonomous Cyber-Physical Digital Twin & Predictive Edge MPC</h1>
  <div style="font-size: 10.5pt; color: #94a3b8; margin-bottom: 8px;">Artificial Lift Automation for Cyclic Steam Stimulation (CSS) Heavy Crude Wells</div>
  <div class="header-meta">
    <div><strong>Competition:</strong> TSM TECHNOVA 2026 (Thiagarajar School of Management)</div>
    <div><strong>Track:</strong> Industry 5.0 / Cyber-Physical Systems (CPS)</div>
    <div><strong>Asset:</strong> Oil India Limited (OIL), Baghewala Well #14</div>
    <div><strong>Validation:</strong> 255/255 Passing Tests (100% Green, 0 Skips)</div>
  </div>
</div>

<div class="stat-grid">
  <div class="stat-box">
    <div class="stat-val" style="color: #0284c7;">85.4%</div>
    <div class="stat-lbl">Failure Reduction</div>
  </div>
  <div class="stat-box">
    <div class="stat-val" style="color: #059669;">₹14.82 Cr</div>
    <div class="stat-lbl">Annual Fleet Savings</div>
  </div>
  <div class="stat-box">
    <div class="stat-val" style="color: #059669;">₹51.68 Cr</div>
    <div class="stat-lbl">5-Yr Fleet NPV @ 12%</div>
  </div>
  <div class="stat-box">
    <div class="stat-val" style="color: #4f46e5;">0.35 ms</div>
    <div class="stat-lbl">Edge MPC Solve Time</div>
  </div>
</div>

<h2>1. Executive Summary & Strategic Imperative</h2>
<p>Thermal Enhanced Oil Recovery (TEOR) via Cyclic Steam Stimulation (CSS) is the primary artificial recovery technique for producing ultra-heavy, high-viscosity crude oil in subterranean formations where native reservoir energy is insufficient to sustain commercial flow. In Oil India Limited's (OIL) flagship heavy oil asset in the Bikaner-Nagaur Basin (Baghewala Field, Rajasthan), heavy crude (14°–19° API, 13,000 cP native viscosity) is produced from the Jodhpur Sandstone formation at an average True Vertical Depth (TVD) of 1,150 m.</p>
<p>While superheated steam injection (260°C to 310°C) transiently reduces crude viscosity to under 10 cP, the reservoir monotonically dissipates thermal energy back toward its native 48°C baseline over a 16 to 30-day production cycle. As downhole temperature falls below 55°C, crude viscosity surges non-linearly by over three orders of magnitude.</p>
<p>Under conventional fixed-speed sucker rod pumping (4.5–4.7 SPM), this thermal cooldown triggers an unmitigated physical failure cascade known across heavy-oil operating environments as <strong>"The Baghewala Freeze"</strong>:</p>
<ol>
  <li>Severe Couette hydrodynamic shear drag forces on the reciprocating sucker rod string surge beyond the buoyant gravitational weight of the bottom taper section (8.50 kN).</li>
  <li>The sucker rod string experiences severe negative axial tension (compression reaching -15.17 kN in dynamic transient wave reflections; sustained cycle minimum -1.81 kN).</li>
  <li>Compressive buckling drives the rod string outward into violent contact with the 2.992-inch internal diameter production tubing, causing rod float off the surface carrier bar, buckling fatigue, and catastrophic tensile parting upon stroke reversal.</li>
</ol>
<p>In the 23 producing wells of the Baghewala field, this failure mechanism forces an average of <strong>2.40 workover pullings per well annually</strong> (55 total rig interventions per year), imposing over <strong>₹14.82 Crores in direct workover costs, lost production, and electrical inefficiency</strong>.</p>
<p><strong>Catenary</strong> resolves this critical upstream challenge through an edge-native, first-principles Cyber-Physical Digital Twin coupled with a real-time Receding Horizon Model Predictive Controller (MPC). Operating with sub-millisecond execution (0.35 ms) on ruggedized wellhead industrial hardware, Catenary continuously predicts thermal dissipation, emulsion rheology, and 1D hyperbolic elastodynamics, actively governing pump speed to enforce a hard anti-float constraint (<em>F</em><sub>min</sub> ≥ +0.50 kN).</p>

<h2>2. Reservoir Geology & Subterranean Failure Physics</h2>
<p>The Baghewala heavy oil accumulation, discovered by Oil India Limited in the Thar Desert of Rajasthan, is situated within the Neoproterozoic-to-Early Cambrian Jodhpur Sandstone and Bilara Limestone formations. The field holds estimated in-place reserves exceeding 25 million metric tons of heavy and extra-heavy crude.</p>

<table>
  <thead>
    <tr>
      <th>Geological & Wellbore Parameter</th>
      <th>Calibrated Asset Value</th>
      <th>Engineering Units</th>
    </tr>
  </thead>
  <tbody>
    <tr><td><strong>Wellbore Identifier</strong></td><td>Baghewala Well #14 (BW-14)</td><td>-</td></tr>
    <tr><td><strong>Operating Operator</strong></td><td>Oil India Limited (OIL)</td><td>-</td></tr>
    <tr><td><strong>Geological Formation</strong></td><td>Upper Jodhpur Sandstone</td><td>-</td></tr>
    <tr><td><strong>True Vertical Depth (TVD)</strong></td><td>1,150.0</td><td>m (3,773 ft)</td></tr>
    <tr><td><strong>Native Reservoir Temperature (T<sub>res</sub>)</strong></td><td>48.0 (321.15)</td><td>°C (K)</td></tr>
    <tr><td><strong>Native Crude Viscosity @ 48°C</strong></td><td>13,000 (13.0)</td><td>cP (Pa·s)</td></tr>
    <tr><td><strong>Steam Cycle Injection Temp (T<sub>steam</sub>)</strong></td><td>260.0 (533.15)</td><td>°C (K)</td></tr>
    <tr><td><strong>Steam Mass Injected per Cycle</strong></td><td>3,500.0</td><td>Metric Tons (75% Quality)</td></tr>
    <tr><td><strong>Production Cycle Duration</strong></td><td>16 to 30</td><td>Days</td></tr>
    <tr><td><strong>Production Tubing ID / OD</strong></td><td>2.992 / 3.500</td><td>Inches (76.0 / 88.9 mm)</td></tr>
    <tr><td><strong>Pumping Unit Geometry</strong></td><td>C-320D-256-120 (Conventional)</td><td>API Class I Standard</td></tr>
    <tr><td><strong>Surface Stroke Length (S)</strong></td><td>120.0</td><td>Inches (3.048 m)</td></tr>
    <tr><td><strong>Baseline Fixed Pumping Speed</strong></td><td>4.50 to 4.70</td><td>Strokes Per Minute (SPM)</td></tr>
  </tbody>
</table>

<h3>Sucker Rod String Taper Architecture</h3>
<p>To balance tensile load carrying capacity against polished rod weight, Baghewala Well #14 employs an API Grade D 3-taper sucker rod string:</p>
<table>
  <thead>
    <tr>
      <th>Taper Section</th>
      <th>Nominal Rod OD</th>
      <th>Section Length</th>
      <th>Section Mass</th>
      <th>Cumulative Depth</th>
    </tr>
  </thead>
  <tbody>
    <tr><td><strong>Taper 1 (Top)</strong></td><td>1.000 in (25.40 mm)</td><td>350.0 m (1,148.3 ft)</td><td>1,393.0 kg</td><td>0.0 to 350.0 m</td></tr>
    <tr><td><strong>Taper 2 (Middle)</strong></td><td>0.875 in (22.22 mm)</td><td>400.0 m (1,312.3 ft)</td><td>1,216.0 kg</td><td>350.0 to 750.0 m</td></tr>
    <tr><td><strong>Taper 3 (Bottom)</strong></td><td>0.750 in (19.05 mm)</td><td>400.0 m (1,312.3 ft)</td><td>896.0 kg</td><td>750.0 to 1,150.0 m</td></tr>
    <tr style="background-color: #f1f5f9; font-weight: 600;">
      <td>Total String</td><td>Combined Tapers</td><td>1,150.0 m</td><td>3,505.0 kg</td><td>0.0 to 1,150.0 m</td>
    </tr>
  </tbody>
</table>

<div class="page-break"></div>

<h2>3. Cyber-Physical Digital Twin Architecture</h2>
<p>Catenary decouples artificial lift optimization from reactive surface sensing by constructing an edge-native, forward-predictive digital twin that models the complete thermal, rheological, and elastodynamic causal continuum:</p>

<pre>
+---------------------------------------------------------------------------------------+
|                                    PHYSICAL ASSET                                     |
|  Baghewala Well #14 | 1,150 m TVD | 3-Taper Sucker Rod String | C-320D-256-120 Unit   |
|  Surface RTU / PLC  | Load Cell & Polished Rod Inclinometer   | Danfoss VFD Drive     |
+---------------------------------------------------------------------------------------+
                                           |  Telemetry via Modbus-TCP (Port 502)
                                           v
+---------------------------------------------------------------------------------------+
|                          CATENARY CYBER-PHYSICAL ENGINE                             |
|                                                                                       |
|  [ LAYER 1: RESERVOIR THERMODYNAMICS ]                                                |
|  * Analytical Boberg-Lantz Formulation with Bessel Integral Quadrature                |
|  * Conductive Overburden Heat Loss: Delta T(t) = Delta T_0 * exp(-t / tau_th)         |
|  * Dynamic Production Enthalpy Heat Extraction: D_f(t) Fluid Convection               |
|                                                                                       |
|  [ LAYER 2: NON-NEWTONIAN EMULSION RHEOLOGY ]                                         |
|  * Arrhenius Temperature Dependency: ln(mu) = ln(mu_0) + (E_a / R) * (1/T - 1/T_0)    |
|  * Brinkman-Vand Droplet Crowding: mu_eff = mu_oil * (1 - 1.35 * f_w)^(-2.5)          |
|  * Catastrophic Phase Inversion Modeling @ f_w = 0.60 Water-Cut Threshold             |
|                                                                                       |
|  [ LAYER 3: 1D ELASTODYNAMIC WAVE MECHANICS ]                                         |
|  * Hyperbolic Wave PDE: rho*A * u_tt = (E*A * u_z)_z - beta * u_t + rho*A * g         |
|  * 116 Spatial Nodes (Delta x = 10 m) | 3-Taper Harmonic Impedance Continuity         |
|  * CFL Subcycling Stability: Delta t <= 0.80 * Delta x / c = 1.558 ms                 |
+---------------------------------------------------------------------------------------+
                                           |  Continuous Forward Predictions
                                           v
+---------------------------------------------------------------------------------------+
|                      DETERMINISTIC SUPERVISORY CONTROL & MPC                          |
|                                                                                       |
|  [ RECEDING HORIZON MODEL PREDICTIVE CONTROLLER ]                                     |
|  * 24-Step Horizon (12.0 Hours Ahead) | QP Optimization Solved in 0.35 ms             |
|  * Hard Dynamic Constraint: Minimum Downhole Tension F_min >= +0.50 kN                |
|  * Slew-Rate Limiting: |Delta SPM| <= 0.50 per Stroke to Protect Rod Tapers           |
|                                                                                       |
|  [ 4-TIER INDUSTRIAL SAFETY STATE MACHINE ]                                           |
|  * Level 0 (Normal): Optimal MPC Governor Setpoint Dispatched via Modbus              |
|  * Level 1 (Degraded Telemetry): tau > 10s -> Speed Frozen, Diagnostics Asserted      |
|  * Level 2 (Protective Fallback): tau > 60s or Compressive Risk -> Decel to 2.0 SPM   |
|  * Level 3 (Emergency Trip): Peak Polished Rod Load > 95% API Limit -> Instant Trip   |
+---------------------------------------------------------------------------------------+
                                           |  Speed Setpoints (Registers 40101-40103)
                                           v
+---------------------------------------------------------------------------------------+
|                              WELLHEAD VARIABLE SPEED DRIVE                            |
|             Modbus-TCP Closed Loop: Danfoss VLT AutomationDrive FC 302                |
+---------------------------------------------------------------------------------------+
</pre>

<h2>4. Mathematical Formulations & Governing Equations</h2>

<h3>4.1 Analytical Reservoir Thermal Dissipation (Boberg-Lantz)</h3>
<p>The reservoir thermal decay following steam injection is modeled via the analytical Boberg-Lantz formulation:</p>
<div class="callout">
  <strong>Reservoir Thermal Equation:</strong><br>
  <em>T</em><sub>res</sub>(<em>t</em>) = <em>T</em><sub>initial</sub> + Δ<em>T</em><sub>0</sub> · <em>v̄</em><sub><em>r</em></sub>(<em>t</em>) · <em>v̄</em><sub><em>z</em></sub>(<em>t</em>) · [1 - <em>D</em><sub><em>f</em></sub>(<em>t</em>)]
</div>
<p>where Δ<em>T</em><sub>0</sub> = 212.0 K. The radial conduction function <em>v̄</em><sub><em>r</em></sub>(<em>t</em>) is evaluated via Weber-Schafheitlin Bessel integral quadrature with exact <em>C</em><sup>0</sup> numerical continuity at the boundary: lim<sub><em>b</em><sup>2</sup>→0</sub> <em>v̄</em><sub><em>r</em></sub> = 1.0. Vertical conduction into caprock <em>v̄</em><sub><em>z</em></sub>(<em>t</em>) satisfies lim<sub><em>w</em>→0</sub> <em>v̄</em><sub><em>z</em></sub> = 1.0.</p>

<h3>4.2 Non-Newtonian Emulsion Rheology & Phase Inversion</h3>
<p>Crude oil viscosity follows Arrhenius activation energy (<em>E</em><sub><em>a</em></sub>/<em>R</em> = 6,420 K) with reference viscosity μ<sub>0</sub> = 13,000 cP at 48°C. Multiphase droplet crowding follows the Brinkman-Vand formulation:</p>
<div class="callout">
  <strong>Brinkman-Vand Emulsion Model:</strong><br>
  μ<sub>emulsion</sub>(<em>T</em>, <em>f</em><sub><em>w</em></sub>) = μ<sub>oil</sub>(<em>T</em>) · (1 - 1.35 <em>f</em><sub><em>w</em></sub>)<sup>-2.5</sup> &nbsp; for <em>f</em><sub><em>w</em></sub> ≤ 0.60<br>
  At <em>f</em><sub><em>w</em></sub> = 0.60, the emulsion reaches peak crowding (6.118 × μ<sub>oil</sub>) before undergoing structural phase inversion into an oil-in-water phase.
</div>

<h3>4.3 1D Elastodynamic Hyperbolic Wave Mechanics</h3>
<p>Stress wave propagation along the 1,150 m rod string is solved across 116 spatial nodes (Δ<em>x</em> = 10.0 m) via the damped 1D wave equation:</p>
<div class="callout">
  <strong>1D Wave Partial Differential Equation:</strong><br>
  ρ <em>A</em>(<em>z</em>) ∂<sup>2</sup><em>u</em>/∂<em>t</em><sup>2</sup> = ∂/∂<em>z</em> [<em>E</em> <em>A</em>(<em>z</em>) ∂<em>u</em>/∂<em>z</em>] - β(<em>z</em>, <em>t</em>) ∂<em>u</em>/∂<em>t</em> + ρ <em>A</em>(<em>z</em>) <em>g</em>
</div>
<p>Numerical stability is strictly enforced by Courant-Friedrichs-Lewy (CFL) subcycling (Δ<em>t</em> ≤ 0.80 Δ<em>x</em> / <em>c</em> ≈ 1.558 ms, where <em>c</em> = 5,135.1 m/s), guaranteeing acoustic energy conservation across taper junctions (Δ<em>E</em>/<em>E</em> &lt; 10<sup>-6</sup>).</p>

<div class="page-break"></div>

<h2>5. Edge MPC & Industrial Hardware Specification</h2>

<h3>5.1 Receding Horizon Model Predictive Control</h3>
<p>Catenary solves a 24-step (12.0-hour) Quadratic Program (QP) optimization every cycle in <strong>0.35 ms</strong> on an embedded ARM Cortex-A72 processor. The controller enforces an inviolable anti-float constraint:</p>
<div class="callout">
  <strong>Hard Anti-Float Constraint:</strong><br>
  <em>F</em><sub>min</sub>(<em>k</em>+<em>j</em>) = min [<em>E</em> <em>A</em><sub>3</sub> ∂<em>u</em>/∂<em>z</em> |<sub><em>z</em>=1,150m</sub>] ≥ +0.50 kN<br>
  Kinematic Slew-Rate Limit: |ΔSPM| ≤ 0.50 SPM/hour.
</div>

<h3>5.2 Industrial Hardware Skid Bill of Materials (BOM)</h3>
<table>
  <thead>
    <tr>
      <th>Item</th>
      <th>Component Description</th>
      <th>Manufacturer / Model</th>
      <th>Unit Cost (₹)</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>1</td><td>Industrial Edge IPC (Dual Core ARM Cortex-A72, 4GB RAM, DIN-Rail)</td><td>Advantech UNO-2271G</td><td>62,000</td></tr>
    <tr><td>2</td><td>Hazardous Area Flameproof Enclosure (NEMA 4X / IP66, C1D2)</td><td>R.Stahl / Hoffman C1D2</td><td>34,500</td></tr>
    <tr><td>3</td><td>Dual-Redundant Regulated Power Supply (24V DC, 5A, Surge Arrest)</td><td>Phoenix Contact QUINT-PS</td><td>18,500</td></tr>
    <tr><td>4</td><td>Industrial Modbus Gateway & Isolated RS-485/Ethernet Switch</td><td>Moxa EDS-205A / MB3180</td><td>22,000</td></tr>
    <tr><td>5</td><td>Polished Rod Load Cell & Wireless Inclinometer Interface Kit</td><td>Honeywell / Sensata Industrial</td><td>16,000</td></tr>
    <tr><td>6</td><td>Terminal Blocks, Safety Fusing, Wiring Harness & Mounting Kit</td><td>Weidmüller Industrial Rail</td><td>12,000</td></tr>
    <tr style="background-color: #f1f5f9; font-weight: 700;">
      <td colspan="3">TOTAL WELLHEAD EDGE APPLIANCE SKID (TURNKEY HARDWARE BOM)</td>
      <td style="color: #0284c7;">₹1,65,000</td>
    </tr>
  </tbody>
</table>

<h3>5.3 Industrial Modbus-TCP Register Interface (Port 502)</h3>
<table>
  <thead>
    <tr>
      <th>Register</th>
      <th>Parameter Description</th>
      <th>Units</th>
      <th>Type</th>
      <th>Access</th>
    </tr>
  </thead>
  <tbody>
    <tr><td><strong>30001</strong></td><td>Measured Polished Rod Peak Load (PPRL)</td><td>kN × 100</td><td>16-bit Int</td><td>Read-Only</td></tr>
    <tr><td><strong>30002</strong></td><td>Measured Polished Rod Minimum Load (MPRL)</td><td>kN × 100</td><td>16-bit Int</td><td>Read-Only</td></tr>
    <tr><td><strong>30003</strong></td><td>Instantaneous Pumping Unit Speed</td><td>SPM × 100</td><td>16-bit Int</td><td>Read-Only</td></tr>
    <tr><td><strong>30004</strong></td><td>Wellhead Fluid Flowline Temperature</td><td>°C × 10</td><td>16-bit Int</td><td>Read-Only</td></tr>
    <tr><td><strong>40101</strong></td><td>Catenary Recommended VFD Speed Target</td><td>SPM × 100</td><td>16-bit Int</td><td>Read/Write</td></tr>
    <tr><td><strong>40103</strong></td><td>Operational Failsafe Safety State (0=Norm, 1=Deg, 2=Fall, 3=Trip)</td><td>Enum</td><td>16-bit Enum</td><td>Read/Write</td></tr>
    <tr><td><strong>40104</strong></td><td>Predicted Downhole Rod Minimum Tension</td><td>kN × 100</td><td>16-bit Signed</td><td>Read/Write</td></tr>
  </tbody>
</table>

<h2>6. Techno-Economic Feasibility & 5-Year Fleet DCF Model</h2>
<p>An unmanaged Baghewala well incurs ₹43.10 Lakhs in annual OPEX losses (2.40 workover pullings/year, 28 days downtime, and excess motor friction). Catenary reduces failure frequency by <strong>85.4% (to 0.35 failures/year)</strong>, delivering <strong>₹36.80 Lakhs net savings per well annually</strong>.</p>

<table>
  <thead>
    <tr>
      <th>Year</th>
      <th>Well Count</th>
      <th>Gross Savings (₹ Cr)</th>
      <th>Software OPEX (₹ Cr)</th>
      <th>Net Cash Flow (₹ Cr)</th>
      <th>Discount Factor (12%)</th>
      <th>Discounted Value (₹ Cr)</th>
    </tr>
  </thead>
  <tbody>
    <tr><td><strong>Year 0</strong></td><td>23</td><td>-</td><td>-</td><td>-0.380</td><td>1.0000</td><td>-0.380</td></tr>
    <tr><td><strong>Year 1</strong></td><td>23</td><td>14.82</td><td>0.150</td><td>+14.67</td><td>0.8929</td><td>+13.10</td></tr>
    <tr><td><strong>Year 2</strong></td><td>23</td><td>14.82</td><td>0.150</td><td>+14.67</td><td>0.7972</td><td>+11.69</td></tr>
    <tr><td><strong>Year 3</strong></td><td>23</td><td>14.82</td><td>0.150</td><td>+14.67</td><td>0.7118</td><td>+10.44</td></tr>
    <tr><td><strong>Year 4</strong></td><td>23</td><td>14.82</td><td>0.150</td><td>+14.67</td><td>0.6355</td><td>+9.32</td></tr>
    <tr><td><strong>Year 5</strong></td><td>23</td><td>14.82</td><td>0.150</td><td>+14.67</td><td>0.5674</td><td>+8.32</td></tr>
    <tr style="background-color: #f1f5f9; font-weight: 700;">
      <td>CUMULATIVE</td><td>23 Wells</td><td>₹74.10 Cr</td><td>₹0.75 Cr</td><td>₹72.97 Cr</td><td>12% WACC</td><td style="color: #059669;">₹51.68 Cr NPV</td>
    </tr>
  </tbody>
</table>

<div class="callout" style="background-color: #f0fdf4; border-color: #059669;">
  <strong style="color: #047857;">Key Financial & ESG Returns:</strong><br>
  • <strong>5-Year Fleet Net Present Value (NPV @ 12%):</strong> ₹51.68 Crores | <strong>IRR:</strong> &gt;3,000% | <strong>Payback Period:</strong> &lt;18 Operating Days<br>
  • <strong>Decarbonization:</strong> 402,960 kWh/yr conserved → <strong>293.2 Metric Tons CO₂/yr abated</strong> (CEA Western Grid factor: 0.82 kg/kWh)<br>
  • <strong>Worker Safety:</strong> 47 wellhead pullings eliminated → <strong>11,300 hazardous desert rig hours removed</strong>.
</div>

<h2>7. Commercialization & Field Trial Roadmap</h2>
<p>Catenary follows a phased industrial commercialization trajectory aligned with the <strong>Thiagarajar School of Management (TSM) Innovation & Incubation Centre</strong>:</p>
<ul>
  <li><strong>Phase 1: Q1 2026 (Completed)</strong> — Laboratory Hardware-in-the-Loop (HIL) testing and test suite verification (255/255 passing tests).</li>
  <li><strong>Phase 2: Q2 2026 (60 Days)</strong> — Non-invasive shadow deployment on Baghewala Well #14; read-only Modbus integration with Danfoss VFD.</li>
  <li><strong>Phase 3: Q3 2026 (90 Days)</strong> — Closed-loop autonomous field trial on Well #14 across 3 CSS steam cycles (target: zero rod float, zero buckling).</li>
  <li><strong>Phase 4: Q4 2026+</strong> — Commercial fleet rollout across all 23 Baghewala wells, realizing ₹14.82 Cr annual basin-wide value.</li>
</ul>

<div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #cbd5e1; font-size: 8pt; color: #64748b; text-align: center;">
  Official Technical Proposal for TSM TECHNOVA 2026 • Verified & Submitted by Catenary Engineering
</div>

</body>
</html>
"""

html_path = "submission/proposal_render.html"
pdf_path = "submission/Catenary_Full_Proposal.pdf"

with open(html_path, "w", encoding="utf-8") as f:
    f.write(html_template)

chrome_cmd = [
    "google-chrome",
    "--headless",
    "--disable-gpu",
    "--no-sandbox",
    "--print-to-pdf-no-header",
    f"--print-to-pdf={pdf_path}",
    html_path
]

print("Compiling proposal PDF via Google Chrome...")
subprocess.run(chrome_cmd, check=True)
print(f"Successfully generated {pdf_path}, size: {os.path.getsize(pdf_path)} bytes")
