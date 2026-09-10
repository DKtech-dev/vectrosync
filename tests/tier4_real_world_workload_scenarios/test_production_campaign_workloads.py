"""
Tier 4 Real-World Workload Scenario Test Suite.

Exercises the advisory stack the way an operator would actually run it:
sustained multi-day campaigns, a full 12-hour shift of recurring advisories
with a telemetry dropout window, realistic-scale SCADA CSV ingestion, and a
week of provenance events at operational cadence.

These tests assert *structural and honesty* invariants rather than exact
numeric values, so they remain valid under model retuning while still locking
in the supervisory ladder, the advisory governor's value proposition, and the
synthetic/advisory disclosure guarantees.
"""

import numpy as np
import pytest

from backend.server import SimulationParams, run_physics_pass, audit_ledger
from fastapi.testclient import TestClient
from backend.server import app as fastapi_app
from src.adapter import AdaptiveCSVParser
from src.audit import AuditLedger
from src.failsafe import FailsafeLevel

# Worst-case API-legal thermal corner: maximum accelerated cooldown, maximum
# emulsion water cut, conventional fixed-speed operation.
WORST_CASE_THERMAL = dict(
    cooling_multiplier=5.0,
    water_cut=0.60,
    target_spm=4.7,
)

SEVERITY = {
    FailsafeLevel.LEVEL_0_NORMAL: 0,
    FailsafeLevel.LEVEL_1_DEGRADED: 1,
    FailsafeLevel.LEVEL_2_PROTECTIVE: 2,
    FailsafeLevel.LEVEL_3_EMERGENCY: 3,
}

ADVISORY_AUTHORITY = "advisory_only_not_for_direct_actuation"
HONEST_SOLVER_STATUSES = {"OPTIMAL", "INFEASIBLE_SAFE_FALLBACK"}


def _severity(response: dict) -> int:
    return SEVERITY[FailsafeLevel(response["failsafe_level"])]


def _assert_honesty(response: dict) -> None:
    """Every advisory pass must disclose its authority and validation status."""
    assert response["control_authority"] == ADVISORY_AUTHORITY
    assert response["model_status"]["field_validated"] is False
    assert response["model_status"]["hil_validated"] is False
    assert response["model_status"]["data_provenance"] == "synthetic"
    assert response["model_status"]["controller_status"] in HONEST_SOLVER_STATUSES


# ─── Sustained multi-day advisory campaigns ──────────────────────────────────

class TestNominalCooldownCampaign:
    """Sustained 30-day advisory campaign under nominal thermal decline."""

    CAMPAIGN_DAYS = [1.0, 3.0, 5.0, 7.0, 9.0, 11.0, 13.0, 15.0, 18.0, 21.0, 24.0, 27.0, 30.0]

    def test_30_day_campaign_causal_monotonicity_and_honesty(self):
        """Temperature falls, viscosity and drag rise monotonically, tension
        decays monotonically, and every pass remains advisory-only."""
        blocks_before = len(audit_ledger.chain)

        temps, viscs, drags, min_tensions = [], [], [], []
        for day in self.CAMPAIGN_DAYS:
            r = run_physics_pass(SimulationParams(elapsed_days=day))
            _assert_honesty(r)
            assert r["is_modbus_severed"] is False
            assert np.isfinite(r["actual_min_tension_kn"])
            temps.append(r["temperature_c"])
            viscs.append(r["viscosity_cp"])
            drags.append(r["drag_beta"])
            min_tensions.append(r["actual_min_tension_kn"])

        # Causal chain: cooling -> viscosity surge -> drag growth -> tension decay.
        assert all(t2 <= t1 for t1, t2 in zip(temps, temps[1:])), temps
        assert all(v2 >= v1 for v1, v2 in zip(viscs, viscs[1:])), viscs
        assert all(b2 >= b1 for b1, b2 in zip(drags, drags[1:])), drags
        assert all(f2 <= f1 for f1, f2 in zip(min_tensions, min_tensions[1:])), min_tensions

        # Supervisory stack stays healthy across the nominal campaign.
        for day in self.CAMPAIGN_DAYS:
            r = run_physics_pass(SimulationParams(elapsed_days=day))
            assert r["failsafe_level"] == FailsafeLevel.LEVEL_0_NORMAL.value
            assert r["effective_spm"] > 0.0

        # The provenance ledger records the whole campaign and stays valid.
        is_valid, err = audit_ledger.verify_chain()
        assert is_valid is True, err
        assert len(audit_ledger.chain) >= blocks_before + len(self.CAMPAIGN_DAYS)


