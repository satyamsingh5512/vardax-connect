# VARDAx Demo Target Website

A simple demo website that sends traffic to your local VARDAx instance for demonstration purposes.

---

## 🎯 What This Does

This is a **target website** that:
1. Runs on Vercel (publicly accessible)
2. Sends traffic to your **local VARDAx** instance
3. Allows you to demo VARDAx from any device/network
4. Has buttons to send normal and attack traffic

---

## 🚀 Quick Setup (5 minutes)

### **Step 1: Expose Your Local VARDAx**

Since VARDAx runs on your local machine, you need to expose it to the internet using **ngrok**:

```bash
# Install ngrok (if not installed)
# Download from: https://ngrok.com/download

# Start VARDAx locally
cd /path/to/vardax
npm run dev

# In another terminal, expose port 8000
ngrok http 8000
```

You'll get a URL like: `https://abc123.ngrok.io`

**Copy this URL!** You'll need it.

---

### **Step 2: Deploy to Vercel**

```bash
# Install Vercel CLI (if not installed)
npm install -g vercel

# Navigate to demo-website folder
cd demo-website

# Deploy
vercel --prod
```

Follow the prompts:
- Set up and deploy? **Y**
- Which scope? **Your account**
- Link to existing project? **N**
- Project name? **vardax-demo-target**
- Directory? **./demo-website**

You'll get a URL like: `https://vardax-demo-target.vercel.app`

---

### **Step 3: Use the Demo**

1. Open your Vercel URL: `https://vardax-demo-target.vercel.app`
2. Enter your ngrok URL in the input field
3. Click "Normal Request" or "Attack Request"
4. Watch your local VARDAx dashboard detect the traffic!

---

## 📱 **Demo from Any Device**

Now you can:
- ✅ Open the Vercel URL on your phone
- ✅ Share the URL with others
- ✅ Demo from anywhere with internet
- ✅ All traffic goes to your local VARDAx

---

## 🎮 **How to Use**

### **Buttons:**

1. **Normal Request** (Green)
   - Sends legitimate-looking traffic
   - Should pass through VARDAx
   - Low anomaly score

2. **Attack Request** (Red)
   - Sends malicious traffic patterns
   - Should be detected by VARDAx
   - High anomaly score
   - Examples: SQL injection, path traversal, scanners

3. **Stop Traffic** (Orange)
   - Stops continuous traffic generation
   - Only active when traffic is running

### **Keyboard Shortcuts:**

- **N** - Send normal request
- **A** - Send attack request
- **S** - Start/stop continuous traffic
- **Double-click** - Start continuous traffic

### **Continuous Traffic:**

Double-click anywhere or press **S** to start sending traffic automatically (1 request/second, 30% attacks).

---

## 🔧 **Configuration**

### **Change VARDAx URL:**

Edit the input field to point to your ngrok URL:
```
https://your-ngrok-url.ngrok.io
```

### **Adjust Attack Rate:**

Edit `index.html` line ~380:
```javascript
startContinuousTraffic(0.3); // 30% attack rate
```

---

## 🎬 **Demo Scenarios**

### **Scenario 1: Live Demo**

1. Open VARDAx dashboard on your laptop
2. Open demo website on your phone
3. Send traffic from phone
4. Show detection on laptop dashboard

### **Scenario 2: Presentation**

1. Project VARDAx dashboard on screen
2. Open demo website on another screen/device
3. Send various attack types
4. Explain detections in real-time

### **Scenario 3: Remote Demo**

1. Share Vercel URL with recruiter/interviewer
2. They can send traffic from their device
3. You show the detection on your dashboard
4. Impressive remote demo!

---

## 📊 **What Gets Sent**

### **Normal Request:**
```json
{
  "request_id": "demo-1234567890-5678",
  "timestamp": "2024-01-01T12:00:00Z",
  "client_ip": "192.168.1.100",
  "method": "GET",
  "uri": "/api/users",
  "user_agent": "Mozilla/5.0 Chrome/120.0.0.0",
  "body_length": 0,
  "has_cookie": true
}
```

### **Attack Request:**
```json
{
  "request_id": "demo-1234567890-5678",
  "timestamp": "2024-01-01T12:00:00Z",
  "client_ip": "10.0.0.5",
  "method": "GET",
  "uri": "/api/users?id=1' OR '1'='1",
  "user_agent": "sqlmap/1.7.2",
  "body_length": 0,
  "has_cookie": false
}
```

---

## 🛡️ **Attack Types Included**

1. **SQL Injection**
   - `?id=1' OR '1'='1`
   - User-Agent: sqlmap

2. **Path Traversal**
   - `/../../../etc/passwd`
   - User-Agent: curl

3. **Scanner Detection**
   - `/admin/config`
   - User-Agent: nikto

4. **XSS Attempt**
   - `?q=<script>alert('xss')</script>`
   - User-Agent: python-requests

