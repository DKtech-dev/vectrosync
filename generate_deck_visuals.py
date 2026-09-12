"""
Deck Visuals Generator for Catenary Enterprise Industrial Twin
Asset: Well #14, Baghewala Heavy Oil Asset, Bikaner-Nagaur Basin, Rajasthan | Operator: Oil India Limited
Model: OIL-BAGHEWALA-EOR-V2
"""

import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np
import os

os.makedirs('presentation_assets', exist_ok=True)
plt.rcParams['font.sans-serif'] = 'DejaVu Sans'
plt.rcParams['font.family'] = 'sans-serif'

# -------------------------------------------------------------
# 1. Slide 2: Process Flow (Reactive vs Anticipatory)
# -------------------------------------------------------------
def generate_slide2_flowchart():
    fig, ax = plt.subplots(figsize=(12, 3.2), dpi=300)
    ax.set_facecolor('#FFFFFF')
    fig.patch.set_facecolor('#FFFFFF')
    ax.axis('off')

    # Top Row: Reactive Field Reality
    ax.text(0.02, 0.88, "REACTIVE FIELD REALITY (0h WARNING LEAD)", fontsize=11, fontweight='bold', color='#DC2626')
    
    steps_reactive = [
        ("Steam Injection\n260°C (9 cP)", "#FEE2E2", "#DC2626"),
        ("Reservoir Cooldown\n260°C → 48°C", "#FEE2E2", "#DC2626"),
        ("Viscosity Surges\n9 cP → 12,000 cP", "#FEE2E2", "#DC2626"),
        ("Downstroke Drag\nExceeds Gravity", "#FEE2E2", "#DC2626"),
        ("Rod Float & Buckling\n(F_axial < 0 kN, Parted)", "#DC2626", "#FFFFFF")
    ]
    
    box_w = 0.165
    box_h = 0.28
    gap = 0.035
    start_x = 0.02
    y_reactive = 0.52
    
    for i, (text, bg, fg) in enumerate(steps_reactive):
        x = start_x + i * (box_w + gap)
        rect = patches.FancyBboxPatch((x, y_reactive), box_w, box_h, boxstyle="round,pad=0.015,rounding_size=0.015",
                                      facecolor=bg, edgecolor="#DC2626", linewidth=1.5)
        ax.add_patch(rect)
        ax.text(x + box_w/2, y_reactive + box_h/2, text, ha='center', va='center', fontsize=8.5, fontweight='bold' if i==4 else 'normal', color=fg)
        
        if i < len(steps_reactive) - 1:
            ax.annotate('', xy=(x + box_w + gap - 0.005, y_reactive + box_h/2), xytext=(x + box_w + 0.005, y_reactive + box_h/2),
                        arrowprops=dict(arrowstyle="-|>", color="#DC2626", lw=1.5, mutation_scale=12))

    # Bottom Row: Anticipatory Twin Mode
    ax.text(0.02, 0.40, "ANTICIPATORY DIGITAL TWIN MODE (4.2h EARLY WARNING LEAD)", fontsize=11, fontweight='bold', color='#059669')
    
    steps_twin = [
        ("Analytical Thermal\nDecay (Boberg-Lantz)", "#E0F2FE", "#0284C7"),
        ("Coupled Couette\nShear Forecast", "#E0F2FE", "#0284C7"),
        ("Fast MPC Throttles\nSPM: 4.7 → 2.8", "#D1FAE5", "#059669"),
        ("Continuous Positive Tension\n(+0.65 kN) — Zero Buckling!", "#059669", "#FFFFFF")
    ]
    
    box_w_t = 0.215
    gap_t = 0.04
    y_twin = 0.06
    
    for i, (text, bg, fg) in enumerate(steps_twin):
        x = start_x + i * (box_w_t + gap_t)
        rect = patches.FancyBboxPatch((x, y_twin), box_w_t, box_h, boxstyle="round,pad=0.015,rounding_size=0.015",
                                      facecolor=bg, edgecolor="#059669" if i >= 2 else "#0284C7", linewidth=1.5)
        ax.add_patch(rect)
        ax.text(x + box_w_t/2, y_twin + box_h/2, text, ha='center', va='center', fontsize=8.5, fontweight='bold' if i==3 else 'normal', color=fg)
        
        if i < len(steps_twin) - 1:
            ax.annotate('', xy=(x + box_w_t + gap_t - 0.005, y_twin + box_h/2), xytext=(x + box_w_t + 0.005, y_twin + box_h/2),
                        arrowprops=dict(arrowstyle="-|>", color="#059669" if i>=1 else "#0284C7", lw=1.5, mutation_scale=12))

    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    plt.tight_layout()
    plt.savefig('presentation_assets/slide2_flowchart.png', dpi=300, bbox_inches='tight', facecolor='#FFFFFF')
    plt.close()
    print("Slide 2 Flowchart generated.")

