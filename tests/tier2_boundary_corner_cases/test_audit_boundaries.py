"""Tier 2 Boundary and Corner Case Tests for SHA-256 Audit Ledger (Requirement R5)."""

import datetime
import time
import pytest
import numpy as np

from src.audit import AuditLedger, AuditBlock


class TestAuditBoundaries:
    """Boundary, scale, and tamper attack tests for AuditLedger."""

    def test_empty_and_unicode_payloads(self):
        ledger = AuditLedger(well_id="Baghewala-14")
        b1 = ledger.record_event(
            event_type="EMPTY_EVENT",
            provenance_tag="[model]",
            payload={},
        )
        assert b1.is_hash_valid() is True

        b2 = ledger.record_event(
            event_type="UNICODE_EVENT",
            provenance_tag="[measured]",
            payload={"location": "बाघेवाला 14", "formula": "μ(T) = exp(A + B/T)", "status": "✓ SUCCESS"},
        )
        assert b2.is_hash_valid() is True

        is_valid, err = ledger.verify_chain()
        assert is_valid is True
        assert err is None

    def test_numpy_and_datetime_payload_serialization(self):
        ledger = AuditLedger(well_id="Baghewala-14")
        payload = {
            "float_val": np.float64(12.3456789),
            "int_val": np.int32(42),
            "array_val": np.array([1.0, 2.0, 3.0]),
            "timestamp": datetime.datetime(2026, 9, 1, 12, 0, 0, tzinfo=datetime.timezone.utc),
            "nan_val": float("nan"),
        }
        b = ledger.record_event("COMPLEX_PAYLOAD", "[model]", payload)
        assert b.is_hash_valid() is True
        is_valid, err = ledger.verify_chain()
        assert is_valid is True

    def test_large_ledger_scale_500_blocks(self):
        ledger = AuditLedger(well_id="Baghewala-14")
        t_start = time.perf_counter()
        for i in range(500):
            ledger.record_event(
                event_type="FAST_TELEMETRY",
                provenance_tag="[measured]",
                payload={"sample": i, "spm": 3.5 + 0.001 * i},
            )
        t_append = time.perf_counter() - t_start
        assert len(ledger) == 501
        assert t_append < 2.0

        t_verify_start = time.perf_counter()
        is_valid, err = ledger.verify_chain()
        t_verify = time.perf_counter() - t_verify_start
        assert is_valid is True
        assert err is None
        assert t_verify < 0.5

    def test_tamper_detect_middle_block_deletion(self):
        ledger = AuditLedger(well_id="Baghewala-14")
        for i in range(20):
            ledger.record_event("STEP_EVENT", "[model]", {"i": i})

        del ledger.chain[10]

        is_valid, err = ledger.verify_chain()
        assert is_valid is False
        assert err is not None
        assert "block 10" in err.lower()

    def test_tamper_detect_block_swap(self):
        ledger = AuditLedger(well_id="Baghewala-14")
        for i in range(10):
            ledger.record_event("EVENT", "[model]", {"step": i})

        ledger.chain[4], ledger.chain[5] = ledger.chain[5], ledger.chain[4]

        is_valid, err = ledger.verify_chain()
        assert is_valid is False
        assert err is not None

    def test_tamper_detect_genesis_hash_alteration(self):
        ledger = AuditLedger(well_id="Baghewala-14")
        ledger.record_event("E1", "[measured]", {"val": 1})
        ledger.chain[0].prev_hash = "1" + "0" * 63

        is_valid, err = ledger.verify_chain()
        assert is_valid is False
        assert err is not None
        assert "genesis" in err.lower()

    def test_verify_single_block_bounds(self):
        ledger = AuditLedger(well_id="Baghewala-14")
        is_valid, err = ledger.verify_block(0)
        assert is_valid is True
        assert err is None

        is_valid_neg, err_neg = ledger.verify_block(-1)
        assert is_valid_neg is False
        assert "out of range" in err_neg

        is_valid_high, err_high = ledger.verify_block(999)
        assert is_valid_high is False
        assert "out of range" in err_high
