"""
Test Suite for State Estimator Parameter Recovery (tests/test_state_estimator_recovery.py).

Validates:
1. Downhole Kalman Filter (EKF) recovery of latent downhole temperature and viscosity
   from noisy surface SCADA telemetry.
2. PINN surrogate training on physical synthetic ground truth and parameter prediction fidelity.
"""

import math
import numpy as np
import pytest

from src.state_estimator import DownholeKalmanEstimator, PINNSurrogate, SIRENConfig


class TestStateEstimatorRecovery:
    """Validates parameter recovery under measurement noise and surrogate training."""

    def test_kalman_filter_parameter_recovery_under_noise(self):
        """EKF converges to latent true temperature and viscosity despite Gaussian sensor noise."""
        ekf = DownholeKalmanEstimator(dt_seconds=1.0)
        # Initialize filter with a prior offset
        ekf.state.T_sandface_C = 70.0
        ekf.state.viscosity_Pas = 4.0

        # Latent true state: well at 85.0°C
        true_temp = 85.0
        true_visc = float(ekf.rheology.oil_viscosity_celsius(true_temp))  # ~2.15 Pa.s
        true_t_surf = true_temp * 0.75
        true_pwr = 15.0 + 3.0 * true_visc
        true_pprl = 120.0 + 8.0 * true_visc

        rng = np.random.RandomState(42)
        # 60 consecutive telemetry updates with sensor noise
        for _ in range(60):
            noisy_t_surf = true_t_surf + rng.normal(0.0, 1.0)
            noisy_pwr = true_pwr + rng.normal(0.0, 0.5)
            noisy_pprl = true_pprl + rng.normal(0.0, 3.0)

            ekf.predict(dt_sec=1.0)
            ekf.update(noisy_t_surf, noisy_pwr, noisy_pprl)

        # Filter must recover latent sandface temperature within +-5°C
        assert abs(ekf.state.T_sandface_C - true_temp) < 5.0, (
            f"Recovered temperature {ekf.state.T_sandface_C:.2f}°C deviated from true {true_temp}°C"
        )
        # Filter must recover viscosity within +-0.6 Pa.s
        assert abs(ekf.state.viscosity_Pas - true_visc) < 0.6, (
            f"Recovered viscosity {ekf.state.viscosity_Pas:.3f} Pa.s deviated from true {true_visc} Pa.s"
        )

    def test_pinn_surrogate_training_on_ground_truth(self):
        """PINN trained on synthetic ground truth achieves low MSE loss and valid prediction bounds."""
        config = SIRENConfig(hidden_features=32, hidden_layers=2)
        pinn = PINNSurrogate(config=config)

        assert pinn.config.trained is False

        # Train on 150 physics-generated samples
        final_loss = pinn.train_on_synthetic_ground_truth(n_samples=150)

        assert pinn.config.trained is True
        # MSE on 48-260°C target span: RMSE < 12°C corresponds to MSE < 150
        assert final_loss < 150.0, f"PINN final MSE loss {final_loss:.2f} exceeded expected threshold."

        # Evaluate prediction at test point: 10 days, 1150m, T_flowline = 60°C, Power = 20 kW
        t_pred, mu_pred = pinn.predict(t_days=10.0, depth_m=1150.0, T_flowline_C=60.0, motor_power_kW=20.0)

        assert 48.0 <= t_pred <= 260.0
        assert 0.01 <= mu_pred <= 15.0
