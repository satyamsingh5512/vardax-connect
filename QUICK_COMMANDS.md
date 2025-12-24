# ⚡ VARDAx Quick Commands

**Copy-paste these commands to get started fast!**

---

## 🚀 Start Everything (Recommended)

```bash
npm run dev
```

This starts:
- Backend (port 8000)
- Frontend (port 3000)
- Opens dashboard automatically

---

## 🔧 Individual Components

### Backend Only
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

### Frontend Only
```bash
cd frontend
npm run dev
```

### Protected Demo Backend
```bash
cd protected-demo/backend
npm start
```

---

## 🧪 Testing Commands

### Test Reverse Proxy
```bash
# Terminal 1: Start protected demo
cd protected-demo/backend && npm start

# Terminal 2: Test through VARDAx
curl http://localhost:8000/protected/

# Should see: Protected by VARDAx
```

### Test Direct Traffic
```bash
# Send normal request
curl -X POST http://localhost:8000/api/v1/traffic/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "test-123",
    "timestamp": "2024-01-01T12:00:00Z",
    "client_ip": "192.168.1.100",
    "method": "GET",
    "uri": "/api/users"
  }'

# Send attack request
curl -X POST http://localhost:8000/api/v1/traffic/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "attack-123",
    "timestamp": "2024-01-01T12:00:00Z",
    "client_ip": "192.168.1.100",
    "method": "GET",
    "uri": "/api/users?id=1'\'' OR '\''1'\''='\''1",
    "user_agent": "sqlmap/1.7.2"
  }'
```

### Generate Demo Traffic
```bash
# Quick test (10 requests)
./scripts/quick_test.sh

# Continuous traffic
cd scripts
python3 demo_traffic.py --scenario mixed --duration 60
```

---

## 🌐 SDK Setup

### 1. Expose VARDAx with ngrok
```bash
# Terminal 1: Start VARDAx
npm run dev

# Terminal 2: Start ngrok
ngrok http 8000

# Copy URL: https://abc123.ngrok.io
```

### 2. Add SDK to Website
```html
<script src="vardax-sdk.js"></script>
<script>
  VARDAx.init({
    apiUrl: 'https://abc123.ngrok.io',
    mode: 'monitor',
    debug: true
  });
</script>
```

### 3. Test SDK Example
```bash
cd vardax-sdk
open example.html
# Update ngrok URL in the script
```

---

## 📊 Check Status

### System Health
```bash
curl http://localhost:8000/health
```

### Protected Backend Status
```bash
curl http://localhost:8000/protected-status
```

### Dashboard
```bash
open http://localhost:3000
```

---

## 🔍 Verify Setup

```bash
./scripts/verify_setup.sh
```

---

## 🐛 Troubleshooting

### Backend won't start
```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
```

### Frontend won't start
```bash
cd frontend
npm install
```

### Protected demo won't start
```bash
cd protected-demo/backend
npm install
```

### Port already in use
```bash
# Kill process on port 8000
lsof -ti:8000 | xargs kill -9

# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

---

## 📦 Install Dependencies

### All at once
```bash
# Root
npm install

# Backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Frontend
cd frontend
npm install

# Protected demo
cd protected-demo/backend
npm install
```

---

## 🚢 Deploy Demo Website

### Vercel
```bash
cd demo-website
vercel --prod
```

### Netlify
```bash
cd demo-website
netlify deploy --prod
```

---

## 📝 View Logs

### Backend logs
```bash
tail -f backend/logs/vardax.log
```

### Frontend logs
Check browser console (F12)

---

## 🎯 Quick Demo Flow

```bash
# 1. Start VARDAx
npm run dev

# 2. Open dashboard
open http://localhost:3000

# 3. Generate traffic
./scripts/quick_test.sh

# 4. Watch detections in dashboard!
```

---

## 🔗 Important URLs

- **Backend API:** http://localhost:8000
- **Frontend Dashboard:** http://localhost:3000
- **Protected Demo:** http://localhost:4000
- **API Docs:** http://localhost:8000/docs
- **Health Check:** http://localhost:8000/health

---

## 💡 Pro Tips

### Keep ngrok URL stable
```bash
# Use ngrok with auth token for persistent URLs
ngrok config add-authtoken YOUR_TOKEN
ngrok http 8000 --domain=your-domain.ngrok.io
```

### Auto-restart on changes
```bash
# Backend auto-reloads with --reload flag
# Frontend auto-reloads with Vite
```

### Check Python version
```bash
python3 --version
# Should be 3.8+
```

### Check Node version
```bash
node --version
# Should be 16+
```

---

**Need help? Check:**
- `START_HERE.md` - Getting started guide
- `README.md` - Full documentation
- `SDK_COMPLETE.md` - SDK integration
- `SYSTEM_STATUS.md` - Current status