# -------------------------------------------------------------
# 2. Slide 2: UI Console Graphic
# -------------------------------------------------------------
def generate_slide2_console():
    fig = plt.figure(figsize=(7, 4.5), dpi=300, facecolor='#0E1117')
    
    # Grid setup
    gs = fig.add_gridspec(2, 2, height_ratios=[1.2, 1.0], width_ratios=[0.9, 1.1],
                           left=0.06, right=0.94, top=0.88, bottom=0.10, wspace=0.28, hspace=0.38)
    
    # Top banner text on figure
    fig.text(0.06, 0.94, "CATENARY ENTERPRISE INDUSTRIAL TWIN | OIL-BAGHEWALA-EOR-V2", color="#F8FAFC", fontsize=8.5, fontweight='bold')
    fig.text(0.72, 0.94, "● LIVE EDGE-LOCAL", color="#10B981", fontsize=7.5, fontweight='bold')
    fig.text(0.88, 0.94, "[calibrated]", color="#38BDF8", fontsize=7.5)

    # 1. Left Column: Wellbore schematic
    ax_well = fig.add_subplot(gs[:, 0])
    ax_well.set_facecolor('#1E293B')
    ax_well.set_title("1,150 m TVD WELLBORE DYNAMICS", color='#94A3B8', fontsize=7.5, pad=6)
    
    # Casing walls
    ax_well.plot([0.2, 0.2], [0, 1150], color='#64748B', lw=3)
    ax_well.plot([0.8, 0.8], [0, 1150], color='#64748B', lw=3)
    
    # Tapered Rod string
    ax_well.plot([0.5, 0.5], [1150, 800], color='#38BDF8', lw=4, label='1.0" Rod (0-350m)')
    ax_well.plot([0.5, 0.5], [800, 400], color='#38BDF8', lw=3, label='7/8" Rod (350-750m)')
    ax_well.plot([0.5, 0.5], [400, 0], color='#38BDF8', lw=2, label='3/4" Rod (750-1150m)')
    
    # Steam & Plume Zone
    ax_well.fill_between([0.2, 0.8], 0, 150, color='#F97316', alpha=0.35)
    ax_well.text(0.5, 75, "CSS STEAM SOAK\n260°C → 48°C", color='#FDBA74', fontsize=7, ha='center', va='center', fontweight='bold')
    
    # Rod tension callout
    ax_well.text(0.5, 950, "Surface Crank (144 in stroke)", color='#94A3B8', fontsize=6.8, ha='center')
    ax_well.text(0.5, 500, "Couette Drag β(x,t)", color='#38BDF8', fontsize=7, ha='center')
    ax_well.text(0.5, 220, "F_min = +0.65 kN\n(Floor >= +0.50 kN)", color='#10B981', fontsize=7, ha='center', fontweight='bold',
                 bbox=dict(boxstyle="round,pad=0.2", facecolor='#064E3B', edgecolor='#10B981', lw=1))
    
    ax_well.set_ylim(0, 1150)
    ax_well.set_xlim(0, 1)
    ax_well.set_ylabel("Depth (m TVD)", color='#94A3B8', fontsize=7)
    ax_well.tick_params(colors='#94A3B8', labelsize=6.5)
    ax_well.grid(True, color='#334155', ls=':', alpha=0.5)

    # 2. Right Top: Dynamometer Card
    ax_dyna = fig.add_subplot(gs[0, 1])
    ax_dyna.set_facecolor('#1E293B')
    ax_dyna.set_title("A/B DYNAMOMETER CARD OVERLAY", color='#94A3B8', fontsize=7.5, pad=6)
    
    # Baseline Card (Severe Compression / Deformed)
    pos_base = np.linspace(0, 144, 100)
    load_base_up = 18 + 8 * np.sin(np.pi * pos_base / 144) + np.random.normal(0, 0.2, 100)
    load_base_dn = -1.8 + 6 * np.sin(np.pi * pos_base / 144)**2 + np.random.normal(0, 0.3, 100)
    ax_dyna.plot(np.append(pos_base, pos_base[::-1]), np.append(load_base_up, load_base_dn), 
                 color='#EF4444', lw=1.5, ls='--', label='Baseline (-1.80 kN Float)')
    
    # Twin Controlled Card (Controlled Tension)
    load_twin_up = 16 + 6 * np.sin(np.pi * pos_base / 144)
    load_twin_dn = 0.65 + 4 * np.sin(np.pi * pos_base / 144)**2
    ax_dyna.plot(np.append(pos_base, pos_base[::-1]), np.append(load_twin_up, load_twin_dn), 
                 color='#10B981', lw=2.0, label='Twin (+0.65 kN, 2.8 SPM)')
    
    # Zero line & Tension Floor
    ax_dyna.axhline(0, color='#94A3B8', ls=':', lw=0.8)
    ax_dyna.axhline(0.5, color='#F59E0B', ls='-.', lw=0.8, label='Safety Floor (+0.50 kN)')
    
    ax_dyna.set_xlabel("Stroke Position (in)", color='#94A3B8', fontsize=6.5)
    ax_dyna.set_ylabel("Load (kN)", color='#94A3B8', fontsize=6.5)
    ax_dyna.tick_params(colors='#94A3B8', labelsize=6)
    ax_dyna.legend(fontsize=5.5, facecolor='#0F172A', edgecolor='#334155', labelcolor='#F8FAFC', loc='upper right')
    ax_dyna.grid(True, color='#334155', ls=':', alpha=0.5)

    # 3. Right Bottom: 12-Hour Causal Timeline
    ax_time = fig.add_subplot(gs[1, 1])
    ax_time.set_facecolor('#1E293B')
    ax_time.set_title("12-HOUR PREDICTIVE MPC TIMELINE", color='#94A3B8', fontsize=7.5, pad=6)
    
    t = np.linspace(0, 12, 100)
    viscosity = 9 + (12000 - 9) / (1 + np.exp(-1.2 * (t - 4.2)))
    spm = np.where(t < 4.2, 4.7, 2.8)
    
    ax_time_spm = ax_time.twinx()
    
    p1 = ax_time.plot(t, viscosity, color='#F59E0B', lw=1.8, label='Viscosity μ(t)')
    p2 = ax_time_spm.step(t, spm, color='#38BDF8', lw=1.8, where='post', label='SPM Setpoint')
    
    ax_time.axvline(4.2, color='#10B981', ls='--', lw=1.2)
    ax_time.text(4.3, 7500, "4.2h Intercept\nSPM 4.7→2.8", color='#10B981', fontsize=6.5, fontweight='bold')
    
    ax_time.set_xlabel("MPC Horizon (Hours)", color='#94A3B8', fontsize=6.5)
    ax_time.set_ylabel("Viscosity (cP)", color='#F59E0B', fontsize=6.5)
    ax_time_spm.set_ylabel("SPM", color='#38BDF8', fontsize=6.5)
    ax_time.tick_params(colors='#94A3B8', labelsize=6)
    ax_time_spm.tick_params(colors='#94A3B8', labelsize=6)
    ax_time.grid(True, color='#334155', ls=':', alpha=0.5)

    plt.savefig('presentation_assets/slide2_console_ui.png', dpi=300, bbox_inches='tight', facecolor='#0E1117')
    plt.close()
    print("Slide 2 Console UI generated.")

