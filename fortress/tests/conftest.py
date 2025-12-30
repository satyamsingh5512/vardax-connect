"""
Pytest Configuration and Fixtures
Security: Isolated test environment, no external dependencies.
"""
import pytest
import asyncio
import os
from unittest.mock import patch

# Set test environment variables before importing app
os.environ["ENFORCE_TLS"] = "false"
os.environ["JA4_ENABLED"] = "false"
os.environ["RATE_LIMIT_ENABLED"] = "false"
os.environ["TARPIT_ENABLED"] = "false"
os.environ["MTLS_ENABLED"] = "false"
os.environ["HONEYTOKEN_ENABLED"] = "false"
os.environ["ENABLE_DOCS"] = "true"
os.environ["REDIS_URL"] = "redis://localhost:6379"


@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def mock_env():
    """Fixture to mock environment variables."""
    with patch.dict(os.environ, {
        "ENFORCE_TLS": "false",
        "JA4_ENABLED": "true",
        "RATE_LIMIT_ENABLED": "true",
        "TARPIT_ENABLED": "true",
        "MTLS_ENABLED": "false",
        "HONEYTOKEN_ENABLED": "true",
    }):
        yield


@pytest.fixture
def test_client():
    """Create test client for API testing."""
    from fastapi.testclient import TestClient
    from app.main import app
    
    with TestClient(app) as client:
        yield client
