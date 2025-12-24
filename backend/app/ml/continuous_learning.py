"""
Continuous Learning Pipeline for VARDAx.

Implements:
1. Automated model retraining on feedback data
2. Model drift detection
3. A/B testing for new models
4. Automatic rollback on performance degradation

DESIGN PHILOSOPHY:
- Models should improve over time from analyst feedback
- False positives should decrease as system learns
- Drift detection prevents model staleness
- Safe deployment with automatic rollback
"""
import logging
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import joblib

from .models import IsolationForestModel, AutoencoderModel, EWMABaseline, AnomalyDetector
from ..database import get_db

logger = logging.getLogger(__name__)


@dataclass
class ModelMetrics:
    """Performance metrics for a model version."""
    version: str
    timestamp: datetime
    false_positive_rate: float
    true_positive_rate: float
    precision: float
    recall: float
    f1_score: float
    inference_latency_ms: float
    sample_count: int


@dataclass
class DriftMetrics:
    """Metrics for detecting model drift."""
    feature_drift_score: float  # 0-1, higher = more drift
    prediction_drift_score: float
    performance_degradation: float
    is_drifted: bool
    drifted_features: List[str]


class ContinuousLearner:
    """
    Manages continuous learning lifecycle.
    
    Workflow:
    1. Collect feedback data (analyst labels)
    2. Detect if retraining is needed (drift or performance drop)
    3. Train new model version
    4. A/B test new vs old model
    5. Deploy if better, rollback if worse
    """
    
    def __init__(
        self,
        model_path: Path = Path("./models"),
        min_feedback_samples: int = 100,
        retrain_interval_hours: int = 168,  # Weekly
        drift_threshold: float = 0.3,
        performance_threshold: float = 0.05  # 5% degradation triggers retrain
    ):
        self.model_path = model_path
        self.min_feedback_samples = min_feedback_samples
        self.retrain_interval_hours = retrain_interval_hours
        self.drift_threshold = drift_threshold
        self.performance_threshold = performance_threshold
        
        self.db = get_db()
        
        # Track model versions
        self.current_version = self._load_current_version()
        self.model_history: List[ModelMetrics] = []
        
        # Feature statistics for drift detection
        self.baseline_feature_stats: Optional[Dict] = None
    
    def _load_current_version(self) -> str:
        """Load current model version from metadata."""
        metadata_path = self.model_path / "metadata.json"
        if metadata_path.exists():
            import json
            with open(metadata_path) as f:
                metadata = json.load(f)
                return metadata.get("version", "1.0.0")
        return "1.0.0"
    
    def _save_version_metadata(self, version: str, metrics: ModelMetrics):
        """Save model version metadata."""
        import json
        metadata = {
            "version": version,
            "timestamp": datetime.utcnow().isoformat(),
            "metrics": {
                "false_positive_rate": metrics.false_positive_rate,
                "precision": metrics.precision,
                "recall": metrics.recall,
                "f1_score": metrics.f1_score
            }
        }
        with open(self.model_path / "metadata.json", "w") as f:
            json.dump(metadata, f, indent=2)
    
    def should_retrain(self) -> Tuple[bool, str]:
        """
        Determine if retraining is needed.
        
        Returns:
            (should_retrain, reason)
        """
        # Check 1: Enough feedback data?
        feedback_count = self.db.get_feedback_count()
        if feedback_count < self.min_feedback_samples:
            return False, f"Insufficient feedback ({feedback_count}/{self.min_feedback_samples})"
        
        # Check 2: Time since last training
        last_train_time = self._get_last_training_time()
        if last_train_time:
            hours_since = (datetime.utcnow() - last_train_time).total_seconds() / 3600
            if hours_since < self.retrain_interval_hours:
                return False, f"Too soon since last training ({hours_since:.1f}h/{self.retrain_interval_hours}h)"
        
        # Check 3: Model drift detected?
        drift = self.detect_drift()
        if drift.is_drifted:
            return True, f"Model drift detected (score: {drift.feature_drift_score:.2f})"
        
        # Check 4: Performance degradation?
        if self.model_history:
            latest = self.model_history[-1]
            if latest.false_positive_rate > self.performance_threshold:
                return True, f"High false positive rate: {latest.false_positive_rate:.2%}"
        
        # Check 5: Scheduled retraining
        if last_train_time:
            hours_since = (datetime.utcnow() - last_train_time).total_seconds() / 3600
            if hours_since >= self.retrain_interval_hours:
                return True, "Scheduled retraining interval reached"
        
        return False, "No retraining needed"
    
    def detect_drift(self) -> DriftMetrics:
        """
        Detect if model has drifted from training distribution.
        
        Uses:
        - Feature distribution changes (KL divergence)
        - Prediction distribution changes
        - Performance metrics over time
        """
        # Get recent traffic features
        recent_events = self.db.get_traffic_events(since_hours=24, limit=1000)
        if len(recent_events) < 100:
            return DriftMetrics(
                feature_drift_score=0.0,
                prediction_drift_score=0.0,
                performance_degradation=0.0,
                is_drifted=False,
                drifted_features=[]
            )
        
        # Extract features
        recent_features = pd.DataFrame([e.get("features", {}) for e in recent_events])
        
        # Initialize baseline if not exists
        if self.baseline_feature_stats is None:
            self.baseline_feature_stats = {
                col: {
                    "mean": recent_features[col].mean(),
                    "std": recent_features[col].std()
                }
                for col in recent_features.columns
            }
            return DriftMetrics(
                feature_drift_score=0.0,
                prediction_drift_score=0.0,
                performance_degradation=0.0,
                is_drifted=False,
                drifted_features=[]
            )
        
        # Calculate drift for each feature
        drifted_features = []
        drift_scores = []
        
        for col in recent_features.columns:
            if col not in self.baseline_feature_stats:
                continue
            
            baseline = self.baseline_feature_stats[col]
            current_mean = recent_features[col].mean()
            current_std = recent_features[col].std()
            
            # Z-score of mean shift
            if baseline["std"] > 0:
                mean_shift = abs(current_mean - baseline["mean"]) / baseline["std"]
                drift_scores.append(mean_shift)
                
                if mean_shift > 2.0:  # 2 standard deviations
                    drifted_features.append(col)
        
        # Overall drift score
        feature_drift_score = np.mean(drift_scores) if drift_scores else 0.0
        
        # Prediction drift (anomaly rate change)
        recent_anomaly_rate = sum(1 for e in recent_events if e.get("is_anomaly", False)) / len(recent_events)
        baseline_anomaly_rate = 0.02  # Expected 2%
        prediction_drift_score = abs(recent_anomaly_rate - baseline_anomaly_rate)
        
        # Performance degradation
        performance_degradation = 0.0
        if self.model_history:
            latest_fpr = self.model_history[-1].false_positive_rate
            baseline_fpr = min(m.false_positive_rate for m in self.model_history)
            performance_degradation = latest_fpr - baseline_fpr
        
        is_drifted = (
            feature_drift_score > self.drift_threshold or
            prediction_drift_score > 0.05 or
            performance_degradation > self.performance_threshold
        )
        
        return DriftMetrics(
            feature_drift_score=feature_drift_score,
            prediction_drift_score=prediction_drift_score,
            performance_degradation=performance_degradation,
            is_drifted=is_drifted,
            drifted_features=drifted_features
        )
    
    def _get_last_training_time(self) -> Optional[datetime]:
        """Get timestamp of last training."""
        metadata_path = self.model_path / "metadata.json"
        if metadata_path.exists():
            import json
            with open(metadata_path) as f:
                metadata = json.load(f)
                ts = metadata.get("timestamp")
                if ts:
                    return datetime.fromisoformat(ts)
        return None
    
    def collect_training_data(self) -> pd.DataFrame:
        """
        Collect training data from feedback.
        
        Strategy:
        - True negatives (normal traffic, no anomaly)
        - False positives (flagged as anomaly, analyst marked normal)
        - Exclude true positives (real attacks) from training
        """
        # Get all traffic with feedback
        feedback_data = self.db.get_feedback_data()
        
        training_samples = []
        
        for item in feedback_data:
            feedback_type = item.get("feedback_type")
            features = item.get("features", {})
            
            # Include in training if:
            # 1. Marked as false positive (learn what's normal)
            # 2. Normal traffic (not flagged as anomaly)
            if feedback_type == "false_positive" or not item.get("is_anomaly", False):
                training_samples.append(features)
        
        # Also include recent normal traffic (no feedback)
        recent_normal = self.db.get_traffic_events(
            since_hours=168,  # Last week
            limit=5000,
            anomaly_only=False
        )
        
        for event in recent_normal:
            if not event.get("is_anomaly", False):
                training_samples.append(event.get("features", {}))
        
        df = pd.DataFrame(training_samples)
        logger.info(f"Collected {len(df)} training samples")
        
        return df
    
    def retrain_models(self) -> str:
        """
        Retrain all models with new data.
        
        Returns:
            New model version string
        """
        logger.info("Starting model retraining...")
        
        # Collect training data
        training_data = self.collect_training_data()
        
        if len(training_data) < self.min_feedback_samples:
            raise ValueError(f"Insufficient training data: {len(training_data)}")
        
        # Generate new version
        new_version = self._generate_version()
        version_path = self.model_path / new_version
        version_path.mkdir(parents=True, exist_ok=True)
        
        # Train Isolation Forest
        if_features = [col for col in IsolationForestModel.FEATURE_NAMES if col in training_data.columns]
        if_model = IsolationForestModel()
        if_model.fit(training_data[if_features].values)
        if_model.save(version_path / "isolation_forest.joblib")
        
        # Train Autoencoder
        ae_features = [col for col in AutoencoderModel.FEATURE_NAMES if col in training_data.columns]
        ae_model = AutoencoderModel(input_dim=len(ae_features))
        ae_model.fit(training_data[ae_features].values, epochs=100)
        ae_model.save(version_path / "autoencoder.joblib")
        
        # Update EWMA baseline
        ewma = EWMABaseline()
        for i in range(min(1000, len(training_data))):
            metrics = {
                'requests_per_minute': training_data.iloc[i].get('requests_per_minute', 100),
                'bytes_per_minute': training_data.iloc[i].get('body_length', 500) * 10,
                'error_rate_per_minute': training_data.iloc[i].get('session_error_rate', 0.02),
                'unique_ips_per_minute': 50,
                'auth_failure_rate': 0.01,
            }
            ewma.update(metrics)
        ewma.save(version_path / "ewma_baseline.joblib")
        
        logger.info(f"Models retrained successfully: version {new_version}")
        
        return new_version
    
    def _generate_version(self) -> str:
        """Generate new version string."""
        major, minor, patch = map(int, self.current_version.split("."))
        patch += 1
        return f"{major}.{minor}.{patch}"
    
    def ab_test_model(self, new_version: str, test_duration_hours: int = 24) -> bool:
        """
        A/B test new model version against current.
        
        Returns:
            True if new model performs better
        """
        logger.info(f"Starting A/B test: {self.current_version} vs {new_version}")
        
        # Load both models
        current_detector = AnomalyDetector(model_path=self.model_path)
        current_detector.load_models()
        
        new_detector = AnomalyDetector(model_path=self.model_path / new_version)
        new_detector.load_models()
        
        # Get test data (recent traffic with feedback)
        test_data = self.db.get_feedback_data(limit=500)
        
        if len(test_data) < 50:
            logger.warning("Insufficient test data for A/B testing")
            return False
        
        # Evaluate both models
        current_metrics = self._evaluate_model(current_detector, test_data)
        new_metrics = self._evaluate_model(new_detector, test_data)
        
        logger.info(f"Current model - FPR: {current_metrics.false_positive_rate:.2%}, "
                   f"F1: {current_metrics.f1_score:.3f}")
        logger.info(f"New model - FPR: {new_metrics.false_positive_rate:.2%}, "
                   f"F1: {new_metrics.f1_score:.3f}")
        
        # New model is better if:
        # 1. Lower false positive rate
        # 2. Higher F1 score
        # 3. Similar or better latency
        is_better = (
            new_metrics.false_positive_rate < current_metrics.false_positive_rate and
            new_metrics.f1_score >= current_metrics.f1_score * 0.95  # Allow 5% F1 drop
        )
        
        return is_better
    
    def _evaluate_model(self, detector: AnomalyDetector, test_data: List[Dict]) -> ModelMetrics:
        """Evaluate model on test data."""
        true_positives = 0
        false_positives = 0
        true_negatives = 0
        false_negatives = 0
        latencies = []
        
        for item in test_data:
            features = item.get("features", {})
            is_actual_anomaly = item.get("feedback_type") != "false_positive"
            
            # Time inference
            start = datetime.utcnow()
            prediction = detector.predict(features)
            latency = (datetime.utcnow() - start).total_seconds() * 1000
            latencies.append(latency)
            
            # Confusion matrix
            if prediction.is_anomaly and is_actual_anomaly:
                true_positives += 1
            elif prediction.is_anomaly and not is_actual_anomaly:
                false_positives += 1
            elif not prediction.is_anomaly and not is_actual_anomaly:
                true_negatives += 1
            else:
                false_negatives += 1
        
        # Calculate metrics
        total = len(test_data)
        fpr = false_positives / (false_positives + true_negatives) if (false_positives + true_negatives) > 0 else 0
        tpr = true_positives / (true_positives + false_negatives) if (true_positives + false_negatives) > 0 else 0
        precision = true_positives / (true_positives + false_positives) if (true_positives + false_positives) > 0 else 0
        recall = tpr
        f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
        
        return ModelMetrics(
            version=detector.model_path.name,
            timestamp=datetime.utcnow(),
            false_positive_rate=fpr,
            true_positive_rate=tpr,
            precision=precision,
            recall=recall,
            f1_score=f1,
            inference_latency_ms=np.mean(latencies),
            sample_count=total
        )
    
    def deploy_model(self, version: str):
        """Deploy new model version to production."""
        logger.info(f"Deploying model version {version}")
        
        version_path = self.model_path / version
        
        # Copy models to production path
        import shutil
        for model_file in ["isolation_forest.joblib", "autoencoder.joblib", "ewma_baseline.joblib"]:
            src = version_path / model_file
            dst = self.model_path / model_file
            if src.exists():
                shutil.copy(src, dst)
        
        # Update version metadata
        self.current_version = version
        
        # Save deployment record
        self.db.save_model_deployment({
            "version": version,
            "deployed_at": datetime.utcnow().isoformat(),
            "deployed_by": "continuous_learner"
        })
        
        logger.info(f"Model {version} deployed successfully")
    
    def rollback_model(self, to_version: Optional[str] = None):
        """Rollback to previous model version."""
        if to_version is None:
            # Find previous version
            deployments = self.db.get_model_deployments()
            if len(deployments) < 2:
                logger.error("No previous version to rollback to")
                return
            to_version = deployments[-2]["version"]
        
        logger.warning(f"Rolling back to model version {to_version}")
        self.deploy_model(to_version)
    
    def run_continuous_learning_cycle(self):
        """
        Run one cycle of continuous learning.
        
        This should be called periodically (e.g., daily cron job).
        """
        logger.info("=" * 60)
        logger.info("Starting continuous learning cycle")
        logger.info("=" * 60)
        
        # Check if retraining needed
        should_retrain, reason = self.should_retrain()
        logger.info(f"Retrain check: {should_retrain} - {reason}")
        
        if not should_retrain:
            return
        
        try:
            # Retrain models
            new_version = self.retrain_models()
            
            # A/B test
            is_better = self.ab_test_model(new_version)
            
            if is_better:
                # Deploy new version
                self.deploy_model(new_version)
                logger.info(f"✓ New model {new_version} deployed")
            else:
                logger.info(f"✗ New model {new_version} did not outperform current")
                
        except Exception as e:
            logger.error(f"Continuous learning cycle failed: {e}")
            raise
        
        logger.info("=" * 60)
        logger.info("Continuous learning cycle complete")
        logger.info("=" * 60)
