"""
Sentinelas Model Training Script
Train Autoencoder and XGBoost classifier on CIC-IDS2017 dataset.

Usage:
    python training/train_models.py --data-path /path/to/cicids2017 --output-path ./saved_models

Dataset:
    Download CIC-IDS2017 from: https://www.unb.ca/cic/datasets/ids-2017.html
    Extract CSV files to the data-path directory.
"""

import argparse
import logging
import os
from pathlib import Path
from typing import Tuple

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.optim as optim
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from torch.utils.data import DataLoader, TensorDataset
import xgboost as xgb

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Feature columns used for training (mapped from CIC-IDS2017)
FEATURE_MAPPING = {
    "Flow Duration": "flow_duration",
    "Total Fwd Packets": "fwd_packets",
    "Total Backward Packets": "bwd_packets",
    "Flow Bytes/s": "bytes_per_sec",
    "Flow Packets/s": "packets_per_sec",
    "Fwd Packet Length Mean": "fwd_pkt_len_mean",
    "Bwd Packet Length Mean": "bwd_pkt_len_mean",
    "Flow IAT Mean": "iat_mean",
    "Fwd IAT Mean": "fwd_iat_mean",
    "Bwd IAT Mean": "bwd_iat_mean",
    "Fwd Header Length": "fwd_header_len",
    "Bwd Header Length": "bwd_header_len",
    "Packet Length Mean": "pkt_len_mean",
    "Packet Length Std": "pkt_len_std",
    "Average Packet Size": "avg_pkt_size",
    "Init_Win_bytes_forward": "init_win_fwd",
    "Init_Win_bytes_backward": "init_win_bwd",
    "min_seg_size_forward": "min_seg_size",
    "Subflow Fwd Bytes": "subflow_fwd_bytes",
}

# Our feature names (19 features)
OUTPUT_FEATURES = [
    "header_entropy", "header_count", "cookie_count", "cookie_entropy",
    "uri_length", "query_param_count", "path_depth", "path_entropy",
    "total_arg_length", "max_arg_length", "arg_entropy", "special_char_count",
    "has_sql_keywords", "has_script_tags", "has_path_traversal", "has_command_injection",
    "request_rate", "error_rate", "unique_endpoints"
]

# Attack label mapping
ATTACK_LABELS = [
    "benign", "sqli", "xss", "lfi", "rfi", "rce",
    "ssrf", "xxe", "path_traversal", "bot", "scanner", "dos", "anomaly"
]


class AutoencoderNetwork(nn.Module):
    """Autoencoder for anomaly detection."""
    
    def __init__(self, input_dim: int = 19, latent_dim: int = 8):
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Linear(input_dim, 32),
            nn.ReLU(),
            nn.BatchNorm1d(32),
            nn.Dropout(0.2),
            nn.Linear(32, 16),
            nn.ReLU(),
            nn.BatchNorm1d(16),
            nn.Linear(16, latent_dim),
        )
        self.decoder = nn.Sequential(
            nn.Linear(latent_dim, 16),
            nn.ReLU(),
            nn.BatchNorm1d(16),
            nn.Linear(16, 32),
            nn.ReLU(),
            nn.BatchNorm1d(32),
            nn.Dropout(0.2),
            nn.Linear(32, input_dim),
        )
    
    def forward(self, x):
        latent = self.encoder(x)
        reconstructed = self.decoder(latent)
        return reconstructed, latent


def load_cicids_data(data_path: str) -> Tuple[pd.DataFrame, np.ndarray]:
    """Load and preprocess CIC-IDS2017 dataset."""
    logger.info(f"Loading data from {data_path}")
    
    csv_files = list(Path(data_path).glob("*.csv"))
    if not csv_files:
        # Generate synthetic data for demo
        logger.warning("No CSV files found, generating synthetic data for demo")
        return generate_synthetic_data()
    
    dfs = []
    for csv_file in csv_files:
        try:
            df = pd.read_csv(csv_file, low_memory=False)
            dfs.append(df)
        except Exception as e:
            logger.warning(f"Error loading {csv_file}: {e}")
    
    data = pd.concat(dfs, ignore_index=True)
    logger.info(f"Loaded {len(data)} samples")
    
    # Extract features and labels
    label_col = " Label" if " Label" in data.columns else "Label"
    labels = data[label_col].values
    
    # Map features
    features = []
    for cic_name, our_name in FEATURE_MAPPING.items():
        if cic_name in data.columns or f" {cic_name}" in data.columns:
            col = cic_name if cic_name in data.columns else f" {cic_name}"
            features.append(data[col].values)
    
    X = np.column_stack(features) if features else np.random.randn(len(data), 19)
    
    return X, labels


