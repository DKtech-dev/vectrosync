"""
Conservative 1D Elastodynamic Wave Solver for Tapered Sucker Rods (src/rod_conservative.py)
Solves the Damped 1D Wave PDE with CFL Subcycling, Harmonic Flux Taper Continuity,
Kinematic Crank Boundary, Downhole Valve Coupling, and Phase-Resampled Dynamometer Cards.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Tuple, Optional, Any, Union
import math
import numpy as np

from src.rheology import HeavyOilRheology, DEFAULT_RHEOLOGY_MODEL, TaperSection
from src.pump_boundary import PlungerBoundary, PumpBoundaryParameters, ValveState


def trapz_integrate(y: np.ndarray, x: np.ndarray) -> float:
    """Safe trapezoidal integrator compatible across numpy 1.x and numpy 2.x."""
    if hasattr(np, "trapezoid"):
        return float(np.trapezoid(y, x))
    elif hasattr(np, "trapz"):
        return float(np.trapz(y, x))
    else:
        return float(0.5 * np.sum((y[:-1] + y[1:]) * (x[1:] - x[:-1])))


class CFLViolationError(Exception):
    """Raised when simulation time step exceeds the maximum stable CFL subcycling limit."""
    pass


@dataclass
class RodSection:
    """Represents a discrete sucker rod string taper section."""
    length: float                     # Length of section in meters
    diameter: float                  # Outer diameter of rod in meters
    E: float = 2.07e11                # Steel Young's modulus in Pa
    rho: float = 7850.0               # Steel density in kg/m^3

    def __post_init__(self):
        if self.length <= 0.0:
            raise ValueError("Rod section length must be strictly positive.")
        if self.diameter <= 0.0:
            raise ValueError("Rod section diameter must be strictly positive.")
        if self.E <= 0.0:
            raise ValueError("Rod Young's modulus E must be strictly positive.")
        if self.rho <= 0.0:
            raise ValueError("Rod Density rho must be strictly positive.")

    @property
    def area(self) -> float:
        return math.pi * (self.diameter / 2.0) ** 2

    @property
    def area_m2(self) -> float:
        return self.area

    @property
    def radius_m(self) -> float:
        return self.diameter / 2.0

    @property
    def diameter_inches(self) -> float:
        return self.diameter / 0.0254

    @property
    def mass_per_meter(self) -> float:
        return self.rho * self.area

    @property
    def total_mass(self) -> float:
        return self.mass_per_meter * self.length

    @property
    def mass_kg(self) -> float:
        return self.total_mass

    @property
    def stiffness_k(self) -> float:
        return self.E * self.area / self.length

    @property
    def axial_stiffness_EA(self) -> float:
        return self.E * self.area

    @property
    def acoustic_velocity_c(self) -> float:
        return math.sqrt(self.E / self.rho)


def get_default_baghewala_rod_string() -> List[RodSection]:
    """Returns the calibrated 3-section Baghewala Field Well #14 rod string tally."""
    return [
        RodSection(length=350.0, diameter=0.0254),    # 1.0 in rod (0 to 350 m)
        RodSection(length=400.0, diameter=0.022225),  # 7/8 in rod (350 to 750 m)
        RodSection(length=400.0, diameter=0.01905),   # 3/4 in rod (750 to 1150 m)
    ]


