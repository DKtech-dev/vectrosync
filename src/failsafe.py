"""
3-Tier Failsafe State Machine Engine (src/failsafe.py)
Implements Real-Time Safety Interlocks, Telemetry Loss Triggers, 3-Stroke Ramp Down,
Hysteresis Recovery Debouncing, and Emergency Latching.
"""

from dataclasses import dataclass
from enum import Enum
from typing import Optional, Tuple, Any, Dict
import time


class FailsafeLevel(str, Enum):
    """Failsafe operational hierarchy levels."""
    LEVEL_0_NORMAL = "LEVEL_0_NORMAL"
    LEVEL_1_DEGRADED = "LEVEL_1_DEGRADED"
    LEVEL_2_PROTECTIVE = "LEVEL_2_PROTECTIVE"
    LEVEL_3_EMERGENCY = "LEVEL_3_EMERGENCY"


@dataclass
class FailsafeDecision:
    """Actionable decision output emitted by the supervisory safety state machine."""
    state: str
    spm_command: float
    control_enabled: bool
    alarm_raised: bool
    alarm_message: Optional[str] = None
    e_stop_tripped: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "state": self.state,
            "spm_command": self.spm_command,
            "control_enabled": self.control_enabled,
            "alarm_raised": self.alarm_raised,
            "alarm_message": self.alarm_message,
            "e_stop_tripped": self.e_stop_tripped,
        }


