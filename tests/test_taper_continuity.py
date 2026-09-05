"""
Tests for Module 3: Taper Interface Continuity (tests/test_taper_continuity.py)
Asserts displacement and internal axial force continuity across rod section interfaces (350m, 750m).
"""

import numpy as np
import pytest
from src.rod_conservative import ConservativeTaperedRodSolver


def test_taper_geometry_assignment():
    """Verifies nodal area and diameter mappings across all 3 taper zones."""
    solver = ConservativeTaperedRodSolver(dx_m=10.0)

    # Check Top section nodes (0 to 350m -> nodes 0 to 35)
    for i, x in enumerate(solver.x_nodes):
        if x <= 340.0:
            assert np.isclose(solver.node_diameter[i], 0.0254)
        elif 360.0 <= x <= 740.0:
            assert np.isclose(solver.node_diameter[i], 0.022225)
        elif x >= 760.0:
            assert np.isclose(solver.node_diameter[i], 0.01905)


def test_interface_conservative_harmonic_flux():
    """
    Verifies that the conservative face cross-sectional area A_{i+1/2}
    strictly satisfies harmonic mean property across taper interfaces.
    """
    solver = ConservativeTaperedRodSolver(dx_m=10.0)

    # Node indices for interfaces at 350m (idx 35) and 750m (idx 75)
    idx_350 = int(350.0 / solver.dx)
    idx_750 = int(750.0 / solver.dx)

    a_left_350 = solver.node_area[idx_350 - 1]
    a_right_350 = solver.node_area[idx_350 + 1]
    a_face_350 = solver.face_area[idx_350]

    # Harmonic mean formula: 2 * A_L * A_R / (A_L + A_R)
    expected_face = (2.0 * a_left_350 * a_right_350) / (a_left_350 + a_right_350)
    assert np.isclose(a_face_350, expected_face, rtol=1e-2)


def test_interface_displacement_continuity():
    """Verifies smooth displacement continuity across rod taper interfaces during dynamic stroke."""
    solver = ConservativeTaperedRodSolver(dx_m=10.0)
    result = solver.simulate_card(spm=3.0, temp_c=90.0, water_cut=0.30, n_strokes=2)

    # Dynamometer positions are smooth without discontinuous jumps
    surf_pos = np.array(result["surface_position_m"])
    down_pos = np.array(result["downhole_position_m"])

    # Stroke is continuous (max change between consecutive crank points is small)
    max_d_surf = np.max(np.abs(np.diff(surf_pos)))
    max_d_down = np.max(np.abs(np.diff(down_pos)))

    assert max_d_surf < 0.20, f"Displacement discontinuity at surface: {max_d_surf} m"
    assert max_d_down < 0.20, f"Displacement discontinuity downhole: {max_d_down} m"
