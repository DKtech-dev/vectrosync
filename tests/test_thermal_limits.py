"""
Tests for Module 1: Reservoir Thermal Decay Engine (tests/test_thermal_limits.py)
Asserts Bessel quadrature singularity limits at t -> t_i,
monotonicity, and strict temperature containment [T_R <= T_cal <= T_s] over 1,000 random steps.
"""

import numpy as np
import pytest
from src.thermal import BobergLantzThermalModel


def test_bessel_singularity_limit():
    """Asserts lim_{b^2 -> 0^+} v_r = 1.0 (Exact analytical limit)."""
    model = BobergLantzThermalModel()

    # Zero time / exact singularity
    vr_zero = model.compute_vr(0.0)
    assert np.isclose(vr_zero, 1.0, atol=1e-12), f"Expected 1.0 at b^2=0, got {vr_zero}"

    # Extremely small b^2 below threshold
    vr_tiny = model.compute_vr(1e-14)
    assert np.isclose(vr_tiny, 1.0, atol=1e-12), f"Expected 1.0 at b^2=1e-14, got {vr_tiny}"

    # Smooth convergence as b^2 approaches 0 from above
    b2_vals = np.logspace(-9, -4, 10)
    vr_vals = [model.compute_vr(b) for b in b2_vals]
    for vr in vr_vals:
        assert 0.95 <= vr <= 1.0, f"Expected vr near 1.0, got {vr}"


def test_vertical_conduction_singularity_limit():
    """Asserts lim_{w -> 0^+} v_z = 1.0."""
    model = BobergLantzThermalModel()

    vz_zero = model.compute_vz(0.0)
    assert np.isclose(vz_zero, 1.0, atol=1e-12), f"Expected 1.0 at w=0, got {vz_zero}"

    vz_tiny = model.compute_vz(1e-14)
    assert np.isclose(vz_tiny, 1.0, atol=1e-12), f"Expected 1.0 at w=1e-14, got {vz_tiny}"


def test_temperature_containment_1000_steps():
    """Asserts that T_R <= T_cal(t) <= T_s across 1,000 randomized time steps."""
    model = BobergLantzThermalModel(t_res_c=48.0, t_steam_c=260.0)
    np.random.seed(42)

    # Random times from 0 to 1,000 days (0 to 24,000 hours)
    random_times_hours = np.random.uniform(0.0, 24000.0, 1000)
    t_cal, t_avg = model.predict_temperature(random_times_hours)

    assert np.all(t_cal >= 48.0), f"Temperature underflow: min T_cal={np.min(t_cal)}"
    assert np.all(t_cal <= 260.0), f"Temperature overflow: max T_cal={np.max(t_cal)}"
    assert np.all(t_avg >= 48.0), f"Average temperature underflow: min T_avg={np.min(t_avg)}"
    assert np.all(t_avg <= 260.0), f"Average temperature overflow: max T_avg={np.max(t_avg)}"


def test_temperature_monotonic_decay():
    """Asserts that reservoir temperature monotonically decays over time."""
    model = BobergLantzThermalModel()
    times_days = np.linspace(0.1, 365.0, 200)
    times_hours = times_days * 24.0

    t_cal, _ = model.predict_temperature(times_hours)
    diffs = np.diff(t_cal)

    # Allow tiny numerical tolerance for monotonicity
    assert np.all(diffs <= 1e-4), "Temperature forecast is not monotonically decaying."