5. **Credential Stuffing**
   - `/api/auth/login` (POST)
   - User-Agent: Go-http-client

---

## 🔍 **Troubleshooting**

### **"Not Connected" Status:**

**Problem:** Demo website can't reach VARDAx

**Solutions:**
1. Check ngrok is running: `ngrok http 8000`
2. Check VARDAx is running: `npm run dev`
3. Verify ngrok URL is correct in input field
4. Check ngrok free tier limits (40 connections/minute)

### **CORS Errors:**

**Problem:** Browser blocks requests

**Solution:** VARDAx backend already has CORS enabled. If issues persist:
```python
# backend/app/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### **Ngrok Session Expired:**

**Problem:** Ngrok URL stops working after 2 hours (free tier)

**Solution:**
1. Restart ngrok: `ngrok http 8000`
2. Update URL in demo website
3. Or upgrade to ngrok paid plan for persistent URLs

---

## 💡 **Pro Tips**

### **1. Use Ngrok Auth Token**

Get persistent URLs:
```bash
# Sign up at ngrok.com
# Get your auth token
ngrok authtoken YOUR_AUTH_TOKEN

# Now URLs last longer
ngrok http 8000
```

### **2. Custom Subdomain (Paid)**

```bash
ngrok http 8000 --subdomain=vardax-demo
# URL: https://vardax-demo.ngrok.io
```

### **3. Local Testing**

Test locally before deploying:
```bash
cd demo-website
python -m http.server 3001
# Open http://localhost:3001
```

### **4. Multiple Devices**

Open the Vercel URL on:
- Your phone
- Tablet
- Another laptop
- Share with friends

All send traffic to your local VARDAx!

---

## 🎨 **Customization**

### **Change Colors:**

Edit CSS in `index.html`:
```css
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
```

### **Add More Attack Types:**

Edit `attackPatterns` array:
```javascript
const attackPatterns = [
    {
        name: 'Your Attack',
        uri: '/your/path',
        userAgent: 'your-agent'
    }
];
```

### **Change Traffic Rate:**

Edit interval in `startContinuousTraffic()`:
```javascript
intervalId = setInterval(() => {
    // ...
}, 500); // 2 requests per second
```

---

## 📈 **Metrics Tracked**

- **Total Requests** - All requests sent
- **Normal Requests** - Legitimate traffic
- **Attack Requests** - Malicious traffic
- **Errors** - Failed requests

---

## 🔗 **URLs You'll Need**

1. **Ngrok URL** - Your local VARDAx exposed
   - Example: `https://abc123.ngrok.io`
   - Get from: `ngrok http 8000`

2. **Vercel URL** - Your demo website
   - Example: `https://vardax-demo-target.vercel.app`
   - Get from: `vercel --prod`

3. **VARDAx Dashboard** - Your local dashboard
   - URL: `http://localhost:3000`
   - Shows detections

---

## 🎓 **Demo Script**

### **For Presentations:**

1. **Setup (before demo):**
   ```bash
   # Terminal 1: Start VARDAx
   npm run dev
   
   # Terminal 2: Start ngrok
   ngrok http 8000
   ```

2. **During demo:**
   - Open VARDAx dashboard: `http://localhost:3000`
   - Open demo website: `https://your-vercel-url.vercel.app`
   - Enter ngrok URL in demo website
   - Send normal traffic: "See, normal requests pass through"
   - Send attack traffic: "Watch VARDAx detect this SQL injection"
   - Show anomaly in dashboard with explanation
   - Start continuous traffic: "Now let's simulate a real attack"
   - Show rules being generated

3. **Key talking points:**
   - "This demo website is on Vercel, publicly accessible"
   - "VARDAx is running locally on my machine"
   - "Traffic flows through ngrok tunnel"
   - "ML detects attacks in real-time (< 30ms)"
   - "System generates ModSecurity rules automatically"

---

## 🚀 **Quick Commands**

```bash
# Start VARDAx
npm run dev

# Expose with ngrok
ngrok http 8000

# Deploy demo website
cd demo-website && vercel --prod

# Test locally
cd demo-website && python -m http.server 3001
```

---

## 📚 **Resources**

- **Ngrok Docs:** https://ngrok.com/docs
- **Vercel Docs:** https://vercel.com/docs
- **VARDAx Docs:** ../README.md

---

## ✅ **Checklist**

Before your demo:
- [ ] VARDAx running (`npm run dev`)
- [ ] Ngrok running (`ngrok http 8000`)
- [ ] Demo website deployed to Vercel
- [ ] Ngrok URL entered in demo website
- [ ] Test: Send normal request
- [ ] Test: Send attack request
- [ ] Verify: Check VARDAx dashboard shows traffic
- [ ] Verify: Anomalies detected
- [ ] Ready to demo!

---

**You're all set! Deploy and start demoing!** 🎉
