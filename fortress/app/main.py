"""
Fortress Main Application
Defense-grade FastAPI application with security middleware stack.

Security Rationale:
- Middleware order matters: TLS check -> JA4+ -> Rate limit -> Tarpit -> mTLS -> App
- Each layer can reject requests independently (defense in depth)
- All failures are logged with correlation IDs for forensics
- No sensitive data in logs (redacted by design)
"""
import os
import uuid
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.middleware.tls_enforcement import TLSEnforcementMiddleware
from app.middleware.ja4_fingerprint import JA4FingerprintMiddleware
from app.middleware.rate_limiter import RateLimiterMiddleware
from app.middleware.tarpit import TarpitMiddleware
from app.middleware.mtls_validator import MTLSValidatorMiddleware
from app.middleware.schema_validator import SchemaValidatorMiddleware
from app.middleware.honeytoken import HoneytokenMiddleware
from app.core.redis_client import get_redis_pool, close_redis_pool
from app.core.logging_config import setup_logging, get_logger
from app.api import routes

# Initialize structured logging
setup_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    """
    Application lifespan manager.
    Security: Initialize connections at startup, clean shutdown on exit.
    """
    logger.info("fortress_startup", extra={"event": "initializing_services"})
    
    # Initialize Redis connection pool
    await get_redis_pool()
    logger.info("fortress_startup", extra={"event": "redis_connected"})
    
    yield
    
    # Cleanup on shutdown
    await close_redis_pool()
    logger.info("fortress_shutdown", extra={"event": "services_terminated"})


def create_app() -> FastAPI:
    """
    Factory function for FastAPI application.
    Security: Explicit middleware ordering, no default trust.
    """
    app = FastAPI(
        title="VARDAx Fortress",
        description="Defense-grade security middleware stack",
        version="1.0.0",
        docs_url="/docs" if os.getenv("ENABLE_DOCS", "false") == "true" else None,
        redoc_url=None,  # Disable ReDoc (reduce attack surface)
        openapi_url="/openapi.json" if os.getenv("ENABLE_DOCS", "false") == "true" else None,
        lifespan=lifespan,
    )
    
    # Correlation ID middleware (must be first)
    @app.middleware("http")
    async def add_correlation_id(request: Request, call_next):
        """Inject correlation ID for request tracing."""
        correlation_id = request.headers.get("X-Correlation-ID", str(uuid.uuid4()))
        request.state.correlation_id = correlation_id
        response = await call_next(request)
        response.headers["X-Correlation-ID"] = correlation_id
        return response
    
    # Security middleware stack (order is critical)
    # Layer 1: TLS enforcement (reject non-TLS in production)
    app.add_middleware(TLSEnforcementMiddleware)
    
    # Layer 2: JA4+ fingerprint validation
    app.add_middleware(JA4FingerprintMiddleware)
    
    # Layer 3: Distributed rate limiting
    app.add_middleware(RateLimiterMiddleware)
    
    # Layer 4: Tarpit for suspicious clients
    app.add_middleware(TarpitMiddleware)
    
    # Layer 5: mTLS client certificate validation
    app.add_middleware(MTLSValidatorMiddleware)
    
    # Layer 6: Schema validation (reject unknown fields)
    app.add_middleware(SchemaValidatorMiddleware)
    
    # Layer 7: Honeytoken detection
    app.add_middleware(HoneytokenMiddleware)
    
    # CORS (restrictive by default)
    allowed_origins = os.getenv("ALLOWED_ORIGINS", "").split(",")
    if allowed_origins and allowed_origins[0]:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=allowed_origins,
            allow_credentials=True,
            allow_methods=["GET", "POST", "PUT", "DELETE"],
            allow_headers=["Authorization", "Content-Type", "X-Correlation-ID"],
            max_age=3600,
        )
    
    # Include API routes
    app.include_router(routes.router)
    
    return app


app = create_app()


@app.get("/health")
async def health_check():
    """
    Health check endpoint.
    Security: Minimal information disclosure, no internal state exposed.
    """
    return {"status": "operational", "version": "1.0.0"}
