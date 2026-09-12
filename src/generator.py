"""
Coupled Synthetic Data Generator (src/generator.py)
Generates Physics-Coupled CSS + SRP Production History, Dynamometer Cards,
and Realistic Sensor Telemetry with Calibrated Noise for Benchmarking and Ingestion.
"""

from typing import Dict, List, Tuple, Any
import numpy as np
import pandas as pd

from src.thermal import BobergLantzThermalModel, DEFAULT_THERMAL_ENGINE
from src.rheology import HeavyOilRheologyModel, DEFAULT_RHEOLOGY_MODEL
from src.rod_conservative import ConservativeTaperedRodSolver, DEFAULT_WAVE_SOLVER


class CoupledDataGenerator:
    """
    Synthetic ground-truth and noisy SCADA telemetry generator for CSS-SRP wells.
    """

    def __init__(
        self,
        thermal_model: BobergLantzThermalModel = None,
        rheology_model: HeavyOilRheologyModel = None,
        wave_solver: ConservativeTaperedRodSolver = None,
    ):
        self.thermal = thermal_model if thermal_model is not None else DEFAULT_THERMAL_ENGINE
        self.rheology = rheology_model if rheology_model is not None else DEFAULT_RHEOLOGY_MODEL
        self.solver = wave_solver if wave_solver is not None else DEFAULT_WAVE_SOLVER

    def generate_field_history(
        self,
        n_days: int = 120,
        samples_per_day: int = 4,
        cooling_multiplier: float = 1.0,
        water_cut: float = 0.35,
        noise_std_temp: float = 0.6,
        noise_std_load: float = 0.4,
        seed: int = 42,
    ) -> pd.DataFrame:
        """
        Generates continuous multi-week production history.
        """
        np.random.seed(seed)
        total_samples = n_days * samples_per_day
        time_hours = np.linspace(1.0, n_days * 24.0, total_samples)

        records = []
        for t_h in time_hours:
            t_cal, t_avg = self.thermal.predict_temperature(t_h, cooling_multiplier=cooling_multiplier)
            mu_mix = self.rheology.compute_mixture_viscosity(t_cal, water_cut=water_cut)
            beta_top = self.rheology.compute_couette_shear_drag(0.0254 / 2.0, t_cal, water_cut=water_cut)

            # Simulated uncoupled operator baseline SPM
            spm = 4.2 if t_cal > 90.0 else 3.8

            # Add sensor noise
            noisy_temp = t_cal + np.random.normal(0.0, noise_std_temp)
            pprl_base = 72.0 + (beta_top / 50.0) * 1.5
            noisy_pprl = pprl_base + np.random.normal(0.0, noise_std_load)
            mprl_base = 25.0 - (beta_top / 40.0) * 1.2
            noisy_mprl = mprl_base + np.random.normal(0.0, noise_std_load)

            records.append({
                "day": t_h / 24.0,
                "elapsed_hours": t_h,
                "temperature_true_c": t_cal,
                "wellhead_temp_c": noisy_temp,
                "oil_viscosity_pa_s": mu_mix,
                "drag_beta_n_s_m2": beta_top,
                "spm": spm,
                "pprl_kn": noisy_pprl,
                "mprl_kn": noisy_mprl,
            })

        return pd.DataFrame(records)

    def generate_dyno_card_csv(
        self,
        spm: float = 3.5,
        temp_c: float = 80.0,
        water_cut: float = 0.35,
        noise_level: float = 0.25,
    ) -> str:
        """
        Generates a 144-point surface dynamometer card as CSV text for drag-and-drop testing.
        """
        card = self.solver.simulate_card(spm=spm, temp_c=temp_c, water_cut=water_cut)
        pos = np.array(card["surface_position_m"])
        load = np.array(card["surface_load_kn"]) + np.random.normal(0.0, noise_level, len(pos))

        df = pd.DataFrame({
            "Stroke_Position_m": np.round(pos, 4),
            "Polished_Rod_Load_kN": np.round(load, 2),
            "Wellhead_Temp_C": np.round(temp_c + np.random.normal(0.0, 0.3, len(pos)), 2),
            "Pump_SPM": np.round(spm, 2),
        })
        return df.to_csv(index=False)

    def generate_ab_benchmark_experiment(
        self,
        n_steps: int = 24,
        seed: int = 42,
    ) -> Dict[str, Any]:
        """
        Executes the deterministic shared-seed A/B experiment (§2.2 of IMPROVEMENT_PLAN.md).
        Both Branch A (Uncoupled Baseline at 4.7 SPM) and Branch B (Coupled MPC Twin)
        receive the EXACT SAME latent disturbances (soak cooling) and measurement noise.
        """
        from src.controller import FastMPCController, MPCConfig, WellState

        rng = np.random.RandomState(seed)
        hours = np.linspace(0.0, 12.0, n_steps)
        temps = 80.0 - 25.0 * ((hours / 12.0) ** 1.2)

        baseline_records = []
        coupled_records = []

        mpc = FastMPCController(MPCConfig(min_tension_kN=0.50))
        active_spm = 4.7

        for i, (h, t_true) in enumerate(zip(hours, temps)):
            noise_t = float(rng.normal(0.0, 0.4))
            noise_load = float(rng.normal(0.0, 0.5))

            t_meas = float(t_true + noise_t)
            mu_true = float(self.rheology.mixture_viscosity(t_true + 273.15, fw=0.35))

            # Branch A: Uncoupled Baseline (fixed 4.7 SPM)
            spm_a = 4.7
            card_a = self.solver.simulate_card(spm=spm_a, temp_c=t_true, water_cut=0.35)
            min_tens_a = float(card_a.min_downhole_tension_kn)

            baseline_records.append({
                "hour": round(float(h), 2),
                "temperature_true_c": round(float(t_true), 2),
                "temperature_meas_c": round(float(t_meas), 2),
                "viscosity_pa_s": round(mu_true, 3),
                "spm": spm_a,
                "min_tension_kn": round(min_tens_a, 2),
                "is_floating": bool(min_tens_a < 0.0),
                "pprl_kn": round(float(card_a.pprl_kn) + noise_load, 2),
            })

            # Branch B: Coupled MPC Twin
            forecast_remaining = [float(t) for t in temps[i:]]
            if len(forecast_remaining) < 24:
                forecast_remaining += [forecast_remaining[-1]] * (24 - len(forecast_remaining))

            st = WellState(spm_current=active_spm, temperature_C=t_meas, viscosity_Pas=mu_true)
            plan = mpc.solve(st, forecast_remaining)
            active_spm = plan.optimal_spm

            card_b = self.solver.simulate_card(spm=active_spm, temp_c=t_true, water_cut=0.35)
            min_tens_b = float(card_b.min_downhole_tension_kn)

            coupled_records.append({
                "hour": round(float(h), 2),
                "temperature_true_c": round(float(t_true), 2),
                "temperature_meas_c": round(float(t_meas), 2),
                "viscosity_pa_s": round(mu_true, 3),
                "spm": round(float(active_spm), 2),
                "min_tension_kn": round(min_tens_b, 2),
                "is_floating": bool(min_tens_b < 0.0),
                "pprl_kn": round(float(card_b.pprl_kn) + noise_load, 2),
            })

        return {
            "seed": seed,
            "hours": [round(float(h), 2) for h in hours],
            "baseline": baseline_records,
            "coupled": coupled_records,
            "baseline_float_count": sum(1 for r in baseline_records if r["is_floating"]),
            "coupled_float_count": sum(1 for r in coupled_records if r["is_floating"]),
        }


# Default Singleton
DEFAULT_DATA_GENERATOR = CoupledDataGenerator()
