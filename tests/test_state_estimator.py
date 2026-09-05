"""
Unit tests for PINN Surrogate & Kalman State Estimator (tests/test_state_estimator.py)
Verifies:
1. SIREN layer initialization, non-zero activation, and bounded sinusoidal outputs.
2. PINNSurrogate forward prediction across CSS thermal cooldown range.
3. PINN physics loss calculation penalizing thermodynamic and rheological residuals.
4. DownholeKalmanEstimator state prediction and EKF measurement correction convergence.
5. Telemetry noise filtering and state covariance reduction.
"""

import pytest
import numpy as np
import math

from src.state_estimator import (
    SIRENConfig,
    SIRENLayer,
    PINNSurrogate,
    DownholeKalmanEstimator,
    KalmanState,
    DEFAULT_PINN,
    DEFAULT_KALMAN
)


def test_siren_layer_output_bounded():
    """Verifies that SIREN layer produces sinusoidal activations strictly in [-1.0, 1.0]."""
    layer = SIRENLayer(in_features=4, out_features=16, omega=30.0, is_first=True, seed=42)
    x = np.array([0.5, 0.2, -0.8, 1.2])
    out = layer.forward(x)
    
    assert out.shape == (16,)
    assert np.all(out >= -1.0)
    assert np.all(out <= 1.0)
    assert np.any(out != 0.0)


def test_pinn_surrogate_prediction_bounds():
    """Verifies that PINN surrogate predicts monotonic cooling and viscosity growth."""
    pinn = PINNSurrogate()
    
    # Day 2: Hot early production post-steam (T high, low viscosity)
    T_hot, mu_hot = pinn.predict(t_days=2.0, depth_m=1150.0, T_flowline_C=150.0, motor_power_kW=20.0)
    assert 48.0 <= T_hot <= 260.0

    # Day 20: Cool late production (T lower, viscosity higher)
    T_cool, mu_cool = pinn.predict(t_days=20.0, depth_m=1150.0, T_flowline_C=55.0, motor_power_kW=45.0)
    assert 48.0 <= T_cool <= 260.0
    assert T_cool < T_hot
    assert mu_cool > mu_hot


def test_pinn_physics_loss_satisfaction():
    """Verifies that physics loss remains low when state conforms to Boberg-Lantz and Arrhenius laws."""
    pinn = PINNSurrogate()
    
    # Normal consistent state
    loss = pinn.compute_physics_loss(t_days=10.0, depth_m=1150.0, T_pred_C=95.0, mu_pred_Pas=0.45)
    assert isinstance(loss, float)
    assert loss >= 0.0
    assert loss < 10.0  # Residual should be small for physically consistent values


def test_kalman_estimator_predict_and_update():
    """Verifies Extended Kalman Filter state update and uncertainty reduction."""
    ekf = DownholeKalmanEstimator(dt_seconds=1.0)
    
    initial_cov_trace = float(np.trace(ekf.state.covariance))
    
    # Time update
    ekf.predict(dt_sec=10.0)
    
    # Measurement update with surface flowline telemetry
    updated_state = ekf.update(T_flowline_C=60.0, motor_power_kW=32.0, pprl_kN=145.0)
    
    # Uncertainty covariance should decrease after measurement fusion
    final_cov_trace = float(np.trace(updated_state.covariance))
    assert final_cov_trace < initial_cov_trace
    assert 48.0 <= updated_state.T_sandface_C <= 260.0
    assert 0.009 <= updated_state.viscosity_Pas <= 15.0
    assert 0.0 <= updated_state.water_cut <= 0.60


def test_kalman_noise_rejection():
    """Verifies that EKF smooths high-frequency sensor noise across successive steps."""
    ekf = DownholeKalmanEstimator(dt_seconds=1.0)
    ekf.state.T_sandface_C = 70.0
    
    # Inject noisy flowline readings around true mean
    noisy_readings = [52.0 + 5.0 * np.sin(i) for i in range(10)]
    estimates = []
    
    for reading in noisy_readings:
        ekf.predict(dt_sec=1.0)
        st = ekf.update(T_flowline_C=reading, motor_power_kW=30.0, pprl_kN=140.0)
        estimates.append(st.T_sandface_C)
        
    # Variance of state estimates should be strictly lower than variance of raw noisy readings
    assert np.var(estimates) < np.var(noisy_readings)