def generate_synthetic_data(n_samples: int = 10000) -> Tuple[np.ndarray, np.ndarray]:
    """Generate synthetic training data for demo purposes."""
    logger.info("Generating synthetic training data")
    
    np.random.seed(42)
    
    # Generate benign samples (80%)
    n_benign = int(n_samples * 0.8)
    X_benign = np.random.randn(n_benign, 19) * 0.5 + 0.5
    X_benign = np.clip(X_benign, 0, 2)
    y_benign = np.zeros(n_benign, dtype=int)
    
    # Generate attack samples (20%)
    n_attack = n_samples - n_benign
    X_attack = np.random.randn(n_attack, 19) * 2 + 1
    
    # Add attack-specific patterns
    # SQLi: high special_char_count, has_sql_keywords
    sqli_mask = np.random.rand(n_attack) < 0.3
    X_attack[sqli_mask, 11] = np.random.uniform(5, 20, sqli_mask.sum())  # special_char_count
    X_attack[sqli_mask, 12] = 1  # has_sql_keywords
    
    # XSS: has_script_tags, high arg_entropy
    xss_mask = np.random.rand(n_attack) < 0.3
    X_attack[xss_mask, 13] = 1  # has_script_tags
    X_attack[xss_mask, 10] = np.random.uniform(3, 6, xss_mask.sum())  # arg_entropy
    
    # Path traversal
    pt_mask = np.random.rand(n_attack) < 0.2
    X_attack[pt_mask, 14] = 1  # has_path_traversal
    X_attack[pt_mask, 6] = np.random.uniform(5, 15, pt_mask.sum())  # path_depth
    
    # Assign attack labels
    y_attack = np.ones(n_attack, dtype=int)
    y_attack[sqli_mask] = 1   # sqli
    y_attack[xss_mask] = 2    # xss
    y_attack[pt_mask] = 8     # path_traversal
    
    X = np.vstack([X_benign, X_attack])
    y = np.concatenate([y_benign, y_attack])
    
    # Shuffle
    indices = np.random.permutation(len(X))
    return X[indices], y[indices]


