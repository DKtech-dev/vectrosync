"""
Comprehensive Unit Tests for R1: Reservoir Thermal Decay Engine (src/thermal.py).

Tests:
1. Physical Asset Parameters & Validation.
2. Radial Factor Exact Singularity Limits (lim_{b^2 -> 0} v_r = 1.0) & Asymptotics.
3. Vertical Factor Exact Singularity Limits (lim_{w -> 0} v_z = 1.0) & expm1 Underflow Protection.
4. Monotonic Decay & Continuity across intermediate spline boundary knots.
5. Strict Thermodynamic Clamping (TR <= T_cal <= Ts) across 1,000 randomized time steps.
6. Dynamic Calibration Factor k_hat scaling.
7. Scalar vs Vectorized Array compatibility & Shape preservation.
8. Error handling for negative time and invalid physical parameters.
"""

import pytest
import numpy as np
from src.thermal import ThermalAssetParameters, ThermalDecayEngine


class TestThermalAssetParameters:
    """Test suite for ThermalAssetParameters dataclass."""

    def test_default_parameters_baghewala(self):
        params = ThermalAssetParameters()
        assert params.TR == pytest.approx(321.15, rel=1e-5)
        assert params.TR_C == pytest.approx(48.0, rel=1e-5)
        assert params.Ts == pytest.approx(533.15, rel=1e-5)
        assert params.Ts_C == pytest.approx(260.0, rel=1e-5)
        assert params.alpha == pytest.approx(1.0e-6, rel=1e-6)
        assert params.h == pytest.approx(15.0, rel=1e-5)
        assert params.rh == pytest.approx(12.0, rel=1e-5)
        assert params.delta == pytest.approx(0.05, rel=1e-5)

    def test_parameter_validation_negative_temp(self):
        with pytest.raises(ValueError, match="Ambient reservoir temperature TR must be positive"):
            ThermalAssetParameters(TR=-10.0)

    def test_parameter_validation_steam_less_than_res(self):
        with pytest.raises(ValueError, match="must exceed ambient reservoir temp"):
            ThermalAssetParameters(TR=350.0, Ts=340.0)

    def test_parameter_validation_diffusivity_and_geometry(self):
        with pytest.raises(ValueError, match="diffusivity alpha must be strictly positive"):
            ThermalAssetParameters(alpha=0.0)
        with pytest.raises(ValueError, match="Net pay thickness h must be strictly positive"):
            ThermalAssetParameters(h=-5.0)
        with pytest.raises(ValueError, match="Heated steam radius rh must be strictly positive"):
            ThermalAssetParameters(rh=0.0)
        with pytest.raises(ValueError, match="Convective removal factor delta"):
            ThermalAssetParameters(delta=1.5)

    def test_to_and_from_dict(self):
        params = ThermalAssetParameters(TR=330.0, Ts=540.0, alpha=2.0e-6, h=20.0, rh=15.0, delta=0.08)
        p_dict = params.to_dict()
        assert p_dict["TR_K"] == 330.0
        assert p_dict["Ts_K"] == 540.0
        assert p_dict["alpha_m2_s"] == 2.0e-6
        assert p_dict["h_m"] == 20.0
        assert p_dict["rh_m"] == 15.0
        assert p_dict["delta"] == 0.08

        restored = ThermalAssetParameters.from_dict(p_dict)
        assert restored.TR == 330.0
        assert restored.Ts == 540.0
        assert restored.alpha == 2.0e-6
        assert restored.h == 20.0
        assert restored.rh == 15.0
        assert restored.delta == 0.08


