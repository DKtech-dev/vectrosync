"""Deterministic, evidence-bounded explanations for synthetic model outputs.

This module formats values produced elsewhere; it is not an AI model, an independent
physics check, or evidence that an advisory action will prevent a failure.
"""

import math
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any


@dataclass
class DiagnosticReasoning:
    """Structured diagnostic summary with an explicit evidence label."""
    trigger_event: str
    forward_horizon: str
    dispatched_action: str
    structural_outcome: str
    provenance_tag: str = "[synthetic model]"
    timestamp_iso: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "trigger_event": self.trigger_event,
            "forward_horizon": self.forward_horizon,
            "dispatched_action": self.dispatched_action,
            "structural_outcome": self.structural_outcome,
            "provenance_tag": self.provenance_tag,
            "timestamp_iso": self.timestamp_iso,
        }


class WhyEngine:
    """Translate synthetic scalar outputs into bounded operator-facing language."""

    @classmethod
    def generate_explanation(
        cls,
        elapsed_days: float = 12.0,
        temp_c: float = 51.2,
        viscosity_cp: float = 9800.0,
        drag_beta: float = 1.72,
        min_tension_kn: float = 0.65,
        nominal_spm: float = 4.7,
        effective_spm: float = 2.8,
        failsafe_level: str = "LEVEL_0_NORMAL",
        is_modbus_severed: bool = False,
        scenario_name: str | None = None,
    ) -> DiagnosticReasoning:
        values = {
            "elapsed_days": elapsed_days,
            "temp_c": temp_c,
            "viscosity_cp": viscosity_cp,
            "drag_beta": drag_beta,
            "min_tension_kn": min_tension_kn,
            "nominal_spm": nominal_spm,
            "effective_spm": effective_spm,
        }
        if any(not math.isfinite(value) for value in values.values()):
            raise ValueError("Diagnostic inputs must be finite")
        if elapsed_days < 0 or viscosity_cp < 0 or drag_beta < 0:
            raise ValueError("Elapsed time, viscosity, and drag coefficient must be non-negative")

        visc_pas = viscosity_cp / 1000.0
        state = failsafe_level

        if is_modbus_severed:
            trigger = (
                f"At synthetic cycle day {elapsed_days:.1f}, the configured telemetry-loss scenario exceeded "
                "the software demonstration's 60-second stale-data threshold. No live Modbus connection is implemented."
            )
            horizon = (
                "Without current measurements, load and tension estimates cannot be treated as observed plant state. "
                "Continued operation would require independent PLC/SIS permissives and operator procedures."
            )
            action = (
                f"The supervisory model reports {state} and recommends {effective_spm:.1f} SPM instead of "
                f"{nominal_spm:.1f} SPM. This application does not dispatch that recommendation to an actuator."
            )
            outcome = (
                "The protective state and speed are advisory outputs only; mechanical condition cannot be verified "
                "until trusted telemetry is restored and independently checked."
            )

        elif min_tension_kn < 0.5:
            condition = "modeled compression" if min_tension_kn < 0 else "low modeled tension"
            trigger = (
                f"At synthetic CSS cycle day {elapsed_days:.1f}, the configured thermal/rheology chain gives "
                f"{temp_c:.1f}°C, {viscosity_cp:,.0f} cP ({visc_pas:.2f} Pa·s), and a reduced-order "
                f"Couette coefficient β of {drag_beta:.2f} N·s/m²."
            )
            horizon = (
                f"At {nominal_spm:.1f} SPM, the algebraic card estimator reports a minimum tension of "
                f"{min_tension_kn:.2f} kN: {condition} below the +0.50 kN advisory floor. The model does not "
                "resolve tubing contact or certify buckling or failure probability."
            )
            action = (
                f"The software reports {state} and recommends {effective_spm:.1f} SPM. An operator and independent "
                "protection system must decide and enforce any physical response."
            )
            outcome = (
                "The synthetic result is a screening indicator for compression/rod-float investigation, not proof "
                "of rod parting, avoided failure, fatigue-life improvement, or financial benefit."
            )

        else:
            margin_kn = min_tension_kn - 0.5
            trigger = (
                f"At synthetic CSS cycle day {elapsed_days:.1f}, the configured thermal/rheology chain gives "
                f"{temp_c:.1f}°C, {viscosity_cp:,.0f} cP ({visc_pas:.2f} Pa·s), and a reduced-order "
                f"Couette coefficient β of {drag_beta:.2f} N·s/m²."
            )
            horizon = (
                f"For the evaluated advisory point, the algebraic card estimator reports {min_tension_kn:+.2f} kN, "
                f"a modeled margin of {margin_kn:+.2f} kN above the +0.50 kN floor. Horizon values remain "
                "uncalibrated model projections rather than field measurements."
            )
            action = (
                f"The reduced-order governor recommends {effective_spm:.1f} SPM versus the requested "
                f"{nominal_spm:.1f} SPM; it has advisory authority only and does not command a PLC/VFD."
            )
            outcome = (
                f"The evaluated synthetic point satisfies the implemented tension constraint at "
                f"{min_tension_kn:+.2f} kN. This does not establish buckling prevention, fatigue reduction, "
                "field performance, or commercial value."
            )

        provenance = "[synthetic model]"
        if scenario_name:
            provenance = f"[synthetic model: {scenario_name}]"

        return DiagnosticReasoning(
            trigger_event=trigger,
            forward_horizon=horizon,
            dispatched_action=action,
            structural_outcome=outcome,
            provenance_tag=provenance,
            timestamp_iso=datetime.now(timezone.utc).isoformat(),
        )
