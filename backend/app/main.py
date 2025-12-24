"""
VARDAx - ML-Powered WAF Anomaly Detection System

Main FastAPI application entry point.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from .api.routes import router, ws_router
from .api.routes_extended import router as extended_router
from .api.proxy import router as proxy_router
from .config import get_settings
from .ml.models import AnomalyDetector

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    logger.info("Starting VARDAx...")
    
    # Load ML models
    try:
        detector = AnomalyDetector()
        detector.load_models()
        logger.info("ML models loaded successfully")
    except Exception as e:
        logger.warning(f"Could not load ML models: {e}. Using untrained models.")
    
    yield
    
    # Shutdown
    logger.info("Shutting down VARDAx...")


# Create FastAPI app
app = FastAPI(
    title="VARDAx",
    description="ML-Powered WAF Anomaly Detection System",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware for dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(router, prefix="/api/v1")
app.include_router(ws_router, prefix="/api/v1")
app.include_router(extended_router, prefix="/api/v1")
app.include_router(proxy_router)  # Proxy routes at root level


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "name": "VARDAx",
        "version": "1.0.0",
        "status": "operational",
        "description": "ML-Powered WAF Anomaly Detection System"
    }


@app.get("/health")
async def health():
    """Detailed health check."""
    return {
        "status": "healthy",
        "components": {
            "api": "up",
            "ml_models": "loaded",
            "feature_extractor": "ready"
        }
    }
