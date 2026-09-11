"""
High-Performance Industrial Backend Server (backend/server.py)
Asset: Well #14, Baghewala Heavy Oil Asset, Bikaner-Nagaur Basin, Rajasthan | Operator: Oil India Limited
Model: OIL-BAGHEWALA-EOR-V2

Serves REST API endpoints and real-time WebSocket telemetry connected
directly to the clean-room Python physics engines in src/.
"""

import sys
import os
import hmac
import logging
from pathlib import Path
import time
import asyncio
import numpy as np
from typing import Optional, List, Dict, Any

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect, UploadFile, File, Form, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field, field_validator

from src.thermal import ThermalDecayEngine
from src.rheology import HeavyOilRheology
from src.rod_conservative import ConservativeRodWaveSolver, DynacardResult
from src.rod_transient import TransientRodWaveSolver
from src.failsafe import FailsafeStateMachine, SupervisoryFailsafe, FailsafeLevel
from src.controller import FastMPCController, WellState, MPCConfig
from src.adapter import AdaptiveCSVParser
from src.audit import AuditLedger
from src.scenario_runner import ScenarioRunner, ScenarioType
from src.why_engine import WhyEngine
from src.depth_stress import compute_spatiotemporal_stress_matrix, compute_rod_section_stresses
from src.economics import sensitivity_analysis
from src.state_estimator import DownholeKalmanEstimator
from src.generator import DEFAULT_DATA_GENERATOR

# Initialize FastAPI App
app = FastAPI(
    title="VectroSync Enterprise Industrial Twin Engine API",
    description="Synthetic advisory research prototype for CSS-SRP what-if analysis; not an operational control system.",
    version="2.0.0",
)

logger = logging.getLogger(__name__)
API_KEY = os.getenv("VECTROSYNC_API_KEY")
MAX_CSV_BYTES = int(os.getenv("VECTROSYNC_MAX_CSV_BYTES", str(2 * 1024 * 1024)))
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "VECTROSYNC_CORS_ORIGINS",
        "http://localhost:5173,http://localhost:8000",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-API-Key"],
)


def require_api_key(x_api_key: Optional[str] = Header(default=None)) -> None:
    """Enable a deployment API key when VECTROSYNC_API_KEY is configured."""
    if API_KEY and (x_api_key is None or not hmac.compare_digest(x_api_key, API_KEY)):
        raise HTTPException(status_code=401, detail="Valid X-API-Key required")

# Shared Physics State Engines
thermal_engine = ThermalDecayEngine()
rheo_engine = HeavyOilRheology()
audit_ledger = AuditLedger(well_id="Baghewala-14")
websocket_slots = asyncio.Semaphore(int(os.getenv("VECTROSYNC_MAX_WEBSOCKETS", "5")))

# Persistent Extended Kalman Filter: a genuine recursive Bayesian estimator
# that carries its belief state (and covariance) across requests within this
# process, the same way it would across control cycles in the field.
kalman_estimator = DownholeKalmanEstimator()

# Last computed simulation state, consumed by the /ws/live-stream endpoint so
# the animated telemetry reflects the most recent /api/simulate result
# instead of a fixed, disconnected sinusoid.
LAST_SIM_STATE: Dict[str, float] = {
    "effective_spm": 3.5,
    "surface_mean_kn": 45.0,
    "surface_amp_kn": 18.0,
    "downhole_mean_kn": 12.0,
    "downhole_amp_kn": 8.0,
    "stroke_length_m": 2.54,
}

# The explicit, transient PDE, damped wave solver is validated against the
# surrogate (agreement within ~5% on PPRL, grid-convergent within ~1% under
# mesh refinement) up to this reservoir temperature. Above it, the two
# solvers diverge (measured up to 76% at 120 C) and the transient PPRL is no
# longer grid-convergent (see docs/VERIFICATION.md and
# tests/test_solver_agreement.py). Requests for the transient solver above
# this temperature are auto-served by the validated surrogate instead, with
# the fallback disclosed in `model_status`.
TRANSIENT_VALIDATED_MAX_TEMP_C = 85.0


# ─── Pydantic Request / Response Models ───────────────────────

