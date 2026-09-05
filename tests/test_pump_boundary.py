"""
Unit Test Suite for Plunger Boundary Dynamics & Valve States (src/pump_boundary.py).

Comprehensive unit tests covering:
- PumpBoundaryParameters validation, properties, and dictionary serialization/deserialization.
- Upstroke fluid column load calculation (Traveling Valve closed, Standing Valve open).
- Downstroke flowing valve release (Traveling Valve open, Standing Valve closed).
- Fluid pound hydrodynamic impact shock across fillage fractions in [0.1, 1.0].
- Hyperbolic tangent smoothing across velocity zero crossings for non-chattering simulation.
- Dynamic fluid property updates during transient simulation.
- Error handling and boundary edge cases.
"""

import math
import numpy as np
import pytest

from src.pump_boundary import (
    PlungerBoundary,
    PumpBoundaryParameters,
    PumpParameters,
    ValveState,
)


class TestPumpBoundaryParameters:
    """Tests parameter dataclass validation, calculated properties, and serialization."""

    def test_default_parameters(self):
        """Validates default Baghewala pump parameters."""
        params = PumpBoundaryParameters()
        assert math.isclose(params.plunger_diameter_m, 0.04445, rel_tol=1e-4)
        assert math.isclose(params.diameter_inches, 1.75, rel_tol=1e-4)
        assert math.isclose(params.depth_m, 1150.0)
        assert math.isclose(params.rho_fluid_kg_m3, 950.0)
        assert math.isclose(params.p_intake_Pa, 5.0e5)
        assert math.isclose(params.f_friction_N, 300.0)
        assert math.isclose(params.gamma_pound, 1.8)
        assert math.isclose(params.nominal_fillage, 0.95)

    def test_calculated_properties(self):
        """Verifies area, hydrostatic discharge pressure, delta_p, and nominal fluid load."""
        params = PumpBoundaryParameters(
            plunger_diameter_m=0.04445,
            depth_m=1150.0,
            rho_fluid_kg_m3=950.0,
            p_intake_Pa=5.0e5,
        )
        expected_area = math.pi * (0.04445 / 2.0) ** 2
        assert math.isclose(params.plunger_area_m2, expected_area, rel_tol=1e-5)

        expected_p_discharge = 950.0 * 9.81 * 1150.0  # 10,717,425 Pa
        assert math.isclose(params.calculated_p_discharge_Pa, expected_p_discharge, rel_tol=1e-5)

        expected_delta_p = expected_p_discharge - 5.0e5  # 10,217,425 Pa
        assert math.isclose(params.delta_p_Pa, expected_delta_p, rel_tol=1e-5)

        expected_f_fluid = expected_area * expected_delta_p  # ~15,855.3 N
        assert math.isclose(params.nominal_fluid_load_N, expected_f_fluid, rel_tol=1e-4)

    def test_custom_discharge_pressure(self):
        """Verifies explicitly set discharge pressure."""
        params = PumpBoundaryParameters(
            p_discharge_Pa=1.15e7,
            p_intake_Pa=1.5e6,
        )
        assert math.isclose(params.calculated_p_discharge_Pa, 1.15e7)
        assert math.isclose(params.delta_p_Pa, 1.0e7)

    def test_validation_errors(self):
        """Validates parameter sanity checks."""
        with pytest.raises(ValueError, match="Plunger diameter"):
            PumpBoundaryParameters(plunger_diameter_m=-0.05)
        with pytest.raises(ValueError, match="setting depth"):
            PumpBoundaryParameters(depth_m=0.0)
        with pytest.raises(ValueError, match="Fluid density"):
            PumpBoundaryParameters(rho_fluid_kg_m3=-100.0)
        with pytest.raises(ValueError, match="intake pressure"):
            PumpBoundaryParameters(p_intake_Pa=-500.0)
        with pytest.raises(ValueError, match="Friction force"):
            PumpBoundaryParameters(f_friction_N=-10.0)
        with pytest.raises(ValueError, match="Fluid pound"):
            PumpBoundaryParameters(gamma_pound=0.5)
        with pytest.raises(ValueError, match="fillage"):
            PumpBoundaryParameters(nominal_fillage=1.5)

    def test_serialization_roundtrip(self):
        """Verifies dictionary serialization and deserialization."""
        params1 = PumpBoundaryParameters(
            plunger_diameter_m=0.05715,  # 2.25 in
            depth_m=1200.0,
            rho_fluid_kg_m3=980.0,
            p_intake_Pa=8.0e5,
            f_friction_N=400.0,
            nominal_fillage=0.85,
        )
        d = params1.to_dict()
        params2 = PumpBoundaryParameters.from_dict(d)
        assert math.isclose(params1.plunger_diameter_m, params2.plunger_diameter_m)
        assert math.isclose(params1.depth_m, params2.depth_m)
        assert math.isclose(params1.rho_fluid_kg_m3, params2.rho_fluid_kg_m3)
        assert math.isclose(params1.p_intake_Pa, params2.p_intake_Pa)
        assert math.isclose(params1.nominal_fillage, params2.nominal_fillage)


