"""Tier 1 Feature Coverage Tests for SHA-256 Provenance & Audit Ledger (Requirement R5)."""

import json
import pytest

from src.audit import AuditLedger, AuditBlock, PROVENANCE_TAGS


class TestAuditLedger:
    """Tests for AuditLedger event chaining, provenance tagging, and verification."""

    def test_genesis_block_creation(self):
        ledger = AuditLedger(well_id="Baghewala-14")
        assert len(ledger) == 1
        genesis = ledger[0]
        assert genesis.index == 0
        assert genesis.prev_hash == "0" * 64
        assert genesis.event_type == "SYSTEM_INITIALIZATION"
        assert genesis.provenance_tag == "[model]"
        assert genesis.is_hash_valid() is True

        is_valid, err = ledger.verify_chain()
        assert is_valid is True
        assert err is None

    def test_record_event_chaining(self):
        ledger = AuditLedger(well_id="Baghewala-14")

        b1 = ledger.record_event(
            event_type="TELEMETRY_INGESTION",
            provenance_tag="[measured]",
            payload={"spm": 4.5, "surface_load_kn_max": 185.3, "surface_load_kn_min": 52.1},
        )
        assert b1.index == 1
        assert b1.prev_hash == ledger[0].block_hash
        assert b1.is_hash_valid() is True

        b2 = ledger.record_event(
            event_type="MPC_OPTIMIZATION",
            provenance_tag="[model]",
            payload={"optimal_spm": 3.8, "predicted_min_tension_kn": 0.65},
        )
        assert b2.index == 2
        assert b2.prev_hash == b1.block_hash
        assert b2.is_hash_valid() is True

        b3 = ledger.record_event(
            event_type="PARAMETER_CALIBRATION",
            provenance_tag="[calibrated]",
            payload={"k_hat": 0.985, "estimated_fillage": 0.92},
        )
        assert b3.index == 3
        assert b3.prev_hash == b2.block_hash

        b4 = ledger.record_event(
            event_type="DISTURBANCE_INJECTION",
            provenance_tag="[synthetic]",
            payload={"cooling_multiplier": 1.5, "steam_quality": 0.70},
        )
        assert b4.index == 4
        assert b4.prev_hash == b3.block_hash

        assert len(ledger) == 5
        is_valid, err = ledger.verify_chain()
        assert is_valid is True
        assert err is None

    def test_invalid_provenance_tag_raises(self):
        ledger = AuditLedger(well_id="Baghewala-14")
        with pytest.raises(ValueError, match="Invalid provenance tag"):
            ledger.record_event(
                event_type="TEST_EVENT",
                provenance_tag="[unverified]",  # Invalid tag
                payload={"data": 123},
            )

    def test_tamper_detection_modified_payload(self):
        ledger = AuditLedger(well_id="Baghewala-14")
        for i in range(10):
            ledger.record_event(
                event_type="TELEMETRY_INGESTION",
                provenance_tag="[measured]",
                payload={"step": i, "spm": 3.5 + i * 0.1},
            )

        # Tamper with block #5 payload without re-hash
        ledger.chain[5].payload["spm"] = 999.9

        is_valid, err = ledger.verify_chain()
        assert is_valid is False
        assert err is not None
        assert "block 5" in err.lower()

    def test_tamper_detection_broken_chain_linkage(self):
        ledger = AuditLedger(well_id="Baghewala-14")
        for i in range(5):
            ledger.record_event(
                event_type="TELEMETRY_INGESTION",
                provenance_tag="[measured]",
                payload={"step": i},
            )

        # Tamper with previous_hash pointer in block #3
        fake_hash = "f" * 64
        ledger.chain[3].prev_hash = fake_hash

        is_valid, err = ledger.verify_chain()
        assert is_valid is False
        assert err is not None
        assert "block 3" in err.lower()

    def test_filtering_and_querying(self):
        ledger = AuditLedger(well_id="Baghewala-14")
        ledger.record_event("TELEMETRY_INGESTION", "[measured]", {"sensor_id": "LC-01", "val": 100})
        ledger.record_event("MPC_OPTIMIZATION", "[model]", {"solver": "osqp", "val": 200})
        ledger.record_event("TELEMETRY_INGESTION", "[measured]", {"sensor_id": "LC-02", "val": 300})
        ledger.record_event("FAILSAFE_TRANSITION", "[model]", {"state": "LEVEL_1", "val": 400})

        telemetry_blocks = ledger.filter_by_event_type("TELEMETRY_INGESTION")
        assert len(telemetry_blocks) == 2

        measured_blocks = ledger.filter_by_provenance("[measured]")
        assert len(measured_blocks) == 2

        model_blocks = ledger.filter_by_provenance("[model]")
        assert len(model_blocks) == 3

        sensor_query = ledger.search_payload_key("sensor_id", "LC-01")
        assert len(sensor_query) == 1
        assert sensor_query[0].payload["sensor_id"] == "LC-01"

    def test_export_and_import_json(self):
        ledger = AuditLedger(well_id="Baghewala-14")
        for i in range(8):
            ledger.record_event(
                event_type="TELEMETRY_INGESTION",
                provenance_tag="[measured]",
                payload={"sample_index": i, "load_kn": 120.0 + i},
            )

        json_str = ledger.to_json(indent=2)
        assert isinstance(json_str, str)
        assert len(json_str) > 0

        imported_ledger = AuditLedger.from_json(json_str, verify=True)
        assert len(imported_ledger) == len(ledger)
        for original_b, imported_b in zip(ledger.chain, imported_ledger.chain):
            assert original_b.block_hash == imported_b.block_hash
            assert original_b.index == imported_b.index

        is_valid, err = imported_ledger.verify_chain()
        assert is_valid is True

    def test_export_summary(self):
        ledger = AuditLedger(well_id="Baghewala-14")
        ledger.record_event("TELEMETRY_INGESTION", "[measured]", {"spm": 3.5})
        ledger.record_event("MPC_OPTIMIZATION", "[model]", {"spm_cmd": 3.8})
        ledger.record_event("FAILSAFE_TRANSITION", "[model]", {"level": "LEVEL_0"})

        summary = ledger.export_summary()
        assert summary["well_id"] == "Baghewala-14"
        assert summary["total_blocks"] == 4
        assert summary["is_tamper_free"] is True
        assert summary["verification_status"] == "PASSED"
        assert summary["event_type_breakdown"]["TELEMETRY_INGESTION"] == 1
        assert summary["event_type_breakdown"]["MPC_OPTIMIZATION"] == 1
        assert summary["provenance_breakdown"]["[measured]"] == 1
        assert summary["provenance_breakdown"]["[model]"] == 3
