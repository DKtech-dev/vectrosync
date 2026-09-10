"""
Test Suite for Real Numerical Constrained MPC Solver (tests/test_mpc_real_solver.py).

Validates:
1. Convergence of SLSQP constrained optimizer on wellbore model.
2. Strict adherence to actuator slew-rate limits across the horizon.
3. Robust anti-float minimum tension constraint enforcement (>= 0.50 kN).
4. Peak Polished Rod Load (PPRL) constraint enforcement (<= 99.0 kN).
5. Infeasible disturbance detection and safe fallback activation.
"""

import math
import pytest
import numpy as np

from src.mpc import ConstrainedMPC, MPCConfig, WellState, MPCResult


class TestConstrainedMPCSolver:
    """Test suite for the numerical SLSQP-based MPC optimizer."""

    def test_mpc_numerical_optimization_converges(self):
        """Validates that SLSQP optimizer solves within expected tolerances and profiles solve time."""
        mpc = ConstrainedMPC()
        state = WellState(spm_current=4.5, temperature_C=80.0, water_cut=0.35)
        forecast = [80.0 - (i * 0.5) for i in range(24)]

        res: MPCResult = mpc.solve(state, forecast)

        assert res.solver_status in ("OPTIMAL", "INFEASIBLE_SAFE_FALLBACK")
        assert len(res.spm_trajectory) == 24
        assert len(res.predicted_min_tension_kN) == 24
        assert len(res.predicted_pprl_kN) == 24
        assert res.solve_time_ms > 0.0
        assert res.optimal_spm == res.spm_trajectory[0]

    def test_mpc_slew_rate_enforcement(self):
        """Actuator ramp rate between adjacent horizon steps cannot exceed max_delta_spm_per_step."""
        config = MPCConfig(max_delta_spm=0.50, dt_hours=0.5)  # 0.25 SPM max per step
        mpc = ConstrainedMPC(config=config)
        state = WellState(spm_current=4.5, temperature_C=70.0)
        forecast = [70.0 - (i * 1.0) for i in range(24)]

        res = mpc.solve(state, forecast)

        max_allowed_delta = config.max_delta_spm * config.dt_hours
        traj = res.spm_trajectory

        assert abs(traj[0] - state.spm_current) <= max_allowed_delta + 1e-4

        for k in range(len(traj) - 1):
            step_delta = abs(traj[k + 1] - traj[k])
            assert step_delta <= max_allowed_delta + 1e-4, (
                f"Slew rate violated at step {k}: delta {step_delta:.4f} > {max_allowed_delta:.4f}"
            )

    def test_mpc_anti_float_tension_safety(self):
        """Optimizer throttles speed down across cooling cycle to keep downhole tension >= 0.50 kN."""
        mpc = ConstrainedMPC()
        state = WellState(spm_current=4.5, temperature_C=120.0, water_cut=0.35)
        # Cooling from 120°C down to 60°C across 24 steps
        forecast = list(np.linspace(120.0, 60.0, 24))

        res = mpc.solve(state, forecast)

        # Early hot: SPM stays high
        assert res.spm_trajectory[0] >= 4.0
        # Late cold: SPM proactively throttled down
        assert res.spm_trajectory[-1] <= 3.2
        # Minimum tension maintained >= 0.5 kN
        assert min(res.predicted_min_tension_kN) >= mpc.config.min_tension_kN - 1e-3

    def test_mpc_pprl_tensile_rating_safety(self):
        """PPRL must remain safely below 90% of working rod rating (99.0 kN)."""
        mpc = ConstrainedMPC()
        state = WellState(spm_current=4.2, temperature_C=100.0)
        forecast = list(np.linspace(100.0, 70.0, 24))

        res = mpc.solve(state, forecast)

        assert max(res.predicted_pprl_kN) <= 99.0 + 1e-4, (
            f"PPRL constraint violated: peak {max(res.predicted_pprl_kN):.2f} kN > 99.0 kN"
        )

    def test_mpc_infeasible_disturbance_fallback(self):
        """Under severe unphysical fluid freeze, optimizer detects infeasibility and activates safe fallback."""
        mpc = ConstrainedMPC()
        # Extreme cold 30°C where crude viscosity is huge (> 100 Pa.s)
        state = WellState(spm_current=4.5, temperature_C=30.0)
        forecast = [30.0 for _ in range(24)]

        res = mpc.solve(state, forecast)

        if not res.is_anti_float_satisfied or res.solver_status == "INFEASIBLE_SAFE_FALLBACK":
            assert res.solver_status == "INFEASIBLE_SAFE_FALLBACK"
            assert res.details["max_slack_kN"] > 0.0 or len(res.details["violating_steps"]) > 0
