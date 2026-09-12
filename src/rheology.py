"""
Non-Newtonian Rheology & Annular Couette Shear Drag Engine (src/rheology.py)
Implements Two-Point Arrhenius Rheology, Multiphase Water-Cut Emulsion Mixing,
Couette Concentric/Eccentric Annular Shear Drag, and Section-Wise Rod Damping Profiles.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Union, Tuple, Optional, Any, Sequence
import math
import numpy as np


@dataclass
class RheologyParameters:
    """
    Rheology and geometric parameters for Baghewala heavy crude and tubular string.
    """
    T1_K: float = 323.15              # Reference state 1: 50°C (323.15 K)
    mu1_Pas: float = 12.0             # Viscosity at T1: 12.0 Pa.s (12,000 cP)
    T2_K: float = 473.15              # Reference state 2: 200°C (473.15 K)
    mu2_Pas: float = 0.045            # Viscosity at T2: 0.045 Pa.s (45 cP)
    mu_water_Pas: float = 0.001       # Produced water viscosity: 0.001 Pa.s (1 cP)
    rho_oil: float = 965.0            # Heavy crude density in kg/m^3 (~15° API)
    rho_water: float = 1000.0         # Produced saline water density in kg/m^3
    rho_rod: float = 7850.0           # API sucker rod steel density in kg/m^3
    D_tubing: float = 0.076           # Tubing ID (2.992 in = 0.076 m)
    f_eccentric: float = 1.25         # Non-concentric rod string oscillation multiplier
    nu_min: float = 0.01              # Minimum physical damping floor in s^-1
    nu_max: float = 3.00              # Maximum physical damping ceiling in s^-1

    # Backwards compatibility attributes
    tubing_id_m: Optional[float] = None
    eccentricity_factor: Optional[float] = None
    rho_steel: Optional[float] = None

    def __post_init__(self):
        if self.tubing_id_m is not None:
            self.D_tubing = self.tubing_id_m
        if self.eccentricity_factor is not None:
            self.f_eccentric = self.eccentricity_factor
        if self.rho_steel is not None:
            self.rho_rod = self.rho_steel

        if self.T1_K <= 0.0:
            raise ValueError("T1_K must be strictly positive.")
        if self.T2_K <= self.T1_K:
            raise ValueError("T2_K must exceed T1_K.")
        if self.mu1_Pas <= 0.0:
            raise ValueError("mu1_Pas must be strictly positive.")
        if self.mu2_Pas <= 0.0:
            raise ValueError("mu2_Pas must be strictly positive.")
        if self.mu1_Pas <= self.mu2_Pas:
            raise ValueError("Viscosity mu1 at lower temperature T1 must exceed mu2.")
        if self.mu_water_Pas <= 0.0:
            raise ValueError("mu_water_Pas must be strictly positive.")
        if self.rho_oil <= 0.0:
            raise ValueError("rho_oil must be strictly positive.")
        if self.rho_water <= 0.0:
            raise ValueError("rho_water must be strictly positive.")
        if self.rho_rod <= 0.0:
            raise ValueError("rho_rod must be strictly positive.")
        if self.D_tubing <= 0.0:
            raise ValueError("D_tubing must be strictly positive.")
        if self.f_eccentric < 1.0:
            raise ValueError("f_eccentric must be >= 1.0.")
        if self.nu_min <= 0.0:
            raise ValueError("nu_min must be strictly positive.")
        if self.nu_max <= self.nu_min:
            raise ValueError("nu_max of the system must exceed nu_min.")

    @property
    def T1_C(self) -> float:
        return self.T1_K - 273.15

    @property
    def T2_C(self) -> float:
        return self.T2_K - 273.15

    @property
    def mu1_cP(self) -> float:
        return self.mu1_Pas * 1000.0

    @property
    def mu2_cP(self) -> float:
        return self.mu2_Pas * 1000.0

    @property
    def mu_water_cP(self) -> float:
        return self.mu_water_Pas * 1000.0

    @property
    def r_tubing(self) -> float:
        return self.D_tubing / 2.0

    @property
    def r_tubing_m(self) -> float:
        return self.r_tubing

    def to_dict(self) -> Dict[str, Any]:
        return {
            "T1_K": self.T1_K,
            "mu1_Pas": self.mu1_Pas,
            "T2_K": self.T2_K,
            "mu2_Pas": self.mu2_Pas,
            "mu_water_Pas": self.mu_water_Pas,
            "rho_oil": self.rho_oil,
            "rho_water": self.rho_water,
            "rho_rod": self.rho_rod,
            "D_tubing": self.D_tubing,
            "f_eccentric": self.f_eccentric,
            "nu_min": self.nu_min,
            "nu_max": self.nu_max,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "RheologyParameters":
        return cls(
            T1_K=float(data.get("T1_K", 323.15)),
            mu1_Pas=float(data.get("mu1_Pas", 12.0)),
            T2_K=float(data.get("T2_K", 473.15)),
            mu2_Pas=float(data.get("mu2_Pas", 0.045)),
            mu_water_Pas=float(data.get("mu_water_Pas", 0.001)),
            rho_oil=float(data.get("rho_oil", 965.0)),
            rho_water=float(data.get("rho_water", 1000.0)),
            rho_rod=float(data.get("rho_rod", 7850.0)),
            D_tubing=float(data.get("D_tubing", 0.076)),
            f_eccentric=float(data.get("f_eccentric", 1.25)),
            nu_min=float(data.get("nu_min", 0.01)),
            nu_max=float(data.get("nu_max", 3.00)),
        )


@dataclass
class TaperSection:
    """Represents a discrete sucker rod string section in a tapered string."""
    section_id: int = 1
    name: str = ""
    top_depth_m: float = 0.0
    bottom_depth_m: float = 350.0
    diameter_m: float = 0.0254
    length: Optional[float] = None
    diameter: Optional[float] = None
    E: float = 2.07e11
    rho: float = 7850.0

    def __post_init__(self):
        if self.diameter is not None:
            self.diameter_m = self.diameter
        if self.length is not None:
            self.bottom_depth_m = self.top_depth_m + self.length

        if self.section_id <= 0:
            raise ValueError("section_id must be positive.")
        if self.top_depth_m < 0.0:
            raise ValueError("top_depth_m must be non-negative.")
        if self.bottom_depth_m <= self.top_depth_m:
            raise ValueError("bottom_depth_m of section must exceed top_depth_m.")
        if self.diameter_m <= 0.0:
            raise ValueError("diameter_m must be strictly positive.")

    @property
    def length_m(self) -> float:
        return self.bottom_depth_m - self.top_depth_m

    @property
    def radius_m(self) -> float:
        return self.diameter_m / 2.0

    @property
    def diameter_inches(self) -> float:
        return self.diameter_m / 0.0254

    @property
    def area_m2(self) -> float:
        return math.pi * (self.radius_m ** 2)

    @property
    def area(self) -> float:
        return self.area_m2


def get_default_baghewala_taper_sections() -> List[TaperSection]:
    """Returns standard 3-section tapered rod string (1150 m total)."""
    return [
        TaperSection(section_id=1, name="Top Section (1.0 in)", top_depth_m=0.0, bottom_depth_m=350.0, diameter_m=0.0254),
        TaperSection(section_id=2, name="Middle Section (7/8 in)", top_depth_m=350.0, bottom_depth_m=750.0, diameter_m=0.022225),
        TaperSection(section_id=3, name="Bottom Section (3/4 in)", top_depth_m=750.0, bottom_depth_m=1150.0, diameter_m=0.01905),
    ]


class HeavyOilRheology:
    """
    Two-Point Kelvin Arrhenius heavy crude rheology engine and annular drag calculator.

    Calibrated Arrhenius relationship: ln(mu [Pa.s]) = A + B / T_K
    Where A = -15.15 and B = 5,698.8 K derived from reference states:
      - T1 = 50°C (323.15 K) -> mu1 = 12.0 Pa.s (12,000.0 cP)
      - T2 = 200°C (473.15 K) -> mu2 = 0.045 Pa.s (45.0 cP)

    Evaluated two-point temperature-viscosity table:
      - 260°C (533.15 K): ~12.4 cP (0.0124 Pa.s) (reconciles preliminary draft's 40-50 cP)
      - 200°C (473.15 K): 45.0 cP (0.0450 Pa.s)
      - 100°C (373.15 K): ~1,180.0 cP (1.18 Pa.s) (reconciles preliminary draft's 850 cP)
      - 66°C (339.15 K): ~4,920.0 cP (4.92 Pa.s) (reconciles preliminary draft's 4,820 cP)
      - 50°C (323.15 K): 12,000.0 cP (12.0 Pa.s)
    """

    def __init__(self, params: Optional[RheologyParameters] = None, taper_sections: Optional[List[TaperSection]] = None):
        self.params = params if params is not None else RheologyParameters()
        self.taper_sections = taper_sections if taper_sections is not None else get_default_baghewala_taper_sections()

        # Calibrate Arrhenius coefficients: ln(mu) = A + B / T_K
        inv_T1 = 1.0 / self.params.T1_K
        inv_T2 = 1.0 / self.params.T2_K
        self.B = (math.log(self.params.mu1_Pas) - math.log(self.params.mu2_Pas)) / (inv_T1 - inv_T2)
        self.A_mu = math.log(self.params.mu1_Pas) - (self.B * inv_T1)
        self.B_arrhenius = self.B
        self.A_arrhenius = self.A_mu

    def calibrate_pvt_measurements(self, temperatures_c: Sequence[float], viscosities_pas: Sequence[float]) -> Tuple[float, float]:
        """
        Calibrates Arrhenius parameters A and B via linear regression on log(mu) vs 1/T_K:
            ln(mu) = A + B / T_K
        Updates model parameters from laboratory PVT rheometer measurements.
        """
        t_arr = np.asarray(temperatures_c, dtype=np.float64) + 273.15
        mu_arr = np.asarray(viscosities_pas, dtype=np.float64)
        if len(t_arr) < 2:
            raise ValueError("At least two PVT calibration points are required.")
        if np.any(mu_arr <= 0.0) or np.any(t_arr <= 0.0):
            raise ValueError("Temperatures and viscosities must be strictly positive.")

        inv_t = 1.0 / t_arr
        ln_mu = np.log(mu_arr)
        coeffs = np.polyfit(inv_t, ln_mu, deg=1)
        self.B = float(coeffs[0])
        self.A_mu = float(coeffs[1])
        self.B_arrhenius = self.B
        self.A_arrhenius = self.A_mu
        return self.A_mu, self.B

    def oil_viscosity(self, temp_k: Union[float, np.ndarray]) -> Union[float, np.ndarray]:
        """Dynamic viscosity of pure heavy crude in Pa.s."""
        is_scalar = np.isscalar(temp_k)
        t_arr = np.atleast_1d(np.asarray(temp_k, dtype=np.float64))

        if np.any(t_arr <= 0.0):
            raise ValueError("Temperature must be strictly positive Kelvin.")

        ln_mu = self.A_mu + (self.B / t_arr)
        mu = np.exp(ln_mu)
        return float(mu[0]) if is_scalar else mu

    def oil_viscosity_celsius(self, temp_c: Union[float, np.ndarray]) -> Union[float, np.ndarray]:
        is_scalar = np.isscalar(temp_c)
        t_arr = np.atleast_1d(np.asarray(temp_c, dtype=np.float64))
        return self.oil_viscosity(t_arr + 273.15) if not is_scalar else float(self.oil_viscosity(t_arr[0] + 273.15))

    def arrhenius_viscosity(self, temp: Union[float, np.ndarray], unit: str = "K") -> Union[float, np.ndarray]:
        if unit.upper() == "C":
            return self.oil_viscosity_celsius(temp)
        return self.oil_viscosity(temp)

    def mixture_viscosity(self, temp_k: Union[float, np.ndarray], fw: Union[float, np.ndarray] = 0.0) -> Union[float, np.ndarray]:
        """
        Non-linear Brinkman-Vand heavy crude emulsion viscosity model with phase inversion at fw = 0.60.
        For fw <= 0.60: droplet crowding surge mu_emul = mu_oil * [1.0 + 2.5*fw + 10.05*fw^2].
          Peak multiplier at inversion threshold fw = 0.60 reaches 1 + 2.5(0.60) + 10.05(0.36) = 6.1180x
          dry oil viscosity (reconciles preliminary text claiming 'up to 2.5 times').
        For fw > 0.60: rapid continuous inversion decay to oil-in-water rheology reaching mu_water at fw = 1.0.
        """
        is_scalar = np.isscalar(temp_k) and np.isscalar(fw)
        fw_arr = np.clip(np.asarray(fw, dtype=np.float64), 0.0, 1.0)
        mu_oil = self.oil_viscosity(temp_k)
        mu_water = self.params.mu_water_Pas

        # Peak multiplier at inversion threshold fw = 0.60: 1 + 2.5(0.60) + 10.05(0.36) = 6.1180
        peak_mult = 1.0 + 2.5 * 0.60 + 10.05 * (0.60 ** 2)  # 6.1180
        mu_peak = mu_oil * peak_mult

        if is_scalar:
            fw_val = float(fw_arr)
            mu_o = float(mu_oil)
            if fw_val <= 0.60:
                mu_mix = mu_o * (1.0 + 2.5 * fw_val + 10.05 * (fw_val ** 2))
            else:
                hat_f = (fw_val - 0.60) / 0.40
                decay = (1.0 - hat_f) * math.exp(-4.0 * hat_f)
                mu_p = mu_o * peak_mult
                mu_mix = mu_water + (mu_p - mu_water) * decay
            return float(mu_mix)

        # Vectorized array evaluation
        mult_crowd = 1.0 + 2.5 * fw_arr + 10.05 * (fw_arr ** 2)
        mu_crowd = mu_oil * mult_crowd

        hat_f = np.clip((fw_arr - 0.60) / 0.40, 0.0, 1.0)
        decay = (1.0 - hat_f) * np.exp(-4.0 * hat_f)
        mu_decay = mu_water + (mu_peak - mu_water) * decay

        mu_mix = np.where(fw_arr <= 0.60, mu_crowd, mu_decay)
        return mu_mix

    def compute_mixture_viscosity(self, temp_c: Union[float, np.ndarray], water_cut: float = 0.35) -> Union[float, np.ndarray]:
        is_scalar = np.isscalar(temp_c)
        t_arr = np.atleast_1d(np.asarray(temp_c, dtype=np.float64))
        res = self.mixture_viscosity(t_arr + 273.15, fw=water_cut)
        return float(res[0]) if is_scalar else res

    def emulsion_viscosity(self, temp: Union[float, np.ndarray], water_cut: float = 0.0, unit: str = "K") -> Union[float, np.ndarray]:
        if unit.upper() == "C":
            return self.compute_mixture_viscosity(temp, water_cut=water_cut)
        return self.mixture_viscosity(temp, fw=water_cut)

    def mixture_density(self, fw: float = 0.0) -> float:
        fw_clamped = float(np.clip(fw, 0.0, 1.0))
        return float((1.0 - fw_clamped) * self.params.rho_oil + fw_clamped * self.params.rho_water)

    def emulsion_density(self, water_cut: float = 0.0) -> float:
        return self.mixture_density(fw=water_cut)

    def geometric_drag_factor(self, rod_radius_m: float) -> float:
        r_r = float(rod_radius_m)
        if r_r <= 0.0:
            raise ValueError("Rod radius must be strictly positive.")
        if r_r >= self.params.r_tubing:
            raise ValueError("Rod radius must be strictly less than tubing inner radius.")
        return (2.0 * math.pi * self.params.f_eccentric) / math.log(self.params.r_tubing / r_r)

    def couette_drag_beta(self, mu_pas: Union[float, np.ndarray], rod_radius_m: Optional[Union[float, np.ndarray]] = None, r_rod: Optional[Union[float, np.ndarray]] = None) -> Union[float, np.ndarray]:
        """
        Computes Couette annular shear drag coefficient beta per unit rod length.

        Units:
        - beta has units of N*s/m (drag force per unit rod length per unit velocity:
          F_drag = beta * L * v in N).
        - When normalized by sheared rod circumference (2*pi*r_rod), the corresponding
          area shear factor beta_area = beta / (2*pi*r_rod) has units of N*s/m^2 (or Pa*s/m).
        """
        r_val = rod_radius_m if rod_radius_m is not None else r_rod
        if r_val is None:
            raise ValueError("Rod radius must be provided.")
        is_scalar = np.isscalar(mu_pas) and np.isscalar(r_val)
        r_arr = np.atleast_1d(np.asarray(r_val, dtype=np.float64))
        mu_arr = np.atleast_1d(np.asarray(mu_pas, dtype=np.float64))

        if np.any(r_arr <= 0.0):
            raise ValueError("Rod radius must be strictly positive.")
        if np.any(r_arr >= self.params.r_tubing):
            raise ValueError("Rod radius must be strictly less than tubing inner radius.")

        geom = (2.0 * math.pi * self.params.f_eccentric) / np.log(self.params.r_tubing / r_arr)
        beta = geom * mu_arr
        return float(beta[0]) if is_scalar else beta

    def couette_drag_coefficient_beta(self, rod_radius_m: Union[float, np.ndarray], temp: Union[float, np.ndarray], water_cut: float = 0.0, unit: str = "K") -> Union[float, np.ndarray]:
        t_k = (temp + 273.15) if unit.upper() == "C" else temp
        mu_mix = self.mixture_viscosity(t_k, fw=water_cut)
        return self.couette_drag_beta(mu_mix, rod_radius_m)

    def compute_couette_shear_drag(self, rod_radius_m: Union[float, np.ndarray], temp_c: float, water_cut: float = 0.35) -> Union[float, np.ndarray]:
        return self.couette_drag_coefficient_beta(rod_radius_m, temp_c, water_cut=water_cut, unit="C")

    def damping_nu(self, beta: Union[float, np.ndarray], rod_area_m2: Union[float, np.ndarray]) -> Union[float, np.ndarray]:
        is_scalar = np.isscalar(beta) and np.isscalar(rod_area_m2)
        b_arr = np.atleast_1d(np.asarray(beta, dtype=np.float64))
        a_arr = np.atleast_1d(np.asarray(rod_area_m2, dtype=np.float64))

        if np.any(a_arr <= 0.0):
            raise ValueError("Rod cross-sectional area must be strictly positive.")

        nu_raw = b_arr / (self.params.rho_rod * a_arr)
        nu_clamped = np.clip(nu_raw, self.params.nu_min, self.params.nu_max)
        return float(nu_clamped[0]) if is_scalar else nu_clamped

    def damping_ratio_nu(self, rod_radius_m: Union[float, np.ndarray], rod_area_m2: Union[float, np.ndarray], temp: Union[float, np.ndarray], water_cut: float = 0.0, unit: str = "K") -> Union[float, np.ndarray]:
        beta = self.couette_drag_coefficient_beta(rod_radius_m, temp, water_cut=water_cut, unit=unit)
        return self.damping_nu(beta, rod_area_m2)

    def compute_damping_nu(self, rod_radius_m: Union[float, np.ndarray], rod_area_m2: Union[float, np.ndarray], temp_c: float, water_cut: float = 0.35) -> Union[float, np.ndarray]:
        return self.damping_ratio_nu(rod_radius_m, rod_area_m2, temp_c, water_cut=water_cut, unit="C")

    def get_taper_section_at_depth(self, depth_m: float) -> TaperSection:
        d = float(depth_m)
        for sec in self.taper_sections:
            if sec.top_depth_m <= d < sec.bottom_depth_m or (sec.section_id == len(self.taper_sections) and d >= sec.top_depth_m):
                return sec
        return self.taper_sections[-1]

    def rod_radius_at_depth(self, depth_m: float) -> float:
        return self.get_taper_section_at_depth(depth_m).radius_m

    def rod_area_at_depth(self, depth_m: float) -> float:
        return self.get_taper_section_at_depth(depth_m).area_m2

    def compute_drag_profile(self, depths_m: Union[List[float], np.ndarray], T_K: float = 373.15, fw: float = 0.1) -> Tuple[np.ndarray, np.ndarray]:
        depths_arr = np.asarray(depths_m, dtype=np.float64)
        mu_mix = self.mixture_viscosity(T_K, fw=fw)
        betas = np.zeros_like(depths_arr)
        nus = np.zeros_like(depths_arr)

        for i, d in enumerate(depths_arr):
            sec = self.get_taper_section_at_depth(d)
            b = self.couette_drag_beta(mu_mix, sec.radius_m)
            nu = self.damping_nu(b, sec.area_m2)
            betas[i] = b
            nus[i] = nu
        return betas, nus

    def compute_dynamic_profile(self, depths_m: Union[List[float], np.ndarray], thermal_engine: Any, tau_seconds: float = 0.0, k_hat: float = 1.0, fw: float = 0.0) -> Tuple[np.ndarray, np.ndarray, float]:
        T_K = float(thermal_engine.temperature_calibrated(tau_seconds, k_hat=k_hat))
        betas, nus = self.compute_drag_profile(depths_m, T_K=T_K, fw=fw)
        return betas, nus, T_K

    def compute_taper_damping_profile(self, sections: List[TaperSection], temp: float, water_cut: float = 0.0, unit: str = "K") -> List[Dict]:
        profile = []
        for i, sec in enumerate(sections):
            beta = self.couette_drag_coefficient_beta(sec.radius_m, temp, water_cut=water_cut, unit=unit)
            nu = self.damping_nu(beta, sec.area_m2)
            profile.append({
                "section_index": i,
                "length_m": sec.length_m,
                "diameter_m": sec.diameter_m,
                "diameter_inches": sec.diameter_inches,
                "area_m2": sec.area_m2,
                "beta_N_s_m2": float(beta),
                "nu_s1": float(nu),
            })
        return profile


# Compatibility aliases
HeavyOilRheologyModel = HeavyOilRheology
DEFAULT_RHEOLOGY_MODEL = HeavyOilRheology()
