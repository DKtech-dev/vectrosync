"""
Automated Test Suite for FastAPI Backend Endpoints (tests/test_api_endpoints.py)
Verifies REST API, scenario application, CSV ingestion, and SHA-256 audit ledger endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from backend.server import app

client = TestClient(app)


def test_api_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["well_id"] == "Baghewala-14"


def test_api_get_scenarios():
    res = client.get("/api/scenarios")
    assert res.status_code == 200
    data = res.json()
    assert "scenarios" in data
    assert len(data["scenarios"]) == 4


def test_api_apply_scenario_a_buckling():
    res = client.post("/api/scenarios/SCENARIO_A_BASELINE_FAILURE/apply")
    assert res.status_code == 200
    data = res.json()
    assert data["is_buckling_active"] is True
    assert data["actual_min_tension_kn"] < 0.0
    assert "Baghewala Freeze" in data["scenario_name"]


def test_api_apply_scenario_b_mpc():
    res = client.post("/api/scenarios/SCENARIO_B_COUPLED_TWIN/apply")
    assert res.status_code == 200
    data = res.json()
    assert data["is_buckling_active"] is False
    assert data["actual_min_tension_kn"] >= 0.5
    assert data["effective_spm"] <= 3.5
    # The effective speed must be a genuine controller output, never a
    # scenario-preset constant substituted for the model's answer.
    assert data["effective_spm"] != 2.8


def test_api_mpc_solver_mode_optimization_actually_runs_slsqp():
    """Regression guard for the bug where mpc_solver_mode only changed a
    label without invoking the real SLSQP optimizer."""
    payload = {
        "cooling_multiplier": 2.20,
        "elapsed_days": 490.94,
        "target_spm": 4.7,
        "water_cut": 0.25,
        "mpc_enabled": True,
        "modbus_severed": False,
        "mpc_solver_mode": "optimization",
    }
    res = client.post("/api/simulate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["model_status"]["controller"] == "nonlinear_constrained_slsqp_mpc"
    # The real SLSQP solve is two orders of magnitude slower than the
    # surrogate reachability governor; a fast response here means the label
    # was swapped without actually invoking the optimizer.
    assert data["solve_time_ms"] > 20.0


def test_api_apply_scenario_c_telemetry():
    res = client.post("/api/scenarios/SCENARIO_C_TELEMETRY_SEVERED/apply")
    assert res.status_code == 200
    data = res.json()
    assert "LEVEL_2_PROTECTIVE" in data["failsafe_level"]
    assert data["effective_spm"] == 2.0


def test_api_custom_simulate():
    payload = {
        "cooling_multiplier": 1.5,
        "elapsed_days": 10.0,
        "target_spm": 3.8,
        "water_cut": 0.4,
        "steam_quality": 0.8,
        "plunger_sand_wear": 0.05,
        "stroke_length_m": 2.54,
        "mpc_enabled": True,
        "modbus_severed": False,
    }
    res = client.post("/api/simulate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "dynacard" in data
    assert "stress_heatmap" in data
    assert "diagnostics" in data
    assert "economics" in data
    assert len(data["dynacard"]["surface_position_m"]) > 100


def test_api_csv_ingest():
    sample_csv = """Time,Load_klbs,Disp_in,SPM,BHT_F
