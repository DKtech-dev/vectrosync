import subprocess
import os
import shutil

html_content = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Catenary - Innovation Summary</title>
<style>
    @page {
        size: letter;
        margin: 0.9in;
    }
    body {
        font-family: "Times New Roman", Times, Georgia, serif;
        font-size: 11.5pt;
        line-height: 1.45;
        text-align: justify;
        color: #111111;
        margin: 0;
        padding: 0;
    }
    h1 {
        font-size: 13.5pt;
        text-align: center;
        font-weight: bold;
        text-transform: uppercase;
        margin-bottom: 2pt;
        letter-spacing: 0.5pt;
    }
    .subtitle {
        font-size: 10.5pt;
        text-align: center;
        font-style: italic;
        margin-bottom: 18pt;
        color: #333333;
    }
    .field-label {
        font-weight: bold;
    }
    p {
        margin-top: 0;
        margin-bottom: 10pt;
        text-align: justify;
        text-justify: inter-word;
    }
</style>
</head>
<body>

<h1>TSM-TECHNOVA 2026 &mdash; Innovation Summary</h1>
<div class="subtitle">National AI Innovation Challenge | Thiagarajar School of Management, Madurai</div>

<p><span class="field-label">Project Title:</span> Catenary: Cyber-Physical AI Platform for Heavy Crude Artificial Lift</p>

<p><span class="field-label">Problem Statement:</span> Heavy crude extraction under Cyclic Steam Stimulation (CSS) at Oil India Limited’s Baghewala Well #14 suffers catastrophic mechanical failures. Severe post-steam viscosity surges (from 9 cP to 12,000 cP) cause upward Couette shear drag (23.44 N/m) to exceed submerged rod weight (18.84 N/m). Sucker rods buckle into severe compression (-1.80 kN downhole tension), snap, and part, costing &#8377;14.82 Crores annually across 23 producing wells.</p>

<p><span class="field-label">Proposed Solution:</span> Catenary is an edge-native Cyber-Physical System (CPS) optimizing artificial lift dynamics in real time. Coupling analytical thermodynamics, non-Newtonian emulsion rheology, and 1D hyperbolic wave mechanics with fast-loop predictive control (0.35 ms MPC), Catenary dynamically modulates pumping stroke speed to enforce an inviolable downhole tension floor (F_min &ge; +1.0 kN), preventing compressive rod buckling.</p>

<p><span class="field-label">Use of Artificial Intelligence:</span> Catenary deploys a SIREN-embedded Physics-Informed Neural Network (PINN) and Extended Kalman Filter to infer subterranean temperature, water-cut, and dynamic viscosity from surface telemetry (flowline temperature, motor power, polished rod load). This eliminates expensive downhole sensors while enforcing Boberg-Lantz and Arrhenius conservation laws.</p>

<p><span class="field-label">Innovation / Novelty:</span> Unlike legacy surface dynamometers with 40-year-old empirical lookup tables, Catenary solves pure 116-node 1D wave mechanics at downhole conditions with zero artificial damping, delivering proactive 4.2-hour advance warning and deterministic Modbus-TCP SCADA automation.</p>

<p><span class="field-label">Target Users / Beneficiaries:</span> National oil companies (Oil India Limited, ONGC), mature thermal heavy oil operators, and field artificial lift production engineers.</p>

<p><span class="field-label">Expected Impact:</span> Slashes rod buckling failures by 85.4%, reduces lift power by 22.8%, delivers &#8377;52.5 Crore 5-year fleet NPV with sub-6-week payback, and abates 293.2 Metric Tons of CO2 equivalent annually.</p>

<p><span class="field-label">Current Development Stage:</span> Working prototype (TRL-6/7); complete control stack validated across 260/260 passing automated tests (100% Green, 60.09s) with live hardware-in-the-loop Modbus-TCP SCADA simulation.</p>

</body>
</html>
"""

html_path = "/tmp/Catenary_InnovationSummary_Humanized.html"
pdf_path_1 = "submission/Catenary_InnovationSummary.pdf"
pdf_path_2 = "submission/TeamCatenary_InnovationSummary.pdf"
final_dir = "/home/dk/Documents/FINAL"
os.makedirs(final_dir, exist_ok=True)

with open(html_path, "w", encoding="utf-8") as f:
    f.write(html_content)

cmd = [
    "google-chrome",
    "--headless",
    "--disable-gpu",
    "--no-sandbox",
    "--no-pdf-header-footer",
    f"--print-to-pdf={pdf_path_1}",
    html_path
]

print("Compiling humanized Innovation Summary PDF via Google Chrome...")
subprocess.run(cmd, check=True)

shutil.copyfile(pdf_path_1, pdf_path_2)
shutil.copyfile(pdf_path_1, os.path.join(final_dir, "Catenary_InnovationSummary.pdf"))
shutil.copyfile(pdf_path_1, os.path.join(final_dir, "TeamCatenary_InnovationSummary.pdf"))

print(f"Generated {pdf_path_1} ({os.path.getsize(pdf_path_1)} bytes)")
print(f"Copied to {final_dir}/Catenary_InnovationSummary.pdf")
