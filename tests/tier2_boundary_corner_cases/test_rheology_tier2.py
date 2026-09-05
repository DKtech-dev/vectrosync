"""Tier 2 Boundary & Corner Case Tests: Non-Newtonian Rheology & Couette Drag Engine (R2)."""

import pytest
import numpy as np
from src.rheology import HeavyOilRheology, RheologyParameters


def test_extreme_temperature_boundaries():
    engine = HeavyOilRheology()
    
    # Near boiling water / steam
    mu_near_boiling = engine.oil_viscosity(373.15)
    assert 0.045 < mu_near_boiling < 12.0
    
    # Very high temperature asymptotic limit
    mu_1000k = engine.oil_viscosity(1000.0)
    assert mu_1000k > 0.0
    assert mu_1000k < 0.045


def test_taper_interface_boundary_continuity():
    engine = HeavyOilRheology()
    
    # Check just before and at interface 1 (350 m)
    r_left_350 = engine.rod_radius_at_depth(349.999)
    r_at_350 = engine.rod_radius_at_depth(350.0)
    assert r_left_350 == pytest.approx(0.0127)
    assert r_at_350 == pytest.approx(0.0111125)
    
    # Check just before and at interface 2 (750 m)
    r_left_750 = engine.rod_radius_at_depth(749.999)
    r_at_750 = engine.rod_radius_at_depth(750.0)
    assert r_left_750 == pytest.approx(0.0111125)
    assert r_at_750 == pytest.approx(0.009525)


def test_randomized_temperature_and_water_cut_ranges():
    engine = HeavyOilRheology()
    np.random.seed(123)
    temps = np.random.uniform(320.0, 550.0, 500)
    fws = np.random.uniform(0.0, 1.0, 500)
    
    mu_mix = engine.mixture_viscosity(temps, fw=fws)
    assert np.all(mu_mix >= engine.params.mu_water_Pas)
    # With Brinkman-Vand crowding peak multiplier (6.118x), upper bound is 6.12 * mu_oil(320.0)
    assert np.all(mu_mix <= 6.12 * engine.oil_viscosity(320.0))
