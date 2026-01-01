# 🌐 Complete ngrok Setup Guide for VARDAx

**End-to-end guide for connecting your local VARDAx firewall to any remote project using ngrok**

---

## 🎯 What We're Building

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  [Your Local Machine]                                       │
│   ├── VARDAx Firewall (localhost:8000)                     │
│   └── ngrok Tunnel (exposes VARDAx to internet)            │
│         │                                                   │
│         ▼                                                   │
│  https://abc123.ngrok.io ← Public URL                      │
│         │                                                   │
│         ▼                                                   │
│  [Remote Server / Your Project]                            │
│   └── Your App with vardax-connect                         │
│       (connects to ngrok URL)                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Result:** Your local VARDAx protects ANY project, ANYWHERE in the world!

---

## 📋 Prerequisites

- ✅ VARDAx installed on your local machine
- ✅ ngrok account (free tier works!)
- ✅ A project/app you want to protect (can be anywhere)

---

## 🚀 Part 1: Setup VARDAx Firewall (Local Machine)

### Step 1: Install VARDAx

```bash
# Clone or navigate to VARDAx directory
cd /path/to/vardax

# Install dependencies
npm install
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cd ..
```

### Step 2: Start VARDAx

```bash
# Start VARDAx (backend + frontend)
npm run dev
```

**Verify it's running:**
- Backend: http://localhost:8000
- Dashboard: http://localhost:3000

```bash
# Test backend
curl http://localhost:8000/health
# Should return: {"status": "healthy"}
```

---

## 🌐 Part 2: Setup ngrok Tunnel

### Step 1: Install ngrok

**Option A: Download from website**
```bash
# Go to https://ngrok.com/download
# Download for your OS
# Extract and move to PATH
```

**Option B: Using package manager**
```bash
# macOS
brew install ngrok

# Linux (Snap)
snap install ngrok

# Linux (apt)
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | \
  sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null && \
  echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | \
  sudo tee /etc/apt/sources.list.d/ngrok.list && \
  sudo apt update && sudo apt install ngrok
```

### Step 2: Create ngrok Account

1. Go to https://dashboard.ngrok.com/signup
2. Sign up (free)
3. Get your auth token from https://dashboard.ngrok.com/get-started/your-authtoken

### Step 3: Configure ngrok

```bash
# Add your auth token
ngrok config add-authtoken YOUR_AUTH_TOKEN_HERE
```

### Step 4: Start ngrok Tunnel

```bash
# Expose VARDAx backend (port 8000)
ngrok http 8000
```

**You'll see output like:**

```
ngrok                                                                    

Session Status                online
Account                       your-email@example.com
Version                       3.x.x
Region                        United States (us)
Latency                       -
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abc123.ngrok.io -> http://localhost:8000

Connections                   ttl     opn     rt1     rt5     p50     p90
                              0       0       0.00    0.00    0.00    0.00
```

**IMPORTANT:** Copy the `Forwarding` URL: `https://abc123.ngrok.io`

### Step 5: Test ngrok Tunnel

```bash
# Test from another terminal
curl https://abc123.ngrok.io/health

# Should return: {"status": "healthy"}
```

**✅ Your VARDAx is now accessible from anywhere!**

---

## 📦 Part 3: Setup Your Project (Remote or Local)

This is the project you want to protect. It can be:
- On the same machine (different directory)
- On a remote server
- On a cloud platform (AWS, DigitalOcean, etc.)
- On your friend's computer

### Step 1: Create or Navigate to Your Project

```bash
# Option A: Create new project
mkdir my-protected-app
cd my-protected-app
npm init -y

# Option B: Use existing project
cd /path/to/your/existing/project
```

### Step 2: Install Dependencies

```bash
# Install Express (if not already installed)
npm install express

# Install vardax-connect
npm install /path/to/vardax/vardax-connect
# Or if published: npm install vardax-connect
```

### Step 3: Create Your App

Create `app.js`:

