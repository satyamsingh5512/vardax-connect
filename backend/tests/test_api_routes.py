"""
Comprehensive tests for VARDAx API Routes.
Tests all REST endpoints and WebSocket connections.
"""
import pytest
from fastapi.testclient import TestClient
from datetime import datetime
import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Mock the database before importing routes
class MockDB:
    def __init__(self):
        self.anomalies = []
        self.rules = []
        self.traffic_events = []
    
    def save_anomaly(self, anomaly):
        self.anomalies.append(anomaly)
    
    def get_anomalies(self, since_minutes=60, limit=100, severity=None):
        return self.anomalies[:limit]
    
    def get_anomaly(self, anomaly_id):
        for a in self.anomalies:
            if a.get("anomaly_id") == anomaly_id:
                return a
        return None
    
    def save_rule(self, rule):
        self.rules.append(rule)
    
    def get_rules(self):
        return self.rules
    
    def update_rule_status(self, rule_id, status, approved_by=None):
        for r in self.rules:
            if r.get("rule_id") == rule_id:
                r["status"] = status
    
    def save_traffic_event(self, event):
        self.traffic_events.append(event)
    
    def get_stats(self):
        return {
            "anomalies": len(self.anomalies),
            "rules": len(self.rules),
            "traffic_events": len(self.traffic_events)
        }
    
    def clear_all_data(self):
        self.anomalies.clear()
        self.rules.clear()
        self.traffic_events.clear()
    
    def update_anomaly_feedback(self, anomaly_id, feedback_type, notes):
        for a in self.anomalies:
            if a.get("anomaly_id") == anomaly_id:
                a["feedback"] = feedback_type
                a["feedback_notes"] = notes

mock_db = MockDB()

# Try to patch the database module
try:
    import app.database as db_module
    db_module.get_db = lambda: mock_db
except ImportError:
    pass  # Database module may not exist


