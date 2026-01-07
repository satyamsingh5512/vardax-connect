"""
Sentinelas SHAP Explainer
Provides feature attribution for model predictions using SHAP.
"""

import logging
from typing import Dict, List, Optional

import numpy as np
import shap

logger = logging.getLogger(__name__)


class SHAPExplainer:
    """SHAP-based explainer for WAF model predictions."""
    
    FEATURE_NAMES = [
        "header_entropy", "header_count", "cookie_count", "cookie_entropy",
        "uri_length", "query_param_count", "path_depth", "path_entropy",
        "total_arg_length", "max_arg_length", "arg_entropy", "special_char_count",
        "has_sql_keywords", "has_script_tags", "has_path_traversal", "has_command_injection",
        "request_rate", "error_rate", "unique_endpoints"
    ]
    
    # Human-readable feature descriptions
    FEATURE_DESCRIPTIONS = {
        "header_entropy": "Header randomness/complexity",
        "header_count": "Number of HTTP headers",
        "cookie_count": "Number of cookies",
        "cookie_entropy": "Cookie randomness",
        "uri_length": "URL length",
        "query_param_count": "Query parameters",
        "path_depth": "URL path depth",
        "path_entropy": "Path randomness",
        "total_arg_length": "Total argument size",
        "max_arg_length": "Largest argument size",
        "arg_entropy": "Argument randomness",
        "special_char_count": "Special characters",
        "has_sql_keywords": "SQL patterns detected",
        "has_script_tags": "Script/XSS patterns",
        "has_path_traversal": "Path traversal patterns",
        "has_command_injection": "Command injection patterns",
        "request_rate": "Request frequency",
        "error_rate": "Error response rate",
        "unique_endpoints": "Endpoint diversity",
    }
    
    def __init__(self, classifier=None, background_samples: int = 100):
        """
        Initialize SHAP explainer.
        
        Args:
            classifier: XGBoost classifier instance
            background_samples: Number of background samples for SHAP
        """
        self.classifier = classifier
        self.background_samples = background_samples
        self.explainer: Optional[shap.TreeExplainer] = None
        self._initialized = False
        
        if classifier and classifier.is_loaded():
            self._initialize_explainer()
    
    def _initialize_explainer(self) -> None:
        """Initialize SHAP TreeExplainer with background data."""
        try:
            if self.classifier and self.classifier.model:
                # Generate synthetic background data for SHAP
                # In production, use actual benign traffic samples
                background = np.random.randn(self.background_samples, len(self.FEATURE_NAMES))
                background = (background * 0.5 + 0.5).clip(0, 1)  # Normalize to reasonable range
                
                self.explainer = shap.TreeExplainer(
                    self.classifier.model,
                    data=background,
                    feature_perturbation="interventional"
                )
                self._initialized = True
                logger.info("SHAP explainer initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize SHAP explainer: {e}")
            self._initialized = False
    
    def explain(self, features: List[float]) -> Dict:
        """
        Generate SHAP explanation for a prediction.
        
        Args:
            features: Feature vector of length 19
            
        Returns:
            Dictionary containing SHAP values and explanation
        """
        if not self._initialized or not self.explainer:
            return self._fallback_explanation(features)
        
        try:
            x = np.array(features, dtype=np.float32).reshape(1, -1)
            
            # Get SHAP values
            shap_values = self.explainer.shap_values(x)
            
            # For multi-class, shap_values is a list per class
            # We focus on the predicted class
            if isinstance(shap_values, list):
                # Get the class with highest absolute SHAP contribution
                max_class_idx = np.argmax([np.sum(np.abs(sv)) for sv in shap_values])
                class_shap_values = shap_values[max_class_idx][0]
            else:
                class_shap_values = shap_values[0]
            
            # Build explanation dictionary
            result = {
                "base_value": float(self.explainer.expected_value[0]) if isinstance(self.explainer.expected_value, list) else float(self.explainer.expected_value),
                "feature_names": self.FEATURE_NAMES,
                "feature_values": [float(v) for v in features],
                "shap_values": [float(v) for v in class_shap_values],
                "feature_descriptions": [self.FEATURE_DESCRIPTIONS.get(f, f) for f in self.FEATURE_NAMES],
            }
            
            # Add top contributing features summary
            contributions = list(zip(self.FEATURE_NAMES, class_shap_values))
            contributions.sort(key=lambda x: abs(x[1]), reverse=True)
            
            top_features = []
            for fname, shap_val in contributions[:5]:
                direction = "increases" if shap_val > 0 else "decreases"
                desc = self.FEATURE_DESCRIPTIONS.get(fname, fname)
                top_features.append({
                    "feature": fname,
                    "description": desc,
                    "shap_value": float(shap_val),
                    "impact": direction,
                    "magnitude": abs(float(shap_val)),
                })
            
            result["top_features"] = top_features
            result["summary"] = self._generate_summary(top_features)
            
            return result
            
        except Exception as e:
            logger.error(f"SHAP explanation error: {e}")
            return self._fallback_explanation(features)
    
    def _fallback_explanation(self, features: List[float]) -> Dict:
        """
        Generate a simple heuristic-based explanation when SHAP fails.
        """
        contributions = []
        
        # Simple heuristic: highlight suspicious features
        suspicious_indices = {
            12: "has_sql_keywords",
            13: "has_script_tags",
            14: "has_path_traversal",
            15: "has_command_injection",
        }
        
        for idx, name in suspicious_indices.items():
            if idx < len(features) and features[idx] > 0.5:
                contributions.append({
                    "feature": name,
                    "description": self.FEATURE_DESCRIPTIONS.get(name, name),
                    "shap_value": 0.5,  # Placeholder
                    "impact": "increases",
                    "magnitude": 0.5,
                })
        
        # Check entropy values
        if len(features) > 0 and features[0] > 0.8:  # header_entropy
            contributions.append({
                "feature": "header_entropy",
                "description": "High header randomness (unusual)",
                "shap_value": 0.3,
                "impact": "increases",
                "magnitude": 0.3,
            })
        
        if len(features) > 4 and features[4] > 200:  # uri_length
            contributions.append({
                "feature": "uri_length",
                "description": "Unusually long URL",
                "shap_value": 0.2,
                "impact": "increases",
                "magnitude": 0.2,
            })
        
        return {
            "base_value": 0.0,
            "feature_names": self.FEATURE_NAMES,
            "feature_values": [float(v) for v in features],
            "shap_values": [0.0] * len(self.FEATURE_NAMES),
            "top_features": contributions[:5],
            "summary": self._generate_summary(contributions[:5]),
            "fallback": True,
        }
    
    def _generate_summary(self, top_features: List[Dict]) -> str:
        """Generate human-readable summary from top features."""
        if not top_features:
            return "No significant factors identified."
        
        parts = []
        for feat in top_features[:3]:
            desc = feat.get("description", feat.get("feature", "Unknown"))
            impact = feat.get("impact", "affects")
            parts.append(f"{desc} ({impact} risk)")
        
        return "Key factors: " + ", ".join(parts) + "."
    
    def get_force_plot_data(self, features: List[float]) -> Dict:
        """
        Get data formatted for SHAP force plot visualization.
        
        Returns data compatible with SHAP JavaScript visualization.
        """
        explanation = self.explain(features)
        
        # Format for SHAP.js force plot
        force_data = {
            "outNames": ["Prediction"],
            "baseValue": explanation.get("base_value", 0),
            "link": "identity",
            "featureNames": explanation.get("feature_names", self.FEATURE_NAMES),
            "features": {},
            "plot_cmap": "RdBu",
        }
        
        # Add feature data
        for i, (name, value, shap_val) in enumerate(zip(
            explanation.get("feature_names", []),
            explanation.get("feature_values", []),
            explanation.get("shap_values", []),
        )):
            force_data["features"][str(i)] = {
                "effect": shap_val,
                "value": value,
            }
        
        return force_data
    
    def explain_batch(self, features_batch: List[List[float]]) -> List[Dict]:
        """Batch explanation for multiple samples."""
        return [self.explain(features) for features in features_batch]
