"""
Tier 1 Feature Test Suite: Cryptographic SHA-256 Audit Ledger (Requirement R5).
Covers Features 19 and 20:
- Deterministic genesis block initialization.
- Cryptographic SHA-256 block chaining and canonical JSON serialization.
- Immutable 4-tier provenance tagging ([measured], [model], [synthetic], [calibrated]).
- Full tamper-evident integrity verification engine.
"""

import hashlib
import json
import numpy as np
import pytest
from pydantic import ValidationError

from src.audit import (
    AuditBlock,
    AuditLedger,
    compute_canonical_json,
    canonical_json_serializer,
    PROVENANCE_TAGS,
)


class TestGenesisBlockAndLedgerInitialization:
    """Validates deterministic genesis block construction and initial ledger state."""

    def test_genesis_block_creation(self):
        """Genesis block must have index 0, 64-zero previous hash, and valid SHA-256 block hash."""
        ledger = AuditLedger(well_id="Baghewala-14", auto_genesis=True)
        assert len(ledger.chain) == 1

        genesis = ledger.chain[0]
        assert genesis.index == 0
        assert genesis.prev_hash == "0" * 64
        assert genesis.event_type == "SYSTEM_INITIALIZATION"
        assert genesis.provenance_tag == "[model]"
        assert genesis.is_hash_valid() is True
        assert len(genesis.block_hash) == 64

    def test_genesis_block_custom_payload(self):
        """Genesis block incorporates custom asset configuration."""
        custom_payload = {"operator": "Oil India Limited", "formation": "Jodhpur Sandstone"}
        ledger = AuditLedger(well_id="BAGHEWALA-14", genesis_payload=custom_payload)
        genesis = ledger.chain[0]
        assert genesis.payload["operator"] == "Oil India Limited"
        assert genesis.payload["formation"] == "Jodhpur Sandstone"
        assert genesis.is_hash_valid() is True


class TestEventAppendingAndChaining:
    """Validates immutable event appending, previous hash linkage, and monotonic counters."""

    def test_event_appending_and_hash_pointers(self):
        """Each appended block must point to the preceding block's hash."""
        ledger = AuditLedger(well_id="Baghewala-14")

        block1 = ledger.record_event(
            event_type="SCADA_INGESTION",
            provenance_tag="[measured]",
            payload={"spm": 4.5, "pprl_kn": 185.2, "min_load_kn": 65.0},
        )
        assert block1.index == 1
        assert block1.prev_hash == ledger.chain[0].block_hash
        assert block1.is_hash_valid() is True

        block2 = ledger.record_event(
            event_type="MPC_OPTIMIZATION",
            provenance_tag="[model]",
            payload={"recommended_spm": 3.8, "forecast_horizon_hr": 12},
        )
        assert block2.index == 2
        assert block2.prev_hash == block1.block_hash
        assert block2.is_hash_valid() is True

        block3 = ledger.record_event(
            event_type="DISTURBANCE_INJECTION",
            provenance_tag="[synthetic]",
            payload={"cooling_multiplier": 1.5, "water_cut": 0.35},
        )
        assert block3.index == 3
        assert block3.prev_hash == block2.block_hash
        assert block3.is_hash_valid() is True

        # Verify full chain integrity
        is_valid, msg = ledger.verify_chain()
        assert is_valid is True
        assert msg is None

    def test_provenance_tag_taxonomy_enforcement(self):
        """Only [measured], [model], [synthetic], and [calibrated] tags are permitted."""
        ledger = AuditLedger(well_id="Baghewala-14")

        for valid_tag in ["[measured]", "[model]", "[synthetic]", "[calibrated]"]:
            block = ledger.record_event(
                event_type="TEST_TAG",
                provenance_tag=valid_tag,
                payload={"tag": valid_tag},
            )
            assert block.provenance_tag == valid_tag

        with pytest.raises(ValueError, match="Invalid provenance tag"):
            ledger.record_event(
                event_type="INVALID_TAG_EVENT",
                provenance_tag="[unverified]",  # Illegal tag
                payload={},
            )

        with pytest.raises(ValueError, match="Invalid provenance tag"):
            ledger.record_event(
                event_type="INVALID_TAG_EVENT",
                provenance_tag="raw_data",  # Illegal tag
                payload={},
            )


class TestTamperDetectionVerificationEngine:
    """Validates tamper evidence under simulated adversarial ledger alterations."""

    def test_tamper_detection_modified_payload(self):
        """Modifying a historical event's payload invalidates its hash and breaks ledger verification."""
        ledger = AuditLedger(well_id="Baghewala-14")
        for i in range(10):
            ledger.record_event(
                event_type="TELEMETRY_STEP",
                provenance_tag="[measured]",
                payload={"step": i, "spm": 4.5},
            )

        # Adversarial attack: modify SPM in block #5 from 4.5 to 6.0
        target_block = ledger.chain[5]
        target_block.payload["spm"] = 6.0  # Tamper payload

        is_valid, msg = ledger.verify_chain()
        assert is_valid is False
        assert msg is not None
        assert "block 5" in msg.lower()

    def test_tamper_detection_broken_chain_pointer(self):
        """Modifying a previous_hash link breaks the cryptographic chain."""
        ledger = AuditLedger(well_id="Baghewala-14")
        for i in range(5):
            ledger.record_event(
                event_type="TEST_STEP",
                provenance_tag="[model]",
                payload={"step": i},
            )

        # Adversarial attack: corrupt previous_hash on block #3
        ledger.chain[3].prev_hash = "f" * 64

        is_valid, msg = ledger.verify_chain()
        assert is_valid is False
        assert msg is not None
        assert "block 3" in msg.lower()

    def test_tamper_detection_deleted_block(self):
        """Deleting a historical block (e.g. to hide a failsafe trip) breaks chain linkage."""
        ledger = AuditLedger(well_id="Baghewala-14")
        for i in range(8):
            ledger.record_event(
                event_type="EVENT",
                provenance_tag="[measured]",
                payload={"index": i},
            )

        # Adversarial attack: delete block #4
        del ledger.chain[4]

        is_valid, msg = ledger.verify_chain()
        assert is_valid is False
        assert msg is not None
        assert "block 4" in msg.lower()


class TestCanonicalJSONSerialization:
    """Validates deterministic formatting of dictionaries, floats, datetimes, and numpy types."""

    def test_canonical_json_key_sorting_and_compactness(self):
        """JSON output must sort keys alphabetically and use compact separators (',', ':')."""
        data1 = {"b": 2, "a": 1, "c": 3}
        data2 = {"c": 3, "a": 1, "b": 2}
        assert compute_canonical_json(data1) == compute_canonical_json(data2)
        assert compute_canonical_json(data1) == '{"a":1,"b":2,"c":3}'

    def test_numpy_and_float_serialization(self):
        """Numpy numerical types and arrays must serialize deterministically."""
        data = {
            "float_val": np.float64(12.3456789),
            "int_val": np.int64(42),
            "arr_val": np.array([1.0, 2.0, 3.0]),
        }
        res = compute_canonical_json(data)
        assert "12.3456789" in res
        assert "42" in res
        assert "[1.0,2.0,3.0]" in res
