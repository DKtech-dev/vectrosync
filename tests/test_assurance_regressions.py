"""Regression tests for high-consequence assurance boundaries."""

from concurrent.futures import ThreadPoolExecutor

import numpy as np
import pytest
from fastapi.testclient import TestClient

from backend.server import app
from src.adapter import AdaptiveCSVParser, SCADATelemetryPacket
from src.audit import AuditLedger
from src.controller import FastMPCController, WellState
from src.economics import ECONOMIC_CASES, evaluate_case, sensitivity_analysis
from src.state_estimator import DownholeKalmanEstimator, PINNSurrogate
from src.thermal import ThermalDecayEngine


client = TestClient(app)


def test_controller_reports_infeasible_extreme_viscosity() -> None:
    result = FastMPCController().solve(
        WellState(spm_current=4.0, temperature_C=50.0, viscosity_Pas=100.0),
        [50.0] * 24,
    )
    assert result.solver_status == "INFEASIBLE_SAFE_FALLBACK"
    assert result.is_anti_float_satisfied is False
    assert result.details["violating_steps"]


def test_audit_append_is_thread_safe() -> None:
    ledger = AuditLedger("concurrency-test")

    def append_event(index: int) -> None:
        ledger.record_event("CONCURRENT_TEST", "[synthetic]", {"source_index": index})

    with ThreadPoolExecutor(max_workers=12) as pool:
        list(pool.map(append_event, range(500)))

    valid, error = ledger.verify_chain()
    assert valid, error
    assert len(ledger) == 501


def test_empty_audit_chain_is_not_valid() -> None:
    ledger = AuditLedger(auto_genesis=False)
    valid, error = ledger.verify_chain()
    assert valid is False
    assert "genesis" in error.lower()


def test_unconfirmed_telemetry_defaults_to_advisory_unsafe() -> None:
    packet = SCADATelemetryPacket(
        timestamp=0.0,
        surface_position_m=[0.0] * 10,
        surface_load_kn=[100.0] * 10,
        spm=3.5,
        stroke_length_m=2.54,
    )
    assert packet.confirmed is False
    assert packet.control_valid is False
    assert packet.provenance == "[unverified]"
    assert packet.is_control_safe() is False


def test_unknown_csv_schema_fails_closed() -> None:
    parsed = AdaptiveCSVParser.parse_content(
        "timestamp,Sensor_Reading_XYZ\n2026-01-01T00:00:00Z,1\n"
    )
    assert parsed.control_valid is False
    assert any("missing required" in warning.lower() for warning in parsed.warnings)


def test_load_n_header_is_not_scaled_as_kilonewtons() -> None:
    parsed = AdaptiveCSVParser.parse_content(
        "timestamp,position_m,load_n\n"
        "2026-01-01T00:00:00Z,0,1000\n"
        "2026-01-01T00:00:01Z,1,2000\n"
    )
    assert parsed.column_data["load"] == [1000.0, 2000.0]


def test_impossible_load_inhibits_control() -> None:
    parsed = AdaptiveCSVParser.parse_content(
        "timestamp,position_m,load_kn\n"
        "2026-01-01T00:00:00Z,0,-999999\n"
        "2026-01-01T00:00:01Z,1,100\n"
    )
    assert parsed.control_valid is False
    assert any("physical range" in warning.lower() for warning in parsed.warnings)


def test_thermal_spline_matches_independent_quadrature() -> None:
    engine = ThermalDecayEngine()
    samples = np.logspace(-8, 1, 12)
    fast = engine.radial_factor(samples, use_fast_spline=True)
    reference = engine.radial_factor(samples, use_fast_spline=False)
    assert np.allclose(fast, reference, rtol=3e-3, atol=2e-5)


def test_economic_case_is_traceable_and_sums() -> None:
    result = evaluate_case(ECONOMIC_CASES["base"])
    components = (
        result["workover_avoidance_cr_inr"]
        + result["power_efficiency_cr_inr"]
        + result["oil_uplift_cr_inr"]
        - result["annual_platform_cost_cr_inr"]
    )
    assert result["total_annual_value_cr_inr"] == pytest.approx(components, abs=0.002)
    sensitivity = sensitivity_analysis()
    assert sensitivity["low"]["total_annual_value_cr_inr"] < sensitivity["base"]["total_annual_value_cr_inr"]
    assert sensitivity["base"]["total_annual_value_cr_inr"] < sensitivity["high"]["total_annual_value_cr_inr"]


def test_estimators_reject_non_finite_inputs() -> None:
    with pytest.raises(ValueError, match="finite"):
        PINNSurrogate().predict(np.nan, 1150.0, 60.0, 30.0)
    estimator = DownholeKalmanEstimator()
    with pytest.raises(ValueError, match="finite"):
        estimator.update(60.0, np.nan, 120.0)
    with pytest.raises(ValueError, match="positive"):
        estimator.predict(-1.0)


def test_api_exposes_assurance_boundary_and_consistent_trip() -> None:
    response = client.post("/api/scenarios/SCENARIO_A_BASELINE_FAILURE/apply")
    assert response.status_code == 200
    data = response.json()
    assert data["control_authority"] == "advisory_only_not_for_direct_actuation"
    assert data["model_status"]["field_validated"] is False
    assert data["model_status"]["rod_model"] == "reduced_order_algebraic_card_estimator"
    assert data["failsafe_level"] == "LEVEL_3_EMERGENCY"
    assert data["advisory_command_spm"] == 0.0


def test_stroke_length_changes_generated_card() -> None:
    short = client.post("/api/simulate", json={"stroke_length_m": 1.5}).json()
    long = client.post("/api/simulate", json={"stroke_length_m": 3.2}).json()
    short_span = max(short["dynacard"]["surface_position_m"]) - min(short["dynacard"]["surface_position_m"])
    long_span = max(long["dynacard"]["surface_position_m"]) - min(long["dynacard"]["surface_position_m"])
    assert long_span > short_span * 1.8
