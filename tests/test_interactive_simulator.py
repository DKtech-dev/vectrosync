"""
Unit Test Suite for Interactive Simulator Modules (tests/test_interactive_simulator.py)
Tests Animated SVG Wellbore Twin, WhyEngine Explainable AI Copilot, Scenario Presets,
and 2D Depth-Stress Spatiotemporal Calculation.
"""

import pytest
import numpy as np

from src.animated_well import render_animated_well_html
from src.why_engine import WhyEngine, DiagnosticReasoning
from src.scenario_runner import ScenarioRunner, ScenarioType
from src.depth_stress import compute_spatiotemporal_stress_matrix, create_depth_stress_heatmap
from src.rod_conservative import ConservativeRodWaveSolver


class TestAnimatedWellTwin:
    def test_render_normal_state_html(self):
        html = render_animated_well_html(
            spm=3.5,
            temp_c=75.0,
            min_tension_kn=0.65,
            is_buckling=False,
            is_modbus_severed=False,
        )
        assert isinstance(html, str)
        assert "<svg" in html
        assert "MODEL SCREEN" in html
        assert "SECTION 1" in html
        assert "SECTION 3" in html
        assert "g-beam" in html
        assert "SYNTHETIC STREAM" in html

    def test_render_buckling_failure_state_html(self):
        html = render_animated_well_html(
            spm=4.7,
            temp_c=50.0,
            min_tension_kn=-1.8,
            is_buckling=True,
            is_modbus_severed=False,
        )
        assert isinstance(html, str)
        assert "MODELED COMPRESSION ALERT" in html
        assert "Buckling/contact mechanics not resolved" in html
        assert "#c0392b" in html  # Red danger color

    def test_render_modbus_severance_state_html(self):
        html = render_animated_well_html(
            spm=2.0,
            temp_c=65.0,
            min_tension_kn=0.55,
            is_buckling=False,
            is_modbus_severed=True,
        )
        assert "SIMULATED TIMEOUT" in html


class TestWhyEngine:
    def test_normal_mitigation_explanation(self):
        diag = WhyEngine.generate_explanation(
            elapsed_days=12.0,
            temp_c=51.2,
            viscosity_cp=9800.0,
            drag_beta=1.72,
            min_tension_kn=0.65,
            nominal_spm=4.7,
            effective_spm=2.8,
            is_modbus_severed=False,
        )
        assert isinstance(diag, DiagnosticReasoning)
        assert "9,800 cP" in diag.trigger_event
        assert "1.72 N·s/m²" in diag.trigger_event
        assert "reduced-order governor" in diag.dispatched_action
        assert "+0.65 kN" in diag.structural_outcome
        assert diag.provenance_tag == "[synthetic model]"
        combined = " ".join(diag.to_dict().values())
        assert "68%" not in combined
        assert "₹" not in combined
        assert "autonomous" not in combined.lower()
        assert "[calibrated]" not in combined

    def test_buckling_failure_explanation(self):
        diag = WhyEngine.generate_explanation(
            elapsed_days=16.0,
            temp_c=50.0,
            viscosity_cp=12000.0,
            drag_beta=2.10,
            min_tension_kn=-1.8,
            nominal_spm=4.7,
            effective_spm=4.7,
            is_modbus_severed=False,
        )
        assert "modeled compression" in diag.forward_horizon.lower()
        assert "does not resolve" in diag.forward_horizon.lower()
        assert "not proof of rod parting" in diag.structural_outcome.lower()

    def test_modbus_severance_explanation(self):
        diag = WhyEngine.generate_explanation(
            elapsed_days=12.0,
            temp_c=65.0,
            viscosity_cp=4500.0,
            drag_beta=0.95,
            min_tension_kn=0.55,
            nominal_spm=4.2,
            effective_spm=2.0,
            failsafe_level="LEVEL_2_PROTECTIVE",
            is_modbus_severed=True,
        )
        assert "Modbus" in diag.trigger_event
        assert "LEVEL_2_PROTECTIVE" in diag.dispatched_action
        assert "does not dispatch" in diag.dispatched_action

    def test_non_finite_inputs_are_rejected(self):
        with pytest.raises(ValueError, match="finite"):
            WhyEngine.generate_explanation(min_tension_kn=float("nan"))