```javascript
const express = require('express');
const vardax = require('../vardax/vardax-connect'); // Adjust path

const app = express();
app.use(express.json());

// ============================================
// 🛡️ CONNECT TO YOUR LOCAL VARDAX VIA NGROK
// ============================================
app.use(vardax('vardax://abc123.ngrok.io?mode=monitor&debug=true'));
//              ^^^^^^^^^^^^^^^^
//              Replace with YOUR ngrok URL (without https://)
// ============================================

// Your routes (now protected by VARDAx)
app.get('/', (req, res) => {
  res.json({
    message: 'Hello! Protected by VARDAx',
    anomaly_score: req.vardax?.score || 0,
    request_id: req.vardax?.requestId
  });
});

app.get('/api/users', (req, res) => {
  res.json({
    users: [
      { id: 1, name: 'John' },
      { id: 2, name: 'Jane' }
    ],
    vardax_protected: true
  });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  console.log('Login attempt - Anomaly score:', req.vardax?.score);
  
  res.json({
    success: true,
    token: 'jwt-token-here'
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║  🛡️  Your App Protected by VARDAx                         ║
║                                                            ║
║  Status: Running on port ${PORT}                              ║
║  Protected by: VARDAx via ngrok                           ║
║  Firewall: https://abc123.ngrok.io                        ║
║                                                            ║
║  Test: curl http://localhost:${PORT}/                         ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});
```

### Step 4: Start Your App

```bash
node app.js
```

---

## 🧪 Part 4: Test the Complete Setup

### Terminal Layout

You should have 3 terminals open:

```
Terminal 1: VARDAx
$ npm run dev
✓ VARDAx running on localhost:8000

Terminal 2: ngrok
$ ngrok http 8000
✓ Forwarding https://abc123.ngrok.io -> localhost:8000

Terminal 3: Your App
$ node app.js
✓ App running on localhost:4000
✓ Connected to VARDAx via ngrok
```

### Test 1: Normal Request

```bash
curl http://localhost:4000/api/users
```

**Expected:**
- Your app returns data
- VARDAx dashboard shows the request
- Low anomaly score

### Test 2: Attack Request

```bash
curl "http://localhost:4000/api/users?id=1' OR '1'='1"
```

**Expected:**
- Request is logged
- VARDAx detects SQL injection
- High anomaly score
- Shows in dashboard as attack

### Test 3: Check VARDAx Dashboard

Open http://localhost:3000

You should see:
- All requests from your app
- Anomaly scores
- Attack detections
- Real-time monitoring

---

## 🌍 Part 5: Deploy Your App to Remote Server

### Scenario: Deploy to DigitalOcean/AWS/Any Server

**On your remote server:**

```bash
# 1. Clone your project
git clone https://github.com/your-username/your-app
cd your-app

# 2. Install dependencies
npm install

# 3. Create .env file
cat > .env << EOF
VARDAX_URL=https://abc123.ngrok.io
PORT=4000
EOF

# 4. Update app.js to use environment variable
```

**Updated app.js:**

```javascript
require('dotenv').config();
const vardax = require('vardax-connect');

// Use environment variable for ngrok URL
const vardaxUrl = process.env.VARDAX_URL || 'vardax://localhost:8000';
app.use(vardax(vardaxUrl + '?mode=monitor'));
```

**Start your app:**

```bash
# 5. Start app
node app.js

# Or with PM2 for production
npm install -g pm2
pm2 start app.js --name "my-protected-app"
```

**✅ Your remote app is now protected by your local VARDAx!**

---

## 🔒 Part 6: Security Best Practices

### 1. Use ngrok Auth Token

```bash
# Add auth token to ngrok
ngrok config add-authtoken YOUR_TOKEN
```

### 2. Use API Key

**In your app:**

```javascript
app.use(vardax('vardax://abc123.ngrok.io?apiKey=your-secret-key'));
```

**In VARDAx backend** (backend/app/api/routes.py):

```python
@router.post("/traffic/ingest")
async def ingest_traffic(request: Request):
    api_key = request.headers.get("X-API-Key")
    if api_key != "your-secret-key":
        raise HTTPException(403, "Invalid API key")
    # ... rest of code
```

### 3. Use Environment Variables

```bash
# .env
VARDAX_URL=https://abc123.ngrok.io
VARDAX_API_KEY=your-secret-key
```

```javascript
// app.js
require('dotenv').config();

app.use(vardax(
  `vardax://${process.env.VARDAX_URL}?apiKey=${process.env.VARDAX_API_KEY}`
));
```

### 4. Monitor ngrok Dashboard

Open http://127.0.0.1:4040 to see:
- All requests through ngrok
- Request/response details
- Replay requests

---

## 🎯 Part 7: Production Setup

### Option 1: Keep ngrok Running (Simple)

```bash
# Use screen or tmux to keep ngrok running
screen -S ngrok
ngrok http 8000
# Press Ctrl+A, then D to detach

