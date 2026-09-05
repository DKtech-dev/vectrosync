"""Tier 1 Feature Coverage Tests: Reservoir Thermal Decay Engine (R1)."""

import pytest
import numpy as np
from src.thermal import ThermalAssetParameters, ThermalDecayEngine


def test_thermal_default_parameters():
    engine = ThermalDecayEngine()
    params = engine.params
    assert params.TR == pytest.approx(321.15)
    assert params.Ts == pytest.approx(533.15)
    assert params.alpha == pytest.approx(1.0e-6)
    assert params.h == pytest.approx(15.0)
    assert params.rh == pytest.approx(12.0)
    assert params.delta == pytest.approx(0.05)


def test_thermal_decay_evaluation():
    engine = ThermalDecayEngine()
    
    # Check at 0, 1 day, 10 days, 30 days, 100 days
    taus = np.array([0.0, 86400.0, 864000.0, 30 * 86400.0, 100 * 86400.0])
    temps_k = engine.temperature_calibrated(taus, k_hat=1.0)
    temps_c = engine.temperature_celsius(taus, k_hat=1.0)
    
    assert temps_k[0] == pytest.approx(533.15, rel=1e-4)
    assert np.all(np.diff(temps_k) < 0.0), "Temperature must decay over time"
    assert np.all(temps_k >= engine.params.TR)
    assert np.all(temps_k <= engine.params.Ts)
    assert np.allclose(temps_c, temps_k - 273.15)


def test_dynamic_calibrated_scaling_k_hat():
    engine = ThermalDecayEngine()
    tau = 86400.0 * 5.0
    t_avg = engine.temperature_avg(tau)
    
    for k in [0.7, 0.85, 1.0]:
        t_cal = engine.temperature_calibrated(tau, k_hat=k)
        expected = engine.params.TR + k * (t_avg - engine.params.TR)
        assert t_cal == pytest.approx(expected, rel=1e-6)
