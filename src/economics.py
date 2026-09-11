"""Transparent, scenario-based commercial hypothesis model for VectroSync.

Values produced here are planning hypotheses, not realized savings. The model
keeps each driver dimensionally explicit and avoids double-counting continuous
production uplift and recaptured workover downtime.
"""

from dataclasses import asdict, dataclass
from typing import Any

# CEA (Central Electricity Authority, India) grid emission factor, FY2023-24
# baseline. This is a disclosed assumption, not a measurement; cite it
# explicitly wherever CO2-avoided figures are shown.
GRID_EMISSION_FACTOR_KG_CO2_PER_KWH = 0.716


@dataclass(frozen=True)
class EconomicAssumptions:
    name: str
    well_count: int
    baseline_failures_per_well_year: float
    residual_failures_per_well_year: float
    workover_cost_inr: float
    energy_saved_kwh_well_day: float
    electricity_tariff_inr_kwh: float
    avoided_downtime_days_per_well_year: float
    deferred_oil_rate_bopd: float
    oil_price_usd_bbl: float
    fx_inr_usd: float
    annual_platform_cost_inr: float = 0.0

    def validate(self) -> None:
        values = asdict(self)
        if self.well_count <= 0:
            raise ValueError("well_count must be positive")
        for key, value in values.items():
            if key == "name":
                continue
            if float(value) < 0.0:
                raise ValueError(f"{key} must be non-negative")
        if self.residual_failures_per_well_year > self.baseline_failures_per_well_year:
            raise ValueError("residual failure rate cannot exceed baseline in a savings case")


def evaluate_case(case: EconomicAssumptions) -> dict[str, Any]:
    """Evaluate one annual value hypothesis with traceable arithmetic."""
    case.validate()
    avoided_failures = case.well_count * (
        case.baseline_failures_per_well_year - case.residual_failures_per_well_year
    )
    workover = avoided_failures * case.workover_cost_inr
    energy = (
        case.well_count
        * case.energy_saved_kwh_well_day
        * 365.0
        * case.electricity_tariff_inr_kwh
    )
    recaptured_barrels = (
        case.well_count
        * case.avoided_downtime_days_per_well_year
        * case.deferred_oil_rate_bopd
    )
    deferment = recaptured_barrels * case.oil_price_usd_bbl * case.fx_inr_usd
    gross = workover + energy + deferment
    net = gross - case.annual_platform_cost_inr

    energy_saved_kwh_per_year = case.well_count * case.energy_saved_kwh_well_day * 365.0
    co2_avoided_tonnes_per_year = (
        energy_saved_kwh_per_year * GRID_EMISSION_FACTOR_KG_CO2_PER_KWH / 1000.0
    )

    return {
        "case": case.name,
        "currency": "INR",
        "evidence_status": "commercial_hypothesis_not_field_validated",
        "well_count": case.well_count,
        "avoided_failures_per_year": round(avoided_failures, 3),
        "recaptured_barrels_per_year": round(recaptured_barrels, 1),
        "workover_avoidance_cr_inr": round(workover / 1e7, 3),
        "power_efficiency_cr_inr": round(energy / 1e7, 3),
        "oil_uplift_cr_inr": round(deferment / 1e7, 3),
        "gross_annual_value_cr_inr": round(gross / 1e7, 3),
        "annual_platform_cost_cr_inr": round(case.annual_platform_cost_inr / 1e7, 3),
        "total_annual_value_cr_inr": round(net / 1e7, 3),
        "energy_saved_kwh_per_year": round(energy_saved_kwh_per_year, 1),
        "co2_avoided_tonnes_per_year": round(co2_avoided_tonnes_per_year, 2),
        "grid_emission_factor_kg_co2_per_kwh": GRID_EMISSION_FACTOR_KG_CO2_PER_KWH,
        "assumptions": asdict(case),
    }


ECONOMIC_CASES = {
    "low": EconomicAssumptions(
        name="low",
        well_count=23,
        baseline_failures_per_well_year=1.2,
        residual_failures_per_well_year=0.8,
        workover_cost_inr=600_000.0,
        energy_saved_kwh_well_day=20.0,
        electricity_tariff_inr_kwh=7.0,
        avoided_downtime_days_per_well_year=7.0,
        deferred_oil_rate_bopd=25.0,
        oil_price_usd_bbl=60.0,
        fx_inr_usd=82.0,
        annual_platform_cost_inr=3_000_000.0,
    ),
    "base": EconomicAssumptions(
        name="base",
        well_count=23,
        baseline_failures_per_well_year=2.4,
        residual_failures_per_well_year=0.35,
        workover_cost_inr=850_000.0,
        energy_saved_kwh_well_day=48.0,
        electricity_tariff_inr_kwh=7.5,
        avoided_downtime_days_per_well_year=18.0,
        deferred_oil_rate_bopd=42.0,
        oil_price_usd_bbl=75.0,
        fx_inr_usd=83.5,
        annual_platform_cost_inr=3_000_000.0,
    ),
    "high": EconomicAssumptions(
        name="high",
        well_count=23,
        baseline_failures_per_well_year=3.0,
        residual_failures_per_well_year=0.25,
        workover_cost_inr=1_100_000.0,
        energy_saved_kwh_well_day=70.0,
        electricity_tariff_inr_kwh=9.0,
        avoided_downtime_days_per_well_year=25.0,
        deferred_oil_rate_bopd=55.0,
        oil_price_usd_bbl=90.0,
        fx_inr_usd=86.0,
        annual_platform_cost_inr=3_000_000.0,
    ),
}


def sensitivity_analysis() -> dict[str, Any]:
    results = {name: evaluate_case(case) for name, case in ECONOMIC_CASES.items()}
    return {
        "status": "hypothesis",
        "decision_rule": "replace assumptions with operator-approved data before investment approval",
        "low": results["low"],
        "base": results["base"],
        "high": results["high"],
    }
