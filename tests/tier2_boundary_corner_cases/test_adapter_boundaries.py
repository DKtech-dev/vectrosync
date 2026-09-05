"""Tier 2 Boundary and Corner Case Tests for Data Adapter (Requirement R5)."""

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
    StandardDynoCard,
)


class TestAdapterBoundaries:
    """Boundary and edge case tests for UnitConverter, ColumnMapper, and AdaptiveCSVParser."""

    def test_temperature_at_absolute_zero(self):
        # -273.15 degC is 0 K
        assert math.isclose(UnitConverter.convert_temperature(-273.15, "degC", "K"), 0.0, abs_tol=1e-6)
        # -459.67 degF is 0 K
        assert math.isclose(UnitConverter.convert_temperature(-459.67, "degF", "K"), 0.0, abs_tol=1e-2)

    def test_extreme_pressures(self):
        # 0 psi is 0 Pa
        assert UnitConverter.convert_pressure(0.0, "psi", "Pa") == 0.0
        # 100 MPa is 1e8 Pa
        assert UnitConverter.convert_pressure(100.0, "MPa", "Pa") == 1e8

    def test_empty_or_comment_only_csv_raises(self):
        with pytest.raises(ValueError, match="empty or contains only comments"):
            AdaptiveCSVParser.parse_content("# Comment only line 1\n# Comment only line 2\n")

    def test_headers_with_no_data_raises(self):
        with pytest.raises(ValueError, match="zero data rows"):
            AdaptiveCSVParser.parse_content("timestamp,position_m,load_kn\n")

    def test_exact_gap_boundary_3_vs_4(self):
        # 3 missing samples -> must be imputed, control_valid True
        csv_3 = """time,pos_m,load_kn
2026-09-01 10:00:00,0.0,100.0
2026-09-01 10:00:01,NaN,NaN
2026-09-01 10:00:02,NaN,NaN
2026-09-01 10:00:03,NaN,NaN
2026-09-01 10:00:04,4.0,200.0
"""
        p3 = AdaptiveCSVParser.parse_content(csv_3)
        assert p3.control_valid is True
        assert math.isclose(p3.column_data["position"][1], 1.0, abs_tol=1e-5)
        assert math.isclose(p3.column_data["position"][2], 2.0, abs_tol=1e-5)
        assert math.isclose(p3.column_data["position"][3], 3.0, abs_tol=1e-5)

        # 4 missing samples -> must NOT be imputed, control_valid False
        csv_4 = """time,pos_m,load_kn
2026-09-01 10:00:00,0.0,100.0
2026-09-01 10:00:01,NaN,NaN
2026-09-01 10:00:02,NaN,NaN
2026-09-01 10:00:03,NaN,NaN
2026-09-01 10:00:04,NaN,NaN
2026-09-01 10:00:05,5.0,200.0
"""
        p4 = AdaptiveCSVParser.parse_content(csv_4)
        assert p4.control_valid is False
        assert np.isnan(p4.column_data["position"][1])
        assert np.isnan(p4.column_data["position"][4])

    def test_edge_missing_values_cannot_interpolate(self):
        # Missing leading value: cannot safely interpolate without left anchor
        csv_edge = """time,pos_m,load_kn
2026-09-01 10:00:00,NaN,100.0
2026-09-01 10:00:01,1.0,150.0
2026-09-01 10:00:02,2.0,180.0
2026-09-01 10:00:03,NaN,100.0
"""
        p_edge = AdaptiveCSVParser.parse_content(csv_edge)
        assert p_edge.control_valid is False
        assert np.isnan(p_edge.column_data["position"][0])
        assert np.isnan(p_edge.column_data["position"][3])

    def test_corrupt_non_numeric_strings_converted_to_nan(self):
        csv_corrupt = """time,pos_m,load_kn
2026-09-01 10:00:00,0.0,100.0
2026-09-01 10:00:01,BAD_STRING_SENSOR_ERROR,150.0
2026-09-01 10:00:02,2.0,180.0
"""
        p = AdaptiveCSVParser.parse_content(csv_corrupt)
        # Single interior gap is linearly interpolated: 0.0 -> 1.0 -> 2.0
        assert math.isclose(p.column_data["position"][1], 1.0, abs_tol=1e-5)
        assert p.imputed_mask["position"][1] is True

    def test_pydantic_boundary_limits(self):
        # Dynocard with exactly 144 points passes
        theta = np.linspace(0, 2 * np.pi, 144, endpoint=False)
        pos = (1.5 * (1 - np.cos(theta))).tolist()
        load = (120.0 + 50.0 * np.sin(theta)).tolist()
        card = StandardDynoCard(
            card_id="CARD-144",
            well_id="Baghewala-14",
            timestamp=datetime.datetime.now(datetime.timezone.utc),
            spm=4.5,
            stroke_length_m=3.0,
            position_m=pos,
            load_kn=load,
            card_type="surface",
            provenance="[measured]",
        )
        assert len(card.position_m) == 144

        # Dynocard with 143 points fails validation
        with pytest.raises(ValueError, match="exactly 144 uniform phase points"):
            StandardDynoCard(
                card_id="CARD-143",
                well_id="Baghewala-14",
                timestamp=datetime.datetime.now(datetime.timezone.utc),
                spm=4.5,
                stroke_length_m=3.0,
                position_m=pos[:-1],
                load_kn=load[:-1],
                card_type="surface",
                provenance="[measured]",
            )
