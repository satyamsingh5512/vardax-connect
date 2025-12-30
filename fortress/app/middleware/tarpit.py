"""
Tarpit / Penalty Box Middleware
Security: Progressive delays for suspicious clients, waste attacker resources.

Tarpit Strategy:
- Track penalty scores per client IP
- Apply exponential backoff delays based on score
- Non-blocking async delays (don't tie up workers)
- Maximum delay cap to prevent indefinite blocking

NIST Control: SC-5 (Denial of Service Protection), SI-4 (Information System Monitoring)
"""
import os
import asyncio
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.redis_client import get_redis_pool, RateLimiter
from app.core.logging_config import get_logger, audit_logger

logger = get_logger(__name__)


class TarpitMiddleware(BaseHTTPMiddleware):
    """
    Tarpit middleware for suspicious clients.
    Security: Slow down attackers, waste their resources, collect intelligence.
    """
    
    # Paths exempt from tarpit (internal endpoints)
    EXEMPT_PATHS = frozenset({"/health", "/ready", "/live"})
    
    def __init__(self, app):
        super().__init__(app)
        self.enabled = os.getenv("TARPIT_ENABLED", "true").lower() == "true"
        
        # Delay configuration
        self.base_delay_ms = int(os.getenv("TARPIT_BASE_DELAY_MS", "100"))
        self.max_delay_ms = int(os.getenv("TARPIT_MAX_DELAY_MS", "30000"))  # 30 seconds max
        self.penalty_threshold = int(os.getenv("TARPIT_PENALTY_THRESHOLD", "3"))
        
        # Block threshold (permanent block after this score)
        self.block_threshold = int(os.getenv("TARPIT_BLOCK_THRESHOLD", "50"))
        
        self._rate_limiter = None
    
    async def _get_rate_limiter(self) -> RateLimiter:
        """Get rate limiter for penalty score access."""
        if self._rate_limiter is None:
            redis_client = await get_redis_pool()
            self._rate_limiter = RateLimiter(redis_client)
        return self._rate_limiter
    
    async def dispatch(self, request: Request, call_next):
        if not self.enabled or request.url.path in self.EXEMPT_PATHS:
            return await call_next(request)
        
        client_ip = self._get_client_ip(request)
        correlation_id = getattr(request.state, "correlation_id", None)
        
        try:
            rate_limiter = await self._get_rate_limiter()
            penalty_score = await rate_limiter.get_penalty_score(client_ip)
            
            # Check if client should be blocked entirely
            if penalty_score >= self.block_threshold:
                logger.warning(
                    "tarpit_blocked",
                    extra={
                        "client_ip": client_ip,
                        "penalty_score": penalty_score,
                        "correlation_id": correlation_id,
                    }
                )
                
                audit_logger.log_access_denied(
                    resource=request.url.path,
                    client_ip=client_ip,
                    reason=f"penalty_threshold_exceeded:{penalty_score}",
                    correlation_id=correlation_id,
                )
                
                return JSONResponse(
                    status_code=403,
                    content={
                        "error": "access_denied",
                        "message": "Access temporarily restricted",
                    },
                )
            
            # Apply tarpit delay if penalty score exceeds threshold
            if penalty_score >= self.penalty_threshold:
                delay_ms = self._calculate_delay(penalty_score)
                
                logger.info(
                    "tarpit_delay_applied",
                    extra={
                        "client_ip": client_ip,
                        "penalty_score": penalty_score,
                        "delay_ms": delay_ms,
                        "correlation_id": correlation_id,
                    }
                )
                
                # Non-blocking async delay
                await asyncio.sleep(delay_ms / 1000.0)
                
                # Store tarpit info in request state for downstream logging
                request.state.tarpit_delay_ms = delay_ms
                request.state.tarpit_penalty_score = penalty_score
            
            return await call_next(request)
            
        except Exception as e:
            # Fail open: if Redis is down, skip tarpit
            logger.error(
                "tarpit_error",
                extra={
                    "error": str(e),
                    "client_ip": client_ip,
                    "correlation_id": correlation_id,
                }
            )
            return await call_next(request)
    
    def _calculate_delay(self, penalty_score: int) -> int:
        """
        Calculate delay based on penalty score.
        Security: Exponential backoff, capped at maximum.
        
        Formula: base_delay * 2^(score - threshold)
        """
        if penalty_score < self.penalty_threshold:
            return 0
        
        exponent = penalty_score - self.penalty_threshold
        delay = self.base_delay_ms * (2 ** exponent)
        
        # Cap at maximum delay
        return min(delay, self.max_delay_ms)
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP from request."""
        forwarded = request.headers.get("x-forwarded-for", "")
        if forwarded:
            return forwarded.split(",")[0].strip()
        if request.client:
            return request.client.host
        return "unknown"


class TarpitManager:
    """
    Manager for tarpit operations.
    Security: Centralized control for penalty management.
    """
    
    def __init__(self, redis_client):
        self.redis = redis_client
    
    async def add_to_penalty_box(self, client_ip: str, reason: str, 
                                  penalty_points: int = 10) -> int:
        """
        Add client to penalty box with specified points.
        Security: Manual escalation for detected threats.
        """
        key = f"penalty:{client_ip}"
        new_score = await self.redis.incrby(key, penalty_points)
        await self.redis.expire(key, 3600)  # 1 hour TTL
        
        # Store reason for forensics
        await self.redis.lpush(f"penalty_reasons:{client_ip}", f"{reason}")
        await self.redis.ltrim(f"penalty_reasons:{client_ip}", 0, 99)  # Keep last 100
        await self.redis.expire(f"penalty_reasons:{client_ip}", 3600)
        
        logger.info(
            "penalty_added",
            extra={
                "client_ip": client_ip,
                "reason": reason,
                "points_added": penalty_points,
                "new_score": new_score,
            }
        )
        
        return new_score
    
    async def remove_from_penalty_box(self, client_ip: str) -> None:
        """
        Remove client from penalty box.
        Security: Manual release for false positives.
        """
        await self.redis.delete(f"penalty:{client_ip}")
        await self.redis.delete(f"penalty_reasons:{client_ip}")
        
        logger.info(
            "penalty_removed",
            extra={"client_ip": client_ip}
        )
    
    async def get_penalty_info(self, client_ip: str) -> dict:
        """Get penalty information for a client."""
        score = await self.redis.get(f"penalty:{client_ip}")
        reasons = await self.redis.lrange(f"penalty_reasons:{client_ip}", 0, -1)
        
        return {
            "client_ip": client_ip,
            "penalty_score": int(score) if score else 0,
            "reasons": reasons,
        }