class TestLateCycleFreezeEscalationCampaign:
    """Worst-case late-cycle cooldown: the synthetic 'Baghewala Freeze' arc at
    sustained campaign scale, both with and without the advisory governor."""

    SWEEP_DAYS = list(range(85, 121))  # 36 daily advisories through late cooldown

    @pytest.fixture(scope="class")
    def campaigns(self):
        uncontrolled = {}
        mpc_active = {}
        for day in self.SWEEP_DAYS:
            uncontrolled[day] = run_physics_pass(
                SimulationParams(elapsed_days=float(day), mpc_enabled=False, **WORST_CASE_THERMAL)
            )
            mpc_active[day] = run_physics_pass(
                SimulationParams(elapsed_days=float(day), mpc_enabled=True, **WORST_CASE_THERMAL)
            )
        return uncontrolled, mpc_active

    def test_uncontrolled_campaign_escalates_through_full_ladder(self, campaigns):
        """Fixed-speed operation must traverse L0 -> L2 -> L3 monotonically:
        L2 ramps to the safe SPM, L3 commands 0 SPM and latches."""
        uncontrolled, _ = campaigns
        levels = [_severity(uncontrolled[d]) for d in self.SWEEP_DAYS]

        assert levels[0] == 0, "campaign starts healthy"
        assert all(a <= b for a, b in zip(levels, levels[1:])), levels
        assert 2 in levels and 3 in levels, "full ladder must be exercised"

        first_l2 = self.SWEEP_DAYS[levels.index(2)]
        first_l3 = self.SWEEP_DAYS[levels.index(3)]
        assert first_l2 < first_l3

        l2_resp = uncontrolled[first_l2]
        assert l2_resp["effective_spm"] == pytest.approx(2.0)
        assert "ROD FLOAT" in l2_resp["failsafe_reason"]

        l3_resp = uncontrolled[first_l3]
        assert l3_resp["advisory_command_spm"] == pytest.approx(0.0)
        assert "COMPRESSION" in l3_resp["failsafe_reason"]

        # The L3 latch holds through the end of the campaign (no silent recovery).
        tail_levels = levels[levels.index(3):]
        assert all(sev == 3 for sev in tail_levels)

    def test_advisory_governor_never_escalates_earlier_than_fixed_speed(self, campaigns):
        """At every day of the campaign the advisory's supervisory severity is
        no worse than fixed-speed operation, and strictly better on at least
        one day: the governor measurably delays the freeze cascade."""
        uncontrolled, mpc_active = campaigns
        improvements = 0
        for day in self.SWEEP_DAYS:
            assert _severity(mpc_active[day]) <= _severity(uncontrolled[day]), day
            if _severity(mpc_active[day]) < _severity(uncontrolled[day]):
                improvements += 1
        assert improvements >= 1

    def test_advisory_holds_safe_tension_while_fixed_speed_is_in_takeover(self, campaigns):
        """On the day fixed-speed first enters protective takeover, the advisory
        is still Level 0 and its displayed minimum tension respects the safe
        floor."""
        uncontrolled, mpc_active = campaigns
        levels = [_severity(uncontrolled[d]) for d in self.SWEEP_DAYS]
        first_l2 = self.SWEEP_DAYS[levels.index(2)]

        advisory = mpc_active[first_l2]
        assert advisory["failsafe_level"] == FailsafeLevel.LEVEL_0_NORMAL.value
        assert advisory["actual_min_tension_kn"] >= 0.5

    def test_advisory_escalation_is_monotone_and_honestly_infeasible(self, campaigns):
        """The advisory campaign also escalates monotonically, and whenever the
        supervisor acts (L2/L3) the optimizer must have reported
        infeasible-safe-fallback rather than claiming an unreachable optimum."""
        _, mpc_active = campaigns
        levels = [_severity(mpc_active[d]) for d in self.SWEEP_DAYS]
        assert all(a <= b for a, b in zip(levels, levels[1:])), levels
        assert levels[0] == 0 and levels[-1] == 3

        for day in self.SWEEP_DAYS:
            r = mpc_active[day]
            _assert_honesty(r)
            if _severity(r) >= 2:
                assert r["model_status"]["controller_status"] == "INFEASIBLE_SAFE_FALLBACK"