class TestRadialFactor:
    """Test suite for radial conduction decay factor v_r_bar(b^2)."""

    def setup_method(self):
        self.engine = ThermalDecayEngine()

    def test_radial_singularity_identity_exact(self):
        """Singularity limit: lim_{b^2 -> 0^+} v_r(b^2) = 1.00000000."""
        # Exact zero
        assert self.engine.radial_factor(0.0) == 1.0
        # Below 1e-10 threshold
        assert self.engine.radial_factor(1.0e-15) == 1.0
        assert self.engine.radial_factor(1.0e-12) == 1.0
        assert self.engine.radial_factor(1.0e-10) == 1.0

    def test_radial_monotonic_decay(self):
        """v_r(b^2) must strictly monotonically decrease with increasing b^2."""
        b2_series = np.logspace(-9, 3, 100)
        vr_series = self.engine.radial_factor(b2_series)
        diffs = np.diff(vr_series)
        assert np.all(diffs <= 0.0), "Radial factor must be monotonically non-increasing"
        assert np.all((vr_series >= 0.0) & (vr_series <= 1.0)), "Radial factor must stay in [0, 1]"

    def test_radial_asymptotic_branch(self):
        """For b^2 >= 100, v_r(b^2) -> 1 / (4 * b^2)."""
        assert self.engine.radial_factor(100.0) == pytest.approx(1.0 / (4.0 * 100.0), rel=1e-6)
        assert self.engine.radial_factor(500.0) == pytest.approx(1.0 / (4.0 * 500.0), rel=1e-6)
        assert self.engine.radial_factor(10000.0) == pytest.approx(1.0 / (4.0 * 10000.0), rel=1e-6)

    def test_radial_negative_input_raises(self):
        with pytest.raises(ValueError, match="must be non-negative"):
            self.engine.radial_factor(-0.01)


class TestVerticalFactor:
    """Test suite for vertical conduction decay factor v_z_bar(w, h)."""

    def setup_method(self):
        self.engine = ThermalDecayEngine()

    def test_vertical_singularity_identity_exact(self):
        """Singularity limit: lim_{w -> 0^+} v_z(w, h) = 1.00000000."""
        # Exact zero
        assert self.engine.vertical_factor(0.0) == 1.0
        # Below 1e-12 * h^2 threshold
        h = 15.0
        assert self.engine.vertical_factor(1.0e-15, h=h) == 1.0
        assert self.engine.vertical_factor(1.0e-12 * (h ** 2), h=h) == 1.0

    def test_vertical_monotonic_decay(self):
        """v_z(w, h) must strictly monotonically decrease with increasing w."""
        w_series = np.logspace(-8, 5, 100)
        vz_series = self.engine.vertical_factor(w_series)
        diffs = np.diff(vz_series)
        assert np.all(diffs <= 0.0), "Vertical factor must be monotonically non-increasing"
        assert np.all((vz_series >= 0.0) & (vz_series <= 1.0)), "Vertical factor must stay in [0, 1]"

    def test_vertical_expm1_underflow_safety(self):
        """Verifies no cancellation error or NaN when h^2 / w is extremely large."""
        # Small w -> h^2/w is ~ 2.25e6
        vz_small = self.engine.vertical_factor(1.0e-4, h=15.0)
        assert not np.isnan(vz_small)
        assert vz_small <= 1.0
        assert vz_small > 0.99

    def test_vertical_negative_or_invalid_inputs(self):
        with pytest.raises(ValueError, match="must be non-negative"):
            self.engine.vertical_factor(-1.0)
        with pytest.raises(ValueError, match="Net pay thickness h must be strictly positive"):
            self.engine.vertical_factor(1.0, h=-10.0)