2026-09-01 10:00:00,12.5,0.0,4.2,176.0
2026-09-01 10:00:01,18.4,15.2,4.2,176.0
2026-09-01 10:00:02,24.8,38.5,4.2,176.0
"""
    res = client.post("/api/csv/ingest", data={"csv_text": sample_csv})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["row_count"] == 3


def test_api_audit_verify():
    res = client.get("/api/audit/verify")
    assert res.status_code == 200
    data = res.json()
    assert data["is_chain_valid"] is True
    assert data["tamper_detected"] is False
    assert len(data["events"]) > 0


def test_api_transient_wave_solver():
    """Verify simulation with high-fidelity transient wave solver via /api/simulate,
    using conditions inside the grid-convergence-validated temperature band
    (<=120 C; see TRANSIENT_VALIDATED_MAX_TEMP_C in backend/server.py)."""
    payload = {
        "target_spm": 4.7,
        "elapsed_days": 490.94,
        "cooling_multiplier": 2.20,
        "water_cut": 0.25,
        "plunger_sand_wear": 0.0,
        "stroke_length_m": 2.54,
        "mpc_enabled": True,
        "modbus_severed": False,
        "solver_type": "transient",
    }
    res = client.post("/api/simulate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["solver_type"] == "transient"
    assert data["model_status"]["rod_model"] == "transient_elastodynamic_wave_pde"
    assert data["model_status"]["solver_fallback_reason"] is None
    assert len(data["dynacard"]["surface_position_m"]) == 144
    assert len(data["dynacard"]["surface_load_kn"]) == 144
    assert data["solve_time_ms"] > 0.0
    # PPRL must not exceed the rod-string rating in the validated regime.
    assert data["dynacard"]["pprl_kn"] <= 110.0


def test_api_transient_solver_auto_falls_back_outside_validated_band():
    """Above the validated temperature band the explicit transient solver is
    grid-non-convergent (PPRL non-monotone in dx, exceeds rating). The API
    must disclose an honest fallback to the surrogate rather than serve an
    invalid PPRL/tension pair labeled 'transient'."""
    payload = {
        "target_spm": 3.8,
        "elapsed_days": 10.0,
        "cooling_multiplier": 1.0,
        "water_cut": 0.25,
        "plunger_sand_wear": 0.0,
        "stroke_length_m": 2.54,
        "mpc_enabled": True,
        "modbus_severed": False,
        "solver_type": "transient",
    }
    res = client.post("/api/simulate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["temperature_c"] > 120.0
    assert data["solver_type"] == "surrogate"
    assert data["model_status"]["requested_solver_type"] == "transient"
    assert data["model_status"]["solver_fallback_reason"] is not None


def test_api_ab_experiment_endpoint():
    """The deterministic shared-seed A/B benchmark (README's headline 19-vs-0
    float-event result) must be reachable live, not only from pytest."""
    res = client.get("/api/experiment/ab")
    assert res.status_code == 200
    data = res.json()
    assert data["baseline_float_count"] == 19
    assert data["coupled_float_count"] == 0
    assert len(data["baseline"]) == 24
    assert len(data["coupled"]) == 24

    # A different seed must be honored (not cherry-picked/hardcoded).
    res2 = client.get("/api/experiment/ab", params={"seed": 7})
    assert res2.status_code == 200
    assert res2.json()["seed"] == 7


def test_api_estimator_and_sustainability_fields_present():
    """Regression guard for the EKF and CO2/energy fields the plan requires
    to be wired into the serving path, not just computed in isolation."""
    res = client.post("/api/simulate", json={})
    assert res.status_code == 200
    data = res.json()
    assert data["estimator"]["method"] == "extended_kalman_filter"
    assert "t_sandface_estimated_c" in data["estimator"]
    assert data["dynacard"]["power_kw"] >= 0.0
    assert "co2_avoided_tonnes_per_year" in data["economics"]
    assert "co2_avoided_tonnes_per_year" in data["economics"]["sensitivity"]["base"]


def test_api_ai_diagnostics_fields_present():
    """Verify Layer 2 & 3 AI diagnostics are served live by /api/simulate."""
    res = client.post("/api/simulate", json={"scenario": "SCENARIO_A"})
    assert res.status_code == 200
    data = res.json()
    assert "ai_diagnostics" in data
    ai = data["ai_diagnostics"]
    assert "classifier" in ai
    assert "wave_surrogate" in ai
    assert "anomaly_detector" in ai
    assert ai["classifier"]["predicted_class"] in (
        "NORMAL_OPERATION", "ROD_FLOAT_PRECURSOR", "FLUID_POUND", "GAS_INTERFERENCE", "PARTED_ROD"
    )
    assert ai["wave_surrogate"]["inference_time_ms"] < 10.0
    assert ai["anomaly_detector"]["status"] in ("NOMINAL", "ELEVATED", "CRITICAL")

