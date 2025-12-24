# 🛡️ VARDAx Real Protection Setup

**Make VARDAx act as a TRUE firewall protecting a real website!**

---

## 🎯 What This Does

Instead of simulating traffic, VARDAx now acts as a **real reverse proxy/firewall**:

```
┌─────────────────────────────────────────────────────────────┐
│                                                               │
│  USER (Browser/App)                                          │
│         │                                                     │
│         ▼                                                     │
│  ┌──────────────────────────────────────────────┐           │
│  │  VARDAx Firewall (localhost:8000)            │           │
│  │  • Receives ALL traffic                      │           │
│  │  • ML analyzes in real-time                  │           │
│  │  • Blocks attacks (403)                      │           │
│  │  • Allows normal traffic                     │           │
│  └──────────────────────────────────────────────┘           │
│         │                                                     │
│         ▼ (only if allowed)                                  │
│  ┌──────────────────────────────────────────────┐           │
│  │  Protected Demo Website (localhost:4000)     │           │
│  │  • Never exposed directly                    │           │
│  │  • Only receives filtered traffic            │           │
│  │  • Vulnerable endpoints protected            │           │
│  └──────────────────────────────────────────────┘           │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚡ Quick Setup (5 Minutes)

### **Step 1: Install Dependencies**

```bash
# Install Node.js dependencies for protected demo
cd protected-demo/backend
npm install
```

### **Step 2: Install httpx for Python**

```bash
# VARDAx needs httpx for proxying
cd ../../backend
source venv/bin/activate
pip install httpx
```

### **Step 3: Start Protected Demo Website**

```bash
# Terminal 1: Start the protected backend
cd protected-demo/backend
npm start
```

You'll see:
```
🛡️  Protected Demo Website
Status: Running
Port: 4000
⚠️  DO NOT ACCESS DIRECTLY!
Access via: http://localhost:8000/protected/*
```

### **Step 4: Start VARDAx**

```bash
# Terminal 2: Start VARDAx (with proxy enabled)
cd ../..
npm run dev
```

### **Step 5: Test Protection**

```bash
# Normal request - SHOULD BE ALLOWED
curl http://localhost:8000/protected/api/users

# Attack request - SHOULD BE BLOCKED
curl "http://localhost:8000/protected/api/users?id=1'%20OR%20'1'='1"

# Scanner - SHOULD BE BLOCKED
curl -H "User-Agent: nikto/2.1.6" http://localhost:8000/protected/admin/config
```

---

## 🎮 How to Use

### **Access Protected Website:**

**❌ WRONG (Direct access - bypasses protection):**
```
http://localhost:4000/api/users
```

**✅ CORRECT (Through VARDAx):**
```
http://localhost:8000/protected/api/users
```

### **All Endpoints:**

| Endpoint | Description | Vulnerability |
|----------|-------------|---------------|
| `/protected/` | Home page | None |
| `/protected/api/users` | User list | SQL injection |
| `/protected/api/users?id=X` | Get user | SQL injection |
| `/protected/api/search?q=X` | Search | XSS |
| `/protected/api/files/:name` | File download | Path traversal |
| `/protected/admin/config` | Admin panel | Unauthorized access |
| `/protected/api/auth/login` | Login | Brute force |

---

## 🧪 Test Scenarios

### **Scenario 1: Normal Traffic (Allowed)**

```bash
# Get users
curl http://localhost:8000/protected/api/users

# Get products
curl http://localhost:8000/protected/api/products

# Search
curl "http://localhost:8000/protected/api/search?q=laptop"
```

**Expected:** ✅ 200 OK, data returned

### **Scenario 2: SQL Injection (Blocked)**

```bash
# SQL injection attempt
curl "http://localhost:8000/protected/api/users?id=1'%20OR%20'1'='1"

# Another SQL injection
curl "http://localhost:8000/protected/api/users?id=1;%20DROP%20TABLE%20users"
```

**Expected:** ❌ 403 Forbidden
```json
{
  "error": "Request blocked by VARDAx WAF",
  "reason": "Suspicious activity detected",
  "anomaly_score": 0.85,
  "explanations": [
    "URI entropy 340% above baseline",
    "Query string has unusual encoding"
  ]
}
```

### **Scenario 3: Path Traversal (Blocked)**

```bash
# Path traversal attempt
curl "http://localhost:8000/protected/api/files/../../etc/passwd"

# Another traversal
curl "http://localhost:8000/protected/api/files/....//....//etc/passwd"
```

**Expected:** ❌ 403 Forbidden

### **Scenario 4: Scanner Detection (Blocked)**

```bash
# Scanner user agent
curl -H "User-Agent: nikto/2.1.6" http://localhost:8000/protected/admin/config

# Another scanner
curl -H "User-Agent: sqlmap/1.7.2" http://localhost:8000/protected/api/users
```

**Expected:** ❌ 403 Forbidden

### **Scenario 5: Brute Force (Blocked after threshold)**

```bash
# Multiple failed login attempts
for i in {1..10}; do
  curl -X POST http://localhost:8000/protected/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"wrong'$i'"}'
