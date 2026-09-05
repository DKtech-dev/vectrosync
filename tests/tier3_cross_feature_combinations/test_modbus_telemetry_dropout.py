"""
Tier 3 Cross-Feature Combination Test Suite: Modbus Telemetry Dropout Trip & Recovery.
Covers Acceptance Criteria §74:
- Telemetry disconnect event (>60 s gap) automatically trips LEVEL-2 protective fallback
  and ramps SPM to safe baseline (2.0 SPM in exactly 3 strokes).
- Transition from LEVEL-0 -> LEVEL-1 -> LEVEL-2 and subsequent hysteresis recovery back to LEVEL-0.
- All events cryptographically chained into the SHA-256 audit ledger.
"""

import math
import pytest

from src.audit import AuditLedger
from tests.tier1_feature_coverage.test_failsafe_state_machine import FailsafeLevel, FailsafeStateMachine


class TestModbusTelemetryDropoutTrip:
    """Validates real-time failsafe supervisor behavior during Modbus disconnect and recovery."""

    def test_modbus_disconnect_level_progression_and_audit_logging(self):
        """Simulates live Modbus cable pull: latency advances from 0s to 75s, triggering Level 1 then Level 2."""
        ledger = AuditLedger(well_id="Baghewala-14")
        sm = FailsafeStateMachine()
        sm.current_spm = 4.5

        # Phase 1: Healthy Modbus Communication (t = 2.0 s -> LEVEL-0)
        d0 = sm.evaluate(telemetry_age_s=2.0, f_downhole_min_kN=1.8, pprl_kN=180.0, proposed_spm=4.5)
        assert d0.state == FailsafeLevel.LEVEL_0_NORMAL
        assert d0.control_enabled is True
        ledger.record_event(
            event_type="TELEMETRY_PACKET",
            provenance_tag="[measured]",
            payload={"telemetry_age_s": 2.0, "state": d0.state, "spm": d0.spm_command},
        )

        # Phase 2: Short Disconnect / Network Jitter (t = 25.0 s -> LEVEL-1 Degraded Hold)
        d1 = sm.evaluate(telemetry_age_s=25.0, f_downhole_min_kN=1.8, pprl_kN=180.0, proposed_spm=4.5)
        assert d1.state == FailsafeLevel.LEVEL_1_DEGRADED
        assert d1.control_enabled is True
        ledger.record_event(
            event_type="FAILSAFE_STATE_CHANGE",
            provenance_tag="[model]",
            payload={"telemetry_age_s": 25.0, "state": d1.state, "alarm": d1.alarm_message},
        )

        # Phase 3: Major Disconnect (t = 65.0 s -> LEVEL-2 Protective Fallback Trip)
        d2_trip = sm.evaluate(telemetry_age_s=65.0, f_downhole_min_kN=1.8, pprl_kN=180.0, proposed_spm=4.5, stroke_completed=False)
        assert d2_trip.state == FailsafeLevel.LEVEL_2_PROTECTIVE
        assert d2_trip.control_enabled is False

        # Phase 4: Deterministic 3-Stroke Ramp Down to 2.0 SPM
        # Stroke 1
        d2_s1 = sm.evaluate(telemetry_age_s=70.0, f_downhole_min_kN=1.8, pprl_kN=180.0, proposed_spm=4.5, stroke_completed=True)
        # Stroke 2
        d2_s2 = sm.evaluate(telemetry_age_s=75.0, f_downhole_min_kN=1.8, pprl_kN=180.0, proposed_spm=4.5, stroke_completed=True)
        # Stroke 3: reaches safe baseline 2.0 SPM
        d2_s3 = sm.evaluate(telemetry_age_s=80.0, f_downhole_min_kN=1.8, pprl_kN=180.0, proposed_spm=4.5, stroke_completed=True)
        assert math.isclose(d2_s3.spm_command, 2.0, abs_tol=1e-4)

        ledger.record_event(
            event_type="PROTECTIVE_RAMP_COMPLETE",
            provenance_tag="[model]",
            payload={"final_safe_spm": d2_s3.spm_command, "state": d2_s3.state},
        )

        # Phase 5: Modbus Cable Reconnected (latency drops to 1.0s)
        # Requires 5 consecutive healthy strokes + operator acknowledgment to restore Level 0
        for stroke in range(4):
            d_rec = sm.evaluate(telemetry_age_s=1.0, f_downhole_min_kN=1.8, pprl_kN=180.0, proposed_spm=4.5, stroke_completed=True, operator_ack=False)
            assert d_rec.state == FailsafeLevel.LEVEL_2_PROTECTIVE  # Not cleared yet without 5 strokes + ACK

        # Stroke 5 with operator ACK
        d_restored = sm.evaluate(telemetry_age_s=1.0, f_downhole_min_kN=1.8, pprl_kN=180.0, proposed_spm=4.5, stroke_completed=True, operator_ack=True)
        assert d_restored.state == FailsafeLevel.LEVEL_0_NORMAL
        assert d_restored.control_enabled is True

        ledger.record_event(
            event_type="FAILSAFE_CLEARED",
            provenance_tag="[model]",
            payload={"state": d_restored.state, "operator_ack": True},
        )

        # Phase 6: Verify full cryptographic integrity of the audit chain
        is_valid, msg = ledger.verify_chain()
        assert is_valid is True
        assert msg is None
        assert len(ledger.chain) == 5  # Genesis + 4 events
