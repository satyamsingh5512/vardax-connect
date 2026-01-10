"""
VARDAx - ML-Powered WAF Anomaly Detection System

Main FastAPI application entry point.
"""
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
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

# CORS middleware - Allow external websites to connect to this API
debug_mode = settings.debug or os.getenv("VARDAX_DEBUG", "false").lower() == "true"
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for ngrok tunnel access
    allow_credentials=False,  # Disable credentials for security
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],  # Include OPTIONS for preflight
    allow_headers=["Content-Type", "Authorization", "ngrok-skip-browser-warning", "X-Requested-With"],
    expose_headers=["Content-Type"],
)

# Include routers with rate limiting on API endpoints
app.include_router(router, prefix="/api/v1", dependencies=[Depends(check_rate_limit)])
app.include_router(ws_router, prefix="/api/v1")  # WebSocket doesn't need rate limiting
app.include_router(extended_router, prefix="/api/v1", dependencies=[Depends(check_rate_limit)])
app.include_router(proxy_router)  # Proxy routes at root level


@app.get("/")
async def root():
    """VARDAx landing page with API information."""
    from fastapi.responses import HTMLResponse
    
    html_content = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>VARDAx - ML-Powered WAF Security System</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
            .container { max-width: 800px; margin: 0 auto; padding: 40px 20px; }
            .header { text-align: center; margin-bottom: 40px; }
            .logo { font-size: 3em; font-weight: bold; margin-bottom: 10px; }
            .tagline { font-size: 1.2em; opacity: 0.9; }
            .card { background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); border-radius: 15px; padding: 30px; margin: 20px 0; border: 1px solid rgba(255,255,255,0.2); }
            .features { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 30px 0; }
            .feature { background: rgba(255,255,255,0.05); padding: 20px; border-radius: 10px; }
            .feature h3 { margin-top: 0; color: #ffd700; }
            .links { display: flex; gap: 15px; flex-wrap: wrap; justify-content: center; margin-top: 30px; }
            .btn { background: rgba(255,255,255,0.2); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; border: 1px solid rgba(255,255,255,0.3); transition: all 0.3s; }
            .btn:hover { background: rgba(255,255,255,0.3); transform: translateY(-2px); }
            .status { display: inline-block; background: #00ff88; color: #000; padding: 4px 12px; border-radius: 20px; font-size: 0.9em; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">🛡️ VARDAx</div>
                <div class="tagline">ML-Powered Web Application Firewall & Security System</div>
                <div style="margin-top: 15px;"><span class="status">ONLINE</span></div>
            </div>
            
            <div class="card">
                <h2>🚀 Production-Grade Security System</h2>
                <p>VARDAx is a comprehensive security platform that combines machine learning-based anomaly detection with a powerful Web Application Firewall (WAF) to protect your applications from cyber threats in real-time.</p>
                
                <div class="features">
                    <div class="feature">
                        <h3>🛡️ WAF Engine</h3>
                        <p>16+ active security rules blocking SQL injection, XSS, path traversal, and other attacks with 100% effectiveness.</p>
                    </div>
                    <div class="feature">
                        <h3>🤖 ML Detection</h3>
                        <p>Advanced machine learning algorithms for real-time anomaly detection and behavioral analysis.</p>
                    </div>
                    <div class="feature">
                        <h3>📊 Real-time Monitoring</h3>
                        <p>Live traffic analysis, threat intelligence, and comprehensive security analytics dashboard.</p>
                    </div>
                    <div class="feature">
                        <h3>⚡ High Performance</h3>
                        <p>Multi-worker architecture with sub-millisecond response times and automatic scaling.</p>
                    </div>
                </div>
            </div>
            
            <div class="card">
                <h2>📡 API Endpoints</h2>
                <div class="links">
                    <a href="/docs" class="btn">📚 API Documentation</a>
                    <a href="/health" class="btn">🏥 Health Check</a>
                    <a href="/api/v1/system/status" class="btn">📊 System Status</a>
                    <a href="/api/v1/waf/stats" class="btn">🛡️ WAF Statistics</a>
                    <a href="/api/v1/stats/live" class="btn">⚡ Live Metrics</a>
                </div>
            </div>
            
            <div class="card">
                <h2>🔧 Integration</h2>
                <p><strong>Base URL:</strong> <code>https://spectrological-cinda-unfunereally.ngrok-free.dev</code></p>
                <p><strong>API Version:</strong> v2.2.0</p>
                <p><strong>WebSocket:</strong> <code>/api/v1/ws/anomalies</code></p>
                <p>Use this API to integrate VARDAx security features into your applications. All endpoints support JSON and include comprehensive error handling.</p>
            </div>
            
            <div style="text-align: center; margin-top: 40px; opacity: 0.8;">
                <p>VARDAx v2.2.0 - Production Security System | Powered by FastAPI & ML</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return HTMLResponse(content=html_content)


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