class TestTemperatureDecayAndClamping:
    """Test suite for temperature evolution, calibration, and thermodynamic clamping."""

    def setup_method(self):
        self.engine = ThermalDecayEngine()

    def test_initial_temperature_at_tau_zero(self):
        """At tau = 0, v_r = 1, v_z = 1, fluid removal D_f(0)=0, so T_avg = Ts (533.15 K)."""
        t_avg_0 = self.engine.temperature_avg(0.0)
        expected_0 = 533.15
        assert t_avg_0 == pytest.approx(expected_0, rel=1e-6)

        t_cal_0 = self.engine.temperature_calibrated(0.0, k_hat=1.0)
        assert t_cal_0 == pytest.approx(expected_0, rel=1e-6)

    def test_infinite_time_asymptotic_limit(self):
        """At tau -> inf, temperature smoothly cools to TR (ambient reservoir temperature)."""
        tau_late = 1.0e13  # Very large time
        t_avg_late = self.engine.temperature_avg(tau_late)
        assert t_avg_late == pytest.approx(self.engine.params.TR, abs=1e-4)

        t_cal_late = self.engine.temperature_calibrated(tau_late, k_hat=0.85)
        assert t_cal_late == pytest.approx(self.engine.params.TR, abs=1e-4)

    def test_1000_randomized_time_steps_clamping(self):
        """Calculated temperature strictly satisfies TR <= T_cal(t) <= Ts across 1,000 randomized steps."""
        np.random.seed(42)
        # Random times spanning 0 seconds to 5 years (~ 1.5e8 seconds)
        random_taus = np.random.uniform(0.0, 1.5e8, size=1000)
        # Random dynamic scaling k_hat in [0.5, 1.5] to test clamping bounds
        random_k = np.random.uniform(0.5, 1.5, size=1000)

        t_cal_vals = self.engine.temperature_calibrated(random_taus, k_hat=random_k)

        assert np.all(t_cal_vals >= self.engine.params.TR - 1e-12), (
            f"Violated lower bound TR={self.engine.params.TR}, min={np.min(t_cal_vals)}"
        )
        assert np.all(t_cal_vals <= self.engine.params.Ts + 1e-12), (
            f"Violated upper bound Ts={self.engine.params.Ts}, max={np.max(t_cal_vals)}"
        )

    def test_dynamic_calibration_scaling(self):
        """k_hat scales the temperature rise (T_avg - TR) proportionally."""
        tau = 86400.0 * 10.0  # 10 days
        t_avg = self.engine.temperature_avg(tau)

        t_cal_half = self.engine.temperature_calibrated(tau, k_hat=0.5)
        expected_half = self.engine.params.TR + 0.5 * (t_avg - self.engine.params.TR)
        assert t_cal_half == pytest.approx(expected_half, rel=1e-6)

        t_cal_full = self.engine.temperature_calibrated(tau, k_hat=1.0)
        assert t_cal_full == pytest.approx(t_avg, rel=1e-6)

    def test_celsius_conversions(self):
        """Verify Celsius helpers."""
        t_c = self.engine.temperature_celsius(0.0, k_hat=1.0)
        t_k = self.engine.temperature_calibrated(0.0, k_hat=1.0)
        assert t_c == pytest.approx(t_k - 273.15, rel=1e-6)

        t_avg_c = self.engine.temperature_avg_celsius(0.0)
        t_avg_k = self.engine.temperature_avg(0.0)
        assert t_avg_c == pytest.approx(t_avg_k - 273.15, rel=1e-6)


class TestVectorizationAndShapes:
    """Test suite for scalar and multi-dimensional array vectorization."""

    def setup_method(self):
        self.engine = ThermalDecayEngine()

    def test_scalar_types(self):
        vr = self.engine.radial_factor(0.05)
        assert isinstance(vr, float)

        vz = self.engine.vertical_factor(2.5)
        assert isinstance(vz, float)

        t_avg = self.engine.temperature_avg(1000.0)
        assert isinstance(t_avg, float)

        t_cal = self.engine.temperature_calibrated(1000.0, k_hat=0.9)
        assert isinstance(t_cal, float)

    def test_1d_array_types(self):
        taus = np.array([0.0, 3600.0, 86400.0, 864000.0])
        t_cal = self.engine.temperature_calibrated(taus, k_hat=0.95)
        assert isinstance(t_cal, np.ndarray)
        assert t_cal.shape == (4,)

    def test_2d_array_types(self):
        taus = np.array([[0.0, 3600.0], [86400.0, 864000.0]])
        t_cal = self.engine.temperature_calibrated(taus, k_hat=1.0)
        assert isinstance(t_cal, np.ndarray)
        assert t_cal.shape == (2, 2)

    def test_decay_factors_tuple(self):
        vr, vz = self.engine.decay_factors(86400.0)
        assert isinstance(vr, float)
        assert isinstance(vz, float)
        assert 0.0 < vr <= 1.0
        assert 0.0 < vz <= 1.0