# -------------------------------------------------------------
# 3. Slide 3: 5-Module Physics Architecture
# -------------------------------------------------------------
def generate_slide3_architecture():
    fig, ax = plt.subplots(figsize=(8, 6.2), dpi=300)
    ax.set_facecolor('#FFFFFF')
    fig.patch.set_facecolor('#FFFFFF')
    ax.axis('off')

    modules = [
        ("MODULE 1: RESERVOIR THERMAL DECAY",
         "Boberg-Lantz analytical heat loss + Bessel quadrature integral\nT_avg(t) = T_R + (T_s - T_R)[v_r * v_z (1 - delta) - delta] + k(t)\nOutputs: Subsurface temperature profile T_avg(t)",
         "#EFF6FF", "#1E40AF", "#3B82F6"),
         
        ("MODULE 2: FLUID RHEOLOGY & COUETTE SHEAR DRAG",
         "Kelvin-Arrhenius dynamic viscosity: ln(μ) = A + B/T_K\nCouette shear drag: β(x,t) = f_ecc * 2π * μ_mix / ln(r_tubing / r_rod)\nOutputs: Dynamic damping coefficient β(x,t)",
         "#F0FDF4", "#166534", "#22C55E"),
         
        ("MODULE 3: 1D SUCKER-ROD WAVE MECHANICS",
         "Gibbs 1D elastodynamic wave PDE across 3-taper rod string (1\", 7/8\", 3/4\")\nρA(∂²u/∂t²) + β(∂u/∂t) = ∂/∂x(EA ∂u/∂x) + ρAg | CFL Δt <= 1.56 ms\nOutputs: Continuous downhole tension & surface dynamometer cards",
         "#FEF3C7", "#92400E", "#F59E0B"),
         
        ("MODULE 4: FAST-LOOP MPC & FAILSAFE CONTROLLER",
         "12-hour predictive horizon (4.2h lead time) optimizing SPM (1.0 - 6.0 SPM)\nHard KKT constraints: F_axial >= +0.50 kN, PPRL <= 90% rod rating\nOutputs: Real-time dynamic VFD speed setpoint dispatches",
         "#F5F3FF", "#5B21B6", "#8B5CF6"),
         
        ("MODULE 5: INDUSTRIAL EDGE SCADA & TELEMETRY",
         "Modbus RTU/TCP simulator + local MQTT broker + SHA-256 audit ledger\nPydantic schema with auto-mapping CSV adapter & Streamlit dashboard\nOutputs: 24 Hz live telemetry feed, audit logs & operator alerts",
         "#F8FAFC", "#0F172A", "#64748B")
    ]

    y_pos = 0.84
    box_h = 0.135
    box_w = 0.92
    gap = 0.042

    for i, (title, desc, bg, title_c, border_c) in enumerate(modules):
        y = y_pos - i * (box_h + gap)
        rect = patches.FancyBboxPatch((0.04, y), box_w, box_h, boxstyle="round,pad=0.015,rounding_size=0.015",
                                      facecolor=bg, edgecolor=border_c, linewidth=1.5)
        ax.add_patch(rect)
        
        # Module badge
        ax.text(0.06, y + box_h - 0.028, title, fontsize=9.5, fontweight='bold', color=title_c)
        # Description
        ax.text(0.06, y + 0.035, desc, fontsize=7.8, color='#334155', linespacing=1.2)
        
        # Directional Arrow down
        if i < len(modules) - 1:
            ax.annotate('', xy=(0.50, y - gap + 0.008), xytext=(0.50, y),
                        arrowprops=dict(arrowstyle="-|>", color="#0284C7", lw=2, mutation_scale=12))
            ax.text(0.52, y - gap/2, "Data Bus", fontsize=6.5, color='#0284C7', fontweight='bold', va='center')

    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    plt.tight_layout()
    plt.savefig('presentation_assets/slide3_architecture.png', dpi=300, bbox_inches='tight', facecolor='#FFFFFF')
    plt.close()
    print("Slide 3 Architecture generated.")

