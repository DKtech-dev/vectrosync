"""
Comprehensive Unit & Physical Defensibility Tests for R2: Non-Newtonian Rheology & Couette Drag.

Tests:
1. RheologyParameters Dataclass Defaults, Units, and Thermodynamic Validation.
2. TaperSection Geometry & 3-Section Baghewala-14 String Tally.
3. Arrhenius Two-Point Dynamic Viscosity Analytical Calibration & Asymptotics.
4. Multiphase Water-Cut Emulsion Mixing & Density Interpolation.
5. Distributed Couette Annular Shear Drag beta(x, t) and Mass Damping Ratio nu(x, t).
6. Strict Physical Clamping [nu_min, nu_max] = [0.01, 3.00] s^-1 across 1,000 randomized states.
7. Rod String Spatial Depth Profiling (116 nodes from 0 to 1150 m).
8. Dynamic Transient Coupling with Boberg-Lantz ThermalDecayEngine.
"""

import math
import numpy as np
import pytest

from src.rheology import (
    HeavyOilRheology,
    RheologyParameters,
    TaperSection,
    get_default_baghewala_taper_sections,
)
from src.thermal import ThermalDecayEngine


class TestRheologyParameters:
    """Test suite for RheologyParameters dataclass."""

    def test_default_parameters_baghewala(self):
        """Verifies Baghewala-14 reference physical parameters."""
        params = RheologyParameters()
        assert params.T1_K == pytest.approx(323.15, rel=1e-5)
        assert params.T1_C == pytest.approx(50.0, rel=1e-5)
        assert params.mu1_Pas == pytest.approx(12.0, rel=1e-5)
        assert params.mu1_cP == pytest.approx(12000.0, rel=1e-5)

        assert params.T2_K == pytest.approx(473.15, rel=1e-5)
        assert params.T2_C == pytest.approx(200.0, rel=1e-5)
        assert params.mu2_Pas == pytest.approx(0.045, rel=1e-5)
        assert params.mu2_cP == pytest.approx(45.0, rel=1e-5)

        assert params.mu_water_Pas == pytest.approx(0.001, rel=1e-5)
        assert params.mu_water_cP == pytest.approx(1.0, rel=1e-5)

        assert params.rho_oil == pytest.approx(965.0, rel=1e-5)
        assert params.rho_water == pytest.approx(1000.0, rel=1e-5)
        assert params.rho_rod == pytest.approx(7850.0, rel=1e-5)

        assert params.D_tubing == pytest.approx(0.076, rel=1e-5)
        assert params.r_tubing == pytest.approx(0.038, rel=1e-5)
        assert params.f_eccentric == pytest.approx(1.25, rel=1e-5)
        assert params.nu_min == pytest.approx(0.01, rel=1e-5)
        assert params.nu_max == pytest.approx(3.00, rel=1e-5)

    def test_parameter_validation_negative_temp(self):
        with pytest.raises(ValueError, match="T1_K must be strictly positive"):
            RheologyParameters(T1_K=-10.0)

    def test_parameter_validation_temp_order(self):
        with pytest.raises(ValueError, match="must exceed T1_K"):
            RheologyParameters(T1_K=400.0, T2_K=350.0)

    def test_parameter_validation_viscosity(self):
        with pytest.raises(ValueError, match="mu1_Pas must be strictly positive"):
            RheologyParameters(mu1_Pas=0.0)
        with pytest.raises(ValueError, match="mu2_Pas must be strictly positive"):
            RheologyParameters(mu2_Pas=-1.0)
        with pytest.raises(ValueError, match="at lower temperature T1 must exceed mu2"):
            RheologyParameters(mu1_Pas=0.05, mu2_Pas=1.0)

    def test_parameter_validation_density_and_geometry(self):
        with pytest.raises(ValueError, match="rho_oil must be strictly positive"):
            RheologyParameters(rho_oil=0.0)
        with pytest.raises(ValueError, match="rho_water must be strictly positive"):
            RheologyParameters(rho_water=-5.0)
        with pytest.raises(ValueError, match="rho_rod must be strictly positive"):
            RheologyParameters(rho_rod=0.0)
        with pytest.raises(ValueError, match="D_tubing must be strictly positive"):
            RheologyParameters(D_tubing=-0.05)
        with pytest.raises(ValueError, match="f_eccentric must be >= 1.0"):
            RheologyParameters(f_eccentric=0.8)
        with pytest.raises(ValueError, match="nu_min must be strictly positive"):
            RheologyParameters(nu_min=0.0)
        with pytest.raises(ValueError, match="nu_max .* must exceed nu_min"):
            RheologyParameters(nu_min=2.0, nu_max=1.0)

    def test_serialization_roundtrip(self):
        params = RheologyParameters()
        d = params.to_dict()
        reconstructed = RheologyParameters.from_dict(d)
        assert reconstructed.T1_K == params.T1_K
        assert reconstructed.mu1_Pas == params.mu1_Pas
        assert reconstructed.T2_K == params.T2_K
        assert reconstructed.mu2_Pas == params.mu2_Pas
        assert reconstructed.rho_oil == params.rho_oil
        assert reconstructed.D_tubing == params.D_tubing