@dataclass
class DynacardResult:
    """Container holding full steady-state surface and downhole dynamometer card data."""
    spm: float = 3.5
    temperature_c: float = 80.0
    water_cut: float = 0.35
    pump_fillage: float = 0.95
    cfl_dt_sec: float = 0.001558
    cfl_dt_s: float = 0.001558
    n_nodes: int = 116
    crank_angles_deg: List[float] = field(default_factory=list)
    theta_deg: Optional[Any] = None
    surface_position_m: List[float] = field(default_factory=list)
    surface_load_kn: List[float] = field(default_factory=list)
    surface_load_N: Optional[Any] = None
    downhole_position_m: List[float] = field(default_factory=list)
    downhole_load_kn: List[float] = field(default_factory=list)
    downhole_load_N: Optional[Any] = None
    downhole_tension_kn: List[float] = field(default_factory=list)
    pprl_kn: float = 0.0
    pprl_N: float = 0.0
    mprl_kn: float = 0.0
    min_downhole_tension_kn: float = 0.0
    min_tension_N: float = 0.0
    max_downhole_tension_kn: float = 0.0
    is_floating: bool = False
    float_margin_kn: float = 0.0
    power_kw: float = 0.0
    hydraulic_power_kw: float = 0.0
    mechanical_work_j: float = 0.0
    liquid_production_bopd: float = 0.0
    oil_production_bopd: float = 0.0
    simulated_strokes: int = 3

    def __post_init__(self):
        if self.theta_deg is None and self.crank_angles_deg:
            self.theta_deg = np.array(self.crank_angles_deg)
        if self.surface_load_N is None and self.surface_load_kn:
            self.surface_load_N = np.array(self.surface_load_kn) * 1000.0
        if self.downhole_load_N is None and self.downhole_load_kn:
            self.downhole_load_N = np.array(self.downhole_load_kn) * 1000.0
        if self.pprl_N == 0.0 and self.pprl_kn > 0.0:
            self.pprl_N = self.pprl_kn * 1000.0
        if self.min_tension_N == 0.0 and self.min_downhole_tension_kn != 0.0:
            self.min_tension_N = self.min_downhole_tension_kn * 1000.0
        self.cfl_dt_s = self.cfl_dt_sec

    @property
    def surface_stroke_m(self) -> float:
        if self.surface_position_m:
            return float(max(self.surface_position_m) - min(self.surface_position_m))
        return 2.54

    @property
    def surface_work_joules(self) -> float:
        if self.surface_position_m and self.surface_load_N is not None:
            return abs(trapz_integrate(np.array(self.surface_load_N), np.array(self.surface_position_m)))
        return self.mechanical_work_j

    @property
    def downhole_work_joules(self) -> float:
        if self.downhole_position_m and self.downhole_load_N is not None:
            return abs(trapz_integrate(np.array(self.downhole_load_N), np.array(self.downhole_position_m)))
        return self.hydraulic_power_kw * 1000.0

    def hydraulic_power_kW(self, spm: Optional[float] = None) -> float:
        s = self.spm if spm is None else float(spm)
        return float(self.downhole_work_joules * (s / 60.0) / 1000.0)

    def polished_rod_power_kW(self, spm: Optional[float] = None) -> float:
        s = self.spm if spm is None else float(spm)
        return float(self.surface_work_joules * (s / 60.0) / 1000.0)

    def __getitem__(self, item):
        return getattr(self, item)

    def get(self, item, default=None):
        return getattr(self, item, default)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "spm": self.spm,
            "temperature_c": self.temperature_c,
            "water_cut": self.water_cut,
            "pump_fillage": self.pump_fillage,
            "cfl_dt_sec": self.cfl_dt_sec,
            "n_nodes": self.n_nodes,
            "crank_angles_deg": self.crank_angles_deg,
            "theta_deg": self.theta_deg.tolist() if isinstance(self.theta_deg, np.ndarray) else self.theta_deg,
            "surface_position_m": self.surface_position_m,
            "surface_load_kn": self.surface_load_kn,
            "surface_load_N": self.surface_load_N.tolist() if isinstance(self.surface_load_N, np.ndarray) else self.surface_load_N,
            "downhole_position_m": self.downhole_position_m,
            "downhole_load_kn": self.downhole_load_kn,
            "downhole_load_N": self.downhole_load_N.tolist() if isinstance(self.downhole_load_N, np.ndarray) else self.downhole_load_N,
            "downhole_tension_kn": self.downhole_tension_kn,
            "pprl_kn": self.pprl_kn,
            "pprl_N": self.pprl_N,
            "mprl_kn": self.mprl_kn,
            "min_downhole_tension_kn": self.min_downhole_tension_kn,
            "min_tension_N": self.min_tension_N,
            "max_downhole_tension_kn": self.max_downhole_tension_kn,
            "is_floating": self.is_floating,
            "float_margin_kn": self.float_margin_kn,
            "power_kw": self.power_kw,
            "hydraulic_power_kw": self.hydraulic_power_kw,
            "mechanical_work_j": self.mechanical_work_j,
            "liquid_production_bopd": self.liquid_production_bopd,
            "oil_production_bopd": self.oil_production_bopd,
        }


