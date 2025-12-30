#!/usr/bin/env python3
"""
vardax-ddos/bot-detector/train_model.py
VardaX Bot Detection - Model Training Pipeline

Trains LightGBM and Neural Network models for bot detection.
Exports models to ONNX format for fast inference at edge.
"""

import os
import json
import pickle
import argparse
from datetime import datetime
from typing import Dict, List, Tuple, Optional
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import (
    roc_auc_score, precision_recall_curve, classification_report,
    confusion_matrix, f1_score, precision_score, recall_score
)
from sklearn.preprocessing import StandardScaler
import lightgbm as lgb
import shap

# Optional: Neural network
try:
    import torch
    import torch.nn as nn
    import torch.optim as optim
    from torch.utils.data import DataLoader, TensorDataset
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False

# Optional: ONNX export
try:
    import onnx
    import onnxruntime
    from skl2onnx import convert_sklearn
    from skl2onnx.common.data_types import FloatTensorType
    HAS_ONNX = True
except ImportError:
    HAS_ONNX = False


# Feature names (must match feature_extractor.py)
FEATURE_NAMES = [
    'hour_of_day', 'day_of_week', 'is_weekend',
    'requests_last_1s', 'requests_last_10s', 'requests_last_60s',
    'inter_request_interval',
    'ip_is_ipv6', 'ip_first_octet', 'ip_class',
    'asn_is_datacenter', 'asn_normalized',
    'country_risk_score', 'is_tor_exit', 'is_vpn',
    'ja3_known_bot', 'ja3_known_browser', 'ja3_entropy',
    'tls_version_score', 'cipher_strength', 'has_sni',
    'method_encoded', 'path_depth', 'path_length',
    'query_param_count', 'query_length',
    'header_count', 'has_accept', 'has_accept_language',
    'has_accept_encoding', 'has_cookie', 'has_referer',
    'content_length_normalized',
    'ua_is_bot', 'ua_is_mobile', 'ua_is_tablet', 'ua_is_pc',
    'ua_browser_family', 'ua_os_family', 'ua_device_family',
    'ua_entropy',
    'challenge_passed', 'challenge_time_normalized',
    'session_request_count', 'session_unique_paths',
    'session_error_rate', 'session_avg_interval',
]


