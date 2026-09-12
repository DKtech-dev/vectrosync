"""
Constrained Model Predictive Controller (src/mpc.py).

Implements real numerical constrained optimization using scipy.optimize.minimize (SLSQP)
over an algebraic surrogate representation of downhole minimum tension and surface PPRL.
Optimizes production and energy efficiency over a predictive horizon while enforcing:
1. Anti-Float Tension Floor with soft slacks:
   E[F_min] - z*sigma_F + s_tens >= F_min_safe (0.50 kN), where s_tens in [0, 50.0] kN
2. Peak Polished Rod Load (PPRL) with soft slacks:
   E[F_peak] + z*sigma_F - s_pprl <= 0.90 * F_rating (99.0 kN), where s_pprl in [0, 50.0] kN
3. Kinematic actuator bounds: min_spm <= SPM <= max_spm (default 1.0 to 5.5 SPM; configurable to 2.0-6.0 SPM)
4. Actuator slew-rate limits: |SPM_{k} - SPM_{k-1}| <= max_delta_spm (0.25 SPM per 0.5h step)
5. Soft constraints penalized quadratically at w_slack = 5000.0.
   Transitions to INFEASIBLE_SAFE_FALLBACK if max slack >= 0.05 kN or solver diverges.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Tuple, Optional, Any, Union
import math
import time
import numpy as np
from scipy.optimize import minimize, OptimizeResult

from src.thermal import ThermalDecayEngine, DEFAULT_THERMAL_ENGINE
from src.rheology import HeavyOilRheology, DEFAULT_RHEOLOGY_MODEL
from src.rod_conservative import ConservativeRodWaveSolver, DEFAULT_WAVE_SOLVER, DynacardResult
from src.failsafe import FailsafeStateMachine, FailsafeLevel, DEFAULT_FAILSAFE


@dataclass
class MPCConfig:
    """Configuration weights, physical horizons, and safety limits for Constrained MPC."""
    horizon_steps: int = 24           # 24 steps over 12 hours (dt = 0.5 hr)
    dt_hours: float = 0.5             # Step duration in hours
    w_prod: float = 1.0               # Production maximization weight
    w_power: float = 0.15             # Mechanical power penalty weight
    w_du: float = 0.50                # SPM slew rate penalty weight
    w_slack: float = 5000.0           # Slack variable penalty for softened constraints
    min_tension_kN: float = 0.50      # Minimum downhole positive tension floor (Anti-Float)
    max_pprl_kN: float = 99.0         # 90% of 110.0 kN rod string / surface unit working rating
    min_spm: float = 1.0              # Kinematic minimum pump speed
    max_spm: float = 5.5              # Kinematic maximum pump speed
    max_delta_spm: float = 0.50       # Maximum allowable SPM ramp per hour (0.25 per 0.5h step)
    robust_z: float = 1.282           # 90% confidence uncertainty-tightening factor
    sigma_min_tension_kN: float = 0.10 # Downhole load model uncertainty std dev (kN)
    sigma_pprl_kN: float = 1.5        # Surface load model uncertainty std dev (kN)


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


class ConstrainedMPC:
    """
    Nonlinear constrained Model Predictive Controller optimizing sucker-rod pump operation.
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

    def _evaluate_step_physics(self, spm: float, temp_c: float, water_cut: float, mu_effective: float) -> Tuple[float, float, float, float]:
        """
        Evaluates physical metrics (min_tension_kN, pprl_kN, oil_bopd, power_kW)
        for a given candidate SPM and fluid state.
        """
        gamma = 0.10  # Calibrated Couette shear coupling coefficient
        min_tens_kN = 3.5 - gamma * mu_effective * spm
        pprl_kN = 47.0 + 10.0 * spm + 4.0 * mu_effective

        dp_in = self.solver.d_plunger / 0.0254
        stroke_in = self.solver.stroke_s / 0.0254
        liq_bopd = 0.1166 * (dp_in ** 2) * stroke_in * spm * 0.95
        oil_bopd = liq_bopd * (1.0 - water_cut)
        power_kW = 5.0 + 3.0 * spm + 0.8 * mu_effective

        return min_tens_kN, pprl_kN, oil_bopd, power_kW

    def solve(self, state: WellState, thermal_forecast_C: List[float]) -> MPCResult:
        """
        Solves the constrained nonlinear MPC problem over the forecast horizon.
        """
        t_start = time.perf_counter()
        n = self.config.horizon_steps
        max_delta_step = self.config.max_delta_spm * self.config.dt_hours

        if n <= 0 or self.config.dt_hours <= 0.0:
            raise ValueError("MPC horizon_steps and dt_hours must be positive.")
        if not math.isfinite(state.spm_current) or not math.isfinite(state.temperature_C):
            raise ValueError("WellState SPM and temperature must be finite.")

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

        # Analytical Warm-Start: backward reachability surrogate
        safe_bounds = []
        gamma = 0.10
        for k, mu_k in enumerate(mu_profile):
            t_bound = (3.5 - self.config.min_tension_kN) / max(0.01, gamma * mu_k)
            p_bound = (self.config.max_pprl_kN - 47.0 - 4.0 * mu_k) / 10.0
            bound = min(t_bound, p_bound, self.config.max_spm)
            safe_bounds.append(float(np.clip(bound, self.config.min_spm, self.config.max_spm)))

        for k in range(n - 2, -1, -1):
            safe_bounds[k] = min(safe_bounds[k], safe_bounds[k + 1] + max_delta_step)

        u_warm = np.zeros(n, dtype=np.float64)
        u_curr = float(np.clip(state.spm_current, self.config.min_spm, self.config.max_spm))
        for k in range(n):
            du = np.clip(safe_bounds[k] - u_curr, -max_delta_step, max_delta_step)
            u_next = np.clip(u_curr + du, self.config.min_spm, self.config.max_spm)
            u_warm[k] = u_next
            u_curr = u_next

        # Decision variables: x = [u_0..u_{n-1}, s_tens_0..s_tens_{n-1}, s_pprl_0..s_pprl_{n-1}] (length 3n)
        x0 = np.concatenate([u_warm, np.zeros(2 * n)])

        def objective(x: np.ndarray) -> float:
            u_vec = x[:n]
            s_tens = x[n:2 * n]
            s_pprl = x[2 * n:]
            cost = 0.0

            # Actuator slew cost
            cost += self.config.w_du * ((u_vec[0] - state.spm_current) ** 2)
            cost += self.config.w_du * np.sum((u_vec[1:] - u_vec[:-1]) ** 2)

            # Quadratic slack penalties
            cost += self.config.w_slack * np.sum(s_tens ** 2)
            cost += self.config.w_slack * np.sum(s_pprl ** 2)

            for k in range(n):
                _, _, oil_bopd, power_kw = self._evaluate_step_physics(
                    u_vec[k], thermal_forecast_C[k] if k < len(thermal_forecast_C) else state.temperature_C,
                    state.water_cut, mu_profile[k]
                )
                cost -= self.config.w_prod * oil_bopd
                cost += self.config.w_power * power_kw

            return float(cost)

        # Bounds: u in [min_spm, max_spm], slacks in [0, 50]
        bounds = (
            [(self.config.min_spm, self.config.max_spm) for _ in range(n)]
            + [(0.0, 50.0) for _ in range(2 * n)]
        )

        constraints = []

        # 1. Slew rate constraints: -max_delta <= u_{k} - u_{k-1} <= max_delta
        def make_slew_up(k):
            if k == 0:
                return lambda x: max_delta_step - (x[0] - state.spm_current)
            return lambda x: max_delta_step - (x[k] - x[k - 1])

        def make_slew_down(k):
            if k == 0:
                return lambda x: (x[0] - state.spm_current) + max_delta_step
            return lambda x: (x[k] - x[k - 1]) + max_delta_step

        for k in range(n):
            constraints.append({'type': 'ineq', 'fun': make_slew_up(k)})
            constraints.append({'type': 'ineq', 'fun': make_slew_down(k)})

        # 2. Anti-Float Tension Constraint with robust tightening & slack:
        # (3.5 - gamma * mu_k * u_k) + s_tens_k >= min_tension_kN + z*sigma
        robust_z = getattr(self.config, "robust_z", 1.282)
        sigma_tension = getattr(self.config, "sigma_min_tension_kN", 0.10)
        sigma_pprl = getattr(self.config, "sigma_pprl_kN", 1.50)
        tightened_floor = self.config.min_tension_kN + robust_z * sigma_tension

        def make_tension_con(k):
            mu_k = mu_profile[k]
            return lambda x: (3.5 - gamma * mu_k * x[k]) + x[n + k] - tightened_floor

        for k in range(n):
            constraints.append({'type': 'ineq', 'fun': make_tension_con(k)})

        # 3. Peak load constraint with robust tightening & slack:
        # max_pprl_kN - (47 + 10*u_k + 4*mu_k) + s_pprl_k >= z*sigma
        tightened_pprl = self.config.max_pprl_kN - robust_z * sigma_pprl

        def make_pprl_con(k):
            mu_k = mu_profile[k]
            return lambda x: tightened_pprl + x[2 * n + k] - (47.0 + 10.0 * x[k] + 4.0 * mu_k)

        for k in range(n):
            constraints.append({'type': 'ineq', 'fun': make_pprl_con(k)})

        opt_res: OptimizeResult = minimize(
            fun=objective,
            x0=x0,
            method='SLSQP',
            bounds=bounds,
            constraints=constraints,
            options={'maxiter': 100, 'ftol': 1e-4, 'disp': False}
        )

        solve_time_ms = float(round((time.perf_counter() - t_start) * 1000.0, 3))

        if opt_res.success:
            u_opt = opt_res.x[:n]
            s_tens_opt = opt_res.x[n:2 * n]
            s_pprl_opt = opt_res.x[2 * n:]
        else:
            u_opt = u_warm
            s_tens_opt = np.zeros(n)
            s_pprl_opt = np.zeros(n)

        min_tensions = []
        pprls = []
        for k in range(n):
            t_k, p_k, _, _ = self._evaluate_step_physics(
                u_opt[k], thermal_forecast_C[k] if k < len(thermal_forecast_C) else state.temperature_C,
                state.water_cut, mu_profile[k]
            )
            min_tensions.append(float(t_k))
            pprls.append(float(p_k))

        tension_residuals = [v - self.config.min_tension_kN for v in min_tensions]
        pprl_residuals = [self.config.max_pprl_kN - v for v in pprls]
        max_slack = float(max(np.max(s_tens_opt), np.max(s_pprl_opt)))

        violating_steps = [k for k in range(n) if tension_residuals[k] < -1e-4 or pprl_residuals[k] < -1e-4]
        is_feasible = (len(violating_steps) == 0) and (max_slack < 0.05) and opt_res.success

        status = "OPTIMAL" if is_feasible else "INFEASIBLE_SAFE_FALLBACK"

        return MPCResult(
            optimal_spm=float(u_opt[0]),
            spm_trajectory=[float(v) for v in u_opt],
            predicted_min_tension_kN=min_tensions,
            predicted_pprl_kN=pprls,
            solver_status=status,
            solve_time_ms=solve_time_ms,
            is_anti_float_satisfied=all(v >= -1e-4 for v in tension_residuals),
            cost=float(opt_res.fun) if opt_res.success else 0.0,
            details={
                "model_class": "nonlinear_constrained_slsqp_mpc",
                "certified_for_direct_control": False,
                "optimizer_success": bool(opt_res.success),
                "optimizer_message": str(opt_res.message),
                "max_slack_kN": max_slack,
                "max_delta_spm_per_step": max_delta_step,
                "min_tension_residual_kN": float(min(tension_residuals)),
                "min_pprl_residual_kN": float(min(pprl_residuals)),
                "violating_steps": violating_steps,
            },
        )

    def optimize(self, state: Union[WellState, Dict[str, Any]]) -> MPCResult:
        if isinstance(state, dict):
            st = WellState(**state)
        else:
            st = state
        forecast = [st.temperature_C] * self.config.horizon_steps
        return self.solve(st, forecast)


DEFAULT_CONSTRAINED_MPC = ConstrainedMPC()
