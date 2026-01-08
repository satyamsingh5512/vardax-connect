"""
Configuration management for VARDAx.
Uses environment variables with sensible defaults.
"""
import os
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Validate critical security settings
        if self.jwt_secret == "change-me-in-production":
            raise ValueError(
                "VARDAX_JWT_SECRET environment variable must be set to a secure value. "
                "Generate one with: python -c 'import secrets; print(secrets.token_urlsafe(32))'"
            )
    
    # Application
    app_name: str = "VARDAx"
    debug: bool = False
    api_prefix: str = "/api/v1"
    
    # CORS - Restrict origins in production
    cors_origins: list = [
        "http://localhost:3000",  # React dev server
        "http://127.0.0.1:3000",
        "https://vardax.vercel.app",  # Production frontend
        # Add your production domains here
    ]
    
    # Database
    database_url: str = os.getenv("VARDAX_DATABASE_URL", "sqlite:///./vardax.db")
    
    # Redis (optional for production)
    redis_url: str = os.getenv("VARDAX_REDIS_URL", "redis://localhost:6379")
    redis_stream_key: str = "traffic:stream"
    redis_anomaly_channel: str = "anomaly:events"
    
    # ML Settings
    model_path: str = "./models"
    anomaly_threshold: float = float(os.getenv("VARDAX_ANOMALY_THRESHOLD", "0.7"))
    high_confidence_threshold: float = 0.9
    
    # Feature extraction
    session_window_seconds: int = int(os.getenv("VARDAX_SESSION_WINDOW_SECONDS", "300"))
    rate_window_seconds: int = int(os.getenv("VARDAX_RATE_WINDOW_SECONDS", "60"))
    
    # Performance
    inference_timeout_ms: int = 50
    max_queue_size: int = 10000
    batch_size: int = 32
    
    # Security
    jwt_secret: str = os.getenv("VARDAX_JWT_SECRET", "")
    jwt_algorithm: str = "HS256"
    jwt_expiry_hours: int = 24
    
    class Config:
        env_file = ".env"
        env_prefix = "VARDAX_"


@lru_cache()
def get_settings() -> Settings:
    """Cached settings instance."""
    return Settings()
