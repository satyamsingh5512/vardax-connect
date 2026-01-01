# VARDAx Traffic Generation Guide

Complete guide to generating traffic for demos, testing, and development.

---

## 🎯 Quick Start (30 seconds)

```bash
# Terminal 1: Start VARDAx
npm run dev

# Terminal 2: Generate traffic
cd backend
source venv/bin/activate
python scripts/demo_traffic.py
```

**That's it!** Open http://localhost:3000 and watch the dashboard fill with data.

---

## 📊 **Method 1: Demo Traffic Script** (RECOMMENDED)

### **Basic Usage**

```bash
# Default: Mixed traffic for 60 seconds at 50 req/s
python scripts/demo_traffic.py

# Custom duration and rate
python scripts/demo_traffic.py --duration 120 --rate 100
```

### **Attack Scenarios**

#### **1. Mixed Traffic (Realistic)**
```bash
python scripts/demo_traffic.py --scenario mixed --attack-rate 0.15
```
- 85% normal traffic
- 15% various attacks
- Best for demos

#### **2. Bot Attack**
```bash
python scripts/demo_traffic.py --scenario bot --rate 100
```
- High-rate scanning
- Sequential endpoint access
- Scanner user agents
- Shows bot detection

#### **3. Credential Stuffing**
```bash
python scripts/demo_traffic.py --scenario credential --rate 75
```
- Login brute force
- Multiple failed attempts
- Shows rate-based detection

#### **4. Zero-Day Simulation**
```bash
python scripts/demo_traffic.py --scenario zero_day
```
- Novel attack patterns
- High entropy payloads
- Shows ML anomaly detection

### **Demo Sequences**

#### **For Presentations (5 minutes):**
```bash
# 1. Start with normal traffic (30s)
python scripts/demo_traffic.py --scenario mixed --attack-rate 0.05 --duration 30

# 2. Ramp up attacks (60s)
python scripts/demo_traffic.py --scenario mixed --attack-rate 0.3 --duration 60

# 3. Focused bot attack (30s)
python scripts/demo_traffic.py --scenario bot --duration 30

# 4. Back to normal (30s)
python scripts/demo_traffic.py --scenario mixed --attack-rate 0.05 --duration 30
```

#### **For Testing (Continuous):**
```bash
# Run indefinitely with realistic traffic
while true; do
  python scripts/demo_traffic.py --scenario mixed --attack-rate 0.1 --duration 300
  sleep 10
done
```

---

## 🔧 **Method 2: Quick Test Script**

For quick testing without Python:

```bash
./scripts/quick_test.sh
```

This sends:
- 1 normal request
- 1 SQL injection
- 1 scanner detection
- 1 path traversal
- 5 credential stuffing attempts

**Perfect for:**
- Quick functionality check
- Testing specific attack types
- Debugging

---

## 🌐 **Method 3: Load Testing Tools**

### **Using Apache Bench (ab)**

```bash
# Install (if needed)
sudo apt-get install apache2-utils  # Linux
brew install httpd  # macOS

# Generate load
ab -n 1000 -c 10 http://localhost:8000/api/v1/health
```

### **Using wrk (Advanced)**

```bash
# Install
sudo apt-get install wrk  # Linux
brew install wrk  # macOS

# Generate load with custom script
wrk -t4 -c100 -d30s --script scripts/wrk_traffic.lua http://localhost:8000
```

Create `scripts/wrk_traffic.lua`:
```lua
-- wrk traffic generator for VARDAx
request = function()
  local path = "/api/v1/traffic/ingest"
  local body = string.format([[{
    "request_id": "wrk-%d",
    "timestamp": "%s",
    "client_ip": "192.168.1.%d",
    "method": "GET",
    "uri": "/api/test",
    "user_agent": "wrk",
    "body_length": 0
  }]], math.random(1000000), os.date("!%Y-%m-%dT%H:%M:%SZ"), math.random(1, 254))
  
  return wrk.format("POST", path, {["Content-Type"] = "application/json"}, body)
end
```

### **Using hey (Modern)**

```bash
# Install
go install github.com/rakyll/hey@latest

# Generate load
hey -n 1000 -c 50 -m POST \
  -H "Content-Type: application/json" \
  -d '{"request_id":"hey-001","timestamp":"2024-01-01T00:00:00Z","client_ip":"192.168.1.1","method":"GET","uri":"/api/test","user_agent":"hey","body_length":0}' \
  http://localhost:8000/api/v1/traffic/ingest
```

