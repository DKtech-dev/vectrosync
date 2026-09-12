"""
Telemetry Reconstruction Anomaly Detector (src/anomaly_detector.py)
==================================================================
Unsupervised bottleneck reconstruction model detecting anomalous thermo-mechanical
coupling signatures across 5 SCADA telemetry channels:
1. Volumetric reservoir temperature (T_avg, deg C)
2. Fluid apparent mixture viscosity (mu, cP)
3. Pumping speed (SPM)
4. Minimum downhole tension (F_min, kN)
5. Surface motor power (P_motor, kW)

Physical Basis:
---------------
During unmitigated cyclic steam soak depletion, cooling crude undergoes an exponential
viscosity surge. In normal operations, motor power and rod tensions track this along a
well-defined thermo-mechanical manifold.

When non-physical decoupling occurs—such as rapid localized reservoir quenching,
uncontrolled water coning, paraffin precipitation, or gas breakout—the telemetry vector
deviates from the learned latent subspace. The normalized reconstruction error spikes
hours before single-variable high/low threshold alarms trip.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Dict, List, Sequence, Tuple, Union
import numpy as np


@dataclass
class AnomalyReport:
    anomaly_score: float
    is_anomalous: bool
    status: str  # NOMINAL | ELEVATED | CRITICAL
    channel_residuals: Dict[str, float]
    inference_time_ms: float
    description: str


CHANNEL_NAMES = [
    "temperature_c",
    "viscosity_cp",
    "spm",
    "min_tension_kn",
    "motor_power_kw",
]


class TelemetryAnomalyDetector:
    """
    PCA / Bottleneck projection autoencoder for 5-channel SCADA telemetry.
    """

    def __init__(
        self,
        mean: np.ndarray | None = None,
        std: np.ndarray | None = None,
        components: np.ndarray | None = None,
        threshold_elevated: float = 1.8,
        threshold_critical: float = 3.5,
    ):
        self.d_in = 5
        self.d_latent = 2
        self.thresh_elevated = threshold_elevated
        self.thresh_critical = threshold_critical

        # Calibrated nominal baseline for Baghewala Reference Asset
        # T: ~80 C, Visc: ~1200 cP, SPM: ~3.8, F_min: ~5.0 kN, Power: ~18.5 kW
        self.mean = np.array([80.0, 1200.0, 3.8, 5.0, 18.5], dtype=np.float64) if mean is None else np.copy(mean)
        self.std = np.array([25.0, 800.0, 1.2, 4.0, 6.0], dtype=np.float64) if std is None else np.copy(std)

        if components is None:
            # Calibrated principal thermo-mechanical eigenvectors
            # PC1: Thermal-viscosity-load coupling
            # PC2: Speed-power dynamics
            self.components = np.array([
                [-0.52,  0.58,  0.15, -0.48,  0.38],
                [ 0.12, -0.15,  0.68, -0.18,  0.68],
            ], dtype=np.float64)
            # Orthonormalize
            self.components[0] /= np.linalg.norm(self.components[0])
            self.components[1] -= np.dot(self.components[1], self.components[0]) * self.components[0]
            self.components[1] /= np.linalg.norm(self.components[1])
        else:
            self.components = np.copy(components)

    def fit(self, X: np.ndarray) -> Dict[str, float]:
        """
        Fits the autoencoder on nominal telemetry history matrix X of shape (N, 5).
        """
        self.mean = np.mean(X, axis=0)
        self.std = np.std(X, axis=0) + 1e-6
        X_norm = (X - self.mean) / self.std

        # SVD for optimal linear autoencoder subspace
        _, _, Vt = np.linalg.svd(X_norm, full_matrices=False)
        self.components = Vt[:self.d_latent]

        # Compute threshold as 98th percentile of reconstruction errors on training set
        scores = []
        for row in X:
            rep = self.score_sample(row)
            scores.append(rep.anomaly_score)
        self.thresh_elevated = float(np.percentile(scores, 95.0))
        self.thresh_critical = float(np.percentile(scores, 99.0))

        return {
            "samples": len(X),
            "thresh_elevated": self.thresh_elevated,
            "thresh_critical": self.thresh_critical,
        }

    def score_sample(
        self,
        telemetry: Sequence[float],
    ) -> AnomalyReport:
        """
        Scores a 5-element telemetry vector: [temp_c, visc_cp, spm, min_tension_kn, power_kw].
        """
        t0 = time.perf_counter()
        x = np.asarray(telemetry, dtype=np.float64)
        if len(x) != 5:
            raise ValueError(f"Expected 5 channels, got {len(x)}")

        x_norm = (x - self.mean) / self.std
        # Encode: z = x_norm * V^T
        latent = np.dot(x_norm, self.components.T)
        # Decode: x_hat = z * V
        x_recon_norm = np.dot(latent, self.components)

        # Residuals
        diff = x_norm - x_recon_norm
        squared_errs = diff ** 2
        anomaly_score = float(np.mean(squared_errs))

        dt_ms = (time.perf_counter() - t0) * 1000.0

        if anomaly_score >= self.thresh_critical:
            status = "CRITICAL"
            is_anom = True
        elif anomaly_score >= self.thresh_elevated:
            status = "ELEVATED"
            is_anom = True
        else:
            status = "NOMINAL"
            is_anom = False

        channel_dict = {
            name: float(err)
            for name, err in zip(CHANNEL_NAMES, squared_errs)
        }

        # Identify dominant anomaly driver
        max_channel = CHANNEL_NAMES[int(np.argmax(squared_errs))]
        if is_anom:
            desc = (
                f"{status} anomaly detected (score {anomaly_score:.2f} vs threshold {self.thresh_elevated:.2f}). "
                f"Dominant driver: {max_channel} (reconstruction residual {channel_dict[max_channel]:.2f})."
            )
        else:
            desc = f"Telemetry conforms to nominal thermo-mechanical manifold (score {anomaly_score:.2f})."

        return AnomalyReport(
            anomaly_score=anomaly_score,
            is_anomalous=is_anom,
            status=status,
            channel_residuals=channel_dict,
            inference_time_ms=dt_ms,
            description=desc,
        )
