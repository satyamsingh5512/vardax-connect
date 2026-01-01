"""
Comprehensive tests for VARDAx ML Models.
Tests Isolation Forest, Autoencoder, EWMA Baseline, and Ensemble Detector.
"""
import pytest
import numpy as np
from pathlib import Path
import tempfile
import sys
import os

# Add parent to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.ml.models import (
    IsolationForestModel,
    AutoencoderModel,
    EWMABaseline,
    AnomalyDetector,
    ModelPrediction,
    EnsemblePrediction
)


class TestIsolationForestModel:
    """Tests for Isolation Forest anomaly detection."""
    
    def test_initialization(self):
        """Test model initializes with correct parameters."""
        model = IsolationForestModel(contamination=0.05, n_estimators=50)
        assert model.is_fitted == False
        assert model.feature_means is None
    
    def test_fit_with_normal_data(self):
        """Test training on normal traffic data."""
        model = IsolationForestModel()
        # Generate normal traffic features (18 features)
        np.random.seed(42)
        X_normal = np.random.randn(500, 18) * 0.5 + 5  # Normal distribution
        
        model.fit(X_normal)
        
        assert model.is_fitted == True
        assert model.feature_means is not None
        assert len(model.feature_means) == 18
    
    def test_predict_normal_sample(self):
        """Test prediction on normal sample returns low score."""
        model = IsolationForestModel()
        np.random.seed(42)
        X_normal = np.random.randn(500, 18) * 0.5 + 5
        model.fit(X_normal)
        
        # Test with a normal sample
        normal_sample = np.array([5.0] * 18)
        prediction = model.predict(normal_sample)
        
        assert isinstance(prediction, ModelPrediction)
        assert 0 <= prediction.anomaly_score <= 1
        assert prediction.anomaly_score < 0.5  # Should be low for normal
    
    def test_predict_anomalous_sample(self):
        """Test prediction on anomalous sample returns high score."""
        model = IsolationForestModel()
        np.random.seed(42)
        X_normal = np.random.randn(500, 18) * 0.5 + 5
        model.fit(X_normal)
        
        # Test with an anomalous sample (far from normal)
        anomaly_sample = np.array([100.0] * 18)
        prediction = model.predict(anomaly_sample)
        
        assert prediction.anomaly_score > 0.3  # Should be higher for anomaly
    
    def test_predict_without_fit_raises_error(self):
        """Test prediction without training raises error."""
        model = IsolationForestModel()
        sample = np.array([5.0] * 18)
        
        with pytest.raises(RuntimeError, match="Model not fitted"):
            model.predict(sample)
    
    def test_feature_contributions(self):
        """Test feature contributions are computed."""
        model = IsolationForestModel()
        np.random.seed(42)
        X_normal = np.random.randn(500, 18) * 0.5 + 5
        model.fit(X_normal)
        
        sample = np.array([5.0] * 18)
        prediction = model.predict(sample)
        
        assert len(prediction.feature_contributions) > 0
    
    def test_save_and_load(self):
        """Test model persistence."""
        model = IsolationForestModel()
        np.random.seed(42)
        X_normal = np.random.randn(100, 18) * 0.5 + 5
        model.fit(X_normal)
        
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "if_model.joblib"
            model.save(path)
            
            # Load into new model
            new_model = IsolationForestModel()
            new_model.load(path)
            
            assert new_model.is_fitted == True
            
            # Predictions should match
            sample = np.array([5.0] * 18)
            pred1 = model.predict(sample)
            pred2 = new_model.predict(sample)
            assert abs(pred1.anomaly_score - pred2.anomaly_score) < 0.01