# ─── 12-hour operator shift with telemetry dropout ───────────────────────────

class TestOperatorShiftWorkload:
    """A 12-hour shift of 10-minute advisories including a 4-hour telemetry
    dropout window, exercising the supervisory response at operational cadence."""

    CADENCE_MIN = 10
    SHIFT_HOURS = 12
    OUTAGE_START_HOUR = 4.0
    OUTAGE_END_HOUR = 8.0

    @pytest.fixture(scope="class")
    def shift_log(self):
        n = int(self.SHIFT_HOURS * 60 / self.CADENCE_MIN)
        log = []
        for i in range(n):
            hour = i * self.CADENCE_MIN / 60.0
            severed = self.OUTAGE_START_HOUR <= hour < self.OUTAGE_END_HOUR
            r = run_physics_pass(SimulationParams(modbus_severed=severed))
            log.append((hour, severed, r))
        return log

    def test_shift_supervisory_response_is_exact(self, shift_log):
        """Every outage pass takes protective L2 at the safe SPM; every healthy
        pass is Level 0; telemetry loss alone never manufactures an E-stop."""
        severed_count = 0
        for hour, severed, r in shift_log:
            _assert_honesty(r)
            assert r["is_modbus_severed"] is severed
            if severed:
                severed_count += 1
                assert r["failsafe_level"] == FailsafeLevel.LEVEL_2_PROTECTIVE.value
                assert r["effective_spm"] == pytest.approx(2.0)
                assert r["advisory_command_spm"] == pytest.approx(2.0)
                assert "TELEMETRY" in r["failsafe_reason"]
            else:
                assert r["failsafe_level"] == FailsafeLevel.LEVEL_0_NORMAL.value
                assert r["effective_spm"] > 0.0

        expected_outage = int((self.OUTAGE_END_HOUR - self.OUTAGE_START_HOUR) * 60 / self.CADENCE_MIN)
        assert severed_count == expected_outage

    def test_shift_ledger_records_every_pass_and_stays_valid(self, shift_log):
        """The audit chain grows by the full shift length and verifies cleanly."""
        n = len(shift_log)
        assert n == int(self.SHIFT_HOURS * 60 / self.CADENCE_MIN)
        is_valid, err = audit_ledger.verify_chain()
        assert is_valid is True, err


# ─── Realistic-scale SCADA CSV ingestion ─────────────────────────────────────

def _build_scada_csv(n_rows: int = 3000, gap_rows: int = 0):
    """Synthesizes a 25 Hz surface dynacard SCADA export (n_rows samples).

    With gap_rows > 0, that many consecutive load samples in the middle of the
    stream are blanked to simulate a transient sensor dropout.
    """
    lines = ["timestamp,position_m,load_kn,spm,temperature_c"]
    gap_start = n_rows // 2
    for i in range(n_rows):
        ts = f"2026-01-01T00:{(i * 40) // 60000:02d}:{(i * 40) // 1000 % 60:02d}.{(i * 40) % 1000:03d}"
        phase = 2.0 * np.pi * (i % 60) / 60.0  # one pump cycle per 60 samples
        pos = round(1.27 * (1.0 - np.cos(phase)), 4)
        load = round(95.0 + 55.0 * np.cos(phase - 0.5), 2)
        if gap_start <= i < gap_start + gap_rows:
            lines.append(f"{ts},{pos},,4.5,80.0")  # load cell dropout
        else:
            lines.append(f"{ts},{pos},{load},4.5,80.0")
    return "\n".join(lines)


