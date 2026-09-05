"""Tier 1 Feature Coverage Tests: Non-Newtonian Rheology & Couette Drag Engine (R2)."""

import pytest
import numpy as np
from src.rheology import HeavyOilRheology, RheologyParameters, get_default_baghewala_taper_sections


def test_arrhenius_exact_two_point_calibration():
    """AC-2: Verify exact calibration at 50 C (12 Pa.s) and 200 C (0.045 Pa.s)."""
    engine = HeavyOilRheology()
    
    # Point 1: 50 C = 323.15 K
    assert engine.oil_viscosity(323.15) == pytest.approx(12.0, abs=1e-6)
    assert engine.oil_viscosity_celsius(50.0) == pytest.approx(12.0, abs=1e-6)
    
    # Point 2: 200 C = 473.15 K
    assert engine.oil_viscosity(473.15) == pytest.approx(0.045, abs=1e-6)
    assert engine.oil_viscosity_celsius(200.0) == pytest.approx(0.045, abs=1e-6)


def test_couette_shear_drag_and_damping_bounds():
    """AC-2: Check Couette drag beta(x,t) dimensions and damping nu in [0.01, 3.00] s^-1."""
    engine = HeavyOilRheology()
    
    # 3 taper sections
    sections = get_default_baghewala_taper_sections()
    assert len(sections) == 3
    
    # Cold test (Surge)
    mu_cold = engine.mixture_viscosity(321.15, fw=0.0)  # 48 C
    for sec in sections:
        beta = engine.couette_drag_beta(mu_cold, sec.radius_m)
        nu = engine.damping_nu(beta, sec.area_m2)
        assert beta > 50.0  # High shear drag
        assert nu == pytest.approx(3.00, abs=1e-6)  # Clamped to upper limit
        
    # Hot test (Steam condition)
    mu_hot = engine.mixture_viscosity(533.15, fw=0.9)  # 260 C + 90% water
    for sec in sections:
        beta = engine.couette_drag_beta(mu_hot, sec.radius_m)
        nu = engine.damping_nu(beta, sec.area_m2)
        assert nu >= 0.01
        assert nu <= 3.00


def test_multiphase_water_cut_linear_mixing():
    """Verify Brinkman-Vand emulsion model: peak at fw=0.60 and boundary limits at fw=0.0 and 1.0."""
    engine = HeavyOilRheology()
    t_k = 373.15
    mu_oil = engine.oil_viscosity(t_k)
    
    # Boundary limits
    assert engine.mixture_viscosity(t_k, fw=0.0) == pytest.approx(mu_oil, rel=1e-6)
    assert engine.mixture_viscosity(t_k, fw=1.0) == pytest.approx(engine.params.mu_water_Pas, rel=1e-6)
    
    # Emulsion peak at fw=0.60
    mu_peak = engine.mixture_viscosity(t_k, fw=0.60)
    expected_peak = mu_oil * (1.0 + 2.5 * 0.60 + 10.05 * (0.60 ** 2))
    assert mu_peak == pytest.approx(expected_peak, rel=1e-6)
    assert mu_peak > mu_oil
