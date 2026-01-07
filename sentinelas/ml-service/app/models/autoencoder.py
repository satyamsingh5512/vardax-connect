"""
Sentinelas Autoencoder Model
Anomaly detection using reconstruction error.
Trained on CIC-IDS2017 benign traffic patterns.
"""

import logging
import os
from typing import List, Optional, Tuple

import numpy as np
import torch
import torch.nn as nn

logger = logging.getLogger(__name__)


class AutoencoderNetwork(nn.Module):
    """Autoencoder neural network for anomaly detection."""
    
    def __init__(self, input_dim: int = 19, latent_dim: int = 8):
        super().__init__()
        
        # Encoder
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
        
        # Decoder
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
    
    def forward(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        latent = self.encoder(x)
        reconstructed = self.decoder(latent)
        return reconstructed, latent
    
    def encode(self, x: torch.Tensor) -> torch.Tensor:
        return self.encoder(x)
    
    def decode(self, z: torch.Tensor) -> torch.Tensor:
        return self.decoder(z)


class AutoencoderModel:
    """Wrapper for autoencoder inference and training."""
    
    def __init__(self, input_dim: int = 19, latent_dim: int = 8, threshold: float = 0.5):
        self.input_dim = input_dim
        self.latent_dim = latent_dim
        self.threshold = threshold
        self.model: Optional[AutoencoderNetwork] = None
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self._loaded = False
        
        # Feature normalization parameters
        self.mean: Optional[np.ndarray] = None
        self.std: Optional[np.ndarray] = None
    
    def is_loaded(self) -> bool:
        return self._loaded
    
    def load(self, path: str) -> None:
        """Load model from checkpoint."""
        try:
            checkpoint = torch.load(path, map_location=self.device)
            
            self.model = AutoencoderNetwork(
                input_dim=checkpoint.get("input_dim", self.input_dim),
                latent_dim=checkpoint.get("latent_dim", self.latent_dim),
            )
            self.model.load_state_dict(checkpoint["model_state_dict"])
            self.model.to(self.device)
            self.model.eval()
            
            self.threshold = checkpoint.get("threshold", self.threshold)
            self.mean = checkpoint.get("mean")
            self.std = checkpoint.get("std")
            
            self._loaded = True
            logger.info(f"Autoencoder loaded from {path} (threshold={self.threshold})")
            
        except Exception as e:
            logger.error(f"Failed to load autoencoder: {e}")
            self._initialize_default()
    
    def save(self, path: str) -> None:
        """Save model checkpoint."""
        if self.model is None:
            raise ValueError("No model to save")
        
        torch.save({
            "model_state_dict": self.model.state_dict(),
            "input_dim": self.input_dim,
            "latent_dim": self.latent_dim,
            "threshold": self.threshold,
            "mean": self.mean,
            "std": self.std,
        }, path)
        logger.info(f"Autoencoder saved to {path}")
    
    def _initialize_default(self) -> None:
        """Initialize with default untrained model."""
        self.model = AutoencoderNetwork(self.input_dim, self.latent_dim)
        self.model.to(self.device)
        self.model.eval()
        self.mean = np.zeros(self.input_dim)
        self.std = np.ones(self.input_dim)
        self._loaded = True
        logger.warning("Using untrained autoencoder model")
    
    def predict(self, features: List[float]) -> float:
        """
        Predict anomaly score for input features.
        Returns normalized score between 0 (normal) and 1 (anomalous).
        """
        if self.model is None:
            self._initialize_default()
        
        try:
            # Convert to tensor and normalize
            x = np.array(features, dtype=np.float32)
            if self.mean is not None and self.std is not None:
                x = (x - self.mean) / (self.std + 1e-8)
            
            x_tensor = torch.tensor(x, dtype=torch.float32).unsqueeze(0).to(self.device)
            
            # Get reconstruction
            with torch.no_grad():
                reconstructed, _ = self.model(x_tensor)
            
            # Compute reconstruction error (MSE)
            mse = torch.mean((x_tensor - reconstructed) ** 2).item()
            
            # Normalize to 0-1 range using sigmoid
            anomaly_score = 1 / (1 + np.exp(-5 * (mse - self.threshold)))
            
            return float(np.clip(anomaly_score, 0.0, 1.0))
            
        except Exception as e:
            logger.error(f"Prediction error: {e}")
            return 0.0  # Fail-safe: return normal
    
    def predict_batch(self, features_batch: List[List[float]]) -> List[float]:
        """Batch prediction for multiple samples."""
        if self.model is None:
            self._initialize_default()
        
        try:
            x = np.array(features_batch, dtype=np.float32)
            if self.mean is not None and self.std is not None:
                x = (x - self.mean) / (self.std + 1e-8)
            
            x_tensor = torch.tensor(x, dtype=torch.float32).to(self.device)
            
            with torch.no_grad():
                reconstructed, _ = self.model(x_tensor)
            
            mse = torch.mean((x_tensor - reconstructed) ** 2, dim=1).cpu().numpy()
            scores = 1 / (1 + np.exp(-5 * (mse - self.threshold)))
            
            return [float(np.clip(s, 0.0, 1.0)) for s in scores]
            
        except Exception as e:
            logger.error(f"Batch prediction error: {e}")
            return [0.0] * len(features_batch)
    
    def get_latent(self, features: List[float]) -> List[float]:
        """Get latent representation for input features."""
        if self.model is None:
            return [0.0] * self.latent_dim
        
        try:
            x = np.array(features, dtype=np.float32)
            if self.mean is not None and self.std is not None:
                x = (x - self.mean) / (self.std + 1e-8)
            
            x_tensor = torch.tensor(x, dtype=torch.float32).unsqueeze(0).to(self.device)
            
            with torch.no_grad():
                latent = self.model.encode(x_tensor)
            
            return latent.squeeze().cpu().numpy().tolist()
            
        except Exception as e:
            logger.error(f"Latent encoding error: {e}")
            return [0.0] * self.latent_dim
