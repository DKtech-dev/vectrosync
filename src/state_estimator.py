"""
Experimental state-estimation research module.

The SIREN network is untrained unless an explicitly versioned weight artifact is
loaded by a future integration. In its default state it returns the analytical
physics prior and must not be represented as learned or field calibrated. The
EKF is a synthetic observer for software experiments, not a control-qualified
measurement substitute.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Tuple, Optional, Any, Union
import math
import numpy as np

from src.thermal import ThermalDecayEngine, DEFAULT_THERMAL_ENGINE
from src.rheology import HeavyOilRheology, DEFAULT_RHEOLOGY_MODEL


@dataclass
class SIRENConfig:
    """Configuration for Sinusoidal Representation Network (SIREN) layers."""
    in_features: int = 4              # [t_norm, depth_norm, T_surf_norm, motor_power_norm]
    hidden_features: int = 32         # Compact embedded footprint
    out_features: int = 2             # [T_downhole_pred, viscosity_Pas_pred]
    hidden_layers: int = 2            # Depth of MLP
    omega_0: float = 30.0             # First-layer frequency scaling factor
    omega_hidden: float = 30.0        # Hidden layer frequency scaling factor
    trained: bool = False             # True only for externally validated weights


class SIRENLayer:
    """
    Individual SIREN layer with periodic sinusoidal activation: y = sin(omega * (W x + b)).
    The activation is differentiable but does not guarantee non-vanishing gradients or PDE fidelity.
    """
    def __init__(self, in_features: int, out_features: int, omega: float = 30.0, is_first: bool = False, seed: int = 42):
        self.in_features = in_features
        self.out_features = out_features
        self.omega = omega
        self.is_first = is_first
        rng = np.random.RandomState(seed)

        # SIREN-specific uniform weight initialization
        if self.is_first:
            bound = 1.0 / in_features
        else:
            bound = math.sqrt(6.0 / in_features) / omega

        self.weight = rng.uniform(-bound, bound, (out_features, in_features))
        self.bias = np.zeros((out_features,))

    def forward(self, x: np.ndarray) -> np.ndarray:
        """Forward pass: sin(omega * (W @ x + b))."""
        linear = np.dot(self.weight, x) + self.bias
        return np.sin(self.omega * linear)


class PINNSurrogate:
    """
    Compact, zero-dependency Physics-Informed Neural Network (PINN) surrogate model.
    Maps surface observations to downhole state profiles while enforcing governing physical laws:
    - Boberg-Lantz thermal decay loss
    - Arrhenius exponential rheology loss
    """
    def __init__(self, config: Optional[SIRENConfig] = None, thermal_engine: Optional[ThermalDecayEngine] = None,
                 rheology_model: Optional[HeavyOilRheology] = None):
        self.config = config or SIRENConfig()
        self.thermal = thermal_engine or DEFAULT_THERMAL_ENGINE
        self.rheology = rheology_model or DEFAULT_RHEOLOGY_MODEL

        # Initialize layers
        self.layers: List[SIRENLayer] = []
        # Input layer
        self.layers.append(SIRENLayer(self.config.in_features, self.config.hidden_features,
                                      omega=self.config.omega_0, is_first=True, seed=101))
        # Hidden layers
        for i in range(self.config.hidden_layers):
            self.layers.append(SIRENLayer(self.config.hidden_features, self.config.hidden_features,
                                          omega=self.config.omega_hidden, is_first=False, seed=201 + i))
        # Output linear projection
        rng = np.random.RandomState(301)
        bound = math.sqrt(6.0 / self.config.hidden_features) / self.config.omega_hidden
        self.out_weight = rng.uniform(-bound, bound, (self.config.out_features, self.config.hidden_features))
        self.out_bias = np.array([80.0, 1.0])  # Prior bias: 80°C, 1.0 Pa·s

    def predict(self, t_days: float, depth_m: float, T_flowline_C: float, motor_power_kW: float) -> Tuple[float, float]:
        """
        Infers subterranean sandface temperature (°C) and crude viscosity (Pa·s)
        from surface SCADA observables.
        """
        values = (t_days, depth_m, T_flowline_C, motor_power_kW)
        if not all(math.isfinite(float(value)) for value in values):
            raise ValueError("SIREN inputs must be finite.")
        if t_days < 0.0 or depth_m < 0.0 or motor_power_kW < 0.0:
            raise ValueError("Time, depth, and motor power must be non-negative.")

        # Feature normalization
        x = np.array([
            t_days / 30.0,
            depth_m / 1150.0,
            (T_flowline_C - 48.0) / (260.0 - 48.0),
            motor_power_kW / 55.0
        ], dtype=float)

        h = x
        for layer in self.layers:
            h = layer.forward(h)

        out = np.dot(self.out_weight, h) + self.out_bias
        
        # Physics calibration prior from Boberg-Lantz model
        t_safe_days = max(0.01, min(30.0, t_days))
        T_prior_C, _ = self.thermal.predict_temperature(t_safe_days, time_unit='days')
        T_prior_K = float(T_prior_C) + 273.15
        mu_prior = float(self.rheology.oil_viscosity(T_prior_K))

        # Randomly initialized layers are never presented as learned evidence.
        if self.config.trained:
            T_pred_C = float(np.clip(0.85 * T_prior_C + 0.15 * out[0], 48.0, 260.0))
            mu_pred_Pas = float(np.clip(0.85 * mu_prior + 0.15 * abs(out[1]), 0.009, 15.0))
        else:
            T_pred_C = float(np.clip(T_prior_C, 48.0, 260.0))
            mu_pred_Pas = float(np.clip(mu_prior, 0.009, 15.0))

        return T_pred_C, mu_pred_Pas

    def compute_physics_loss(self, t_days: float, depth_m: float, T_pred_C: float, mu_pred_Pas: float) -> float:
        """
        Computes the physics residual loss:
        L_physics = || d(ln mu)/d(1/T) - (E_a / R) ||^2 + || T_pred - T_boberg ||^2
        """
        T_K = T_pred_C + 273.15
        mu_expected = float(self.rheology.oil_viscosity(T_K))
        residual_rheology = (math.log(max(1e-4, mu_pred_Pas)) - math.log(max(1e-4, mu_expected))) ** 2

        t_safe_days = max(0.01, min(30.0, t_days))
        T_boberg_C, _ = self.thermal.predict_temperature(t_safe_days, time_unit='days')
        residual_thermal = ((T_pred_C - float(T_boberg_C)) / 100.0) ** 2

        return float(residual_rheology + residual_thermal)

    def train_on_synthetic_ground_truth(self, n_samples: int = 150, lr: float = 0.01) -> float:
        """
        Trains the projection layer of the PINN on synthetic physical ground truth
        generated by Boberg-Lantz decay and Arrhenius rheology.
        Returns final training MSE loss and sets self.config.trained = True.
        """
        rng = np.random.RandomState(42)
        t_samples = rng.uniform(0.1, 30.0, n_samples)
        depth_samples = rng.uniform(0.0, 1150.0, n_samples)

        t_true = []
        mu_true = []
        for t, d in zip(t_samples, depth_samples):
            t_c, _ = self.thermal.predict_temperature(t, time_unit='days')
            m_pas = float(self.rheology.oil_viscosity_celsius(t_c))
            t_true.append(float(t_c))
            mu_true.append(m_pas)

        targets = np.column_stack([t_true, mu_true])

        H = []
        for t, d, tc, mu in zip(t_samples, depth_samples, t_true, mu_true):
            t_flowline = tc * 0.75
            pwr = 15.0 + 3.0 * mu
            x = np.array([t / 30.0, d / 1150.0, (t_flowline - 48.0) / (260.0 - 48.0), pwr / 55.0])
            h = x
            for layer in self.layers:
                h = layer.forward(h)
            H.append(h)
        H = np.array(H)

        centered_targets = targets - self.out_bias
        lambda_reg = 0.05
        reg_matrix = lambda_reg * np.eye(self.config.hidden_features)
        self.out_weight = np.linalg.solve(H.T @ H + reg_matrix, H.T @ centered_targets).T
        self.config.trained = True

        preds = H @ self.out_weight.T + self.out_bias
        final_loss = float(np.mean((preds - targets) ** 2))
        return final_loss


@dataclass
class KalmanState:
    """State vector for downhole estimation: [T_sandface_C, viscosity_Pas, water_cut]."""
    T_sandface_C: float = 80.0
    viscosity_Pas: float = 1.0
    water_cut: float = 0.35
    covariance: np.ndarray = field(default_factory=lambda: np.diag([25.0, 0.5, 0.01]))


class DownholeKalmanEstimator:
    """
    Extended Kalman Filter (EKF) for continuous real-time estimation of subterranean
    wellbore thermodynamic and rheological states from surface SCADA telemetry.
    """
    def __init__(self, dt_seconds: float = 1.0, thermal_engine: Optional[ThermalDecayEngine] = None,
                 rheology_model: Optional[HeavyOilRheology] = None):
        if not math.isfinite(float(dt_seconds)) or dt_seconds <= 0.0:
            raise ValueError("dt_seconds must be finite and positive.")
        self.dt = float(dt_seconds)
        self.thermal = thermal_engine or DEFAULT_THERMAL_ENGINE
        self.rheology = rheology_model or DEFAULT_RHEOLOGY_MODEL
        self.state = KalmanState()

        # Process noise covariance Q
        self.Q = np.diag([0.05, 0.001, 0.0001])
        # Measurement noise covariance R: [T_flowline, motor_power, polished_rod_load]
        self.R = np.diag([1.0, 0.5, 5.0])

    def predict(self, dt_sec: float) -> KalmanState:
        """Time update step: models conductive thermal decay toward reservoir baseline (48°C)."""
        if not math.isfinite(float(dt_sec)) or dt_sec <= 0.0:
            raise ValueError("EKF prediction interval must be finite and positive.")
        if not np.all(np.isfinite(self.state.covariance)):
            raise ValueError("EKF covariance contains non-finite values.")

        tau_cooling = 86400.0 * 20.0  # 20-day synthetic characteristic time constant
        dT_dt = -(self.state.T_sandface_C - 48.0) / tau_cooling
        
        T_new = max(48.0, self.state.T_sandface_C + dT_dt * dt_sec)
        mu_new = float(self.rheology.oil_viscosity(T_new + 273.15))
        
        # Jacobian of the implemented transition: T decays, viscosity is
        # recomputed from Arrhenius rheology, and water cut is persistent.
        thermal_gain = 1.0 - dt_sec / tau_cooling
        temperature_k = T_new + 273.15
        dmu_dtemp = -self.rheology.B * mu_new / (temperature_k ** 2)
        F = np.array([
            [thermal_gain, 0.0, 0.0],
            [dmu_dtemp * thermal_gain, 0.0, 0.0],
            [0.0, 0.0, 1.0]
        ])

        P_new = F @ self.state.covariance @ F.T + self.Q * (dt_sec / 1.0)
        
        self.state.T_sandface_C = float(T_new)
        self.state.viscosity_Pas = float(mu_new)
        self.state.covariance = P_new
        return self.state

    def update(self, T_flowline_C: float, motor_power_kW: float, pprl_kN: float) -> KalmanState:
        """
        Measurement update step fusing SCADA observables:
        h(x) = [ T_sandface - delta_T_wellbore, motor_power_model(mu), load_model(mu) ]
        """
        measurements = (T_flowline_C, motor_power_kW, pprl_kN)
        if not all(math.isfinite(float(value)) for value in measurements):
            raise ValueError("EKF measurements must be finite.")
        if motor_power_kW < 0.0:
            raise ValueError("Motor power must be non-negative.")

        # Synthetic measurement expectations; coefficients require calibration.
        expected_T_surf = self.state.T_sandface_C * 0.75
        expected_pwr = 15.0 + 3.0 * self.state.viscosity_Pas
        expected_pprl = 120.0 + 8.0 * self.state.viscosity_Pas

        z = np.array([T_flowline_C, motor_power_kW, pprl_kN], dtype=float)
        z_hat = np.array([expected_T_surf, expected_pwr, expected_pprl], dtype=float)
        y = z - z_hat

        # Measurement Jacobian H
        H = np.array([
            [0.75, 0.0, 0.0],
            [0.0, 3.0, 0.0],
            [0.0, 8.0, 0.0]
        ])

        # Innovation covariance S
        S = H @ self.state.covariance @ H.T + self.R
        ph_t = self.state.covariance @ H.T
        K = np.linalg.solve(S, ph_t.T).T

        # State correction
        dx = K @ y
        self.state.T_sandface_C = float(np.clip(self.state.T_sandface_C + dx[0], 48.0, 260.0))
        self.state.viscosity_Pas = float(np.clip(self.state.viscosity_Pas + dx[1], 0.009, 15.0))
        self.state.water_cut = float(np.clip(self.state.water_cut + dx[2], 0.0, 0.60))

        I = np.eye(3)
        correction = I - K @ H
        covariance = correction @ self.state.covariance @ correction.T + K @ self.R @ K.T
        covariance = 0.5 * (covariance + covariance.T)
        eigenvalues, eigenvectors = np.linalg.eigh(covariance)
        self.state.covariance = eigenvectors @ np.diag(np.maximum(eigenvalues, 1e-12)) @ eigenvectors.T
        return self.state


DEFAULT_PINN = PINNSurrogate()
DEFAULT_KALMAN = DownholeKalmanEstimator()
