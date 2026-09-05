"""
Tier 3 Cross-Feature Combination Test Suite: Causal Cooling Disturbance Chain.
Covers:
- The complete multi-physics causal chain:
  Reservoir Thermal Decay -> Dynamic Viscosity Surge -> Couette Shear Drag Increase
  -> Rod Float Compression Risk -> Fast MPC SPM Throttling -> Tension Restoration (>= +0.5 kN).
- Lineage tracking and provenance recording across the entire chain in the SHA-256 ledger.
"""

import math
import numpy as np
import pytest

from src.audit import AuditLedger
from src.thermal import ThermalAssetParameters, ThermalDecayEngine
from tests.tier1_feature_coverage.test_mpc_optimization import FastMPCController, MPCConfig, WellState
from tests.tier1_feature_coverage.test_rheology_arrhenius import HeavyOilRheology


class TestCausalCoolingDisturbanceChain:
    """Validates the multi-physics causal response from thermal decay to MPC control action."""

    def test_full_causal_cooldown_and_tension_restoration_chain(self):
        """Traces the 7-step causal sequence from 180 C reservoir cooling to MPC tension preservation."""
        ledger = AuditLedger(well_id="Baghewala-14")

        # Step 1: Thermal engine evaluates cooldown from 180 C down to 50 C
        thermal_engine = ThermalDecayEngine()
        tau_hot = 3600.0 * 24 * 5      # 5 days (hot post-steam)
        t_hot_k = thermal_engine.temperature_calibrated(tau_hot, k_hat=1.0)
        t_cold_k = 50.0 + 273.15       # 50 C (late-time cold heavy oil)

        ledger.record_event(
            event_type="THERMAL_DECAY_FORECAST",
            provenance_tag="[model]",
            payload={"t_hot_C": t_hot_k - 273.15, "t_cold_C": t_cold_k - 273.15},
        )

        # Step 2: Rheology evaluates viscosity surge
        rheo = HeavyOilRheology()
        mu_hot = rheo.mixture_viscosity(t_hot_k, fw=0.15)
        mu_cold = rheo.mixture_viscosity(t_cold_k, fw=0.15)
        assert mu_cold > 15.0 * mu_hot  # Severe exponential surge in viscosity

        # Step 3: Distributed Couette drag beta increases by > 15x
        r_rod_top = 0.0127  # 1.0 in
        beta_hot = rheo.couette_drag_beta(mu_hot, r_rod=r_rod_top)
        beta_cold = rheo.couette_drag_beta(mu_cold, r_rod=r_rod_top)
        assert beta_cold > 15.0 * beta_hot

        # Step 4: High speed (4.5 SPM) under cold drag causes rod compression risk (< 0.5 kN)
        gamma_drag = 0.10
        w_submerged = 3.5  # kN
        tension_uncontrolled_cold = w_submerged - gamma_drag * mu_cold * 4.5
        assert tension_uncontrolled_cold < 0.5  # Violates +0.5 kN safety envelope

        # Step 5: Fast MPC solves 12-hour horizon with cooling forecast
        mpc = FastMPCController(MPCConfig(min_tension_kN=0.5))
        forecast_temps_C = list(np.linspace(t_hot_k - 273.15, t_cold_k - 273.15, 24))
        state = WellState(spm_current=4.5, temperature_C=t_hot_k - 273.15, viscosity_Pas=mu_hot)

        mpc_result = mpc.solve(state, forecast_temps_C)

        # Step 6: MPC proactively throttles SPM down
        assert mpc_result.spm_trajectory[-1] <= 3.0
        assert min(mpc_result.predicted_min_tension_kN) >= 0.5 - 1e-4

        ledger.record_event(
            event_type="MPC_CONTROL_ACTION",
            provenance_tag="[model]",
            payload={
                "recommended_spm": mpc_result.optimal_spm,
                "final_spm": mpc_result.spm_trajectory[-1],
                "min_tension_kN": min(mpc_result.predicted_min_tension_kN),
            },
        )

        # Step 7: Verify unbroken audit ledger chain
        is_valid, msg = ledger.verify_chain()
        assert is_valid is True
        assert msg is None
        assert len(ledger.chain) == 3
