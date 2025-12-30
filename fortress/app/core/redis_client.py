"""
Redis Client with Connection Pooling
Security: Centralized Redis access, connection limits, timeout enforcement.

NIST Control: SC-8 (Transmission Confidentiality and Integrity)
"""
import os
from typing import Optional
import redis.asyncio as redis
from redis.asyncio.connection import ConnectionPool

from app.core.logging_config import get_logger

logger = get_logger(__name__)

# Global connection pool (singleton pattern)
_redis_pool: Optional[ConnectionPool] = None
_redis_client: Optional[redis.Redis] = None


async def get_redis_pool() -> redis.Redis:
    """
    Get or create Redis connection pool.
    Security: Connection pooling prevents resource exhaustion attacks.
    """
    global _redis_pool, _redis_client
    
    if _redis_client is None:
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        
        # Security: Limit connections to prevent resource exhaustion
        _redis_pool = ConnectionPool.from_url(
            redis_url,
            max_connections=50,
            socket_timeout=5.0,
            socket_connect_timeout=5.0,
            retry_on_timeout=True,
            decode_responses=True,
        )
        
        _redis_client = redis.Redis(connection_pool=_redis_pool)
        
        # Verify connection
        try:
            await _redis_client.ping()
            logger.info("redis_connected", extra={"url": redis_url.split("@")[-1]})
        except redis.ConnectionError as e:
            logger.error("redis_connection_failed", extra={"error": str(e)})
            raise
    
    return _redis_client


async def close_redis_pool() -> None:
    """Close Redis connection pool gracefully."""
    global _redis_pool, _redis_client
    
    if _redis_client:
        await _redis_client.close()
        _redis_client = None
    
    if _redis_pool:
        await _redis_pool.disconnect()
        _redis_pool = None
    
    logger.info("redis_disconnected")


# Lua script for atomic token bucket rate limiting
# Security: Atomic operations prevent race conditions in distributed systems
# CRDT-like pattern: eventual consistency with local counters
RATE_LIMIT_LUA_SCRIPT = """
-- Token Bucket Rate Limiter (Atomic)
-- KEYS[1] = bucket key
-- ARGV[1] = max tokens (capacity)
-- ARGV[2] = refill rate (tokens per second)
-- ARGV[3] = current timestamp (milliseconds)
-- ARGV[4] = tokens to consume

local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])

-- Get current bucket state
local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(bucket[1])
local last_refill = tonumber(bucket[2])

-- Initialize bucket if not exists
if tokens == nil then
    tokens = capacity
    last_refill = now
end

-- Calculate tokens to add based on elapsed time
local elapsed = (now - last_refill) / 1000.0
local tokens_to_add = elapsed * refill_rate
tokens = math.min(capacity, tokens + tokens_to_add)

-- Check if request can be fulfilled
local allowed = 0
local remaining = tokens

if tokens >= requested then
    tokens = tokens - requested
    allowed = 1
    remaining = tokens
end

-- Update bucket state
redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
redis.call('EXPIRE', key, 3600)  -- TTL: 1 hour

-- Return: allowed (0/1), remaining tokens, retry_after (seconds)
local retry_after = 0
if allowed == 0 then
    retry_after = math.ceil((requested - tokens) / refill_rate)
end

return {allowed, math.floor(remaining), retry_after}
"""


class RateLimiter:
    """
    Distributed rate limiter using Redis and Lua.
    Security: Atomic operations, no race conditions, CRDT-compatible.
    NIST Control: SC-5 (Denial of Service Protection)
    """
    
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        self._script_sha: Optional[str] = None
    
    async def _ensure_script_loaded(self) -> str:
        """Load Lua script into Redis (cached)."""
        if self._script_sha is None:
            self._script_sha = await self.redis.script_load(RATE_LIMIT_LUA_SCRIPT)
        return self._script_sha
    
    async def check_rate_limit(
        self,
        key: str,
        capacity: int = 100,
        refill_rate: float = 10.0,
        tokens_requested: int = 1
    ) -> tuple[bool, int, int]:
        """
        Check if request is within rate limit.
        
        Args:
            key: Unique identifier (e.g., client IP, user ID)
            capacity: Maximum tokens in bucket
            refill_rate: Tokens added per second
            tokens_requested: Tokens to consume for this request
        
        Returns:
            Tuple of (allowed: bool, remaining: int, retry_after: int)
        
        Security: Atomic check-and-decrement prevents race conditions.
        """
        import time
        
        script_sha = await self._ensure_script_loaded()
        now_ms = int(time.time() * 1000)
        
        try:
            result = await self.redis.evalsha(
                script_sha,
                1,  # Number of keys
                f"ratelimit:{key}",
                capacity,
                refill_rate,
                now_ms,
                tokens_requested,
            )
            
            allowed = bool(result[0])
            remaining = int(result[1])
            retry_after = int(result[2])
            
            return allowed, remaining, retry_after
            
        except redis.NoScriptError:
            # Script evicted, reload and retry
            self._script_sha = None
            return await self.check_rate_limit(key, capacity, refill_rate, tokens_requested)
    
    async def get_penalty_score(self, client_ip: str) -> int:
        """
        Get accumulated penalty score for a client.
        Security: Track repeat offenders for progressive penalties.
        """
        score = await self.redis.get(f"penalty:{client_ip}")
        return int(score) if score else 0
    
    async def increment_penalty(self, client_ip: str, amount: int = 1) -> int:
        """
        Increment penalty score for a client.
        Security: Progressive penalties for repeat offenders.
        """
        key = f"penalty:{client_ip}"
        new_score = await self.redis.incrby(key, amount)
        await self.redis.expire(key, 3600)  # Reset after 1 hour
        return new_score