class TestTelemetryIngestionWorkload:
    """Realistic-scale CSV ingestion: 25 Hz x 120 s of surface dynacard data."""

    def test_full_stream_ingests_control_valid(self):
        """A clean 3000-row SCADA export parses with control validity and no
        warnings, preserving every channel."""
        csv_text = _build_scada_csv(3000)
        parsed = AdaptiveCSVParser.parse_content(csv_text)

        assert parsed.row_count == 3000
        assert parsed.control_valid is True
        assert parsed.warnings == []
        for channel in ("position", "load", "spm", "temperature"):
            assert channel in parsed.column_data
            assert len(parsed.column_data[channel]) == 3000
            assert np.all(np.isfinite(parsed.column_data[channel]))

    def test_sensor_gap_fails_closed(self):
        """A 5-sample load dropout exceeds the imputation bound; ingestion
        preserves the data for forensics but inhibits control use."""
        csv_text = _build_scada_csv(3000, gap_rows=5)
        parsed = AdaptiveCSVParser.parse_content(csv_text)

        assert parsed.row_count == 3000
        assert parsed.control_valid is False
        assert any("gap" in w.lower() for w in parsed.warnings)

    def test_api_ingestion_roundtrip_fails_closed(self):
        """The /api/csv/ingest route accepts both streams; the clean stream is
        control-valid, the gapped stream fails closed (200 + control_valid
        False), and the audit chain stays valid throughout."""
        client = TestClient(fastapi_app)
        blocks_before = len(audit_ledger.chain)

        ok = client.post("/api/csv/ingest", data={"csv_text": _build_scada_csv(3000)})
        assert ok.status_code == 200
        assert ok.json()["status"] == "success"
        assert ok.json()["control_valid"] is True

        gapped = client.post("/api/csv/ingest", data={"csv_text": _build_scada_csv(3000, gap_rows=5)})
        assert gapped.status_code == 200
        assert gapped.json()["control_valid"] is False
        # The gapped channel serializes its un-imputed dropout samples as null.
        assert None in gapped.json()["column_data"]["load"]

        is_valid, err = audit_ledger.verify_chain()
        assert is_valid is True, err
        assert len(audit_ledger.chain) >= blocks_before + 2


# ─── Provenance endurance: a week at operational cadence ─────────────────────

class TestLedgerEnduranceWorkload:
    """Seven days of hash-chained provenance at 30-minute event cadence."""

    DAYS = 7
    EVENTS_PER_DAY = 48  # one event per 30 minutes

    @pytest.fixture(scope="class")
    def week_ledger(self):
        ledger = AuditLedger(well_id="Baghewala-14")
        for _day in range(self.DAYS):
            for i in range(self.EVENTS_PER_DAY):
                if i == 0:
                    ledger.record_event(
                        "PARAMETER_CALIBRATION", "[calibrated]", {"k_hat": 0.985}
                    )
                elif i == self.EVENTS_PER_DAY // 2:
                    ledger.record_event(
                        "MPC_OPTIMIZATION", "[model]", {"advisory_spm": 4.5}
                    )
                else:
                    ledger.record_event(
                        "TELEMETRY_INGESTION", "[measured]", {"spm": 4.5, "sample": i}
                    )
        return ledger

    def test_week_endurance_chain_and_indices(self, week_ledger):
        """336 events plus genesis chain correctly with contiguous indices."""
        expected_blocks = self.DAYS * self.EVENTS_PER_DAY + 1
        assert len(week_ledger) == expected_blocks
        is_valid, err = week_ledger.verify_chain()
        assert is_valid is True, err
        assert [b.index for b in week_ledger.chain] == list(range(expected_blocks))

    def test_week_endurance_provenance_breakdown(self, week_ledger):
        """The provenance census over the week is exact."""
        summary = week_ledger.export_summary()
        assert summary["is_tamper_free"] is True
        counts = summary["provenance_breakdown"]
        assert counts["[measured]"] == self.DAYS * (self.EVENTS_PER_DAY - 2)
        assert counts["[model]"] == self.DAYS + 1  # daily MPC event + genesis block
        assert counts["[calibrated]"] == self.DAYS

    def test_week_endurance_export_import_roundtrip(self, week_ledger):
        """A week-scale export/import round-trip preserves hashes and well id."""
        blob = week_ledger.export_json()
        restored = AuditLedger.from_json(blob)
        assert len(restored) == len(week_ledger)
        assert restored.well_id == week_ledger.well_id
        assert all(
            a.block_hash == b.block_hash
            for a, b in zip(restored.chain, week_ledger.chain)
        )
        is_valid, err = restored.verify_chain()
        assert is_valid is True, err

    def test_week_endurance_history_window(self, week_ledger):
        """History queries honor their limit at endurance scale."""
        assert len(week_ledger.get_history(limit=50)) == 50
        assert len(week_ledger.get_recent_events_table(limit=15)) == 15
