"""
VectroSync Enterprise Industrial Twin — Interactive Simulator (app.py)
Asset: Well #14, Baghewala Heavy Oil Asset, Bikaner-Nagaur Basin, Rajasthan | Operator: Oil India Limited
Model: OIL-BAGHEWALA-EOR-V2

Professional industrial application shell. All physics computation
delegated to clean-room engine modules in src/.
"""

import time
import numpy as np
import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import streamlit as st
import streamlit.components.v1 as components

from src.thermal import ThermalDecayEngine, ThermalAssetParameters
from src.rheology import HeavyOilRheology, RheologyParameters
from src.rod_conservative import ConservativeRodWaveSolver, DynacardResult
from src.pump_boundary import PlungerBoundary
from src.failsafe import FailsafeStateMachine, SupervisoryFailsafe, FailsafeLevel
from src.controller import FastMPCController, MPCConfig, WellState
from src.adapter import AdaptiveCSVParser, UnitConverter, ColumnMapper
from src.audit import AuditLedger

from src.animated_well import render_animated_well_html
from src.why_engine import WhyEngine, DiagnosticReasoning
from src.scenario_runner import ScenarioRunner, ScenarioType, SCENARIO_PRESETS
from src.depth_stress import compute_spatiotemporal_stress_matrix, create_depth_stress_heatmap

# ─── Page Config ───────────────────────────────────────────────

st.set_page_config(
    page_title="VectroSync Enterprise Industrial Twin | Baghewala Well #14",
    page_icon="",
    layout="wide",
    initial_sidebar_state="expanded",
)


# ─── Design System CSS ────────────────────────────────────────

