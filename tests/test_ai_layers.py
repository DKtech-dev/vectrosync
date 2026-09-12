"""
Unit Test Suite for VectroSync AI Layer (tests/test_ai_layers.py)
================================================================
Tests:
- Layer 2: DynacardFeatureClassifier (feature extraction, multiclass inference, edge cases)
- Layer 3: NeuralWaveSurrogate (forward pass, load predictions, physical consistency)
- Layer 2: TelemetryAnomalyDetector (reconstruction error, nominal vs anomalous decoupling)
"""

import pytest
import numpy as np

from src.dynacard_classifier import DynacardFeatureClassifier, CLASS_NAMES
from src.wave_surrogate import NeuralWaveSurrogate, WavePrediction
from src.anomaly_detector import TelemetryAnomalyDetector, AnomalyReport
from src.rod_conservative import DEFAULT_WAVE_SOLVER


class TestDynacardFeatureClassifier:
    @pytest.fixture
    def classifier(self):
        return DynacardFeatureClassifier()

    def test_feature_extraction_dimension_and_keys(self, classifier):
        u = np.linspace(0.0, 3.0, 100)
        f = 15.0 + 5.0 * np.sin(2 * np.pi * u / 3.0)
        feat_vec, feat_dict = classifier.extract_features(u, f)

        assert isinstance(feat_vec, np.ndarray)
        assert feat_vec.shape == (16,)
        assert len(feat_dict) == 16
        assert "area_norm" in feat_dict
        assert "centroid_u_norm" in feat_dict
        assert "fourier_p1" in feat_dict
        assert "compression_integral_kN_m" in feat_dict

    def test_classify_normal_dynacard(self, classifier):
        card = DEFAULT_WAVE_SOLVER.simulate_card(spm=3.5, temp_c=85.0, water_cut=0.35)
        res = classifier.predict(card.surface_position_m, card.surface_load_kn)

        assert res.predicted_class == "NORMAL_OPERATION"
        assert res.confidence > 0.50
        assert "NORMAL_OPERATION" in res.probabilities
        assert isinstance(res.interpretable_reason, str)
        assert len(res.interpretable_reason) > 10

    def test_classify_rod_float_precursor(self, classifier):
        card = DEFAULT_WAVE_SOLVER.simulate_card(spm=4.7, temp_c=50.0, water_cut=0.45)
        pos = np.array(card.surface_position_m)
        load = np.array(card.surface_load_kn)
        # Apply downstroke compressive plunge
        du = np.gradient(pos)
        load[du < 0] -= 30.0

        res = classifier.predict(pos, load)
        assert res.predicted_class == "ROD_FLOAT_PRECURSOR"
        assert res.confidence > 0.50
        assert "Viscous fluid drag" in res.interpretable_reason

    def test_classify_parted_rod(self, classifier):
        pos = np.linspace(0.0, 3.2, 144)
        load = 22.0 + np.random.RandomState(42).normal(0.0, 0.2, 144)

        res = classifier.predict(pos, load)
        assert res.predicted_class == "PARTED_ROD"
        assert res.confidence > 0.80

    def test_reject_insufficient_samples(self, classifier):
        with pytest.raises(ValueError, match="requires at least 8 samples"):
            classifier.extract_features([0.0, 1.0, 2.0], [10.0, 20.0, 10.0])


class TestNeuralWaveSurrogate:
    @pytest.fixture
    def surrogate(self):
        return NeuralWaveSurrogate()

    def test_prediction_schema_and_types(self, surrogate):
        pred = surrogate.predict(spm=3.5, temp_c=80.0, water_cut=0.35, pump_fillage=0.95)

        assert isinstance(pred, WavePrediction)
        assert isinstance(pred.pprl_kn, float)
        assert isinstance(pred.mprl_kn, float)
        assert isinstance(pred.min_downhole_tension_kn, float)
        assert isinstance(pred.mean_downhole_tension_kn, float)
        assert isinstance(pred.downhole_stroke_m, float)
        assert pred.inference_time_ms < 5.0  # Must be sub-5ms

    def test_output_physical_plausibility(self, surrogate):
        pred = surrogate.predict(spm=3.5, temp_c=80.0)

        assert pred.pprl_kn > pred.mprl_kn
        assert pred.pprl_kn > 30.0  # Plausible polished rod load range
        assert pred.downhole_stroke_m > 0.5


class TestTelemetryAnomalyDetector:
    @pytest.fixture
    def detector(self):
        return TelemetryAnomalyDetector()

    def test_nominal_telemetry_status(self, detector):
        # [temp_c, visc_cp, spm, min_tension_kn, power_kw]
        nom_telemetry = [80.0, 1200.0, 3.8, 5.0, 18.5]
        rep = detector.score_sample(nom_telemetry)

        assert isinstance(rep, AnomalyReport)
        assert not rep.is_anomalous
        assert rep.status == "NOMINAL"
        assert rep.anomaly_score < detector.thresh_elevated
        assert rep.inference_time_ms < 5.0

    def test_anomalous_telemetry_status(self, detector):
        # Cold reservoir, viscous surge, high speed, compressive rod float, huge motor power
        anom_telemetry = [42.0, 11500.0, 5.2, -12.0, 38.0]
        rep = detector.score_sample(anom_telemetry)

        assert rep.is_anomalous
        assert rep.status in ("ELEVATED", "CRITICAL")
        assert rep.anomaly_score >= detector.thresh_elevated
        assert "viscosity_cp" in rep.channel_residuals or "min_tension_kn" in rep.channel_residuals

    def test_input_dimension_validation(self, detector):
        with pytest.raises(ValueError, match="Expected 5 channels"):
            detector.score_sample([80.0, 1200.0, 3.8])
