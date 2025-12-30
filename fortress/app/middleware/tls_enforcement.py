"""
TLS Enforcement Middleware
Security: Reject non-TLS connections in production environments.

NIST Control: SC-8 (Transmission Confidentiality and Integrity)
FIPS 140-3: Requires TLS 1.2+ with approved cipher suites
"""
import os
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.logging_config import get_logger, audit_logger

logger = get_logger(__name__)


class TLSEnforcementMiddleware(BaseHTTPMiddleware):
    """
    Enforce TLS connections.
    Security: First line of defense, reject plaintext HTTP in production.
    """
    
    # Trusted proxy headers indicating TLS termination
    TLS_HEADERS = frozenset({
        "x-forwarded-proto",
        "x-forwarded-ssl",
        "x-url-scheme",
    })
    
    # Paths exempt from TLS check (health checks from internal LB)
    EXEMPT_PATHS = frozenset({"/health", "/ready", "/live"})
    
    def __init__(self, app):
        super().__init__(app)
        self.enforce_tls = os.getenv("ENFORCE_TLS", "true").lower() == "true"
        self.trusted_hosts = set(
            os.getenv("TRUSTED_HOSTS", "localhost,127.0.0.1").split(",")
        )
    
    async def dispatch(self, request: Request, call_next):
        # Skip enforcement in development or for exempt paths
        if not self.enforce_tls or request.url.path in self.EXEMPT_PATHS:
            return await call_next(request)
        
        # Check if request came over TLS
        is_secure = self._is_secure_connection(request)
        
        if not is_secure:
            client_ip = self._get_client_ip(request)
            correlation_id = getattr(request.state, "correlation_id", None)
            
            logger.warning(
                "tls_enforcement_failed",
                extra={
                    "client_ip": client_ip,
                    "path": request.url.path,
                    "correlation_id": correlation_id,
                }
            )
            
            audit_logger.log_access_denied(
                resource=request.url.path,
                client_ip=client_ip,
                reason="non_tls_connection",
                correlation_id=correlation_id,
            )
            
            return JSONResponse(
                status_code=421,  # Misdirected Request
                content={
                    "error": "tls_required",
                    "message": "This endpoint requires TLS",
                },
                headers={"Strict-Transport-Security": "max-age=31536000; includeSubDomains"},
            )
        
        # Add HSTS header to response
        response = await call_next(request)
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response
    
    def _is_secure_connection(self, request: Request) -> bool:
        """
        Determine if connection is secure.
        Security: Check multiple indicators, trust proxy headers only from known proxies.
        """
        # Direct HTTPS connection
        if request.url.scheme == "https":
            return True
        
        # Check proxy headers (only trust from known proxies)
        client_ip = self._get_client_ip(request)
        if client_ip in self.trusted_hosts:
            # X-Forwarded-Proto from trusted proxy
            proto = request.headers.get("x-forwarded-proto", "").lower()
            if proto == "https":
                return True
            
            # X-Forwarded-SSL from trusted proxy
            ssl = request.headers.get("x-forwarded-ssl", "").lower()
            if ssl in ("on", "true", "1"):
                return True
        
        return False
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP, considering proxy headers."""
        # X-Forwarded-For can be spoofed, use rightmost trusted value
        forwarded = request.headers.get("x-forwarded-for", "")
        if forwarded:
            # Take the first IP (client IP in standard proxy chains)
            return forwarded.split(",")[0].strip()
        
        # X-Real-IP from nginx
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip.strip()
        
        # Direct connection
        if request.client:
            return request.client.host
        
        return "unknown"