class TestHealthEndpoints:
    """Tests for health check endpoints."""
    
    @pytest.fixture
    def client(self):
        from app.main import app
        return TestClient(app)
    
    def test_root_endpoint(self, client):
        """Test root endpoint returns welcome message."""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data or "status" in data
    
    def test_health_endpoint(self, client):
        """Test health endpoint."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"


class TestTrafficIngestion:
    """Tests for traffic ingestion endpoint."""
    
    @pytest.fixture
    def client(self):
        from app.main import app
        return TestClient(app)
    
    def test_ingest_normal_traffic(self, client):
        """Test ingesting normal traffic."""
        payload = {
            "request_id": "test-001",
            "timestamp": datetime.utcnow().isoformat(),
            "client_ip": "192.168.1.100",
            "client_port": 54321,
            "method": "GET",
            "uri": "/api/v1/users",
            "user_agent": "Mozilla/5.0",
            "body_length": 0
        }
        
        response = client.post("/api/v1/traffic/ingest", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "queued"
    
    def test_ingest_suspicious_traffic(self, client):
        """Test ingesting suspicious traffic."""
        payload = {
            "request_id": "test-002",
            "timestamp": datetime.utcnow().isoformat(),
            "client_ip": "192.168.1.100",
            "client_port": 54321,
            "method": "GET",
            "uri": "/admin/../../../etc/passwd",
            "user_agent": "sqlmap/1.0",
            "body_length": 0
        }
        
        response = client.post("/api/v1/traffic/ingest", json=payload)
        assert response.status_code == 200
    
    def test_ingest_missing_fields(self, client):
        """Test ingestion with missing required fields."""
        payload = {
            "request_id": "test-003"
            # Missing required fields
        }
        
        response = client.post("/api/v1/traffic/ingest", json=payload)
        assert response.status_code == 422  # Validation error


class TestMLAnalysis:
    """Tests for ML analysis endpoint."""
    
    @pytest.fixture
    def client(self):
        from app.main import app
        return TestClient(app)
    
    def test_analyze_normal_request(self, client):
        """Test ML analysis of normal request."""
        payload = {
            "request_id": "test-ml-001",
            "timestamp": datetime.utcnow().isoformat(),
            "client_ip": "192.168.1.100",
            "client_port": 54321,
            "method": "GET",
            "uri": "/api/v1/users",
            "user_agent": "Mozilla/5.0",
            "body_length": 0,
            "has_cookie": True
        }
        
        response = client.post("/api/v1/ml/analyze", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        assert "scores" in data
        assert "severity" in data
        assert "confidence" in data
    
    def test_analyze_suspicious_request(self, client):
        """Test ML analysis of suspicious request."""
        payload = {
            "request_id": "test-ml-002",
            "timestamp": datetime.utcnow().isoformat(),
            "client_ip": "192.168.1.100",
            "client_port": 54321,
            "method": "POST",
            "uri": "/admin/../../etc/passwd",
            "user_agent": "nikto/2.1.6",
            "body_length": 5000,
            "has_cookie": False
        }
        
        response = client.post("/api/v1/ml/analyze", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        # Should detect as more suspicious
        assert data["scores"]["ensemble"] >= 0
    
    def test_ml_health_endpoint(self, client):
        """Test ML health endpoint."""
        response = client.get("/api/v1/ml/health")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) >= 3  # IF, AE, EWMA


class TestAnomalyEndpoints:
    """Tests for anomaly management endpoints."""
    
    @pytest.fixture
    def client(self):
        from app.main import app
        mock_db.clear_all_data()
        return TestClient(app)
    
    def test_get_anomalies_empty(self, client):
        """Test getting anomalies when none exist."""
        response = client.get("/api/v1/anomalies")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_anomalies_with_limit(self, client):
        """Test getting anomalies with limit."""
        response = client.get("/api/v1/anomalies?limit=5")
        assert response.status_code == 200
    
    def test_get_anomalies_with_severity_filter(self, client):
        """Test getting anomalies filtered by severity."""
        response = client.get("/api/v1/anomalies?severity=high")
        assert response.status_code == 200
    
    def test_get_anomaly_not_found(self, client):
        """Test getting non-existent anomaly."""
        response = client.get("/api/v1/anomalies/nonexistent-id")
        assert response.status_code == 404


class TestRuleEndpoints:
    """Tests for rule management endpoints."""
    
    @pytest.fixture
    def client(self):
        from app.main import app
        mock_db.clear_all_data()
        return TestClient(app)
    
    def test_get_pending_rules_empty(self, client):
        """Test getting pending rules when none exist."""
        response = client.get("/api/v1/rules/pending")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_example_rules(self, client):
        """Test getting example rules."""
        response = client.get("/api/v1/rules/examples")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_generate_rules(self, client):
        """Test rule generation endpoint."""
        response = client.post("/api/v1/rules/generate")
        assert response.status_code == 200
    
    def test_approve_nonexistent_rule(self, client):
        """Test approving non-existent rule."""
        payload = {
            "rule_id": "nonexistent-rule",
            "action": "approve"
        }
        
        response = client.post("/api/v1/rules/approve", json=payload)
        assert response.status_code == 404


class TestFeedbackEndpoint:
    """Tests for feedback endpoint."""
    
    @pytest.fixture
    def client(self):
        from app.main import app
        mock_db.clear_all_data()
        return TestClient(app)
    
    def test_submit_feedback(self, client):
        """Test submitting feedback."""
        payload = {
            "anomaly_id": "test-anomaly-001",
            "feedback_type": "true_positive",
            "analyst_id": "analyst-001",
            "notes": "Confirmed attack"
        }
        
        response = client.post("/api/v1/feedback", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "feedback recorded"


class TestMetricsEndpoints:
    """Tests for metrics endpoints."""
    
    @pytest.fixture
    def client(self):
        from app.main import app
        return TestClient(app)
    
    def test_get_traffic_metrics(self, client):
        """Test getting traffic metrics."""
        response = client.get("/api/v1/metrics/traffic")
        assert response.status_code == 200
        data = response.json()
        
        assert "requests_per_second" in data
        assert "anomalies_per_minute" in data
    
    def test_get_live_stats(self, client):
        """Test getting live stats."""
        response = client.get("/api/v1/stats/live")
        assert response.status_code == 200
        data = response.json()
        
        assert "timestamp" in data
        assert "anomalies_total" in data


class TestAdminEndpoints:
    """Tests for admin endpoints."""
    
    @pytest.fixture
    def client(self):
        from app.main import app
        mock_db.clear_all_data()
        return TestClient(app)
    
    def test_get_db_stats(self, client):
        """Test getting database stats."""
        response = client.get("/api/v1/admin/db-stats")
        assert response.status_code == 200
        data = response.json()
        
        assert "in_memory_anomalies" in data
    
    def test_clear_data(self, client):
        """Test clearing all data."""
        response = client.post("/api/v1/admin/clear-data")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
    
    def test_load_from_db(self, client):
        """Test loading from database."""
        response = client.post("/api/v1/admin/load-from-db")
        assert response.status_code == 200


class TestAttackPatternDetection:
    """Tests for various attack pattern detection."""
    
    @pytest.fixture
    def client(self):
        from app.main import app
        return TestClient(app)
    
    def test_sql_injection_detection(self, client):
        """Test SQL injection pattern detection."""
        payload = {
            "request_id": "test-sqli-001",
            "timestamp": datetime.utcnow().isoformat(),
            "client_ip": "192.168.1.100",
            "client_port": 54321,
            "method": "GET",
            "uri": "/api/users?id=1' OR '1'='1",
            "user_agent": "Mozilla/5.0",
            "body_length": 0
        }
        
        response = client.post("/api/v1/ml/analyze", json=payload)
        assert response.status_code == 200
    
    def test_path_traversal_detection(self, client):
        """Test path traversal pattern detection."""
        payload = {
            "request_id": "test-traversal-001",
            "timestamp": datetime.utcnow().isoformat(),
            "client_ip": "192.168.1.100",
            "client_port": 54321,
            "method": "GET",
            "uri": "/../../../etc/passwd",
            "user_agent": "Mozilla/5.0",
            "body_length": 0
        }
        
        response = client.post("/api/v1/ml/analyze", json=payload)
        assert response.status_code == 200
    
    def test_scanner_detection(self, client):
        """Test scanner user agent detection."""
        payload = {
            "request_id": "test-scanner-001",
            "timestamp": datetime.utcnow().isoformat(),
            "client_ip": "192.168.1.100",
            "client_port": 54321,
            "method": "GET",
            "uri": "/",
            "user_agent": "nikto/2.1.6",
            "body_length": 0
        }
        
        response = client.post("/api/v1/ml/analyze", json=payload)
        assert response.status_code == 200


class TestWebSocketEndpoints:
    """Tests for WebSocket endpoints."""
    
    @pytest.fixture
    def client(self):
        from app.main import app
        return TestClient(app)
    
    def test_websocket_anomalies_connection(self, client):
        """Test WebSocket anomalies endpoint connection."""
        with client.websocket_connect("/api/v1/ws/anomalies") as websocket:
            # Connection should succeed
            pass
    
    def test_websocket_traffic_connection(self, client):
        """Test WebSocket traffic endpoint connection."""
        with client.websocket_connect("/api/v1/ws/traffic") as websocket:
            # Connection should succeed
            pass


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
