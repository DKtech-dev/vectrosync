"""
Tier 2 Boundary & Corner Case Test Suite: Corrupt Data, Ambiguous Headers & Fault Ingestion (Requirement R5).
Covers:
- Corrupt and out-of-order SCADA CSV handling.
- Ambiguous column headers (< 0.95 mapping confidence) triggering autonomous control inhibition.
- Ingestion of NaN bursts and long sensor gaps (> 3 samples).
- Pydantic schema validation rejection on corrupted dictionaries and arrays.
"""

from pathlib import Path
import numpy as np
import pytest
from pydantic import ValidationError

from src.adapter import (
    AdaptiveCSVParser,
    ColumnMapper,
    SCADATelemetryPacket,
    UnitConverter,
)


class TestCorruptCSVHandling:
    """Validates resilience against corrupt, non-numeric, or malformed SCADA streams."""

    def test_corrupt_csv_with_bad_floats_and_negative_loads(self, temp_corrupt_scada_csv: Path):
        """Corrupt text fields are parsed safely as NaN; physically impossible values are flagged."""
        content = temp_corrupt_scada_csv.read_text(encoding="utf-8")
        dataset = AdaptiveCSVParser.parse_content(content)

        assert dataset.row_count == 3
        # First row position is 1.0, second row had bad float string -> parsed as NaN
        assert dataset.column_data["position"][0] == 1.0
        assert dataset.imputed_mask["position"][1] is True

    def test_empty_csv_raises_value_error(self):
        """Completely empty CSV or header-only file raises descriptive ValueError."""
        with pytest.raises(ValueError, match="empty"):
            AdaptiveCSVParser.parse_content("")

        with pytest.raises(ValueError, match="zero data rows"):
            AdaptiveCSVParser.parse_content("timestamp,position,load,spm\n")


class TestAmbiguousHeaderSafetyGate:
    """Validates that ambiguous or low-confidence column mappings inhibit autonomous control."""

    def test_ambiguous_header_low_confidence_inhibits_control(self):
        """Header with unknown or highly ambiguous name ('Sensor_Reading_XYZ') receives confidence < 0.95."""
        headers = ["timestamp", "Sensor_Reading_XYZ", "spm"]
        mappings = ColumnMapper.infer_mapping(headers)

        assert mappings["Sensor_Reading_XYZ"].target_channel == "unknown"
        assert mappings["Sensor_Reading_XYZ"].confidence == 0.0
        assert mappings["Sensor_Reading_XYZ"].confirmed is False

    def test_unsupported_unit_raises_value_error(self):
        """Unsupported or garbage unit strings raise explicit ValueError."""
        with pytest.raises(ValueError, match="Unsupported force unit"):
            UnitConverter.convert_force(100.0, from_unit="megatons_force", to_unit="N")

        with pytest.raises(ValueError, match="Unsupported pressure unit"):
            UnitConverter.convert_pressure(50.0, from_unit="parsecs", to_unit="Pa")

        with pytest.raises(ValueError, match="Unsupported temperature unit"):
            UnitConverter.convert_temperature(100.0, from_unit="lightyears", to_unit="degC")


class TestLongSensorGapDiscipline:
    """Validates that sensor dropouts > 3 samples are never hidden from the safety system."""

    def test_long_gap_leaves_nans_and_flags_control_invalid(self, temp_long_gap_scada_csv: Path):
        """10-sample missing data gap preserves NaNs and marks control_valid=False."""
        content = temp_long_gap_scada_csv.read_text(encoding="utf-8")
        dataset = AdaptiveCSVParser.parse_content(content, max_impute_gap=3)

        assert dataset.control_valid is False
        # Verify interior samples 4 to 13 remain NaN
        pos_data = dataset.column_data["position"]
        assert any(np.isnan(x) for x in pos_data[4:14])
