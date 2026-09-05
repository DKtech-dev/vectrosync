"""
Tests for Module 4: Failsafe State Machine Transitions (tests/test_failsafe_trips.py)
Asserts Level-0 to Level-3 transitions, telemetry loss trip at 65s, rod float interlocks, and emergency latching.
"""

import time
import pytest
from src.failsafe import FailsafeStateMachine, FailsafeLevel


def test_normal_to_degraded_transition():
    """Telemetry age between 10s and 60s should transition to LEVEL-1 DEGRADED."""
    sm = FailsafeStateMachine(telemetry_sync_normal_sec=10.0, telemetry_timeout_degraded_sec=60.0)
    now = 1000.0

    # 5 seconds stale -> LEVEL-0 NORMAL
    lvl, reason, _ = sm.evaluate_state(now, now - 5.0, pprl_kn=70.0, min_tension_kn=1.2)
    assert lvl == FailsafeLevel.LEVEL_0_NORMAL

    # 25 seconds stale -> LEVEL-1 DEGRADED
    lvl, reason, _ = sm.evaluate_state(now, now - 25.0, pprl_kn=70.0, min_tension_kn=1.2)
    assert lvl == FailsafeLevel.LEVEL_1_DEGRADED


def test_telemetry_loss_trip_at_65_seconds():
    """Asserts that injecting a telemetry gap of 65s forces state machine into LEVEL-2 PROTECTIVE."""
    sm = FailsafeStateMachine(telemetry_sync_normal_sec=10.0, telemetry_timeout_degraded_sec=60.0)
    now = 1000.0

    # 65 seconds stale -> LEVEL-2 PROTECTIVE FALLBACK
    lvl, reason, spm = sm.evaluate_state(now, now - 65.0, pprl_kn=70.0, min_tension_kn=1.2)
    assert lvl == FailsafeLevel.LEVEL_2_PROTECTIVE
    assert spm == 2.0, f"Expected safe fallback SPM 2.0, got {spm}"
    assert "TELEMETRY TIMEOUT" in reason or "stale" in reason.lower()


def test_rod_float_tension_trip():
    """Asserts that predicted downhole tension < 0.20 kN forces LEVEL-2 PROTECTIVE fallback."""
    sm = FailsafeStateMachine(min_safe_tension_trip_kn=0.20)
    now = 1000.0

    # Tension 0.05 kN (< 0.20 kN) even with fresh telemetry
    lvl, reason, spm = sm.evaluate_state(now, now - 2.0, pprl_kn=70.0, min_tension_kn=0.05)
    assert lvl == FailsafeLevel.LEVEL_2_PROTECTIVE
    assert spm == 2.0
    assert "ROD FLOAT" in reason.upper()


def test_emergency_overload_latch():
    """Asserts that PPRL > 95% rating triggers LEVEL-3 EMERGENCY STOP and latches until operator reset."""
    sm = FailsafeStateMachine(rated_rod_capacity_kn=110.0, emergency_pprl_ratio=0.95)
    now = 1000.0

    # PPRL 106.0 kN (> 104.5 kN limit)
    lvl, reason, spm = sm.evaluate_state(now, now - 1.0, pprl_kn=106.0, min_tension_kn=1.5)
    assert lvl == FailsafeLevel.LEVEL_3_EMERGENCY
    assert spm == 0.0
    assert sm.is_latched is True

    # Subsequent call with normal load must remain latched in EMERGENCY
    lvl2, _, _ = sm.evaluate_state(now + 1.0, now, pprl_kn=60.0, min_tension_kn=2.0)
    assert lvl2 == FailsafeLevel.LEVEL_3_EMERGENCY

    # Manual reset clears latch
    sm.reset_latched_emergency()
    assert sm.is_latched is False
    lvl3, _, _ = sm.evaluate_state(now + 2.0, now + 1.0, pprl_kn=60.0, min_tension_kn=2.0)
    assert lvl3 == FailsafeLevel.LEVEL_0_NORMAL


def test_failsafe_reset_to_level_0_normal():
    """Asserts that calling reset() unconditionally restores Level 0 Normal state."""
    sm = FailsafeStateMachine()
    sm.state = FailsafeLevel.LEVEL_2_PROTECTIVE
    sm.consecutive_normal_strokes = 4
    sm.ramp_strokes_remaining = 2
    sm.is_latched = True

    sm.reset()

    assert sm.state == FailsafeLevel.LEVEL_0_NORMAL
    assert sm.consecutive_normal_strokes == 0
    assert sm.ramp_strokes_remaining == 0
    assert sm.is_latched is False
    assert sm.active_alarm_reason == "System nominal"
