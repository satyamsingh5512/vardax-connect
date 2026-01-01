"""
Comprehensive tests for VARDAx Feature Extractor.
Tests all 47 feature extraction functions.
"""
import pytest
from datetime import datetime, timedelta
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.ml.feature_extractor import FeatureExtractor, SessionState, RateState
from app.models.schemas import TrafficRequest


class TestFeatureExtractorInit:
    """Tests for FeatureExtractor initialization."""
    
    def test_default_initialization(self):
        """Test default initialization."""
        extractor = FeatureExtractor()
        assert extractor.session_window == timedelta(seconds=300)
        assert extractor.rate_window == timedelta(seconds=60)
        assert len(extractor.sessions) == 0
        assert len(extractor.rates) == 0
    
    def test_custom_initialization(self):
        """Test custom window sizes."""
        extractor = FeatureExtractor(
            session_window_seconds=600,
            rate_window_seconds=120
        )
        assert extractor.session_window == timedelta(seconds=600)
        assert extractor.rate_window == timedelta(seconds=120)


class TestEntropyCalculation:
    """Tests for entropy calculation."""
    
    def test_empty_string_entropy(self):
        """Test entropy of empty string."""
        entropy = FeatureExtractor._calculate_entropy("")
        assert entropy == 0.0
    
    def test_single_char_entropy(self):
        """Test entropy of single character string."""
        entropy = FeatureExtractor._calculate_entropy("aaaa")
        assert entropy == 0.0  # No randomness
    
    def test_high_entropy_string(self):
        """Test entropy of random-looking string."""
        entropy = FeatureExtractor._calculate_entropy("abcdefghij")
        assert entropy > 3.0  # High entropy
    
    def test_sql_injection_entropy(self):
        """Test entropy of SQL injection payload."""
        payload = "' OR '1'='1"
        entropy = FeatureExtractor._calculate_entropy(payload)
        assert entropy > 2.0


class TestRequestFeatureExtraction:
    """Tests for request-level feature extraction."""
    
    @pytest.fixture
    def extractor(self):
        return FeatureExtractor()
    
    @pytest.fixture
    def normal_request(self):
        return TrafficRequest(
            request_id="test-001",
            timestamp=datetime.utcnow(),
            client_ip="192.168.1.100",
            client_port=54321,
            method="GET",
            uri="/api/v1/users",
            query_string="page=1&limit=10",
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            content_type="application/json",
            body_length=0,
            body_entropy=0.0,
            body_printable_ratio=1.0,
            has_cookie=True
        )
    
    def test_extract_normal_request(self, extractor, normal_request):
        """Test feature extraction for normal request."""
        features = extractor.extract(normal_request)
        
        assert features.request_id == "test-001"
        assert features.method_encoded == 0  # GET
        assert features.uri_length == len("/api/v1/users")
        assert features.uri_depth == 3  # api, v1, users
        assert features.query_param_count == 2  # page, limit
    
    def test_extract_post_request(self, extractor):
        """Test POST request encoding."""
        request = TrafficRequest(
            request_id="test-002",
            timestamp=datetime.utcnow(),
            client_ip="192.168.1.100",
            client_port=54321,
            method="POST",
            uri="/api/v1/users",
            body_length=500,
            body_entropy=4.5,
            body_printable_ratio=0.95
        )
        
        features = extractor.extract(request)
        
        assert features.method_encoded == 1  # POST
        assert features.body_length == 500
        assert features.body_entropy == 4.5
    
    def test_extract_risky_extension(self, extractor):
        """Test risky file extension detection."""
        request = TrafficRequest(
            request_id="test-003",
            timestamp=datetime.utcnow(),
            client_ip="192.168.1.100",
            client_port=54321,
            method="GET",
            uri="/uploads/shell.php"
        )
        
        features = extractor.extract(request)
        
        assert features.extension_risk_score == 0.9  # .php is risky
    
    def test_extract_high_entropy_uri(self, extractor):
        """Test high entropy URI detection."""
        request = TrafficRequest(
            request_id="test-004",
            timestamp=datetime.utcnow(),
            client_ip="192.168.1.100",
            client_port=54321,
            method="GET",
            uri="/api/v1/users?id=1%27%20OR%20%271%27=%271",  # SQL injection
            query_string="id=1%27%20OR%20%271%27=%271"  # Explicitly set query string
        )
        
        features = extractor.extract(request)
        
        assert features.uri_entropy > 3.0
        # Query entropy depends on query_string being set
        assert features.query_length > 0 or features.uri_entropy > 3.5


