"""
Tier 1 Feature Test Suite: Data Adapter & Schema Ingestion Engine (Requirement R5).
Covers Features 17 and 18:
- Pydantic ingestion schemas with physical range validation.
- Regex heuristic header auto-mapping and confidence scoring.
- Multi-unit SI conversion matrix (pressure, temperature, viscosity, flow, length, load).
- Adaptive CSV parsing with bounded interior gap imputation (<= 3 samples).
"""

import datetime
import math
from pathlib import Path
import numpy as np
import pytest
from pydantic import ValidationError

from src.adapter import (
    AdaptiveCSVParser,
    ColumnMapper,
    ColumnMapping,
    LabPVTSample,
    SCADATelemetryPacket,
    StandardDynoCard,
    UnitConverter,
    WellConfiguration,
    WellTestRecord,
)


class TestPydanticIngestionSchemas:
    """Validates type safety and domain constraints across Pydantic data schemas."""

    def test_scada_telemetry_packet_valid(self):
        """Validates normal instantiation and calculated attributes of SCADATelemetryPacket."""
        pos = [0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 2.0, 1.5, 1.0, 0.5]
        loads = [100.0, 120.0, 150.0, 180.0, 190.0, 180.0, 120.0, 80.0, 60.0, 50.0]
        pkt = SCADATelemetryPacket(
            timestamp=datetime.datetime(2026, 9, 1, 10, 0, 0, tzinfo=datetime.timezone.utc),
            surface_position_m=pos,
            surface_load_kn=loads,
            spm=4.5,
            stroke_length_m=2.54,
            motor_power_kw=45.0,
            tubing_head_temp_c=180.0,
            confirmed=True,
            control_valid=True,
            provenance="[measured]",
        )
        assert pkt.spm == 4.5
        assert pkt.stroke_length_m == 2.54
        assert min(pkt.surface_load_kn) == 50.0
        assert max(pkt.surface_load_kn) == 190.0
        assert pkt.is_control_safe() is True

    def test_scada_telemetry_packet_insufficient_samples_rejected(self):
        """Packet with <10 dyno samples must be rejected."""
        with pytest.raises(ValidationError):
            SCADATelemetryPacket(
                timestamp=datetime.datetime(2026, 9, 1, 10, 0, 0, tzinfo=datetime.timezone.utc),
                surface_position_m=[0.0, 1.0, 2.0],
                surface_load_kn=[100.0, 150.0, 80.0],
                spm=4.5,
                stroke_length_m=2.54,
            )

    def test_scada_telemetry_packet_range_violations_rejected(self):
        """Physically impossible values (e.g. negative stroke, excessive SPM) must be rejected."""
        valid_pos = list(np.linspace(0, 2.54, 10))
        valid_load = list(np.linspace(50, 150, 10))

        with pytest.raises(ValidationError):
            # Negative SPM
            SCADATelemetryPacket(
                timestamp=datetime.datetime.now(datetime.timezone.utc),
                surface_position_m=valid_pos,
                surface_load_kn=valid_load,
                spm=-2.0,
                stroke_length_m=2.54,
            )

        with pytest.raises(ValidationError):
            # Stroke length > 10m
            SCADATelemetryPacket(
                timestamp=datetime.datetime.now(datetime.timezone.utc),
                surface_position_m=valid_pos,
                surface_load_kn=valid_load,
                spm=4.5,
                stroke_length_m=12.0,
            )

    def test_lab_pvt_sample_validation(self):
        """Validates LabPVTSample range checks."""
        sample = LabPVTSample(
            sample_id="PVT-BAGH-001",
            timestamp=datetime.datetime(2026, 9, 1, 12, 0, 0, tzinfo=datetime.timezone.utc),
            temperature_c=50.0,
            viscosity_cp=12000.0,
            density_kg_m3=950.0,
            water_cut_pct=15.0,
        )
        assert sample.viscosity_pa_s == 12.0
        assert sample.temperature_k == 323.15

        with pytest.raises(ValidationError):
            # Negative viscosity
            LabPVTSample(
                sample_id="BAD-PVT",
                timestamp=datetime.datetime.now(datetime.timezone.utc),
                temperature_c=50.0,
                viscosity_cp=-100.0,
                density_kg_m3=950.0,
                water_cut_pct=10.0,
            )

    def test_well_test_record_validation(self):
        """Validates WellTestRecord fields and water cut constraint."""
        record = WellTestRecord(
            test_id="TEST-2026-09",
            well_id="Baghewala-14",
            timestamp=datetime.datetime.now(datetime.timezone.utc),
            gross_liquid_rate_m3_day=50.0,
            oil_rate_m3_day=40.0,
            water_cut_pct=20.0,
            pump_fillage_pct=85.0,
        )
        assert record.gross_liquid_rate_m3_day == 50.0

        with pytest.raises(ValidationError):
            # Water cut > 100%
            WellTestRecord(
                test_id="BAD-TEST",
                well_id="Baghewala-14",
                timestamp=datetime.datetime.now(datetime.timezone.utc),
                gross_liquid_rate_m3_day=50.0,
                oil_rate_m3_day=40.0,
                water_cut_pct=120.0,
                pump_fillage_pct=85.0,
            )

    def test_standard_dyno_card_144_points_enforcement(self):
        """StandardDynoCard must strictly enforce 144 uniform phase points."""
        pos_144 = list(np.linspace(0, 2.54, 144))
        load_144 = list(np.linspace(50, 180, 144))

        card = StandardDynoCard(
            card_id="CARD-001",
            well_id="Baghewala-14",
            timestamp=datetime.datetime.now(datetime.timezone.utc),
            spm=4.5,
            stroke_length_m=2.54,
            position_m=pos_144,
            load_kn=load_144,
            card_type="surface",
            provenance="[measured]",
        )
        assert len(card.position_m) == 144
        assert len(card.load_kn) == 144
        assert card.min_load_kn == 50.0
        assert card.max_load_kn == 180.0

        # Reject 100 points
        with pytest.raises(ValidationError, match="144 uniform phase points"):
            StandardDynoCard(
                card_id="CARD-BAD",
                well_id="Baghewala-14",
                timestamp=datetime.datetime.now(datetime.timezone.utc),
                spm=4.5,
                stroke_length_m=2.54,
                position_m=pos_144[:100],
                load_kn=load_144[:100],
                card_type="surface",
                provenance="[measured]",
            )


