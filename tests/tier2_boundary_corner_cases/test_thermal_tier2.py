"""Tier 2 Boundary & Singularity Tests: Reservoir Thermal Decay Engine (R1)."""

import pytest
import numpy as np
from src.thermal import ThermalAssetParameters, ThermalDecayEngine


def test_radial_singularity_at_limits():
    engine = ThermalDecayEngine()
    
    # Below and at singularity limit threshold
    assert engine.radial_factor(0.0) == 1.0
    assert engine.radial_factor(1e-15) == 1.0
    assert engine.radial_factor(1e-10) == 1.0
    
    # Extreme asymptotic limit
    assert engine.radial_factor(100.0) == pytest.approx(0.0025, rel=1e-4)
    assert engine.radial_factor(1000.0) == pytest.approx(0.00025, rel=1e-4)


def test_vertical_singularity_and_underflow():
    engine = ThermalDecayEngine()
    
    # Singularity limits
    assert engine.vertical_factor(0.0) == 1.0
    assert engine.vertical_factor(1e-15) == 1.0
    assert engine.vertical_factor(1e-12 * (15.0 ** 2)) == 1.0
    
    # Huge w limit
    vz_late = engine.vertical_factor(1e8)
    assert 0.0 <= vz_late < 0.01


def test_1000_random_samples_thermodynamic_bounds():
    engine = ThermalDecayEngine()
    rng = np.random.default_rng(12345)
    
    random_tau = rng.uniform(0.0, 365.25 * 86400.0 * 10.0, size=1000)
    random_k = rng.uniform(0.1, 2.0, size=1000)
    
    t_cals = engine.temperature_calibrated(random_tau, k_hat=random_k)
    assert np.all(t_cals >= 321.15 - 1e-9)
    assert np.all(t_cals <= 533.15 + 1e-9)
