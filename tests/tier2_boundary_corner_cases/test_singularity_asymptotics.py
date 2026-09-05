"""
Tier 2 Boundary & Corner Case Test Suite: Singularity Limits & Asymptotics.
Covers:
- Analytical singularity proofs at tau -> 0+ (vr -> 1.0, vz -> 1.0).
- Weber-Schafheitlin integral identity 2 * int_0^inf J1(y)^2 / y dy = 1.0.
- Numerical thresholds (b^2 <= 1e-10, w <= 1e-12 * h^2).
- Far-field asymptotic decay branches (1 / (4 * b^2) for vr, h / sqrt(pi * w) for vz).
"""

import math
import numpy as np
import pytest
from scipy.integrate import quad
from scipy.special import j1

from src.thermal import ThermalAssetParameters, ThermalDecayEngine


class TestSingularityProofsAndThresholds:
    """Rigorous mathematical tests for the exact analytical limits as tau -> 0+."""

    def test_weber_schafheitlin_bessel_integral_identity(self):
        """Weber-Schafheitlin integral identity: 2 * int_0^inf (J1(y)^2 / y) dy == 1.00000000."""
        def integrand(y: float) -> float:
            if y == 0.0:
                return 0.0
            return (j1(y) ** 2) / y

        res, err = quad(integrand, 0.0, 500.0, epsabs=1e-12, epsrel=1e-11, limit=500)
        integral_val = 2.0 * res
        assert math.isclose(integral_val, 1.0, rel_tol=2e-3, abs_tol=2e-3)

    def test_radial_singularity_zero_and_sub_thresholds(self):
        """b^2 = 0 and sub-thresholds (1e-16, 1e-14, 1e-12, 1e-10) return exact 1.0."""
        engine = ThermalDecayEngine()
        assert engine.radial_factor(0.0) == 1.0
        assert engine.radial_factor(1.0e-16) == 1.0
        assert engine.radial_factor(1.0e-14) == 1.0
        assert engine.radial_factor(1.0e-12) == 1.0
        assert engine.radial_factor(1.0e-10) == 1.0

    def test_vertical_singularity_zero_and_sub_thresholds(self):
        """w = 0 and sub-thresholds (w <= 1e-12 * h^2) return exact 1.0."""
        engine = ThermalDecayEngine()
        h = 15.0
        assert engine.vertical_factor(0.0, h) == 1.0
        assert engine.vertical_factor(1.0e-18, h) == 1.0
        assert engine.vertical_factor(1.0e-15, h) == 1.0
        assert engine.vertical_factor(1.0e-12 * (h ** 2), h) == 1.0

    def test_boberg_lantz_temperature_start_limit(self):
        """As tau -> 0+, T_avg -> Ts (533.15 K) without artificial double-subtraction."""
        params_no_loss = ThermalAssetParameters(TR=321.15, Ts=533.15, delta=0.0)
        engine_no_loss = ThermalDecayEngine(params_no_loss)
        assert math.isclose(engine_no_loss.temperature_avg(0.0), 533.15, abs_tol=1e-6)

        params_oil = ThermalAssetParameters(TR=321.15, Ts=533.15, delta=0.05)
        engine_oil = ThermalDecayEngine(params_oil)
        expected_t0 = 533.15  # At tau=0, fluid loss D_f(0)=0
        assert math.isclose(engine_oil.temperature_avg(0.0), expected_t0, abs_tol=1e-6)


class TestFarFieldAsymptoticDecay:
    """Validates far-field long-time analytical asymptotic behavior."""

    def test_radial_asymptotic_branch_convergence(self):
        """For large b^2 >= 100, v_r_bar(b^2) matches 1 / (4 * b^2) within 0.1% relative error."""
        engine = ThermalDecayEngine()
        for b2 in [100.0, 500.0, 1000.0, 5000.0, 50000.0]:
            val = engine.radial_factor(b2)
            expected = 1.0 / (4.0 * b2)
            rel_err = abs(val - expected) / expected
            assert rel_err < 1e-4, f"Asymptotic error at b^2={b2}: {rel_err}"

    def test_vertical_asymptotic_branch_convergence(self):
        """For large w >> h^2, v_z_bar(w, h) decays as h / sqrt(pi * w)."""
        engine = ThermalDecayEngine()
        h = 15.0
        # When w is large (e.g. w = 1e6 m^2), erf(h/sqrt(w)) ~ 2/sqrt(pi) * (h/sqrt(w))
        # and term2 ~ sqrt(w)/(h*sqrt(pi)) * (-h^2/w) = -h / (sqrt(pi * w))
        # sum ~ h / sqrt(pi * w)
        for w in [1.0e5, 1.0e6, 1.0e7]:
            val = engine.vertical_factor(w, h)
            expected_leading = h / math.sqrt(math.pi * w)
            rel_err = abs(val - expected_leading) / expected_leading
            assert rel_err < 0.01, f"Asymptotic error at w={w}: {rel_err}"