# -------------------------------------------------------------
# 4. Slide 4: 4-Level Supervisory State Machine
# -------------------------------------------------------------
def generate_slide4_statemachine():
    fig, ax = plt.subplots(figsize=(11, 2.8), dpi=300)
    ax.set_facecolor('#FFFFFF')
    fig.patch.set_facecolor('#FFFFFF')
    ax.axis('off')

    states = [
        ("LEVEL 0: NORMAL", "Latency < 10s\nNominal Telemetry", "Autonomous MPC\n(1.0 - 6.0 SPM)\nF_axial >= +0.50 kN", "#D1FAE5", "#059669", "#064E3B"),
        ("LEVEL 1: DEGRADED", "Latency 10-60s\nor Noisy Sensors", "Freeze Adaptation\nWiden Buffer (z=3)\nLookup Thermal", "#FEF3C7", "#D97706", "#78350F"),
        ("LEVEL 2: PROTECTIVE", "Latency > 60s\nor Modbus Loss", "3-Stroke Ramp Down\nTo 2.0 SPM Fallback\nEliminates Float", "#FFEDD5", "#EA580C", "#7C2D12"),
        ("LEVEL 3: EMERGENCY", "PPRL > 95% Rating\n(> 104.5 kN Yield)", "Instant Latched Motor\nCutoff & Critical SCADA\nPrevents Parting", "#FEE2E2", "#DC2626", "#7F1D1D")
    ]

    box_w = 0.20
    box_h = 0.72
    gap = 0.055
    start_x = 0.025
    y = 0.14

    for i, (lvl, trig, resp, bg, border, text_c) in enumerate(states):
        x = start_x + i * (box_w + gap)
        rect = patches.FancyBboxPatch((x, y), box_w, box_h, boxstyle="round,pad=0.015,rounding_size=0.015",
                                      facecolor=bg, edgecolor=border, linewidth=1.8)
        ax.add_patch(rect)
        
        # Header Box
        hdr_rect = patches.FancyBboxPatch((x, y + box_h - 0.22), box_w, 0.22, boxstyle="round,pad=0.01,rounding_size=0.01",
                                          facecolor=border, edgecolor=border, linewidth=1)
        ax.add_patch(hdr_rect)
        ax.text(x + box_w/2, y + box_h - 0.11, lvl, ha='center', va='center', fontsize=8.5, fontweight='bold', color='#FFFFFF')
        
        # Trigger
        ax.text(x + box_w/2, y + box_h - 0.33, trig, ha='center', va='center', fontsize=7.5, fontweight='bold', color=text_c)
        
        # Divider line
        ax.plot([x + 0.015, x + box_w - 0.015], [y + box_h - 0.44, y + box_h - 0.44], color=border, lw=0.8, ls=':')
        
        # Response
        ax.text(x + box_w/2, y + 0.14, resp, ha='center', va='center', fontsize=7.2, color='#1E293B', linespacing=1.15)
        
        # Transition Arrows
        if i < len(states) - 1:
            ax.annotate('', xy=(x + box_w + gap - 0.005, y + box_h/2), xytext=(x + box_w + 0.005, y + box_h/2),
                        arrowprops=dict(arrowstyle="-|>", color="#475569", lw=1.5, mutation_scale=11))

    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    plt.tight_layout()
    plt.savefig('presentation_assets/slide4_statemachine.png', dpi=300, bbox_inches='tight', facecolor='#FFFFFF')
    plt.close()
    print("Slide 4 State Machine generated.")

