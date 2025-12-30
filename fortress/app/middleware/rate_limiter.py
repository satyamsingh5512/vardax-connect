"""
Distributed Rate Limiter Middleware
Security: Token bucket algorithm with Redis backend, atomic operations.

NIST Control: SC-5 (Denial of Service Protection)
"""
import os
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.redis_client import get_redis_pool, RateLimiter
from app.core.logging_config import get_logger, audit_logger

logger = get_logger(__name__)


class RateLimiterMiddleware(BaseHTTPMiddleware):
    """
    Distributed rate limiting middleware.
    Security: Prevent resource exhaustion, fair usage enforcement.
    """
    
    # Paths exempt from rate limiting (internal health checks)
    EXEMPT_PATHS = frozenset({"/health", "/ready", "/live", "/metrics"})
    
    def __init__(self, app):
        super().__init__(app)
        self.enabled = os.getenv("RATE_LIMIT_ENABLED", "true").lower() == "true"
        
        # Default limits (can be overridden per-endpoint)
        self.default_capacity = int(os.getenv("RATE_LIMIT_CAPACITY", "100"))
        self.default_refill_rate = float(os.getenv("RATE_LIMIT_REFILL_RATE", "10"))
        
        # Endpoint-specific limits (more restrictive for sensitive endpoints)
        self.endpoint_limits = {
            "/api/auth/login": {"capacity": 5, "refill_rate": 0.1},  # 5 per 50 seconds
            "/api/auth/register": {"capacity": 3, "refill_rate": 0.05},  # 3 per minute
            "/api/auth/reset-password": {"capacity": 3, "refill_rate": 0.05},
            "/api/graphql": {"capacity": 50, "refill_rate": 5},  # GraphQL needs more
        }
        
        self._rate_limiter = None
    
    async def _get_rate_limiter(self) -> RateLimiter:
        """Get or create rate limiter instance."""
        if self._rate_limiter is None:
            redis_client = await get_redis_pool()
            self._rate_limiter = RateLimiter(redis_client)
        return self._rate_limiter
    
    async def dispatch(self, request: Request, call_next):
        if not self.enabled or request.url.path in self.EXEMPT_PATHS:
            return await call_next(request)
        
        client_ip = self._get_client_ip(request)
        correlation_id = getattr(request.state, "correlation_id", None)
        
        # Get limits for this endpoint
        limits = self.endpoint_limits.get(
            request.url.path,
            {"capacity": self.default_capacity, "refill_rate": self.default_refill_rate}
        )
        
        # Create rate limit key (IP + endpoint for granular control)
        rate_key = f"{client_ip}:{request.url.path}"
        
        try:
            rate_limiter = await self._get_rate_limiter()
            allowed, remaining, retry_after = await rate_limiter.check_rate_limit(
                key=rate_key,
                capacity=limits["capacity"],
                refill_rate=limits["refill_rate"],
                tokens_requested=1,
            )
            
            if not allowed:
                # Log rate limit violation
                audit_logger.log_rate_limit_exceeded(
                    client_ip=client_ip,
                    endpoint=request.url.path,
                    limit=limits["capacity"],
                    correlation_id=correlation_id,
                )
                
                logger.warning(
                    "rate_limit_exceeded",
                    extra={
                        "client_ip": client_ip,
                        "endpoint": request.url.path,
                        "retry_after": retry_after,
                        "correlation_id": correlation_id,
                    }
                )
                
                # Increment penalty score for repeat offenders
                await rate_limiter.increment_penalty(client_ip, amount=1)
                
                return JSONResponse(
                    status_code=429,
                    content={
                        "error": "rate_limit_exceeded",
                        "message": "Too many requests",
                        "retry_after": retry_after,
                    },
                    headers={
                        "Retry-After": str(retry_after),
                        "X-RateLimit-Limit": str(limits["capacity"]),
                        "X-RateLimit-Remaining": "0",
                        "X-RateLimit-Reset": str(retry_after),
                    },
                )
            
            # Add rate limit headers to response
            response = await call_next(request)
            response.headers["X-RateLimit-Limit"] = str(limits["capacity"])
            response.headers["X-RateLimit-Remaining"] = str(remaining)
            
            return response
            
        except Exception as e:
            # Fail open: if Redis is down, allow request but log
            logger.error(
                "rate_limiter_error",
                extra={
                    "error": str(e),
                    "client_ip": client_ip,
                    "correlation_id": correlation_id,
                }
            )
            # Security decision: fail open to maintain availability
            # In high-security environments, consider fail-closed
            return await call_next(request)
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP from request."""
        forwarded = request.headers.get("x-forwarded-for", "")
        if forwarded:
            return forwarded.split(",")[0].strip()
        if request.client:
            return request.client.host
        return "unknown"
