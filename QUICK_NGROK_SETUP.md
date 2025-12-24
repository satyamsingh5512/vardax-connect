# ⚡ Quick ngrok Setup - 5 Minutes

**Get your local VARDAx protecting remote projects in 5 minutes!**

---

## 🎯 What You're Building

```
Your Local Machine          →  Internet  →  Your Project (Anywhere)
├── VARDAx (port 8000)                     ├── Your App
└── ngrok tunnel                           └── vardax-connect
    https://abc123.ngrok.io                    (connects to ngrok)
```

---

## ⚡ Quick Start

### Step 1: Start VARDAx (2 minutes)

```bash
cd /path/to/vardax
npm run dev
```

**Verify:** http://localhost:8000/health

---

### Step 2: Start ngrok (1 minute)

```bash
# Install ngrok (first time only)
brew install ngrok  # macOS
# or download from https://ngrok.com/download

# Get auth token from https://dashboard.ngrok.com/get-started/your-authtoken
ngrok config add-authtoken YOUR_TOKEN

# Start tunnel
ngrok http 8000
```

**Copy the URL:** `https://abc123.ngrok.io`

---

### Step 3: Protect Your App (2 minutes)

**In your project:**

```bash
npm install /path/to/vardax/vardax-connect
```

**In your app.js:**

```javascript
const vardax = require('vardax-connect');

app.use(vardax('vardax://abc123.ngrok.io'));
//              ^^^^^^^^^^^^^^^^
//              Your ngrok URL (without https://)
```

**Start your app:**

```bash
node app.js
```

---

## ✅ Test It

```bash
# Make a request
curl http://localhost:YOUR_PORT/api/users

# Check VARDAx dashboard
open http://localhost:3000
```

**You should see the request in the dashboard!** 🎉

---

## 📋 Terminal Layout

```
Terminal 1: VARDAx
$ npm run dev
✓ Running on localhost:8000

Terminal 2: ngrok  
$ ngrok http 8000
✓ Forwarding https://abc123.ngrok.io

Terminal 3: Your App
$ node app.js
✓ Protected by VARDAx via ngrok
```

---

## 🔧 Connection String Options

```javascript
// Basic
vardax://abc123.ngrok.io

// Monitor mode (default)
vardax://abc123.ngrok.io?mode=monitor

// Protect mode (blocks attacks)
vardax://abc123.ngrok.io?mode=protect

// With API key
vardax://abc123.ngrok.io?apiKey=secret

// Debug mode
vardax://abc123.ngrok.io?debug=true
```

---

## 🐛 Quick Troubleshooting

### "Connection refused"
```bash
# Check VARDAx is running
curl http://localhost:8000/health

# Check ngrok is running
curl https://abc123.ngrok.io/health
```

### "ngrok not found"
```bash
# Install ngrok
brew install ngrok  # macOS
# or download from https://ngrok.com/download
```

### "Session expired"
```bash
# Free tier expires after 2 hours
# Just restart ngrok
ngrok http 8000
```

---

## 📚 Full Guide

See **NGROK_SETUP_COMPLETE_GUIDE.md** for:
- Detailed explanations
- Production setup
- Security best practices
- Remote deployment
- Advanced configuration

---

**That's it! Your local VARDAx now protects projects anywhere!** 🛡️
