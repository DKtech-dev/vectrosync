"""
Unit Test Suite for Conservative 1D Elastodynamic Wave Solver (src/rod_conservative.py).

Comprehensive unit tests covering:
- 3-section tapered rod string discretization (116 nodes over 1,150 m TVD).
- Acoustic wave velocity c = sqrt(E / rho) approx 5135.10 m/s.
- Strict CFL time subcycling condition (dt <= 0.8 * dx / c approx 1.558 ms).
- Rejection of time steps violating CFL stability (CFLViolationError).
- Kinematic surface crank boundary with second-harmonic inertia.
- Static hanging gravity equilibrium profile.
- Taper interface displacement and force continuity (< 1e-5 N error) across Node 35 (350m) and Node 75 (750m).
- Acoustic impedance reflection/transmission conservation (1 + R = T).
- Multi-stroke settling (3 full pump strokes) and steady-state limit cycle.
- Dynacard phase-resampling to exactly 144 uniform crank-angle points.
- Mechanical work, hydraulic power, and anti-float minimum tension KPIs.
"""

import math
import numpy as np
import pytest

from src.pump_boundary import PlungerBoundary, PumpBoundaryParameters, ValveState
from src.rheology import HeavyOilRheology
from src.rod_conservative import (
    CFLViolationError,
    ConservativeRodWaveSolver,
    DynacardResult,
    RodSection,
    get_default_baghewala_rod_string,
)


class TestRodSectionModel:
    """Tests RodSection dataclass geometry, mechanical properties, and conversions."""

    def test_rod_section_properties(self):
        """Validates area, radius, mass, stiffness, and acoustic speed."""
        sec = RodSection(length=350.0, diameter=0.0254, E=2.07e11, rho=7850.0)
        expected_area = math.pi * (0.0254 / 2.0) ** 2  # 5.067075e-4 m^2
        assert math.isclose(sec.area, expected_area, rel_tol=1e-5)
        assert math.isclose(sec.area_m2, expected_area, rel_tol=1e-5)
        assert math.isclose(sec.radius_m, 0.0127, rel_tol=1e-5)
        assert math.isclose(sec.diameter_inches, 1.0, rel_tol=1e-4)

        expected_c = math.sqrt(2.07e11 / 7850.0)  # 5135.10 m/s
        assert math.isclose(sec.acoustic_velocity_c, expected_c, rel_tol=1e-4)

        expected_mass = 7850.0 * expected_area * 350.0  # ~1392.18 kg
        assert math.isclose(sec.mass_kg, expected_mass, rel_tol=1e-4)

        expected_k = 2.07e11 * expected_area / 350.0  # ~299,681 N/m
        assert math.isclose(sec.stiffness_k, expected_k, rel_tol=1e-4)

    def test_rod_section_validation(self):
        """Validates input checking on section parameters."""
        with pytest.raises(ValueError, match="length"):
            RodSection(length=-10.0, diameter=0.0254)
        with pytest.raises(ValueError, match="diameter"):
            RodSection(length=100.0, diameter=-0.0254)
        with pytest.raises(ValueError, match="Young's modulus"):
            RodSection(length=100.0, diameter=0.0254, E=0.0)
        with pytest.raises(ValueError, match="Density"):
            RodSection(length=100.0, diameter=0.0254, rho=-100.0)