class TestTaperSection:
    """Test suite for TaperSection dataclass and default Baghewala rod string."""

    def test_default_baghewala_tally(self):
        sections = get_default_baghewala_taper_sections()
        assert len(sections) == 3

        # Section 1: 1.0 in
        assert sections[0].section_id == 1
        assert sections[0].top_depth_m == 0.0
        assert sections[0].bottom_depth_m == 350.0
        assert sections[0].length_m == 350.0
        assert sections[0].diameter_m == pytest.approx(0.0254, rel=1e-5)
        assert sections[0].diameter_inches == pytest.approx(1.0, rel=1e-5)
        assert sections[0].radius_m == pytest.approx(0.0127, rel=1e-5)
        assert sections[0].area_m2 == pytest.approx(5.067075e-4, rel=1e-4)

        # Section 2: 7/8 in
        assert sections[1].section_id == 2
        assert sections[1].top_depth_m == 350.0
        assert sections[1].bottom_depth_m == 750.0
        assert sections[1].length_m == 400.0
        assert sections[1].diameter_m == pytest.approx(0.022225, rel=1e-5)
        assert sections[1].diameter_inches == pytest.approx(0.875, rel=1e-5)
        assert sections[1].radius_m == pytest.approx(0.0111125, rel=1e-5)
        assert sections[1].area_m2 == pytest.approx(3.879479e-4, rel=1e-4)

        # Section 3: 3/4 in
        assert sections[2].section_id == 3
        assert sections[2].top_depth_m == 750.0
        assert sections[2].bottom_depth_m == 1150.0
        assert sections[2].length_m == 400.0
        assert sections[2].diameter_m == pytest.approx(0.01905, rel=1e-5)
        assert sections[2].diameter_inches == pytest.approx(0.750, rel=1e-5)
        assert sections[2].radius_m == pytest.approx(0.009525, rel=1e-5)
        assert sections[2].area_m2 == pytest.approx(2.850230e-4, rel=1e-4)

    def test_section_validation(self):
        with pytest.raises(ValueError, match="section_id must be positive"):
            TaperSection(section_id=0, name="Bad", top_depth_m=0.0, bottom_depth_m=100.0, diameter_m=0.02)
        with pytest.raises(ValueError, match="top_depth_m must be non-negative"):
            TaperSection(section_id=1, name="Bad", top_depth_m=-10.0, bottom_depth_m=100.0, diameter_m=0.02)
        with pytest.raises(ValueError, match="bottom_depth_m .* must exceed top_depth_m"):
            TaperSection(section_id=1, name="Bad", top_depth_m=100.0, bottom_depth_m=50.0, diameter_m=0.02)
        with pytest.raises(ValueError, match="diameter_m must be strictly positive"):
            TaperSection(section_id=1, name="Bad", top_depth_m=0.0, bottom_depth_m=100.0, diameter_m=-0.02)