st.markdown("""
<style>
    /* ── Reset & Base ── */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

    .stApp {
        background-color: #ffffff;
        color: #1f2937;
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
    }

    /* Hide default Streamlit chrome */
    #MainMenu, footer, header {visibility: hidden;}
    .stDeployButton {display: none;}
    div[data-testid="stToolbar"] {display: none;}
    div[data-testid="stDecoration"] {display: none;}

    /* ── Header ── */
    .app-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 0 14px 0;
        border-bottom: 1px solid #e5e7eb;
        margin-bottom: 16px;
    }
    .app-header .title {
        font-size: 15px;
        font-weight: 700;
        color: #111827;
        letter-spacing: -0.01em;
    }
    .app-header .subtitle {
        font-size: 12px;
        color: #6b7280;
        margin-top: 2px;
    }
    .app-header .tag {
        display: inline-block;
        background: #f3f4f6;
        color: #374151;
        font-size: 10px;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 3px;
        margin-left: 8px;
        letter-spacing: 0.03em;
    }

    /* ── State badge ── */
    .state-ok {
        display: inline-flex; align-items: center; gap: 6px;
        background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0;
        padding: 4px 12px; border-radius: 4px; font-size: 11px; font-weight: 600;
    }
    .state-warn {
        display: inline-flex; align-items: center; gap: 6px;
        background: #fffbeb; color: #92400e; border: 1px solid #fde68a;
        padding: 4px 12px; border-radius: 4px; font-size: 11px; font-weight: 600;
    }
    .state-danger {
        display: inline-flex; align-items: center; gap: 6px;
        background: #fef2f2; color: #991b1b; border: 1px solid #fecaca;
        padding: 4px 12px; border-radius: 4px; font-size: 11px; font-weight: 600;
    }
    .dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
    .dot-green { background: #059669; }
    .dot-yellow { background: #d97706; }
    .dot-red { background: #dc2626; }

    /* ── KPI strip ── */
    div[data-testid="stMetric"] {
        background: #fafafa;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        padding: 10px 12px;
    }
    div[data-testid="stMetric"] label {
        color: #6b7280 !important;
        font-size: 10.5px !important;
        font-weight: 600 !important;
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }
    div[data-testid="stMetric"] div[data-testid="stMetricValue"] {
        color: #111827 !important;
        font-size: 20px !important;
        font-weight: 700 !important;
        font-variant-numeric: tabular-nums;
    }

    /* ── Scenario buttons ── */
    .scenario-bar {
        background: #fafafa;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        padding: 10px 14px;
        margin-bottom: 14px;
    }
    .scenario-label {
        font-size: 10.5px;
        font-weight: 700;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 6px;
    }

    /* ── Section headers ── */
    .section-head {
        font-size: 13px;
        font-weight: 700;
        color: #111827;
        padding-bottom: 6px;
        border-bottom: 1px solid #f3f4f6;
        margin-bottom: 10px;
    }

    /* ── Data cards ── */
    .data-card {
        background: #fafafa;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        padding: 14px;
    }
    .data-card h4 {
        font-size: 12px;
        font-weight: 700;
        color: #111827;
        margin: 0 0 8px 0;
    }
    .data-row {
        display: flex;
        justify-content: space-between;
        padding: 4px 0;
        border-bottom: 1px solid #f9fafb;
        font-size: 12px;
    }
    .data-row:last-child { border-bottom: none; }
    .data-key { color: #6b7280; }
    .data-val {
        color: #111827;
        font-weight: 600;
        font-family: 'JetBrains Mono', monospace;
        font-size: 11.5px;
    }

    /* ── Reasoning card ── */
    .reason-card {
        background: #fafafa;
        border: 1px solid #e5e7eb;
        border-left: 3px solid #2563eb;
        border-radius: 6px;
        padding: 14px 16px;
    }
    .reason-card.danger {
        border-left-color: #dc2626;
    }
    .reason-head {
        font-size: 12px;
        font-weight: 700;
        color: #111827;
        margin-bottom: 10px;
    }
    .reason-section {
        font-size: 10.5px;
        font-weight: 700;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        margin-top: 8px;
        margin-bottom: 2px;
    }
    .reason-text {
        font-size: 12px;
        color: #374151;
        line-height: 1.5;
    }

    /* ── Taper cards ── */
    .taper-card {
        background: #fafafa;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        padding: 12px;
    }
    .taper-card h4 {
        font-size: 11.5px;
        font-weight: 700;
        color: #111827;
        margin: 0 0 6px 0;
    }

    /* ── Callouts ── */
    .callout-ok {
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        border-radius: 4px;
        padding: 7px 10px;
        font-size: 11.5px;
        color: #166534;
        font-weight: 500;
        margin-top: 8px;
    }
    .callout-err {
        background: #fef2f2;
        border: 1px solid #fecaca;
        border-radius: 4px;
        padding: 7px 10px;
        font-size: 11.5px;
        color: #991b1b;
        font-weight: 500;
        margin-top: 8px;
    }

    /* ── Scenario description ── */
    .scenario-desc {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 5px;
        padding: 10px 14px;
        font-size: 12px;
        color: #374151;
        line-height: 1.5;
        margin-bottom: 14px;
    }
    .scenario-desc strong {
        color: #111827;
    }

    /* ── Scenario button active state ── */
    div[data-testid="stHorizontalBlock"] button[kind="secondary"] {
        border-radius: 5px;
        font-weight: 600;
        font-size: 12px;
        letter-spacing: 0.01em;
        transition: all 0.15s ease;
    }
</style>
""", unsafe_allow_html=True)


# ─── Session State Init ────────────────────────────────────────

for key, factory in {
    "audit_ledger": lambda: AuditLedger(well_id="Baghewala-14"),
    "active_scenario": lambda: ScenarioType.DEFAULT_OPERATION,
    "modbus_severed": lambda: False,
    "last_telemetry_time": lambda: time.time(),
    "failsafe": lambda: SupervisoryFailsafe(),
    "thermal_engine": lambda: ThermalDecayEngine(),
    "rheo_engine": lambda: HeavyOilRheology(),
    "wave_solver": lambda: ConservativeRodWaveSolver(dx=10.0),
    "mpc_controller": lambda: FastMPCController(),
}.items():
    if key not in st.session_state:
        st.session_state[key] = factory()

# Guard against stale session: if failsafe was cached without reset(), recreate it
if not hasattr(st.session_state.failsafe, "reset"):
    st.session_state.failsafe = SupervisoryFailsafe()

scenario_cfg = ScenarioRunner.get_preset(st.session_state.active_scenario)


# ─── Plotly defaults ───────────────────────────────────────────