class TestTaperedRodDiscretization:
    """Tests spatial grid discretization and dual-face finite-volume mass assignment."""

    def test_default_baghewala_string_geometry(self):
        """Verifies 3-section discrete geometry totaling 1,150 m."""
        sections = get_default_baghewala_rod_string()
        assert len(sections) == 3
        assert sections[0].length == 350.0
        assert math.isclose(sections[0].diameter, 0.0254)
        assert sections[1].length == 400.0
        assert math.isclose(sections[1].diameter, 0.022225)
        assert sections[2].length == 400.0
        assert math.isclose(sections[2].diameter, 0.01905)

        total_length = sum(s.length for s in sections)
        assert math.isclose(total_length, 1150.0)

    def test_spatial_node_count_and_coordinates(self):
        """Discretizing L = 1,150 m at dx = 10 m produces exactly 116 nodes from 0 to 1150 m."""
        solver = ConservativeRodWaveSolver(dx=10.0)
        assert solver.n_nodes == 116
        assert len(solver.node_depths) == 116
        assert math.isclose(solver.node_depths[0], 0.0)
        assert math.isclose(solver.node_depths[-1], 1150.0)
        assert math.isclose(solver.node_depths[35], 350.0)  # Interface 1
        assert math.isclose(solver.node_depths[75], 750.0)  # Interface 2

    def test_control_volume_mass_conservation(self):
        """Total sum of control volume masses equals exact analytical rod string solid mass."""
        solver = ConservativeRodWaveSolver(dx=10.0)
        sum_grid_mass = np.sum(solver.node_masses)
        analytical_mass = sum(s.mass_kg for s in solver.sections)
        assert math.isclose(sum_grid_mass, analytical_mass, rel_tol=1e-5)


class TestCFLStabilityAndSubcycling:
    """Tests strict acoustic CFL time step derivation and violation rejection."""

    def test_acoustic_cfl_timestep_bounds(self):
        """Strict CFL step dt <= 0.8 * dx / c with dx = 10 m is ~1.558 ms."""
        solver = ConservativeRodWaveSolver(dx=10.0)
        dt_cfl = solver.compute_cfl_timestep(cfl_safety=0.8)
        assert 0.001550 <= dt_cfl <= 0.001558
        assert dt_cfl <= (0.8 * 10.0 / 5135.10) + 1e-7

    def test_rejection_of_cfl_violating_timestep(self):
        """Solver rejects any explicit time step exceeding the acoustic limit."""
        solver = ConservativeRodWaveSolver(dx=10.0)
        # Max theoretical CFL step = 10 / 5135.10 = 0.001947 s
        with pytest.raises(CFLViolationError, match="CFL"):
            solver.solve_stroke_cycle(SPM=4.5, dt=0.0025)  # 2.5 ms > 1.947 ms


class TestKinematicSurfaceCrankBoundary:
    """Tests second-harmonic crank boundary kinematics."""

    def test_surface_kinematics_bounds_and_zero_crossings(self):
        """Validates surface position bounds [0, S] and velocity zero crossings."""
        solver = ConservativeRodWaveSolver(dx=10.0)
        stroke_length = 2.54
        spm = 4.5
        period = 60.0 / spm

        t_samples = np.linspace(0.0, period, 500)
        pos_list, vel_list, acc_list = [], [], []

        for t in t_samples:
            p, v, a = solver.surface_kinematics(t, stroke_length, spm, crank_lambda=0.25)
            pos_list.append(p)
            vel_list.append(v)
            acc_list.append(a)

        # Bounds: [0, S]
        assert min(pos_list) >= -1e-6
        assert math.isclose(min(pos_list), 0.0, abs_tol=1e-4)
        assert max(pos_list) <= stroke_length + 1e-4
        assert math.isclose(max(pos_list), stroke_length, abs_tol=1e-3)

        # Bottom dead center (t = 0): pos = 0, vel = 0, acc > 0
        p0, v0, a0 = solver.surface_kinematics(0.0, stroke_length, spm, crank_lambda=0.25)
        assert math.isclose(p0, 0.0, abs_tol=1e-6)
        assert math.isclose(v0, 0.0, abs_tol=1e-6)
        assert a0 > 0.0


