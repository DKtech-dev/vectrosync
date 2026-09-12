"""
Reservoir thermal-decay research model with Bessel quadrature, explicit
singularity branches, and a documented empirical calibration factor.
"""

from dataclasses import dataclass, field
from typing import Union, Tuple, Optional, List, Dict, Any, Sequence
import math
import warnings
import numpy as np
from scipy.integrate import quad, IntegrationWarning
from scipy.special import j1, erf
from scipy.interpolate import PchipInterpolator


@dataclass
class ThermalAssetParameters:
    """
    Physical domain parameters for Baghewala Field CSS thermal decay.
    Temperatures stored in Kelvin with Celsius property helpers.
    """
    TR: float = 321.15              # Native reservoir temp (48°C) in Kelvin
    Ts: float = 533.15              # Steam injection temp (260°C) in Kelvin
    alpha: float = 1.0e-6           # Rock thermal diffusivity in m^2/s (0.0036 m^2/hr)
    h: float = 15.0                 # Net pay thickness in meters
    rh: float = 12.0                # Heated steam zone radius in meters
    delta: float = 0.05             # Convective produced fluid heat removal factor
    k_ref: float = 0.7042           # Dynamic calibration asymptote (42% bias correction)
    t_ref: float = 300.0            # Reference time in days for calibration curve

    def __post_init__(self):
        if self.TR <= 0.0:
            raise ValueError("Ambient reservoir temperature TR must be positive (Kelvin).")
        if self.Ts <= self.TR:
            raise ValueError("Steam temperature Ts must exceed ambient reservoir temp TR.")
        if self.alpha <= 0.0:
            raise ValueError("thermal diffusivity alpha must be strictly positive.")
        if self.h <= 0.0:
            raise ValueError("Net pay thickness h must be strictly positive.")
        if self.rh <= 0.0:
            raise ValueError("Heated steam radius rh must be strictly positive.")
        if not (0.0 <= self.delta < 1.0):
            raise ValueError("Convective removal factor delta must be in [0, 1).")
        if not (0.0 < self.k_ref <= 1.0):
            raise ValueError("Calibration asymptote k_ref must be in (0, 1].")
        if self.t_ref <= 0.0:
            raise ValueError("Calibration reference time t_ref must be positive.")

    @property
    def TR_C(self) -> float:
        return self.TR - 273.15

    @property
    def Ts_C(self) -> float:
        return self.Ts - 273.15

    @property
    def alpha_hr(self) -> float:
        return self.alpha * 3600.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "TR_K": self.TR,
            "Ts_K": self.Ts,
            "alpha_m2_s": self.alpha,
            "h_m": self.h,
            "rh_m": self.rh,
            "delta": self.delta,
            "k_ref": self.k_ref,
            "t_ref_days": self.t_ref,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ThermalAssetParameters":
        return cls(
            TR=float(data.get("TR_K", data.get("TR", 321.15))),
            Ts=float(data.get("Ts_K", data.get("Ts", 533.15))),
            alpha=float(data.get("alpha_m2_s", data.get("alpha", 1.0e-6))),
            h=float(data.get("h_m", data.get("h", 15.0))),
            rh=float(data.get("rh_m", data.get("rh", 12.0))),
            delta=float(data.get("delta", 0.05)),
            k_ref=float(data.get("k_ref", 0.7042)),
            t_ref=float(data.get("t_ref_days", data.get("t_ref", 300.0))),
        )


