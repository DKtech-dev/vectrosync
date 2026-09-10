"""
Constraint-aware reduced-order pump-speed governor.

The fast horizon model is an explicitly identified engineering surrogate. It is
useful for deterministic what-if demonstrations, but it is not a certified MPC,
a safety instrumented function, or a substitute for an independently validated
rod-string model. Every result reports feasibility and constraint residuals.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Tuple, Optional, Any, Union
import math
import time
import numpy as np

from src.thermal import ThermalDecayEngine, DEFAULT_THERMAL_ENGINE
from src.rheology import HeavyOilRheology, DEFAULT_RHEOLOGY_MODEL
from src.rod_conservative import ConservativeRodWaveSolver, DEFAULT_WAVE_SOLVER, DynacardResult
from src.failsafe import FailsafeStateMachine, FailsafeLevel, DEFAULT_FAILSAFE
from src.mpc import ConstrainedMPC, DEFAULT_CONSTRAINED_MPC


@dataclass
class MPCConfig:
    """Configuration weights and physical constraints for Fast-Loop MPC."""
    horizon_steps: int = 24           # 24 steps over 12 hours (dt = 0.5 hr)
    dt_hours: float = 0.5             # Step duration in hours
    w_prod: float = 1.0               # Production maximization weight
    w_power: float = 0.15             # Mechanical power penalty weight
    w_du: float = 0.5                 # SPM slew / rate-of-change penalty weight
    w_slack: float = 1000.0           # Slack variable penalty for hard tension constraint
    min_tension_kN: float = 0.50      # Minimum downhole positive tension floor (Anti-Float)
    max_pprl_kN: float = 99.0         # 90% of 110.0 kN rod string / surface unit working rating
    min_spm: float = 1.0              # Kinematic minimum pump speed
    max_spm: float = 5.5              # Kinematic maximum pump speed
    max_delta_spm: float = 0.50       # Maximum allowable SPM ramp per hour
    solver_mode: str = "surrogate"    # "optimization" (real SLSQP MPC) or "surrogate" (fast analytical)
    robust_z: float = 1.282           # 90% confidence uncertainty-tightening factor
    sigma_min_tension_kN: float = 0.10 # Downhole load model uncertainty std dev (kN)
    sigma_pprl_kN: float = 1.50       # Surface load model uncertainty std dev (kN)


@dataclass
class WellState:
    """Current operational state vector for the well."""
    spm_current: float = 4.5
    temperature_C: float = 80.0
    viscosity_Pas: Optional[float] = None
    water_cut: float = 0.35
    current_spm: Optional[float] = None
    pump_fillage: float = 0.95
    sand_wear: float = 0.0

    def __post_init__(self):
        if self.current_spm is not None:
            self.spm_current = self.current_spm
        else:
            self.current_spm = self.spm_current


@dataclass
class MPCResult:
    """Optimized control action and predicted state trajectory from MPC."""
    optimal_spm: float
    spm_trajectory: List[float]
    predicted_min_tension_kN: List[float]
    predicted_pprl_kN: List[float]
    solver_status: str = "UNSOLVED"
    solve_time_ms: float = 0.0
    predicted_min_tension_kn: Optional[float] = None
    predicted_pprl_kn: Optional[float] = None
    predicted_oil_bopd: Optional[float] = None
    is_anti_float_satisfied: bool = True
    cost: float = 0.0
    status: str = "UNSOLVED"
    details: Optional[Dict[str, Any]] = None

    def __post_init__(self):
        if self.predicted_min_tension_kn is None and self.predicted_min_tension_kN:
            self.predicted_min_tension_kn = float(min(self.predicted_min_tension_kN))
        if self.predicted_pprl_kn is None and self.predicted_pprl_kN:
            self.predicted_pprl_kn = float(max(self.predicted_pprl_kN))
        self.status = self.solver_status

    def __getitem__(self, item):
        return getattr(self, item)

    def get(self, item, default=None):
        return getattr(self, item, default)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "optimal_spm": self.optimal_spm,
            "spm_trajectory": self.spm_trajectory,
            "predicted_min_tension_kN": self.predicted_min_tension_kN,
            "predicted_pprl_kN": self.predicted_pprl_kN,
            "solver_status": self.solver_status,
            "solve_time_ms": self.solve_time_ms,
            "is_anti_float_satisfied": self.is_anti_float_satisfied,
            "details": self.details,
        }


class FastMPCController:
    """
    Constrained Model Predictive Controller balancing fluid extraction against rod floating risk.
    """

    def __init__(
        self,
        config: Optional[MPCConfig] = None,
        thermal_engine: Optional[ThermalDecayEngine] = None,
        rheology_engine: Optional[HeavyOilRheology] = None,
        wave_solver: Optional[ConservativeRodWaveSolver] = None,
        failsafe: Optional[FailsafeStateMachine] = None,
    ):
        self.config = config if config is not None else MPCConfig()
        self.thermal = thermal_engine if thermal_engine is not None else DEFAULT_THERMAL_ENGINE
        self.rheology = rheology_engine if rheology_engine is not None else DEFAULT_RHEOLOGY_MODEL
        self.solver = wave_solver if wave_solver is not None else DEFAULT_WAVE_SOLVER
        self.failsafe = failsafe if failsafe is not None else DEFAULT_FAILSAFE
        self.real_mpc = ConstrainedMPC(
            config=self.config,
            thermal_engine=self.thermal,
            rheology_engine=self.rheology,
            wave_solver=self.solver,
            failsafe=self.failsafe,
        )

    def solve(self, state: WellState, thermal_forecast_C: List[float]) -> MPCResult:
        """Build a constraint-aware advisory trajectory with explicit infeasibility."""
        if getattr(self.config, "solver_mode", "optimization") == "optimization":
            return self.real_mpc.solve(state, thermal_forecast_C)

        t_start = time.perf_counter()
        n = self.config.horizon_steps
        gamma = 0.10  # Identified surrogate coefficient; see docs/MODEL_CARD.md.

        if n <= 0 or self.config.dt_hours <= 0.0:
            raise ValueError("MPC horizon_steps and dt_hours must be positive.")
        if not math.isfinite(state.spm_current) or not math.isfinite(state.temperature_C):
            raise ValueError("WellState SPM and temperature must be finite.")
        if state.viscosity_Pas is not None and (
            not math.isfinite(state.viscosity_Pas) or state.viscosity_Pas <= 0.0
        ):
            raise ValueError("WellState viscosity_Pas must be finite and positive when supplied.")

        mu_profile: List[float] = []
        mu_oil_curr = max(1e-4, float(self.rheology.oil_viscosity_celsius(state.temperature_C)))
        for k in range(n):
            temp_k = thermal_forecast_C[k] if k < len(thermal_forecast_C) else state.temperature_C
            if not math.isfinite(float(temp_k)):
                raise ValueError(f"Thermal forecast at step {k} is not finite.")
            mu_oil_k = float(self.rheology.oil_viscosity_celsius(temp_k))
            if state.viscosity_Pas is not None:
                mu_k = state.viscosity_Pas * (mu_oil_k / mu_oil_curr)
            else:
                mu_k = mu_oil_k
            mu_profile.append(max(1e-6, float(mu_k)))

        max_delta_step = self.config.max_delta_spm * self.config.dt_hours
        safe_bounds: List[float] = []
        intrinsically_infeasible_steps: List[int] = []
        for k, mu_k in enumerate(mu_profile):
            tension_bound = (3.5 - self.config.min_tension_kN) / max(0.01, gamma * mu_k)
            pprl_bound = (self.config.max_pprl_kN - 47.0 - 4.0 * mu_k) / 10.0
            raw_bound = min(tension_bound, pprl_bound, self.config.max_spm)
            if raw_bound < self.config.min_spm:
                intrinsically_infeasible_steps.append(k)
            safe_bounds.append(float(np.clip(raw_bound, self.config.min_spm, self.config.max_spm)))

        # Backward reachability pass: begin reducing speed early enough to respect
        # the per-hour actuator slew limit at future constraints.
        for k in range(n - 2, -1, -1):
            safe_bounds[k] = min(safe_bounds[k], safe_bounds[k + 1] + max_delta_step)

        spm_traj: List[float] = []
        min_tensions: List[float] = []
        pprls: List[float] = []
        spm_curr = float(np.clip(state.spm_current, self.config.min_spm, self.config.max_spm))

        for k in range(n):
            delta = safe_bounds[k] - spm_curr
            delta_clamped = float(np.clip(delta, -max_delta_step, max_delta_step))
            spm_next = float(np.clip(spm_curr + delta_clamped, self.config.min_spm, self.config.max_spm))
            spm_traj.append(spm_next)
            spm_curr = spm_next
            min_tensions.append(3.5 - gamma * mu_profile[k] * spm_next)
            pprls.append(47.0 + 10.0 * spm_next + 4.0 * mu_profile[k])

        tension_residuals = [v - self.config.min_tension_kN for v in min_tensions]
        pprl_residuals = [self.config.max_pprl_kN - v for v in pprls]
        violating_steps = [
            k for k in range(n)
            if tension_residuals[k] < -1e-9 or pprl_residuals[k] < -1e-9
        ]
        feasible = not intrinsically_infeasible_steps and not violating_steps
        status = "OPTIMAL" if feasible else "INFEASIBLE_SAFE_FALLBACK"
        solve_time_ms = float(round((time.perf_counter() - t_start) * 1000.0, 3))

        return MPCResult(
            optimal_spm=spm_traj[0],
            spm_trajectory=spm_traj,
            predicted_min_tension_kN=min_tensions,
            predicted_pprl_kN=pprls,
            solver_status=status,
            solve_time_ms=solve_time_ms,
            is_anti_float_satisfied=all(v >= -1e-9 for v in tension_residuals),
            details={
                "model_class": "reduced_order_advisory_surrogate",
                "certified_for_direct_control": False,
                "max_delta_spm_per_step": max_delta_step,
                "min_tension_residual_kN": float(min(tension_residuals)),
                "min_pprl_residual_kN": float(min(pprl_residuals)),
                "violating_steps": violating_steps,
                "intrinsically_infeasible_steps": intrinsically_infeasible_steps,
            },
        )

    def optimize(self, state: Union[WellState, Dict[str, Any]]) -> MPCResult:
        if isinstance(state, dict):
            st = WellState(**state)
        else:
            st = state
        forecast = [st.temperature_C] * self.config.horizon_steps
        return self.solve(st, forecast)

    def evaluate_spm_candidate(
        self,
        spm_cand: float,
        temp_c: float,
        water_cut: float,
        current_spm: float,
        pump_fillage: float = 0.95,
        sand_wear: float = 0.0,
    ) -> Dict[str, Any]:
        card: DynacardResult = self.solver.simulate_card(
            spm=spm_cand,
            temp_c=temp_c,
            water_cut=water_cut,
            pump_fillage=pump_fillage,
            sand_wear=sand_wear,
            n_strokes=3,
        )

        min_tens = card.min_downhole_tension_kn
        pprl = card.pprl_kn
        oil_prod = card.oil_production_bopd
        power_kw = card.power_kw
        delta_spm = abs(spm_cand - current_spm)

        is_tension_safe = min_tens >= self.config.min_tension_kN
        is_pprl_safe = pprl <= self.config.max_pprl_kN

        penalty = 0.0
        if not is_tension_safe:
            tension_violation = self.config.min_tension_kN - min_tens
            penalty += self.config.w_slack * (tension_violation ** 2) + 500.0

        if not is_pprl_safe:
            pprl_violation = pprl - self.config.max_pprl_kN
            penalty += 500.0 * (pprl_violation ** 2) + 200.0

        objective_score = (
            self.config.w_prod * oil_prod
            - self.config.w_power * power_kw
            - self.config.w_du * (delta_spm ** 2)
            - penalty
        )

        return {
            "spm": float(spm_cand),
            "objective_score": float(objective_score),
            "is_feasible": bool(is_tension_safe and is_pprl_safe),
            "min_tension_kn": float(min_tens),
            "pprl_kn": float(pprl),
            "oil_bopd": float(oil_prod),
            "power_kw": float(power_kw),
            "card_res": card.to_dict(),
        }

    def optimize_setpoint(
        self,
        current_spm: float,
        temp_c: float,
        water_cut: float = 0.35,
        pump_fillage: float = 0.95,
        sand_wear: float = 0.0,
        failsafe_override: Optional[float] = None,
    ) -> Dict[str, Any]:
        if failsafe_override is not None and failsafe_override >= 0.0:
            eval_override = self.evaluate_spm_candidate(
                failsafe_override, temp_c, water_cut, current_spm, pump_fillage, sand_wear
            )
            return {
                "recommended_spm": float(failsafe_override),
                "is_failsafe_active": True,
                "reason": "Supervisory Failsafe Override Active",
                "details": eval_override,
            }

        st = WellState(
            spm_current=current_spm,
            temperature_C=temp_c,
            water_cut=water_cut,
            pump_fillage=pump_fillage,
            sand_wear=sand_wear,
        )
        res = self.optimize(st)
        eval_best = self.evaluate_spm_candidate(res.optimal_spm, temp_c, water_cut, current_spm, pump_fillage, sand_wear)
        return {
            "recommended_spm": res.optimal_spm,
            "is_failsafe_active": False,
            "reason": f"MPC {res.status}",
            "details": eval_best,
        }

    def simulate_12h_predictive_timeline(
        self,
        start_elapsed_hours: float,
        initial_spm: float = 4.5,
        water_cut: float = 0.35,
        cooling_multiplier: float = 1.0,
        pump_fillage: float = 0.95,
        sand_wear: float = 0.0,
    ) -> Dict[str, Any]:
        horizon_hours = self.config.horizon_steps * self.config.dt_hours
        hours_relative = np.linspace(0.0, horizon_hours, 13)
        timeline_uncoupled = []
        timeline_coupled = []

        active_spm = float(initial_spm)

        for h_rel in hours_relative:
            abs_t_hours = start_elapsed_hours + h_rel
            t_cal_raw, _ = self.thermal.predict_temperature(abs_t_hours, time_unit="hours", cooling_multiplier=cooling_multiplier)
            t_cal = float(t_cal_raw)
            mu_mix = self.rheology.compute_mixture_viscosity(t_cal, water_cut=water_cut)
            beta_top = self.rheology.compute_couette_shear_drag(0.0254 / 2.0, t_cal, water_cut=water_cut)

            uncoupled_eval = self.evaluate_spm_candidate(
                initial_spm, t_cal, water_cut, initial_spm, pump_fillage, sand_wear
            )

            coupled_opt = self.optimize_setpoint(
                active_spm, t_cal, water_cut, pump_fillage, sand_wear
            )
            active_spm = coupled_opt["recommended_spm"]
            coupled_eval = coupled_opt["details"]

            timeline_uncoupled.append({
                "rel_hour": float(h_rel),
                "abs_hour": float(abs_t_hours),
                "temp_c": float(t_cal),
                "viscosity_pa_s": float(mu_mix),
                "beta_top_n_s_m2": float(beta_top),
                "spm": float(initial_spm),
                "min_downhole_tension_kn": float(uncoupled_eval["min_tension_kn"]),
                "pprl_kn": float(uncoupled_eval["pprl_kn"]),
                "oil_bopd": float(uncoupled_eval["oil_bopd"]),
                "power_kw": float(uncoupled_eval["power_kw"]),
                "is_floating": bool(uncoupled_eval["min_tension_kn"] < 0.0),
            })

            timeline_coupled.append({
                "rel_hour": float(h_rel),
                "abs_hour": float(abs_t_hours),
                "temp_c": float(t_cal),
                "viscosity_pa_s": float(mu_mix),
                "beta_top_n_s_m2": float(beta_top),
                "spm": float(active_spm),
                "min_downhole_tension_kn": float(coupled_eval["min_tension_kn"]),
                "pprl_kn": float(coupled_eval["pprl_kn"]),
                "oil_bopd": float(coupled_eval["oil_bopd"]),
                "power_kw": float(coupled_eval["power_kw"]),
                "is_floating": bool(coupled_eval["min_tension_kn"] < 0.0),
            })

        return {
            "hours": hours_relative.tolist(),
            "uncoupled": timeline_uncoupled,
            "coupled": timeline_coupled,
        }


# Compatibility alias
FastLoopMPCController = FastMPCController
DEFAULT_MPC_CONTROLLER = FastMPCController()
