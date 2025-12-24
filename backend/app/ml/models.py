"""
ML Models for VARDAx Anomaly Detection.

Three-layer ensemble approach:
1. Isolation Forest - Point anomalies (single weird requests)
2. Autoencoder - Pattern anomalies (unusual feature combinations)
3. EWMA Baseline - Rate anomalies (traffic volume deviations)

WHY THIS COMBINATION:
- Isolation Forest: Fast, no labels needed, catches outliers
- Autoencoder: Learns complex normal patterns, catches subtle deviations
- EWMA: Simple, interpretable, catches rate-based attacks

All models are designed for:
- Fast inference (< 50ms combined)
- Explainable outputs
- Online learning capability
"""
import numpy as np
import joblib
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass
from datetime import datetime
import logging

from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger(__name__)


@dataclass
class ModelPrediction:
    """Prediction from a single model."""
    anomaly_score: float  # 0-1, higher = more anomalous
    is_anomaly: bool
    feature_contributions: Dict[str, float]  # Feature importance


@dataclass
class EnsemblePrediction:
    """Combined prediction from all models."""
    isolation_forest_score: float
    autoencoder_score: float
    ewma_score: float
    ensemble_score: float
    is_anomaly: bool
    confidence: float
    explanations: List[Dict[str, Any]]


class IsolationForestModel:
    """
    Isolation Forest for point anomaly detection.
    
    WHY ISOLATION FOREST:
    - Explicitly designed for anomaly detection
    - Works without labeled data
    - Fast training and inference
    - Handles high-dimensional data well
    - Provides anomaly scores, not just binary
    
    HOW IT WORKS:
    - Randomly partitions data using trees
    - Anomalies are isolated in fewer splits
    - Anomaly score = average path length
    """
    
    # Features used by this model (subset of all 47)
    FEATURE_NAMES = [
        'uri_length', 'uri_depth', 'uri_entropy', 'query_param_count',
        'query_length', 'query_entropy', 'body_length', 'body_entropy',
        'body_printable_ratio', 'extension_risk_score', 'header_count',
        'session_request_count', 'session_unique_uris', 'session_error_rate',
        'requests_per_minute', 'requests_per_minute_zscore',
        'user_agent_anomaly_score', 'bot_likelihood_score'
    ]
    
    def __init__(
        self,
        contamination: float = 0.01,  # Expected anomaly rate
        n_estimators: int = 100,
        random_state: int = 42
    ):
        self.model = IsolationForest(
            contamination=contamination,
            n_estimators=n_estimators,
            random_state=random_state,
            n_jobs=-1  # Use all cores
        )
        self.scaler = StandardScaler()
        self.is_fitted = False
        self.feature_means: Optional[np.ndarray] = None
    
    def fit(self, X: np.ndarray) -> 'IsolationForestModel':
        """
        Train on normal traffic data.
        
        Args:
            X: Feature matrix (n_samples, n_features)
        """
        logger.info(f"Training Isolation Forest on {X.shape[0]} samples")
        
        # Scale features
        X_scaled = self.scaler.fit_transform(X)
        self.feature_means = X.mean(axis=0)
        
        # Fit model
        self.model.fit(X_scaled)
        self.is_fitted = True
        
        logger.info("Isolation Forest training complete")
        return self
    
    def predict(self, X: np.ndarray) -> ModelPrediction:
        """
        Predict anomaly score for a single sample.
        
        Args:
            X: Feature vector (1, n_features)
            
        Returns:
            ModelPrediction with score and explanations
        """
        if not self.is_fitted:
            raise RuntimeError("Model not fitted. Call fit() first.")
        
        X_scaled = self.scaler.transform(X.reshape(1, -1))
        
        # Get anomaly score (-1 to 1, we convert to 0-1)
        raw_score = self.model.decision_function(X_scaled)[0]
        # Convert: more negative = more anomalous
        anomaly_score = 1 - (raw_score + 0.5)  # Normalize to 0-1
        anomaly_score = np.clip(anomaly_score, 0, 1)
        
        # Binary prediction
        is_anomaly = self.model.predict(X_scaled)[0] == -1
        
        # Feature contributions (deviation from mean)
        contributions = {}
        if self.feature_means is not None:
            deviations = np.abs(X - self.feature_means)
            for i, name in enumerate(self.FEATURE_NAMES):
                if i < len(deviations):
                    contributions[name] = float(deviations[i])
        
        return ModelPrediction(
            anomaly_score=float(anomaly_score),
            is_anomaly=is_anomaly,
            feature_contributions=contributions
        )
    
    def save(self, path: Path):
        """Save model to disk."""
        joblib.dump({
            'model': self.model,
            'scaler': self.scaler,
            'feature_means': self.feature_means,
            'is_fitted': self.is_fitted
        }, path)
    
    def load(self, path: Path):
        """Load model from disk."""
        data = joblib.load(path)
        self.model = data['model']
        self.scaler = data['scaler']
        self.feature_means = data['feature_means']
        self.is_fitted = data['is_fitted']


