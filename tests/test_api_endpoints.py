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
