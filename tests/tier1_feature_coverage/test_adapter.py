"""Tier 1 Feature Coverage Tests for Data Adapter (Requirement R5)."""

import datetime
import math
import pytest
import numpy as np

from src.adapter import (
    UnitConverter,
    ColumnMapper,
    AdaptiveCSVParser,
    SCADATelemetryPacket,
    LabPVTSample,
    WellTestRecord,
    StandardDynoCard,
    WellConfiguration,
)


class TestUnitConverter:
    """Tests for multi-unit SI conversion matrix."""

    def test_force_conversions(self):
        # 1 lbf = 4.4482216152605 N
        assert math.isclose(UnitConverter.convert_force(1.0, "lbf", "N"), 4.4482216152605, rel_tol=1e-7)
        # 1 klbf = 4.4482216152605 kN = 4448.2216152605 N
        assert math.isclose(UnitConverter.convert_force(1.0, "klbf", "kN"), 4.4482216152605, rel_tol=1e-7)
        assert math.isclose(UnitConverter.convert_force(10.0, "klbs", "N"), 44482.216152605, rel_tol=1e-7)
        # 1 kN = 1000 N
        assert math.isclose(UnitConverter.convert_force(5.0, "kN", "N"), 5000.0, rel_tol=1e-7)
        # 1 kgf = 9.80665 N
        assert math.isclose(UnitConverter.convert_force(100.0, "kgf", "N"), 980.665, rel_tol=1e-7)

    def test_pressure_conversions(self):
        # 1 psi = 6894.757293168 Pa
        assert math.isclose(UnitConverter.convert_pressure(1.0, "psi", "Pa"), 6894.757293168, rel_tol=1e-7)
        # 1 bar = 100,000 Pa
        assert math.isclose(UnitConverter.convert_pressure(1.0, "bar", "Pa"), 100000.0, rel_tol=1e-7)
        # 1 MPa = 1,000,000 Pa
        assert math.isclose(UnitConverter.convert_pressure(2.5, "MPa", "Pa"), 2500000.0, rel_tol=1e-7)
        # 1 kPa = 1,000 Pa
        assert math.isclose(UnitConverter.convert_pressure(50.0, "kPa", "Pa"), 50000.0, rel_tol=1e-7)
        # 1 atm = 101,325 Pa
        assert math.isclose(UnitConverter.convert_pressure(1.0, "atm", "Pa"), 101325.0, rel_tol=1e-7)

    def test_temperature_conversions(self):
        # 32 degF = 0 degC, 212 degF = 100 degC
        assert math.isclose(UnitConverter.convert_temperature(32.0, "degF", "degC"), 0.0, abs_tol=1e-7)
        assert math.isclose(UnitConverter.convert_temperature(212.0, "degF", "degC"), 100.0, abs_tol=1e-7)
        # 50 degC = 323.15 K
        assert math.isclose(UnitConverter.convert_temperature(50.0, "degC", "K"), 323.15, abs_tol=1e-7)
        # 200 degC = 473.15 K
        assert math.isclose(UnitConverter.convert_temperature(200.0, "degC", "K"), 473.15, abs_tol=1e-7)
        # 533.15 K = 260 degC
        assert math.isclose(UnitConverter.convert_temperature(533.15, "K", "degC"), 260.0, abs_tol=1e-7)

    def test_viscosity_conversions(self):
        # 12,000 cP = 12.0 Pa.s
        assert math.isclose(UnitConverter.convert_viscosity(12000.0, "cP", "Pa.s"), 12.0, rel_tol=1e-7)
        # 45 cP = 0.045 Pa.s
        assert math.isclose(UnitConverter.convert_viscosity(45.0, "cP", "Pa.s"), 0.045, rel_tol=1e-7)
        # 1 P = 0.1 Pa.s
        assert math.isclose(UnitConverter.convert_viscosity(10.0, "P", "Pa.s"), 1.0, rel_tol=1e-7)

    def test_flow_rate_conversions(self):
        # 1 gpm to m3/s
        gpm_to_m3s = 3.785411784e-3 / 60.0
        assert math.isclose(UnitConverter.convert_flow(100.0, "gpm", "m3/s"), 100.0 * gpm_to_m3s, rel_tol=1e-7)
        # 1 bpd = 0.158987294928 / 86400 m3/s
        bpd_to_m3s = 0.158987294928 / 86400.0
        assert math.isclose(UnitConverter.convert_flow(1000.0, "bpd", "m3/s"), 1000.0 * bpd_to_m3s, rel_tol=1e-7)
        # 86400 m3/day = 1.0 m3/s
        assert math.isclose(UnitConverter.convert_flow(86400.0, "m3/day", "m3/s"), 1.0, rel_tol=1e-7)

    def test_length_conversions(self):
        # 1 ft = 0.3048 m
        assert math.isclose(UnitConverter.convert_length(1000.0, "ft", "m"), 304.8, rel_tol=1e-7)
        # 1 in = 0.0254 m
        assert math.isclose(UnitConverter.convert_length(1.0, "in", "m"), 0.0254, rel_tol=1e-7)
        # 1000 mm = 1.0 m
        assert math.isclose(UnitConverter.convert_length(1000.0, "mm", "m"), 1.0, rel_tol=1e-7)

    def test_power_conversions(self):
        # 1 hp = 0.74569987158227022 kW
        assert math.isclose(UnitConverter.convert_power(100.0, "hp", "kW"), 74.569987158, rel_tol=1e-6)
        # 50000 W = 50.0 kW
        assert math.isclose(UnitConverter.convert_power(50000.0, "W", "kW"), 50.0, rel_tol=1e-7)

    def test_generic_convert_to_si(self):
        assert math.isclose(UnitConverter.convert_to_si(5000.0, "lbf", "force"), 5000.0 * 4.4482216152605, rel_tol=1e-7)
        assert math.isclose(UnitConverter.convert_to_si(100.0, "psi", "pressure"), 689475.7293168, rel_tol=1e-7)
        assert math.isclose(UnitConverter.convert_to_si(120.0, "in", "length"), 120.0 * 0.0254, rel_tol=1e-7)
        assert math.isclose(UnitConverter.convert_to_si(1500.0, "cP", "viscosity"), 1.5, rel_tol=1e-7)