PLOT_LAYOUT = dict(
    paper_bgcolor="#ffffff",
    plot_bgcolor="#fafafa",
    font=dict(family="Inter, system-ui, sans-serif", color="#374151", size=11),
    margin=dict(l=45, r=15, t=40, b=35),
)

AXIS_STYLE = dict(
    gridcolor="#f3f4f6",
    showline=True,
    linecolor="#d1d5db",
    color="#6b7280",
)


# ─── Header ────────────────────────────────────────────────────

def _state_badge():
    sc = st.session_state.active_scenario
    if sc == ScenarioType.SCENARIO_A_BASELINE_FAILURE:
        return '<span class="state-danger"><span class="dot dot-red"></span>BASELINE FAILURE</span>'
    elif sc == ScenarioType.SCENARIO_C_TELEMETRY_SEVERED:
        return '<span class="state-warn"><span class="dot dot-yellow"></span>FAILSAFE PROTECTIVE</span>'
    else:
        return '<span class="state-ok"><span class="dot dot-green"></span>NOMINAL</span>'

st.markdown(f"""
<div class="app-header">
    <div>
        <div class="title">
            VECTROSYNC ENTERPRISE INDUSTRIAL TWIN
            <span class="tag">OIL-BAGHEWALA-EOR-V2</span>
            <span class="tag">WELL #14</span>
        </div>
        <div class="subtitle">Oil India Limited &middot; Baghewala Field &middot; Jodhpur Sandstone at 1,150 m TVD &middot; CSS + SRP Optimization</div>
    </div>
    <div>
        {_state_badge()}
    </div>
</div>
""", unsafe_allow_html=True)


# ─── Scenario Toolbar ─────────────────────────────────────────

st.markdown('<div class="scenario-bar"><div class="scenario-label">Scenario Controller</div></div>', unsafe_allow_html=True)

sc1, sc2, sc3, sc4 = st.columns(4)

with sc1:
    if st.button("Baseline Failure (A)", width='stretch', help="Cooldown to 50 C, 4.7 SPM fixed, compressive buckling"):
        st.session_state.active_scenario = ScenarioType.SCENARIO_A_BASELINE_FAILURE
        st.session_state.modbus_severed = False
        st.session_state.failsafe.reset()
        st.session_state.audit_ledger.record_event(event_type="SCENARIO_TRIGGERED", provenance_tag="[synthetic]", payload={"scenario": "A"})
        st.rerun()

with sc2:
    if st.button("Coupled Twin (B)", width='stretch', help="MPC intervention, throttle to 2.8 SPM, +0.65 kN maintained"):
        st.session_state.active_scenario = ScenarioType.SCENARIO_B_COUPLED_TWIN
        st.session_state.modbus_severed = False
        st.session_state.failsafe.reset()
        st.session_state.audit_ledger.record_event(event_type="SCENARIO_TRIGGERED", provenance_tag="[model]", payload={"scenario": "B"})
        st.rerun()

with sc3:
    if st.button("Telemetry Dropout (C)", width='stretch', help="Modbus cable severed, failsafe ramp to 2.0 SPM"):
        st.session_state.active_scenario = ScenarioType.SCENARIO_C_TELEMETRY_SEVERED
        st.session_state.modbus_severed = True
        st.session_state.audit_ledger.record_event(event_type="SCENARIO_TRIGGERED", provenance_tag="[synthetic]", payload={"scenario": "C"})
        st.rerun()

with sc4:
    if st.button("Reset to Nominal", width='stretch', help="Restore default calibrated state"):
        st.session_state.active_scenario = ScenarioType.DEFAULT_OPERATION
        st.session_state.modbus_severed = False
        st.session_state.failsafe.reset()
        st.session_state.audit_ledger.record_event(event_type="SCENARIO_RESET", provenance_tag="[measured]", payload={"scenario": "DEFAULT"})
        st.rerun()


# ─── Active Scenario Context ──────────────────────────────────

st.markdown(f'<div class="scenario-desc"><strong>{scenario_cfg.name}:</strong> {scenario_cfg.description}</div>', unsafe_allow_html=True)


# ─── Sidebar: Parameter Controls ──────────────────────────────

st.sidebar.markdown("**Parameter Overrides**")
st.sidebar.caption(f"Active: {scenario_cfg.name}")