# Reattach later
screen -r ngrok
```

### Option 2: ngrok as Service (Better)

Create `/etc/systemd/system/ngrok.service`:

```ini
[Unit]
Description=ngrok tunnel
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/home/your-username
ExecStart=/usr/local/bin/ngrok http 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable ngrok
sudo systemctl start ngrok
```

### Option 3: Use ngrok Reserved Domain (Paid)

```bash
# Get a permanent domain from ngrok dashboard
ngrok http 8000 --domain=your-app.ngrok.io
```

---

## 📊 Part 8: Monitoring & Debugging

### Check VARDAx Logs

```bash
# Backend logs
tail -f backend/logs/vardax.log
```

### Check ngrok Logs

```bash
# ngrok web interface
open http://127.0.0.1:4040
```

### Check Your App Logs

```bash
# If using PM2
pm2 logs my-protected-app

# If using node directly
# Check terminal output
```

### Test Connection

```bash
# Test ngrok → VARDAx
curl https://abc123.ngrok.io/health

# Test app → ngrok → VARDAx
curl http://localhost:4000/api/users
```

---

## 🐛 Troubleshooting

### Problem 1: "Connection Refused"

**Solution:**
```bash
# Check VARDAx is running
curl http://localhost:8000/health

# Check ngrok is running
curl https://abc123.ngrok.io/health
```

### Problem 2: "CORS Error"

**Solution:** Update VARDAx CORS settings in `backend/app/main.py`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Problem 3: "ngrok Session Expired"

**Solution:**
```bash
# Free tier: ngrok sessions expire after 2 hours
# Restart ngrok
ngrok http 8000

# Or upgrade to paid plan for persistent URLs
```

### Problem 4: "High Latency"

**Solution:**
```bash
# Use ngrok region closer to you
ngrok http 8000 --region=us  # US
ngrok http 8000 --region=eu  # Europe
ngrok http 8000 --region=ap  # Asia Pacific
ngrok http 8000 --region=au  # Australia
```

---

## 📝 Quick Reference

### Start Everything

```bash
# Terminal 1: VARDAx
cd /path/to/vardax
npm run dev

# Terminal 2: ngrok
ngrok http 8000
# Copy the URL: https://abc123.ngrok.io

# Terminal 3: Your App
cd /path/to/your-app
# Update app.js with ngrok URL
node app.js
```

### Connection String Format

```javascript
// Basic
vardax://abc123.ngrok.io

// With options
vardax://abc123.ngrok.io?mode=monitor&debug=true

// With API key
vardax://abc123.ngrok.io?apiKey=secret&mode=protect

// Full URL (also works)
https://abc123.ngrok.io
```

### Environment Variables

```bash
# .env
VARDAX_URL=abc123.ngrok.io
VARDAX_API_KEY=your-secret-key
VARDAX_MODE=monitor
```

```javascript
// app.js
app.use(vardax(
  `vardax://${process.env.VARDAX_URL}?` +
  `apiKey=${process.env.VARDAX_API_KEY}&` +
  `mode=${process.env.VARDAX_MODE}`
));
```

---

## 🎉 Success Checklist

- [ ] VARDAx running on localhost:8000
- [ ] ngrok tunnel active (https://abc123.ngrok.io)
- [ ] Your app running with vardax-connect
- [ ] Test request works
- [ ] Attack detected in dashboard
- [ ] Logs showing in all 3 terminals

---

## 🔗 Next Steps

1. **Test thoroughly:**
   - Normal requests
   - Attack requests
   - Different endpoints

2. **Monitor dashboard:**
   - Check anomaly scores
   - Review detections
   - Tune thresholds

3. **Deploy to production:**
   - Use environment variables
   - Add API key authentication
   - Set up monitoring

4. **Scale up:**
   - Add more protected apps
   - Use ngrok reserved domains
   - Set up load balancing

---

## 📚 Additional Resources

- **VARDAx Documentation:** See README.md
- **vardax-connect Guide:** See HOW_TO_USE_VARDAX_CONNECT.md
- **ngrok Documentation:** https://ngrok.com/docs
- **Examples:** See vardax-connect/examples/

---

**You now have a complete setup where your local VARDAx firewall protects ANY project, ANYWHERE!** 🛡️🌍

Questions? Check the troubleshooting section or create an issue on GitHub.