class TestColumnMapper:
    """Tests for regex heuristic header auto-mapping engine."""

    def test_exact_aliases_mapping(self):
        headers = ["prl", "pos", "temp", "spm", "wc", "casing_press", "power", "fillage"]
        mapping = ColumnMapper.infer_mapping(headers)

        assert mapping["prl"].target_channel == "load"
        assert mapping["prl"].confidence >= 0.95
        assert mapping["pos"].target_channel == "position"
        assert mapping["pos"].confidence >= 0.95
        assert mapping["temp"].target_channel == "temperature"
        assert mapping["spm"].target_channel == "spm"
        assert mapping["wc"].target_channel == "water_cut"
        assert mapping["casing_press"].target_channel == "casing_pressure"
        assert mapping["power"].target_channel == "motor_power"
        assert mapping["fillage"].target_channel == "pump_fillage"

    def test_noisy_headers_with_units(self):
        headers = [
            "Polished_Rod_Load (klbs)",
            "Surface Position [in]",
            "BHT_deg_F",
            "Pumping Speed (SPM)",
            "Casing_Head_Pressure_psi",
            "Viscosity_cp",
        ]
        mapping = ColumnMapper.infer_mapping(headers)

        assert mapping["Polished_Rod_Load (klbs)"].target_channel == "load"
        assert mapping["Polished_Rod_Load (klbs)"].detected_unit.lower() == "klbf"

        assert mapping["Surface Position [in]"].target_channel == "position"
        assert mapping["Surface Position [in]"].detected_unit.lower() == "in"

        assert mapping["BHT_deg_F"].target_channel == "temperature"
        assert mapping["BHT_deg_F"].detected_unit.lower() == "degf"

        assert mapping["Pumping Speed (SPM)"].target_channel == "spm"
        assert mapping["Pumping Speed (SPM)"].detected_unit.lower() == "spm"

        assert mapping["Casing_Head_Pressure_psi"].target_channel == "casing_pressure"
        assert mapping["Casing_Head_Pressure_psi"].detected_unit.lower() == "psi"

        assert mapping["Viscosity_cp"].target_channel == "viscosity"
        assert mapping["Viscosity_cp"].detected_unit.lower() == "cp"


