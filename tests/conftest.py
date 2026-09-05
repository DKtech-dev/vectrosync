"""
Global pytest fixtures and test configuration for Baghewala CSS-SRP Digital Twin.
Provides domain fixtures, reference mathematical oracles, and synthetic CSV/SCADA data streams.
"""

import math
import tempfile
from pathlib import Path
from typing import Any, Dict, List
import numpy as np
import pytest
from scipy.integrate import quad
from scipy.special import j1


@pytest.fixture(scope="session")
def baghewala_config() -> Dict[str, Any]:
    """Authoritative domain configuration for Baghewala Well-14 (Oil India Limited)."""
    return {
        "well_id": "BAGHEWALA-14",
        "field": "Baghewala Heavy Oil Field",
        "operator": "Oil India Limited",
        "formation": "Jodhpur Sandstone",
        "depth_m": 1150.0,
        "reservoir": {
            "TR_C": 48.0,
            "TR_K": 321.15,
            "Ts_C": 260.0,
            "Ts_K": 533.15,
            "rock_diffusivity_m2_s": 1.0e-6,
            "net_pay_h_m": 15.0,
            "steam_radius_rh_m": 12.0,
            "convective_loss_factor_delta": 0.05,
        },
        "rheology": {
            "T1_C": 50.0,
            "T1_K": 323.15,
            "mu1_Pas": 12.0,  # 12,000 cP
            "T2_C": 200.0,
            "T2_K": 473.15,
            "mu2_Pas": 0.045,  # 45 cP
            "mu_water_Pas": 0.001,
            "rho_oil_kg_m3": 950.0,
            "rho_water_kg_m3": 1000.0,
            "f_eccentric": 1.25,
            "D_tubing_m": 0.076,
        },
        "rod_string": {
            "total_length_m": 1150.0,
            "sections": [
                {
                    "section_id": 1,
                    "length_m": 350.0,
                    "diameter_m": 0.0254,  # 1.0 in
                    "diameter_in": 1.0,
                    "area_m2": 5.067075e-4,
                },
                {
                    "section_id": 2,
                    "length_m": 400.0,  # 350 to 750 m
                    "diameter_m": 0.022225,  # 7/8 in
                    "diameter_in": 0.875,
                    "area_m2": 3.879479e-4,
                },
                {
                    "section_id": 3,
                    "length_m": 400.0,  # 750 to 1150 m
                    "diameter_m": 0.01905,  # 3/4 in
                    "diameter_in": 0.75,
                    "area_m2": 2.850230e-4,
                },
            ],
            "steel_E_Pa": 2.07e11,
            "steel_rho_kg_m3": 7850.0,
            "acoustic_velocity_c_m_s": 5135.10,
            "top_section_rating_N": 314150.0,  # 314.15 kN
        },
        "pumping_unit": {
            "stroke_length_m": 2.54,  # 100 in
            "nominal_spm": 4.5,
            "min_spm": 1.0,
            "max_spm": 5.5,
            "plunger_diameter_m": 0.04445,  # 1.75 in
            "crank_lambda": 0.25,
        },
        "control": {
            "min_downhole_tension_N": 500.0,  # +0.5 kN anti-float
            "max_pprl_ratio": 0.90,  # 90% of rod rating
            "safe_fallback_spm": 2.0,
            "ramp_down_strokes": 3,
        },
    }


@pytest.fixture
def reference_bessel_quad():
    """Authoritative numerical reference oracle for Boberg-Lantz radial Bessel integral."""
    def _quad(b2: float) -> float:
        if b2 <= 1.0e-10:
            return 1.0
        if b2 >= 100.0:
            return 1.0 / (4.0 * b2)

        def integrand(y: float) -> float:
            return math.exp(-b2 * y * y) * (j1(y) ** 2) / y

        res, _ = quad(integrand, 0.0, np.inf, epsabs=1.0e-10, epsrel=1.0e-9, limit=1000)
        return float(2.0 * res)

    return _quad


@pytest.fixture
def reference_arrhenius():
    """Authoritative analytical reference oracle for 2-point Arrhenius viscosity."""
    T1, mu1 = 323.15, 12.0
    T2, mu2 = 473.15, 0.045
    B = math.log(mu1 / mu2) / (1.0 / T1 - 1.0 / T2)
    A = math.log(mu1) - B / T1

    def _mu(T_K: float) -> float:
        return math.exp(A + B / T_K)

    return _mu