class TestPlungerBoundaryDynamics:
    """Tests dynamic load calculation across valve states."""

    def test_upstroke_fluid_lift_force(self):
        """On upstroke (v_plunger >= 0), Traveling Valve closes and lifts full fluid column."""
        boundary = PlungerBoundary()
        f_load, state = boundary.compute_plunger_force(
            v_plunger=0.75,
            u_plunger=1.2,
            stroke_length=2.54,
            theta_deg=90.0,
            fillage=1.0,
        )
        assert state == ValveState.UPSTROKE_LIFTING.value
        expected_load = boundary.f_fluid + boundary.params.f_friction_N
        assert math.isclose(f_load, expected_load, rel_tol=1e-5)
        assert 14000.0 <= f_load <= 17000.0

    def test_downstroke_flowing_release(self):
        """On downstroke with 100% fillage, Traveling Valve opens with minimal mechanical drag."""
        boundary = PlungerBoundary()
        f_load, state = boundary.compute_plunger_force(
            v_plunger=-0.75,
            u_plunger=1.5,
            stroke_length=2.54,
            theta_deg=270.0,
            fillage=1.0,
        )
        assert state == ValveState.DOWNSTROKE_FLOWING.value
        expected_load = -boundary.params.f_buoyancy_N - boundary.params.f_friction_N
        assert math.isclose(f_load, expected_load, rel_tol=1e-5)
        assert f_load <= 0.0

    def test_fluid_pound_onset_at_intermediate_fillage(self):
        """Validates fluid pound impact when downstroke travel exceeds fillage fraction."""
        boundary = PlungerBoundary()
        stroke_length = 2.54
        fillage = 0.70  # 70% fillage

        # At top of stroke: travel = 0% -> DOWNSTROKE_FLOWING
        f_top, state_top = boundary.compute_plunger_force(
            v_plunger=-0.5,
            u_plunger=2.50,
            stroke_length=stroke_length,
            fillage=fillage,
        )
        assert state_top == ValveState.DOWNSTROKE_FLOWING.value

        # At 50% travel (u = 1.27m): 50% < 70% -> DOWNSTROKE_FLOWING
        f_mid, state_mid = boundary.compute_plunger_force(
            v_plunger=-0.5,
            u_plunger=1.27,
            stroke_length=stroke_length,
            fillage=fillage,
        )
        assert state_mid == ValveState.DOWNSTROKE_FLOWING.value

        # At 80% travel (u = 0.50m): 80% > 70% -> FLUID_POUND impact
        f_pound, state_pound = boundary.compute_plunger_force(
            v_plunger=-0.5,
            u_plunger=0.50,
            stroke_length=stroke_length,
            fillage=fillage,
        )
        assert state_pound == ValveState.FLUID_POUND.value
        expected_pound = boundary.params.gamma_pound * boundary.f_fluid
        assert math.isclose(f_pound, expected_pound, rel_tol=1e-5)
        assert f_pound > boundary.f_fluid

    def test_smooth_transition_mode(self):
        """Tests smooth non-chattering tanh transition blending."""
        boundary = PlungerBoundary()
        # Near zero positive velocity
        f_smooth_up, _ = boundary.compute_plunger_force(
            v_plunger=1e-5,
            u_plunger=1.0,
            stroke_length=2.54,
            smooth=True,
            v_smooth_threshold=1e-3,
        )
        # Near zero negative velocity
        f_smooth_down, _ = boundary.compute_plunger_force(
            v_plunger=-1e-5,
            u_plunger=1.0,
            stroke_length=2.54,
            smooth=True,
            v_smooth_threshold=1e-3,
        )
        # Both forces should be finite and blended smoothly
        assert np.isfinite(f_smooth_up)
        assert np.isfinite(f_smooth_down)

    def test_update_fluid_properties(self):
        """Tests dynamic update of fluid density and intake pressure."""
        boundary = PlungerBoundary()
        f_fluid_orig = boundary.f_fluid

        # Update fluid density to heavier water-cut mixture (1000 kg/m^3)
        boundary.update_fluid_properties(rho_mix_kg_m3=1000.0)
        assert boundary.params.rho_fluid_kg_m3 == 1000.0
        assert boundary.f_fluid > f_fluid_orig

        with pytest.raises(ValueError, match="positive"):
            boundary.update_fluid_properties(rho_mix_kg_m3=-500.0)
