# 🚀 VARDAx Quick Demo Guide

**Get your dashboard showing data in 2 minutes!**

---

## ⚡ Super Quick Start

### **Step 1: Start VARDAx** (30 seconds)

```bash
npm run dev
```

Wait for:
```
✓ Backend running on http://localhost:8000
✓ Frontend running on http://localhost:3000
```

### **Step 2: Open Dashboard** (10 seconds)

Open browser: **http://localhost:3000**

You'll see an empty dashboard (no data yet).

### **Step 3: Generate Traffic** (10 seconds)

Open a **new terminal**:

```bash
cd backend
source venv/bin/activate
python scripts/demo_traffic.py
```

### **Step 4: Watch the Magic!** ✨

Go back to your browser and watch:
- ✅ Live traffic streaming in
- ✅ Anomalies being detected
- ✅ Metrics updating in real-time
- ✅ Charts filling with data

---

## 🎬 **What You'll See**

### **Overview Page:**
- Requests per second counter
- Anomalies detected counter
- Real-time charts
- Severity distribution

### **Live Traffic Page:**
- Stream of requests flowing
- Color-coded by severity
- Real-time updates

### **Anomalies Page:**
- Detected threats
- Explanations for each
- Confidence scores
- Attack categories

---

## 🎯 **Different Demo Scenarios**

### **Scenario 1: Normal Traffic** (Boring but stable)
```bash
python scripts/demo_traffic.py --scenario mixed --attack-rate 0.05
```
**Shows:** System handling normal load, few anomalies

### **Scenario 2: Under Attack!** (Exciting!)
```bash
python scripts/demo_traffic.py --scenario mixed --attack-rate 0.3
```
**Shows:** Lots of anomalies, rules being generated

### **Scenario 3: Bot Attack** (Very visual)
```bash
python scripts/demo_traffic.py --scenario bot --rate 100
```
**Shows:** High request rate, scanner detection

### **Scenario 4: Zero-Day** (ML in action)
```bash
python scripts/demo_traffic.py --scenario zero_day
```
**Shows:** ML detecting novel attacks

---

## 🎨 **Make It Look Good for Screenshots**

### **1. Generate Some History:**
```bash
# Run for 2 minutes to build up data
python scripts/demo_traffic.py --duration 120 --rate 50
```

### **2. Take Screenshots:**
- Overview page (shows metrics)
- Anomalies page (shows detections)
- Live Traffic (shows real-time stream)
- ML Health (shows model performance)

### **3. Record Video:**
```bash
# Start recording (OBS, QuickTime, etc.)
# Run traffic generator
python scripts/demo_traffic.py --scenario mixed --duration 60
# Show different dashboard pages
# Stop recording
```

---

## 🔥 **5-Minute Demo Script**

Perfect for presentations:

```bash
# Minute 1: Start and show empty dashboard
npm run dev
# Open http://localhost:3000
# "Here's VARDAx, currently no traffic"

# Minute 2: Start normal traffic
python scripts/demo_traffic.py --scenario mixed --attack-rate 0.05 --duration 60
# "Now we're seeing normal traffic, very few anomalies"

# Minute 3: Ramp up attacks
python scripts/demo_traffic.py --scenario mixed --attack-rate 0.3 --duration 60
# "Now we're under attack, watch the anomalies spike"
# Click on anomalies to show explanations

# Minute 4: Bot attack
python scripts/demo_traffic.py --scenario bot --duration 30
# "This is a bot scanner, see how it's detected"
# Show bot likelihood scores

# Minute 5: Show features
# Navigate through different pages
# Show rule generation
# Show ML health
# "And it continuously learns from feedback"
```

---

## 📊 **Dashboard Tour**

### **Page 1: Overview**
- Total requests
- Anomalies detected
- Blocked requests
- Real-time charts

### **Page 2: Live Traffic**
- Request stream
- Color-coded severity
- Real-time updates

### **Page 3: Anomalies**
- Detected threats
- Explanations
- Confidence scores
- Filter by severity

### **Page 4: Rules**
- Generated rules
- Approve/reject
- Confidence scores
- Source anomalies

### **Page 5: Replay**
- Attack timeline
- Sequence visualization
- Event details

### **Page 6: Heatmap**
- Traffic patterns
- Time-based view
- Intensity visualization

### **Page 7: Geo Map**
- Geographic distribution
- Attack sources
- Visual map

### **Page 8: Simulate**
- Test rules
- Before/after comparison
- Safe testing

### **Page 9: ML Health**
- Model performance
- Inference latency
- False positive rate
- Training history

### **Page 10: Settings**
- Database management
- Clear data
- Configuration

---

## 🎥 **Recording Tips**

### **For Video Demos:**
1. **Clean your desktop** - Close unnecessary windows
2. **Full screen browser** - F11 for immersive view
3. **Dark theme** - Looks professional
4. **Zoom in** - Make text readable (Ctrl/Cmd +)
5. **Slow down** - Give viewers time to see
6. **Narrate** - Explain what's happening

### **For Screenshots:**
1. **Wait for data** - Let traffic run for 1-2 minutes
2. **Full page** - Capture entire dashboard
3. **High resolution** - 1920x1080 minimum
4. **Annotations** - Add arrows/highlights later
5. **Multiple angles** - Different pages, different states

---

## 🐛 **Quick Troubleshooting**

### **Dashboard is empty:**
```bash
# Check if traffic is being sent
curl http://localhost:8000/api/v1/stats/live

# Should show non-zero request count
```

### **Traffic script fails:**
```bash
# Check backend is running
curl http://localhost:8000/health

# Should return: {"status":"healthy"}
```

### **Slow performance:**
```bash
# Reduce traffic rate
python scripts/demo_traffic.py --rate 20
```

---

## 🎯 **What to Highlight**

### **For Technical Audience:**
- 3-model ML ensemble
- Real-time inference (< 30ms)
- 47 behavioral features
- Continuous learning loop
- Production architecture

### **For Business Audience:**
- Blocks attacks automatically
- Learns from feedback
- Reduces false positives
- Easy to use dashboard
- Saves security team time

### **For Recruiters:**
- Full-stack implementation
- ML engineering
- Security expertise
- Production-ready code
- Comprehensive documentation

---

## 📝 **Demo Checklist**

Before your demo:
- [ ] System is running (`npm run dev`)
- [ ] Dashboard loads (http://localhost:3000)
- [ ] Backend responds (`curl http://localhost:8000/health`)
- [ ] Traffic script works (`python scripts/demo_traffic.py --duration 10`)
- [ ] Data appears in dashboard
- [ ] All pages load correctly
- [ ] WebSocket connected (check browser console)
- [ ] Screenshots taken
- [ ] Video recorded (optional)
- [ ] Demo script prepared

---

## 🚀 **Ready to Demo!**

You now have everything you need to:
- ✅ Generate realistic traffic
- ✅ Show live detection
- ✅ Demonstrate features
- ✅ Impress your audience

**Go make it happen!** 💪

---

## 📚 **More Resources**

- **Full traffic guide:** [TRAFFIC_GENERATION_GUIDE.md](./TRAFFIC_GENERATION_GUIDE.md)
- **Demo script:** [DEMO_SCRIPT.md](./DEMO_SCRIPT.md)
- **Architecture:** [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Quick start:** [START_HERE.md](./START_HERE.md)
