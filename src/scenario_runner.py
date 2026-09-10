"""Deterministic synthetic scenarios for the advisory research prototype.

Baghewala is a contextual case-study label; no operator affiliation, field data,
or field calibration is represented by these presets.
"""

from dataclasses import dataclass
from enum import Enum
from typing import Dict, Any, Optional


class ScenarioType(str, Enum):
    SCENARIO_A_BASELINE_FAILURE = "SCENARIO_A_BASELINE_FAILURE"
    SCENARIO_B_COUPLED_TWIN = "SCENARIO_B_COUPLED_TWIN"
    SCENARIO_C_TELEMETRY_SEVERED = "SCENARIO_C_TELEMETRY_SEVERED"
    DEFAULT_OPERATION = "DEFAULT_OPERATION"


@dataclass
class ScenarioConfig:
    """Configuration bundle defining a complete physical simulation state."""
    name: str
    description: str
    cooling_multiplier: float
    elapsed_days: float
    target_spm: float
    water_cut: float
    steam_quality: float
    plunger_sand_wear: float
    mpc_enabled: bool
    modbus_severed: bool
    expected_spm: float
    expected_min_tension_kn: float
    expected_failsafe_state: str
    color_theme: str


def compute_expected_downhole_tension(
    cooling_multiplier: float,
    elapsed_days: float,
    spm: float,
    water_cut: float = 0.25,
    sand_wear: float = 0.20,
) -> float:
    """
    Compute expected minimum tension with the current reduced-order rod-card and
    thermal research models.
    """
    try:
        from src.thermal import ThermalDecayEngine
        from src.rod_conservative import ConservativeRodWaveSolver

        thermal = ThermalDecayEngine()
        t_res_c, _ = thermal.predict_temperature(
            float(elapsed_days),
            time_unit="days",
            cooling_multiplier=float(cooling_multiplier),
        )
        t_res_c = float(t_res_c)

        solver = ConservativeRodWaveSolver(dx=10.0)
        card = solver.simulate_card(
            spm=float(spm),
            temp_c=t_res_c,
            water_cut=water_cut,
            sand_wear=sand_wear,
            n_strokes=3,
        )
        return round(float(card.min_downhole_tension_kn), 2)
    except Exception as exc:
        raise RuntimeError("Synthetic scenario model evaluation failed") from exc


SCENARIO_PRESETS: Dict[ScenarioType, ScenarioConfig] = {
    ScenarioType.SCENARIO_A_BASELINE_FAILURE: ScenarioConfig(
        name="Scenario A: The Baghewala Freeze (Synthetic Compression Screen)",
        description=(
            "Runs a late-cycle CSS thermal decay stress case (day 491, 2.2x cooling -> 66.0°C) where "
            "emulsion viscosity rises sharply and the reduced-order card model predicts compression at 4.7 SPM."
        ),
        cooling_multiplier=2.20,
        elapsed_days=490.94,
        target_spm=4.7,
        water_cut=0.25,
        steam_quality=0.70,
        plunger_sand_wear=0.20,
        mpc_enabled=False,
        modbus_severed=False,
        expected_spm=4.7,
        expected_min_tension_kn=-1.80,
        expected_failsafe_state="LEVEL_3_EMERGENCY",
        color_theme="#dc2626",
    ),

    ScenarioType.SCENARIO_B_COUPLED_TWIN: ScenarioConfig(
        name="Scenario B: Constraint-Aware Speed Advisory",
        description=(
            "Applies the same late-cycle 66.0°C thermal state and evaluates the MPC governor "
            "recommendation (throttling from 4.7 to 2.8 SPM), keeping minimum downhole tension safely positive (+2.36 kN)."
        ),
        cooling_multiplier=2.20,
        elapsed_days=490.94,
        target_spm=4.7,
        water_cut=0.25,
        steam_quality=0.70,
        plunger_sand_wear=0.20,
        mpc_enabled=True,
        modbus_severed=False,
        expected_spm=2.8,
        expected_min_tension_kn=2.36,
        expected_failsafe_state="LEVEL_0_NORMAL",
        color_theme="#059669",
    ),

    ScenarioType.SCENARIO_C_TELEMETRY_SEVERED: ScenarioConfig(
        name="Scenario C: Synthetic Telemetry Timeout",
        description=(
            "Simulates telemetry older than 60 seconds. The supervisory software enters Level 2 and recommends "
            "a 2.0 SPM fallback; no Modbus connection, physical ramp, or actuator command is implemented."
        ),
        cooling_multiplier=1.65,
        elapsed_days=12.0,
        target_spm=4.2,
        water_cut=0.25,
        steam_quality=0.80,
        plunger_sand_wear=0.15,
        mpc_enabled=True,
        modbus_severed=True,
        expected_spm=2.0,
        expected_min_tension_kn=compute_expected_downhole_tension(1.65, 12.0, 2.0, 0.25, 0.15),
        expected_failsafe_state="LEVEL_2_PROTECTIVE",
        color_theme="#c2410c",
    ),

    ScenarioType.DEFAULT_OPERATION: ScenarioConfig(
        name="Default Synthetic Operating Case",
        description="Default uncalibrated Baghewala-inspired assumptions for demonstrating the CSS–SRP workflow.",
        cooling_multiplier=1.65,
        elapsed_days=12.0,
        target_spm=4.2,
        water_cut=0.25,
        steam_quality=0.80,
        plunger_sand_wear=0.15,
        mpc_enabled=True,
        modbus_severed=False,
        expected_spm=3.8,
        expected_min_tension_kn=compute_expected_downhole_tension(1.65, 12.0, 3.8, 0.25, 0.15),
        expected_failsafe_state="LEVEL_0_NORMAL",
        color_theme="#0284c7",
    ),
}


class ScenarioRunner:
    """Manages active scenario preset selection and parameter overrides."""
    _resolved_cache: Dict[ScenarioType, ScenarioConfig] = {}

    @classmethod
    def get_preset(cls, scenario_type: ScenarioType) -> ScenarioConfig:
        return SCENARIO_PRESETS.get(scenario_type, SCENARIO_PRESETS[ScenarioType.DEFAULT_OPERATION])

    @classmethod
    def compute_all_presets(cls) -> Dict[ScenarioType, ScenarioConfig]:
        """Pre-computes and caches physical presets for all scenarios."""
        cls._resolved_cache = {
            stype: cls.get_preset(stype)
            for stype in ScenarioType
        }
        return dict(cls._resolved_cache)
