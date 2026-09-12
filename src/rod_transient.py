"""
Transient tapered sucker-rod elastodynamic wave solver (src/rod_transient.py).

Implements the conservative variable-area damped hyperbolic wave PDE:
    rho * A(x) * u_tt + beta(x, t) * u_t - d/dx [ E * A(x) * u_x ] = -rho * A(x) * g_eff + f_external

Where:
- u(x, t) is displacement measured in the UPWARD stroke direction (m).
- x in [0, L] is depth downward from polished rod (m).
- Strain is epsilon = -du/dx = (u_i - u_{i+1}) / dx (positive in tension).
- Axial force flux is N_{i+1/2} = E * A_{i+1/2} * (u_i - u_{i+1}) / dx (N).
- Harmonic interface area A_{i+1/2} = 2*A_i*A_{i+1} / (A_i + A_{i+1}) provides
  discrete numerical interface flux balance and force continuity across rod taper section boundaries.
  (Physical elastodynamic impedance reflection remains governed by cross-sectional area ratios).
- Dual-Mesh Policy:
  * Class Default Mesh: dx = 10.0 m yields N = 116 nodes (round(1150/10) + 1 = 116) with ~8,194
    CFL-safe subcycles per stroke at 4.7 SPM for high-resolution offline simulation.
  * Live Web API Mesh: dx = 15.0 m yields N = 78 nodes in backend/server.py for sub-50ms HTTP response.
- Explicit CFL-safe subcycling: dt <= 0.8 * dx / c (c = sqrt(E/rho) ~ 5,135 m/s).
- Kinematic surface crank Dirichlet boundary at x = 0: u(0, t) = s(t).
- Coupled downhole pump force boundary at x = L coupled to PlungerBoundary.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Tuple, Optional, Any, Union
import math
import time
import numpy as np

from src.rheology import HeavyOilRheology, DEFAULT_RHEOLOGY_MODEL, TaperSection
from src.pump_boundary import PlungerBoundary, PumpBoundaryParameters, ValveState
from src.rod_conservative import RodSection, DynacardResult, CFLViolationError, trapz_integrate, get_default_baghewala_rod_string


class TransientRodWaveSolver:
    """
    Full transient time-marching elastodynamic wave solver for tapered sucker rod strings.
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
        pump_boundary: Optional[PlungerBoundary] = None,
    ):
        self.dx = float(dx_m) if dx_m is not None else float(dx)
        self.stroke_s = float(surface_stroke_m)
        self.l_crank = float(crank_length_m)
        self.tubing_id = float(D_tubing) if D_tubing is not None else float(tubing_id_m)
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
        self.E = self.sections[0].E
        self.rho = self.sections[0].rho
        self.c_acoustic = math.sqrt(self.E / self.rho)  # ~5,135.1 m/s

        self.n_nodes = int(round(self.total_length / self.dx)) + 1
        self.node_depths = np.linspace(0.0, self.total_length, self.n_nodes)
        self.x_nodes = self.node_depths

        self._build_mesh()

        # Strict CFL calculation
        self.cfl_ratio = 0.80
        self.dt = self.cfl_ratio * (self.dx / self.c_acoustic)

        # Downhole plunger boundary model
        if pump_boundary is not None:
            self.pump_boundary = pump_boundary
        else:
            self.pump_boundary = PlungerBoundary(
                PumpBoundaryParameters(
                    plunger_diameter_m=self.d_plunger,
                    depth_m=self.total_length,
                )
            )

    def _build_mesh(self) -> None:
        """Discretizes the tapered rod string onto node cells and faces with harmonic area weighting."""
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

        # Finite-volume cell masses
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

        # Harmonic interface face areas: exact continuity of stress and displacement across diameter jumps
        self.face_areas = np.zeros(self.n_nodes - 1, dtype=np.float64)
        for i in range(self.n_nodes - 1):
            a1 = self.node_area[i]
            a2 = self.node_area[i + 1]
            self.face_areas[i] = (2.0 * a1 * a2) / (a1 + a2)

    def compute_cfl_timestep(self, cfl_safety: float = 0.8) -> float:
        """Returns the maximum stable CFL time step for the grid."""
        return float(cfl_safety * (self.dx / self.c_acoustic))

    def check_cfl_validity(self, dt: float) -> None:
        """Raises CFLViolationError if dt exceeds acoustic CFL stability limit."""
        max_dt = self.dx / self.c_acoustic
        if dt > max_dt + 1e-9:
            raise CFLViolationError(
                f"Time step {dt:.6f}s exceeds maximum stable CFL acoustic limit {max_dt:.6f}s (dx={self.dx}m, c={self.c_acoustic:.1f}m/s)."
            )

    def surface_kinematics(self, t: float, spm: float) -> Tuple[float, float, float]:
        """Calculates polished rod kinematic upward position, velocity, and acceleration at time t."""
        omega = 2.0 * math.pi * spm / 60.0
        theta = omega * t
        crank_lambda = self.stroke_s / (2.0 * self.l_crank)

        pos = (self.stroke_s / 2.0) * ((1.0 - math.cos(theta)) + (crank_lambda / 4.0) * (1.0 - math.cos(2.0 * theta)))
        vel = (self.stroke_s / 2.0) * omega * (math.sin(theta) + (crank_lambda / 2.0) * math.sin(2.0 * theta))
        acc = (self.stroke_s / 2.0) * (omega ** 2) * (math.cos(theta) + crank_lambda * math.cos(2.0 * theta))
        return float(pos), float(vel), float(acc)

    def get_static_equilibrium(self, g_eff: float = 8.623, bottom_load_N: float = 0.0) -> np.ndarray:
        """
        Computes analytical exact static gravity equilibrium upward displacements u(x) such that:
        u(0) = 0 and d/dx [ E A u_x ] = rho A g_eff.
        Tension N(x) = E A (u_i - u_{i+1}) / dx = weight below.
        Hence u(x) <= 0 (stretched downward from top).
        """
        face_tensions = np.zeros(self.n_nodes - 1, dtype=np.float64)
        curr_load = float(bottom_load_N) + self.node_masses[-1] * g_eff

        for i in range(self.n_nodes - 2, -1, -1):
            face_tensions[i] = curr_load
            curr_load += self.node_masses[i] * g_eff

        u = np.zeros(self.n_nodes, dtype=np.float64)
        u[0] = 0.0
        for i in range(self.n_nodes - 1):
            # Tension N > 0 means u_i - u_{i+1} > 0 => u_{i+1} = u_i - N*dx/(E*A)
            strain = face_tensions[i] / (self.E * self.face_areas[i])
            u[i + 1] = u[i] - strain * self.dx
        return u

    def compute_mechanical_energy(self, u: np.ndarray, v: np.ndarray) -> Tuple[float, float, float]:
        """
        Computes total mechanical energy: Kinetic + Elastic Strain Energy.
        Used for T1 undamped energy conservation validation.
        """
        e_kin = 0.5 * float(np.sum(self.node_masses * (v ** 2)))
        strains = (u[:-1] - u[1:]) / self.dx
        e_strain = 0.5 * float(np.sum(self.E * self.face_areas * (strains ** 2) * self.dx))
        e_total = e_kin + e_strain
        return e_kin, e_strain, e_total

    def simulate_transient(
        self,
        spm: float = 3.5,
        temp_c: float = 75.0,
        water_cut: float = 0.35,
        pump_fillage: float = 0.95,
        sand_wear: float = 0.0,
        n_strokes: int = 3,
        dt_custom: Optional[float] = None,
    ) -> DynacardResult:
        """
        Time-marches the conservative wave PDE through n_strokes of the pumping cycle,
        resolving stress wave propagation, impedance reflections at tapers, and downhole pump dynamics.
        """
        dt_val = self.compute_cfl_timestep(0.80) if dt_custom is None else float(dt_custom)
        self.check_cfl_validity(dt_val)

        spm_val = float(np.clip(spm, 0.5, 6.5))
        period_s = 60.0 / spm_val
        t_total = n_strokes * period_s
        n_steps = int(math.ceil(t_total / dt_val))

        # Effective buoyancy in crude (~965 kg/m^3)
        rho_fluid = 965.0
        buoyancy_factor = max(0.1, 1.0 - (rho_fluid / self.rho))
        g_eff = self.g * buoyancy_factor

        # Distributed annular Couette damping beta per unit length (N*s/m^2)
        beta_nodes = np.zeros(self.n_nodes, dtype=np.float64)
        for i in range(self.n_nodes):
            r_rod = self.node_diameter[i] / 2.0
            beta_nodes[i] = self.rheology.couette_drag_coefficient_beta(
                r_rod, temp_c, water_cut=water_cut, unit="C"
            )

        # Initial conditions: start from exact static equilibrium at t=0 crank position
        u = self.get_static_equilibrium(g_eff=g_eff, bottom_load_N=0.0)
        v = np.zeros(self.n_nodes, dtype=np.float64)

        # Plunger hydraulic parameters
        a_plunger = math.pi * (self.d_plunger / 2.0) ** 2
        p_hydro = rho_fluid * self.g * self.total_length
        f_fluid_max = float(a_plunger * p_hydro * (1.0 - sand_wear * 0.4))

        start_step_last_stroke = int(math.floor((n_strokes - 1) * period_s / dt_val))
        sampled_times: List[float] = []
        sampled_surf_pos: List[float] = []
        sampled_surf_load: List[float] = []
        sampled_down_pos: List[float] = []
        sampled_down_load: List[float] = []
        sampled_down_tens: List[float] = []

        ea_over_dx = self.E * self.face_areas / self.dx
        inv_masses = 1.0 / self.node_masses

        for step in range(n_steps):
            t_curr = step * dt_val
            t_next = (step + 1) * dt_val

            # 1. Kinematic surface displacement at x=0
            s_pos_next, s_vel_next, s_acc_next = self.surface_kinematics(t_next, spm_val)

            # 2. Interface axial tensions: N_{i+1/2} = E * A_{i+1/2} * (u_i - u_{i+1}) / dx
            # Tension N > 0 when upper node is pulled up relative to lower node
            face_tensions = ea_over_dx * (u[:-1] - u[1:])

            # 3. Downhole plunger boundary force at x = L (node N-1)
            v_plunger = v[-1]
            u_plunger_rel = u[-1] - u[0]
            f_plunger, _ = self.pump_boundary.compute_plunger_force(
                v_plunger=v_plunger,
                u_plunger=u_plunger_rel,
                stroke_length=self.stroke_s,
                fillage=pump_fillage,
                smooth=True,
            )

            # 4. Net upward forces on nodes
            # On interior node i:
            # - Face above (i-1/2) pulls UPWARD: +face_tensions[i-1]
            # - Face below (i+1/2) pulls DOWNWARD: -face_tensions[i]
            # - Submerged gravity pulls DOWNWARD: -node_masses[i] * g_eff
            f_net = np.zeros(self.n_nodes, dtype=np.float64)
            f_net[1:-1] = face_tensions[:-1] - face_tensions[1:] - self.node_masses[1:-1] * g_eff

            # On bottom node N-1:
            # - Face above pulls UPWARD: +face_tensions[-1]
            # - Gravity pulls DOWNWARD: -node_masses[-1] * g_eff
            # - Plunger load pulls DOWNWARD during upstroke: -f_plunger
            f_net[-1] = face_tensions[-1] - self.node_masses[-1] * g_eff - f_plunger

            # 5. Velocity and position updates for free nodes (i = 1 .. N-1)
            damping_coeff = beta_nodes[1:] * self.dx
            gamma_dt_half = 0.5 * (damping_coeff * inv_masses[1:]) * dt_val
            accel = f_net[1:] * inv_masses[1:]

            v_new_free = (v[1:] * (1.0 - gamma_dt_half) + accel * dt_val) / (1.0 + gamma_dt_half)
            u_new_free = u[1:] + v_new_free * dt_val

            # Top boundary updates
            u[0] = s_pos_next
            v[0] = s_vel_next
            u[1:] = u_new_free
            v[1:] = v_new_free

            # Surface load at polished rod: top interface tension + top nodal weight and inertial reaction
            top_tension = face_tensions[0]
            f_surface = top_tension + self.node_masses[0] * (self.g + s_acc_next)
            down_tension = face_tensions[-1]

            # Record if in the final steady-state stroke
            if step >= start_step_last_stroke:
                sampled_times.append(t_next)
                sampled_surf_pos.append(float(s_pos_next))
                sampled_surf_load.append(float(f_surface))
                sampled_down_pos.append(float(u[-1] - u[-1] if not sampled_down_pos else u[-1]))
                sampled_down_load.append(float(f_plunger))
                sampled_down_tens.append(float(down_tension))

        # Adjust downhole position relative to its min/stroke
        min_dpos = min(sampled_down_pos)
        sampled_down_pos = [p - min_dpos for p in sampled_down_pos]

        # Resample onto 144 phase-uniform angles
        n_points = 144
        target_angles = np.linspace(0.0, 2.0 * math.pi, n_points, endpoint=False)
        t_final_stroke = np.array(sampled_times) - sampled_times[0]
        theta_stroke = (2.0 * math.pi * spm_val / 60.0) * t_final_stroke
        theta_mod = np.mod(theta_stroke, 2.0 * math.pi)

        sort_idx = np.argsort(theta_mod)
        theta_sorted = theta_mod[sort_idx]
        theta_extended = np.concatenate([theta_sorted - 2.0 * math.pi, theta_sorted, theta_sorted + 2.0 * math.pi])

        def interp_phase(arr):
            arr_sorted = np.array(arr)[sort_idx]
            arr_extended = np.concatenate([arr_sorted, arr_sorted, arr_sorted])
            return np.interp(target_angles, theta_extended, arr_extended)

        surf_pos_144 = interp_phase(sampled_surf_pos)
        surf_load_144 = interp_phase(sampled_surf_load) / 1000.0  # kN
        down_pos_144 = interp_phase(sampled_down_pos)
        down_load_144 = interp_phase(sampled_down_load) / 1000.0  # kN
        down_tens_144 = interp_phase(sampled_down_tens) / 1000.0  # kN

        pprl_kn = float(np.max(surf_load_144))
        mprl_kn = float(np.min(surf_load_144))
        min_tens_kn = float(np.min(down_tens_144))
        max_tens_kn = float(np.max(down_tens_144))
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
            downhole_tension_kn=down_tens_144.tolist(),
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

    def simulate_card(self, *args, **kwargs) -> DynacardResult:
        return self.simulate_transient(*args, **kwargs)

    def solve_stroke_cycle(self, *args, **kwargs) -> DynacardResult:
        return self.simulate_transient(*args, **kwargs)


DEFAULT_TRANSIENT_SOLVER = TransientRodWaveSolver()
