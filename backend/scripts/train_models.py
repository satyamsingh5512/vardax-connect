#!/usr/bin/env python3
"""
Model Training Script for VARDAx.

Trains all three ML models on sample/historical traffic data.
Run this before deploying to production.

Usage:
    python scripts/train_models.py --data traffic_data.csv --output ./models
"""
import argparse
import logging
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.ml.models import IsolationForestModel, AutoencoderModel, EWMABaseline, AnomalyDetector

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def generate_synthetic_data(n_samples: int = 10000) -> pd.DataFrame:
    """
    Generate synthetic normal traffic data for training.
    
    In production, you would use real historical traffic data.
    This generates realistic-looking HTTP traffic patterns.
    """
    logger.info(f"Generating {n_samples} synthetic training samples...")
    
    np.random.seed(42)
    
    data = {
        # Request-level features
        'uri_length': np.random.lognormal(3.5, 0.5, n_samples).astype(int),
        'uri_depth': np.random.poisson(3, n_samples),
        'uri_entropy': np.random.normal(3.5, 0.5, n_samples),
        'query_param_count': np.random.poisson(2, n_samples),
        'query_length': np.random.lognormal(2.5, 1, n_samples).astype(int),
        'query_entropy': np.random.normal(3.0, 0.5, n_samples),
        'body_length': np.random.lognormal(5, 1.5, n_samples).astype(int),
        'body_entropy': np.random.normal(4.0, 0.5, n_samples),
        'body_printable_ratio': np.random.beta(9, 1, n_samples),
        'extension_risk_score': np.random.beta(1, 9, n_samples),
        'header_count': np.random.poisson(8, n_samples),
        
        # Session-level features
        'session_request_count': np.random.lognormal(2, 1, n_samples).astype(int),
        'session_unique_uris': np.random.lognormal(1.5, 0.8, n_samples).astype(int),
        'session_error_rate': np.random.beta(1, 20, n_samples),
        
        # Rate features
        'requests_per_minute': np.random.lognormal(3, 0.8, n_samples),
        'requests_per_minute_zscore': np.random.normal(0, 1, n_samples),
        
        # Behavioral features
        'user_agent_anomaly_score': np.random.beta(1, 9, n_samples),
        'bot_likelihood_score': np.random.beta(1, 9, n_samples),
    }
    
    df = pd.DataFrame(data)
    
    # Clip to reasonable ranges
    df['uri_length'] = df['uri_length'].clip(10, 500)
    df['body_length'] = df['body_length'].clip(0, 100000)
    df['session_request_count'] = df['session_request_count'].clip(1, 1000)
    df['requests_per_minute'] = df['requests_per_minute'].clip(1, 500)
    
    logger.info(f"Generated data shape: {df.shape}")
    return df


def train_isolation_forest(data: pd.DataFrame, output_path: Path):
    """Train Isolation Forest model."""
    logger.info("Training Isolation Forest...")
    
    # Select features for this model
    features = [col for col in IsolationForestModel.FEATURE_NAMES if col in data.columns]
    X = data[features].values
    
    model = IsolationForestModel(contamination=0.01, n_estimators=100)
    model.fit(X)
    
    # Save model
    model.save(output_path / "isolation_forest.joblib")
    logger.info(f"Isolation Forest saved to {output_path / 'isolation_forest.joblib'}")
    
    return model


def train_autoencoder(data: pd.DataFrame, output_path: Path):
    """Train Autoencoder model."""
    logger.info("Training Autoencoder...")
    
    # Select features for this model
    features = [col for col in AutoencoderModel.FEATURE_NAMES if col in data.columns]
    X = data[features].values
    
    model = AutoencoderModel(input_dim=len(features), encoding_dim=5)
    model.fit(X, epochs=100, lr=0.01)
    
    # Save model
    model.save(output_path / "autoencoder.joblib")
    logger.info(f"Autoencoder saved to {output_path / 'autoencoder.joblib'}")
    
    return model


def initialize_ewma_baseline(data: pd.DataFrame, output_path: Path):
    """Initialize EWMA baseline from historical data."""
    logger.info("Initializing EWMA Baseline...")
    
    baseline = EWMABaseline(alpha=0.1, threshold_std=3.0)
    
    # Simulate updating baseline with historical data
    for i in range(min(1000, len(data))):
        metrics = {
            'requests_per_minute': data.iloc[i].get('requests_per_minute', 100),
            'bytes_per_minute': data.iloc[i].get('body_length', 500) * 10,
            'error_rate_per_minute': data.iloc[i].get('session_error_rate', 0.02),
            'unique_ips_per_minute': np.random.randint(10, 100),
            'auth_failure_rate': np.random.beta(1, 50),
        }
        baseline.update(metrics)
    
    # Save baseline
    baseline.save(output_path / "ewma_baseline.joblib")
    logger.info(f"EWMA Baseline saved to {output_path / 'ewma_baseline.joblib'}")
    
    return baseline


def evaluate_models(data: pd.DataFrame, output_path: Path):
    """Quick evaluation of trained models."""
    logger.info("Evaluating models...")
    
    detector = AnomalyDetector(model_path=output_path)
    detector.load_models()
    
    # Test on a few samples
    n_test = min(100, len(data))
    anomaly_count = 0
    
    for i in range(n_test):
        features = data.iloc[i].to_dict()
        prediction = detector.predict(features)
        if prediction.is_anomaly:
            anomaly_count += 1
    
    anomaly_rate = anomaly_count / n_test
    logger.info(f"Anomaly rate on training data: {anomaly_rate:.2%}")
    logger.info(f"Expected: ~1% (contamination parameter)")
    
    if anomaly_rate > 0.05:
        logger.warning("Anomaly rate higher than expected. Consider adjusting thresholds.")


def main():
    parser = argparse.ArgumentParser(description="Train VARDAx ML models")
    parser.add_argument("--data", type=str, help="Path to training data CSV")
    parser.add_argument("--output", type=str, default="./models", help="Output directory for models")
    parser.add_argument("--samples", type=int, default=10000, help="Number of synthetic samples if no data provided")
    args = parser.parse_args()
    
    output_path = Path(args.output)
    output_path.mkdir(parents=True, exist_ok=True)
    
    # Load or generate training data
    if args.data and Path(args.data).exists():
        logger.info(f"Loading training data from {args.data}")
        data = pd.read_csv(args.data)
    else:
        logger.info("No training data provided, generating synthetic data")
        data = generate_synthetic_data(args.samples)
    
    # Train models
    train_isolation_forest(data, output_path)
    train_autoencoder(data, output_path)
    initialize_ewma_baseline(data, output_path)
    
    # Evaluate
    evaluate_models(data, output_path)
    
    logger.info("=" * 50)
    logger.info("Training complete!")
    logger.info(f"Models saved to: {output_path}")
    logger.info("=" * 50)


if __name__ == "__main__":
    main()
