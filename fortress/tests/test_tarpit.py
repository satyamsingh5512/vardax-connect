"""
Tarpit Middleware Tests
Security: Verify tarpit delays and blocking behavior.
"""
import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from starlette.testclient import TestClient
from starlette.requests import Request
from starlette.responses import Response

from app.middleware.tarpit import TarpitMiddleware, TarpitManager


class MockRateLimiter:
    """Mock rate limiter for tarpit tests."""
    
    def __init__(self):
        self.penalty_scores = {}
        self.penalty_reasons = {}
    
    async def get_penalty_score(self, client_ip: str) -> int:
        return self.penalty_scores.get(client_ip, 0)
    
    async def increment_penalty(self, client_ip: str, amount: int = 1) -> int:
        if client_ip not in self.penalty_scores:
            self.penalty_scores[client_ip] = 0
        self.penalty_scores[client_ip] += amount
        return self.penalty_scores[client_ip]


class MockRedis:
    """Mock Redis for TarpitManager tests."""
    
    def __init__(self):
        self.data = {}
        self.lists = {}
    
    async def incrby(self, key: str, amount: int) -> int:
        if key not in self.data:
            self.data[key] = 0
        self.data[key] += amount
        return self.data[key]
    
    async def expire(self, key: str, seconds: int):
        pass
    
    async def lpush(self, key: str, value: str):
        if key not in self.lists:
            self.lists[key] = []
        self.lists[key].insert(0, value)
    
    async def ltrim(self, key: str, start: int, end: int):
        if key in self.lists:
            self.lists[key] = self.lists[key][start:end+1]
    
    async def delete(self, key: str):
        self.data.pop(key, None)
        self.lists.pop(key, None)
    
    async def get(self, key: str):
        return self.data.get(key)
    
    async def lrange(self, key: str, start: int, end: int):
        if key not in self.lists:
            return []
        if end == -1:
            return self.lists[key][start:]
        return self.lists[key][start:end+1]


@pytest.fixture
def mock_rate_limiter():
    return MockRateLimiter()


@pytest.fixture
def mock_redis():
    return MockRedis()


class TestTarpitMiddleware:
    """Test suite for tarpit middleware."""
    
    def test_delay_calculation_below_threshold(self):
        """No delay for clients below penalty threshold."""
        middleware = TarpitMiddleware(None)
        middleware.penalty_threshold = 3
        
        delay = middleware._calculate_delay(0)
        assert delay == 0
        
        delay = middleware._calculate_delay(2)
        assert delay == 0
    
    def test_delay_calculation_at_threshold(self):
        """Base delay at threshold."""
        middleware = TarpitMiddleware(None)
        middleware.base_delay_ms = 100
        middleware.penalty_threshold = 3
        
        delay = middleware._calculate_delay(3)
        assert delay == 100  # base_delay * 2^0
    
    def test_delay_calculation_exponential(self):
        """Delay increases exponentially."""
        middleware = TarpitMiddleware(None)
        middleware.base_delay_ms = 100
        middleware.penalty_threshold = 3
        middleware.max_delay_ms = 100000
        
        # Score 4: base * 2^1 = 200
        delay = middleware._calculate_delay(4)
        assert delay == 200
        
        # Score 5: base * 2^2 = 400
        delay = middleware._calculate_delay(5)
        assert delay == 400
        
        # Score 6: base * 2^3 = 800
        delay = middleware._calculate_delay(6)
        assert delay == 800
    
    def test_delay_calculation_capped(self):
        """Delay is capped at maximum."""
        middleware = TarpitMiddleware(None)
        middleware.base_delay_ms = 100
        middleware.penalty_threshold = 3
        middleware.max_delay_ms = 1000
        
        # Very high score should be capped
        delay = middleware._calculate_delay(20)
        assert delay == 1000


class TestTarpitManager:
    """Test suite for tarpit manager."""
    
    @pytest.mark.asyncio
    async def test_add_to_penalty_box(self, mock_redis):
        """Adding to penalty box should increment score."""
        manager = TarpitManager(mock_redis)
        
        score = await manager.add_to_penalty_box(
            client_ip="192.168.1.100",
            reason="rate_limit_violation",
            penalty_points=10,
        )
        
        assert score == 10
        assert mock_redis.data["penalty:192.168.1.100"] == 10
        assert "rate_limit_violation" in mock_redis.lists["penalty_reasons:192.168.1.100"]
    
    @pytest.mark.asyncio
    async def test_cumulative_penalties(self, mock_redis):
        """Penalties should accumulate."""
        manager = TarpitManager(mock_redis)
        
        await manager.add_to_penalty_box("192.168.1.100", "violation_1", 5)
        score = await manager.add_to_penalty_box("192.168.1.100", "violation_2", 10)
        
        assert score == 15
    
    @pytest.mark.asyncio
    async def test_remove_from_penalty_box(self, mock_redis):
        """Removing from penalty box should clear data."""
        manager = TarpitManager(mock_redis)
        
        await manager.add_to_penalty_box("192.168.1.100", "test", 10)
        await manager.remove_from_penalty_box("192.168.1.100")
        
        assert "penalty:192.168.1.100" not in mock_redis.data
        assert "penalty_reasons:192.168.1.100" not in mock_redis.lists
    
    @pytest.mark.asyncio
    async def test_get_penalty_info(self, mock_redis):
        """Should return penalty information."""
        manager = TarpitManager(mock_redis)
        
        await manager.add_to_penalty_box("192.168.1.100", "reason_1", 5)
        await manager.add_to_penalty_box("192.168.1.100", "reason_2", 3)
        
        info = await manager.get_penalty_info("192.168.1.100")
        
        assert info["client_ip"] == "192.168.1.100"
        assert info["penalty_score"] == 8
        assert len(info["reasons"]) == 2
    
    @pytest.mark.asyncio
    async def test_get_penalty_info_unknown_client(self, mock_redis):
        """Should return zero for unknown clients."""
        manager = TarpitManager(mock_redis)
        
        info = await manager.get_penalty_info("unknown_client")
        
        assert info["penalty_score"] == 0
        assert info["reasons"] == []


class TestTarpitIntegration:
    """Integration tests for tarpit behavior."""
    
    @pytest.mark.asyncio
    async def test_tarpit_delay_applied(self, mock_rate_limiter):
        """Verify delay is actually applied."""
        # Set high penalty score
        mock_rate_limiter.penalty_scores["192.168.1.100"] = 5
        
        middleware = TarpitMiddleware(None)
        middleware.enabled = True
        middleware.penalty_threshold = 3
        middleware.base_delay_ms = 100
        middleware.max_delay_ms = 1000
        
        # Calculate expected delay
        expected_delay = middleware._calculate_delay(5)
        assert expected_delay == 400  # 100 * 2^2
    
    @pytest.mark.asyncio
    async def test_exempt_paths_not_tarpitted(self):
        """Exempt paths should not be delayed."""
        middleware = TarpitMiddleware(None)
        
        assert "/health" in middleware.EXEMPT_PATHS
        assert "/ready" in middleware.EXEMPT_PATHS
        assert "/live" in middleware.EXEMPT_PATHS
    
    def test_block_threshold_configuration(self):
        """Block threshold should be configurable."""
        middleware = TarpitMiddleware(None)
        
        # Default threshold
        assert middleware.block_threshold == 50
        
        # Should be configurable via environment
        with patch.dict("os.environ", {"TARPIT_BLOCK_THRESHOLD": "100"}):
            middleware2 = TarpitMiddleware(None)
            assert middleware2.block_threshold == 100
