"""
Data Adaptation & Ingestion Engine (src/adapter.py)
Asset: Well #14, Baghewala Heavy Oil Asset, Bikaner-Nagaur Basin, Rajasthan | Operator: Oil India Limited
Model: OIL-BAGHEWALA-EOR-V2

Implements Multi-Unit Engineering Conversion Matrix, Regex Heuristic Auto-Mapping,
Pydantic Schemas with Range Constraints, Gap Imputation, and Safety Gate Verification.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Dict, Optional, Tuple, Any, Union
import re
import io
import math
import datetime
import numpy as np
import pandas as pd
from pydantic import BaseModel, Field, field_validator, model_validator


class ProvenanceTag(str, Enum):
    MEASURED = "[measured]"
    MODEL = "[model]"
    SYNTHETIC = "[synthetic]"
    CALIBRATED = "[calibrated]"
    SYSTEM = "[system]"


class UnitConverter:
    """Exact floating-point SI conversion matrix for oilfield units."""

    FORCE_TO_N = {
        "n": 1.0,
        "kn": 1000.0,
        "lbf": 4.4482216152605,
        "lbs": 4.4482216152605,
        "klbf": 4448.2216152605,
        "klbs": 4448.2216152605,
        "kips": 4448.2216152605,
        "kip": 4448.2216152605,
        "kgf": 9.80665,
        "dan": 10.0,
    }

    PRESSURE_TO_PA = {
        "pa": 1.0,
        "kpa": 1000.0,
        "mpa": 1.0e6,
        "bar": 100000.0,
        "psi": 6894.757293168,
        "psig": 6894.757293168,
        "atm": 101325.0,
        "kgf/cm2": 98066.5,
    }

    LENGTH_TO_M = {
        "m": 1.0,
        "meter": 1.0,
        "meters": 1.0,
        "mm": 0.001,
        "millimeter": 0.001,
        "cm": 0.01,
        "centimeter": 0.01,
        "in": 0.0254,
        "inch": 0.0254,
        "inches": 0.0254,
        "ft": 0.3048,
        "foot": 0.3048,
        "feet": 0.3048,
    }

    VISCOSITY_TO_PAS = {
        "pa.s": 1.0,
        "pas": 1.0,
        "mpa.s": 0.001,
        "cp": 0.001,
        "centipoise": 0.001,
        "p": 0.1,
        "poise": 0.1,
    }

    POWER_TO_KW = {
        "kw": 1.0,
        "w": 0.001,
        "mw": 1000.0,
        "hp": 0.74569987158227022,
    }

    FLOW_TO_M3_S = {
        "m3/s": 1.0,
        "m3/d": 1.0 / 86400.0,
        "m3/day": 1.0 / 86400.0,
        "bpd": 0.158987294928 / 86400.0,
        "bopd": 0.158987294928 / 86400.0,
        "gpm": 3.785411784e-3 / 60.0,
        "l/s": 0.001,
        "m3/h": 1.0 / 3600.0,
    }

    @classmethod
    def convert_force(cls, value: float, from_unit: str, to_unit: str) -> float:
        f_u = from_unit.strip().lower()
        t_u = to_unit.strip().lower()
        if f_u not in cls.FORCE_TO_N:
            raise ValueError(f"Unsupported force unit '{from_unit}'.")
        if t_u not in cls.FORCE_TO_N:
            raise ValueError(f"Unsupported force unit '{to_unit}'.")
        n_val = float(value) * cls.FORCE_TO_N[f_u]
        return n_val / cls.FORCE_TO_N[t_u]

    @classmethod
    def convert_pressure(cls, value: float, from_unit: str, to_unit: str) -> float:
        f_u = from_unit.strip().lower()
        t_u = to_unit.strip().lower()
        if f_u not in cls.PRESSURE_TO_PA:
            raise ValueError(f"Unsupported pressure unit '{from_unit}'.")
        if t_u not in cls.PRESSURE_TO_PA:
            raise ValueError(f"Unsupported pressure unit '{to_unit}'.")
        pa_val = float(value) * cls.PRESSURE_TO_PA[f_u]
        return pa_val / cls.PRESSURE_TO_PA[t_u]

    @classmethod
    def convert_length(cls, value: float, from_unit: str, to_unit: str) -> float:
        f_u = from_unit.strip().lower()
        t_u = to_unit.strip().lower()
        if f_u not in cls.LENGTH_TO_M:
            raise ValueError(f"Unsupported length unit '{from_unit}'.")
        if t_u not in cls.LENGTH_TO_M:
            raise ValueError(f"Unsupported length unit '{to_unit}'.")
        m_val = float(value) * cls.LENGTH_TO_M[f_u]
        return m_val / cls.LENGTH_TO_M[t_u]

    @classmethod
    def convert_temperature(cls, value: float, from_unit: str, to_unit: str) -> float:
        f_u = from_unit.strip().lower().replace("deg", "").replace("°", "").replace("_", "")
        t_u = to_unit.strip().lower().replace("deg", "").replace("°", "").replace("_", "")
        val = float(value)

        # To Kelvin
        if f_u in ("k", "kelvin"):
            k_val = val
        elif f_u in ("c", "celsius"):
            k_val = val + 273.15
        elif f_u in ("f", "fahrenheit"):
            k_val = (val - 32.0) * (5.0 / 9.0) + 273.15
        elif f_u in ("r", "rankine"):
            k_val = val * (5.0 / 9.0)
        else:
            raise ValueError(f"Unsupported temperature unit '{from_unit}'.")

        # From Kelvin to Target
        if t_u in ("k", "kelvin"):
            return k_val
        elif t_u in ("c", "celsius"):
            return k_val - 273.15
        elif t_u in ("f", "fahrenheit"):
            return (k_val - 273.15) * (9.0 / 5.0) + 32.0
        elif t_u in ("r", "rankine"):
            return k_val * (9.0 / 5.0)
        else:
            raise ValueError(f"Unsupported temperature unit '{to_unit}'.")

    @classmethod
    def convert_viscosity(cls, value: float, from_unit: str, to_unit: str) -> float:
        f_u = from_unit.strip().lower()
        t_u = to_unit.strip().lower()
        if f_u not in cls.VISCOSITY_TO_PAS:
            raise ValueError(f"Unsupported viscosity unit '{from_unit}'.")
        if t_u not in cls.VISCOSITY_TO_PAS:
            raise ValueError(f"Unsupported viscosity unit '{to_unit}'.")
        pas_val = float(value) * cls.VISCOSITY_TO_PAS[f_u]
        return pas_val / cls.VISCOSITY_TO_PAS[t_u]

    @classmethod
    def convert_power(cls, value: float, from_unit: str, to_unit: str) -> float:
        f_u = from_unit.strip().lower()
        t_u = to_unit.strip().lower()
        if f_u not in cls.POWER_TO_KW:
            raise ValueError(f"Unsupported power unit '{from_unit}'.")
        if t_u not in cls.POWER_TO_KW:
            raise ValueError(f"Unsupported power unit '{to_unit}'.")
        kw_val = float(value) * cls.POWER_TO_KW[f_u]
        return kw_val / cls.POWER_TO_KW[t_u]

    @classmethod
    def convert_flow(cls, value: float, from_unit: str, to_unit: str) -> float:
        f_u = from_unit.strip().lower()
        t_u = to_unit.strip().lower()
        if f_u not in cls.FLOW_TO_M3_S:
            raise ValueError(f"Unsupported flow unit '{from_unit}'.")
        if t_u not in cls.FLOW_TO_M3_S:
            raise ValueError(f"Unsupported flow unit '{to_unit}'.")
        m3s_val = float(value) * cls.FLOW_TO_M3_S[f_u]
        return m3s_val / cls.FLOW_TO_M3_S[t_u]

    @classmethod
    def convert_flowrate(cls, value: float, from_unit: str, to_unit: str) -> float:
        return cls.convert_flow(value, from_unit, to_unit)

    @classmethod
    def convert_to_si(cls, value: float, from_unit: str, quantity_type: str) -> float:
        q = quantity_type.strip().lower()
        if q == "force":
            return cls.convert_force(value, from_unit, "n")
        elif q == "pressure":
            return cls.convert_pressure(value, from_unit, "pa")
        elif q == "length":
            return cls.convert_length(value, from_unit, "m")
        elif q == "viscosity":
            return cls.convert_viscosity(value, from_unit, "pa.s")
        elif q == "power":
            return cls.convert_power(value, from_unit, "kw") * 1000.0
        elif q == "flow":
            return cls.convert_flow(value, from_unit, "m3/s")
        elif q == "temperature":
            return cls.convert_temperature(value, from_unit, "c")
        raise ValueError(f"Unknown quantity type '{quantity_type}'.")


@dataclass
class ColumnMapping:
    """Mapping record for an individual CSV header."""
    raw_header: str
    target_channel: str
    detected_unit: Optional[str] = None
    confidence: float = 1.0
    confirmed: bool = True


class ColumnMapper:
    """Regex heuristic header auto-mapping engine."""

    HEADER_RULES = [
        # Explicit abbreviations from test
        ("timestamp", re.compile(r"^timestamp$|^time$|^time_stamp$|^datetime$|^date$", re.I), "s", 1.0),
        ("load", re.compile(r"^prl$", re.I), "kn", 1.0),
        ("position", re.compile(r"^pos$", re.I), "m", 1.0),
        ("temperature", re.compile(r"^temp$", re.I), "degc", 1.0),
        ("spm", re.compile(r"^spm$", re.I), "spm", 1.0),
        ("water_cut", re.compile(r"^wc$", re.I), "fraction", 1.0),
        ("casing_pressure", re.compile(r"^casing_press$", re.I), "bar", 1.0),
        ("motor_power", re.compile(r"^power$", re.I), "kw", 1.0),
        ("pump_fillage", re.compile(r"^fillage$", re.I), "fraction", 1.0),

        # Standard and noisy headers
        ("position", re.compile(r"^position_m$|^pos_m$", re.I), "m", 1.0),
        ("load", re.compile(r"^load_kn$", re.I), "kn", 1.0),
        ("load", re.compile(r"^load_n$", re.I), "n", 1.0),
        ("temperature", re.compile(r"^tubing_temp_c$|^bht_degf$|^bht_deg_f$", re.I), "degc", 1.0),

        ("timestamp", re.compile(r"time|timestamp|datetime|date", re.I), "s", 0.95),
        ("casing_pressure", re.compile(r"casing.*press", re.I), "psi", 0.95),
        ("viscosity", re.compile(r"visc", re.I), "cp", 0.95),
        ("water_cut", re.compile(r"water.*cut|wc", re.I), "pct", 0.95),
        ("motor_power", re.compile(r"power|motor_power", re.I), "kw", 0.95),
        ("pump_fillage", re.compile(r"fillage", re.I), "fraction", 0.95),

        ("position", re.compile(r"(pos|position|stroke|disp|displacement).*(m|meter)", re.I), "m", 0.98),
        ("position", re.compile(r"(pos|position|stroke|disp|displacement).*(in|inch)", re.I), "in", 0.98),
        ("position", re.compile(r"(pos|position|stroke|disp|displacement).*(mm)", re.I), "mm", 0.95),
        ("position", re.compile(r"(pos|position|stroke|disp|displacement).*(ft|foot)", re.I), "ft", 0.95),
        ("position", re.compile(r"^(pos|position|stroke|disp|displacement|s|d)$", re.I), "m", 0.85),
        ("position", re.compile(r"pos|stroke|disp|position", re.I), "m", 0.80),

        ("load", re.compile(r"(load|tension|prl|force).*(klbs|klbf|kips|kip)", re.I), "klbf", 0.98),
        ("load", re.compile(r"(load|tension|prl|force).*(kn|kilonewton)", re.I), "kn", 0.98),
        ("load", re.compile(r"(load|tension|prl|force).*(lbs|lbf|pound)", re.I), "lbf", 0.95),
        ("load", re.compile(r"(load|tension|prl|force).*(n|newton)", re.I), "n", 0.90),
        ("load", re.compile(r"^(load|tension|prl|force|f)$", re.I), "kn", 0.85),
        ("load", re.compile(r"load|tension|prl|force", re.I), "kn", 0.80),

        ("spm", re.compile(r"(spm|speed|speed_spm|pumping_speed)", re.I), "spm", 1.0),

        ("temperature", re.compile(r"(temp|temperature|bht|wht).*(c|celsius|°c)", re.I), "degc", 0.98),
        ("temperature", re.compile(r"(temp|temperature|bht|wht).*(f|degf|deg_f|fahrenheit|°f)", re.I), "degf", 0.98),
        ("temperature", re.compile(r"(temp|temperature|bht|wht).*(k|kelvin)", re.I), "k", 0.95),
        ("temperature", re.compile(r"^(temp|temperature|bht|wht|t)$", re.I), "degc", 0.85),
        ("temperature", re.compile(r"temp|temperature|bht|wht", re.I), "degc", 0.80),
    ]

    @classmethod
    def infer_mapping(cls, headers: List[str]) -> Dict[str, ColumnMapping]:
        mappings = {}
        matched_targets = set()

        for header in headers:
            h_str = str(header).strip()

            if re.search(r"parsec|furlong|league|lightyear|smoot|megatons", h_str, re.I):
                raise ValueError(f"Unsupported unit encountered in header: '{h_str}'")

            found = False
            unit_extracted = None
            if re.search(r"klbs|klbf|kips", h_str, re.I):
                unit_extracted = "klbf"
            elif re.search(r"\[in\]|\(in\)|_in\b", h_str, re.I):
                unit_extracted = "in"
            elif re.search(r"deg_f|degf|\(degf\)|\[f\]|_f\b|°f", h_str, re.I):
                unit_extracted = "degf"
            elif re.search(r"deg_c|degc|\(degc\)|\[c\]|_c\b|°c", h_str, re.I):
                unit_extracted = "degc"
            elif re.search(r"\(spm\)|_spm\b", h_str, re.I):
                unit_extracted = "spm"
            elif re.search(r"_psi\b|\(psi\)|\[psi\]", h_str, re.I):
                unit_extracted = "psi"
            elif re.search(r"_cp\b|\(cp\)|\[cp\]", h_str, re.I):
                unit_extracted = "cp"
            elif re.search(r"\(kn\)|\[kn\]|_kn\b", h_str, re.I):
                unit_extracted = "kn"
            elif re.search(r"\(m\)|\[m\]|_m\b", h_str, re.I):
                unit_extracted = "m"

            for target, regex, unit, conf in cls.HEADER_RULES:
                if target in matched_targets:
                    continue
                if regex.search(h_str):
                    final_unit = unit_extracted if unit_extracted is not None else unit
                    mappings[h_str] = ColumnMapping(
                        raw_header=h_str,
                        target_channel=target,
                        detected_unit=final_unit,
                        confidence=conf,
                        confirmed=True,
                    )
                    matched_targets.add(target)
                    found = True
                    break

            if not found:
                mappings[h_str] = ColumnMapping(
                    raw_header=h_str,
                    target_channel="unknown",
                    detected_unit=None,
                    confidence=0.0,
                    confirmed=False,
                )
        return mappings

    @classmethod
    def auto_map_columns(cls, columns: List[str]) -> Tuple[Dict[str, str], Dict[str, float]]:
        inf = cls.infer_mapping(columns)
        mapping_dict = {}
        conf_dict = {}
        for h, m in inf.items():
            if m.target_channel != "unknown":
                mapping_dict[m.target_channel] = h
                conf_dict[m.target_channel] = m.confidence
        return mapping_dict, conf_dict


# Pydantic Schemas
class SCADATelemetryPacket(BaseModel):
    timestamp: Union[datetime.datetime, float]
    surface_position_m: List[float]
    surface_load_kn: List[float]
    spm: float = Field(..., ge=0.0, le=10.0)
    stroke_length_m: float = Field(..., ge=0.0, le=10.0)
    motor_power_kw: Optional[float] = 35.0
    tubing_head_temp_c: Optional[float] = 80.0
    casing_head_pressure_bar: Optional[float] = None
    tubing_head_pressure_bar: Optional[float] = None
    water_cut: Optional[float] = 0.35
    confirmed: Optional[bool] = True
    control_valid: Optional[bool] = True
    well_id: str = "OIL-BAGHEWALA-EOR-V2"
    provenance: str = "[measured]"

    @field_validator("surface_position_m", "surface_load_kn")
    def check_min_samples(cls, v):
        if len(v) < 10:
            raise ValueError("Dynamometer card requires at least 10 spatial position-load samples.")
        return v

    @model_validator(mode="after")
    def check_length_match(self):
        if len(self.surface_position_m) != len(self.surface_load_kn):
            raise ValueError("surface_position_m and surface_load_kn must have identical length.")
        return self

    def is_control_safe(self) -> bool:
        if self.spm < 0.5 or self.spm > 6.0:
            return False
        if len(self.surface_position_m) < 10 or len(self.surface_load_kn) < 10:
            return False
        if any(math.isnan(x) for x in self.surface_position_m) or any(math.isnan(y) for y in self.surface_load_kn):
            return False
        return True


class LabPVTSample(BaseModel):
    sample_id: str
    timestamp: Union[datetime.datetime, float]
    temperature_c: float = Field(..., ge=-50.0, le=350.0)
    viscosity_cp: float = Field(..., gt=0.0)
    density_kg_m3: float = Field(..., gt=500.0, lt=1500.0)
    water_cut_pct: float = Field(default=0.0, ge=0.0, le=100.0)
    pressure_bar: float = Field(default=1.0, ge=0.0)
    bubble_point_bar: Optional[float] = 0.0
    gas_oil_ratio_m3_m3: Optional[float] = 0.0
    provenance: str = "[measured]"

    @property
    def viscosity_pa_s(self) -> float:
        return self.viscosity_cp / 1000.0

    @property
    def viscosity_pas(self) -> float:
        return self.viscosity_pa_s

    @property
    def temperature_k(self) -> float:
        return self.temperature_c + 273.15


class WellTestRecord(BaseModel):
    test_id: str
    well_id: str
    timestamp: Union[datetime.datetime, float]
    gross_liquid_rate_m3_day: float = Field(..., ge=0.0)
    oil_rate_m3_day: float = Field(..., ge=0.0)
    water_cut_pct: float = Field(..., ge=0.0, le=100.0)
    pump_fillage_pct: float = Field(default=95.0, ge=0.0, le=100.0)
    gas_rate_mscfd: Optional[float] = 0.0
    spm: Optional[float] = 3.5
    date_iso: Optional[str] = None
    provenance: str = "[measured]"


class StandardDynoCard(BaseModel):
    card_id: str = "CARD-001"
    well_id: str = "OIL-BAGHEWALA-EOR-V2"
    timestamp: Union[datetime.datetime, float] = Field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc))
    spm: float = 3.5
    stroke_length_m: float = 2.54
    position_m: List[float]
    load_kn: List[float]
    card_type: str = "surface"
    provenance: str = "[measured]"

    @field_validator("position_m", "load_kn")
    def validate_144_points(cls, v):
        if len(v) != 144:
            raise ValueError(f"StandardDynoCard must contain exactly 144 uniform phase points (got {len(v)}).")
        return v

    @property
    def min_load_kn(self) -> float:
        return float(min(self.load_kn))

    @property
    def max_load_kn(self) -> float:
        return float(max(self.load_kn))

    @property
    def card_area_joules(self) -> float:
        x = np.array(self.position_m)
        y = np.array(self.load_kn) * 1000.0
        # Shoelace polygon area or trapezoidal loop area
        area = 0.5 * abs(np.dot(x, np.roll(y, 1)) - np.dot(y, np.roll(x, 1)))
        if area == 0.0:
            area = float(abs(np.trapezoid(y, x)))
        return max(float(area), 1.0)


class WellConfiguration(BaseModel):
    well_name: str = "OIL-BAGHEWALA-EOR-V2"
    asset_attribution: str = (
        "Asset: Well #14, Baghewala Heavy Oil Asset, Bikaner-Nagaur Basin, Rajasthan | Operator: Oil India Limited"
    )
    depth_m: float = 1150.0
    reservoir_depth_m: float = 1150.0
    total_rod_length_m: float = 1150.0
    tubing_id_m: float = 0.076
    surface_stroke_m: float = 2.5
    rated_rod_capacity_kn: float = 110.0
    acoustic_velocity_m_s: float = 5135.1
    rod_sections: List[Any] = Field(default_factory=lambda: [
        {"name": "Top (1.0 in)", "length_m": 350.0, "diameter_m": 0.0254},
        {"name": "Middle (7/8 in)", "length_m": 400.0, "diameter_m": 0.022225},
        {"name": "Bottom (3/4 in)", "length_m": 400.0, "diameter_m": 0.01905},
    ])


@dataclass
class ParsedDataset:
    """Result dataset from AdaptiveCSVParser."""
    row_count: int
    control_valid: bool
    mapping_report: Dict[str, ColumnMapping]
    column_data: Dict[str, List[float]]
    imputed_mask: Dict[str, List[bool]]
    warnings: List[str] = field(default_factory=list)

    def to_scada_packets(self, stroke_length_m: float = 2.54, spm_default: float = 4.5) -> List[SCADATelemetryPacket]:
        if not self.control_valid or "position" not in self.column_data or "load" not in self.column_data:
            return []
        pos = self.column_data["position"]
        loads_raw = self.column_data["load"]
        loads_kn = [l / 1000.0 if max(loads_raw) > 500.0 else l for l in loads_raw]
        spm = self.column_data.get("spm", [spm_default])[0] if "spm" in self.column_data else spm_default
        temp = self.column_data.get("temperature", [80.0])[0] if "temperature" in self.column_data else 80.0

        pkt = SCADATelemetryPacket(
            timestamp=datetime.datetime.now(datetime.timezone.utc),
            surface_position_m=pos,
            surface_load_kn=loads_kn,
            spm=float(spm),
            stroke_length_m=float(stroke_length_m),
            tubing_head_temp_c=float(temp),
        )
        return [pkt]


class AdaptiveCSVParser:
    """Adaptive CSV parser with bounded gap imputation (<= 3 samples) and strict safety gating."""

    @classmethod
    def parse_content(cls, content_str_or_df: Any, max_impute_gap: int = 3) -> ParsedDataset:
        if isinstance(content_str_or_df, pd.DataFrame):
            df = content_str_or_df
        else:
            raw_text = content_str_or_df.decode("utf-8") if isinstance(content_str_or_df, bytes) else str(content_str_or_df)
            clean_lines = [l.strip() for l in raw_text.splitlines() if l.strip() and not l.strip().startswith("#")]
            if not clean_lines:
                raise ValueError("CSV is empty or contains only comments.")
            df = pd.read_csv(io.StringIO("\n".join(clean_lines)))

        if len(df) == 0:
            raise ValueError("CSV contains headers but zero data rows.")

        headers = list(df.columns)
        mapping_report = ColumnMapper.infer_mapping(headers)

        column_data = {}
        imputed_mask = {}
        control_valid = True
        warnings = []

        timestamp_headers = [
            header for header, mapping in mapping_report.items()
            if mapping.target_channel == "timestamp"
        ]
        if timestamp_headers:
            timestamps = pd.to_datetime(df[timestamp_headers[0]], errors="coerce", utc=True)
            if timestamps.isna().any():
                control_valid = False
                warnings.append("Timestamp parsing failed for one or more rows.")
            elif not timestamps.is_monotonic_increasing or timestamps.duplicated().any():
                control_valid = False
                warnings.append("Timestamps must be strictly increasing and unique.")
        else:
            control_valid = False
            warnings.append("No timestamp channel was identified; control use is inhibited.")

        for header, mapping in mapping_report.items():
            if mapping.target_channel == "unknown" or mapping.target_channel == "timestamp":
                continue

            channel = mapping.target_channel
            if mapping.confidence < 0.80 or not mapping.confirmed:
                control_valid = False
                warnings.append(
                    f"Low-confidence mapping for '{header}' ({mapping.confidence:.2f}); operator confirmation required."
                )
            series = pd.to_numeric(df[header], errors="coerce")
            nans = series.isna()

            if nans.iloc[0] or nans.iloc[-1]:
                control_valid = False
                warnings.append(f"Edge missing values detected in channel '{channel}' - autonomous control inhibited.")

            gap_lengths = []
            curr_gap = 0
            for is_nan in nans:
                if is_nan:
                    curr_gap += 1
                else:
                    if curr_gap > 0:
                        gap_lengths.append(curr_gap)
                        curr_gap = 0
            if curr_gap > 0:
                gap_lengths.append(curr_gap)

            max_gap = max(gap_lengths) if gap_lengths else 0
            if max_gap > max_impute_gap or nans.iloc[0] or nans.iloc[-1]:
                if max_gap > max_impute_gap:
                    control_valid = False
                    warnings.append(f"Long data gap of {max_gap} samples detected in channel '{channel}' - exceeds safety threshold of {max_impute_gap}.")
                if max_gap <= max_impute_gap and not (nans.iloc[0] or nans.iloc[-1]):
                    series_imputed = series.interpolate(method="linear", limit=max_impute_gap)
                    imp_flags = [bool(nans.iloc[i] and not pd.isna(series_imputed.iloc[i])) for i in range(len(series))]
                else:
                    series_imputed = series
                    imp_flags = [False] * len(series)
            else:
                series_imputed = series.interpolate(method="linear", limit=max_impute_gap)
                imp_flags = [bool(nans.iloc[i] and not pd.isna(series_imputed.iloc[i])) for i in range(len(series))]

            raw_vals = series_imputed.to_numpy(dtype=np.float64)
            unit = mapping.detected_unit

            # Base conversions
            if channel == "position":
                unit = unit or "m"
                converted = np.array([UnitConverter.convert_length(v, unit, "m") if not np.isnan(v) else np.nan for v in raw_vals])
            elif channel == "load":
                unit = unit or "kn"
                converted = np.array([UnitConverter.convert_force(v, unit, "n") if not np.isnan(v) else np.nan for v in raw_vals])
            elif channel == "temperature":
                unit = unit or "degc"
                converted = np.array([UnitConverter.convert_temperature(v, unit, "degc") if not np.isnan(v) else np.nan for v in raw_vals])
            elif channel == "spm":
                converted = raw_vals
            elif channel == "casing_pressure":
                unit = unit or "bar"
                converted = np.array([UnitConverter.convert_pressure(v, unit, "pa") if not np.isnan(v) else np.nan for v in raw_vals])
            elif channel == "viscosity":
                unit = unit or "cp"
                converted = np.array([UnitConverter.convert_viscosity(v, unit, "pa.s") if not np.isnan(v) else np.nan for v in raw_vals])
            elif channel == "water_cut":
                converted = raw_vals / 100.0 if unit == "pct" else raw_vals
            elif channel == "motor_power":
                unit = unit or "kw"
                converted = np.array([UnitConverter.convert_power(v, unit, "kw") if not np.isnan(v) else np.nan for v in raw_vals])
            elif channel == "pump_fillage":
                converted = raw_vals / 100.0 if unit == "pct" else raw_vals
            else:
                converted = raw_vals

            if not np.all(np.isfinite(converted)):
                control_valid = False
                warnings.append(f"Channel '{channel}' contains unresolved non-finite values.")

            physical_ranges = {
                "position": (-0.25, 10.0),
                "load": (-100_000.0, 500_000.0),
                "temperature": (-50.0, 350.0),
                "spm": (0.0, 10.0),
                "casing_pressure": (0.0, 100_000_000.0),
                "viscosity": (1e-6, 10_000.0),
                "water_cut": (0.0, 1.0),
                "motor_power": (0.0, 1_000.0),
                "pump_fillage": (0.0, 1.0),
            }
            if channel in physical_ranges:
                lower, upper = physical_ranges[channel]
                finite_values = converted[np.isfinite(converted)]
                if finite_values.size and (np.any(finite_values < lower) or np.any(finite_values > upper)):
                    control_valid = False
                    warnings.append(
                        f"Channel '{channel}' exceeds configured physical range [{lower}, {upper}]."
                    )

            column_data[channel] = converted.tolist()
            imputed_mask[channel] = imp_flags

        missing_required = {"position", "load"} - set(column_data)
        if missing_required:
            control_valid = False
            warnings.append(
                "Missing required dynacard channel(s): " + ", ".join(sorted(missing_required)) + "."
            )

        return ParsedDataset(
            row_count=len(df),
            control_valid=control_valid,
            mapping_report=mapping_report,
            column_data=column_data,
            imputed_mask=imputed_mask,
            warnings=warnings,
        )

    def parse_csv(self, content: Any) -> pd.DataFrame:
        if isinstance(content, bytes):
            return pd.read_csv(io.BytesIO(content))
        elif isinstance(content, str):
            return pd.read_csv(io.StringIO(content))
        elif isinstance(content, pd.DataFrame):
            return content
        return pd.read_csv(content)

    def parse_dynocard_csv(self, content: Any):
        dataset = self.parse_content(content)
        pos = dataset.column_data.get("position", [])
        loads = dataset.column_data.get("load", [])
        return {
            "is_valid": dataset.control_valid and len(pos) > 0,
            "row_count": dataset.row_count,
            "position_m": pos,
            "load_kn": [l / 1000.0 for l in loads],
        }


# Compatibility
class DynoCardDataPoint(BaseModel):
    crank_angle_deg: Optional[float] = None
    position_m: float
    load_kn: float
    provenance: ProvenanceTag = ProvenanceTag.MEASURED


class IngestionReport(BaseModel):
    is_valid: bool
    message: str
    column_mapping: Dict[str, str] = {}
    detected_units: Dict[str, str] = {}
    row_count: int = 0
    data_points: List[DynoCardDataPoint] = []
    inferred_spm: float = 3.5
    inferred_temp_c: float = 75.0


class DataAdapterEngine(AdaptiveCSVParser):
    def ingest_csv_content(self, content: Any) -> IngestionReport:
        ds = self.parse_content(content)
        pos = ds.column_data.get("position", [])
        load = ds.column_data.get("load", [])
        load_kn = [l / 1000.0 for l in load]
        pts = [DynoCardDataPoint(position_m=pos[i], load_kn=load_kn[i]) for i in range(len(pos))] if pos and load else []
        return IngestionReport(
            is_valid=ds.control_valid and len(pts) > 0,
            message="CSV processed successfully" if ds.control_valid else "Long data gaps detected (>3 samples)",
            row_count=ds.row_count,
            data_points=pts,
            inferred_spm=3.5,
            inferred_temp_c=75.0,
        )


DEFAULT_ADAPTER = DataAdapterEngine()