# -------------------------------------------------------------
# 5. Slide 5: Financial Waterfall Chart
# -------------------------------------------------------------
def generate_slide5_waterfall():
    fig, ax = plt.subplots(figsize=(6.5, 4.2), dpi=300)
    ax.set_facecolor('#FFFFFF')
    fig.patch.set_facecolor('#FFFFFF')

    bars = [
        ("Direct Rig\nWorkovers", 4.01, "#059669", "₹4.01 Cr"),
        ("VFD Power\nEfficiency", 0.30, "#059669", "₹0.30 Cr"),
        ("Tier-1 OPEX\nGuaranteed", 4.31, "#0F172A", "₹4.31 Cr"),
        ("Production\nRecovery", 18.59, "#0284C7", "₹12.1-25.1 Cr"),
        ("Total Asset\nPotential", 22.90, "#1E3A8A", "₹16.4-29.4 Cr")
    ]

    labels = [b[0] for b in bars]
    values = [b[1] for b in bars]
    colors = [b[2] for b in bars]
    texts = [b[3] for b in bars]

    x = np.arange(len(bars))
    rects = ax.bar(x, values, width=0.55, color=colors, edgecolor='#0F172A', linewidth=1.2)

    for i, (rect, val_text) in enumerate(zip(rects, texts)):
        h = rect.get_height()
        ax.text(rect.get_x() + rect.get_width()/2., h + 0.6, val_text,
                ha='center', va='bottom', fontsize=8, fontweight='bold', color=colors[i] if colors[i] != '#0F172A' else '#0F172A')

    # Connecting dotted lines
    ax.plot([0, 1], [4.01, 4.01], color='#64748B', ls='--', lw=1)
    ax.plot([1, 2], [4.31, 4.31], color='#64748B', ls='--', lw=1)

    ax.set_ylabel("Annual Field Value (Crore INR)", fontsize=8, fontweight='bold', color='#0F172A')
    ax.set_xticks(x)
    ax.set_xticklabels(labels, fontsize=7.5, fontweight='bold', color='#334155')
    ax.set_ylim(0, 27)
    ax.grid(axis='y', color='#E2E8F0', ls=':', alpha=0.8)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_color('#94A3B8')
    ax.spines['bottom'].set_color('#94A3B8')
    ax.tick_params(colors='#475569', labelsize=7.5)

    plt.tight_layout()
    plt.savefig('presentation_assets/slide5_waterfall.png', dpi=300, bbox_inches='tight', facecolor='#FFFFFF')
    plt.close()
    print("Slide 5 Waterfall generated.")

