#!/bin/bash
# Quick traffic test for VARDAx

API_URL="${API_URL:-http://localhost:8000}"

echo "🚀 Sending test traffic to VARDAx..."
echo ""

# 1. Normal request
echo "1. Normal request..."
curl -X POST "$API_URL/api/v1/traffic/ingest" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "test-normal-001",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "client_ip": "192.168.1.100",
    "method": "GET",
    "uri": "/api/users",
    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
    "body_length": 0,
    "has_cookie": true
  }'
echo ""

# 2. SQL Injection attempt
echo "2. SQL Injection attempt..."
curl -X POST "$API_URL/api/v1/traffic/ingest" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "test-sqli-001",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "client_ip": "10.0.0.5",
    "method": "GET",
    "uri": "/api/users?id=1%27%20OR%20%271%27=%271",
    "user_agent": "sqlmap/1.7.2",
    "body_length": 0,
    "has_cookie": false
  }'
echo ""

# 3. Scanner detection
echo "3. Scanner detection..."
curl -X POST "$API_URL/api/v1/traffic/ingest" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "test-scanner-001",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "client_ip": "10.0.0.5",
    "method": "GET",
    "uri": "/admin/config",
    "user_agent": "nikto/2.1.6",
    "body_length": 0,
    "has_cookie": false
  }'
echo ""

# 4. Path traversal
echo "4. Path traversal..."
curl -X POST "$API_URL/api/v1/traffic/ingest" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "test-traversal-001",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "client_ip": "10.0.0.5",
    "method": "GET",
    "uri": "/api/files/../../../etc/passwd",
    "user_agent": "curl/7.88.1",
    "body_length": 0,
    "has_cookie": false
  }'
echo ""

# 5. Credential stuffing
echo "5. Credential stuffing..."
for i in {1..5}; do
  curl -X POST "$API_URL/api/v1/traffic/ingest" \
    -H "Content-Type: application/json" \
    -d '{
      "request_id": "test-cred-'$i'",
      "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
      "client_ip": "172.16.1.10",
      "method": "POST",
      "uri": "/api/auth/login",
      "user_agent": "python-requests/2.31.0",
      "body_length": 100,
      "has_cookie": false
    }' &
done
wait
echo ""

echo "✅ Test traffic sent! Check dashboard at http://localhost:3000"