class TestArrheniusDynamicViscosity:
    """Test suite for Arrhenius dynamic viscosity model."""

    def test_arrhenius_calibration_constants(self):
        engine = HeavyOilRheology()
        # Analytical expected: B = 5693.93672 K, A_mu = -15.1351983
        assert engine.B == pytest.approx(5693.9367, rel=1e-5)
        assert engine.A_mu == pytest.approx(-15.135198, rel=1e-5)

    def test_calibration_anchor_point_1(self):
        """Exact calibration at T1 = 50 C = 323.15 K -> mu = 12.0 Pa.s."""
        engine = HeavyOilRheology()
        mu_k = engine.oil_viscosity(323.15)
        mu_c = engine.oil_viscosity_celsius(50.0)
        assert mu_k == pytest.approx(12.0, abs=1e-6)
        assert mu_c == pytest.approx(12.0, abs=1e-6)

    def test_calibration_anchor_point_2(self):
        """Exact calibration at T2 = 200 C = 473.15 K -> mu = 0.045 Pa.s."""
        engine = HeavyOilRheology()
        mu_k = engine.oil_viscosity(473.15)
        mu_c = engine.oil_viscosity_celsius(200.0)
        assert mu_k == pytest.approx(0.045, abs=1e-6)
        assert mu_c == pytest.approx(0.045, abs=1e-6)

    def test_ambient_and_steam_temperatures(self):
        """Checks viscosity at ambient reservoir (48 C) and steam injection (260 C)."""
        engine = HeavyOilRheology()
        # At 48 C (321.15 K): heavy viscosity surge ~13.39 Pa.s
        mu_res = engine.oil_viscosity(321.15)
        assert mu_res == pytest.approx(13.3917, rel=1e-3)
        assert mu_res > 12.0

        # At 260 C (533.15 K): thin steam-heated crude ~0.0116 Pa.s (11.6 cP)
        mu_steam = engine.oil_viscosity(533.15)
        assert mu_steam == pytest.approx(0.0116, rel=1e-2)
        assert mu_steam < 0.045

    def test_temperature_monotonicity(self):
        """Viscosity must strictly decrease with increasing temperature."""
        engine = HeavyOilRheology()
        temps = np.linspace(300.0, 600.0, 100)
        mus = engine.oil_viscosity(temps)
        diffs = np.diff(mus)
        assert np.all(diffs < 0.0), "Viscosity must be strictly monotonically decreasing with T"

    def test_vectorization_shapes(self):
        engine = HeavyOilRheology()
        # 1D array
        t_1d = np.array([323.15, 373.15, 473.15])
        mu_1d = engine.oil_viscosity(t_1d)
        assert mu_1d.shape == (3,)
        assert isinstance(mu_1d, np.ndarray)

        # 2D array
        t_2d = t_1d.reshape((1, 3))
        mu_2d = engine.oil_viscosity(t_2d)
        assert mu_2d.shape == (1, 3)

    def test_invalid_temperature_raises(self):
        engine = HeavyOilRheology()
        with pytest.raises(ValueError, match="strictly positive"):
            engine.oil_viscosity(0.0)
        with pytest.raises(ValueError, match="strictly positive"):
            engine.oil_viscosity(-50.0)


class TestMultiphaseWaterCutMixing:
    """Test suite for water-cut emulsion mixing."""

    def test_pure_oil_boundary(self):
        engine = HeavyOilRheology()
        mu_pure_oil = engine.mixture_viscosity(323.15, fw=0.0)
        assert mu_pure_oil == pytest.approx(12.0, abs=1e-6)

    def test_pure_water_boundary(self):
        engine = HeavyOilRheology()
        mu_pure_water = engine.mixture_viscosity(323.15, fw=1.0)
        assert mu_pure_water == pytest.approx(0.001, abs=1e-6)

    def test_intermediate_linear_mixing(self):
        engine = HeavyOilRheology()
        mu_50 = engine.mixture_viscosity(323.15, fw=0.5)
        expected = 12.0 * (1.0 + 2.5 * 0.5 + 10.05 * (0.5 ** 2))  # 57.15 Pa.s
        assert mu_50 == pytest.approx(expected, abs=1e-6)

    def test_mixture_density(self):
        engine = HeavyOilRheology()
        assert engine.mixture_density(0.0) == pytest.approx(965.0, abs=1e-5)
        assert engine.mixture_density(1.0) == pytest.approx(1000.0, abs=1e-5)
        assert engine.mixture_density(0.5) == pytest.approx(982.5, abs=1e-5)

    def test_water_cut_clipping(self):
        engine = HeavyOilRheology()
        # fw < 0 clipped to 0.0
        assert engine.mixture_viscosity(323.15, fw=-0.2) == pytest.approx(12.0, abs=1e-6)
        # fw > 1 clipped to 1.0
        assert engine.mixture_viscosity(323.15, fw=1.5) == pytest.approx(0.001, abs=1e-6)


