"""
Sentinelas XGBoost Classifier
Multi-class attack classification for web requests.
"""

import logging
import os
from typing import List, Optional, Tuple

import numpy as np
import xgboost as xgb

logger = logging.getLogger(__name__)


class XGBoostClassifier:
    """XGBoost-based attack classifier."""
    
    # Attack type labels
    ATTACK_LABELS = [
        "benign", "sqli", "xss", "lfi", "rfi", "rce",
        "ssrf", "xxe", "path_traversal", "bot", "scanner", "dos", "anomaly"
    ]
    
    def __init__(self):
        self.model: Optional[xgb.Booster] = None
        self._loaded = False
        self.feature_names = [
            "header_entropy", "header_count", "cookie_count", "cookie_entropy",
            "uri_length", "query_param_count", "path_depth", "path_entropy",
            "total_arg_length", "max_arg_length", "arg_entropy", "special_char_count",
            "has_sql_keywords", "has_script_tags", "has_path_traversal", "has_command_injection",
            "request_rate", "error_rate", "unique_endpoints"
        ]
    
    def is_loaded(self) -> bool:
        return self._loaded
    
    def load(self, path: str) -> None:
        """Load model from file."""
        try:
            self.model = xgb.Booster()
            self.model.load_model(path)
            self._loaded = True
            logger.info(f"XGBoost classifier loaded from {path}")
        except Exception as e:
            logger.error(f"Failed to load XGBoost model: {e}")
            self._initialize_default()
    
    def save(self, path: str) -> None:
        """Save model to file."""
        if self.model is None:
            raise ValueError("No model to save")
        self.model.save_model(path)
        logger.info(f"XGBoost model saved to {path}")
    
    def _initialize_default(self) -> None:
        """Initialize with a simple default model."""
        # Create a minimal model for fail-safe operation
        # In production, this would be properly trained
        params = {
            "objective": "multi:softprob",
            "num_class": len(self.ATTACK_LABELS),
            "max_depth": 3,
            "eta": 0.1,
            "eval_metric": "mlogloss",
        }
        
        # Train on synthetic data for initialization
        n_samples = 100
        X = np.random.randn(n_samples, len(self.feature_names)).astype(np.float32)
        y = np.zeros(n_samples, dtype=np.int32)  # All benign
        
        dtrain = xgb.DMatrix(X, label=y, feature_names=self.feature_names)
        self.model = xgb.train(params, dtrain, num_boost_round=10)
        self._loaded = True
        logger.warning("Using untrained XGBoost model (random initialization)")
    
    def predict(self, features: List[float]) -> Tuple[str, float]:
        """
        Predict attack type and confidence for input features.
        Returns (attack_label, confidence).
        """
        if self.model is None:
            self._initialize_default()
        
        try:
            x = np.array(features, dtype=np.float32).reshape(1, -1)
            dmatrix = xgb.DMatrix(x, feature_names=self.feature_names)
            
            # Get probabilities for all classes
            probs = self.model.predict(dmatrix)[0]
            
            # Get top prediction
            pred_idx = int(np.argmax(probs))
            confidence = float(probs[pred_idx])
            attack_label = self.ATTACK_LABELS[pred_idx]
            
            return attack_label, confidence
            
        except Exception as e:
            logger.error(f"Prediction error: {e}")
            return "benign", 0.0
    
    def predict_batch(self, features_batch: List[List[float]]) -> List[Tuple[str, float]]:
        """Batch prediction for multiple samples."""
        if self.model is None:
            self._initialize_default()
        
        try:
            x = np.array(features_batch, dtype=np.float32)
            dmatrix = xgb.DMatrix(x, feature_names=self.feature_names)
            
            probs = self.model.predict(dmatrix)
            
            results = []
            for prob in probs:
                pred_idx = int(np.argmax(prob))
                confidence = float(prob[pred_idx])
                attack_label = self.ATTACK_LABELS[pred_idx]
                results.append((attack_label, confidence))
            
            return results
            
        except Exception as e:
            logger.error(f"Batch prediction error: {e}")
            return [("benign", 0.0)] * len(features_batch)
    
    def predict_proba(self, features: List[float]) -> dict:
        """Get probability distribution over all attack types."""
        if self.model is None:
            self._initialize_default()
        
        try:
            x = np.array(features, dtype=np.float32).reshape(1, -1)
            dmatrix = xgb.DMatrix(x, feature_names=self.feature_names)
            
            probs = self.model.predict(dmatrix)[0]
            
            return {label: float(prob) for label, prob in zip(self.ATTACK_LABELS, probs)}
            
        except Exception as e:
            logger.error(f"Predict proba error: {e}")
            return {label: 0.0 for label in self.ATTACK_LABELS}
    
    def get_feature_importance(self) -> dict:
        """Get feature importance scores."""
        if self.model is None:
            return {}
        
        try:
            importance = self.model.get_score(importance_type="gain")
            return importance
        except Exception as e:
            logger.error(f"Feature importance error: {e}")
            return {}
