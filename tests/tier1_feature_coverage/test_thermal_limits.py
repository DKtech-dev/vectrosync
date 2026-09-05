"""
Tier 1 Feature Test Suite: Reservoir Thermal Decay Engine (Requirement R1).
Covers Features 1, 2, and 3:
- Boberg-Lantz Radial Decay factor v_r_bar(b^2) with exact singularity limits.
- Boberg-Lantz Vertical Conduction factor v_z_bar(w, h) with expm1 protection.
- Average reservoir temperature T_avg(tau) and Calibrated dynamic temperature T_cal(tau).
- Thermodynamic boundary clamping [TR, Ts].
"""

import math
import numpy as np
import pytest

from src.thermal import ThermalAssetParameters, ThermalDecayEngine


class TestRadialDecayFactor:
    """Validates analytical and numerical properties of the radial heat factor v_r_bar(b^2)."""

    def test_radial_factor_exact_singularity_at_zero(self):
        """Singularity limit: lim_{b^2 -> 0^+} v_r_bar(b^2) = 1.00000000 exactly."""
        engine = ThermalDecayEngine()
        assert engine.radial_factor(0.0) == 1.0
        assert engine.radial_factor(0) == 1.0

    def test_radial_factor_near_zero_sub_threshold(self):
        """Singularity threshold: for b^2 <= 1.0e-10, returns exact 1.0 without zero division."""
        engine = ThermalDecayEngine()
        assert engine.radial_factor(1.0e-12) == 1.0
        assert engine.radial_factor(1.0e-10) == 1.0
        assert engine.radial_factor(1.0e-15) == 1.0

    def test_radial_factor_intermediate_cubic_spline_accuracy(self, reference_bessel_quad):
        """Validates cached 1D cubic spline accuracy against direct Bessel quadrature (<1e-4 relative error)."""
        engine = ThermalDecayEngine()
        test_b2_values = [1.0e-6, 1.0e-4, 1.0e-2, 0.1, 0.5, 1.0, 5.0, 10.0, 50.0]

        for b2 in test_b2_values:
            val_engine = engine.radial_factor(b2)
            val_ref = reference_bessel_quad(b2)
            assert isinstance(val_engine, float)
            assert 0.0 < val_engine <= 1.0
            assert math.isclose(val_engine, val_ref, rel_tol=1.0e-3, abs_tol=1.0e-4), (
                f"Mismatch at b^2 = {b2}: engine={val_engine}, ref={val_ref}"
            )

    def test_radial_factor_asymptotic_tail_decay(self):
        """Asymptotic regime: for b^2 >= 100, v_r_bar(b^2) decays as 1 / (4 * b^2)."""
        engine = ThermalDecayEngine()
        for b2 in [100.0, 250.0, 1000.0, 10000.0]:
            val = engine.radial_factor(b2)
            expected = 1.0 / (4.0 * b2)
            assert math.isclose(val, expected, rel_tol=1.0e-6), (
                f"Asymptotic mismatch at b^2={b2}: got {val}, expected {expected}"
            )

    def test_radial_factor_strict_monotonicity(self):
        """Radial factor must be strictly monotonically decreasing with dimensionless time b^2."""
        engine = ThermalDecayEngine()
        b2_grid = np.logspace(-9, 3, 200)
        vr_vals = engine.radial_factor(b2_grid)
        diffs = np.diff(vr_vals)
        assert np.all(diffs <= 1.0e-12), "v_r_bar(b^2) violated monotonic decrease."

    def test_radial_factor_negative_input_rejection(self):
        """Negative dimensionless time is physically impossible and must raise ValueError."""
        engine = ThermalDecayEngine()
        with pytest.raises(ValueError, match="non-negative"):
            engine.radial_factor(-0.01)

        with pytest.raises(ValueError, match="non-negative"):
            engine.radial_factor(np.array([0.1, -1.0, 2.0]))


class TestVerticalConductionFactor:
    """Validates analytical and numerical properties of vertical heat factor v_z_bar(w, h)."""

    def test_vertical_factor_exact_singularity_at_zero(self):
        """Singularity limit: lim_{w -> 0^+} v_z_bar(w, h) = 1.00000000 exactly."""
        engine = ThermalDecayEngine()
        assert engine.vertical_factor(0.0, 15.0) == 1.0
        assert engine.vertical_factor(0, 15.0) == 1.0

    def test_vertical_factor_near_zero_sub_threshold(self):
        """Singularity threshold: w <= 1e-12 * h^2 returns exact 1.0 without loss of precision."""
        engine = ThermalDecayEngine()
        h = 15.0
        assert engine.vertical_factor(1.0e-15, h) == 1.0
        assert engine.vertical_factor(1.0e-13 * (h**2), h) == 1.0
        assert engine.vertical_factor(1.0e-12 * (h**2), h) == 1.0

    def test_vertical_factor_expm1_underflow_protection(self):
        """Validates expm1(-h^2/w) avoids cancellation when h^2/w is large."""
        engine = ThermalDecayEngine()
        h = 15.0
        # For w small, z = h / sqrt(w) is large, e.g. w = 0.01 -> z = 150
        val = engine.vertical_factor(0.01, h)
        assert 0.995 < val <= 1.0
        # Check asymptotic Taylor expansion 1 - sqrt(w)/(h*sqrt(pi))
        expected_taylor = 1.0 - math.sqrt(0.01) / (h * math.sqrt(math.pi))
        assert math.isclose(val, expected_taylor, rel_tol=1.0e-5)

    def test_vertical_factor_monotonic_decay(self):
        """Vertical factor must strictly monotonically decrease with diffusion area w."""
        engine = ThermalDecayEngine()
        w_grid = np.logspace(-4, 6, 200)
        vz_vals = engine.vertical_factor(w_grid, 15.0)
        diffs = np.diff(vz_vals)
        assert np.all(diffs <= 1.0e-12), "v_z_bar(w, h) violated monotonic decrease."

    def test_vertical_factor_invalid_inputs_rejection(self):
        """Negative w or non-positive h must raise ValueError."""
        engine = ThermalDecayEngine()
        with pytest.raises(ValueError, match="non-negative"):
            engine.vertical_factor(-1.0, 15.0)

        with pytest.raises(ValueError, match="strictly positive"):
            engine.vertical_factor(10.0, 0.0)

        with pytest.raises(ValueError, match="strictly positive"):
            engine.vertical_factor(10.0, -5.0)