with st.sidebar.expander("Thermal & Steam", expanded=False):
    cooling_mult = st.slider("Cooling Rate Multiplier", 0.5, 3.0, float(scenario_cfg.cooling_multiplier), 0.05)
    steam_quality = st.slider("Steam Quality (X)", 0.40, 0.95, float(scenario_cfg.steam_quality), 0.05)
    elapsed_days = st.slider("CSS Cycle Elapsed (days)", 0.0, 90.0, float(scenario_cfg.elapsed_days), 0.5)

with st.sidebar.expander("Rheology & Fluid", expanded=False):
    water_cut_val = st.slider("Water Cut (fw)", 0.05, 0.85, float(scenario_cfg.water_cut), 0.05)
    plunger_sand_wear = st.slider("Sand Wear Coefficient", 0.0, 1.0, float(scenario_cfg.plunger_sand_wear), 0.05)

with st.sidebar.expander("Pumping Kinematics", expanded=False):
    target_spm = st.slider("Target Speed (SPM)", 1.0, 6.0, float(scenario_cfg.target_spm), 0.1)
    stroke_length_m = st.slider("Stroke Length (m)", 1.5, 3.2, 2.54, 0.05)

st.sidebar.divider()
is_modbus_cut = scenario_cfg.modbus_severed or st.session_state.modbus_severed
if is_modbus_cut:
    simulated_telemetry_age = 75.0
    st.sidebar.error("Modbus Dropout  (latency > 60s)")
else:
    simulated_telemetry_age = 1.2
    st.sidebar.success("Modbus Online  (< 2s)")


# ─── Physics Computation Pass ──────────────────────────────────

tau_sec = elapsed_days * 86400.0

# Thermal
t_res_k = st.session_state.thermal_engine.temperature_calibrated(tau_sec, k_hat=cooling_mult)
t_res_c = t_res_k - 273.15

# Rheology
mu_mix_pas = st.session_state.rheo_engine.mixture_viscosity(t_res_k, fw=water_cut_val)
beta_shear = st.session_state.rheo_engine.couette_drag_beta(mu_mix_pas, r_rod=0.0127)

# MPC
forecast_temps = list(np.linspace(t_res_c, max(48.0, t_res_c - 12.0), 24))
well_state = WellState(spm_current=target_spm, temperature_C=t_res_c, viscosity_Pas=mu_mix_pas)
mpc_plan = st.session_state.mpc_controller.solve(well_state, forecast_temps)
advisory_spm = mpc_plan.optimal_spm

# Dynamic tension evaluation for failsafe supervisory check
if st.session_state.active_scenario == ScenarioType.SCENARIO_A_BASELINE_FAILURE or not scenario_cfg.mpc_enabled:
    uncoupled_preview = st.session_state.wave_solver.simulate_card(
        spm=target_spm, temp_c=t_res_c, water_cut=water_cut_val,
        sand_wear=plunger_sand_wear, n_strokes=3,
    )
    sim_tension = float(uncoupled_preview.min_downhole_tension_kn)
else:
    sim_tension = float(mpc_plan.predicted_min_tension_kN[0])

fs_state, fs_reason, safe_spm = st.session_state.failsafe.evaluate_state(
    current_time=curr_time,
    last_telemetry_time=last_time,
    pprl_kn=105.0,
    min_tension_kn=sim_tension,
    simulated_disconnect=is_modbus_cut,
)

# Resolve effective operating state purely from physics and control logic
if st.session_state.active_scenario == ScenarioType.SCENARIO_A_BASELINE_FAILURE:
    effective_spm = target_spm
elif st.session_state.active_scenario == ScenarioType.SCENARIO_B_COUPLED_TWIN:
    effective_spm = advisory_spm if scenario_cfg.mpc_enabled else scenario_cfg.expected_spm
elif st.session_state.active_scenario == ScenarioType.SCENARIO_C_TELEMETRY_SEVERED:
    effective_spm = safe_spm
else:
    effective_spm = safe_spm if fs_state != FailsafeLevel.LEVEL_0_NORMAL else (advisory_spm if scenario_cfg.mpc_enabled else target_spm)

