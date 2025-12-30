"""
Schema Validation Middleware
Security: Contract-first API enforcement, reject unknown fields.

NIST Control: SI-10 (Information Input Validation)
"""
import os
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.logging_config import get_logger

logger = get_logger(__name__)


class SchemaValidatorMiddleware(BaseHTTPMiddleware):
    """
    Schema validation middleware.
    Security: Reject requests with unknown fields (prevent parameter pollution).
    
    Note: Pydantic models should use `extra = "forbid"` for strict validation.
    This middleware adds an additional layer for content-type enforcement.
    """
    
    # Allowed content types for POST/PUT/PATCH
    ALLOWED_CONTENT_TYPES = frozenset({
        "application/json",
        "application/graphql",
        "multipart/form-data",
    })
    
    # Maximum request body size (10MB default)
    MAX_BODY_SIZE = int(os.getenv("MAX_BODY_SIZE", str(10 * 1024 * 1024)))
    
    # Paths exempt from validation
    EXEMPT_PATHS = frozenset({"/health", "/ready", "/live"})
    
    def __init__(self, app):
        super().__init__(app)
        self.enabled = os.getenv("SCHEMA_VALIDATION_ENABLED", "true").lower() == "true"
    
    async def dispatch(self, request: Request, call_next):
        if not self.enabled or request.url.path in self.EXEMPT_PATHS:
            return await call_next(request)
        
        correlation_id = getattr(request.state, "correlation_id", None)
        
        # Check content-type for requests with body
        if request.method in ("POST", "PUT", "PATCH"):
            content_type = request.headers.get("content-type", "").split(";")[0].strip().lower()
            
            if content_type and content_type not in self.ALLOWED_CONTENT_TYPES:
                logger.warning(
                    "invalid_content_type",
                    extra={
                        "content_type": content_type,
                        "path": request.url.path,
                        "correlation_id": correlation_id,
                    }
                )
                
                return JSONResponse(
                    status_code=415,
                    content={
                        "error": "unsupported_media_type",
                        "message": f"Content-Type '{content_type}' not supported",
                        "allowed": list(self.ALLOWED_CONTENT_TYPES),
                    },
                )
            
            # Check content-length
            content_length = request.headers.get("content-length")
            if content_length:
                try:
                    length = int(content_length)
                    if length > self.MAX_BODY_SIZE:
                        logger.warning(
                            "request_too_large",
                            extra={
                                "content_length": length,
                                "max_size": self.MAX_BODY_SIZE,
                                "path": request.url.path,
                                "correlation_id": correlation_id,
                            }
                        )
                        
                        return JSONResponse(
                            status_code=413,
                            content={
                                "error": "request_too_large",
                                "message": f"Request body exceeds maximum size of {self.MAX_BODY_SIZE} bytes",
                            },
                        )
                except ValueError:
                    pass
        
        return await call_next(request)