class TestAutoencoderModel:
    """Tests for Autoencoder anomaly detection."""
    
    def test_initialization(self):
        """Test model initializes correctly."""
        model = AutoencoderModel(input_dim=10, encoding_dim=5)
        assert model.is_fitted == False
        assert model.input_dim == 10
        assert model.encoding_dim == 5
    
    def test_fit_with_normal_data(self):
        """Test training autoencoder."""
        model = AutoencoderModel(input_dim=10, encoding_dim=5)
        np.random.seed(42)
        X_normal = np.random.randn(200, 10) * 0.5 + 5
        
        model.fit(X_normal, epochs=50)
        
        assert model.is_fitted == True
        assert model.encoder_weights is not None
        assert model.decoder_weights is not None
        assert model.threshold > 0
    
    def test_predict_normal_sample(self):
        """Test prediction on normal sample."""
        model = AutoencoderModel(input_dim=10, encoding_dim=5)
        np.random.seed(42)
        X_normal = np.random.randn(200, 10) * 0.5 + 5
        model.fit(X_normal, epochs=50)
        
        normal_sample = np.array([5.0] * 10)
        prediction = model.predict(normal_sample)
        
        assert isinstance(prediction, ModelPrediction)
        assert 0 <= prediction.anomaly_score <= 1
    
    def test_predict_anomalous_sample(self):
        """Test prediction on anomalous sample."""
        model = AutoencoderModel(input_dim=10, encoding_dim=5)
        np.random.seed(42)
        X_normal = np.random.randn(200, 10) * 0.5 + 5
        model.fit(X_normal, epochs=50)
        
        anomaly_sample = np.array([50.0] * 10)
        prediction = model.predict(anomaly_sample)
        
        # Anomaly should have higher reconstruction error
        assert prediction.anomaly_score > 0.2
    
    def test_relu_activation(self):
        """Test ReLU activation function."""
        model = AutoencoderModel()
        x = np.array([-2, -1, 0, 1, 2])
        result = model._relu(x)
        expected = np.array([0, 0, 0, 1, 2])
        np.testing.assert_array_equal(result, expected)
    
    def test_save_and_load(self):
        """Test model persistence."""
        model = AutoencoderModel(input_dim=10, encoding_dim=5)
        np.random.seed(42)
        X_normal = np.random.randn(100, 10) * 0.5 + 5
        model.fit(X_normal, epochs=30)
        
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "ae_model.joblib"
            model.save(path)
            
            new_model = AutoencoderModel(input_dim=10, encoding_dim=5)
            new_model.load(path)
            
            assert new_model.is_fitted == True
            assert new_model.threshold == model.threshold


class TestEWMABaseline:
    """Tests for EWMA baseline anomaly detection."""
    
    def test_initialization(self):
        """Test EWMA initializes correctly."""
        ewma = EWMABaseline(alpha=0.1, threshold_std=3.0)
        assert ewma.alpha == 0.1
        assert ewma.threshold_std == 3.0
        assert ewma.sample_count == 0
    
    def test_update_baseline(self):
        """Test baseline updates with new observations."""
        ewma = EWMABaseline(alpha=0.5)
        
        # Update with some metrics
        ewma.update({'requests_per_minute': 100.0})
        ewma.update({'requests_per_minute': 100.0})
        ewma.update({'requests_per_minute': 100.0})
        
        assert ewma.sample_count == 3
        assert ewma.means['requests_per_minute'] > 0
    
    def test_predict_normal_metrics(self):
        """Test prediction with normal metrics."""
        ewma = EWMABaseline(alpha=0.1)
        
        # Build baseline
        for _ in range(20):
            ewma.update({'requests_per_minute': 100.0, 'error_rate_per_minute': 0.01})
        
        # Test with normal metrics
        prediction = ewma.predict({'requests_per_minute': 100.0, 'error_rate_per_minute': 0.01})
        
        assert isinstance(prediction, ModelPrediction)
        assert prediction.anomaly_score < 0.3
        assert prediction.is_anomaly == False
    
    def test_predict_anomalous_metrics(self):
        """Test prediction with anomalous metrics."""
        ewma = EWMABaseline(alpha=0.1, threshold_std=2.0)
        
        # Build baseline with low values
        for _ in range(20):
            ewma.update({'requests_per_minute': 100.0})
        
        # Test with spike
        prediction = ewma.predict({'requests_per_minute': 1000.0})
        
        assert prediction.anomaly_score > 0.3
        assert prediction.is_anomaly == True
    
    def test_insufficient_samples(self):
        """Test prediction with insufficient baseline samples."""
        ewma = EWMABaseline()
        
        # Only 5 samples (less than 10 required)
        for _ in range(5):
            ewma.update({'requests_per_minute': 100.0})
        
        prediction = ewma.predict({'requests_per_minute': 1000.0})
        
        # Should return safe defaults
        assert prediction.anomaly_score == 0.0
        assert prediction.is_anomaly == False
    
    def test_get_baseline_stats(self):
        """Test getting baseline statistics."""
        ewma = EWMABaseline()
        
        for _ in range(10):
            ewma.update({'requests_per_minute': 100.0})
        
        stats = ewma.get_baseline_stats()
        
        assert 'requests_per_minute' in stats
        assert 'mean' in stats['requests_per_minute']
        assert 'std' in stats['requests_per_minute']
    
    def test_save_and_load(self):
        """Test EWMA persistence."""
        ewma = EWMABaseline()
        
        for _ in range(15):
            ewma.update({'requests_per_minute': 100.0})
        
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "ewma.joblib"
            ewma.save(path)
            
            new_ewma = EWMABaseline()
            new_ewma.load(path)
            
            assert new_ewma.sample_count == ewma.sample_count
            assert new_ewma.means == ewma.means


