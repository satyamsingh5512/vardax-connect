"""
VARDAx - ML-Powered WAF Anomaly Detection System

Main FastAPI application entry point.
"""
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import os

from .api.routes import router, ws_router
from .api.routes_extended import router as extended_router
from .api.proxy import router as proxy_router
from .config import get_settings
from .ml.models import AnomalyDetector
from .security import check_rate_limit

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler with graceful shutdown."""
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
    
    # Close database connections
    try:
        db = get_db()
        if hasattr(db, 'close'):
            db.close()
        logger.info("Database connections closed")
    except Exception as e:
        logger.error(f"Error closing database: {e}")
    
    # Close Redis connections if any
    try:
        settings = get_settings()
        if settings.redis_url:
            import redis
            r = redis.from_url(settings.redis_url)
            r.close()
        logger.info("Redis connections closed")
    except Exception as e:
        logger.error(f"Error closing Redis: {e}")
    
    logger.info("VARDAx shutdown complete")


# Create FastAPI app
app = FastAPI(
    title="VARDAx",
    description="ML-Powered WAF Anomaly Detection System",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware for dashboard
debug_mode = settings.debug or os.getenv("VARDAX_DEBUG", "false").lower() == "true"
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if debug_mode else settings.cors_origins,
    allow_credentials=False,  # Disable credentials for security
    allow_methods=["GET", "POST", "PUT", "DELETE"],  # Specific methods only
    allow_headers=["Content-Type", "Authorization", "ngrok-skip-browser-warning"],
    expose_headers=["Content-Type"],
)

# Include routers with rate limiting on API endpoints
app.include_router(router, prefix="/api/v1", dependencies=[Depends(check_rate_limit)])
app.include_router(ws_router, prefix="/api/v1")  # WebSocket doesn't need rate limiting
app.include_router(extended_router, prefix="/api/v1", dependencies=[Depends(check_rate_limit)])
app.include_router(proxy_router)  # Proxy routes at root level


@app.get("/")
async def root():
    """Health check endpoint with HTML for browser visits."""
    from fastapi.responses import HTMLResponse
    return HTMLResponse(content="""
<!DOCTYPE html>
<html>
<head>
    <title>VARDAx API</title>
    <style>
        body { font-family: system-ui; background: #0f172a; color: #e2e8f0; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
        .container { text-align: center; padding: 40px; }
        h1 { color: #22d3ee; font-size: 3rem; margin-bottom: 10px; }
        p { color: #94a3b8; margin: 10px 0; }
        .status { background: #166534; color: #4ade80; padding: 8px 20px; border-radius: 20px; display: inline-block; margin: 20px 0; }
        a { color: #22d3ee; }
        code { background: #1e293b; padding: 4px 8px; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🛡️ VARDAx</h1>
        <p>ML-Powered WAF Anomaly Detection System</p>
        <div class="status">✓ API Online</div>
        <p>API Endpoint: <code>/api/v1/</code></p>
        <p>Health Check: <a href="/health">/health</a></p>
        <p>Stats: <a href="/api/v1/stats/live">/api/v1/stats/live</a></p>
    </div>
</body>
</html>
    """, status_code=200)


@app.get("/health")
async def health():
    """Detailed health check with dependency verification."""
    from .database import get_db
    from .config import get_settings
    
    health_status = {
        "status": "healthy",
        "components": {
            "api": "up",
            "ml_models": "loaded",
            "feature_extractor": "ready"
        }
    }
    
    # Check database connectivity
    try:
        db = get_db()
        # Try a simple query
        db._execute("SELECT 1")
        health_status["components"]["database"] = "connected"
    except Exception as e:
        health_status["components"]["database"] = f"error: {str(e)}"
        health_status["status"] = "degraded"
    
    # Check Redis connectivity (if configured)
    settings = get_settings()
    if settings.redis_url:
        try:
            import redis
            r = redis.from_url(settings.redis_url)
            r.ping()
            health_status["components"]["redis"] = "connected"
        except Exception as e:
            health_status["components"]["redis"] = f"error: {str(e)}"
            health_status["status"] = "degraded"
    
    return health_status


# Compatibility endpoints for external services
@app.get("/api/health")
async def api_health():
    """Health check at /api/health for compatibility."""
    return {"status": "ok", "service": "vardax"}


@app.post("/api/check")
async def api_check():
    """Check endpoint for compatibility."""
    return {"status": "ok", "service": "vardax"}


@app.get("/api/check")
async def api_check_get():
    """Check endpoint GET for compatibility."""
    return {"status": "ok", "service": "vardax"}