class TestMultiUnitConversionMatrix:
    """Validates exact floating-point SI conversions across all physical quantities."""

    def test_force_conversions(self):
        """Converts lbf, klbf, kN, kgf to N."""
        # 1 lbf = 4.4482216152605 N
        assert math.isclose(UnitConverter.convert_force(1.0, "lbf", "N"), 4.4482216152605, rel_tol=1e-9)
        # 10 klbf = 44482.216152605 N
        assert math.isclose(UnitConverter.convert_force(10.0, "klbf", "N"), 44482.216152605, rel_tol=1e-9)
        # 50 kN = 50000 N
        assert math.isclose(UnitConverter.convert_force(50.0, "kN", "N"), 50000.0, rel_tol=1e-9)
        # 1 kgf = 9.80665 N
        assert math.isclose(UnitConverter.convert_force(1.0, "kgf", "N"), 9.80665, rel_tol=1e-9)

    def test_pressure_conversions(self):
        """Converts psi, bar, kPa, MPa, atm to Pa."""
        # 1 psi = 6894.757293168 Pa
        assert math.isclose(UnitConverter.convert_pressure(1.0, "psi", "Pa"), 6894.757293168, rel_tol=1e-9)
        # 10 bar = 1,000,000 Pa
        assert math.isclose(UnitConverter.convert_pressure(10.0, "bar", "Pa"), 1.0e6, rel_tol=1e-9)
        # 1 atm = 101325 Pa
        assert math.isclose(UnitConverter.convert_pressure(1.0, "atm", "Pa"), 101325.0, rel_tol=1e-9)
        # 2.5 MPa = 2,500,000 Pa
        assert math.isclose(UnitConverter.convert_pressure(2.5, "MPa", "Pa"), 2.5e6, rel_tol=1e-9)

    def test_temperature_conversions(self):
        """Converts degF, degC, K."""
        # 212 F = 100 C
        assert math.isclose(UnitConverter.convert_temperature(212.0, "degF", "degC"), 100.0, rel_tol=1e-7)
        # 32 F = 0 C
        assert math.isclose(UnitConverter.convert_temperature(32.0, "degF", "degC"), 0.0, abs_tol=1e-7)
        # 50 C = 323.15 K
        assert math.isclose(UnitConverter.convert_temperature(50.0, "degC", "K"), 323.15, rel_tol=1e-7)
        # 200 C = 473.15 K
        assert math.isclose(UnitConverter.convert_temperature(200.0, "degC", "K"), 473.15, rel_tol=1e-7)
        # 323.15 K = 50 C
        assert math.isclose(UnitConverter.convert_temperature(323.15, "K", "degC"), 50.0, rel_tol=1e-7)

    def test_viscosity_conversions(self):
        """Converts cP, mPa.s, Poise to Pa.s."""
        # 12,000 cP = 12.0 Pa.s
        assert math.isclose(UnitConverter.convert_viscosity(12000.0, "cP", "Pa.s"), 12.0, rel_tol=1e-9)
        # 45 cP = 0.045 Pa.s
        assert math.isclose(UnitConverter.convert_viscosity(45.0, "cP", "Pa.s"), 0.045, rel_tol=1e-9)
        # 10 Poise = 1.0 Pa.s
        assert math.isclose(UnitConverter.convert_viscosity(10.0, "P", "Pa.s"), 1.0, rel_tol=1e-9)

    def test_length_and_flow_conversions(self):
        """Converts ft, in to m; gpm, bpd to m3/s."""
        # 100 in = 2.54 m
        assert math.isclose(UnitConverter.convert_length(100.0, "in", "m"), 2.54, rel_tol=1e-9)
        # 3772.965879 ft = 1150 m
        assert math.isclose(UnitConverter.convert_length(1150.0 / 0.3048, "ft", "m"), 1150.0, rel_tol=1e-7)
        # 100 bpd to m3/s
        bpd_to_m3s = UnitConverter.convert_flow(100.0, "bpd", "m3/s")
        assert math.isclose(bpd_to_m3s, 100.0 * 0.158987294928 / 86400.0, rel_tol=1e-7)