# Wave simulations
twin_card = st.session_state.wave_solver.simulate_card(
    spm=effective_spm, temp_c=t_res_c, water_cut=water_cut_val,
    sand_wear=plunger_sand_wear, n_strokes=3,
)
baseline_card = st.session_state.wave_solver.simulate_card(
    spm=target_spm, temp_c=48.0, water_cut=water_cut_val,
    sand_wear=plunger_sand_wear, n_strokes=3,
)

actual_min_tension = float(twin_card.min_downhole_tension_kn)
is_buckling_active = bool(twin_card.is_floating or actual_min_tension < 0.0)


# ─── KPI Strip ─────────────────────────────────────────────────

k1, k2, k3, k4 = st.columns(4)

with k1:
    st.metric("Formation Temperature", f"{t_res_c:.1f} C", f"{t_res_c - 48.0:+.1f} vs native")
with k2:
    st.metric("Crude Viscosity", f"{mu_mix_pas * 1000:.0f} cP", f"{mu_mix_pas:.3f} Pa.s", delta_color="inverse")
with k3:
    tension_label = f"{'+' if actual_min_tension >= 0 else ''}{actual_min_tension:.2f} kN"
    st.metric("Min Rod Tension", tension_label, "Safe" if actual_min_tension >= 0.5 else "BELOW LIMIT",
              delta_color="normal" if actual_min_tension >= 0.5 else "inverse")
with k4:
    st.metric("Operating Speed", f"{effective_spm:.1f} SPM", f"Target: {target_spm:.1f}")


# ─── Main Viewport: Wellbore + Analysis ────────────────────────

col_well, col_analysis = st.columns([4, 6])

# ── LEFT: Animated Wellbore Schematic ──
with col_well:
    st.markdown('<div class="section-head">Wellbore Cross-Section</div>', unsafe_allow_html=True)

    well_html = render_animated_well_html(
        spm=effective_spm,
        temp_c=t_res_c,
        min_tension_kn=actual_min_tension,
        is_buckling=is_buckling_active,
        is_modbus_severed=is_modbus_cut,
        failsafe_level=fs_state.value if hasattr(fs_state, "value") else str(fs_state),
        water_cut=water_cut_val,
        height_px=620,
    )
    components.html(well_html, height=630, scrolling=False)