class TestAnomalyDetector:
    """Tests for ensemble anomaly detector."""
    
    @pytest.fixture
    def trained_detector(self):
        """Create a trained detector for tests."""
        detector = AnomalyDetector()
        np.random.seed(42)
        
        # Train isolation forest
        if_features = np.random.randn(200, 18) * 0.5 + 5
        detector.isolation_forest.fit(if_features)
        
        # Train autoencoder
        ae_features = np.random.randn(200, 10) * 0.5 + 5
        detector.autoencoder.fit(ae_features, epochs=30)
        
        # Build EWMA baseline
        for _ in range(20):
            detector.ewma.update({
                'requests_per_minute': 100.0,
                'bytes_per_minute': 50000.0,
                'error_rate_per_minute': 0.01,
                'unique_ips_per_minute': 50.0,
                'auth_failure_rate': 0.001
            })
        
        return detector
    
    def test_initialization(self):
        """Test detector initializes correctly."""
        detector = AnomalyDetector()
        assert detector.weights == (0.4, 0.35, 0.25)
        assert detector.is_loaded == False
    
    def test_predict_normal_features(self, trained_detector):
        """Test prediction with normal features."""
        features = {
            'uri_length': 50, 'uri_depth': 3, 'uri_entropy': 3.5,
            'query_param_count': 2, 'query_length': 20, 'query_entropy': 3.0,
            'body_length': 100, 'body_entropy': 4.0, 'body_printable_ratio': 0.99,
            'extension_risk_score': 0.0, 'header_count': 8,
            'session_request_count': 10, 'session_unique_uris': 5,
            'session_error_rate': 0.0, 'requests_per_minute': 100.0,
            'requests_per_minute_zscore': 0.0, 'user_agent_anomaly_score': 0.0,
            'bot_likelihood_score': 0.1, 'bytes_per_minute': 50000.0,
            'error_rate_per_minute': 0.01, 'unique_ips_per_minute': 50.0,
            'auth_failure_rate': 0.001
        }
        
        prediction = trained_detector.predict(features)
        
        assert isinstance(prediction, EnsemblePrediction)
        assert 0 <= prediction.ensemble_score <= 1
        assert 0 <= prediction.confidence <= 1
    
    def test_predict_anomalous_features(self, trained_detector):
        """Test prediction with anomalous features."""
        features = {
            'uri_length': 500, 'uri_depth': 20, 'uri_entropy': 7.0,
            'query_param_count': 50, 'query_length': 1000, 'query_entropy': 7.5,
            'body_length': 100000, 'body_entropy': 7.8, 'body_printable_ratio': 0.3,
            'extension_risk_score': 0.9, 'header_count': 50,
            'session_request_count': 1000, 'session_unique_uris': 500,
            'session_error_rate': 0.5, 'requests_per_minute': 5000.0,
            'requests_per_minute_zscore': 10.0, 'user_agent_anomaly_score': 0.9,
            'bot_likelihood_score': 0.95, 'bytes_per_minute': 5000000.0,
            'error_rate_per_minute': 0.5, 'unique_ips_per_minute': 1.0,
            'auth_failure_rate': 0.8
        }
        
        prediction = trained_detector.predict(features)
        
        # Anomalous features should produce higher score
        assert prediction.ensemble_score > 0.3
    
    def test_explanations_generated(self, trained_detector):
        """Test that explanations are generated."""
        features = {
            'uri_length': 500, 'uri_depth': 20, 'uri_entropy': 7.0,
            'query_param_count': 50, 'query_length': 1000, 'query_entropy': 7.5,
            'body_length': 100000, 'body_entropy': 7.8, 'body_printable_ratio': 0.3,
            'extension_risk_score': 0.9, 'header_count': 50,
            'session_request_count': 1000, 'session_unique_uris': 500,
            'session_error_rate': 0.5, 'requests_per_minute': 5000.0,
            'requests_per_minute_zscore': 10.0, 'user_agent_anomaly_score': 0.9,
            'bot_likelihood_score': 0.95, 'bytes_per_minute': 5000000.0,
            'error_rate_per_minute': 0.5, 'unique_ips_per_minute': 1.0,
            'auth_failure_rate': 0.8
        }
        
        prediction = trained_detector.predict(features)
        
        assert isinstance(prediction.explanations, list)
    
    def test_update_baseline(self, trained_detector):
        """Test baseline update."""
        features = {
            'requests_per_minute': 100.0,
            'bytes_per_minute': 50000.0,
            'error_rate_per_minute': 0.01,
            'unique_ips_per_minute': 50.0,
            'auth_failure_rate': 0.001
        }
        
        initial_count = trained_detector.ewma.sample_count
        trained_detector.update_baseline(features)
        
        assert trained_detector.ewma.sample_count == initial_count + 1
    
    def test_save_and_load_models(self, trained_detector):
        """Test saving and loading all models."""
        with tempfile.TemporaryDirectory() as tmpdir:
            trained_detector.model_path = Path(tmpdir)
            trained_detector.save_models()
            
            # Create new detector and load
            new_detector = AnomalyDetector(model_path=Path(tmpdir))
            new_detector.load_models()
            
            assert new_detector.is_loaded == True
            assert new_detector.isolation_forest.is_fitted == True
            assert new_detector.autoencoder.is_fitted == True