class TestCouetteShearDragAndMassDamping:
    """Test suite for distributed Couette annular drag and mass damping."""

    def test_geometric_drag_factors_per_section(self):
        """Verifies geometric drag factors for all 3 rod sections."""
        engine = HeavyOilRheology()
        # Section 1 (1.0 in, r1 = 0.0127 m)
        g1 = engine.geometric_drag_factor(0.0127)
        expected_g1 = (2.0 * math.pi * 1.25) / math.log(0.038 / 0.0127)
        assert g1 == pytest.approx(expected_g1, rel=1e-5)
        assert g1 == pytest.approx(7.1661, rel=1e-3)

        # Section 2 (7/8 in, r2 = 0.0111125 m)
        g2 = engine.geometric_drag_factor(0.0111125)
        expected_g2 = (2.0 * math.pi * 1.25) / math.log(0.038 / 0.0111125)
        assert g2 == pytest.approx(expected_g2, rel=1e-5)
        assert g2 == pytest.approx(6.3879, rel=1e-3)

        # Section 3 (3/4 in, r3 = 0.009525 m)
        g3 = engine.geometric_drag_factor(0.009525)
        expected_g3 = (2.0 * math.pi * 1.25) / math.log(0.038 / 0.009525)
        assert g3 == pytest.approx(expected_g3, rel=1e-5)
        assert g3 == pytest.approx(5.6762, rel=1e-3)

    def test_couette_drag_values_at_reference_points(self):
        engine = HeavyOilRheology()
        # At 50 C (12.0 Pa.s): beta1 = 7.1661 * 12.0 = 85.9937 N.s/m^2
        beta1 = engine.couette_drag_beta(12.0, 0.0127)
        assert beta1 == pytest.approx(85.9937, rel=1e-3)

        # At 200 C (0.045 Pa.s): beta1 = 7.1661 * 0.045 = 0.3225 N.s/m^2
        beta1_hot = engine.couette_drag_beta(0.045, 0.0127)
        assert beta1_hot == pytest.approx(0.3225, rel=1e-3)

    def test_mass_damping_clamping_upper_bound(self):
        """In cold heavy oil (e.g. 48 C, raw nu > 20 s^-1), nu is strictly clamped to nu_max = 3.00 s^-1."""
        engine = HeavyOilRheology()
        beta_cold = engine.couette_drag_beta(13.3917, 0.0127)
        a1 = math.pi * (0.0127 ** 2)
        raw_nu = beta_cold / (engine.params.rho_rod * a1)
        assert raw_nu > 20.0  # Would cause severe wave solver explosion if unclamped

        nu_clamped = engine.damping_nu(beta_cold, a1)
        assert nu_clamped == pytest.approx(3.00, abs=1e-6)

    def test_mass_damping_clamping_lower_bound(self):
        """In superheated steam with high water cut, raw nu < 0.01 s^-1 is clamped to nu_min = 0.01 s^-1."""
        engine = HeavyOilRheology()
        mu_thin = engine.mixture_viscosity(533.15, fw=0.95)
        beta_thin = engine.couette_drag_beta(mu_thin, 0.0127)
        a1 = math.pi * (0.0127 ** 2)
        raw_nu = beta_thin / (engine.params.rho_rod * a1)
        assert raw_nu < 0.01

        nu_clamped = engine.damping_nu(beta_thin, a1)
        assert nu_clamped == pytest.approx(0.01, abs=1e-6)

    def test_mass_damping_intermediate_unclamped(self):
        """At 200 C, pure oil: nu lies cleanly within [0.01, 3.00]."""
        engine = HeavyOilRheology()
        mu_200 = engine.oil_viscosity(473.15)
        beta = engine.couette_drag_beta(mu_200, 0.0127)
        a1 = math.pi * (0.0127 ** 2)
        nu = engine.damping_nu(beta, a1)
        assert 0.01 < nu < 3.00
        assert nu == pytest.approx(0.0811, rel=1e-2)

    def test_invalid_radii_and_areas(self):
        engine = HeavyOilRheology()
        # Rod radius >= tubing radius
        with pytest.raises(ValueError, match="strictly less than tubing inner radius"):
            engine.couette_drag_beta(1.0, 0.038)
        with pytest.raises(ValueError, match="strictly positive"):
            engine.couette_drag_beta(1.0, 0.0)
        with pytest.raises(ValueError, match="strictly positive"):
            engine.damping_nu(1.0, 0.0)


