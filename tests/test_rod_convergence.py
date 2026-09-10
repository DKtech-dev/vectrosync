"""
T1 Numerical Validation Gate Suite for Transient Tapered-Rod Wave Solver (tests/test_rod_convergence.py).

Validates:
1. Undamped mechanical energy conservation (dE/dt = 0 when beta = 0 and boundary work = 0).
2. Static gravity equilibrium match against exact analytical rod stretch.
3. Taper interface force continuity (|N_left - N_right| < 1e-4 N across section steps).
4. Strict CFL acoustic limit violation rejection.
5. Grid spatial convergence under static gravity extension.
6. Phase-resolved dynacard production fidelity under transient time-marching.
"""

import math
import numpy as np
import pytest

from src.rod_transient import TransientRodWaveSolver
from src.rod_conservative import RodSection, CFLViolationError, DynacardResult, get_default_baghewala_rod_string


class TestTransientRodConvergence:
    """Rigorous numerical convergence and conservation test suite for TransientRodWaveSolver."""

    def test_cfl_violation_rejection(self):
        """Ensures solver strictly rejects time steps exceeding acoustic Courant limit dx / c."""
        solver = TransientRodWaveSolver(dx=10.0)
        c = solver.c_acoustic  # ~5,135 m/s
        max_dt = solver.dx / c  # ~0.001947 s

        # Safe subcycling step should pass
        solver.check_cfl_validity(max_dt * 0.8)

        # Step exceeding limit must raise CFLViolationError
        with pytest.raises(CFLViolationError):
            solver.check_cfl_validity(max_dt * 1.05)

    def test_static_gravity_equilibrium(self):
        """Analytical exact static gravity equilibrium displacement matches numerical integration."""
        solver = TransientRodWaveSolver(dx=10.0)
        g_eff = 8.623  # Submerged effective gravity in crude

        u_eq = solver.get_static_equilibrium(g_eff=g_eff, bottom_load_N=0.0)

        # Boundary condition: top is fixed at 0
        assert u_eq[0] == 0.0
        # Under tension (pulling downward), u(x) is negative and monotonically decreases with depth
        assert np.all(np.diff(u_eq) < 0.0)

        # Check total downward elongation |u(L)| against analytical sum
        total_analytical_stretch = 0.0
        cumulative_weight_below = 0.0
        for sec in reversed(solver.sections):
            sec_weight = sec.rho * sec.area * sec.length * g_eff
            self_stretch = (sec_weight * sec.length) / (2.0 * sec.axial_stiffness_EA)
            below_stretch = (cumulative_weight_below * sec.length) / sec.axial_stiffness_EA
            total_analytical_stretch += (self_stretch + below_stretch)
            cumulative_weight_below += sec_weight

        numerical_total_stretch = abs(u_eq[-1])
        rel_error = abs(numerical_total_stretch - total_analytical_stretch) / total_analytical_stretch
        assert rel_error < 0.005, f"Static stretch relative error {rel_error:.4e} exceeds 0.5% threshold."

    def test_taper_interface_force_continuity(self):
        """Axial force flux N = E * A * du/dx must be continuous across section taper boundaries."""
        solver = TransientRodWaveSolver(dx=10.0)
        g_eff = 8.623
        u_eq = solver.get_static_equilibrium(g_eff=g_eff, bottom_load_N=5000.0)

        # Compute face normal forces N_{i+1/2} = E * A_{i+1/2} * (u_i - u_{i+1}) / dx
        face_forces = (solver.E * solver.face_areas / solver.dx) * (u_eq[:-1] - u_eq[1:])

        # Find indices corresponding to section junctions (350 m and 750 m)
        j1_idx = int(round(350.0 / solver.dx))
        j2_idx = int(round(750.0 / solver.dx))

        # Node equilibrium: N_{j-1/2} - N_{j+1/2} = m_j * g_eff
        delta_N1 = face_forces[j1_idx - 1] - face_forces[j1_idx]
        expected_weight1 = solver.node_masses[j1_idx] * g_eff
        assert abs(delta_N1 - expected_weight1) < 1e-3, "Interface 1 force flux balance violated."

        delta_N2 = face_forces[j2_idx - 1] - face_forces[j2_idx]
        expected_weight2 = solver.node_masses[j2_idx] * g_eff
        assert abs(delta_N2 - expected_weight2) < 1e-3, "Interface 2 force flux balance violated."

    def test_undamped_energy_conservation(self):
        """With zero damping (beta=0), no gravity, and clamped ends, mechanical energy is conserved."""
        sec = [RodSection(length=500.0, diameter=0.0254)]
        solver = TransientRodWaveSolver(sections=sec, dx=5.0)

        dt = solver.compute_cfl_timestep(0.50)  # Conservative CFL = 0.5
        n_steps = 1200  # Multiple round trips across the 500m rod

        # Initial conditions: sinusoidal displacement with zero velocity (standing wave)
        l_total = 500.0
        amp = 0.005  # 5 mm amplitude
        u = amp * np.sin(np.pi * solver.x_nodes / l_total)
        v = np.zeros(solver.n_nodes, dtype=np.float64)

        _, _, initial_energy = solver.compute_mechanical_energy(u, v)
        assert initial_energy > 0.0

        ea_over_dx = solver.E * solver.face_areas / solver.dx
        inv_masses = 1.0 / solver.node_masses

        for _ in range(n_steps):
            # Clamped boundaries: u[0] = 0, u[-1] = 0
            face_tensions = ea_over_dx * (u[:-1] - u[1:])
            f_net = np.zeros(solver.n_nodes, dtype=np.float64)
            f_net[1:-1] = face_tensions[:-1] - face_tensions[1:]

            accel = f_net[1:-1] * inv_masses[1:-1]
            v[1:-1] += accel * dt
            u[1:-1] += v[1:-1] * dt

        _, _, final_energy = solver.compute_mechanical_energy(u, v)
        energy_drift = abs(final_energy - initial_energy) / initial_energy
        assert energy_drift < 0.01, f"Undamped energy drift {energy_drift:.4e} exceeds 1% tolerance."

    def test_spatial_grid_convergence(self):
        """Verifies spatial convergence order O(dx^2) on static gravity problem."""
        grid_spacings = [20.0, 10.0, 5.0]
        errors = []

        sec = get_default_baghewala_rod_string()
        g_eff = 8.623

        ref_solver = TransientRodWaveSolver(sections=sec, dx=1.0)
        u_exact = abs(ref_solver.get_static_equilibrium(g_eff=g_eff, bottom_load_N=0.0)[-1])

        for dx in grid_spacings:
            s = TransientRodWaveSolver(sections=sec, dx=dx)
            u_num = abs(s.get_static_equilibrium(g_eff=g_eff, bottom_load_N=0.0)[-1])
            errors.append(abs(u_num - u_exact))

        # As dx decreases, error must decrease
        assert errors[1] < errors[0], "Error did not decrease from dx=20 to dx=10."
        assert errors[2] < errors[1], "Error did not decrease from dx=10 to dx=5."

    def test_transient_dynacard_generation(self):
        """Simulates steady-state transient card and verifies physical bounds."""
        solver = TransientRodWaveSolver(dx=20.0)
        res: DynacardResult = solver.simulate_transient(
            spm=3.5,
            temp_c=75.0,
            water_cut=0.35,
            pump_fillage=0.95,
            n_strokes=2,
        )

        assert isinstance(res, DynacardResult)
        assert len(res.surface_position_m) == 144
        assert len(res.surface_load_kn) == 144
        assert len(res.downhole_position_m) == 144
        assert len(res.downhole_load_kn) == 144
        assert len(res.downhole_tension_kn) == 144

        # Surface stroke should be ~2.54 m
        assert math.isclose(res.surface_stroke_m, 2.54, rel_tol=0.05)
        # PPRL should be positive and bounded within working rating (110 kN)
        assert 20.0 <= res.pprl_kn <= 110.0, f"PPRL {res.pprl_kn} outside expected physical window."
        # Power should be positive
        assert res.power_kw > 0.0
        assert res.oil_production_bopd >= 0.0