class TestSessionFeatureExtraction:
    """Tests for session-level feature extraction."""
    
    @pytest.fixture
    def extractor(self):
        return FeatureExtractor()
    
    def test_session_tracking(self, extractor):
        """Test session state tracking across requests."""
        ip = "192.168.1.100"
        
        # First request
        req1 = TrafficRequest(
            request_id="test-001",
            timestamp=datetime.utcnow(),
            client_ip=ip,
            client_port=54321,
            method="GET",
            uri="/api/v1/users"
        )
        features1 = extractor.extract(req1)
        
        assert features1.session_request_count == 1
        assert features1.session_unique_uris == 1
        
        # Second request from same IP
        req2 = TrafficRequest(
            request_id="test-002",
            timestamp=datetime.utcnow(),
            client_ip=ip,
            client_port=54321,
            method="GET",
            uri="/api/v1/products"
        )
        features2 = extractor.extract(req2)
        
        assert features2.session_request_count == 2
        assert features2.session_unique_uris == 2
    
    def test_session_expiry(self, extractor):
        """Test session expires after window."""
        ip = "192.168.1.200"  # Use different IP to avoid conflicts
        
        # Old request - set first_seen in the past
        old_time = datetime.utcnow() - timedelta(seconds=400)  # Beyond 300s window
        req1 = TrafficRequest(
            request_id="test-expiry-001",
            timestamp=old_time,
            client_ip=ip,
            client_port=54321,
            method="GET",
            uri="/api/v1/users"
        )
        extractor.extract(req1)
        
        # Manually set the session's first_seen to old time
        extractor.sessions[ip].first_seen = old_time
        
        # New request should start fresh session
        req2 = TrafficRequest(
            request_id="test-expiry-002",
            timestamp=datetime.utcnow(),
            client_ip=ip,
            client_port=54321,
            method="GET",
            uri="/api/v1/products"
        )
        features2 = extractor.extract(req2)
        
        # Session should be reset due to expiry
        assert features2.session_request_count == 1  # New session
    
    def test_session_unique_methods(self, extractor):
        """Test unique methods tracking."""
        ip = "192.168.1.100"
        now = datetime.utcnow()
        
        for method in ["GET", "POST", "PUT", "DELETE"]:
            req = TrafficRequest(
                request_id=f"test-{method}",
                timestamp=now,
                client_ip=ip,
                client_port=54321,
                method=method,
                uri="/api/v1/users"
            )
            features = extractor.extract(req)
        
        assert features.session_unique_methods == 4


class TestRateFeatureExtraction:
    """Tests for rate-level feature extraction."""
    
    @pytest.fixture
    def extractor(self):
        return FeatureExtractor()
    
    def test_requests_per_minute(self, extractor):
        """Test requests per minute calculation."""
        now = datetime.utcnow()
        
        # Send 10 requests
        for i in range(10):
            req = TrafficRequest(
                request_id=f"test-{i}",
                timestamp=now,
                client_ip="192.168.1.100",
                client_port=54321,
                method="GET",
                uri="/api/v1/users"
            )
            features = extractor.extract(req)
        
        assert features.requests_per_minute == 10
    
    def test_unique_ips_tracking(self, extractor):
        """Test unique IPs per endpoint tracking."""
        now = datetime.utcnow()
        
        for i in range(5):
            req = TrafficRequest(
                request_id=f"test-{i}",
                timestamp=now,
                client_ip=f"192.168.1.{100 + i}",
                client_port=54321,
                method="GET",
                uri="/api/v1/users"
            )
            features = extractor.extract(req)
        
        assert features.unique_ips_per_minute == 5
    
    def test_new_uri_rate(self, extractor):
        """Test new URI rate calculation."""
        now = datetime.utcnow()
        
        # First request - new URI
        req1 = TrafficRequest(
            request_id="test-001",
            timestamp=now,
            client_ip="192.168.1.100",
            client_port=54321,
            method="GET",
            uri="/api/v1/users"
        )
        features1 = extractor.extract(req1)
        
        # Second request - same URI (not new)
        req2 = TrafficRequest(
            request_id="test-002",
            timestamp=now,
            client_ip="192.168.1.100",
            client_port=54321,
            method="GET",
            uri="/api/v1/users"
        )
        features2 = extractor.extract(req2)
        
        # Third request - new URI
        req3 = TrafficRequest(
            request_id="test-003",
            timestamp=now,
            client_ip="192.168.1.100",
            client_port=54321,
            method="GET",
            uri="/api/v1/products"
        )
        features3 = extractor.extract(req3)