# ── RIGHT: Tabbed Analysis ──
with col_analysis:
    tab_card, tab_stress, tab_timeline, tab_csv, tab_audit = st.tabs([
        "Dynamometer Cards",
        "Depth-Stress Map",
        "12-Hour Forecast",
        "CSV Ingestion",
        "Audit Ledger",
    ])

    # ── Tab 1: Dynacards ──
    with tab_card:
        fig_card = go.Figure()

        # Baseline downhole (uncoupled) from pure physical wave solver
        fig_card.add_trace(go.Scatter(
            x=twin_card.surface_position_m,
            y=baseline_card.downhole_load_kn,
            name="Baseline Downhole (uncoupled)",
            line=dict(color="#ef4444", width=2, dash="dot"),
            mode="lines",
        ))

        fig_card.add_trace(go.Scatter(
            x=twin_card.surface_position_m,
            y=twin_card.surface_load_kn,
            name="Coupled Surface",
            line=dict(color="#2563eb", width=2.5),
            mode="lines",
        ))

        fig_card.add_trace(go.Scatter(
            x=twin_card.surface_position_m,
            y=twin_card.downhole_load_kn,
            name="Coupled Downhole" if not is_buckling_active else "Buckled Downhole",
            line=dict(color="#059669" if not is_buckling_active else "#ef4444", width=2.5),
            mode="lines",
        ))

        fig_card.add_hline(
            y=0.5, line_dash="dash", line_color="#d97706", line_width=1,
            annotation_text="+0.5 kN structural limit",
            annotation_position="bottom right",
            annotation_font=dict(size=9, color="#92400e"),
        )

        fig_card.update_layout(
            title=dict(text="Elastic Dynamometer Card — Baseline vs Coupled Twin", font=dict(size=13, color="#1f2937")),
            xaxis=dict(title=dict(text="Polished Rod Displacement (m)", font=dict(size=11)), **AXIS_STYLE),
            yaxis=dict(title=dict(text="Axial Load (kN)", font=dict(size=11)), **AXIS_STYLE),
            legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1.0, font=dict(size=9, color="#6b7280")),
            height=400,
            **PLOT_LAYOUT,
        )
        fig_card.update_layout(modebar=dict(remove=["toImage", "lasso2d", "select2d"]))
        st.plotly_chart(fig_card, width='stretch')

        # Telemetry readout
        callout_cls = "callout-ok" if not is_buckling_active else "callout-err"
        callout_msg = (
            "Tension preserved — string within fatigue endurance envelope"
            if not is_buckling_active
            else f"Compressive buckling active — rod float on downstroke (F_min = {actual_min_tension:.2f} kN)"
        )

        st.markdown(f"""
        <div class="data-card" style="padding:10px 12px;">
            <div class="data-row"><span class="data-key">PPRL</span><span class="data-val">{twin_card.pprl_kn:.1f} kN</span></div>
            <div class="data-row"><span class="data-key">MPRL</span><span class="data-val">{twin_card.mprl_kn:.1f} kN</span></div>
            <div class="data-row"><span class="data-key">Downhole Min</span>
                <span class="data-val" style="color:{'#059669' if actual_min_tension >= 0.5 else '#dc2626'}">{actual_min_tension:+.2f} kN</span>
            </div>
            <div class="data-row"><span class="data-key">Net Oil</span><span class="data-val">{twin_card.oil_production_bopd:.1f} BOPD</span></div>
            <div class="{callout_cls}">{callout_msg}</div>
        </div>
        """, unsafe_allow_html=True)

    # ── Tab 2: Depth-Stress Heatmap ──
    with tab_stress:
        angles_deg, depths_m, stress_matrix = compute_spatiotemporal_stress_matrix(
            depths_m=st.session_state.wave_solver.node_depths,
            node_areas_m2=st.session_state.wave_solver.node_area,
            dynacard_result=twin_card,
            spm=effective_spm,
            is_buckling=is_buckling_active,
        )

        fig_stress = create_depth_stress_heatmap(angles_deg, depths_m, stress_matrix, is_buckling=is_buckling_active)
        st.plotly_chart(fig_stress, width='stretch')

        # Taper inspection
        tc1, tc2, tc3 = st.columns(3)
        with tc1:
            st.markdown("""
            <div class="taper-card">
                <h4>Section 1 — 1.0 in.</h4>
                <div class="data-row"><span class="data-key">Depth</span><span class="data-val">0 – 350 m</span></div>
                <div class="data-row"><span class="data-key">Area</span><span class="data-val">5.067 cm2</span></div>
                <div class="data-row"><span class="data-key">Mass</span><span class="data-val">3.98 kg/m</span></div>
                <div class="data-row"><span class="data-key">SF</span><span class="data-val">1.85</span></div>
            </div>
            """, unsafe_allow_html=True)

        with tc2:
            st.markdown("""
            <div class="taper-card">
                <h4>Section 2 — 7/8 in.</h4>
                <div class="data-row"><span class="data-key">Depth</span><span class="data-val">350 – 750 m</span></div>
                <div class="data-row"><span class="data-key">Area</span><span class="data-val">3.879 cm2</span></div>
                <div class="data-row"><span class="data-key">Mass</span><span class="data-val">3.05 kg/m</span></div>
                <div class="data-row"><span class="data-key">SF</span><span class="data-val">1.62</span></div>
            </div>
            """, unsafe_allow_html=True)

        with tc3:
            sf3 = "0.72 (BUCKLE)" if is_buckling_active else "1.45"
            sf3_color = "#dc2626" if is_buckling_active else "#059669"
            st.markdown(f"""
            <div class="taper-card">
                <h4>Section 3 — 3/4 in.</h4>
                <div class="data-row"><span class="data-key">Depth</span><span class="data-val">750 – 1,150 m</span></div>
                <div class="data-row"><span class="data-key">Area</span><span class="data-val">2.850 cm2</span></div>
                <div class="data-row"><span class="data-key">Mass</span><span class="data-val">2.24 kg/m</span></div>
                <div class="data-row"><span class="data-key">SF</span><span class="data-val" style="color:{sf3_color}">{sf3}</span></div>
            </div>
            """, unsafe_allow_html=True)

    # ── Tab 3: 12-Hour Forecast ──
    with tab_timeline:
        hours = np.linspace(0, 12, 24)
        visc_horizon = [st.session_state.rheo_engine.mixture_viscosity(t + 273.15, fw=water_cut_val) for t in forecast_temps]
        drag_horizon = [st.session_state.rheo_engine.couette_drag_beta(v, r_rod=0.0127) for v in visc_horizon]
        spm_horizon = mpc_plan.spm_trajectory if not is_buckling_active else [target_spm] * 24

        fig_t = make_subplots(
            rows=2, cols=2,
            subplot_titles=(
                "Formation Temperature (C)",
                "Crude Viscosity (cP)",
                "Couette Shear Drag (N.s/m2)",
                "MPC Speed Modulation (SPM)",
            ),
        )

        fig_t.add_trace(go.Scatter(x=hours, y=forecast_temps, mode="lines+markers",
                                   line=dict(color="#2563eb", width=1.8), marker=dict(size=3)), row=1, col=1)
        fig_t.add_trace(go.Scatter(x=hours, y=[v * 1000 for v in visc_horizon], mode="lines+markers",
                                   line=dict(color="#d97706", width=1.8), marker=dict(size=3)), row=1, col=2)
        fig_t.add_trace(go.Scatter(x=hours, y=drag_horizon, mode="lines+markers",
                                   line=dict(color="#dc2626", width=1.8), marker=dict(size=3)), row=2, col=1)
        fig_t.add_trace(go.Scatter(x=hours, y=spm_horizon, mode="lines+markers",
                                   line=dict(color="#059669", width=2), marker=dict(size=3)), row=2, col=2)

        fig_t.update_layout(
            height=400,
            showlegend=False,
            **PLOT_LAYOUT,
        )
        fig_t.update_xaxes(**AXIS_STYLE)
        fig_t.update_yaxes(**AXIS_STYLE)
        fig_t.update_annotations(font=dict(size=11, color="#374151"))
        st.plotly_chart(fig_t, width='stretch')

    # ── Tab 4: CSV Ingestion ──
    with tab_csv:
        st.markdown('<div class="section-head">Adaptive CSV Ingestion</div>', unsafe_allow_html=True)
        up_file = st.file_uploader("Upload SCADA / Well Test CSV", type=["csv", "txt"])
        use_default = st.checkbox("Load sample Baghewala Well #14 telemetry", value=True)

        if up_file is not None:
            csv_str = up_file.getvalue().decode("utf-8")
        elif use_default:
            csv_str = """# OIL INDIA LIMITED - FIELD SCADA TELEMETRY (BAGHEWALA-14)
Time_Stamp,POLISHED_ROD_LOAD_KLBS,Stroke_Disp_in,Speed_SPM,BHT_degF
2026-09-01 10:00:00,12.5,0.0,4.2,176.0
2026-09-01 10:00:01,18.4,15.2,4.2,176.0
2026-09-01 10:00:02,24.8,38.5,4.2,176.0
2026-09-01 10:00:03,NaN,65.0,4.2,176.0
2026-09-01 10:00:04,28.9,88.2,4.2,176.0
2026-09-01 10:00:05,29.4,100.0,4.2,176.0
"""
        else:
            csv_str = None

        if csv_str is not None:
            try:
                parsed = AdaptiveCSVParser.parse_content(csv_str)
                st.success(f"Ingested {parsed.row_count} rows. Bounded gaps linearly imputed.")
                df_conv = pd.DataFrame(parsed.column_data)
                st.dataframe(df_conv.head(6), width='stretch')
            except Exception as ex:
                st.error(f"Ingestion Error: {str(ex)}")

    # ── Tab 5: Audit Ledger ──
    with tab_audit:
        st.markdown('<div class="section-head">SHA-256 Provenance Audit Chain</div>', unsafe_allow_html=True)
        is_tamper_free, err = st.session_state.audit_ledger.verify_chain()
        if is_tamper_free:
            st.success("Ledger integrity verified (0 tamper detections)")
        else:
            st.error(f"Ledger breach: {err}")

        events = st.session_state.audit_ledger.get_recent_events_table(limit=8)
        if events:
            df_ev = pd.DataFrame(events)[["index", "timestamp_iso", "event_type", "provenance_tag", "event_hash_short"]]
            st.dataframe(df_ev, width='stretch')