class TestDepthProfileUtilitiesAndThermalCoupling:
    """Test suite for spatial depth profiling and thermal decay coupling."""

    def test_section_at_depth_lookups(self):
        engine = HeavyOilRheology()
        # Top section 1 (0 to 350 m)
        assert engine.get_taper_section_at_depth(0.0).section_id == 1
        assert engine.get_taper_section_at_depth(100.0).section_id == 1
        assert engine.get_taper_section_at_depth(349.9).section_id == 1

        # Section 2 (350 to 750 m)
        assert engine.get_taper_section_at_depth(350.0).section_id == 2
        assert engine.get_taper_section_at_depth(500.0).section_id == 2
        assert engine.get_taper_section_at_depth(749.9).section_id == 2

        # Section 3 (750 to 1150 m)
        assert engine.get_taper_section_at_depth(750.0).section_id == 3
        assert engine.get_taper_section_at_depth(1000.0).section_id == 3
        assert engine.get_taper_section_at_depth(1150.0).section_id == 3

    def test_discrete_116_node_grid_profile(self):
        """Simulates evaluation along the standard 116-node wave solver spatial grid."""
        engine = HeavyOilRheology()
        depths = np.linspace(0.0, 1150.0, 116)

        beta, nu = engine.compute_drag_profile(depths, T_K=373.15, fw=0.1)
        assert beta.shape == (116,)
        assert nu.shape == (116,)
        assert np.all(nu >= engine.params.nu_min)
        assert np.all(nu <= engine.params.nu_max)

    def test_dynamic_thermal_decay_coupling(self):
        """Tests seamless coupling with ThermalDecayEngine."""
        thermal = ThermalDecayEngine()
        rheo = HeavyOilRheology()
        depths = np.linspace(0.0, 1150.0, 116)

        # Early time (hot steam zone)
        beta_0, nu_0, T_0 = rheo.compute_dynamic_profile(depths, thermal, tau_seconds=0.0, k_hat=1.0, fw=0.05)
        assert T_0 > 500.0  # Hot
        assert np.mean(nu_0) < 0.1

        # Late time (cooled reservoir)
        beta_late, nu_late, T_late = rheo.compute_dynamic_profile(
            depths, thermal, tau_seconds=30 * 86400.0, k_hat=1.0, fw=0.05
        )
        assert T_late < T_0
        assert np.mean(nu_late) > np.mean(nu_0)
        assert np.all(nu_late >= rheo.params.nu_min)
        assert np.all(nu_late <= rheo.params.nu_max)

    def test_randomized_stress_clamping(self):
        """Validates that across 1,000 randomized states, nu is strictly within [0.01, 3.00]."""
        engine = HeavyOilRheology()
        np.random.seed(42)

        random_temps = np.random.uniform(273.15 + 20.0, 273.15 + 300.0, 1000)
        random_fws = np.random.uniform(0.0, 1.0, 1000)
        random_depths = np.random.uniform(0.0, 1150.0, 1000)

        for t_k, fw, depth in zip(random_temps, random_fws, random_depths):
            mu_mix = engine.mixture_viscosity(t_k, fw)
            r_rod = engine.rod_radius_at_depth(depth)
            a_rod = engine.rod_area_at_depth(depth)
            beta = engine.couette_drag_beta(mu_mix, r_rod)
            nu = engine.damping_nu(beta, a_rod)

            assert 0.01 <= nu <= 3.00, f"Damping ratio {nu} violated bounds at T={t_k}, fw={fw}, d={depth}"
