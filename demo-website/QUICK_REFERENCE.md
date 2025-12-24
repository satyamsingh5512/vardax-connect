# 🚀 VARDAx Demo - Quick Reference Card

**Print this and keep it handy during demos!**

---

## ⚡ Quick Start Commands

```bash
# 1. Start VARDAx
npm run dev

# 2. Expose with ngrok
ngrok http 8000

# 3. Deploy demo (first time only)
cd demo-website && vercel --prod
```

---

## 🔗 URLs

| Service | URL | Notes |
|---------|-----|-------|
| **VARDAx Dashboard** | http://localhost:3000 | Show detections here |
| **VARDAx API** | http://localhost:8000 | Backend |
| **ngrok Tunnel** | https://[YOUR-ID].ngrok.io | Copy from ngrok terminal |
| **Demo Website** | https://vardax-demo-target.vercel.app | Send traffic from here |

---

## 🎮 Demo Website Controls

| Button | Shortcut | Action |
|--------|----------|--------|
| **Normal Request** | N | Send legitimate traffic |
| **Attack Request** | A | Send malicious traffic |
| **Stop Traffic** | S | Stop continuous mode |
| **Double-click** | - | Start continuous traffic |

---

## 🎬 5-Minute Demo Flow

| Time | Action | What to Show |
|------|--------|--------------|
| **0:00** | Show empty dashboard | "No traffic yet" |
| **0:30** | Send 3 normal requests | "Legitimate traffic passes" |
| **1:00** | Send 3 attack requests | "Attacks detected" |
| **1:30** | Click on anomaly | "Explanation: SQL injection" |
| **2:00** | Start continuous traffic | "Real attack simulation" |
| **3:00** | Show ML Health page | "3-model ensemble" |
| **4:00** | Show Rules page | "Auto-generated rules" |
| **4:30** | Stop traffic | "Questions?" |

---

## 🐛 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| **Not Connected** | Check ngrok is running |
| **No traffic in dashboard** | Verify ngrok URL is correct |
| **CORS errors** | Already fixed in code |
| **ngrok expired** | Restart: `ngrok http 8000` |

---

## 💡 Key Talking Points

1. **"ML-powered WAF"** - Not signature-based
2. **"Real-time detection"** - < 30ms inference
3. **"3-model ensemble"** - Isolation Forest + Autoencoder + EWMA
4. **"Explainable AI"** - Shows why it's an attack
5. **"Continuous learning"** - Improves from feedback
6. **"Production-ready"** - Full architecture, not a toy

---

## 📊 Attack Types to Demo

1. **SQL Injection** - `?id=1' OR '1'='1`
2. **Path Traversal** - `/../../../etc/passwd`
3. **Scanner** - User-Agent: nikto
4. **XSS** - `<script>alert('xss')</script>`
5. **Credential Stuffing** - Multiple login attempts

---

## ✅ Pre-Demo Checklist

- [ ] VARDAx running (`npm run dev`)
- [ ] ngrok running (`ngrok http 8000`)
- [ ] Dashboard open (localhost:3000)
- [ ] Demo website open (Vercel URL)
- [ ] ngrok URL entered in demo website
- [ ] Test: Send 1 normal request
- [ ] Test: Send 1 attack request
- [ ] Verify: Dashboard shows both
- [ ] Battery charged
- [ ] Internet stable

---

## 🎯 Emergency Commands

```bash
# Restart everything
pkill -f "npm run dev"
npm run dev

# Restart ngrok
pkill ngrok
ngrok http 8000

# Clear data
curl -X POST http://localhost:8000/api/v1/admin/clear-data

# Check status
curl http://localhost:8000/health
```

---

## 📱 Mobile Demo

1. Open Vercel URL on phone
2. Enter ngrok URL
3. Send traffic from phone
4. Show detection on laptop
5. **Impressive!**

---

## 🎓 Elevator Pitch

> "I built VARDAx, a Cloudflare-style ML-powered Web Application Firewall. It uses a 3-model ensemble to detect zero-day attacks in real-time with explainable AI. The system continuously learns from analyst feedback and automatically generates security rules. It's production-ready with full Docker deployment, monitoring, and comprehensive documentation."

---

**Keep this card handy during demos!** 📋