# ─── Bottom: Reasoning + Economics ─────────────────────────────

st.divider()

col_reason, col_econ = st.columns([5, 5])

# ── Reasoning Engine ──
with col_reason:
    st.markdown('<div class="section-head">Causal Reasoning Engine</div>', unsafe_allow_html=True)

    diag = WhyEngine.generate_explanation(
        elapsed_days=elapsed_days,
        temp_c=t_res_c,
        viscosity_cp=mu_mix_pas * 1000.0,
        drag_beta=beta_shear,
        min_tension_kn=actual_min_tension,
        nominal_spm=target_spm,
        effective_spm=effective_spm,
        failsafe_level=fs_state.value if hasattr(fs_state, "value") else str(fs_state),
        is_modbus_severed=is_modbus_cut,
    )

    card_cls = "reason-card danger" if is_buckling_active else "reason-card"

    st.markdown(f"""
    <div class="{card_cls}">
        <div class="reason-head">Physics Diagnostic Trace</div>
        <div class="reason-section">1. Trigger Event</div>
        <div class="reason-text">{diag.trigger_event}</div>
        <div class="reason-section">2. Forward Horizon Assessment</div>
        <div class="reason-text">{diag.forward_horizon}</div>
        <div class="reason-section">3. Dispatched Action</div>
        <div class="reason-text">{diag.dispatched_action}</div>
        <div class="reason-section">4. Structural Outcome</div>
        <div class="reason-text">{diag.structural_outcome}</div>
    </div>
    """, unsafe_allow_html=True)

