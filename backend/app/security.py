"""
Security middleware and utilities for VARDAx.

Implements:
1. API key authentication for Nginx → ML API calls
2. JWT authentication for dashboard
3. Rate limiting on inference API
4. Request signing/verification
5. IP allowlisting for admin endpoints
"""
import hashlib
import hmac
import time
from typing import Optional
from datetime import datetime, timedelta

from fastapi import HTTPException, Security, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials, APIKeyHeader
from jose import JWTError, jwt
from pydantic import BaseModel

from .config import get_settings

settings = get_settings()

# Security schemes
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
bearer_scheme = HTTPBearer(auto_error=False)


# ============================================================================
# API KEY AUTHENTICATION (for Nginx → ML API)
# ============================================================================

async def verify_api_key(api_key: str = Security(api_key_header)) -> bool:
    """
    Verify API key from Nginx Lua scripts.
    
    This prevents unauthorized access to the ML inference API.
    """
    if not api_key:
        raise HTTPException(
            status_code=401,
            detail="Missing API key"
        )
    
    expected_key = settings.jwt_secret  # In production, use separate API key
    
    if not hmac.compare_digest(api_key, expected_key):
        raise HTTPException(
            status_code=403,
            detail="Invalid API key"
        )
    
    return True


# ============================================================================
# JWT AUTHENTICATION (for Dashboard)
# ============================================================================

class TokenData(BaseModel):
    """JWT token payload."""
    username: str
    role: str
    exp: datetime


def create_access_token(username: str, role: str = "analyst") -> str:
    """
    Create JWT access token for dashboard users.
    
    Args:
        username: User identifier
        role: User role (analyst, admin)
    
    Returns:
        JWT token string
    """
    expire = datetime.utcnow() + timedelta(hours=settings.jwt_expiry_hours)
    
    payload = {
        "sub": username,
        "role": role,
        "exp": expire,
        "iat": datetime.utcnow()
    }
    
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token


async def verify_jwt_token(
    credentials: HTTPAuthorizationCredentials = Security(bearer_scheme)
) -> TokenData:
    """
    Verify JWT token from dashboard requests.
    
    Raises:
        HTTPException: If token is invalid or expired
    """
    if not credentials:
        raise HTTPException(
            status_code=401,
            detail="Missing authentication token"
        )
    
    token = credentials.credentials
    
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm]
        )
        
        username = payload.get("sub")
        role = payload.get("role", "analyst")
        exp = datetime.fromtimestamp(payload.get("exp"))
        
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        
        return TokenData(username=username, role=role, exp=exp)
        
    except JWTError as e:
        raise HTTPException(
            status_code=401,
            detail=f"Invalid token: {str(e)}"
        )


async def require_admin(token_data: TokenData = Depends(verify_jwt_token)) -> TokenData:
    """
    Require admin role for sensitive operations.
    
    Use as dependency for admin-only endpoints.
    """
    if token_data.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin role required"
        )
    return token_data


# ============================================================================
# REQUEST SIGNING (for high-security deployments)
# ============================================================================

def sign_request(payload: str, secret: str) -> str:
    """
    Sign a request payload with HMAC-SHA256.
    
    Args:
        payload: Request body as string
        secret: Shared secret key
    
    Returns:
        Hex-encoded signature
    """
    signature = hmac.new(
        secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    
    return signature


async def verify_request_signature(request: Request) -> bool:
    """
    Verify HMAC signature of incoming request.
    
    Expects X-Signature header with HMAC-SHA256 of request body.
    """
    signature_header = request.headers.get("X-Signature")
    
    if not signature_header:
        raise HTTPException(
            status_code=401,
            detail="Missing request signature"
        )
    
    body = await request.body()
    expected_signature = sign_request(body.decode(), settings.jwt_secret)
    
    if not hmac.compare_digest(signature_header, expected_signature):
        raise HTTPException(
            status_code=403,
            detail="Invalid request signature"
        )
    
    return True


# ============================================================================
# RATE LIMITING
# ============================================================================

class RateLimiter:
    """
    Simple in-memory rate limiter.
    
    In production, use Redis-backed rate limiting.
    """
    
    def __init__(self, max_requests: int = 100, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests: dict = {}  # {client_id: [timestamps]}
    
    def is_allowed(self, client_id: str) -> bool:
        """
        Check if client is within rate limit.
        
        Args:
            client_id: Client identifier (IP, API key, etc.)
        
        Returns:
            True if allowed, False if rate limited
        """
        now = time.time()
        cutoff = now - self.window_seconds
        
        # Clean old timestamps
        if client_id in self.requests:
            self.requests[client_id] = [
                ts for ts in self.requests[client_id]
                if ts > cutoff
            ]
        else:
            self.requests[client_id] = []
        
        # Check limit
        if len(self.requests[client_id]) >= self.max_requests:
            return False
        
        # Add current request
        self.requests[client_id].append(now)
        return True


# Global rate limiter for ML inference API
ml_inference_limiter = RateLimiter(max_requests=1000, window_seconds=60)


async def check_rate_limit(request: Request):
    """
    Rate limit middleware for ML inference API.
    
    Prevents abuse of the inference endpoint.
    """
    client_ip = request.client.host
    
    if not ml_inference_limiter.is_allowed(client_ip):
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Try again later."
        )


# ============================================================================
# IP ALLOWLISTING
# ============================================================================

ADMIN_ALLOWED_IPS = [
    "127.0.0.1",
    "::1",
    # Add your admin IPs here
]


async def check_admin_ip(request: Request):
    """
    Verify request comes from allowed admin IP.
    
    Use for sensitive admin endpoints.
    """
    client_ip = request.client.host
    
    if client_ip not in ADMIN_ALLOWED_IPS:
        raise HTTPException(
            status_code=403,
            detail="Access denied from this IP address"
        )


# ============================================================================
# SECURITY HEADERS MIDDLEWARE
# ============================================================================

async def add_security_headers(request: Request, call_next):
    """
    Add security headers to all responses.
    
    Implements OWASP security best practices.
    """
    response = await call_next(request)
    
    # Security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = "default-src 'self'"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    
    return response


# ============================================================================
# AUDIT LOGGING
# ============================================================================

class AuditLogger:
    """
    Audit logger for security-sensitive operations.
    
    Logs:
    - Authentication attempts
    - Rule approvals/rejections
    - Model deployments
    - Configuration changes
    """
    
    @staticmethod
    def log_auth_attempt(username: str, success: bool, ip: str):
        """Log authentication attempt."""
        import logging
        logger = logging.getLogger("audit")
        
        status = "SUCCESS" if success else "FAILED"
        logger.info(f"AUTH {status}: user={username} ip={ip}")
    
    @staticmethod
    def log_rule_action(rule_id: str, action: str, user: str):
        """Log rule approval/rejection."""
        import logging
        logger = logging.getLogger("audit")
        
        logger.info(f"RULE {action}: rule_id={rule_id} user={user}")
    
    @staticmethod
    def log_model_deployment(version: str, user: str):
        """Log model deployment."""
        import logging
        logger = logging.getLogger("audit")
        
        logger.info(f"MODEL DEPLOY: version={version} user={user}")
    
    @staticmethod
    def log_config_change(setting: str, old_value: str, new_value: str, user: str):
        """Log configuration change."""
        import logging
        logger = logging.getLogger("audit")
        
        logger.info(f"CONFIG CHANGE: setting={setting} old={old_value} new={new_value} user={user}")


audit_logger = AuditLogger()