class ThermalDecayEngine:
    """
    High-precision analytical Boberg-Lantz thermal decay solver for CSS operations.
    """

    def __init__(
        self,
        params: Optional[ThermalAssetParameters] = None,
        t_res_c: Optional[float] = None,
        t_steam_c: Optional[float] = None,
        alpha_m2_hr: Optional[float] = None,
        net_pay_h_m: Optional[float] = None,
        steam_radius_rh_m: Optional[float] = None,
        convective_delta: Optional[float] = None,
    ):
        if params is not None:
            self.params = params
        else:
            tr = (t_res_c + 273.15) if t_res_c is not None else 321.15
            ts = (t_steam_c + 273.15) if t_steam_c is not None else 533.15
            alpha = (alpha_m2_hr / 3600.0) if alpha_m2_hr is not None else 1.0e-6
            h = float(net_pay_h_m) if net_pay_h_m is not None else 15.0
            rh = float(steam_radius_rh_m) if steam_radius_rh_m is not None else 12.0
            delta = float(convective_delta) if convective_delta is not None else 0.05
            self.params = ThermalAssetParameters(TR=tr, Ts=ts, alpha=alpha, h=h, rh=rh, delta=delta)

        self._spline_b2_min = 1e-10
        self._spline_b2_max = 100.0
        self._build_radial_spline_cache()

    def _build_radial_spline_cache(self, n_points: int = 800) -> None:
        log_b2_grid = np.linspace(np.log10(self._spline_b2_min), np.log10(self._spline_b2_max), n_points)
        b2_grid = 10.0 ** log_b2_grid
        vr_vals = np.zeros(n_points, dtype=np.float64)

        for i, b2 in enumerate(b2_grid):
            vr_vals[i] = self._quad_radial_integral(b2)

        vr_monotone = np.minimum.accumulate(vr_vals)
        self._vr_spline = PchipInterpolator(log_b2_grid, vr_monotone)

    @staticmethod
    def _radial_integrand(y: float, b2: float) -> float:
        if y < 1e-12:
            return 0.0
        j1_val = j1(y)
        return float(np.exp(-b2 * y * y) * (j1_val * j1_val) / y)

    def _quad_radial_integral(self, b2: float) -> float:
        if b2 <= 1e-10:
            return 1.0
        if b2 >= 100.0:
            return float(1.0 / (4.0 * b2))
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", IntegrationWarning)
            val, _ = quad(
                self._radial_integrand,
                0.0,
                np.inf,
                args=(b2,),
                epsabs=1e-10,
                epsrel=1e-9,
                limit=150,
            )
        return float(np.clip(2.0 * val, 0.0, 1.0))

    def radial_factor(self, b2: Union[float, np.ndarray], use_fast_spline: bool = True) -> Union[float, np.ndarray]:
        """
        Dimensionless radial conduction decay factor V_r(b^2).
        For small b^2 <= 1e-10, V_r -> 1.0 (isothermal core).
        For large b^2 >= 100.0, V_r(b^2) asymptotes to 1.0 / (4.0 * b^2) based on the
        governing radial conduction integral (correcting preliminary literature draft typo of 1/(2*b^2)).
        """
        is_scalar = np.isscalar(b2)
        b2_arr = np.asarray(b2, dtype=np.float64)

        if np.any(b2_arr < 0.0):
            raise ValueError("b^2 parameter must be non-negative.")

        flat_b2 = np.atleast_1d(b2_arr)
        vr_flat = np.zeros_like(flat_b2)

        sing_mask = flat_b2 <= self._spline_b2_min
        vr_flat[sing_mask] = 1.0

        asymp_mask = flat_b2 >= 100.0
        if np.any(asymp_mask):
            vr_flat[asymp_mask] = 1.0 / (4.0 * flat_b2[asymp_mask])

        mid_mask = (~sing_mask) & (~asymp_mask)
        if np.any(mid_mask):
            if use_fast_spline:
                log_b2 = np.log10(flat_b2[mid_mask])
                vr_flat[mid_mask] = np.clip(self._vr_spline(log_b2), 0.0, 1.0)
            else:
                vr_flat[mid_mask] = np.array([
                    self._quad_radial_integral(float(value))
                    for value in flat_b2[mid_mask]
                ])

        vr_clipped = np.clip(vr_flat, 0.0, 1.0)
        res = vr_clipped.reshape(b2_arr.shape)
        return float(res) if is_scalar else res

    def compute_vr(self, b2: Union[float, np.ndarray], use_fast_spline: bool = True) -> Union[float, np.ndarray]:
        return self.radial_factor(b2, use_fast_spline=use_fast_spline)

    def vertical_factor(self, w: Union[float, np.ndarray], h: Optional[float] = None) -> Union[float, np.ndarray]:
        h_val = self.params.h if h is None else float(h)
        if h_val <= 0.0:
            raise ValueError("Net pay thickness h must be strictly positive.")

        is_scalar = np.isscalar(w)
        w_arr = np.asarray(w, dtype=np.float64)

        if np.any(w_arr < 0.0):
            raise ValueError("w parameter must be non-negative.")

        flat_w = np.atleast_1d(w_arr)
        vz_flat = np.zeros_like(flat_w)

        sing_thresh = 1e-12 * (h_val * h_val)
        sing_mask = flat_w <= sing_thresh
        vz_flat[sing_mask] = 1.0

        reg_mask = ~sing_mask
        if np.any(reg_mask):
            w_reg = flat_w[reg_mask]
            sqrt_w = np.sqrt(w_reg)
            arg = h_val / sqrt_w
            erf_term = erf(arg)
            bracket = np.expm1(-(h_val * h_val) / w_reg)
            exp_term = (sqrt_w / (h_val * np.sqrt(np.pi))) * bracket
            vz_flat[reg_mask] = erf_term + exp_term

        vz_clipped = np.clip(vz_flat, 0.0, 1.0)
        res = vz_clipped.reshape(w_arr.shape)
        return float(res) if is_scalar else res

    def compute_vz(self, w: Union[float, np.ndarray], h: Optional[float] = None) -> Union[float, np.ndarray]:
        return self.vertical_factor(w, h=h)

    def decay_factors(self, tau_seconds: Union[float, np.ndarray]) -> Tuple[Union[float, np.ndarray], Union[float, np.ndarray]]:
        tau_arr = np.asarray(tau_seconds, dtype=np.float64)
        b2 = (self.params.alpha * tau_arr) / (self.params.rh ** 2)
        w = 4.0 * self.params.alpha * tau_arr
        return self.radial_factor(b2), self.vertical_factor(w)

    def compute_df(self, t_days: Union[float, np.ndarray]) -> Union[float, np.ndarray]:
        """
        Empirical convective heat removal accumulator.
        Guarantees D_f(0) = 0 so that T_avg(0) identically equals initial steam temperature T_s,
        saturating at delta = 0.05 over production time.
        """
        t_d = np.maximum(np.asarray(t_days, dtype=np.float64), 0.0)
        df = self.params.delta * (t_d / (t_d + 5.0))
        return float(df) if np.isscalar(t_days) else df

    def temperature_avg(self, tau_seconds: Union[float, np.ndarray]) -> Union[float, np.ndarray]:
        """
        Computes the uncalibrated average heated-zone temperature T_avg (Kelvin).
        Note: T_avg represents the volumetrically averaged reservoir heated volume;
        downhole sandface temperature is derived via radial thermal gradient.
        """
        tau_arr = np.asarray(tau_seconds, dtype=np.float64)
        t_days = np.maximum(tau_arr / 86400.0, 0.0)
        d_f = self.compute_df(t_days)
        vr, vz = self.decay_factors(tau_seconds)
        heat_fraction = np.maximum(vr * vz * (1.0 - d_f), 0.0)
        t_avg = self.params.TR + (self.params.Ts - self.params.TR) * heat_fraction
        t_avg_clamped = np.clip(t_avg, self.params.TR, self.params.Ts)
        return float(t_avg_clamped) if np.isscalar(tau_seconds) else t_avg_clamped

    def temperature_avg_celsius(self, tau_seconds: Union[float, np.ndarray]) -> Union[float, np.ndarray]:
        t_k = self.temperature_avg(tau_seconds)
        return t_k - 273.15

    def dynamic_calibration_factor(self, tau_seconds: Union[float, np.ndarray]) -> Union[float, np.ndarray]:
        tau_arr = np.asarray(tau_seconds, dtype=np.float64)
        t_days = tau_arr / 86400.0
        t_non_neg = np.maximum(t_days, 0.0)
        k_hat = 1.0 - (1.0 - self.params.k_ref) * (t_non_neg / (self.params.t_ref + t_non_neg))
        return float(k_hat) if np.isscalar(tau_seconds) else k_hat

    def temperature_calibrated(
        self,
        tau_seconds: Union[float, np.ndarray],
        k_hat: Optional[Union[float, np.ndarray]] = None,
    ) -> Union[float, np.ndarray]:
        t_avg = self.temperature_avg(tau_seconds)
        if k_hat is None:
            k_val = self.dynamic_calibration_factor(tau_seconds)
        else:
            k_val = np.asarray(k_hat, dtype=np.float64)

        t_cal = self.params.TR + k_val * (t_avg - self.params.TR)
        t_cal_clamped = np.clip(t_cal, self.params.TR, self.params.Ts)
        return float(t_cal_clamped) if (np.isscalar(tau_seconds) and (k_hat is None or np.isscalar(k_hat))) else t_cal_clamped

    def temperature_celsius(
        self,
        tau_seconds: Union[float, np.ndarray],
        k_hat: Optional[Union[float, np.ndarray]] = None,
    ) -> Union[float, np.ndarray]:
        t_k = self.temperature_calibrated(tau_seconds, k_hat=k_hat)
        return t_k - 273.15

    def predict_temperature(
        self,
        t_days_or_hours: Union[float, np.ndarray],
        time_unit: str = "hours",
        cooling_multiplier: float = 1.0,
    ) -> Tuple[Union[float, np.ndarray], Union[float, np.ndarray]]:
        is_scalar = np.isscalar(t_days_or_hours)
        t_raw = np.atleast_1d(np.asarray(t_days_or_hours, dtype=np.float64))

        if np.any(t_raw < 0.0):
            raise ValueError("Elapsed production time cannot be negative.")

        if time_unit.lower() in ("days", "day", "d"):
            tau_sec = t_raw * 86400.0
            t_days = t_raw
        else:
            tau_sec = t_raw * 3600.0
            t_days = t_raw / 24.0

        alpha_eff = self.params.alpha * float(cooling_multiplier)
        b2 = (alpha_eff * tau_sec) / (self.params.rh ** 2)
        w = 4.0 * alpha_eff * tau_sec

        vr = self.radial_factor(b2)
        vz = self.vertical_factor(w)

        d_f = self.compute_df(t_days)
        heat_fraction = np.maximum(vr * vz * (1.0 - d_f), 0.0)

        t_avg_k = self.params.TR + (self.params.Ts - self.params.TR) * heat_fraction
        t_avg_k = np.clip(t_avg_k, self.params.TR, self.params.Ts)

        k_hat = self.params.k_ref + (1.0 - self.params.k_ref) * (self.params.t_ref / (self.params.t_ref + t_days))
        t_cal_k = self.params.TR + k_hat * (t_avg_k - self.params.TR)
        t_cal_k = np.clip(t_cal_k, self.params.TR, self.params.Ts)

        t_cal_c = t_cal_k - 273.15
        t_avg_c = t_avg_k - 273.15

        if is_scalar:
            return float(t_cal_c[0]), float(t_avg_c[0])
        return t_cal_c, t_avg_c

    def predict_temperature_with_uncertainty(
        self,
        t_days_or_hours: Union[float, np.ndarray],
        time_unit: str = "hours",
        cooling_multiplier: float = 1.0,
        tau_unc: float = 180.0,
    ) -> Tuple[Union[float, np.ndarray], Union[float, np.ndarray], Union[float, np.ndarray]]:
        """
        Returns calibrated temperature, average temperature, and propagated standard deviation sigma_T (°C).
        sigma_T models the epistemic uncertainty in subsurface heat conduction and convective loss.

        Parameters
        ----------
        tau_unc : float, default 180.0
            Uncertainty expansion time constant in days (matching code implementation,
            reconciling with the 30-day preliminary literature draft).
        """
        t_cal_c, t_avg_c = self.predict_temperature(
            t_days_or_hours, time_unit=time_unit, cooling_multiplier=cooling_multiplier
        )
        is_scalar = np.isscalar(t_days_or_hours)
        t_arr = np.atleast_1d(np.asarray(t_days_or_hours, dtype=np.float64))
        t_days = t_arr if time_unit.lower() in ("days", "day", "d") else t_arr / 24.0

        # Epistemic standard deviation: 2.0°C initial sensor noise expanding up to 5.0°C under cooling
        sigma_base = 2.0
        sigma_max = 5.0
        tau_uncertainty = float(tau_unc)  # days (default 180.0)
        sigma_t = sigma_base + (sigma_max - sigma_base) * (1.0 - np.exp(-t_days / tau_uncertainty))

        if is_scalar:
            return float(t_cal_c), float(t_avg_c), float(sigma_t[0])
        return t_cal_c, t_avg_c, sigma_t

    def fit_rise_multiplier(
        self,
        t_days: np.ndarray,
        t_meas_c: np.ndarray,
        reg_lambda: float = 0.05,
    ) -> Tuple[float, float]:
        """
        Calibrates asymptotic rise multiplier k_ref via regularized least squares on temperature rise (T - TR):
            Delta T_meas ~ k_hat(t) * (T_avg(t) - TR)
        Returns optimal k_ref and residual standard error (variance).
        """
        t_days_arr = np.asarray(t_days, dtype=np.float64)
        t_meas_arr = np.asarray(t_meas_c, dtype=np.float64)

        if len(t_days_arr) != len(t_meas_arr) or len(t_days_arr) == 0:
            raise ValueError("Input arrays must have non-zero matching lengths.")

        # Compute uncalibrated average temperatures
        tau_sec = t_days_arr * 86400.0
        t_avg_k = self.temperature_avg(tau_sec)
        delta_t_model = np.maximum(t_avg_k - self.params.TR, 1e-4)
        delta_t_meas = np.maximum((t_meas_arr + 273.15) - self.params.TR, 0.0)

        # Regress k_ref: k_hat = k_ref + (1 - k_ref) * (t_ref / (t_ref + t))
        # k_hat = 1.0 - (1.0 - k_ref) * (t / (t_ref + t))
        phi = t_days_arr / (self.params.t_ref + t_days_arr)
        # delta_t_meas / delta_t_model = 1.0 - (1.0 - k_ref) * phi
        y = 1.0 - (delta_t_meas / delta_t_model)
        # Estimate theta = (1.0 - k_ref) with ridge regularization around default prior (1 - 0.7042 = 0.2958)
        prior_theta = 1.0 - 0.7042
        theta_hat = (np.sum(phi * y) + reg_lambda * prior_theta) / (np.sum(phi ** 2) + reg_lambda)
        k_ref_opt = float(np.clip(1.0 - theta_hat, 0.30, 0.99))

        # Update params
        self.params.k_ref = k_ref_opt

        # Residual standard deviation
        pred_c, _ = self.predict_temperature(t_days_arr, time_unit="days")
        residual_var = float(np.mean((t_meas_arr - pred_c) ** 2))
        return k_ref_opt, residual_var

    def predict_decay_trajectory(
        self,
        times_days: Union[List[float], np.ndarray],
        cooling_multiplier: float = 1.0,
    ) -> Tuple[np.ndarray, np.ndarray]:
        calibrated, average = self.predict_temperature(
            np.asarray(times_days, dtype=np.float64),
            time_unit="days",
            cooling_multiplier=cooling_multiplier,
        )
        return np.asarray(calibrated), np.asarray(average)


# Compatibility aliases
BobergLantzThermalModel = ThermalDecayEngine
DEFAULT_THERMAL_ENGINE = ThermalDecayEngine()