class TestModelIntegration:
    """Integration tests for ML pipeline."""
    
    def test_full_pipeline(self):
        """Test complete ML pipeline from features to prediction."""
        # Initialize detector
        detector = AnomalyDetector()
        np.random.seed(42)
        
        # Train models
        if_features = np.random.randn(100, 18) * 0.5 + 5
        detector.isolation_forest.fit(if_features)
        
        ae_features = np.random.randn(100, 10) * 0.5 + 5
        detector.autoencoder.fit(ae_features, epochs=20)
        
        for _ in range(15):
            detector.ewma.update({
                'requests_per_minute': 100.0,
                'bytes_per_minute': 50000.0,
                'error_rate_per_minute': 0.01,
                'unique_ips_per_minute': 50.0,
                'auth_failure_rate': 0.001
            })
        
        # Test normal request
        normal_features = {
            'uri_length': 50, 'uri_depth': 3, 'uri_entropy': 3.5,
            'query_param_count': 2, 'query_length': 20, 'query_entropy': 3.0,
            'body_length': 100, 'body_entropy': 4.0, 'body_printable_ratio': 0.99,
            'extension_risk_score': 0.0, 'header_count': 8,
            'session_request_count': 10, 'session_unique_uris': 5,
            'session_error_rate': 0.0, 'requests_per_minute': 100.0,
            'requests_per_minute_zscore': 0.0, 'user_agent_anomaly_score': 0.0,
            'bot_likelihood_score': 0.1, 'bytes_per_minute': 50000.0,
            'error_rate_per_minute': 0.01, 'unique_ips_per_minute': 50.0,
            'auth_failure_rate': 0.001
        }
        
        prediction = detector.predict(normal_features)
        
        assert prediction.ensemble_score >= 0
        assert prediction.ensemble_score <= 1
        assert prediction.confidence >= 0
        assert prediction.confidence <= 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