done
```

**Expected:** First few allowed, then ❌ 403 Forbidden

---

## 📊 What Happens

### **When Request is Allowed:**

1. User sends request to VARDAx
2. VARDAx extracts 47 features
3. ML models analyze (< 30ms)
4. Anomaly score < 0.8 → ALLOW
5. VARDAx forwards to protected backend
6. Backend processes request
7. VARDAx returns response to user
8. Headers added: `X-VARDAx-Protected: true`

### **When Request is Blocked:**

1. User sends request to VARDAx
2. VARDAx extracts features
3. ML models analyze
4. Anomaly score ≥ 0.8 → BLOCK
5. VARDAx returns 403 Forbidden
6. Request NEVER reaches backend
7. Attack logged in dashboard
8. Rule recommendation generated

---

## 🎬 Demo This

### **Live Demo Setup:**

```bash
# Terminal 1: Protected backend
cd protected-demo/backend && npm start

# Terminal 2: VARDAx
npm run dev

# Terminal 3: Dashboard
# Open http://localhost:3000

# Terminal 4: Send traffic
# Use curl commands above
```

### **Show to Recruiters:**

1. **Show architecture:**
   - "VARDAx sits between users and the website"
   - "All traffic goes through VARDAx first"

2. **Send normal request:**
   ```bash
   curl http://localhost:8000/protected/api/users
   ```
   - "Normal traffic passes through"
   - Show in dashboard: Low anomaly score

3. **Send attack:**
   ```bash
   curl "http://localhost:8000/protected/api/users?id=1'%20OR%20'1'='1"
   ```
   - "SQL injection blocked!"
   - Show 403 response
   - Show in dashboard: High anomaly score with explanation

4. **Show dashboard:**
   - Live Traffic tab: See all requests
   - Anomalies tab: See blocked attacks
   - Rules tab: See generated rules

5. **Explain:**
   - "This is real protection, not simulation"
   - "ML detects attacks in real-time"
   - "Backend never sees malicious traffic"

---

## 🌐 Deploy to Production

### **Option 1: Both on Same Server**

```
User → VARDAx (port 80/443) → Protected App (port 4000)
```

### **Option 2: Separate Servers**

```
User → VARDAx (Server 1) → Protected App (Server 2)
```

Update `backend/app/api/proxy.py`:
```python
PROTECTED_BACKEND_URL = "http://your-backend-server:4000"
```

### **Option 3: With ngrok (Demo)**

```bash
# Terminal 1: Protected backend
cd protected-demo/backend && npm start

# Terminal 2: VARDAx
npm run dev

# Terminal 3: Expose VARDAx
ngrok http 8000
```

Now anyone can access:
```
https://your-ngrok-url.ngrok.io/protected/api/users
```

All traffic goes through VARDAx!

---

## 🔧 Configuration

### **Adjust Thresholds:**

Edit `backend/app/api/proxy.py`:

```python
# Block threshold (0.0 - 1.0)
BLOCK_THRESHOLD = 0.8  # Block if score ≥ 0.8

# Challenge threshold
CHALLENGE_THRESHOLD = 0.5  # Challenge if score ≥ 0.5
```

### **Change Protected Backend URL:**

```python
PROTECTED_BACKEND_URL = "http://your-backend:4000"
```

### **Add Custom Rules:**

You can add fast-path checks before ML:

```python
# In analyze_request()
if "sqlmap" in user_agent.lower():
    return False, 1.0, [{"description": "Known scanner detected"}]
```

---

## 📈 Monitoring

### **Check Protection Status:**

```bash
curl http://localhost:8000/protected-status
```

Response:
```json
{
  "protected_backend": "reachable",
  "status": 200,
  "vardax_protection": "active"
}
```

### **View Blocked Requests:**

```bash
curl http://localhost:8000/api/v1/anomalies?severity=high
```

### **Dashboard:**

Open http://localhost:3000 and see:
- Live Traffic: All requests (allowed + blocked)
- Anomalies: Blocked attacks with explanations
- Rules: Auto-generated security rules

---

## 🎯 Key Differences

### **Before (Simulated Traffic):**
```
Demo Website → Sends fake traffic → VARDAx
```
- Not real protection
- Just monitoring
- No actual blocking

### **After (Real Protection):**
```
User → VARDAx → Protected Website
```
- ✅ Real firewall
- ✅ Actual blocking
- ✅ True protection
- ✅ Production-ready

---

## 💡 Pro Tips

### **1. Test with Browser:**

Open browser and go to:
```
http://localhost:8000/protected/api/users
```

Try attack in URL bar:
```
http://localhost:8000/protected/api/users?id=1'%20OR%20'1'='1
```

You'll see the block page!

### **2. Build Frontend:**

Create a React/HTML frontend that calls:
```javascript
fetch('http://localhost:8000/protected/api/users')
```

All API calls automatically protected!

### **3. Deploy Both:**

Deploy protected backend to Heroku/Render, VARDAx to another server, connect them!

### **4. Add More Endpoints:**

Edit `protected-demo/backend/server.js` to add your own vulnerable endpoints.

---

## ✅ Checklist

- [ ] Protected backend running (port 4000)
- [ ] VARDAx running (port 8000)
- [ ] Test normal request - allowed
- [ ] Test SQL injection - blocked
- [ ] Test scanner - blocked
- [ ] Dashboard shows traffic
- [ ] Anomalies logged
- [ ] Rules generated

---

## 🚀 You Now Have

✅ **Real firewall protection**
✅ **ML-powered blocking**
✅ **Production-ready architecture**
✅ **Actual attack prevention**
✅ **Not just monitoring**

**This is the real deal!** 🛡️

---

## 📚 Next Steps

1. **Test all scenarios** above
2. **Add your own endpoints** to protected backend
3. **Deploy to production** with ngrok or cloud
4. **Show to recruiters** - this is impressive!
5. **Add to resume** - "Built production WAF with real-time protection"

---

**You now have TRUE Cloudflare-style protection!** 💪