class AutoencoderModel:
    """
    Autoencoder for pattern anomaly detection.
    
    WHY AUTOENCODER:
    - Learns compressed representation of normal traffic
    - Reconstruction error = anomaly score
    - Catches complex, multi-feature anomalies
    - Can identify WHICH features are anomalous
    
    HOW IT WORKS:
    - Encoder compresses features to latent space
    - Decoder reconstructs original features
    - High reconstruction error = anomaly
    
    Using simple NumPy implementation for hackathon simplicity.
    Production would use PyTorch.
    """
    
    FEATURE_NAMES = [
        'uri_length', 'uri_entropy', 'query_entropy', 'body_length',
        'body_entropy', 'session_request_count', 'session_unique_uris',
        'session_error_rate', 'requests_per_minute', 'bot_likelihood_score'
    ]
    
    def __init__(
        self,
        input_dim: int = 10,
        encoding_dim: int = 5,
        threshold_percentile: float = 95
    ):
        self.input_dim = input_dim
        self.encoding_dim = encoding_dim
        self.threshold_percentile = threshold_percentile
        
        # Simple linear autoencoder weights
        self.encoder_weights: Optional[np.ndarray] = None
        self.decoder_weights: Optional[np.ndarray] = None
        self.encoder_bias: Optional[np.ndarray] = None
        self.decoder_bias: Optional[np.ndarray] = None
        
        self.scaler = StandardScaler()
        self.threshold: float = 0.5
        self.is_fitted = False
    
    def fit(self, X: np.ndarray, epochs: int = 100, lr: float = 0.01) -> 'AutoencoderModel':
        """
        Train autoencoder on normal traffic.
        
        Simple gradient descent training for hackathon.
        Production would use PyTorch with Adam optimizer.
        """
        logger.info(f"Training Autoencoder on {X.shape[0]} samples")
        
        # Scale features
        X_scaled = self.scaler.fit_transform(X)
        
        # Initialize weights (Xavier initialization)
        np.random.seed(42)
        self.encoder_weights = np.random.randn(self.input_dim, self.encoding_dim) * 0.1
        self.decoder_weights = np.random.randn(self.encoding_dim, self.input_dim) * 0.1
        self.encoder_bias = np.zeros(self.encoding_dim)
        self.decoder_bias = np.zeros(self.input_dim)
        
        # Training loop
        for epoch in range(epochs):
            # Forward pass
            encoded = self._relu(X_scaled @ self.encoder_weights + self.encoder_bias)
            decoded = encoded @ self.decoder_weights + self.decoder_bias
            
            # Compute loss (MSE)
            loss = np.mean((X_scaled - decoded) ** 2)
            
            # Backward pass (simplified gradient descent)
            error = decoded - X_scaled
            
            # Update decoder
            self.decoder_weights -= lr * (encoded.T @ error) / X_scaled.shape[0]
            self.decoder_bias -= lr * np.mean(error, axis=0)
            
            # Update encoder
            encoder_error = error @ self.decoder_weights.T * (encoded > 0)
            self.encoder_weights -= lr * (X_scaled.T @ encoder_error) / X_scaled.shape[0]
            self.encoder_bias -= lr * np.mean(encoder_error, axis=0)
            
            if epoch % 20 == 0:
                logger.debug(f"Epoch {epoch}, Loss: {loss:.4f}")
        
        # Set threshold based on training reconstruction errors
        reconstruction_errors = self._compute_reconstruction_error(X_scaled)
        self.threshold = np.percentile(reconstruction_errors, self.threshold_percentile)
        
        self.is_fitted = True
        logger.info(f"Autoencoder training complete. Threshold: {self.threshold:.4f}")
        return self
    
    def predict(self, X: np.ndarray) -> ModelPrediction:
        """Predict anomaly score based on reconstruction error."""
        if not self.is_fitted:
            raise RuntimeError("Model not fitted. Call fit() first.")
        
        X_scaled = self.scaler.transform(X.reshape(1, -1))
        
        # Compute reconstruction error
        error = self._compute_reconstruction_error(X_scaled)[0]
        
        # Normalize to 0-1 score
        anomaly_score = min(error / (self.threshold * 2), 1.0)
        
        # Per-feature reconstruction error for explanations
        encoded = self._relu(X_scaled @ self.encoder_weights + self.encoder_bias)
        decoded = encoded @ self.decoder_weights + self.decoder_bias
        feature_errors = np.abs(X_scaled - decoded)[0]
        
        contributions = {}
        for i, name in enumerate(self.FEATURE_NAMES):
            if i < len(feature_errors):
                contributions[name] = float(feature_errors[i])
        
        return ModelPrediction(
            anomaly_score=float(anomaly_score),
            is_anomaly=error > self.threshold,
            feature_contributions=contributions
        )
    
    def _relu(self, x: np.ndarray) -> np.ndarray:
        """ReLU activation."""
        return np.maximum(0, x)
    
    def _compute_reconstruction_error(self, X: np.ndarray) -> np.ndarray:
        """Compute MSE reconstruction error."""
        encoded = self._relu(X @ self.encoder_weights + self.encoder_bias)
        decoded = encoded @ self.decoder_weights + self.decoder_bias
        return np.mean((X - decoded) ** 2, axis=1)
    
    def save(self, path: Path):
        """Save model to disk."""
        joblib.dump({
            'encoder_weights': self.encoder_weights,
            'decoder_weights': self.decoder_weights,
            'encoder_bias': self.encoder_bias,
            'decoder_bias': self.decoder_bias,
            'scaler': self.scaler,
            'threshold': self.threshold,
            'is_fitted': self.is_fitted
        }, path)
    
    def load(self, path: Path):
        """Load model from disk."""
        data = joblib.load(path)
        self.encoder_weights = data['encoder_weights']
        self.decoder_weights = data['decoder_weights']
        self.encoder_bias = data['encoder_bias']
        self.decoder_bias = data['decoder_bias']
        self.scaler = data['scaler']
        self.threshold = data['threshold']
        self.is_fitted = data['is_fitted']