---

## 🎬 **Method 4: Browser Traffic**

### **Manual Testing**

1. Open dashboard: http://localhost:3000
2. Click around different pages
3. Each page load generates traffic
4. Check "Live Traffic" tab to see your own requests

### **Browser Console**

Open browser console (F12) and run:

```javascript
// Send test traffic from browser
async function sendTestTraffic(count = 10) {
  const API_URL = 'http://localhost:8000/api/v1/traffic/ingest';
  
  for (let i = 0; i < count; i++) {
    const data = {
      request_id: `browser-${Date.now()}-${i}`,
      timestamp: new Date().toISOString(),
      client_ip: `192.168.1.${Math.floor(Math.random() * 254) + 1}`,
      method: 'GET',
      uri: '/api/test',
      user_agent: navigator.userAgent,
      body_length: 0,
      has_cookie: true
    };
    
    await fetch(API_URL, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(data)
    });
    
    console.log(`Sent request ${i + 1}/${count}`);
    await new Promise(r => setTimeout(r, 100));
  }
  
  console.log('✅ Test traffic sent!');
}

// Run it
sendTestTraffic(20);
```

---

## 📈 **Traffic Patterns for Different Demos**

### **Demo 1: Normal Operation**
```bash
# Show system handling normal traffic
python scripts/demo_traffic.py --scenario mixed --attack-rate 0.02 --duration 60 --rate 50
```
**Shows:** Low anomaly rate, clean dashboard

### **Demo 2: Under Attack**
```bash
# Show system detecting attacks
python scripts/demo_traffic.py --scenario mixed --attack-rate 0.4 --duration 90 --rate 100
```
**Shows:** High anomaly rate, rules being generated

### **Demo 3: Bot Detection**
```bash
# Show bot detection capabilities
python scripts/demo_traffic.py --scenario bot --duration 60 --rate 150
```
**Shows:** Bot likelihood scores, scanner detection

### **Demo 4: Zero-Day Detection**
```bash
# Show ML detecting novel attacks
python scripts/demo_traffic.py --scenario zero_day --duration 60 --rate 50
```
**Shows:** ML anomaly detection without signatures

### **Demo 5: Continuous Learning**
```bash
# Generate traffic, mark false positives, show learning
python scripts/demo_traffic.py --scenario mixed --duration 300 --rate 75
# Then use dashboard to mark false positives
# System learns and improves
```
**Shows:** Feedback loop, model improvement

---

## 🎯 **Recommended Demo Flow**

### **5-Minute Demo:**

```bash
# 1. Start system
npm run dev

# 2. Show empty dashboard (10s)
# Open http://localhost:3000

# 3. Start normal traffic (30s)
python scripts/demo_traffic.py --scenario mixed --attack-rate 0.05 --duration 30 --rate 30

# 4. Explain features while traffic flows

# 5. Ramp up attacks (60s)
python scripts/demo_traffic.py --scenario mixed --attack-rate 0.3 --duration 60 --rate 50

# 6. Show anomalies being detected

# 7. Bot attack wave (30s)
python scripts/demo_traffic.py --scenario bot --duration 30 --rate 100

# 8. Show rule generation

# 9. Back to normal (30s)
python scripts/demo_traffic.py --scenario mixed --attack-rate 0.05 --duration 30 --rate 30

# 10. Show dashboard features
```

### **15-Minute Deep Dive:**

```bash
# Phase 1: Baseline (2 min)
python scripts/demo_traffic.py --scenario mixed --attack-rate 0.02 --duration 120 --rate 40

# Phase 2: SQL Injection Wave (2 min)
# Manually send SQL injection attempts
for i in {1..50}; do
  curl -X POST http://localhost:8000/api/v1/traffic/ingest \
    -H "Content-Type: application/json" \
    -d "{\"request_id\":\"sqli-$i\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"client_ip\":\"10.0.0.5\",\"method\":\"GET\",\"uri\":\"/api/users?id=1' OR '1'='1\",\"user_agent\":\"sqlmap/1.7.2\",\"body_length\":0}"
  sleep 0.5
done

# Phase 3: Credential Stuffing (3 min)
python scripts/demo_traffic.py --scenario credential --duration 180 --rate 60

# Phase 4: Zero-Day (3 min)
python scripts/demo_traffic.py --scenario zero_day --duration 180 --rate 50

# Phase 5: Mixed Recovery (5 min)
python scripts/demo_traffic.py --scenario mixed --attack-rate 0.1 --duration 300 --rate 50
```

