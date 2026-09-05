"""
Reduced-order downhole pump boundary and valve-state model.
Fluid-pound behavior is an illustrative load multiplier pending validation
against chamber pressure/volume and measured downhole cards.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, Tuple, Optional, Any
import math
import numpy as np


class ValveState(str, Enum):
    """Enumeration of downhole pump valve operational states."""
    UPSTROKE_LIFTING = "UPSTROKE_LIFTING"
    DOWNSTROKE_FLOWING = "DOWNSTROKE_FLOWING"
    FLUID_POUND = "FLUID_POUND"
    STATIONARY = "STATIONARY"
    TRAVELING_CLOSED = "TRAVELING_CLOSED"
    TRAVELING_OPEN = "TRAVELING_OPEN"
    REVERSAL = "REVERSAL"


@dataclass
class PumpBoundaryParameters:
    """
    Downhole sucker rod pump specifications and fluid head conditions.
    """
    plunger_diameter_m: float = 0.04445  # 1.75 in standard plunger
    depth_m: float = 1150.0              # Pump setting depth in meters
    rho_fluid_kg_m3: float = 950.0       # Average fluid column density
    p_intake_Pa: float = 5.0e5           # Pump intake pressure (5 bar)
    p_discharge_Pa: Optional[float] = None
    f_friction_N: float = 300.0          # Plunger-barrel mechanical friction
    gamma_pound: float = 1.8             # Fluid pound peak shock multiplier
    nominal_fillage: float = 0.95        # Nominal pump chamber fillage fraction
    gravity_m_s2: float = 9.81           # Gravitational acceleration

    def __post_init__(self):
        if self.plunger_diameter_m <= 0.0:
            raise ValueError("Plunger diameter must be strictly positive.")
        if self.depth_m <= 0.0:
            raise ValueError("Pump setting depth must be strictly positive.")
        if self.rho_fluid_kg_m3 <= 0.0:
            raise ValueError("Fluid density must be strictly positive.")
        if self.p_intake_Pa < 0.0:
            raise ValueError("Pump intake pressure cannot be negative.")
        if self.f_friction_N < 0.0:
            raise ValueError("Friction force cannot be negative.")
        if self.gamma_pound < 1.0:
            raise ValueError("Fluid pound multiplier must be >= 1.0.")
        if not (0.0 < self.nominal_fillage <= 1.0):
            raise ValueError("Pump nominal fillage must be in (0, 1].")

    @property
    def plunger_area_m2(self) -> float:
        return math.pi * (self.plunger_diameter_m / 2.0) ** 2

    @property
    def diameter_inches(self) -> float:
        return self.plunger_diameter_m / 0.0254

    @property
    def calculated_p_discharge_Pa(self) -> float:
        if self.p_discharge_Pa is not None:
            return self.p_discharge_Pa
        return self.rho_fluid_kg_m3 * self.gravity_m_s2 * self.depth_m

    @property
    def delta_p_Pa(self) -> float:
        return self.calculated_p_discharge_Pa - self.p_intake_Pa

    @property
    def nominal_fluid_load_N(self) -> float:
        return self.plunger_area_m2 * self.delta_p_Pa

    @property
    def f_buoyancy_N(self) -> float:
        # Approximate buoyant volume of standard 1.8m steel plunger
        vol_plunger = self.plunger_area_m2 * 1.8
        return self.rho_fluid_kg_m3 * self.gravity_m_s2 * vol_plunger

    def to_dict(self) -> Dict[str, Any]:
        return {
            "plunger_diameter_m": self.plunger_diameter_m,
            "depth_m": self.depth_m,
            "rho_fluid_kg_m3": self.rho_fluid_kg_m3,
            "p_intake_Pa": self.p_intake_Pa,
            "p_discharge_Pa": self.p_discharge_Pa,
            "f_friction_N": self.f_friction_N,
            "gamma_pound": self.gamma_pound,
            "nominal_fillage": self.nominal_fillage,
            "gravity_m_s2": self.gravity_m_s2,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "PumpBoundaryParameters":
        return cls(**data)


# Compatibility alias
PumpParameters = PumpBoundaryParameters


class PlungerBoundary:
    """
    Simulates dynamic boundary forces at downhole sucker rod pump (x = L).
    """

    def __init__(
        self,
        params: Optional[PumpBoundaryParameters] = None,
        plunger_diameter_m: float = 0.04445,
        pump_depth_m: float = 1150.0,
        pump_fillage: float = 0.95,
        sand_wear_factor: float = 0.0,
    ):
        if params is not None:
            self.params = params
        else:
            self.params = PumpBoundaryParameters(
                plunger_diameter_m=plunger_diameter_m,
                depth_m=pump_depth_m,
                nominal_fillage=pump_fillage,
            )
        self.sand_wear = float(np.clip(sand_wear_factor, 0.0, 1.0))
        self.current_state = ValveState.STATIONARY

    @property
    def f_fluid(self) -> float:
        return self.params.nominal_fluid_load_N

    def update_fluid_properties(
        self,
        rho_mix_kg_m3: Optional[float] = None,
        p_intake_Pa: Optional[float] = None,
    ) -> None:
        """Dynamically updates fluid density and intake pressure."""
        if rho_mix_kg_m3 is not None:
            if rho_mix_kg_m3 <= 0.0:
                raise ValueError("Fluid density must be positive.")
            self.params.rho_fluid_kg_m3 = float(rho_mix_kg_m3)
        if p_intake_Pa is not None:
            if p_intake_Pa < 0.0:
                raise ValueError("Intake pressure cannot be negative.")
            self.params.p_intake_Pa = float(p_intake_Pa)

    def compute_plunger_force(
        self,
        v_plunger: float,
        u_plunger: float,
        stroke_length: float,
        theta_deg: float = 0.0,
        fillage: Optional[float] = None,
        smooth: bool = False,
        v_smooth_threshold: float = 1e-3,
    ) -> Tuple[float, str]:
        """
        Calculates downhole plunger boundary force.
        Positive = tensile load on bottom rod, Negative = compressive load.
        """
        effective_fillage = self.params.nominal_fillage if fillage is None else float(fillage)
        f_wear_drag = 1000.0 * self.sand_wear

        # Handle smooth tanh blending across zero velocity
        if smooth and abs(v_plunger) < v_smooth_threshold:
            s_factor = math.tanh(v_plunger / max(v_smooth_threshold, 1e-6))
            f_up = self.f_fluid + self.params.f_friction_N + f_wear_drag
            f_down = -self.params.f_buoyancy_N - self.params.f_friction_N - f_wear_drag
            f_blended = 0.5 * (f_up + f_down) + 0.5 * (f_up - f_down) * s_factor
            state = ValveState.UPSTROKE_LIFTING.value if v_plunger >= 0.0 else ValveState.DOWNSTROKE_FLOWING.value
            return float(f_blended), state

        if v_plunger >= 0.0:
            # UPSTROKE: Traveling Valve CLOSED -> Lifts full fluid column
            self.current_state = ValveState.UPSTROKE_LIFTING
            f_load = self.f_fluid + self.params.f_friction_N + f_wear_drag
            return float(f_load), self.current_state.value

        else:
            # DOWNSTROKE: Traveling Valve OPEN
            # Calculate fraction of stroke traveled downward from top (u = stroke_length)
            travel_fraction = (stroke_length - u_plunger) / max(stroke_length, 1e-3)
            travel_fraction = np.clip(travel_fraction, 0.0, 1.0)

            if travel_fraction > effective_fillage:
                # Plunger hits fluid level -> FLUID POUND impact shock
                self.current_state = ValveState.FLUID_POUND
                f_pound = self.params.gamma_pound * self.f_fluid + f_wear_drag
                return float(f_pound), self.current_state.value
            else:
                # Traveling valve freely bypasses fluid
                self.current_state = ValveState.DOWNSTROKE_FLOWING
                f_down = -self.params.f_buoyancy_N - self.params.f_friction_N - f_wear_drag
                return float(f_down), self.current_state.value

    def evaluate_boundary_force(
        self,
        u_current: float,
        u_prev: float,
        dt: float,
        u_stroke_min: float,
        u_stroke_max: float,
    ) -> Tuple[float, str]:
        """Boundary force evaluation for conservative wave PDE time-stepping."""
        v_plunger = (u_current - u_prev) / max(dt, 1e-6)
        stroke_span = max(u_stroke_max - u_stroke_min, 0.1)
        rel_u = u_current - u_stroke_min
        return self.compute_plunger_force(
            v_plunger=v_plunger,
            u_plunger=rel_u,
            stroke_length=stroke_span,
        )


# Compatibility alias
DownholePumpBoundary = PlungerBoundary