class EWMABaseline:
    """
    Exponentially Weighted Moving Average for rate anomaly detection.
    
    WHY EWMA:
    - Simple and interpretable
    - Adapts to changing traffic patterns
    - Very fast computation
    - Clear explanations ("rate is X% above baseline")
    
    HOW IT WORKS:
    - Maintains running average of key metrics
    - New value weighted against historical average
    - Deviation from average = anomaly score
    """
    
    METRICS = [
        'requests_per_minute',
        'bytes_per_minute', 
        'error_rate_per_minute',
        'unique_ips_per_minute',
        'auth_failure_rate'
    ]
    
    def __init__(self, alpha: float = 0.1, threshold_std: float = 3.0):
        """
        Args:
            alpha: Smoothing factor (0-1). Lower = slower adaptation.
            threshold_std: Number of standard deviations for anomaly.
        """
        self.alpha = alpha
        self.threshold_std = threshold_std
        
        # Running statistics per metric
        self.means: Dict[str, float] = {m: 0.0 for m in self.METRICS}
        self.variances: Dict[str, float] = {m: 1.0 for m in self.METRICS}
        self.sample_count = 0
    
    def update(self, metrics: Dict[str, float]):
        """
        Update baseline with new observation.
        
        Args:
            metrics: Dictionary of metric name -> value
        """
        self.sample_count += 1
        
        for name in self.METRICS:
            if name not in metrics:
                continue
            
            value = metrics[name]
            old_mean = self.means[name]
            
            # Update mean
            self.means[name] = self.alpha * value + (1 - self.alpha) * old_mean
            
            # Update variance
            diff = value - old_mean
            self.variances[name] = (
                self.alpha * (diff ** 2) + 
                (1 - self.alpha) * self.variances[name]
            )
    
    def predict(self, metrics: Dict[str, float]) -> ModelPrediction:
        """
        Compute anomaly score based on deviation from baseline.
        """
        if self.sample_count < 10:
            # Not enough data for reliable baseline
            return ModelPrediction(
                anomaly_score=0.0,
                is_anomaly=False,
                feature_contributions={}
            )
        
        max_zscore = 0.0
        contributions = {}
        
        for name in self.METRICS:
            if name not in metrics:
                continue
            
            value = metrics[name]
            mean = self.means[name]
            std = np.sqrt(self.variances[name]) + 1e-6
            
            zscore = abs(value - mean) / std
            contributions[name] = float(zscore)
            max_zscore = max(max_zscore, zscore)
        
        # Normalize to 0-1
        anomaly_score = min(max_zscore / (self.threshold_std * 2), 1.0)
        
        return ModelPrediction(
            anomaly_score=float(anomaly_score),
            is_anomaly=max_zscore > self.threshold_std,
            feature_contributions=contributions
        )
    
    def get_baseline_stats(self) -> Dict[str, Dict[str, float]]:
        """Get current baseline statistics."""
        return {
            name: {
                'mean': self.means[name],
                'std': np.sqrt(self.variances[name])
            }
            for name in self.METRICS
        }
    
    def save(self, path: Path):
        """Save baseline to disk."""
        joblib.dump({
            'means': self.means,
            'variances': self.variances,
            'sample_count': self.sample_count,
            'alpha': self.alpha,
            'threshold_std': self.threshold_std
        }, path)
    
    def load(self, path: Path):
        """Load baseline from disk."""
        data = joblib.load(path)
        self.means = data['means']
        self.variances = data['variances']
        self.sample_count = data['sample_count']
        self.alpha = data['alpha']
        self.threshold_std = data['threshold_std']