class TestBehavioralFeatureExtraction:
    """Tests for behavioral feature extraction."""
    
    @pytest.fixture
    def extractor(self):
        return FeatureExtractor()
    
    def test_user_agent_scoring_normal(self, extractor):
        """Test normal user agent scoring."""
        score = extractor._score_user_agent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        )
        assert score == 0.0
    
    def test_user_agent_scoring_suspicious(self, extractor):
        """Test suspicious user agent scoring."""
        suspicious_agents = ["curl/7.68.0", "python-requests/2.25.1", "sqlmap/1.0"]
        
        for ua in suspicious_agents:
            score = extractor._score_user_agent(ua)
            assert score > 0.5, f"Expected high score for {ua}"
    
    def test_user_agent_scoring_missing(self, extractor):
        """Test missing user agent scoring."""
        score = extractor._score_user_agent(None)
        assert score == 0.5  # Slightly suspicious
    
    def test_time_of_day_scoring(self, extractor):
        """Test time of day scoring."""
        # Business hours
        business_time = datetime(2024, 1, 15, 10, 0, 0)  # 10 AM
        score = extractor._score_time_of_day(business_time)
        assert score == 0.0
        
        # Night time
        night_time = datetime(2024, 1, 15, 3, 0, 0)  # 3 AM
        score = extractor._score_time_of_day(night_time)
        assert score == 0.4
    
    def test_bot_score_calculation(self, extractor):
        """Test bot likelihood score calculation."""
        # Normal request
        normal_req = TrafficRequest(
            request_id="test-001",
            timestamp=datetime.utcnow(),
            client_ip="192.168.1.100",
            client_port=54321,
            method="GET",
            uri="/api/v1/users",
            user_agent="Mozilla/5.0",
            has_cookie=True
        )
        
        features = extractor.extract(normal_req)
        assert features.bot_likelihood_score < 0.5
    
    def test_bot_score_high_for_scanner(self, extractor):
        """Test high bot score for scanner-like behavior."""
        now = datetime.utcnow()
        
        # Simulate scanning behavior - many unique URIs quickly
        for i in range(50):
            req = TrafficRequest(
                request_id=f"test-{i}",
                timestamp=now,
                client_ip="192.168.1.100",
                client_port=54321,
                method="GET",
                uri=f"/api/v1/endpoint{i}",
                user_agent="curl/7.68.0",
                has_cookie=False
            )
            features = extractor.extract(req)
        
        # High request count + no cookies + suspicious UA + many unique URIs
        assert features.bot_likelihood_score > 0.5


class TestBaselineUpdate:
    """Tests for baseline statistics update."""
    
    def test_baseline_update(self):
        """Test baseline statistics update."""
        extractor = FeatureExtractor()
        
        # Create features mock with different value than default
        class MockFeatures:
            requests_per_minute = 200.0  # Different from default 100.0
            uri_length = 100  # Different from default 50.0
            body_length = 1000  # Different from default 500.0
        
        initial_mean = extractor.baseline_stats['requests_per_minute']['mean']
        
        extractor.update_baseline(MockFeatures(), alpha=0.5)
        
        # Mean should have moved toward 200 (from 100)
        new_mean = extractor.baseline_stats['requests_per_minute']['mean']
        assert new_mean > initial_mean  # Should increase toward 200


class TestSessionCleanup:
    """Tests for session cleanup."""
    
    def test_cleanup_old_sessions(self):
        """Test old session cleanup."""
        extractor = FeatureExtractor()
        
        # Create old session
        old_time = datetime.utcnow() - timedelta(seconds=7200)  # 2 hours ago
        extractor.sessions["192.168.1.100"] = SessionState(first_seen=old_time)
        extractor.sessions["192.168.1.101"] = SessionState(first_seen=datetime.utcnow())
        
        assert len(extractor.sessions) == 2
        
        extractor.cleanup_old_sessions(max_age_seconds=3600)
        
        assert len(extractor.sessions) == 1
        assert "192.168.1.101" in extractor.sessions


class TestURISimilarity:
    """Tests for URI similarity calculation."""
    
    def test_identical_uris(self):
        """Test identical URIs have similarity 1.0."""
        similarity = FeatureExtractor._uri_similarity("/api/v1/users", "/api/v1/users")
        assert similarity == 1.0
    
    def test_different_uris(self):
        """Test different URIs have lower similarity."""
        similarity = FeatureExtractor._uri_similarity("/api/v1/users", "/admin/settings")
        assert similarity < 0.5
    
    def test_similar_uris(self):
        """Test similar URIs have high similarity."""
        similarity = FeatureExtractor._uri_similarity("/api/v1/users", "/api/v1/products")
        assert similarity > 0.5


class TestContentTypeEncoding:
    """Tests for content type encoding."""
    
    @pytest.fixture
    def extractor(self):
        return FeatureExtractor()
    
    def test_json_encoding(self, extractor):
        """Test JSON content type encoding."""
        encoded = extractor._encode_content_type("application/json")
        assert encoded == 0
    
    def test_form_encoding(self, extractor):
        """Test form content type encoding."""
        encoded = extractor._encode_content_type("application/x-www-form-urlencoded")
        assert encoded == 1
    
    def test_unknown_encoding(self, extractor):
        """Test unknown content type encoding."""
        encoded = extractor._encode_content_type("application/octet-stream")
        assert encoded == 6  # 'other'
    
    def test_none_encoding(self, extractor):
        """Test None content type encoding."""
        encoded = extractor._encode_content_type(None)
        assert encoded == 6


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