class TestScenarioRunner:
    def test_all_scenario_presets_valid(self):
        for stype in ScenarioType:
            preset = ScenarioRunner.get_preset(stype)
            assert preset.name is not None
            assert preset.cooling_multiplier > 0.0
            assert preset.elapsed_days >= 0.0
            assert preset.target_spm >= 1.0

    def test_scenario_a_preset_parameters(self):
        cfg_a = ScenarioRunner.get_preset(ScenarioType.SCENARIO_A_BASELINE_FAILURE)
        assert cfg_a.cooling_multiplier == 2.20
        assert cfg_a.expected_min_tension_kn == -1.80
        assert not cfg_a.mpc_enabled

    def test_scenario_b_preset_parameters(self):
        # expected_spm/expected_min_tension_kn are genuinely computed by
        # compute_expected_advisory_spm/compute_expected_downhole_tension
        # (not literal constants), so assert the safety PROPERTY rather than
        # an exact value that would drift whenever the physics changes.
        cfg_b = ScenarioRunner.get_preset(ScenarioType.SCENARIO_B_COUPLED_TWIN)
        assert cfg_b.cooling_multiplier == 2.20
        assert cfg_b.expected_spm <= 3.5
        assert cfg_b.expected_min_tension_kn >= 0.5
        assert cfg_b.mpc_enabled

    def test_scenario_c_preset_parameters(self):
        cfg_c = ScenarioRunner.get_preset(ScenarioType.SCENARIO_C_TELEMETRY_SEVERED)
        assert cfg_c.modbus_severed is True
        assert cfg_c.expected_failsafe_state == "LEVEL_2_PROTECTIVE"


class TestDepthStressInspector:
    def test_stress_matrix_computation(self):
        solver = ConservativeRodWaveSolver(dx=10.0)
        card = solver.simulate_card(spm=3.5, temp_c=75.0, water_cut=0.25)
        
        angles_deg, depths_m, stress_mat = compute_spatiotemporal_stress_matrix(
            depths_m=solver.node_depths,
            node_areas_m2=solver.node_area,
            dynacard_result=card,
            spm=3.5,
            is_buckling=False,
        )

        assert len(angles_deg) == 144
        assert len(depths_m) == len(solver.node_depths)
        assert stress_mat.shape == (len(solver.node_depths), 144)
        # Top section surface stress should be positive tensile
        assert stress_mat[0, :].mean() > 40.0  # MPa

    def test_stress_matrix_buckling_state(self):
        solver = ConservativeRodWaveSolver(dx=10.0)
        card = solver.simulate_card(spm=4.7, temp_c=50.0, water_cut=0.25)

        _angles_deg, _depths_m, stress_mat = compute_spatiotemporal_stress_matrix(
            depths_m=solver.node_depths,
            node_areas_m2=solver.node_area,
            dynacard_result=card,
            spm=4.7,
            is_buckling=True,
        )

        # Bottom section should contain negative compressive stress values during downstroke
        assert np.any(stress_mat[-1, :] < 0.0)

    def test_heatmap_figure_generation(self):
        solver = ConservativeRodWaveSolver(dx=10.0)
        card = solver.simulate_card(spm=3.5, temp_c=75.0, water_cut=0.25)
        angles_deg, depths_m, stress_mat = compute_spatiotemporal_stress_matrix(
            depths_m=solver.node_depths,
            node_areas_m2=solver.node_area,
            dynacard_result=card,
            spm=3.5,
            is_buckling=False,
        )
        fig = create_depth_stress_heatmap(angles_deg, depths_m, stress_mat, is_buckling=False)
        assert fig is not None
        assert "Heatmap" in str(type(fig.data[0]))
