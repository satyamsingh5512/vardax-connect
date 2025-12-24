# 🛡️ VARDAx Connect Demo App

**See vardax-connect in action!**

---

## 🚀 Quick Start

### Step 1: Start VARDAx

```bash
# In main project directory
npm run dev
```

This starts:
- VARDAx backend on port 8000
- VARDAx dashboard on port 3000

### Step 2: Install Dependencies

```bash
cd vardax-connect-demo
npm install
```

### Step 3: Run Demo App

```bash
npm start
```

### Step 4: Open in Browser

```
http://localhost:3001
```

---

## 🧪 Test It

### Normal Request
```bash
curl http://localhost:3001/api/users
```

### SQL Injection (Will be detected!)
```bash
curl "http://localhost:3001/api/users?id=1' OR '1'='1"
```

### Path Traversal (Will be detected!)
```bash
curl http://localhost:3001/api/files/../../etc/passwd
```

### Login Request
```bash
curl -X POST http://localhost:3001/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

---

## 📊 Check VARDAx Dashboard

Open http://localhost:3000 to see:
- All requests being analyzed
- Anomaly scores
- Attack detections
- Real-time traffic

---

## 🔍 How It Works

Look at `app.js` line 30:

```javascript
app.use(vardax('vardax://localhost:8000?mode=monitor&debug=true'));
```

This ONE LINE protects all routes below it!

---

## 📝 The Code

```javascript
const express = require('express');
const vardax = require('vardax-connect');

const app = express();

// Add VARDAx protection
app.use(vardax('vardax://localhost:8000'));

// Your routes (now protected)
app.get('/api/users', (req, res) => {
  console.log('Anomaly score:', req.vardax.score);
  res.json({ users: [] });
});

app.listen(3001);
```

That's it! 🎉

---

## 🎯 What You'll See

1. **In Terminal:**
   - Request logs
   - Anomaly scores
   - VARDAx analysis results

2. **In Browser:**
   - Protected web interface
   - Your anomaly score
   - Test endpoints

3. **In VARDAx Dashboard:**
   - All traffic
   - Attack detections
   - Real-time monitoring

---

## 🔧 Configuration

Edit the connection string in `app.js`:

```javascript
// Monitor mode (log only)
app.use(vardax('vardax://localhost:8000?mode=monitor'));

// Protect mode (block attacks)
app.use(vardax('vardax://localhost:8000?mode=protect'));

// With API key
app.use(vardax('vardax://localhost:8000?apiKey=secret'));

// Custom thresholds
app.use(vardax('vardax://localhost:8000?blockThreshold=0.9'));
```

---

## 📚 Learn More

- See `vardax-connect/README.md` for full documentation
- See `vardax-connect/examples/` for more examples
- See `NPM_PACKAGE_COMPLETE.md` for package details

---

**Protect your apps with one line of code!** 🛡️