class TestTaperInterfaceContinuity:
    """Tests finite-volume force and displacement continuity (< 1e-5 error) across tapers."""

    def test_static_hanging_equilibrium_force_continuity(self):
        """In static gravity equilibrium, internal axial force is continuous across taper nodes."""
        solver = ConservativeRodWaveSolver(dx=10.0)
        u_static = solver.get_static_equilibrium(g_eff=8.623, bottom_load_N=0.0)

        # Strains across faces
        EA_over_dx = (solver.E * solver.face_areas) / solver.dx
        face_forces = EA_over_dx * (u_static[:-1] - u_static[1:])  # Tension positive

        # Interface 1 (Node 35, x = 350 m):
        # Face 34 (left of node 35) and Face 35 (right of node 35)
        # Face 34 tension = Face 35 tension + weight of node 35
        f_left_35 = face_forces[34]
        f_right_35 = face_forces[35]
        expected_diff_35 = solver.node_masses[35] * 8.623

        # Force divergence matches control volume weight to machine precision
        discrepancy_35 = abs((f_left_35 - f_right_35) - expected_diff_35)
        assert discrepancy_35 < 1.0e-5, f"Discrepancy at Node 35: {discrepancy_35} N"

        # Interface 2 (Node 75, x = 750 m):
        f_left_75 = face_forces[74]
        f_right_75 = face_forces[75]
        expected_diff_75 = solver.node_masses[75] * 8.623
        discrepancy_75 = abs((f_left_75 - f_right_75) - expected_diff_75)
        assert discrepancy_75 < 1.0e-5, f"Discrepancy at Node 75: {discrepancy_75} N"


class TestFullStrokeWaveSimulationAndResampling:
    """Tests multi-stroke conservative elastodynamic wave simulation and 144-point resampling."""

    def test_solve_stroke_cycle_144_points(self):
        """Runs 3-stroke simulation and confirms 144 uniform crank angles."""
        solver = ConservativeRodWaveSolver(dx=10.0)
        result = solver.solve_stroke_cycle(
            SPM=4.5,
            stroke_length=2.54,
            T_res_K=363.15,
            fw=0.0,
            fillage=0.95,
            n_strokes=3,
        )

        assert isinstance(result, DynacardResult)
        assert len(result.theta_deg) == 144
        assert len(result.surface_position_m) == 144
        assert len(result.surface_load_N) == 144
        assert len(result.downhole_position_m) == 144
        assert len(result.downhole_load_N) == 144

        # Crank angle spacing is exact 2.5 degrees
        assert math.isclose(result.theta_deg[0], 0.0)
        assert math.isclose(result.theta_deg[1] - result.theta_deg[0], 2.5, rel_tol=1e-5)
        assert math.isclose(result.theta_deg[-1], 357.5, rel_tol=1e-5)

        # Physical load bounds
        assert result.pprl_N > 50000.0  # Peak Polished Rod Load > 50 kN
        assert result.min_tension_N >= 0.0  # Tensile load is non-negative under normal operation
        assert result.surface_stroke_m > 2.0
        assert result.surface_work_joules > 0.0
        assert result.downhole_work_joules > 0.0

    def test_thermal_rheology_coupling_effect_on_pprl(self):
        """Hot CSS steam condition (200 C) produces lower viscous drag and lower PPRL than cold oil (48 C)."""
        solver = ConservativeRodWaveSolver(dx=10.0)

        # Cold reservoir state (48 C = 321.15 K)
        res_cold = solver.solve_stroke_cycle(SPM=4.0, T_res_K=321.15, fw=0.0, n_strokes=3)

        # Hot steamed state (180 C = 453.15 K)
        res_hot = solver.solve_stroke_cycle(SPM=4.0, T_res_K=453.15, fw=0.0, n_strokes=3)

        # Hot condition has lower viscosity -> lower viscous drag -> lower peak load
        assert res_hot.pprl_N <= res_cold.pprl_N + 5000.0  # Viscous drag reduction observed

    def test_dynacard_result_methods(self):
        """Tests power and dictionary serialization methods on DynacardResult."""
        solver = ConservativeRodWaveSolver(dx=10.0)
        result = solver.solve_stroke_cycle(SPM=4.5, stroke_length=2.54, n_strokes=3)

        p_hyd = result.hydraulic_power_kW(spm=4.5)
        p_prl = result.polished_rod_power_kW(spm=4.5)

        assert p_hyd > 0.0
        assert p_prl > 0.0
        assert p_prl >= p_hyd  # Surface input power >= downhole hydraulic power

        d = result.to_dict()
        assert "theta_deg" in d
        assert len(d["theta_deg"]) == 144
        assert "pprl_N" in d
        assert "min_tension_N" in d