class TestPydanticModels:
    """Tests for Pydantic ingestion models."""

    def test_scada_packet_valid(self):
        pos = [round(float(x), 4) for x in range(20)]
        loads = [round(float(150.0 + 50.0 * (x / 20.0)), 2) for x in range(20)]
        packet = SCADATelemetryPacket(
            timestamp=datetime.datetime(2026, 9, 1, 12, 0, 0, tzinfo=datetime.timezone.utc),
            surface_position_m=pos,
            surface_load_kn=loads,
            spm=3.5,
            stroke_length_m=3.0,
            motor_power_kw=45.0,
            tubing_head_temp_c=55.0,
            casing_head_pressure_bar=12.5,
            tubing_head_pressure_bar=25.0,
            confirmed=True,
            control_valid=True,
            provenance="[measured]",
        )
        assert packet.spm == 3.5
        assert len(packet.surface_position_m) == 20
        assert len(packet.surface_load_kn) == 20
        assert packet.control_valid is True

    def test_scada_packet_length_mismatch_raises(self):
        with pytest.raises(ValueError):
            SCADATelemetryPacket(
                timestamp=datetime.datetime.now(datetime.timezone.utc),
                surface_position_m=[0.0] * 15,
                surface_load_kn=[100.0] * 16,
                spm=3.0,
                stroke_length_m=3.0,
            )

    def test_pvt_sample_properties(self):
        sample = LabPVTSample(
            sample_id="PVT-BAGH-2026-001",
            timestamp=datetime.datetime(2026, 9, 1, 8, 0, 0, tzinfo=datetime.timezone.utc),
            temperature_c=50.0,
            viscosity_cp=12000.0,
            density_kg_m3=960.0,
            water_cut_pct=15.0,
            bubble_point_bar=18.5,
            gas_oil_ratio_m3_m3=22.0,
            provenance="[measured]",
        )
        assert sample.viscosity_pa_s == 12.0
        assert sample.viscosity_pas == 12.0
        assert sample.temperature_k == 323.15

    def test_dyno_card_144_points(self):
        theta = np.linspace(0, 2 * np.pi, 144, endpoint=False)
        pos = (1.5 * (1 - np.cos(theta))).tolist()
        load = (120.0 + 60.0 * np.sin(theta)).tolist()
        card = StandardDynoCard(
            card_id="DYNO-20260901-001",
            well_id="Baghewala-14",
            timestamp=datetime.datetime(2026, 9, 1, 12, 0, 0, tzinfo=datetime.timezone.utc),
            spm=3.5,
            stroke_length_m=3.0,
            position_m=pos,
            load_kn=load,
            card_type="surface",
            provenance="[measured]",
        )
        assert len(card.position_m) == 144
        assert len(card.load_kn) == 144
        assert card.min_load_kn is not None
        assert card.max_load_kn is not None
        assert card.card_area_joules is not None
        assert card.card_area_joules > 0.0

    def test_well_configuration(self):
        config = WellConfiguration()
        assert config.reservoir_depth_m == 1150.0
        assert config.total_rod_length_m == 1150.0
        assert len(config.rod_sections) == 3
        assert config.acoustic_velocity_m_s > 5000.0


class TestAdaptiveCSVParser:
    """Tests for AdaptiveCSVParser with gap imputation."""

    def test_parse_clean_csv(self):
        csv_text = """timestamp,position_m,load_kn,spm
2026-09-01 12:00:00,0.0,150.0,3.5
2026-09-01 12:00:01,1.5,190.0,3.5
2026-09-01 12:00:02,3.0,210.0,3.5
2026-09-01 12:00:03,1.5,120.0,3.5
2026-09-01 12:00:04,0.0,150.0,3.5
"""
        parsed = AdaptiveCSVParser.parse_content(csv_text)
        assert parsed.row_count == 5
        assert parsed.control_valid is True
        assert "position" in parsed.column_data
        assert "load" in parsed.column_data
        assert parsed.column_data["load"][0] == 150000.0  # Converted to N

    def test_parse_csv_with_interior_gaps(self):
        csv_text = """time,pos_m,load_kn
2026-09-01 12:00:00,0.0,100.0
2026-09-01 12:00:01,NaN,NaN
2026-09-01 12:00:02,NaN,NaN
2026-09-01 12:00:03,3.0,190.0
"""
        parsed = AdaptiveCSVParser.parse_content(csv_text)
        assert parsed.row_count == 4
        assert parsed.control_valid is True
        assert math.isclose(parsed.column_data["position"][1], 1.0, abs_tol=1e-5)
        assert math.isclose(parsed.column_data["position"][2], 2.0, abs_tol=1e-5)
        assert parsed.imputed_mask["position"][1] is True
        assert parsed.imputed_mask["position"][2] is True

    def test_parse_csv_large_gap_fails_control_valid(self):
        csv_text = """time,pos_m,load_kn
2026-09-01 12:00:00,0.0,100.0
2026-09-01 12:00:01,NaN,NaN
2026-09-01 12:00:02,NaN,NaN
2026-09-01 12:00:03,NaN,NaN
2026-09-01 12:00:04,NaN,NaN
2026-09-01 12:00:05,3.0,190.0
"""
        parsed = AdaptiveCSVParser.parse_content(csv_text)
        assert parsed.control_valid is False
        assert np.isnan(parsed.column_data["position"][1])