@pytest.fixture
def temp_clean_scada_csv(tmp_path: Path) -> Path:
    """Creates a temporary standard-compliant SCADA CSV file."""
    csv_file = tmp_path / "scada_clean.csv"
    lines = [
        "timestamp,position_m,load_kn,spm,stroke_length_m,tubing_temp_c\n",
        "2026-09-01T10:00:00Z,0.000,120.5,4.5,2.54,180.0\n",
        "2026-09-01T10:00:01Z,0.635,145.2,4.5,2.54,180.0\n",
        "2026-09-01T10:00:02Z,1.270,168.0,4.5,2.54,179.9\n",
        "2026-09-01T10:00:03Z,1.905,182.4,4.5,2.54,179.9\n",
        "2026-09-01T10:00:04Z,2.540,190.1,4.5,2.54,179.8\n",
        "2026-09-01T10:00:05Z,1.905,110.3,4.5,2.54,179.8\n",
        "2026-09-01T10:00:06Z,1.270,85.2,4.5,2.54,179.7\n",
        "2026-09-01T10:00:07Z,0.635,65.0,4.5,2.54,179.7\n",
        "2026-09-01T10:00:08Z,0.000,50.1,4.5,2.54,179.6\n",
        "2026-09-01T10:00:09Z,0.635,145.0,4.5,2.54,179.6\n",
        "2026-09-01T10:00:10Z,1.270,167.8,4.5,2.54,179.5\n",
    ]
    csv_file.write_text("".join(lines), encoding="utf-8")
    return csv_file


@pytest.fixture
def temp_messy_headers_scada_csv(tmp_path: Path) -> Path:
    """Creates a temporary SCADA CSV file with non-standard alias headers and imperial units."""
    csv_file = tmp_path / "scada_messy_headers.csv"
    lines = [
        "Time_Stamp,POLISHED_ROD_LOAD_KLBS,Stroke_Disp_in,Speed_SPM,BHT_degF\n",
        "2026-09-01 10:00:00,27.09,0.0,4.5,356.0\n",
        "2026-09-01 10:00:01,32.64,25.0,4.5,356.0\n",
        "2026-09-01 10:00:02,37.77,50.0,4.5,355.8\n",
        "2026-09-01 10:00:03,41.00,75.0,4.5,355.8\n",
        "2026-09-01 10:00:04,42.73,100.0,4.5,355.6\n",
        "2026-09-01 10:00:05,24.79,75.0,4.5,355.6\n",
        "2026-09-01 10:00:06,19.15,50.0,4.5,355.4\n",
        "2026-09-01 10:00:07,14.61,25.0,4.5,355.4\n",
        "2026-09-01 10:00:08,11.26,0.0,4.5,355.2\n",
        "2026-09-01 10:00:09,32.60,25.0,4.5,355.2\n",
        "2026-09-01 10:00:10,37.72,50.0,4.5,355.0\n",
    ]
    csv_file.write_text("".join(lines), encoding="utf-8")
    return csv_file


@pytest.fixture
def temp_short_gap_scada_csv(tmp_path: Path) -> Path:
    """Creates a temporary SCADA CSV file with a 2-sample interior missing data gap."""
    csv_file = tmp_path / "scada_short_gap.csv"
    lines = [
        "timestamp,position_m,load_kn,spm\n",
        "2026-09-01T10:00:00Z,0.00,120.0,4.5\n",
        "2026-09-01T10:00:01Z,0.50,140.0,4.5\n",
        "2026-09-01T10:00:02Z,,NaN,4.5\n",  # Gap sample 1
        "2026-09-01T10:00:03Z,,NaN,4.5\n",  # Gap sample 2
        "2026-09-01T10:00:04Z,2.00,180.0,4.5\n",
        "2026-09-01T10:00:05Z,2.50,190.0,4.5\n",
        "2026-09-01T10:00:06Z,2.00,110.0,4.5\n",
        "2026-09-01T10:00:07Z,1.50,85.0,4.5\n",
        "2026-09-01T10:00:08Z,1.00,65.0,4.5\n",
        "2026-09-01T10:00:09Z,0.50,50.0,4.5\n",
        "2026-09-01T10:00:10Z,0.00,120.0,4.5\n",
    ]
    csv_file.write_text("".join(lines), encoding="utf-8")
    return csv_file


@pytest.fixture
def temp_long_gap_scada_csv(tmp_path: Path) -> Path:
    """Creates a temporary SCADA CSV file with a 10-sample interior missing data gap (>3 samples)."""
    csv_file = tmp_path / "scada_long_gap.csv"
    lines = ["timestamp,position_m,load_kn,spm\n"]
    for i in range(20):
        t_str = f"2026-09-01T10:00:{i:02d}Z"
        if 4 <= i <= 13:
            lines.append(f"{t_str},,NaN,4.5\n")
        else:
            lines.append(f"{t_str},1.25,150.0,4.5\n")
    csv_file.write_text("".join(lines), encoding="utf-8")
    return csv_file


@pytest.fixture
def temp_corrupt_scada_csv(tmp_path: Path) -> Path:
    """Creates a temporary SCADA CSV file with corrupt data (out-of-order time, non-numeric strings)."""
    csv_file = tmp_path / "scada_corrupt.csv"
    lines = [
        "timestamp,position_m,load_kn,spm\n",
        "2026-09-01T10:00:05Z,1.00,150.0,4.5\n",
        "2026-09-01T10:00:02Z,CORRUPT_VALUE,160.0,4.5\n",  # Backward timestamp + bad float
        "2026-09-01T10:00:08Z,2.00,-999999.0,4.5\n",      # Physically impossible load
    ]
    csv_file.write_text("".join(lines), encoding="utf-8")
    return csv_file