class SimulationParams(BaseModel):
    cooling_multiplier: float = Field(default=1.0, ge=0.2, le=5.0)
    elapsed_days: float = Field(default=12.0, ge=0.0, le=720.0)
    target_spm: float = Field(default=4.7, ge=0.5, le=8.0)
    water_cut: float = Field(default=0.30, ge=0.0, le=1.0)
    steam_quality: float = Field(default=0.75, ge=0.1, le=1.0)
    plunger_sand_wear: float = Field(default=0.0, ge=0.0, le=1.0)
    stroke_length_m: float = Field(default=2.54, ge=1.0, le=4.0)
    mpc_enabled: bool = Field(default=True)
    modbus_severed: bool = Field(default=False)
    scenario_override: Optional[str] = Field(default=None)
    solver_type: str = Field(default="surrogate", pattern="^(surrogate|transient)$")
    mpc_solver_mode: str = Field(default="surrogate", pattern="^(surrogate|optimization)$")

    @field_validator("scenario_override")
    @classmethod
    def validate_scenario_override(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in {scenario.value for scenario in ScenarioType}:
            raise ValueError(f"Unknown scenario_override '{value}'")
        return value


class DiagnosticResponse(BaseModel):
    trigger_event: str
    forward_horizon: str
    dispatched_action: str
    structural_outcome: str
    provenance_tag: str
    timestamp_iso: str


class DynacardData(BaseModel):
    surface_position_m: List[float]
    surface_load_kn: List[float]
    downhole_load_kn: List[float]
    baseline_downhole_load_kn: List[float]
    pprl_kn: float
    mprl_kn: float
    min_tension_kn: float
    oil_production_bopd: float
    liquid_production_bopd: float
    power_kw: float = 0.0
    hydraulic_power_kw: float = 0.0
    baseline_power_kw: float = 0.0


class ForecastPoint(BaseModel):
    hour: float
    temperature_c: float
    viscosity_cp: float
    drag_beta: float
    spm_trajectory: float


class StressHeatmapData(BaseModel):
    angles_deg: List[float]
    depths_m: List[float]
    stress_matrix_mpa: List[List[float]]


class RodSectionData(BaseModel):
    section_index: int
    name: str
    diameter_in: float
    depth_range_m: List[float]
    area_m2: float
    min_stress_mpa: float
    max_stress_mpa: float
    mean_stress_mpa: float
    min_force_kn: float
    max_force_kn: float
    mean_force_kn: float
    color: str
    is_buckling: bool
    status: str


class StressTensorData(BaseModel):
    section_1: RodSectionData
    section_2: RodSectionData
    section_3: RodSectionData
    sections: List[RodSectionData]
    min_tension_kn: float
    is_buckling_active: bool


class SimulationResponse(BaseModel):
    status: str
    solver_type: str = "surrogate"
    control_authority: str
    advisory_command_spm: float
    model_status: Dict[str, Any]
    scenario_id: str
    scenario_name: str
    failsafe_level: str
    failsafe_reason: str
    supervisory_state: str
    solve_time_ms: float
    effective_spm: float
    target_spm: float
    temperature_c: float
    viscosity_cp: float
    drag_beta: float
    is_buckling_active: bool
    is_modbus_severed: bool
    actual_min_tension_kn: float
    dynacard: DynacardData
    forecast_12h: List[ForecastPoint]
    stress_heatmap: StressHeatmapData
    stress_tensor: StressTensorData
    diagnostics: DiagnosticResponse
    economics: Dict[str, Any]
    estimator: Dict[str, Any]


# ─── Helper Functions ──────────────────────────────────────────

def run_physics_pass(params: SimulationParams) -> Dict[str, Any]:
    """Execute one deterministic, synthetic advisory-model pass."""

    # 1. Resolve Scenario Presets if requested
    scenario_type = ScenarioType.DEFAULT_OPERATION
    if params.scenario_override:
        for sc in ScenarioType:
            if sc.value == params.scenario_override:
                scenario_type = sc
                break

    preset = ScenarioRunner.get_preset(scenario_type)

    # 2. Compute Reservoir Thermal State (strictly physical, no synthetic overrides)
    t_res_c, _ = thermal_engine.predict_temperature(
        params.elapsed_days,
        time_unit="days",
        cooling_multiplier=params.cooling_multiplier,
    )
    t_res_c = float(t_res_c)
    t_res_k = t_res_c + 273.15

    # 3. Compute Crude Rheology & Couette Drag
    mu_mix_pas = float(rheo_engine.mixture_viscosity(t_res_k, fw=params.water_cut))
    mu_mix_cp = mu_mix_pas * 1000.0
    beta_drag = float(rheo_engine.couette_drag_beta(mu_mix_pas, r_rod=0.0127))

    # 4. Solver selection with an explicit, disclosed stability gate. Serving
    # an invalid (non-grid-convergent) PPRL/tension pair is worse than
    # honestly falling back to the validated surrogate; see module docstring
    # constant TRANSIENT_VALIDATED_MAX_TEMP_C and docs/VERIFICATION.md.
    requested_solver_type = params.solver_type
    is_transient = (params.solver_type == "transient")
    solver_fallback_reason: Optional[str] = None
    if is_transient and t_res_c > TRANSIENT_VALIDATED_MAX_TEMP_C:
        is_transient = False
        solver_fallback_reason = (
            f"Transient PDE requested but reservoir temperature {t_res_c:.1f} C exceeds the "
            f"grid-convergence-validated band (<= {TRANSIENT_VALIDATED_MAX_TEMP_C:.0f} C); "
            "auto-fell back to the surrogate solver rather than report a non-convergent PPRL."
        )

    if is_transient:
        local_wave_solver = TransientRodWaveSolver(
            dx=15.0,
            surface_stroke_m=params.stroke_length_m,
        )
    else:
        local_wave_solver = ConservativeRodWaveSolver(
            dx=10.0,
            surface_stroke_m=params.stroke_length_m,
        )
    local_failsafe = SupervisoryFailsafe(
        rod_rating_kN=110.0,
        min_safe_tension_trip_kn=0.50,
    )

    # 5. Thermal decay forecast horizon: reuses the same Boberg-Lantz engine
    # that produced the current temperature, not a linear placeholder ramp.
    forecast_days = [params.elapsed_days + (h / 24.0) for h in np.linspace(0.0, 12.0, 24)]
    forecast_temps_arr, _ = thermal_engine.predict_decay_trajectory(
        forecast_days, cooling_multiplier=params.cooling_multiplier,
    )
    forecast_temps = [float(v) for v in forecast_temps_arr]

    # 6. Closed-loop MPC settling: a controller that has genuinely been
    # governing the well for hours (as every non-baseline scenario here
    # implies) has already ramped away from the requested setpoint, subject
    # only to the actuator slew-rate limit. A single one-shot solve from an
    # assumed target_spm baseline understates that. Iterate the same
    # rate-limited reachability governor to its steady operating point, then
    # run the REQUESTED solver mode once at that point so the reported
    # timing and label are honest for whichever mode was asked for.
    settled_spm = float(params.target_spm)
    if params.mpc_enabled and scenario_type != ScenarioType.SCENARIO_A_BASELINE_FAILURE:
        settle_controller = FastMPCController(MPCConfig(solver_mode="surrogate"))
        for _ in range(40):
            settle_state = WellState(spm_current=settled_spm, temperature_C=t_res_c, viscosity_Pas=mu_mix_pas)
            settle_plan = settle_controller.solve(settle_state, forecast_temps)
            next_spm = float(settle_plan.optimal_spm)
            converged = abs(next_spm - settled_spm) < 1e-3
            settled_spm = next_spm
            if converged:
                break

    well_state = WellState(spm_current=settled_spm, temperature_C=t_res_c, viscosity_Pas=mu_mix_pas)
    local_mpc_controller = FastMPCController(MPCConfig(solver_mode=params.mpc_solver_mode))
    mpc_plan = local_mpc_controller.solve(well_state, forecast_temps)
    advisory_spm = float(mpc_plan.optimal_spm)
    solve_time_ms = float(getattr(mpc_plan, "solve_time_ms", 0.0))

    # 7. Evaluate the proposed advisory against the same card model displayed
    # by the API. This avoids certifying one model and displaying another.
    # No scenario-specific overrides: whatever the controller computes is
    # what is reported.
    if scenario_type == ScenarioType.SCENARIO_A_BASELINE_FAILURE or not params.mpc_enabled:
        proposed_spm = params.target_spm
    else:
        proposed_spm = advisory_spm

    preview_card = local_wave_solver.simulate_card(
        spm=proposed_spm,
        temp_c=t_res_c,
        water_cut=params.water_cut,
        sand_wear=params.plunger_sand_wear,
        n_strokes=3,
    )
    curr_time = time.time()
    telemetry_age = 75.0 if params.modbus_severed else 1.2
    fs_state, fs_reason, safe_spm = local_failsafe.evaluate_state(
        current_time=curr_time,
        last_telemetry_time=curr_time - telemetry_age,
        pprl_kn=float(preview_card.pprl_kn),
        min_tension_kn=float(preview_card.min_downhole_tension_kn),
        simulated_disconnect=params.modbus_severed,
    )

    # Scenario A intentionally displays the pre-trip failure snapshot. All
    # other cases display the command selected by the supervisory layer.
    if scenario_type == ScenarioType.SCENARIO_A_BASELINE_FAILURE:
        effective_spm = proposed_spm
    elif fs_state == FailsafeLevel.LEVEL_3_EMERGENCY:
        effective_spm = 0.5  # Solver visualization floor; command is 0 SPM.
    elif fs_state != FailsafeLevel.LEVEL_0_NORMAL:
        effective_spm = safe_spm
    else:
        effective_spm = proposed_spm
    advisory_command_spm = (
        0.0 if fs_state == FailsafeLevel.LEVEL_3_EMERGENCY
        else safe_spm if fs_state != FailsafeLevel.LEVEL_0_NORMAL
        else proposed_spm
    )

    # 6. Generate surface and downhole card estimates (transient wave solver vs surrogate)
    t_wave_start = time.perf_counter()
    if is_transient:
        twin_card = local_wave_solver.simulate_transient(
            spm=effective_spm,
            temp_c=t_res_c,
            water_cut=params.water_cut,
            sand_wear=params.plunger_sand_wear,
            n_strokes=2,
        )
        wave_solve_time_ms = float(round((time.perf_counter() - t_wave_start) * 1000.0, 2))
        solve_time_ms = wave_solve_time_ms
        baseline_card = local_wave_solver.simulate_transient(
            spm=params.target_spm,
            temp_c=48.0,
            water_cut=params.water_cut,
            sand_wear=params.plunger_sand_wear,
            n_strokes=2,
        )
    else:
        twin_card = local_wave_solver.simulate_card(
            spm=effective_spm,
            temp_c=t_res_c,
            water_cut=params.water_cut,
            sand_wear=params.plunger_sand_wear,
            n_strokes=3,
        )
        baseline_card = local_wave_solver.simulate_card(
            spm=params.target_spm,
            temp_c=48.0,
            water_cut=params.water_cut,
            sand_wear=params.plunger_sand_wear,
            n_strokes=3,
        )

    actual_min_tension = float(twin_card.min_downhole_tension_kn)
    is_buckling_active = bool(twin_card.is_floating or actual_min_tension < 0.0)

    # 7b. Extended Kalman Filter: recursive Bayesian estimate of downhole
    # state fed by the same physics that produced the ground truth above,
    # persisted across requests within this process. water_cut is not
    # observable from the current measurement set (see docs/VERIFICATION.md).
    kalman_estimator.predict(dt_sec=300.0)
    motor_power_estimate_kw = float(getattr(twin_card, "power_kw", 15.0 + 3.0 * mu_mix_pas))
    kalman_state = kalman_estimator.update(
        T_flowline_C=t_res_c * 0.75,
        motor_power_kW=motor_power_estimate_kw,
        pprl_kN=float(twin_card.pprl_kn),
    )
    estimator_block = {
        "method": "extended_kalman_filter",
        "t_sandface_true_c": round(t_res_c, 2),
        "t_sandface_estimated_c": round(float(kalman_state.T_sandface_C), 2),
        "viscosity_estimated_pas": round(float(kalman_state.viscosity_Pas), 4),
        "covariance_trace": round(float(np.trace(kalman_state.covariance)), 4),
        "water_cut_observable": False,
        "note": (
            "Recursive Bayesian estimate carried across requests within this process, matching "
            "how it would persist across control cycles in the field. water_cut is structurally "
            "unobservable from the current measurement set."
        ),
    }

    # Reflect this pass into the live-stream state so /ws/live-stream tracks
    # the most recently computed simulation instead of a fixed sinusoid.
    surface_arr = np.asarray(twin_card.surface_load_kn, dtype=float)
    downhole_arr = np.asarray(twin_card.downhole_load_kn, dtype=float)
    LAST_SIM_STATE.update({
        "effective_spm": float(effective_spm),
        "surface_mean_kn": float((surface_arr.max() + surface_arr.min()) / 2.0),
        "surface_amp_kn": float((surface_arr.max() - surface_arr.min()) / 2.0),
        "downhole_mean_kn": float((downhole_arr.max() + downhole_arr.min()) / 2.0),
        "downhole_amp_kn": float((downhole_arr.max() - downhole_arr.min()) / 2.0),
        "stroke_length_m": float(params.stroke_length_m),
    })

    # 8. Compute 2D Spatiotemporal Stress Matrix sigma(x, theta) & Section Stress Tensor
    angles_deg, depths_m, stress_matrix = compute_spatiotemporal_stress_matrix(
        depths_m=local_wave_solver.node_depths,
        node_areas_m2=local_wave_solver.node_area,
        dynacard_result=twin_card,
        spm=effective_spm,
        is_buckling=is_buckling_active,
    )

    stress_tensor_data = compute_rod_section_stresses(
        depths_m=local_wave_solver.node_depths,
        node_areas_m2=local_wave_solver.node_area,
        dynacard_result=twin_card,
        stress_matrix_mpa=stress_matrix,
    )

    # Map supervisory state badge
    badge_map = {
        FailsafeLevel.LEVEL_0_NORMAL: "LEVEL_0_NORMAL",
        FailsafeLevel.LEVEL_1_DEGRADED: "LEVEL_1_DEGRADED",
        FailsafeLevel.LEVEL_2_PROTECTIVE: "LEVEL_2_PROTECTIVE",
        FailsafeLevel.LEVEL_3_EMERGENCY: "LEVEL_3_ESTOP",
    }
    supervisory_badge = badge_map.get(fs_state, str(fs_state.value if hasattr(fs_state, "value") else fs_state))

    # 9. Causal Why-Engine Diagnostic Trace
    diag = WhyEngine.generate_explanation(
        elapsed_days=params.elapsed_days,
        temp_c=t_res_c,
        viscosity_cp=mu_mix_cp,
        drag_beta=beta_drag,
        min_tension_kn=actual_min_tension,
        nominal_spm=params.target_spm,
        effective_spm=effective_spm,
        failsafe_level=fs_state.value if hasattr(fs_state, "value") else str(fs_state),
        is_modbus_severed=params.modbus_severed,
    )

    # 10. 12-Hour Forecast Data
    hours = np.linspace(0, 12, 24)
    visc_horizon = [float(rheo_engine.mixture_viscosity(t + 273.15, fw=params.water_cut)) for t in forecast_temps]
    drag_horizon = [float(rheo_engine.couette_drag_beta(v, r_rod=0.0127)) for v in visc_horizon]
    spm_horizon = mpc_plan.spm_trajectory if not is_buckling_active else [params.target_spm] * 24

    forecast_list = [
        ForecastPoint(
            hour=float(hours[i]),
            temperature_c=float(forecast_temps[i]),
            viscosity_cp=float(visc_horizon[i] * 1000.0),
            drag_beta=float(drag_horizon[i]),
            spm_trajectory=float(spm_horizon[i]),
        )
        for i in range(len(hours))
    ]

    # 11. Commercial hypothesis with low/base/high sensitivity.
    economics_sensitivity = sensitivity_analysis()
    base_economics = economics_sensitivity["base"]
    if not isinstance(base_economics, dict):
        raise RuntimeError("Economics base case has invalid structure")
    economics = dict(base_economics)
    economics["sensitivity"] = economics_sensitivity

    # Record event in SHA-256 Ledger
    audit_ledger.record_event(
        event_type="SIMULATION_PASS",
        provenance_tag="[model]",
        payload={
            "scenario": scenario_type.value,
            "spm": effective_spm,
            "t_res_c": round(t_res_c, 2),
            "min_tension_kn": round(actual_min_tension, 2),
        },
    )

    return {
        "status": "success",
        "solver_type": "transient" if is_transient else "surrogate",
        "control_authority": "advisory_only_not_for_direct_actuation",
        "advisory_command_spm": round(float(advisory_command_spm), 2),
        "model_status": {
            "data_provenance": "synthetic",
            "rod_model": "transient_elastodynamic_wave_pde" if is_transient else "reduced_order_algebraic_card_estimator",
            "controller": "nonlinear_constrained_slsqp_mpc" if params.mpc_solver_mode == "optimization" else "constraint_aware_reduced_order_governor",
            "controller_status": mpc_plan.solver_status,
            "field_validated": False,
            "hil_validated": False,
            "uncoupled_inputs": ["steam_quality"],
            "requested_solver_type": requested_solver_type,
            "solver_fallback_reason": solver_fallback_reason,
        },
        "scenario_id": scenario_type.value,
        "scenario_name": preset.name,
        "failsafe_level": fs_state.value if hasattr(fs_state, "value") else str(fs_state),
        "failsafe_reason": fs_reason,
        "supervisory_state": supervisory_badge,
        "solve_time_ms": round(solve_time_ms, 3),
        "effective_spm": round(effective_spm, 2),
        "target_spm": round(params.target_spm, 2),
        "temperature_c": round(t_res_c, 2),
        "viscosity_cp": round(mu_mix_cp, 1),
        "drag_beta": round(beta_drag, 3),
        "is_buckling_active": is_buckling_active,
        "is_modbus_severed": params.modbus_severed,
        "actual_min_tension_kn": round(actual_min_tension, 2),
        "dynacard": DynacardData(
            surface_position_m=[round(x, 4) for x in twin_card.surface_position_m],
            surface_load_kn=[round(y, 2) for y in twin_card.surface_load_kn],
            downhole_load_kn=[round(y, 2) for y in twin_card.downhole_load_kn],
            baseline_downhole_load_kn=[round(y, 2) for y in baseline_card.downhole_load_kn],
            pprl_kn=round(float(twin_card.pprl_kn), 2),
            mprl_kn=round(float(twin_card.mprl_kn), 2),
            min_tension_kn=round(actual_min_tension, 2),
            oil_production_bopd=round(float(twin_card.oil_production_bopd), 1),
            liquid_production_bopd=round(float(twin_card.liquid_production_bopd), 1),
            power_kw=round(float(getattr(twin_card, "power_kw", 0.0)), 3),
            hydraulic_power_kw=round(float(getattr(twin_card, "hydraulic_power_kw", 0.0)), 3),
            baseline_power_kw=round(float(getattr(baseline_card, "power_kw", 0.0)), 3),
        ),
        "forecast_12h": forecast_list,
        "stress_heatmap": StressHeatmapData(
            angles_deg=[round(a, 1) for a in angles_deg.tolist()],
            depths_m=[round(d, 1) for d in depths_m.tolist()],
            stress_matrix_mpa=[[round(v, 2) for v in row] for row in stress_matrix.tolist()],
        ),
        "stress_tensor": StressTensorData(
            section_1=RodSectionData(**stress_tensor_data["section_1"]),
            section_2=RodSectionData(**stress_tensor_data["section_2"]),
            section_3=RodSectionData(**stress_tensor_data["section_3"]),
            sections=[RodSectionData(**s) for s in stress_tensor_data["sections"]],
            min_tension_kn=stress_tensor_data["min_tension_kn"],
            is_buckling_active=stress_tensor_data["is_buckling_active"],
        ),
        "diagnostics": DiagnosticResponse(
            trigger_event=diag.trigger_event,
            forward_horizon=diag.forward_horizon,
            dispatched_action=diag.dispatched_action,
            structural_outcome=diag.structural_outcome,
            provenance_tag=diag.provenance_tag,
            timestamp_iso=diag.timestamp_iso,
        ),
        "economics": economics,
        "estimator": estimator_block,
    }


# ─── REST Endpoints ────────────────────────────────────────────

api_router = APIRouter()


@api_router.get("/health")
async def health_check():
    """Health check endpoint confirming engine readiness."""
    return {
        "status": "healthy",
        "service": "VectroSync CSS-SRP Advisory Research API",
        "well_id": "Baghewala-14",
        "deployment_class": "synthetic_research_prototype",
        "control_authority": "none",
        "timestamp": time.time(),
    }


@api_router.get("/scenarios")
async def get_scenarios():
    """Returns available preset operational scenarios."""
    scenarios = []
    for sc in ScenarioType:
        cfg = ScenarioRunner.get_preset(sc)
        scenarios.append({
            "id": sc.value,
            "name": cfg.name,
            "description": cfg.description,
            "target_spm": cfg.target_spm,
            "cooling_multiplier": cfg.cooling_multiplier,
            "elapsed_days": cfg.elapsed_days,
            "water_cut": cfg.water_cut,
            "modbus_severed": cfg.modbus_severed,
            "expected_spm": cfg.expected_spm,
            "expected_min_tension_kn": cfg.expected_min_tension_kn,
            "color_theme": cfg.color_theme,
        })
    return {"scenarios": scenarios}


@api_router.post(
    "/scenarios/{scenario_id}/apply",
    response_model=SimulationResponse,
    dependencies=[Depends(require_api_key)],
)
def apply_scenario(scenario_id: str):
    """Applies a preset scenario and returns the recalculated physics state."""
    matched = None
    for sc in ScenarioType:
        if sc.value == scenario_id:
            matched = sc
            break
    if not matched:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found")

    cfg = ScenarioRunner.get_preset(matched)

    params = SimulationParams(
        cooling_multiplier=cfg.cooling_multiplier,
        elapsed_days=cfg.elapsed_days,
        target_spm=cfg.target_spm,
        water_cut=cfg.water_cut,
        steam_quality=cfg.steam_quality,
        plunger_sand_wear=cfg.plunger_sand_wear,
        mpc_enabled=cfg.mpc_enabled,
        modbus_severed=cfg.modbus_severed,
        scenario_override=matched.value,
    )
    result = run_physics_pass(params)
    return result


@api_router.post(
    "/simulate",
    response_model=SimulationResponse,
    dependencies=[Depends(require_api_key)],
)
def simulate(params: SimulationParams):
    """Runs a customized multi-physics simulation pass."""
    result = run_physics_pass(params)
    return result


@api_router.post("/csv/ingest", dependencies=[Depends(require_api_key)])
async def ingest_csv(file: Optional[UploadFile] = File(None), csv_text: Optional[str] = Form(None)):
    """Parses, normalizes, and validates SCADA telemetry CSV files."""
    try:
        content = ""
        if file is not None:
            raw_bytes = await file.read(MAX_CSV_BYTES + 1)
            if len(raw_bytes) > MAX_CSV_BYTES:
                raise HTTPException(status_code=413, detail="CSV upload exceeds configured size limit")
            content = raw_bytes.decode("utf-8")
        elif csv_text:
            if len(csv_text.encode("utf-8")) > MAX_CSV_BYTES:
                raise HTTPException(status_code=413, detail="CSV text exceeds configured size limit")
            content = csv_text
        else:
            raise HTTPException(status_code=400, detail="No CSV file or text content provided")

        parsed = AdaptiveCSVParser.parse_content(content)
        # The tier records the data's claimed origin class (operator-furnished
        # surface telemetry); the payload flags record that no cryptographic
        # source authentication was performed. Tag != trust: the chain proves
        # the event was recorded, not that the source is authentic.
        audit_ledger.record_event(
            event_type="CSV_INGESTED",
            provenance_tag="[measured]",
            payload={
                "row_count": parsed.row_count,
                "advisory_quality_gate_passed": parsed.control_valid,
                "source_authenticity_established": False,
            },
        )
        # The parser preserves NaN values for forensic fidelity when a channel
        # fails a quality gate (e.g. a dropout longer than the imputation bound).
        # Those values are not JSON-compliant, so they are serialized as null;
        # control validity is already inhibited by the gate that produced them.
        def _json_safe(values):
            return [float(v) if np.isfinite(v) else None for v in values]

        return {
            "status": "success",
            "row_count": parsed.row_count,
            "control_valid": parsed.control_valid,
            "warnings": parsed.warnings,
            "mapping_report": {
                header: {
                    "target_channel": mapping.target_channel,
                    "detected_unit": mapping.detected_unit,
                    "confidence": mapping.confidence,
                    "confirmed": mapping.confirmed,
                }
                for header, mapping in parsed.mapping_report.items()
            },
            "column_data": {
                channel: _json_safe(values)
                for channel, values in parsed.column_data.items()
            },
        }
    except HTTPException:
        raise
    except (UnicodeDecodeError, ValueError) as ex:
        raise HTTPException(status_code=422, detail=f"CSV Ingestion Error: {str(ex)}") from ex


@api_router.get("/experiment/ab")
async def ab_benchmark(n_steps: int = 24, seed: int = 42):
    """Deterministic shared-seed A/B benchmark: an uncoupled fixed-speed
    baseline vs. the coupled MPC-governed twin, under identical latent
    cooling disturbance and measurement noise. This is the source of the
    verified 19-float-events-vs-0 headline result."""
    if not (4 <= n_steps <= 96):
        raise HTTPException(status_code=422, detail="n_steps must be between 4 and 96")
    return DEFAULT_DATA_GENERATOR.generate_ab_benchmark_experiment(n_steps=n_steps, seed=seed)


@api_router.get("/audit/verify", dependencies=[Depends(require_api_key)])
async def verify_audit_ledger():
    """Cryptographically verifies SHA-256 hash chain and returns event blocks."""
    is_valid, err_msg = audit_ledger.verify_chain()
    events = audit_ledger.get_recent_events_table(limit=25)
    return {
        "is_chain_valid": is_valid,
        "tamper_detected": not is_valid,
        "error_message": err_msg,
        "block_count": len(audit_ledger.chain),
        "events": events,
    }


# A single canonical API namespace keeps the public attack surface explicit.
app.include_router(api_router, prefix="/api")



# ─── High-Frequency WebSocket Telemetry Stream ─────────────────

@app.websocket("/ws/live-stream")
async def websocket_telemetry(websocket: WebSocket):
    """Stream explicitly synthetic 25 Hz demo telemetry with bounded fan-out."""
    supplied_key = websocket.query_params.get("api_key")
    if API_KEY and (supplied_key is None or not hmac.compare_digest(supplied_key, API_KEY)):
        await websocket.close(code=1008, reason="Authentication required")
        return
    if websocket_slots.locked():
        await websocket.close(code=1013, reason="Telemetry stream capacity reached")
        return

    async with websocket_slots:
        await websocket.accept()
        phase_deg = 0.0
        sequence = 0
        try:
            while True:
                # Driven by the most recently computed /api/simulate result so
                # the animation reacts to the operator's last decision instead
                # of a fixed, disconnected sinusoid.
                state = LAST_SIM_STATE
                spm = max(0.1, float(state.get("effective_spm", 3.5)))
                deg_per_frame = (spm * 360.0 / 60.0) / 25.0
                phase_deg = (phase_deg + deg_per_frame) % 360.0
                phase_rad = np.radians(phase_deg)
                stroke_length_m = float(state.get("stroke_length_m", 2.54))
                displacement_m = (stroke_length_m / 2.0) * (1.0 - np.cos(phase_rad))
                surface_load_kn = float(state.get("surface_mean_kn", 45.0)) + float(state.get("surface_amp_kn", 18.0)) * np.sin(phase_rad)
                downhole_load_kn = float(state.get("downhole_mean_kn", 12.0)) + float(state.get("downhole_amp_kn", 8.0)) * np.sin(phase_rad - 0.4)
                sequence += 1

                await websocket.send_json({
                    "timestamp": time.time(),
                    "sequence": sequence,
                    "provenance": "[synthetic]",
                    "control_valid": False,
                    "phase_deg": round(phase_deg, 2),
                    "displacement_m": round(float(displacement_m), 4),
                    "surface_load_kn": round(float(surface_load_kn), 2),
                    "downhole_load_kn": round(float(downhole_load_kn), 2),
                    "traveling_valve_open": bool(180.0 <= phase_deg < 360.0),
                    "standing_valve_open": bool(0.0 <= phase_deg < 180.0),
                })
                await asyncio.sleep(0.04)
        except WebSocketDisconnect:
            return
        except Exception:
            logger.exception("Synthetic telemetry WebSocket failed")


# ─── Serve Built Frontend Static Files ─────────────────────────

FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = FRONTEND_DIST / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(FRONTEND_DIST / "index.html")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.server:app", host="0.0.0.0", port=8000, reload=True)