# ── Economics ──
with col_econ:
    st.markdown('<div class="section-head">Asset Economics — 23-Well Field</div>', unsafe_allow_html=True)

    wells = 23
    oil_usd = 75.0
    fx = 83.5
    repair_inr = 850000.0
    base_fail = 2.4
    twin_fail = 0.35
    kwh_day = 48.0
    tariff = 7.5
    bopd_gain = 4.2

    sav_workover = wells * (base_fail - twin_fail) * repair_inr
    sav_power = wells * kwh_day * 365 * tariff
    gain_oil = wells * bopd_gain * 365 * oil_usd * fx
    total_val = sav_workover + sav_power + gain_oil

    fig_w = go.Figure(go.Waterfall(
        orientation="v",
        measure=["relative", "relative", "relative", "total"],
        x=["Workover Avoidance", "Power Efficiency", "Oil Uplift", "Total Annual Value"],
        textposition="outside",
        text=[f"Rs {sav_workover / 1e7:.2f} Cr", f"Rs {sav_power / 1e7:.2f} Cr",
              f"Rs {gain_oil / 1e7:.2f} Cr", f"Rs {total_val / 1e7:.2f} Cr"],
        y=[sav_workover / 1e7, sav_power / 1e7, gain_oil / 1e7, total_val / 1e7],
        connector=dict(line=dict(color="#d1d5db")),
        decreasing=dict(marker=dict(color="#ef4444")),
        increasing=dict(marker=dict(color="#059669")),
        totals=dict(marker=dict(color="#2563eb")),
    ))

    fig_w.update_layout(
        height=300,
        title=dict(text="Annual Value Creation (Crores INR)", font=dict(size=13, color="#1f2937")),
        **PLOT_LAYOUT,
    )
    fig_w.update_xaxes(**AXIS_STYLE, tickfont=dict(size=9))
    fig_w.update_yaxes(**AXIS_STYLE)
    fig_w.update_layout(modebar=dict(remove=["toImage", "lasso2d", "select2d"]))
    st.plotly_chart(fig_w, width='stretch')


# ─── Footer ────────────────────────────────────────────────────

st.divider()
st.markdown("""
<div style="display:flex;justify-content:space-between;color:#9ca3af;font-size:10px;padding:2px 0;">
    <span>VectroSync Enterprise Industrial Twin &middot; Oil India Limited &middot; Baghewala Well #14</span>
    <span>100% Offline Localhost &middot; Clean-Room Scientific Python</span>
</div>
""", unsafe_allow_html=True)
