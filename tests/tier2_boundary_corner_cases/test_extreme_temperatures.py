"""
Tier 2 Boundary & Corner Case Test Suite: Extreme Temperatures & 1,000-Step Randomized Clamping.
Covers:
- Acceptance Criteria §69: Calculated temperature strictly satisfies TR <= T_cal(t) <= Ts
  across 1,000 randomized time steps and parameter perturbation trials.
- Extreme thermodynamic boundary conditions (tau -> inf, k_hat -> inf, k_hat -> -inf).
- Strict second-law thermodynamic admissibility enforcement.
"""

import math
import numpy as np
import pytest

from src.thermal import ThermalAssetParameters, ThermalDecayEngine


class TestRandomizedTemperatureClamping:
    """1,000-trial randomized stress testing for strict thermodynamic clamping TR <= T_cal <= Ts."""

    def test_1000_randomized_time_steps_and_scaling_factors(self):
        """1,000 randomized combinations of elapsed time (0 to 3 yrs) and scaling k_hat strictly satisfy TR <= T_cal <= Ts."""
        engine = ThermalDecayEngine()
        tr = engine.params.TR  # 321.15 K
        ts = engine.params.Ts  # 533.15 K

        rng = np.random.default_rng(seed=42)

        # 1. Random times from 0 to 1e8 seconds (~3.17 years)
        random_tau = rng.uniform(0.0, 1.0e8, size=1000)

        # 2. Random scaling factors including adversarial out-of-bound values (-2.0 to +3.0)
        random_k_hat = rng.uniform(-2.0, 3.0, size=1000)

        # Evaluate all 1,000 cases
        for i in range(1000):
            tau = float(random_tau[i])
            k_hat = float(random_k_hat[i])
            t_cal = engine.temperature_calibrated(tau, k_hat=k_hat)

            assert isinstance(t_cal, float)
            assert tr <= t_cal <= ts, (
                f"Thermodynamic clamping violated at trial {i}: tau={tau} s, k_hat={k_hat}, "
                f"got T_cal={t_cal} K (allowed range [{tr}, {ts}] K)"
            )

    def test_randomized_vectorized_clamping(self):
        """Vectorized evaluation of 1,000 simultaneous points matches element-wise results."""
        engine = ThermalDecayEngine()
        tr, ts = engine.params.TR, engine.params.Ts

        rng = np.random.default_rng(seed=12345)
        tau_vec = rng.uniform(0.0, 5.0e7, size=1000)

        t_cal_vec = engine.temperature_calibrated(tau_vec, k_hat=0.80)

        assert isinstance(t_cal_vec, np.ndarray)
        assert len(t_cal_vec) == 1000
        assert np.all(t_cal_vec >= tr)
        assert np.all(t_cal_vec <= ts)


class TestExtremeBoundaryConditions:
    """Validates behavior at extreme thermodynamic limits and infinite horizons."""

    def test_infinite_elapsed_time_asymptotic_cooling(self):
        """At tau = 1e12 seconds (~31,700 years), temperature has completely returned to ambient TR."""
        engine = ThermalDecayEngine()
        t_cal_inf = engine.temperature_calibrated(1.0e12, k_hat=1.0)
        assert math.isclose(t_cal_inf, engine.params.TR, abs_tol=1e-4)

    def test_extreme_adversarial_k_hat_clamping(self):
        """Adversarial scaling k_hat = +1000.0 or k_hat = -1000.0 clamps strictly to [TR, Ts]."""
        engine = ThermalDecayEngine()
        tr, ts = engine.params.TR, engine.params.Ts

        # Huge positive multiplier cannot exceed saturated steam temperature Ts
        t_high = engine.temperature_calibrated(3600.0, k_hat=1000.0)
        assert t_high == ts

        # Huge negative multiplier cannot plunge below ambient reservoir temperature TR
        t_low = engine.temperature_calibrated(3600.0, k_hat=-1000.0)
        assert t_low == tr
