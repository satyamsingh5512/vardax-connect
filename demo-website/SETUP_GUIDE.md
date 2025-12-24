# 🚀 VARDAx Demo Website - Complete Setup Guide

**Get your demo running in 10 minutes!**

---

## 📋 What You're Building

```
┌─────────────────────────────────────────────────────────────┐
│                                                               │
│  [Demo Website on Vercel] ──────────────────────┐           │
│   https://vardax-demo.vercel.app                 │           │
│   (Accessible from anywhere)                     │           │
│                                                   │           │
│                                                   ▼           │
│                                            [ngrok Tunnel]     │
│                                            https://abc.ngrok  │
│                                                   │           │
│                                                   ▼           │
│  [Your Local VARDAx] ◄──────────────────────────┘           │
│   http://localhost:8000                                      │
│   (Running on your machine)                                  │
│                                                               │
│  [VARDAx Dashboard]                                          │
│   http://localhost:3000                                      │
│   (Shows detections)                                         │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚡ Quick Setup (10 Minutes)

### **Step 1: Install ngrok** (2 minutes)

#### **Option A: Download**
1. Go to https://ngrok.com/download
2. Download for your OS
3. Extract and move to PATH

#### **Option B: Package Manager**
```bash
# macOS
brew install ngrok

# Linux (Snap)
sudo snap install ngrok

# Windows (Chocolatey)
choco install ngrok
```

#### **Sign up (optional but recommended):**
1. Create account at https://ngrok.com
2. Get your auth token
3. Run: `ngrok authtoken YOUR_TOKEN`

---

### **Step 2: Start VARDAx** (1 minute)

```bash
# Navigate to VARDAx project
cd /path/to/vardax

# Start VARDAx
npm run dev
```

Wait for:
```
✓ Backend running on http://localhost:8000
✓ Frontend running on http://localhost:3000
```

---

### **Step 3: Expose with ngrok** (1 minute)

Open a **new terminal**:

```bash
ngrok http 8000
```

You'll see:
```
Session Status                online
Account                       your@email.com
Version                       3.x.x
Region                        United States (us)
Forwarding                    https://abc123.ngrok.io -> http://localhost:8000
```

**Copy the HTTPS URL:** `https://abc123.ngrok.io`

**Keep this terminal open!**

---

### **Step 4: Deploy Demo Website** (3 minutes)

```bash
# Install Vercel CLI (if not installed)
npm install -g vercel

# Navigate to demo-website
cd demo-website

# Deploy
vercel --prod
```

Answer the prompts:
```
? Set up and deploy? Y
? Which scope? [Your account]
? Link to existing project? N
? What's your project's name? vardax-demo-target
? In which directory is your code located? ./
```

You'll get:
```
✅ Production: https://vardax-demo-target.vercel.app
```

**Copy this URL!**

---

### **Step 5: Test the Demo** (3 minutes)

1. **Open demo website:**
   - Go to: `https://vardax-demo-target.vercel.app`

2. **Enter ngrok URL:**
   - Paste your ngrok URL: `https://abc123.ngrok.io`

3. **Send test traffic:**
   - Click "Normal Request" (green button)
   - Should see: "✅ Normal request sent"

4. **Check VARDAx dashboard:**
   - Open: `http://localhost:3000`
   - Go to "Live Traffic" tab
   - You should see the request!

5. **Send attack traffic:**
   - Click "Attack Request" (red button)
   - Check dashboard "Anomalies" tab
   - Should see detection with explanation!

---

## 🎉 You're Done!

You can now:
- ✅ Demo from any device
- ✅ Share the Vercel URL with others
- ✅ Show VARDAx detecting attacks in real-time
- ✅ Access from phone, tablet, anywhere!

---

## 📱 **Demo from Your Phone**

1. Open your phone browser
2. Go to: `https://vardax-demo-target.vercel.app`
3. Enter your ngrok URL
4. Send traffic from your phone
5. Watch detections on your laptop dashboard!

**Perfect for live demos!**

---

## 🎬 **Demo Flow**

### **For Presentations:**

**Setup (5 minutes before):**
```bash
# Terminal 1: VARDAx
cd vardax && npm run dev

# Terminal 2: ngrok
ngrok http 8000

# Browser 1: VARDAx Dashboard
http://localhost:3000

# Browser 2: Demo Website
https://vardax-demo-target.vercel.app
```

**During Demo (5 minutes):**

1. **Show empty dashboard** (10 seconds)
   - "Here's VARDAx, currently no traffic"

2. **Send normal traffic** (30 seconds)
   - Click "Normal Request" 3-4 times
   - "These are legitimate requests, they pass through"
   - Show in "Live Traffic" tab

3. **Send attack traffic** (1 minute)
   - Click "Attack Request" 3-4 times
   - "Now let's try some attacks"
   - Show in "Anomalies" tab
   - Click on anomaly to show explanation

4. **Start continuous traffic** (2 minutes)
   - Double-click or press 'S'
   - "Let's simulate a real attack scenario"
   - Watch metrics update in real-time
   - Show different attack types being detected