class TestRegexHeuristicHeaderAutoMapping:
    """Validates fuzzy regex auto-mapping across noisy real-world SCADA headers."""

    def test_standard_headers_mapping(self):
        """Maps canonical clean headers with high confidence."""
        headers = ["timestamp", "position_m", "load_kn", "spm", "tubing_temp_c"]
        mappings = ColumnMapper.infer_mapping(headers)

        assert mappings["timestamp"].target_channel == "timestamp"
        assert mappings["timestamp"].confidence == 1.0

        assert mappings["position_m"].target_channel == "position"
        assert mappings["position_m"].confidence >= 0.90
        assert mappings["position_m"].detected_unit == "m"

        assert mappings["load_kn"].target_channel == "load"
        assert mappings["load_kn"].confidence >= 0.90
        assert mappings["load_kn"].detected_unit == "kn"

    def test_noisy_field_headers_mapping(self):
        """Maps variant alias headers with embedded unit hints."""
        noisy_headers = [
            "Time_Stamp",
            "POLISHED_ROD_LOAD_KLBS",
            "Stroke_Disp_in",
            "Speed_SPM",
            "BHT_degF",
        ]
        mappings = ColumnMapper.infer_mapping(noisy_headers)

        assert mappings["Time_Stamp"].target_channel == "timestamp"
        assert mappings["POLISHED_ROD_LOAD_KLBS"].target_channel == "load"
        assert mappings["POLISHED_ROD_LOAD_KLBS"].detected_unit == "klbf"

        assert mappings["Stroke_Disp_in"].target_channel == "position"
        assert mappings["Stroke_Disp_in"].detected_unit == "in"

        assert mappings["Speed_SPM"].target_channel == "spm"
        assert mappings["BHT_degF"].target_channel == "temperature"
        assert mappings["BHT_degF"].detected_unit == "degf"


class TestAdaptiveCSVParserAndGapImputation:
    """Validates end-to-end CSV ingestion, bounded interpolation, and safety gate inhibition."""

    def test_clean_csv_ingestion(self, temp_clean_scada_csv: Path):
        """Parses clean CSV file and converts columns to SI base units."""
        content = temp_clean_scada_csv.read_text(encoding="utf-8")
        dataset = AdaptiveCSVParser.parse_content(content)

        assert dataset.row_count == 11
        assert dataset.control_valid is True
        assert dataset.mapping_report["position_m"].confirmed is True
        assert dataset.mapping_report["load_kn"].confirmed is True
        assert "position" in dataset.column_data
        assert "load" in dataset.column_data

        # Convert to SCADA packet
        packets = dataset.to_scada_packets(stroke_length_m=2.54, spm_default=4.5)
        assert len(packets) == 1
        assert packets[0].is_control_safe() is True

    def test_messy_headers_csv_conversion(self, temp_messy_headers_scada_csv: Path):
        """Parses noisy CSV with imperial units and verifies exact SI conversion."""
        content = temp_messy_headers_scada_csv.read_text(encoding="utf-8")
        dataset = AdaptiveCSVParser.parse_content(content)

        assert dataset.row_count == 11
        assert dataset.control_valid is True

        # Position converted from in to m: 100.0 in -> 2.54 m
        max_pos = max(dataset.column_data["position"])
        assert math.isclose(max_pos, 2.54, rel_tol=1e-4)

        # Temperature converted from 356 degF -> 180 degC
        first_temp = dataset.column_data["temperature"][0]
        assert math.isclose(first_temp, 180.0, rel_tol=1e-4)

    def test_short_gap_interior_imputation(self, temp_short_gap_scada_csv: Path):
        """Short interior gaps (<= 3 samples) are linearly interpolated with imputed=True mask."""
        content = temp_short_gap_scada_csv.read_text(encoding="utf-8")
        dataset = AdaptiveCSVParser.parse_content(content)

        assert dataset.row_count == 11
        assert dataset.control_valid is True

        # Check that NaN at indices 2 and 3 was imputed
        pos = dataset.column_data["position"]
        assert not math.isnan(pos[2])
        assert not math.isnan(pos[3])
        assert math.isclose(pos[2], 1.0, abs_tol=1e-4)  # Linear interpolation between 0.5 and 2.0
        assert math.isclose(pos[3], 1.5, abs_tol=1e-4)

        assert dataset.imputed_mask["position"][2] is True
        assert dataset.imputed_mask["position"][3] is True

    def test_long_gap_inhibits_autonomous_control(self, temp_long_gap_scada_csv: Path):
        """Long gaps (> 3 samples) are NOT concealed; control_valid is flagged False."""
        content = temp_long_gap_scada_csv.read_text(encoding="utf-8")
        dataset = AdaptiveCSVParser.parse_content(content)

        assert dataset.control_valid is False
        assert any("gap" in w.lower() for w in dataset.warnings)
