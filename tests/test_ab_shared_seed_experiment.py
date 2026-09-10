"""
Unit tests for the deterministic shared-seed A/B benchmark experiment.
Validates Section 2.2 of IMPROVEMENT_PLAN.md:
Baseline (uncoupled fixed 4.7 SPM) vs Coupled Digital Twin (FastMPCController)
under identical latent cooling disturbances and measurement noise.
"""

import pytest
import numpy as np
from src.generator import DEFAULT_DATA_GENERATOR


def test_ab_benchmark_determinism():
    """Verify that running the benchmark with the same seed produces exact identical outputs."""
    exp1 = DEFAULT_DATA_GENERATOR.generate_ab_benchmark_experiment(n_steps=24, seed=42)
    exp2 = DEFAULT_DATA_GENERATOR.generate_ab_benchmark_experiment(n_steps=24, seed=42)

    assert exp1["baseline_float_count"] == exp2["baseline_float_count"]
    assert exp1["coupled_float_count"] == exp2["coupled_float_count"]

    for r1, r2 in zip(exp1["baseline"], exp2["baseline"]):
        assert r1["hour"] == r2["hour"]
        assert r1["min_tension_kn"] == r2["min_tension_kn"]
        assert r1["spm"] == r2["spm"]
        assert r1["is_floating"] == r2["is_floating"]

    for r1, r2 in zip(exp1["coupled"], exp2["coupled"]):
        assert r1["hour"] == r2["hour"]
        assert r1["min_tension_kn"] == r2["min_tension_kn"]
        assert r1["spm"] == r2["spm"]
        assert r1["is_floating"] == r2["is_floating"]


def test_ab_benchmark_anti_float_efficacy():
    """Verify that the coupled twin eliminates rod float while uncoupled baseline suffers multiple buckling events."""
    exp = DEFAULT_DATA_GENERATOR.generate_ab_benchmark_experiment(n_steps=24, seed=42)

    # Baseline must encounter severe floating as crude cools and drag spikes
    assert exp["baseline_float_count"] > 10, (
        f"Baseline should have numerous float events under severe cooling, got {exp['baseline_float_count']}"
    )

    # Coupled twin must encounter zero float events
    assert exp["coupled_float_count"] == 0, (
        f"Coupled twin should have 0 float events, got {exp['coupled_float_count']}"
    )

    # Every single coupled step must maintain positive downhole tension >= 0.50 kN
    for rec in exp["coupled"]:
        assert rec["min_tension_kn"] >= 0.50, (
            f"Hour {rec['hour']}: Coupled min tension {rec['min_tension_kn']} kN violated anti-float floor (0.50 kN)"
        )


def test_ab_benchmark_actuator_limits_and_load():
    """Verify that coupled twin respects SPM slew rate limits and stays well below PPRL rating."""
    exp = DEFAULT_DATA_GENERATOR.generate_ab_benchmark_experiment(n_steps=24, seed=42)

    coupled = exp["coupled"]
    for i in range(1, len(coupled)):
        delta_spm = abs(coupled[i]["spm"] - coupled[i - 1]["spm"])
        # Slew rate limit is 0.25 SPM per step
        assert delta_spm <= 0.25 + 1e-4, (
            f"Hour {coupled[i]['hour']}: Slew rate exceeded: delta_spm={delta_spm:.4f} > 0.25"
        )

    for rec in coupled:
        # Working unit rating 90% limit is 99.0 kN
        assert rec["pprl_kn"] <= 99.0, (
            f"Hour {rec['hour']}: PPRL {rec['pprl_kn']} kN exceeded safe rating 99.0 kN"
        )