# -------------------------------------------------------------
# 6. Slide 6: TRL Step Ladder
# -------------------------------------------------------------
def generate_slide6_trl():
    fig, ax = plt.subplots(figsize=(6.2, 4.2), dpi=300)
    ax.set_facecolor('#FFFFFF')
    fig.patch.set_facecolor('#FFFFFF')
    ax.axis('off')

    steps = [
        ("TRL 4-5 (COMPLETED)",
         "Pre-Validated Physics Core\n• 255/255 passing unit tests\n• Exact Boberg-Lantz analytical limits\n• CFL wave solver stability (Δt <= 1.56 ms)",
         "#F1F5F9", "#64748B", "#0F172A", 0.08, 0.26),
         
        ("TRL 6 (IMMEDIATE TARGET — THE ASK)",
         "60-Day Shadow-Mode Pilot\n• Non-actuating read-only RTU ingestion\n• Zero operational or hardware risk\n• Calibrates dynamic k(t) on 2 Baghewala wells",
         "#ECFDF5", "#059669", "#064E3B", 0.38, 0.30),
         
        ("TRL 7 (COMMERCIAL SCALE)",
         "Autonomous Field Fleet Rollout\n• Full 23 active CSS well integration\n• Unlocks ₹4.31 Cr annual direct OPEX savings\n• Scalable to ONGC Gujarat heavy-oil assets",
         "#EFF6FF", "#3B82F6", "#1E3A8A", 0.70, 0.26)
    ]

    for title, desc, bg, border, text_c, y, h in steps:
        rect = patches.FancyBboxPatch((0.05, y), 0.90, h, boxstyle="round,pad=0.015,rounding_size=0.015",
                                      facecolor=bg, edgecolor=border, linewidth=2.0 if "TRL 6" in title else 1.2)
        ax.add_patch(rect)
        
        # Badge
        badge_bg = border if "TRL 6" in title else "#0F172A"
        badge_rect = patches.FancyBboxPatch((0.07, y + h - 0.07), 0.50 if "TRL 6" in title else 0.40, 0.055,
                                            boxstyle="round,pad=0.01,rounding_size=0.01", facecolor=badge_bg, edgecolor=badge_bg)
        ax.add_patch(badge_rect)
        ax.text(0.09, y + h - 0.043, title, fontsize=7.5, fontweight='bold', color='#FFFFFF', va='center')
        
        # Highlighting badge for TRL 6
        if "TRL 6" in title:
            callout = patches.FancyBboxPatch((0.60, y + h - 0.07), 0.32, 0.055,
                                            boxstyle="round,pad=0.01,rounding_size=0.01", facecolor="#DC2626", edgecolor="#DC2626")
            ax.add_patch(callout)
            ax.text(0.62, y + h - 0.043, "★ ZERO HARDWARE RISK", fontsize=6.8, fontweight='bold', color='#FFFFFF', va='center')

        # Description
        ax.text(0.08, y + 0.03, desc, fontsize=7.5, color='#334155', linespacing=1.25)

    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    plt.tight_layout()
    plt.savefig('presentation_assets/slide6_trl.png', dpi=300, bbox_inches='tight', facecolor='#FFFFFF')
    plt.close()
    print("Slide 6 TRL generated.")

if __name__ == '__main__':
    generate_slide2_flowchart()
    generate_slide2_console()
    generate_slide3_architecture()
    generate_slide4_statemachine()
    generate_slide5_waterfall()
    generate_slide6_trl()
    print("All visuals generated successfully.")
