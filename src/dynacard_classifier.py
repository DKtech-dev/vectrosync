"""
Dynacard Feature Classifier (src/dynacard_classifier.py)
=========================================================
Interpretable 16-dimensional geometric and Fourier feature classifier for
surface and downhole sucker-rod dynamometer cards.

Architectural Rationale:
------------------------
In heavy-oil artificial lift, black-box deep convolutional networks on rasterized
images present two major operational liabilities:
1. High edge compute/memory footprints unsuitable for field RTUs/PLCs.
2. Inability to explain *why* a card is abnormal to production engineers.

This module implements SPE-standard geometric feature extraction (Gibbs, 1990;
Lea, 2008) combined with a calibrated multiclass softmax classifier. It extracts
16 interpretable features:
- Card normalized area (work per stroke)
- Centroid coordinates (u_c, F_c)
- Envelope width and upstroke/downstroke force separation
- Compressive load integral (downstroke negative force area)
- Bottom dead center slope (fluid pound signature)
- First 6 Fourier harmonic power coefficients

Classes:
--------
0: NORMAL_OPERATION       - Symmetrical loop with positive tension throughout
1: ROD_FLOAT_PRECURSOR   - Severe downward compression, negative downstroke force
2: FLUID_POUND           - Incomplete pump fillage; sharp delayed load pickup on upstroke
3: GAS_INTERFERENCE      - Gradual expansion/compression curves with rounded corners
4: PARTED_ROD            - Near-horizontal line; zero work loop, minimal load variation
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Dict, List, Sequence, Tuple, Union
import numpy as np


CLASS_NAMES = [
    "NORMAL_OPERATION",
    "ROD_FLOAT_PRECURSOR",
    "FLUID_POUND",
    "GAS_INTERFERENCE",
    "PARTED_ROD",
]

DEFAULT_WEIGHTS = np.array([[  3.2492,   0.038 ,   3.7132,   2.8482,   0.0289,   0.0551,   0.0289,   0.0392,  -0.1559,  -0.0615,   0.4479,
    0.1621,  -0.3866,   2.3034,   0.853 ,  11.344 ],
 [  0.5897,   1.2374,  -0.5299,   0.5057,  -0.0597,   0.0551,  -0.0597,   0.1396,   0.5674,   0.2236,   0.082 ,
    0.105 ,  -0.261 ,  -1.0561,  -0.139 ,  -2.5421],
 [ -1.475 ,   5.695 ,  -7.5464,  -0.9312,   0.0138,   0.0551,   0.0138,  -0.0841,  -0.0398,  -0.0159,  -0.3503,
   -0.4185,  -1.2427,   4.1363,   5.3681,   0.9863],
 [ -0.9591,   4.3069,   0.3692,  -0.6614,   0.0297,   0.0551,   0.0297,  -0.0673,  -0.2399,  -0.0947,   0.0217,
    0.6106,   2.6366,  -2.6229,  -4.1638,  -7.6471],
 [ -1.4048, -11.2773,   3.9938,  -1.7614,  -0.0128,   0.0551,  -0.0128,  -0.0275,  -0.1318,  -0.0516,  -0.2013,
   -0.4591,  -0.7463,  -2.7607,  -1.9183,  -2.1411]], dtype=np.float64)

DEFAULT_BIAS = np.array([-10.8756,   1.8663,  -0.4668,  -1.9133,  11.3894], dtype=np.float64)


@dataclass
class ClassificationResult:
    predicted_class: str
    confidence: float
    probabilities: Dict[str, float]
    features: Dict[str, float]
    interpretable_reason: str


class DynacardFeatureClassifier:
    """
    Extracts 16 geometric & Fourier features from sucker-rod dynamometer cards
    and performs multiclass probabilistic classification.
    """

    def __init__(
        self,
        weights: np.ndarray | None = None,
        bias: np.ndarray | None = None,
    ):
        self.weights = np.copy(DEFAULT_WEIGHTS if weights is None else weights)
        self.bias = np.copy(DEFAULT_BIAS if bias is None else bias)

    @staticmethod
    def extract_features(
        positions: Sequence[float],
        loads: Sequence[float],
    ) -> Tuple[np.ndarray, Dict[str, float]]:
        u = np.asarray(positions, dtype=np.float64)
        f = np.asarray(loads, dtype=np.float64)
        n = len(u)
        if n < 8:
            raise ValueError(f"Dynacard requires at least 8 samples, got {n}")

        stroke = float(np.ptp(u))
        if stroke < 1e-4:
            stroke = 1.0

        f_min = float(np.min(f))
        f_max = float(np.max(f))
        load_range = max(1e-4, f_max - f_min)

        u_closed = np.append(u, u[0])
        f_closed = np.append(f, f[0])
        raw_area = 0.5 * np.abs(np.sum(u_closed[:-1] * f_closed[1:] - u_closed[1:] * f_closed[:-1]))
        area_norm = float(raw_area / (stroke * load_range))

        centroid_u = float(np.mean(u) / stroke)
        centroid_f = float((np.mean(f) - f_min) / load_range)
        aspect_ratio = float(load_range / stroke)

        du = np.gradient(u)
        upstroke_mask = du > 0
        downstroke_mask = du < 0

        f_up_mean = float(np.mean(f[upstroke_mask])) if np.any(upstroke_mask) else float(np.mean(f))
        f_down_mean = float(np.mean(f[downstroke_mask])) if np.any(downstroke_mask) else float(np.mean(f))
        envelope_spread_norm = float((f_up_mean - f_down_mean) / load_range)

        negative_loads = np.maximum(0.0, -f)
        compression_integral = float(np.trapezoid(negative_loads, u) if hasattr(np, 'trapezoid') else np.trapz(negative_loads, u)) if np.ptp(u) > 0 else 0.0
        downstroke_min_kN = float(np.min(f[downstroke_mask])) if np.any(downstroke_mask) else f_min

        min_u_idx = int(np.argmin(u))
        window = max(2, n // 16)
        idx_start = max(0, min_u_idx - window)
        idx_end = min(n, min_u_idx + window + 1)
        if idx_end > idx_start + 1:
            du_local = u[idx_end - 1] - u[idx_start]
            df_local = f[idx_end - 1] - f[idx_start]
            bdc_slope = float(df_local / du_local) if abs(du_local) > 1e-4 else 0.0
        else:
            bdc_slope = 0.0

        f_detrended = f - np.mean(f)
        fft_coeffs = np.fft.rfft(f_detrended)
        power_spectrum = np.abs(fft_coeffs)
        total_power = np.sum(power_spectrum) + 1e-6

        fourier_harmonics = []
        for h in range(1, 7):
            if h < len(power_spectrum):
                fourier_harmonics.append(float(power_spectrum[h] / total_power))
            else:
                fourier_harmonics.append(0.0)

        feat_vector = np.array([
            area_norm,
            centroid_u,
            centroid_f,
            envelope_spread_norm,
            f_min,
            compression_integral,
            downstroke_min_kN,
            bdc_slope / 100.0,
            aspect_ratio / 50.0,
            load_range / 50.0,
            fourier_harmonics[0] * 10.0,
            fourier_harmonics[1] * 10.0,
            fourier_harmonics[2] * 10.0,
            fourier_harmonics[3] * 10.0,
            fourier_harmonics[4] * 10.0,
            fourier_harmonics[5] * 10.0,
        ], dtype=np.float64)

        feat_dict = {
            "area_norm": area_norm,
            "centroid_u_norm": centroid_u,
            "centroid_f_norm": centroid_f,
            "envelope_spread_norm": envelope_spread_norm,
            "f_min_kN": f_min,
            "compression_integral_kN_m": compression_integral,
            "downstroke_min_kN": downstroke_min_kN,
            "bdc_stiffness_slope": bdc_slope,
            "aspect_ratio_kN_m": aspect_ratio,
            "load_range_kN": load_range,
            "fourier_p1": fourier_harmonics[0],
            "fourier_p2": fourier_harmonics[1],
            "fourier_p3": fourier_harmonics[2],
            "fourier_p4": fourier_harmonics[3],
            "fourier_p5": fourier_harmonics[4],
            "fourier_p6": fourier_harmonics[5],
        }

        return feat_vector, feat_dict

    def predict(
        self,
        positions: Sequence[float],
        loads: Sequence[float],
    ) -> ClassificationResult:
        feat_vector, feat_dict = self.extract_features(positions, loads)

        logits = np.dot(self.weights, feat_vector) + self.bias
        exp_logits = np.exp(logits - np.max(logits))
        probabilities = exp_logits / np.sum(exp_logits)

        pred_idx = int(np.argmax(probabilities))
        pred_class = CLASS_NAMES[pred_idx]
        confidence = float(probabilities[pred_idx])

        if pred_class == "ROD_FLOAT_PRECURSOR":
            reason = (
                f"Downstroke minimum load plunged to {feat_dict['downstroke_min_kN']:.2f} kN "
                f"(compression integral {feat_dict['compression_integral_kN_m']:.2f} kN·m). "
                f"Viscous fluid drag exceeds submerged rod buoyant self-weight."
            )
        elif pred_class == "FLUID_POUND":
            reason = (
                f"Incomplete fillage detected with sharp BDC impact slope "
                f"({feat_dict['bdc_stiffness_slope']:.1f} kN/m) and elevated harmonics."
            )
        elif pred_class == "GAS_INTERFERENCE":
            reason = (
                f"Gas compression curvature observed with reduced area ratio "
                f"({feat_dict['area_norm']:.3f}) and characteristic harmonic distortion."
            )
        elif pred_class == "PARTED_ROD":
            reason = (
                f"Card collapsed to near-zero load range ({feat_dict['load_range_kN']:.2f} kN) "
                f"and negligible work area ({feat_dict['area_norm']:.3f})."
            )
        else:
            reason = (
                f"Nominal dynacard work loop with positive tension envelope "
                f"(min load {feat_dict['f_min_kN']:.2f} kN, area ratio {feat_dict['area_norm']:.3f})."
            )

        prob_dict = {cls: float(prob) for cls, prob in zip(CLASS_NAMES, probabilities)}

        return ClassificationResult(
            predicted_class=pred_class,
            confidence=confidence,
            probabilities=prob_dict,
            features=feat_dict,
            interpretable_reason=reason,
        )