class BotDetectorTrainer:
    """Training pipeline for bot detection models"""
    
    def __init__(self, output_dir: str = "models"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        self.scaler = StandardScaler()
        self.lgb_model = None
        self.nn_model = None
        self.metrics = {}
    
    def load_data(self, data_path: str) -> Tuple[pd.DataFrame, pd.Series]:
        """Load training data from file
        
        Expected format: CSV or JSON with features and 'is_bot' label
        """
        if data_path.endswith('.csv'):
            df = pd.read_csv(data_path)
        elif data_path.endswith('.json'):
            df = pd.read_json(data_path, lines=True)
        elif data_path.endswith('.parquet'):
            df = pd.read_parquet(data_path)
        else:
            raise ValueError(f"Unsupported file format: {data_path}")
        
        # Ensure all features are present
        for feature in FEATURE_NAMES:
            if feature not in df.columns:
                print(f"Warning: Missing feature {feature}, filling with 0")
                df[feature] = 0.0
        
        X = df[FEATURE_NAMES]
        y = df['is_bot'].astype(int)
        
        print(f"Loaded {len(df)} samples")
        print(f"Bot ratio: {y.mean():.2%}")
        
        return X, y
    
    def generate_synthetic_data(self, n_samples: int = 100000) -> Tuple[pd.DataFrame, pd.Series]:
        """Generate synthetic training data for testing
        
        In production, use real labeled data from:
        - CAIDA DDoS dataset
        - CIC DDoS dataset
        - Your own labeled traffic logs
        """
        np.random.seed(42)
        
        # Generate normal traffic (70%)
        n_normal = int(n_samples * 0.7)
        normal_data = {
            'hour_of_day': np.random.uniform(0, 1, n_normal),
            'day_of_week': np.random.uniform(0, 1, n_normal),
            'is_weekend': np.random.choice([0, 1], n_normal, p=[0.7, 0.3]),
            'requests_last_1s': np.random.exponential(0.05, n_normal).clip(0, 1),
            'requests_last_10s': np.random.exponential(0.1, n_normal).clip(0, 1),
            'requests_last_60s': np.random.exponential(0.15, n_normal).clip(0, 1),
            'inter_request_interval': np.random.uniform(0.1, 1, n_normal),
            'ip_is_ipv6': np.random.choice([0, 1], n_normal, p=[0.9, 0.1]),
            'ip_first_octet': np.random.uniform(0, 1, n_normal),
            'ip_class': np.random.choice([0, 0.5, 1], n_normal),
            'asn_is_datacenter': np.random.choice([0, 1], n_normal, p=[0.95, 0.05]),
            'asn_normalized': np.random.uniform(0, 0.5, n_normal),
            'country_risk_score': np.random.choice([0.2, 0.5, 0.8], n_normal, p=[0.7, 0.2, 0.1]),
            'is_tor_exit': np.zeros(n_normal),
            'is_vpn': np.random.choice([0, 1], n_normal, p=[0.95, 0.05]),
            'ja3_known_bot': np.zeros(n_normal),
            'ja3_known_browser': np.random.choice([0, 1], n_normal, p=[0.3, 0.7]),
            'ja3_entropy': np.random.uniform(0.5, 1, n_normal),
            'tls_version_score': np.random.choice([0.8, 1.0], n_normal, p=[0.3, 0.7]),
            'cipher_strength': np.random.uniform(0.8, 1, n_normal),
            'has_sni': np.ones(n_normal),
            'method_encoded': np.random.choice([0, 0.3], n_normal, p=[0.8, 0.2]),
            'path_depth': np.random.uniform(0.1, 0.5, n_normal),
            'path_length': np.random.uniform(0.05, 0.3, n_normal),
            'query_param_count': np.random.exponential(0.1, n_normal).clip(0, 1),
            'query_length': np.random.exponential(0.1, n_normal).clip(0, 1),
            'header_count': np.random.uniform(0.3, 0.6, n_normal),
            'has_accept': np.ones(n_normal),
            'has_accept_language': np.random.choice([0, 1], n_normal, p=[0.1, 0.9]),
            'has_accept_encoding': np.ones(n_normal),
            'has_cookie': np.random.choice([0, 1], n_normal, p=[0.3, 0.7]),
            'has_referer': np.random.choice([0, 1], n_normal, p=[0.4, 0.6]),
            'content_length_normalized': np.random.exponential(0.05, n_normal).clip(0, 1),
            'ua_is_bot': np.zeros(n_normal),
            'ua_is_mobile': np.random.choice([0, 1], n_normal, p=[0.6, 0.4]),
            'ua_is_tablet': np.random.choice([0, 1], n_normal, p=[0.9, 0.1]),
            'ua_is_pc': np.random.choice([0, 1], n_normal, p=[0.5, 0.5]),
            'ua_browser_family': np.random.uniform(0.2, 0.8, n_normal),
            'ua_os_family': np.random.uniform(0.2, 0.8, n_normal),
            'ua_device_family': np.random.uniform(0.2, 0.8, n_normal),
            'ua_entropy': np.random.uniform(0.5, 0.9, n_normal),
            'challenge_passed': np.random.choice([0, 1], n_normal, p=[0.7, 0.3]),
            'challenge_time_normalized': np.random.uniform(0.1, 0.5, n_normal),
            'session_request_count': np.random.exponential(0.1, n_normal).clip(0, 1),
            'session_unique_paths': np.random.uniform(0.1, 0.5, n_normal),
            'session_error_rate': np.random.exponential(0.02, n_normal).clip(0, 1),
            'session_avg_interval': np.random.uniform(0.2, 0.8, n_normal),
        }
        
        # Generate bot traffic (30%)
        n_bot = n_samples - n_normal
        bot_data = {
            'hour_of_day': np.random.uniform(0, 1, n_bot),
            'day_of_week': np.random.uniform(0, 1, n_bot),
            'is_weekend': np.random.choice([0, 1], n_bot),
            'requests_last_1s': np.random.uniform(0.3, 1, n_bot),  # Higher rate
            'requests_last_10s': np.random.uniform(0.4, 1, n_bot),
            'requests_last_60s': np.random.uniform(0.5, 1, n_bot),
            'inter_request_interval': np.random.uniform(0, 0.2, n_bot),  # Lower interval
            'ip_is_ipv6': np.random.choice([0, 1], n_bot, p=[0.8, 0.2]),
            'ip_first_octet': np.random.uniform(0, 1, n_bot),
            'ip_class': np.random.choice([0, 0.5, 1], n_bot),
            'asn_is_datacenter': np.random.choice([0, 1], n_bot, p=[0.3, 0.7]),  # More datacenter
            'asn_normalized': np.random.uniform(0, 1, n_bot),
            'country_risk_score': np.random.choice([0.2, 0.5, 0.8], n_bot, p=[0.2, 0.3, 0.5]),
            'is_tor_exit': np.random.choice([0, 1], n_bot, p=[0.8, 0.2]),
            'is_vpn': np.random.choice([0, 1], n_bot, p=[0.5, 0.5]),
            'ja3_known_bot': np.random.choice([0, 1], n_bot, p=[0.4, 0.6]),  # More known bot
            'ja3_known_browser': np.random.choice([0, 1], n_bot, p=[0.8, 0.2]),
            'ja3_entropy': np.random.uniform(0, 0.5, n_bot),  # Lower entropy
            'tls_version_score': np.random.choice([0.4, 0.8, 1.0], n_bot),
            'cipher_strength': np.random.uniform(0.5, 1, n_bot),
            'has_sni': np.random.choice([0, 1], n_bot, p=[0.3, 0.7]),
            'method_encoded': np.random.choice([0, 0.3, 0.5], n_bot),
            'path_depth': np.random.uniform(0, 0.3, n_bot),
            'path_length': np.random.uniform(0, 0.2, n_bot),
            'query_param_count': np.random.uniform(0, 0.3, n_bot),
            'query_length': np.random.uniform(0, 0.2, n_bot),
            'header_count': np.random.uniform(0.1, 0.4, n_bot),  # Fewer headers
            'has_accept': np.random.choice([0, 1], n_bot, p=[0.3, 0.7]),
            'has_accept_language': np.random.choice([0, 1], n_bot, p=[0.6, 0.4]),
            'has_accept_encoding': np.random.choice([0, 1], n_bot, p=[0.2, 0.8]),
            'has_cookie': np.random.choice([0, 1], n_bot, p=[0.7, 0.3]),  # Less cookies
            'has_referer': np.random.choice([0, 1], n_bot, p=[0.8, 0.2]),  # Less referer
            'content_length_normalized': np.random.exponential(0.02, n_bot).clip(0, 1),
            'ua_is_bot': np.random.choice([0, 1], n_bot, p=[0.3, 0.7]),  # More bot UA
            'ua_is_mobile': np.random.choice([0, 1], n_bot, p=[0.9, 0.1]),
            'ua_is_tablet': np.zeros(n_bot),
            'ua_is_pc': np.random.choice([0, 1], n_bot, p=[0.7, 0.3]),
            'ua_browser_family': np.random.uniform(0.8, 1, n_bot),  # Unknown browsers
            'ua_os_family': np.random.uniform(0.8, 1, n_bot),
            'ua_device_family': np.random.uniform(0.8, 1, n_bot),
            'ua_entropy': np.random.uniform(0.1, 0.5, n_bot),  # Lower entropy
            'challenge_passed': np.random.choice([0, 1], n_bot, p=[0.9, 0.1]),  # Fail challenges
            'challenge_time_normalized': np.random.uniform(0, 0.1, n_bot),  # Fast (automated)
            'session_request_count': np.random.uniform(0.3, 1, n_bot),  # High volume
            'session_unique_paths': np.random.uniform(0, 0.2, n_bot),  # Few unique paths
            'session_error_rate': np.random.uniform(0.1, 0.5, n_bot),  # More errors
            'session_avg_interval': np.random.uniform(0, 0.1, n_bot),  # Fast requests
        }
        
        # Combine data
        normal_df = pd.DataFrame(normal_data)
        normal_df['is_bot'] = 0
        
        bot_df = pd.DataFrame(bot_data)
        bot_df['is_bot'] = 1
        
        df = pd.concat([normal_df, bot_df], ignore_index=True)
        df = df.sample(frac=1, random_state=42).reset_index(drop=True)  # Shuffle
        
        X = df[FEATURE_NAMES]
        y = df['is_bot']
        
        print(f"Generated {len(df)} synthetic samples")
        print(f"Bot ratio: {y.mean():.2%}")
        
        return X, y
    
    def train_lightgbm(
        self,
        X_train: pd.DataFrame,
        y_train: pd.Series,
        X_val: pd.DataFrame,
        y_val: pd.Series,
    ) -> lgb.Booster:
        """Train LightGBM model"""
        print("\n=== Training LightGBM ===")
        
        # Create datasets
        train_data = lgb.Dataset(X_train, label=y_train)
        val_data = lgb.Dataset(X_val, label=y_val, reference=train_data)
        
        # Parameters optimized for bot detection
        params = {
            'objective': 'binary',
            'metric': ['auc', 'binary_logloss'],
            'boosting_type': 'gbdt',
            'num_leaves': 31,
            'learning_rate': 0.05,
            'feature_fraction': 0.8,
            'bagging_fraction': 0.8,
            'bagging_freq': 5,
            'min_child_samples': 20,
            'reg_alpha': 0.1,
            'reg_lambda': 0.1,
            'verbose': -1,
            'seed': 42,
            # Class imbalance handling
            'is_unbalance': True,
        }
        
        # Train with early stopping
        self.lgb_model = lgb.train(
            params,
            train_data,
            num_boost_round=1000,
            valid_sets=[train_data, val_data],
            valid_names=['train', 'val'],
            callbacks=[
                lgb.early_stopping(stopping_rounds=50),
                lgb.log_evaluation(period=100),
            ],
        )
        
        # Feature importance
        importance = pd.DataFrame({
            'feature': FEATURE_NAMES,
            'importance': self.lgb_model.feature_importance(importance_type='gain'),
        }).sort_values('importance', ascending=False)
        
        print("\nTop 10 important features:")
        print(importance.head(10).to_string(index=False))
        
        return self.lgb_model
    
    def train_neural_network(
        self,
        X_train: np.ndarray,
        y_train: np.ndarray,
        X_val: np.ndarray,
        y_val: np.ndarray,
    ):
        """Train small neural network baseline"""
        if not HAS_TORCH:
            print("PyTorch not available, skipping NN training")
            return None
        
        print("\n=== Training Neural Network ===")
        
        # Define model
        class BotDetectorNN(nn.Module):
            def __init__(self, input_dim):
                super().__init__()
                self.network = nn.Sequential(
                    nn.Linear(input_dim, 64),
                    nn.ReLU(),
                    nn.Dropout(0.3),
                    nn.Linear(64, 32),
                    nn.ReLU(),
                    nn.Dropout(0.2),
                    nn.Linear(32, 16),
                    nn.ReLU(),
                    nn.Linear(16, 1),
                    nn.Sigmoid(),
                )
            
            def forward(self, x):
                return self.network(x)
        
        # Prepare data
        X_train_t = torch.FloatTensor(X_train)
        y_train_t = torch.FloatTensor(y_train).unsqueeze(1)
        X_val_t = torch.FloatTensor(X_val)
        y_val_t = torch.FloatTensor(y_val).unsqueeze(1)
        
        train_dataset = TensorDataset(X_train_t, y_train_t)
        train_loader = DataLoader(train_dataset, batch_size=256, shuffle=True)
        
        # Initialize model
        model = BotDetectorNN(X_train.shape[1])
        criterion = nn.BCELoss()
        optimizer = optim.Adam(model.parameters(), lr=0.001)
        
        # Training loop
        best_val_auc = 0
        patience = 10
        patience_counter = 0
        
        for epoch in range(100):
            model.train()
            train_loss = 0
            
            for batch_X, batch_y in train_loader:
                optimizer.zero_grad()
                outputs = model(batch_X)
                loss = criterion(outputs, batch_y)
                loss.backward()
                optimizer.step()
                train_loss += loss.item()
            
            # Validation
            model.eval()
            with torch.no_grad():
                val_outputs = model(X_val_t)
                val_loss = criterion(val_outputs, y_val_t)
                val_auc = roc_auc_score(y_val, val_outputs.numpy())
            
            if (epoch + 1) % 10 == 0:
                print(f"Epoch {epoch+1}: train_loss={train_loss/len(train_loader):.4f}, "
                      f"val_loss={val_loss:.4f}, val_auc={val_auc:.4f}")
            
            # Early stopping
            if val_auc > best_val_auc:
                best_val_auc = val_auc
                patience_counter = 0
                self.nn_model = model
            else:
                patience_counter += 1
                if patience_counter >= patience:
                    print(f"Early stopping at epoch {epoch+1}")
                    break
        
        return self.nn_model
    
    def evaluate(
        self,
        X_test: pd.DataFrame,
        y_test: pd.Series,
        model_name: str = "lightgbm",
    ) -> Dict:
        """Evaluate model performance"""
        print(f"\n=== Evaluating {model_name} ===")
        
        if model_name == "lightgbm":
            y_pred_proba = self.lgb_model.predict(X_test)
        elif model_name == "nn" and self.nn_model:
            self.nn_model.eval()
            with torch.no_grad():
                y_pred_proba = self.nn_model(torch.FloatTensor(X_test.values)).numpy().flatten()
        else:
            raise ValueError(f"Unknown model: {model_name}")
        
        # Calculate metrics at different thresholds
        y_pred_05 = (y_pred_proba >= 0.5).astype(int)
        y_pred_07 = (y_pred_proba >= 0.7).astype(int)
        y_pred_08 = (y_pred_proba >= 0.8).astype(int)
        
        metrics = {
            'roc_auc': roc_auc_score(y_test, y_pred_proba),
            'threshold_0.5': {
                'precision': precision_score(y_test, y_pred_05),
                'recall': recall_score(y_test, y_pred_05),
                'f1': f1_score(y_test, y_pred_05),
            },
            'threshold_0.7': {
                'precision': precision_score(y_test, y_pred_07),
                'recall': recall_score(y_test, y_pred_07),
                'f1': f1_score(y_test, y_pred_07),
            },
            'threshold_0.8': {
                'precision': precision_score(y_test, y_pred_08),
                'recall': recall_score(y_test, y_pred_08),
                'f1': f1_score(y_test, y_pred_08),
            },
        }
        
        # Precision at recall >= 0.9
        precision, recall, thresholds = precision_recall_curve(y_test, y_pred_proba)
        idx = np.where(recall >= 0.9)[0]
        if len(idx) > 0:
            metrics['precision_at_recall_0.9'] = precision[idx[-1]]
        
        print(f"ROC AUC: {metrics['roc_auc']:.4f}")
        print(f"Precision@0.5: {metrics['threshold_0.5']['precision']:.4f}")
        print(f"Recall@0.5: {metrics['threshold_0.5']['recall']:.4f}")
        print(f"F1@0.5: {metrics['threshold_0.5']['f1']:.4f}")
        
        print("\nClassification Report (threshold=0.7):")
        print(classification_report(y_test, y_pred_07, target_names=['Normal', 'Bot']))
        
        return metrics
    
    def explain_model(self, X_sample: pd.DataFrame):
        """Generate SHAP explanations"""
        print("\n=== SHAP Explanations ===")
        
        explainer = shap.TreeExplainer(self.lgb_model)
        shap_values = explainer.shap_values(X_sample)
        
        # Summary plot
        print("Top features by SHAP importance:")
        shap_importance = pd.DataFrame({
            'feature': FEATURE_NAMES,
            'shap_importance': np.abs(shap_values).mean(axis=0),
        }).sort_values('shap_importance', ascending=False)
        print(shap_importance.head(10).to_string(index=False))
        
        return shap_values
    
    def save_models(self):
        """Save trained models"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Save LightGBM
        lgb_path = self.output_dir / f"bot_detector_lgb_{timestamp}.txt"
        self.lgb_model.save_model(str(lgb_path))
        print(f"Saved LightGBM model to {lgb_path}")
        
        # Save scaler
        scaler_path = self.output_dir / f"scaler_{timestamp}.pkl"
        with open(scaler_path, 'wb') as f:
            pickle.dump(self.scaler, f)
        
        # Save feature names
        config_path = self.output_dir / f"model_config_{timestamp}.json"
        with open(config_path, 'w') as f:
            json.dump({
                'feature_names': FEATURE_NAMES,
                'timestamp': timestamp,
                'metrics': self.metrics,
            }, f, indent=2)
        
        # Export to ONNX if available
        if HAS_ONNX:
            self._export_onnx(timestamp)
        
        # Create symlink to latest
        latest_lgb = self.output_dir / "bot_detector_lgb_latest.txt"
        if latest_lgb.exists():
            latest_lgb.unlink()
        latest_lgb.symlink_to(lgb_path.name)
        
        print(f"Models saved to {self.output_dir}")
    
    def _export_onnx(self, timestamp: str):
        """Export model to ONNX format"""
        # LightGBM to ONNX requires special handling
        # Using a wrapper approach
        print("ONNX export not implemented for LightGBM in this version")
        print("Use Treelite for optimized inference instead")


def main():
    parser = argparse.ArgumentParser(description='Train VardaX bot detection model')
    parser.add_argument('--data', type=str, help='Path to training data')
    parser.add_argument('--synthetic', action='store_true', help='Use synthetic data')
    parser.add_argument('--samples', type=int, default=100000, help='Number of synthetic samples')
    parser.add_argument('--output', type=str, default='models', help='Output directory')
    parser.add_argument('--train-nn', action='store_true', help='Also train neural network')
    args = parser.parse_args()
    
    trainer = BotDetectorTrainer(output_dir=args.output)
    
    # Load or generate data
    if args.data:
        X, y = trainer.load_data(args.data)
    else:
        print("Using synthetic data for training")
        X, y = trainer.generate_synthetic_data(n_samples=args.samples)
    
    # Split data
    X_train, X_temp, y_train, y_temp = train_test_split(X, y, test_size=0.3, random_state=42, stratify=y)
    X_val, X_test, y_val, y_test = train_test_split(X_temp, y_temp, test_size=0.5, random_state=42, stratify=y_temp)
    
    print(f"\nData splits:")
    print(f"  Train: {len(X_train)} samples")
    print(f"  Val: {len(X_val)} samples")
    print(f"  Test: {len(X_test)} samples")
    
    # Scale features
    X_train_scaled = trainer.scaler.fit_transform(X_train)
    X_val_scaled = trainer.scaler.transform(X_val)
    X_test_scaled = trainer.scaler.transform(X_test)
    
    # Train LightGBM
    trainer.train_lightgbm(X_train, y_train, X_val, y_val)
    trainer.metrics['lightgbm'] = trainer.evaluate(X_test, y_test, 'lightgbm')
    
    # Train Neural Network (optional)
    if args.train_nn and HAS_TORCH:
        trainer.train_neural_network(X_train_scaled, y_train.values, X_val_scaled, y_val.values)
        if trainer.nn_model:
            trainer.metrics['nn'] = trainer.evaluate(
                pd.DataFrame(X_test_scaled, columns=FEATURE_NAMES),
                y_test,
                'nn'
            )
    
    # SHAP explanations
    trainer.explain_model(X_test.head(1000))
    
    # Save models
    trainer.save_models()
    
    print("\n=== Training Complete ===")
    print(f"LightGBM ROC AUC: {trainer.metrics['lightgbm']['roc_auc']:.4f}")


if __name__ == '__main__':
    main()