class FailsafeStateMachine:
    """
    Supervisory 4-tier industrial safety state machine protecting sucker rod string against
    compressive rod floating, surface mechanical overload, and communication loss.
    """

    def __init__(
        self,
        rod_rating_kN: float = 314.15,
        safe_spm: float = 2.0,
        telemetry_sync_normal_sec: float = 10.0,
        telemetry_timeout_degraded_sec: float = 60.0,
        min_safe_tension_trip_kn: float = 0.50,
        emergency_pprl_ratio: float = 0.95,
        fallback_ramp_strokes: int = 3,
        rated_rod_capacity_kn: Optional[float] = None,
    ):
        self.rod_rating_kN = float(rated_rod_capacity_kn) if rated_rod_capacity_kn is not None else float(rod_rating_kN)
        self.safe_spm = float(safe_spm)
        self.t_sync_normal = float(telemetry_sync_normal_sec)
        self.t_timeout_degraded = float(telemetry_timeout_degraded_sec)
        self.min_safe_tension = float(min_safe_tension_trip_kn)
        self.emergency_ratio = float(emergency_pprl_ratio)
        self.fallback_ramp_strokes = int(fallback_ramp_strokes)

        # Internal state memory
        self.state = FailsafeLevel.LEVEL_0_NORMAL
        self.consecutive_normal_strokes = 0
        self.ramp_strokes_remaining = 0
        self.initial_ramp_spm = 4.5
        self.current_spm = 4.5
        self.is_latched = False
        self.active_alarm_reason = "System nominal"
        self.last_telemetry_timestamp = time.time()

    @property
    def current_level(self) -> FailsafeLevel:
        return self.state

    def update_telemetry_heartbeat(self, timestamp: Optional[float] = None) -> None:
        self.last_telemetry_timestamp = time.time() if timestamp is None else float(timestamp)

    def trip_manual_emergency(self, reason: str = "MANUAL OPERATOR EMERGENCY TRIP") -> FailsafeDecision:
        self.state = FailsafeLevel.LEVEL_3_EMERGENCY
        self.is_latched = True
        self.current_spm = 0.0
        self.active_alarm_reason = reason
        return FailsafeDecision(
            state=self.state.value,
            spm_command=0.0,
            control_enabled=False,
            alarm_raised=True,
            alarm_message=reason,
            e_stop_tripped=True,
        )

    def reset(self) -> None:
        """Reset state machine to Level 0 Normal operational state."""
        self.state = FailsafeLevel.LEVEL_0_NORMAL
        self.consecutive_normal_strokes = 0
        self.ramp_strokes_remaining = 0
        self.is_latched = False
        self.active_alarm_reason = "System nominal"
        self.last_telemetry_timestamp = time.time()

    def reset_emergency_trip(self) -> None:
        self.is_latched = False
        self.state = FailsafeLevel.LEVEL_1_DEGRADED
        self.current_spm = self.safe_spm
        self.active_alarm_reason = "Emergency trip reset by operator -> in degraded mode"

    def reset_latched_emergency(self) -> None:
        self.reset_emergency_trip()

    def evaluate(
        self,
        telemetry_age_s: float,
        f_downhole_min_kN: float,
        pprl_kN: float,
        proposed_spm: float,
        stroke_completed: bool = True,
        operator_ack: bool = False,
    ) -> FailsafeDecision:
        # 1. Level 3 Check: PPRL > 95% rating
        if pprl_kN > self.emergency_ratio * self.rod_rating_kN:
            self.state = FailsafeLevel.LEVEL_3_EMERGENCY
            self.is_latched = True
            self.current_spm = 0.0
            return FailsafeDecision(
                state=self.state.value,
                spm_command=0.0,
                control_enabled=False,
                alarm_raised=True,
                alarm_message="CRITICAL OVERLOAD: PPRL exceeded 95% rod tensile rating.",
                e_stop_tripped=True,
            )

        # Level 3 Latched Stop
        if self.state == FailsafeLevel.LEVEL_3_EMERGENCY or self.is_latched:
            if operator_ack:
                self.is_latched = False
                self.state = FailsafeLevel.LEVEL_1_DEGRADED
                self.current_spm = self.safe_spm
            else:
                return FailsafeDecision(
                    state=self.state.value,
                    spm_command=0.0,
                    control_enabled=False,
                    alarm_raised=True,
                    alarm_message="LATCHED E-STOP: Awaiting manual operator clearance.",
                    e_stop_tripped=True,
                )

        # 2. Level 2 Trigger: Telemetry age > 60s OR Downhole compression (< min_safe_tension)
        if telemetry_age_s > self.t_timeout_degraded or f_downhole_min_kN < self.min_safe_tension:
            if self.state != FailsafeLevel.LEVEL_2_PROTECTIVE:
                self.state = FailsafeLevel.LEVEL_2_PROTECTIVE
                self.ramp_strokes_remaining = self.fallback_ramp_strokes
                self.initial_ramp_spm = self.current_spm
                self.consecutive_normal_strokes = 0

        # Level 2 Execution: 3-stroke deterministic ramp down
        if self.state == FailsafeLevel.LEVEL_2_PROTECTIVE:
            if stroke_completed and self.ramp_strokes_remaining > 0:
                self.ramp_strokes_remaining -= 1
                step_size = (self.initial_ramp_spm - self.safe_spm) / float(self.fallback_ramp_strokes)
                self.current_spm = max(self.safe_spm, self.initial_ramp_spm - (self.fallback_ramp_strokes - self.ramp_strokes_remaining) * step_size)

            # Check recovery: Telemetry restored (< 10s) AND tension healthy (>= 1.0 kN) for 5 strokes + ACK
            if telemetry_age_s < self.t_sync_normal and f_downhole_min_kN >= 1.0:
                if stroke_completed:
                    self.consecutive_normal_strokes += 1
                if self.consecutive_normal_strokes >= 5 and operator_ack:
                    self.state = FailsafeLevel.LEVEL_0_NORMAL
                    self.consecutive_normal_strokes = 0
                    return FailsafeDecision(
                        state=self.state.value,
                        spm_command=self.current_spm,
                        control_enabled=True,
                        alarm_raised=False,
                    )
            else:
                self.consecutive_normal_strokes = 0

            return FailsafeDecision(
                state=self.state.value,
                spm_command=self.current_spm,
                control_enabled=False,
                alarm_raised=True,
                alarm_message="PROTECTIVE TAKEOVER: Ramping to safe SPM (2.0) in 3 strokes.",
            )

        # 3. Level 1 Trigger: Telemetry age in [10s, 60s]
        if self.t_sync_normal <= telemetry_age_s <= self.t_timeout_degraded:
            self.state = FailsafeLevel.LEVEL_1_DEGRADED
            self.consecutive_normal_strokes = 0
            return FailsafeDecision(
                state=self.state.value,
                spm_command=self.current_spm,
                control_enabled=True,
                alarm_raised=True,
                alarm_message="DEGRADED SURVEILLANCE: Telemetry latency 10-60s. Adaptation frozen.",
            )

        # 4. Level 0: Normal Operation
        if self.state == FailsafeLevel.LEVEL_1_DEGRADED:
            if telemetry_age_s < self.t_sync_normal and stroke_completed:
                self.consecutive_normal_strokes += 1
                if self.consecutive_normal_strokes >= 3:
                    self.state = FailsafeLevel.LEVEL_0_NORMAL
                    self.consecutive_normal_strokes = 0

        if self.state == FailsafeLevel.LEVEL_0_NORMAL:
            self.current_spm = float(proposed_spm)
            return FailsafeDecision(
                state=self.state.value,
                spm_command=self.current_spm,
                control_enabled=True,
                alarm_raised=False,
            )

        return FailsafeDecision(
            state=self.state.value,
            spm_command=self.current_spm,
            control_enabled=True,
            alarm_raised=False,
        )

    def evaluate_state(
        self,
        current_time: float,
        last_telemetry_time: float,
        pprl_kn: float,
        min_tension_kn: float,
        simulated_disconnect: bool = False,
        manual_emergency: bool = False,
    ) -> Tuple[FailsafeLevel, str, float]:
        if manual_emergency:
            dec = self.trip_manual_emergency()
            return FailsafeLevel(dec.state), dec.alarm_message, dec.spm_command

        if self.is_latched or self.state == FailsafeLevel.LEVEL_3_EMERGENCY:
            return FailsafeLevel.LEVEL_3_EMERGENCY, "EMERGENCY OVERLOAD: PPRL exceeded rating (latched)", 0.0

        if pprl_kn > self.emergency_ratio * self.rod_rating_kN:
            self.state = FailsafeLevel.LEVEL_3_EMERGENCY
            self.is_latched = True
            self.current_spm = 0.0
            return FailsafeLevel.LEVEL_3_EMERGENCY, "EMERGENCY OVERLOAD: PPRL exceeded rating", 0.0

        telemetry_age = 9999.0 if simulated_disconnect else max(0.0, current_time - last_telemetry_time)

        if telemetry_age > self.t_timeout_degraded:
            self.state = FailsafeLevel.LEVEL_2_PROTECTIVE
            self.current_spm = self.safe_spm
            return FailsafeLevel.LEVEL_2_PROTECTIVE, "TELEMETRY TIMEOUT: Stale data > 60s", self.safe_spm

        if min_tension_kn < self.min_safe_tension:
            self.state = FailsafeLevel.LEVEL_2_PROTECTIVE
            self.current_spm = self.safe_spm
            return FailsafeLevel.LEVEL_2_PROTECTIVE, "ROD FLOAT RISK: Downhole tension below safe floor", self.safe_spm

        if telemetry_age > self.t_sync_normal:
            self.state = FailsafeLevel.LEVEL_1_DEGRADED
            return FailsafeLevel.LEVEL_1_DEGRADED, "DEGRADED SURVEILLANCE: Telemetry age > 10s", self.current_spm

        self.state = FailsafeLevel.LEVEL_0_NORMAL
        return FailsafeLevel.LEVEL_0_NORMAL, "System nominal", self.current_spm


# Singleton instance and compatibility aliases
SupervisoryFailsafe = FailsafeStateMachine
DEFAULT_FAILSAFE = FailsafeStateMachine()