def train_autoencoder(
    X_train: np.ndarray,
    X_val: np.ndarray,
    epochs: int = 50,
    batch_size: int = 64,
    learning_rate: float = 0.001,
) -> Tuple[AutoencoderNetwork, StandardScaler, float]:
    """Train autoencoder on benign traffic."""
    logger.info("Training autoencoder...")
    
    # Normalize
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_val_scaled = scaler.transform(X_val)
    
    # Convert to tensors
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    train_tensor = torch.tensor(X_train_scaled, dtype=torch.float32)
    val_tensor = torch.tensor(X_val_scaled, dtype=torch.float32)
    
    train_loader = DataLoader(TensorDataset(train_tensor), batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(TensorDataset(val_tensor), batch_size=batch_size)
    
    # Model
    model = AutoencoderNetwork(input_dim=X_train.shape[1]).to(device)
    optimizer = optim.Adam(model.parameters(), lr=learning_rate)
    criterion = nn.MSELoss()
    
    best_val_loss = float('inf')
    
    for epoch in range(epochs):
        model.train()
        train_loss = 0
        for batch in train_loader:
            x = batch[0].to(device)
            optimizer.zero_grad()
            reconstructed, _ = model(x)
            loss = criterion(reconstructed, x)
            loss.backward()
            optimizer.step()
            train_loss += loss.item()
        
        # Validation
        model.eval()
        val_loss = 0
        with torch.no_grad():
            for batch in val_loader:
                x = batch[0].to(device)
                reconstructed, _ = model(x)
                val_loss += criterion(reconstructed, x).item()
        
        train_loss /= len(train_loader)
        val_loss /= len(val_loader)
        
        if val_loss < best_val_loss:
            best_val_loss = val_loss
        
        if (epoch + 1) % 10 == 0:
            logger.info(f"Epoch {epoch+1}/{epochs} - Train Loss: {train_loss:.4f}, Val Loss: {val_loss:.4f}")
    
    # Calculate threshold (95th percentile of reconstruction error on validation)
    model.eval()
    errors = []
    with torch.no_grad():
        for batch in val_loader:
            x = batch[0].to(device)
            reconstructed, _ = model(x)
            batch_errors = torch.mean((x - reconstructed) ** 2, dim=1)
            errors.extend(batch_errors.cpu().numpy())
    
    threshold = float(np.percentile(errors, 95))
    logger.info(f"Autoencoder threshold: {threshold:.4f}")
    
    return model.cpu(), scaler, threshold


def train_xgboost(
    X_train: np.ndarray,
    y_train: np.ndarray,
    X_val: np.ndarray,
    y_val: np.ndarray,
) -> xgb.Booster:
    """Train XGBoost classifier."""
    logger.info("Training XGBoost classifier...")
    
    # Encode labels
    le = LabelEncoder()
    y_train_enc = le.fit_transform(y_train)
    y_val_enc = le.transform(y_val)
    
    num_classes = len(np.unique(y_train_enc))
    
    params = {
        "objective": "multi:softprob",
        "num_class": num_classes,
        "max_depth": 6,
        "eta": 0.1,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
        "eval_metric": ["mlogloss", "merror"],
        "seed": 42,
    }
    
    dtrain = xgb.DMatrix(X_train, label=y_train_enc, feature_names=OUTPUT_FEATURES)
    dval = xgb.DMatrix(X_val, label=y_val_enc, feature_names=OUTPUT_FEATURES)
    
    evals = [(dtrain, "train"), (dval, "val")]
    
    model = xgb.train(
        params,
        dtrain,
        num_boost_round=100,
        evals=evals,
        early_stopping_rounds=10,
        verbose_eval=20,
    )
    
    logger.info(f"XGBoost training complete. Best iteration: {model.best_iteration}")
    
    return model


def save_models(
    autoencoder: AutoencoderNetwork,
    scaler: StandardScaler,
    threshold: float,
    xgb_model: xgb.Booster,
    output_path: str,
):
    """Save trained models."""
    os.makedirs(output_path, exist_ok=True)
    
    # Save autoencoder
    ae_path = os.path.join(output_path, "autoencoder.pt")
    torch.save({
        "model_state_dict": autoencoder.state_dict(),
        "input_dim": 19,
        "latent_dim": 8,
        "threshold": threshold,
        "mean": scaler.mean_,
        "std": scaler.scale_,
    }, ae_path)
    logger.info(f"Autoencoder saved to {ae_path}")
    
    # Save XGBoost
    xgb_path = os.path.join(output_path, "xgboost_model.json")
    xgb_model.save_model(xgb_path)
    logger.info(f"XGBoost model saved to {xgb_path}")


def main():
    parser = argparse.ArgumentParser(description="Train Sentinelas ML models")
    parser.add_argument("--data-path", default="./data", help="Path to CIC-IDS2017 data")
    parser.add_argument("--output-path", default="./saved_models", help="Path to save models")
    parser.add_argument("--epochs", type=int, default=50, help="Autoencoder epochs")
    parser.add_argument("--batch-size", type=int, default=64, help="Batch size")
    args = parser.parse_args()
    
    # Load data
    X, y = load_cicids_data(args.data_path)
    
    # Ensure correct feature dimension
    if X.shape[1] != 19:
        logger.warning(f"Feature dimension mismatch: {X.shape[1]} != 19, padding/truncating")
        if X.shape[1] < 19:
            X = np.hstack([X, np.zeros((len(X), 19 - X.shape[1]))])
        else:
            X = X[:, :19]
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    X_train, X_val, y_train, y_val = train_test_split(X_train, y_train, test_size=0.1, random_state=42)
    
    logger.info(f"Train: {len(X_train)}, Val: {len(X_val)}, Test: {len(X_test)}")
    
    # Train autoencoder on benign data only
    benign_mask = y_train == 0
    X_train_benign = X_train[benign_mask] if benign_mask.sum() > 0 else X_train
    X_val_benign = X_val[y_val == 0] if (y_val == 0).sum() > 0 else X_val
    
    autoencoder, scaler, threshold = train_autoencoder(
        X_train_benign, X_val_benign, epochs=args.epochs, batch_size=args.batch_size
    )
    
    # Train XGBoost on all data
    xgb_model = train_xgboost(X_train, y_train, X_val, y_val)
    
    # Save models
    save_models(autoencoder, scaler, threshold, xgb_model, args.output_path)
    
    logger.info("Training complete!")


if __name__ == "__main__":
    main()