---

## 🔍 **Monitoring Traffic**

### **Watch Live Traffic:**
```bash
# Terminal 1: Generate traffic
python scripts/demo_traffic.py

# Terminal 2: Watch API logs
docker-compose logs -f vardax-backend

# Terminal 3: Watch database
watch -n 1 'curl -s http://localhost:8000/api/v1/stats/live | jq'
```

### **Check Metrics:**
```bash
# Get current stats
curl http://localhost:8000/api/v1/stats/live | jq

# Get anomalies
curl http://localhost:8000/api/v1/anomalies?limit=10 | jq

# Get ML health
curl http://localhost:8000/api/v1/ml/health | jq
```

---

## 🎨 **Custom Traffic Patterns**

### **Create Your Own Pattern:**

```python
# scripts/custom_traffic.py
import requests
import time
from datetime import datetime

API_URL = "http://localhost:8000/api/v1/traffic/ingest"

def send_custom_request(uri, method="GET", is_attack=False):
    data = {
        "request_id": f"custom-{int(time.time() * 1000)}",
        "timestamp": datetime.utcnow().isoformat(),
        "client_ip": "10.0.0.5" if is_attack else "192.168.1.100",
        "method": method,
        "uri": uri,
        "user_agent": "sqlmap/1.7.2" if is_attack else "Mozilla/5.0",
        "body_length": 0,
        "has_cookie": not is_attack
    }
    
    response = requests.post(API_URL, json=data)
    print(f"Sent: {uri} - Status: {response.status_code}")

# Your custom pattern
for i in range(10):
    send_custom_request("/api/users", "GET", is_attack=False)
    time.sleep(0.5)
    
    if i % 3 == 0:
        send_custom_request("/api/admin", "GET", is_attack=True)
        time.sleep(0.5)
```

---

## 📊 **Traffic Volume Guidelines**

| Purpose | Duration | Rate (req/s) | Attack Rate |
|---------|----------|--------------|-------------|
| Quick test | 30s | 10 | 0.2 |
| Demo | 60-120s | 50 | 0.15 |
| Load test | 300s | 100-200 | 0.1 |
| Stress test | 600s | 500+ | 0.05 |
| Continuous | Infinite | 50 | 0.1 |

---

## 🐛 **Troubleshooting**

### **No traffic showing in dashboard:**
```bash
# Check backend is running
curl http://localhost:8000/health

# Check database
curl http://localhost:8000/api/v1/admin/db-stats

# Check WebSocket connection (browser console)
# Should see WebSocket connected
```

### **Traffic script errors:**
```bash
# Check Python dependencies
pip install aiohttp

# Check backend URL
python scripts/demo_traffic.py --url http://localhost:8000
```

### **Slow traffic generation:**
```bash
# Reduce rate
python scripts/demo_traffic.py --rate 20

# Check system resources
./scripts/system_status.sh
```

---

## 🎓 **Best Practices**

1. **Start slow** - Begin with low rate (20-30 req/s)
2. **Ramp up gradually** - Increase rate over time
3. **Mix scenarios** - Use different attack types
4. **Monitor resources** - Watch CPU/memory
5. **Clear data** - Reset between demos if needed

```bash
# Clear all data
curl -X POST http://localhost:8000/api/v1/admin/clear-data
```

---

## 🚀 **Quick Commands Cheat Sheet**

```bash
# Basic demo
python scripts/demo_traffic.py

# High attack rate
python scripts/demo_traffic.py --attack-rate 0.4

# Bot attack
python scripts/demo_traffic.py --scenario bot

# Quick test
./scripts/quick_test.sh

# Continuous traffic
while true; do python scripts/demo_traffic.py --duration 300; sleep 10; done

# Check stats
curl http://localhost:8000/api/v1/stats/live | jq

# Clear data
curl -X POST http://localhost:8000/api/v1/admin/clear-data
```

---

**Now go generate some traffic and watch VARDAx in action!** 🎉