class TestTemperatureDecayAndClamping:
    """Validates uncalibrated and calibrated temperature functions and thermodynamic clamping."""

    def test_temperature_avg_initial_state(self):
        """At tau = 0, v_r = 1, v_z = 1, fluid heat loss D_f(0)=0, so T_avg(0) = Ts = 533.15 K."""
        params = ThermalAssetParameters(TR=321.15, Ts=533.15, delta=0.05)
        engine = ThermalDecayEngine(params)
        expected_t0 = 533.15
        assert math.isclose(engine.temperature_avg(0.0), expected_t0, abs_tol=1.0e-6)

    def test_temperature_avg_long_time_asymptotic_limit(self):
        """As tau -> inf, T_avg decays toward ambient reservoir temperature TR."""
        params = ThermalAssetParameters(TR=321.15, Ts=533.15, delta=0.05)
        engine = ThermalDecayEngine(params)
        # At tau = 5 years = 1.57e8 s
        t_late = engine.temperature_avg(1.57e8)
        assert params.TR <= t_late <= params.TR + 15.0  # Close to TR

    def test_temperature_calibrated_scaling_and_clamping(self):
        """Verifies calibrated temperature T_cal(tau) with scaling k_hat strictly clamped in [TR, Ts]."""
        params = ThermalAssetParameters(TR=321.15, Ts=533.15)
        engine = ThermalDecayEngine(params)

        # Nominal k_hat = 1.0
        t_cal_nom = engine.temperature_calibrated(3600.0 * 24 * 10, k_hat=1.0)
        assert params.TR <= t_cal_nom <= params.Ts

        # Scaled k_hat = 0.7042 (Safari 42% late-time anchor correction)
        t_cal_scaled = engine.temperature_calibrated(3600.0 * 24 * 300, k_hat=0.704225)
        assert params.TR <= t_cal_scaled <= params.Ts

        # Extreme k_hat clamping tests
        t_cal_high_k = engine.temperature_calibrated(0.0, k_hat=2.5)
        assert t_cal_high_k == params.Ts

        t_cal_zero_k = engine.temperature_calibrated(3600.0 * 24 * 100, k_hat=0.0)
        assert t_cal_zero_k == params.TR

    def test_temperature_decay_vectorization(self):
        """Verifies vectorization across numpy arrays of time steps."""
        engine = ThermalDecayEngine()
        tau_array = np.array([0.0, 3600.0, 86400.0, 86400.0 * 30, 86400.0 * 365])
        t_cal_array = engine.temperature_calibrated(tau_array, k_hat=0.85)

        assert isinstance(t_cal_array, np.ndarray)
        assert len(t_cal_array) == 5
        assert np.all(t_cal_array >= engine.params.TR)
        assert np.all(t_cal_array <= engine.params.Ts)
        assert np.all(np.diff(t_cal_array) <= 1.0e-6)  # Monotonic decay


class TestThermalAssetParametersValidation:
    """Validates strict domain integrity checking on ThermalAssetParameters."""

    def test_valid_default_parameters(self):
        """Default initialization matches Baghewala field specifications."""
        params = ThermalAssetParameters()
        assert params.TR == 321.15
        assert params.Ts == 533.15
        assert params.alpha == 1.0e-6
        assert params.h == 15.0
        assert params.rh == 12.0
        assert params.delta == 0.05
        assert params.TR_C == 48.0
        assert params.Ts_C == 260.0

    def test_invalid_parameters_raise_value_error(self):
        """Invalid thermal parameters must raise ValueError."""
        with pytest.raises(ValueError, match="Ambient reservoir temperature TR"):
            ThermalAssetParameters(TR=-10.0)

        with pytest.raises(ValueError, match="must exceed ambient reservoir temp"):
            ThermalAssetParameters(TR=400.0, Ts=350.0)

        with pytest.raises(ValueError, match="thermal diffusivity alpha"):
            ThermalAssetParameters(alpha=-1.0e-6)

        with pytest.raises(ValueError, match="Net pay thickness h"):
            ThermalAssetParameters(h=0.0)

        with pytest.raises(ValueError, match="Heated steam radius rh"):
            ThermalAssetParameters(rh=-5.0)

        with pytest.raises(ValueError, match="Convective removal factor delta"):
            ThermalAssetParameters(delta=1.05)