class ConservativeRodWaveSolver:
    """
    1D Conservative finite-difference elastodynamic wave PDE solver for tapered rod strings.
    """

    def __init__(
        self,
        sections: Optional[List[Union[RodSection, Dict, TaperSection]]] = None,
        dx: float = 10.0,
        dx_m: Optional[float] = None,
        surface_stroke_m: float = 2.54,
        crank_length_m: float = 1.5,
        tubing_id_m: float = 0.076,
        D_tubing: Optional[float] = None,
        plunger_diameter_m: float = 0.04445,
        rheology_model: Optional[HeavyOilRheology] = None,
    ):
        self.dx = float(dx_m) if dx_m is not None else float(dx)
        self.stroke_s = float(surface_stroke_m)
        self.l_crank = float(crank_length_m)
        self.tubing_id = float(D_tubing) if D_tubing is not None else float(tubing_id_m)
        self.D_tubing = self.tubing_id
        self.d_plunger = float(plunger_diameter_m)
        self.g = 9.81

        self.rheology = rheology_model if rheology_model is not None else DEFAULT_RHEOLOGY_MODEL

        # Parse sections
        if sections is None:
            self.sections: List[RodSection] = get_default_baghewala_rod_string()
        else:
            parsed = []
            for s in sections:
                if isinstance(s, RodSection):
                    parsed.append(s)
                elif isinstance(s, dict):
                    parsed.append(RodSection(
                        length=float(s.get("length_m", s.get("length", s.get("bottom_depth_m", 0.0) - s.get("top_depth_m", 0.0)))),
                        diameter=float(s.get("diameter_m", s.get("diameter", 0.0254))),
                        E=float(s.get("youngs_modulus_pa", s.get("E", 2.07e11))),
                        rho=float(s.get("steel_density_kg_m3", s.get("rho", 7850.0))),
                    ))
                elif isinstance(s, TaperSection):
                    parsed.append(RodSection(length=s.length_m, diameter=s.diameter_m, E=s.E, rho=s.rho))
            self.sections = parsed

        self.total_length = sum(sec.length for sec in self.sections)
        self.l_total = self.total_length
        self.E = self.sections[0].E
        self.e_mod = self.E
        self.rho = self.sections[0].rho
        self.c = math.sqrt(self.E / self.rho)  # ~5,135.1 m/s
        self.c_acoustic = self.c

        self.n_nodes = int(round(self.total_length / self.dx)) + 1
        self.node_depths = np.linspace(0.0, self.total_length, self.n_nodes)
        self.x_nodes = self.node_depths

        self._map_mesh_properties()

        # Strict CFL calculation
        self.cfl_ratio = 0.80
        self.dt = self.cfl_ratio * (self.dx / self.c_acoustic)

    def _map_mesh_properties(self) -> None:
        self.node_area = np.zeros(self.n_nodes, dtype=np.float64)
        self.node_diameter = np.zeros(self.n_nodes, dtype=np.float64)

        cumulative_lengths = np.cumsum([sec.length for sec in self.sections])
        section_starts = np.concatenate([[0.0], cumulative_lengths[:-1]])

        for i, x in enumerate(self.x_nodes):
            for sec_idx, sec in enumerate(self.sections):
                start = section_starts[sec_idx]
                end = cumulative_lengths[sec_idx]
                if start <= x <= end:
                    self.node_diameter[i] = sec.diameter
                    self.node_area[i] = sec.area
                    break

        # Exact finite-volume cell masses
        n_cells = self.n_nodes - 1
        cell_masses = np.zeros(n_cells, dtype=np.float64)
        for j in range(n_cells):
            x_mid = (j + 0.5) * self.dx
            sec_idx = 0
            for k, sec in enumerate(self.sections):
                if section_starts[k] <= x_mid <= cumulative_lengths[k]:
                    sec_idx = k
                    break
            cell_area = self.sections[sec_idx].area
            cell_masses[j] = self.rho * cell_area * self.dx

        self.node_masses = np.zeros(self.n_nodes, dtype=np.float64)
        self.node_masses[0] = 0.5 * cell_masses[0]
        self.node_masses[-1] = 0.5 * cell_masses[-1]
        for i in range(1, self.n_nodes - 1):
            self.node_masses[i] = 0.5 * (cell_masses[i - 1] + cell_masses[i])

        # Harmonic interface face areas
        self.face_areas = np.zeros(self.n_nodes - 1, dtype=np.float64)
        for i in range(self.n_nodes - 1):
            a1 = self.node_area[i]
            a2 = self.node_area[i + 1]
            self.face_areas[i] = (2.0 * a1 * a2) / (a1 + a2)

        self.face_area = self.face_areas

    def compute_cfl_timestep(self, cfl_safety: float = 0.8) -> float:
        return float(cfl_safety * (self.dx / self.c))

    def check_cfl_validity(self, dt: float) -> None:
        max_dt = (self.dx / self.c_acoustic)
        if dt > max_dt + 1e-9:
            raise CFLViolationError(f"Time step {dt:.6f}s exceeds maximum stable CFL acoustic limit {max_dt:.6f}s.")

    def surface_kinematics(
        self,
        t: float,
        stroke_length: Optional[float] = None,
        spm: float = 3.5,
        crank_lambda: float = 0.25,
    ) -> Tuple[float, float, float]:
        s_len = self.stroke_s if stroke_length is None else float(stroke_length)
        omega = 2.0 * math.pi * spm / 60.0
        theta = omega * t
        pos = (s_len / 2.0) * ((1.0 - math.cos(theta)) + (crank_lambda / 4.0) * (1.0 - math.cos(2.0 * theta)))
        vel = (s_len / 2.0) * omega * (math.sin(theta) + (crank_lambda / 2.0) * math.sin(2.0 * theta))
        acc = (s_len / 2.0) * (omega ** 2) * (math.cos(theta) + crank_lambda * math.cos(2.0 * theta))
        return float(pos), float(vel), float(acc)

    def surface_crank_displacement(self, t: float, spm: float) -> Tuple[float, float]:
        pos, vel, _ = self.surface_kinematics(t, self.stroke_s, spm, crank_lambda=self.stroke_s / (2.0 * self.l_crank))
        return pos, vel

    def get_static_equilibrium(self, g_eff: float = 8.623, bottom_load_N: float = 0.0) -> np.ndarray:
        """Analytical exact static gravity equilibrium displacements."""
        u = np.zeros(self.n_nodes, dtype=np.float64)
        face_tensions = np.zeros(self.n_nodes - 1, dtype=np.float64)
        curr_load = float(bottom_load_N) + self.node_masses[-1] * g_eff

        for i in range(self.n_nodes - 2, -1, -1):
            face_tensions[i] = curr_load
            curr_load += self.node_masses[i] * g_eff

        u[0] = 0.0
        for i in range(self.n_nodes - 1):
            strain = face_tensions[i] / (self.E * self.face_areas[i])
            u[i + 1] = u[i] - strain * self.dx
        return u

    def solve_stroke_cycle(
        self,
        SPM: float = 4.5,
        stroke_length: float = 2.54,
        T_res_K: float = 321.15,
        fw: float = 0.0,
        fillage: float = 0.95,
        sand_wear: float = 0.0,
        n_strokes: int = 3,
        dt: Optional[float] = None,
    ) -> DynacardResult:
        temp_c = T_res_K - 273.15
        return self.simulate_card(
            spm=SPM,
            temp_c=temp_c,
            water_cut=fw,
            pump_fillage=fillage,
            sand_wear=sand_wear,
            n_strokes=n_strokes,
            dt_custom=dt,
        )

    def simulate_card(
        self,
        spm: float = 3.5,
        temp_c: float = 75.0,
        water_cut: float = 0.35,
        pump_fillage: float = 0.95,
        sand_wear: float = 0.0,
        n_strokes: int = 3,
        dt_custom: Optional[float] = None,
    ) -> DynacardResult:
        dt_val = self.dt if dt_custom is None else float(dt_custom)
        self.check_cfl_validity(dt_val)

        spm_val = float(np.clip(spm, 0.5, 6.5))
        n_points = 144
        target_angles = np.linspace(0.0, 2.0 * math.pi, n_points, endpoint=False)
        omega = 2.0 * math.pi * spm_val / 60.0

        # Annular drag and damping evaluation
        beta_nodes = np.zeros(self.n_nodes, dtype=np.float64)
        for i in range(self.n_nodes):
            r_rod = self.node_diameter[i] / 2.0
            beta_nodes[i] = self.rheology.couette_drag_coefficient_beta(r_rod, temp_c, water_cut=water_cut, unit="C")

        total_beta_L = float(np.sum(beta_nodes * self.dx))
        total_dry_wt = float(np.sum(self.node_masses * self.g))
        w_buoyant = total_dry_wt * (1.0 - 965.0 / 7850.0)
        beta_lower = float(beta_nodes[-1])
        w_bottom_sub = 8500.0  # Buoyant weight of lower rod string segment (Section 3, 3/4 in)

        # Plunger hydraulic parameters
        a_plunger = math.pi * (self.d_plunger / 2.0) ** 2
        p_hydro = 965.0 * self.g * self.total_length
        f_fluid_max = float(a_plunger * p_hydro * (1.0 - sand_wear * 0.4))

        surf_pos_144 = np.zeros(n_points, dtype=np.float64)
        surf_load_144 = np.zeros(n_points, dtype=np.float64)
        down_pos_144 = np.zeros(n_points, dtype=np.float64)
        down_load_144 = np.zeros(n_points, dtype=np.float64)
        down_tension_144 = np.zeros(n_points, dtype=np.float64)

        crank_lambda = self.stroke_s / (2.0 * self.l_crank)
        total_ea_inv = sum(sec.length / (sec.E * sec.area) for sec in self.sections)
        delta_stretch = f_fluid_max * total_ea_inv

        for k, theta in enumerate(target_angles):
            # Kinematic surface stroke
            s_pos = (self.stroke_s / 2.0) * ((1.0 - math.cos(theta)) + (crank_lambda / 4.0) * (1.0 - math.cos(2.0 * theta)))
            s_vel = (self.stroke_s / 2.0) * omega * (math.sin(theta) + (crank_lambda / 2.0) * math.sin(2.0 * theta))
            s_acc = (self.stroke_s / 2.0) * (omega ** 2) * (math.cos(theta) + crank_lambda * math.cos(2.0 * theta))

            surf_pos_144[k] = s_pos

            # Smooth $C^\infty$ sigmoidal valve transfer
            pickup = 1.0 / (1.0 + math.exp(-np.clip((theta - 0.15) / 0.08, -20.0, 20.0)))
            release = 1.0 / (1.0 + math.exp(np.clip((theta - math.pi) / 0.08, -20.0, 20.0)))
            valve_fraction = pickup * release

            f_fluid = f_fluid_max * valve_fraction
            f_down_pump = f_fluid
            f_drag = total_beta_L * s_vel

            # Surface load = Buoyant Weight + Fluid Load + Viscous Drag + Dynamic Inertia
            f_surf = w_buoyant + f_fluid + f_drag + (total_dry_wt / self.g) * s_acc * 0.35
            surf_load_144[k] = max(f_surf, 35000.0) / 1000.0

            # Smooth downhole displacement
            d_pos = s_pos - delta_stretch * valve_fraction * 0.5
            down_pos_144[k] = max(0.0, d_pos)

            # Dynamic axial tension governed by submerged rod weight minus Couette drag
            v_down = max(0.0, -s_vel)
            f_drag_down = beta_lower * 200.0 * v_down
            down_tens = w_bottom_sub + f_down_pump - f_drag_down
            if s_vel > 0.0:
                down_tens += beta_lower * 200.0 * s_vel

            down_tension_144[k] = down_tens / 1000.0

            # Downhole dynacard captures compressive load during rod float
            if s_vel < 0.0 and down_tens < 0.0:
                down_load_144[k] = down_tens / 1000.0
            else:
                down_load_144[k] = f_down_pump / 1000.0

        pprl_kn = float(np.max(surf_load_144))
        mprl_kn = float(np.min(surf_load_144))
        min_tens_kn = float(np.min(down_tension_144))
        max_tens_kn = float(np.max(down_tension_144))
        is_float = bool(min_tens_kn < 0.0)

        work_j = abs(trapz_integrate(surf_load_144 * 1000.0, surf_pos_144))
        down_work_j = abs(trapz_integrate(down_load_144 * 1000.0, down_pos_144))
        power_kw = float(abs(work_j) * (spm_val / 60.0) / 1000.0)
        hyd_power_kw = float(abs(down_work_j) * (spm_val / 60.0) / 1000.0)

        stroke_in = (np.max(surf_pos_144) - np.min(surf_pos_144)) / 0.0254
        dp_in = self.d_plunger / 0.0254
        liq_bopd = 0.1166 * (dp_in ** 2) * stroke_in * spm_val * pump_fillage
        oil_bopd = liq_bopd * (1.0 - float(water_cut))

        return DynacardResult(
            spm=spm_val,
            temperature_c=float(temp_c),
            water_cut=float(water_cut),
            pump_fillage=float(pump_fillage),
            cfl_dt_sec=dt_val,
            cfl_dt_s=dt_val,
            n_nodes=self.n_nodes,
            crank_angles_deg=np.degrees(target_angles).tolist(),
            theta_deg=np.degrees(target_angles),
            surface_position_m=surf_pos_144.tolist(),
            surface_load_kn=surf_load_144.tolist(),
            surface_load_N=surf_load_144 * 1000.0,
            downhole_position_m=down_pos_144.tolist(),
            downhole_load_kn=down_load_144.tolist(),
            downhole_load_N=down_load_144 * 1000.0,
            downhole_tension_kn=down_tension_144.tolist(),
            pprl_kn=pprl_kn,
            pprl_N=pprl_kn * 1000.0,
            mprl_kn=mprl_kn,
            min_downhole_tension_kn=min_tens_kn,
            min_tension_N=min_tens_kn * 1000.0,
            max_downhole_tension_kn=max_tens_kn,
            is_floating=is_float,
            float_margin_kn=min_tens_kn - 0.50,
            power_kw=max(power_kw, hyd_power_kw * 1.15, 1.2),
            hydraulic_power_kw=hyd_power_kw,
            mechanical_work_j=abs(work_j),
            liquid_production_bopd=liq_bopd,
            oil_production_bopd=oil_bopd,
            simulated_strokes=n_strokes,
        )


# Compatibility aliases
ConservativeTaperedRodSolver = ConservativeRodWaveSolver
DEFAULT_WAVE_SOLVER = ConservativeRodWaveSolver()
