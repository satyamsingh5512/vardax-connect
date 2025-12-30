"""
Rate Limiter Tests
Security: Verify rate limiting behavior under various conditions.
"""
import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
import time

from app.core.redis_client import RateLimiter, RATE_LIMIT_LUA_SCRIPT


class MockRedis:
    """Mock Redis client for testing."""
    
    def __init__(self):
        self.data = {}
        self.scripts = {}
        self._script_counter = 0
    
    async def script_load(self, script: str) -> str:
        """Load a Lua script and return SHA."""
        sha = f"sha_{self._script_counter}"
        self._script_counter += 1
        self.scripts[sha] = script
        return sha
    
    async def evalsha(self, sha: str, num_keys: int, *args):
        """Execute Lua script (simplified simulation)."""
        # Simulate token bucket behavior
        key = args[0]
        capacity = int(args[1])
        refill_rate = float(args[2])
        now_ms = int(args[3])
        requested = int(args[4])
        
        # Get or initialize bucket
        if key not in self.data:
            self.data[key] = {"tokens": capacity, "last_refill": now_ms}
        
        bucket = self.data[key]
        
        # Calculate refill
        elapsed = (now_ms - bucket["last_refill"]) / 1000.0
        tokens_to_add = elapsed * refill_rate
        bucket["tokens"] = min(capacity, bucket["tokens"] + tokens_to_add)
        bucket["last_refill"] = now_ms
        
        # Check if request can be fulfilled
        if bucket["tokens"] >= requested:
            bucket["tokens"] -= requested
            return [1, int(bucket["tokens"]), 0]
        else:
            retry_after = int((requested - bucket["tokens"]) / refill_rate)
            return [0, int(bucket["tokens"]), retry_after]
    
    async def get(self, key: str):
        """Get value from mock storage."""
        return self.data.get(key)
    
    async def incrby(self, key: str, amount: int):
        """Increment value."""
        if key not in self.data:
            self.data[key] = 0
        self.data[key] += amount
        return self.data[key]
    
    async def expire(self, key: str, seconds: int):
        """Set expiry (no-op in mock)."""
        pass


@pytest.fixture
def mock_redis():
    """Create mock Redis client."""
    return MockRedis()


@pytest.fixture
def rate_limiter(mock_redis):
    """Create rate limiter with mock Redis."""
    return RateLimiter(mock_redis)


class TestRateLimiter:
    """Test suite for rate limiter."""
    
    @pytest.mark.asyncio
    async def test_allows_requests_within_limit(self, rate_limiter):
        """Requests within limit should be allowed."""
        # First request should be allowed
        allowed, remaining, retry_after = await rate_limiter.check_rate_limit(
            key="test_client",
            capacity=10,
            refill_rate=1.0,
            tokens_requested=1,
        )
        
        assert allowed is True
        assert remaining == 9
        assert retry_after == 0
    
    @pytest.mark.asyncio
    async def test_blocks_requests_exceeding_limit(self, rate_limiter):
        """Requests exceeding limit should be blocked."""
        # Exhaust the bucket
        for _ in range(10):
            await rate_limiter.check_rate_limit(
                key="test_client",
                capacity=10,
                refill_rate=0.1,  # Slow refill
                tokens_requested=1,
            )
        
        # Next request should be blocked
        allowed, remaining, retry_after = await rate_limiter.check_rate_limit(
            key="test_client",
            capacity=10,
            refill_rate=0.1,
            tokens_requested=1,
        )
        
        assert allowed is False
        assert remaining == 0
        assert retry_after > 0
    
    @pytest.mark.asyncio
    async def test_refills_over_time(self, rate_limiter, mock_redis):
        """Bucket should refill over time."""
        # Exhaust the bucket
        for _ in range(5):
            await rate_limiter.check_rate_limit(
                key="test_client",
                capacity=5,
                refill_rate=10.0,  # Fast refill
                tokens_requested=1,
            )
        
        # Simulate time passing (modify mock data)
        key = "ratelimit:test_client"
        if key in mock_redis.data:
            mock_redis.data[key]["last_refill"] -= 1000  # 1 second ago
        
        # Should have refilled
        allowed, remaining, _ = await rate_limiter.check_rate_limit(
            key="test_client",
            capacity=5,
            refill_rate=10.0,
            tokens_requested=1,
        )
        
        assert allowed is True
    
    @pytest.mark.asyncio
    async def test_different_keys_independent(self, rate_limiter):
        """Different keys should have independent limits."""
        # Exhaust one key
        for _ in range(5):
            await rate_limiter.check_rate_limit(
                key="client_a",
                capacity=5,
                refill_rate=0.1,
                tokens_requested=1,
            )
        
        # Other key should still work
        allowed, _, _ = await rate_limiter.check_rate_limit(
            key="client_b",
            capacity=5,
            refill_rate=0.1,
            tokens_requested=1,
        )
        
        assert allowed is True
    
    @pytest.mark.asyncio
    async def test_penalty_score_tracking(self, rate_limiter):
        """Penalty scores should accumulate."""
        # Initial score should be 0
        score = await rate_limiter.get_penalty_score("bad_client")
        assert score == 0
        
        # Increment penalty
        new_score = await rate_limiter.increment_penalty("bad_client", amount=5)
        assert new_score == 5
        
        # Increment again
        new_score = await rate_limiter.increment_penalty("bad_client", amount=3)
        assert new_score == 8
    
    @pytest.mark.asyncio
    async def test_burst_handling(self, rate_limiter):
        """Should handle burst requests correctly."""
        # Request multiple tokens at once
        allowed, remaining, _ = await rate_limiter.check_rate_limit(
            key="burst_client",
            capacity=100,
            refill_rate=10.0,
            tokens_requested=50,  # Half the bucket
        )
        
        assert allowed is True
        assert remaining == 50
        
        # Another burst should work
        allowed, remaining, _ = await rate_limiter.check_rate_limit(
            key="burst_client",
            capacity=100,
            refill_rate=10.0,
            tokens_requested=50,
        )
        
        assert allowed is True
        assert remaining == 0
        
        # Third burst should fail
        allowed, _, retry_after = await rate_limiter.check_rate_limit(
            key="burst_client",
            capacity=100,
            refill_rate=10.0,
            tokens_requested=50,
        )
        
        assert allowed is False
        assert retry_after > 0


class TestRateLimiterLuaScript:
    """Test the Lua script logic."""
    
    def test_lua_script_syntax(self):
        """Verify Lua script is valid."""
        # Basic syntax check (would need Lua interpreter for full validation)
        assert "KEYS[1]" in RATE_LIMIT_LUA_SCRIPT
        assert "ARGV[1]" in RATE_LIMIT_LUA_SCRIPT
        assert "redis.call" in RATE_LIMIT_LUA_SCRIPT
        assert "HMGET" in RATE_LIMIT_LUA_SCRIPT
        assert "HMSET" in RATE_LIMIT_LUA_SCRIPT
        assert "EXPIRE" in RATE_LIMIT_LUA_SCRIPT
    
    def test_lua_script_returns_three_values(self):
        """Verify script returns expected format."""
        # The script should return [allowed, remaining, retry_after]
        assert "return {allowed, math.floor(remaining), retry_after}" in RATE_LIMIT_LUA_SCRIPT
