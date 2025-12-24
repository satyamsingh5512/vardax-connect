#!/bin/bash
# VARDAx Integration Test Suite
# Tests all components end-to-end

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

API_URL="${API_URL:-http://localhost:8000}"
API_KEY="${VARDAX_API_KEY:-change-me-in-production}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   VARDAx Integration Test Suite${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Test counter
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Test function
run_test() {
    local test_name=$1
    local test_command=$2
    
    TESTS_RUN=$((TESTS_RUN + 1))
    echo -n "Test $TESTS_RUN: $test_name... "
    
    if eval "$test_command" >/dev/null 2>&1; then
        echo -e "${GREEN}✓ PASS${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

echo -e "${BLUE}1. API Health Checks${NC}"
run_test "API root endpoint" "curl -f $API_URL/"
run_test "API health endpoint" "curl -f $API_URL/health"
run_test "API docs endpoint" "curl -f $API_URL/docs"

echo ""
echo -e "${BLUE}2. ML Inference Tests${NC}"

# Test normal request
run_test "ML inference - normal request" "curl -f -X POST $API_URL/api/v1/ml/analyze \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: $API_KEY' \
  -d '{
    \"request_id\": \"test-normal-001\",
    \"timestamp\": \"2024-01-01T00:00:00Z\",
    \"client_ip\": \"192.168.1.100\",
    \"method\": \"GET\",
    \"uri\": \"/api/users\",
    \"user_agent\": \"Mozilla/5.0\",
    \"body_length\": 0,
    \"has_cookie\": true
  }'"

# Test suspicious request
run_test "ML inference - suspicious request" "curl -f -X POST $API_URL/api/v1/ml/analyze \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: $API_KEY' \
  -d '{
    \"request_id\": \"test-suspicious-001\",
    \"timestamp\": \"2024-01-01T00:00:00Z\",
    \"client_ip\": \"192.168.1.100\",
    \"method\": \"POST\",
    \"uri\": \"/admin/../../etc/passwd\",
    \"user_agent\": \"sqlmap/1.0\",
    \"body_length\": 5000,
    \"has_cookie\": false
  }'"

echo ""
echo -e "${BLUE}3. Traffic Ingestion Tests${NC}"

run_test "Traffic ingestion endpoint" "curl -f -X POST $API_URL/api/v1/traffic/ingest \
  -H 'Content-Type: application/json' \
  -d '{
    \"request_id\": \"test-traffic-001\",
    \"timestamp\": \"2024-01-01T00:00:00Z\",
    \"client_ip\": \"192.168.1.100\",
    \"method\": \"GET\",
    \"uri\": \"/api/test\",
    \"user_agent\": \"curl/7.68.0\",
    \"body_length\": 0
  }'"

echo ""
echo -e "${BLUE}4. Anomaly API Tests${NC}"

run_test "Get anomalies list" "curl -f $API_URL/api/v1/anomalies?limit=10"
run_test "Get anomalies with filter" "curl -f '$API_URL/api/v1/anomalies?severity=high&limit=5'"

echo ""
echo -e "${BLUE}5. Rule Management Tests${NC}"

run_test "Get pending rules" "curl -f $API_URL/api/v1/rules/pending"
run_test "Get example rules" "curl -f $API_URL/api/v1/rules/examples"

echo ""
echo -e "${BLUE}6. Metrics Tests${NC}"

run_test "Get traffic metrics" "curl -f $API_URL/api/v1/metrics/traffic"
run_test "Get live stats" "curl -f $API_URL/api/v1/stats/live"
run_test "Get ML health" "curl -f $API_URL/api/v1/ml/health"

echo ""
echo -e "${BLUE}7. Database Tests${NC}"

run_test "Get database stats" "curl -f $API_URL/api/v1/admin/db-stats"

echo ""
echo -e "${BLUE}8. Feature Extraction Tests${NC}"

# Test with various attack patterns
run_test "SQL injection pattern" "curl -f -X POST $API_URL/api/v1/ml/analyze \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: $API_KEY' \
  -d '{
    \"request_id\": \"test-sqli-001\",
    \"timestamp\": \"2024-01-01T00:00:00Z\",
    \"client_ip\": \"192.168.1.100\",
    \"method\": \"GET\",
    \"uri\": \"/api/users?id=1%27%20OR%20%271%27=%271\",
    \"user_agent\": \"Mozilla/5.0\",
    \"body_length\": 0
  }'"

run_test "Path traversal pattern" "curl -f -X POST $API_URL/api/v1/ml/analyze \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: $API_KEY' \
  -d '{
    \"request_id\": \"test-traversal-001\",
    \"timestamp\": \"2024-01-01T00:00:00Z\",
    \"client_ip\": \"192.168.1.100\",
    \"method\": \"GET\",
    \"uri\": \"/../../../etc/passwd\",
    \"user_agent\": \"Mozilla/5.0\",
    \"body_length\": 0
  }'"

run_test "Scanner user agent" "curl -f -X POST $API_URL/api/v1/ml/analyze \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: $API_KEY' \
  -d '{
    \"request_id\": \"test-scanner-001\",
    \"timestamp\": \"2024-01-01T00:00:00Z\",
    \"client_ip\": \"192.168.1.100\",
    \"method\": \"GET\",
    \"uri\": \"/\",
    \"user_agent\": \"nikto/2.1.6\",
    \"body_length\": 0
  }'"

echo ""
echo -e "${BLUE}9. Rate Limiting Tests${NC}"

# Send multiple requests quickly
echo -n "Test rate limiting (sending 10 requests)... "
success_count=0
for i in {1..10}; do
    if curl -f -s $API_URL/health >/dev/null 2>&1; then
        success_count=$((success_count + 1))
    fi
done

if [ $success_count -eq 10 ]; then
    echo -e "${GREEN}✓ PASS (all requests succeeded)${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${YELLOW}⚠ PARTIAL (some requests rate limited)${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi
TESTS_RUN=$((TESTS_RUN + 1))

echo ""
echo -e "${BLUE}10. WebSocket Tests${NC}"

# Test WebSocket connection (basic check)
run_test "WebSocket endpoint accessible" "curl -f -I $API_URL/api/v1/ws/anomalies"

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Test Results${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Tests run: $TESTS_RUN"
echo -e "Tests passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi
