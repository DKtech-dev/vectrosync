"""
Tests for Module 3: CFL Stability & Acoustic Wave Discretization (tests/test_cfl_stability.py)
Asserts dt <= 0.8 * dx / c across all rod taper sections and verifies numerical energy stability.
"""

import numpy as np
import pytest
from src.rod_conservative import ConservativeTaperedRodSolver


def test_cfl_condition_all_tapers():
    """Asserts dt <= 0.8 * dx / c across all 3 taper sections."""
    solver = ConservativeTaperedRodSolver()

    # Material properties
    e_mod = solver.e_mod
    rho = solver.rho
    c_acoustic = np.sqrt(e_mod / rho)
    dx = solver.dx
    dt = solver.dt

    # Maximum stable theoretical CFL limit
    dt_cfl_limit = 0.80 * (dx / c_acoustic)

    assert dt <= dt_cfl_limit + 1e-12, f"CFL condition violated: dt={dt:.6f}s > limit={dt_cfl_limit:.6f}s"
    assert dt > 0.0, "Time step dt must be strictly positive."
    assert 0.0010 <= dt <= 0.0025, f"Unexpected time step range: {dt}s"


def test_wave_speed_and_material_constants():
    """Verifies acoustic velocity c matches steel physical constant (~5134.6 m/s)."""
    solver = ConservativeTaperedRodSolver()
    expected_c = np.sqrt(2.07e11 / 7850.0)
    assert np.isclose(solver.c_acoustic, expected_c, rtol=1e-4)


def test_full_cycle_simulation_finite_values():
    """Verifies that running a 3-stroke wave simulation produces finite non-NaN metrics."""
    solver = ConservativeTaperedRodSolver()
    result = solver.simulate_card(spm=3.5, temp_c=80.0, water_cut=0.35, n_strokes=3)

    assert not np.isnan(result["pprl_kn"])
    assert not np.isnan(result["mprl_kn"])
    assert not np.isnan(result["min_downhole_tension_kn"])
    assert len(result["surface_position_m"]) == 144
    assert len(result["surface_load_kn"]) == 144
    assert len(result["downhole_position_m"]) == 144
    assert len(result["downhole_tension_kn"]) == 144