class AnomalyDetector:
    """
    Ensemble anomaly detector combining all three models.
    
    ENSEMBLE STRATEGY:
    - Weighted average of model scores
    - Higher weight to models with lower false positive rates
    - Confidence based on model agreement
    
    EXPLAINABILITY:
    - Top contributing features from each model
    - Human-readable descriptions
    - Actionable recommendations
    """
    
    def __init__(
        self,
        model_path: Path = Path("./models"),
        weights: Tuple[float, float, float] = (0.4, 0.35, 0.25)
    ):
        """
        Args:
            model_path: Directory for model files
            weights: (isolation_forest, autoencoder, ewma) weights
        """
        self.model_path = model_path
        self.weights = weights
        
        self.isolation_forest = IsolationForestModel()
        self.autoencoder = AutoencoderModel()
        self.ewma = EWMABaseline()
        
        self.is_loaded = False
    
    def load_models(self):
        """Load all models from disk."""
        try:
            self.isolation_forest.load(self.model_path / "isolation_forest.joblib")
            self.autoencoder.load(self.model_path / "autoencoder.joblib")
            self.ewma.load(self.model_path / "ewma_baseline.joblib")
            self.is_loaded = True
            logger.info("All models loaded successfully")
        except FileNotFoundError as e:
            logger.warning(f"Model files not found: {e}. Using untrained models.")
    
    def save_models(self):
        """Save all models to disk."""
        self.model_path.mkdir(parents=True, exist_ok=True)
        self.isolation_forest.save(self.model_path / "isolation_forest.joblib")
        self.autoencoder.save(self.model_path / "autoencoder.joblib")
        self.ewma.save(self.model_path / "ewma_baseline.joblib")
        logger.info("All models saved")
    
    def predict(self, features: Dict[str, float]) -> EnsemblePrediction:
        """
        Run ensemble prediction on extracted features.
        
        Args:
            features: Dictionary of feature name -> value
            
        Returns:
            EnsemblePrediction with scores and explanations
        """
        # Prepare feature vectors for each model
        if_features = np.array([
            features.get(name, 0.0) 
            for name in IsolationForestModel.FEATURE_NAMES
        ])
        
        ae_features = np.array([
            features.get(name, 0.0)
            for name in AutoencoderModel.FEATURE_NAMES
        ])
        
        ewma_metrics = {
            name: features.get(name, 0.0)
            for name in EWMABaseline.METRICS
        }
        
        # Get predictions from each model
        if_pred = self.isolation_forest.predict(if_features)
        ae_pred = self.autoencoder.predict(ae_features)
        ewma_pred = self.ewma.predict(ewma_metrics)
        
        # Weighted ensemble score
        ensemble_score = (
            self.weights[0] * if_pred.anomaly_score +
            self.weights[1] * ae_pred.anomaly_score +
            self.weights[2] * ewma_pred.anomaly_score
        )
        
        # Confidence based on model agreement
        scores = [if_pred.anomaly_score, ae_pred.anomaly_score, ewma_pred.anomaly_score]
        score_std = np.std(scores)
        confidence = 1 - min(score_std * 2, 0.5)  # Higher agreement = higher confidence
        
        # Generate explanations
        explanations = self._generate_explanations(
            features, if_pred, ae_pred, ewma_pred
        )
        
        return EnsemblePrediction(
            isolation_forest_score=if_pred.anomaly_score,
            autoencoder_score=ae_pred.anomaly_score,
            ewma_score=ewma_pred.anomaly_score,
            ensemble_score=ensemble_score,
            is_anomaly=ensemble_score > 0.5,
            confidence=confidence,
            explanations=explanations
        )
    
    def _generate_explanations(
        self,
        features: Dict[str, float],
        if_pred: ModelPrediction,
        ae_pred: ModelPrediction,
        ewma_pred: ModelPrediction
    ) -> List[Dict[str, Any]]:
        """Generate human-readable explanations."""
        explanations = []
        
        # Combine all feature contributions
        all_contributions = {}
        for contrib in [if_pred.feature_contributions, 
                       ae_pred.feature_contributions,
                       ewma_pred.feature_contributions]:
            for name, value in contrib.items():
                if name not in all_contributions:
                    all_contributions[name] = []
                all_contributions[name].append(value)
        
        # Average contributions and sort
        avg_contributions = {
            name: np.mean(values)
            for name, values in all_contributions.items()
        }
        
        sorted_features = sorted(
            avg_contributions.items(),
            key=lambda x: x[1],
            reverse=True
        )[:5]  # Top 5
        
        # Generate explanations for top features
        for feature_name, contribution in sorted_features:
            if contribution < 0.1:
                continue
                
            explanation = self._explain_feature(
                feature_name, 
                features.get(feature_name, 0),
                contribution
            )
            if explanation:
                explanations.append(explanation)
        
        return explanations
    
    def _explain_feature(
        self, 
        name: str, 
        value: float, 
        contribution: float
    ) -> Optional[Dict[str, Any]]:
        """Generate human-readable explanation for a feature."""
        
        templates = {
            'requests_per_minute': "Request rate {value:.0f}/min is {pct:.0f}% above normal",
            'requests_per_minute_zscore': "Request rate is {value:.1f} standard deviations from baseline",
            'uri_entropy': "URI has unusual character distribution (entropy: {value:.2f})",
            'body_entropy': "Request body has suspicious encoding (entropy: {value:.2f})",
            'session_request_count': "Session has made {value:.0f} requests (unusual volume)",
            'session_unique_uris': "Session accessed {value:.0f} unique endpoints (scanning pattern)",
            'bot_likelihood_score': "Bot-like behavior detected (score: {value:.2f})",
            'user_agent_anomaly_score': "Suspicious user agent detected",
            'error_rate_per_minute': "High error rate: {value:.1%}",
            'auth_failure_rate': "Authentication failure spike: {value:.1%}",
            'extension_risk_score': "Risky file extension accessed",
            'query_entropy': "Query string has unusual encoding",
        }
        
        if name not in templates:
            return None
        
        # Get baseline for percentage calculation
        baseline = self.ewma.means.get(name, value)
        pct_above = ((value - baseline) / max(baseline, 1)) * 100 if baseline else 0
        
        return {
            'feature_name': name,
            'feature_value': value,
            'baseline_value': baseline,
            'deviation_percent': pct_above,
            'contribution': contribution,
            'description': templates[name].format(value=value, pct=pct_above)
        }
    
    def update_baseline(self, features: Dict[str, float]):
        """Update EWMA baseline with new normal observation."""
        ewma_metrics = {
            name: features.get(name, 0.0)
            for name in EWMABaseline.METRICS
        }
        self.ewma.update(ewma_metrics)