5. **Show features** (1.5 minutes)
   - Navigate through dashboard pages
   - Show ML model scores
   - Show rule generation
   - Explain continuous learning

---

## 🔧 **Troubleshooting**

### **Problem: "Not Connected" in demo website**

**Check:**
```bash
# 1. Is VARDAx running?
curl http://localhost:8000/health
# Should return: {"status":"healthy"}

# 2. Is ngrok running?
# Check the ngrok terminal - should show "online"

# 3. Is ngrok URL correct?
# Copy from ngrok terminal, paste in demo website
```

### **Problem: CORS errors in browser console**

**Solution:** VARDAx already has CORS enabled. If still issues:
```bash
# Check backend/app/main.py has:
allow_origins=["*"]
```

### **Problem: ngrok session expired**

**Solution:**
```bash
# Free tier: 2 hour sessions
# Just restart ngrok:
ngrok http 8000

# Update URL in demo website
```

### **Problem: No traffic showing in dashboard**

**Check:**
```bash
# 1. Check database
curl http://localhost:8000/api/v1/admin/db-stats

# 2. Check WebSocket (browser console)
# Should see: "WebSocket connected"

# 3. Clear data and retry
curl -X POST http://localhost:8000/api/v1/admin/clear-data
```

---

## 💡 **Pro Tips**

### **1. Persistent ngrok URL**

Sign up for ngrok account:
```bash
# Get auth token from ngrok.com
ngrok authtoken YOUR_TOKEN

# Now sessions last longer
ngrok http 8000
```

### **2. Custom Domain (Paid)**

```bash
# Get custom subdomain
ngrok http 8000 --subdomain=vardax-demo

# URL: https://vardax-demo.ngrok.io
# Never changes!
```

### **3. Multiple Demo Websites**

Deploy multiple versions:
```bash
# Version 1: Public demo
vercel --prod

# Version 2: Testing
vercel
```

### **4. QR Code for Mobile**

Generate QR code for your Vercel URL:
```bash
# Use: https://www.qr-code-generator.com/
# Enter: https://vardax-demo-target.vercel.app
# Print and show during presentations!
```

---

## 📊 **What to Show**

### **For Technical Interviews:**
- Real-time ML inference
- 3-model ensemble
- Feature extraction (47 features)
- Explainable AI
- Continuous learning

### **For Business Demos:**
- Easy to use interface
- Automatic threat detection
- Clear explanations
- Reduces manual work
- Learns from feedback

### **For Hackathons:**
- Live demo from phone
- Real-time detection
- Production-ready architecture
- Comprehensive system
- Impressive visuals

---

## 🎯 **Quick Commands Cheat Sheet**

```bash
# Start everything
npm run dev                    # VARDAx
ngrok http 8000               # Expose
vercel --prod                 # Deploy demo

# Check status
curl http://localhost:8000/health
curl http://localhost:8000/api/v1/stats/live

# Clear data
curl -X POST http://localhost:8000/api/v1/admin/clear-data

# Redeploy demo website
cd demo-website && vercel --prod
```

---

## 📱 **URLs You Need**

| Service | URL | Purpose |
|---------|-----|---------|
| VARDAx Backend | http://localhost:8000 | API |
| VARDAx Dashboard | http://localhost:3000 | View detections |
| ngrok Tunnel | https://abc123.ngrok.io | Expose backend |
| Demo Website | https://vardax-demo.vercel.app | Send traffic |

---

## ✅ **Pre-Demo Checklist**

- [ ] VARDAx running
- [ ] ngrok running
- [ ] Demo website deployed
- [ ] ngrok URL entered in demo website
- [ ] Test: Normal request works
- [ ] Test: Attack request detected
- [ ] Dashboard shows traffic
- [ ] Anomalies tab shows detections
- [ ] Phone can access demo website
- [ ] Battery charged (for laptop demos)
- [ ] Internet connection stable

---

## 🎓 **Demo Script Template**

```
[1] "I built VARDAx, an ML-powered Web Application Firewall"

[2] "Here's a demo website running on Vercel"
    - Show demo website on phone/tablet

[3] "It sends traffic to my local VARDAx instance"
    - Show architecture diagram

[4] "Let's send some normal traffic"
    - Click normal request 3x
    - Show in dashboard

[5] "Now let's try some attacks"
    - Click attack request 3x
    - Show detections with explanations

[6] "The system uses a 3-model ML ensemble"
    - Show ML Health page
    - Explain Isolation Forest, Autoencoder, EWMA

[7] "It detects attacks in real-time"
    - Start continuous traffic
    - Show live detection

[8] "And automatically generates security rules"
    - Show Rules page
    - Explain rule generation

[9] "The system continuously learns from feedback"
    - Show feedback mechanism
    - Explain continuous learning

[10] "Questions?"
```

---

## 🚀 **You're Ready!**

Everything is set up. Now go:
1. Practice the demo flow
2. Test from different devices
3. Record a video
4. Share with recruiters
5. Impress everyone!

**Good luck!** 💪
