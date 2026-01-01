# 🎯 How to Use vardax-connect

**Simple answer: Add it to your Express app!**

---

## 📍 Where to Use It

You use `vardax-connect` in **any Node.js/Express application** that you want to protect.

---

## 🚀 Quick Example

### Your Existing App (Before)

```javascript
const express = require('express');
const app = express();

app.get('/api/users', (req, res) => {
  res.json({ users: [] });
});

app.listen(3000);
```

### Your App with VARDAx (After)

```javascript
const express = require('express');
const vardax = require('vardax-connect'); // ADD THIS
const app = express();

app.use(vardax('vardax://localhost:8000')); // ADD THIS

app.get('/api/users', (req, res) => {
  res.json({ users: [] });
});

app.listen(3000);
```

**That's it!** Two lines added, entire app protected. 🎉

---

## 📂 File Structure

```
your-project/
├── app.js              ← Add vardax here
├── package.json
└── node_modules/
```

---

## 🎬 Live Demo

I've created a complete demo app for you!

### Step 1: Start VARDAx
```bash
npm run dev
```

### Step 2: Run Demo App
```bash
cd vardax-connect-demo
npm install
npm start
```

### Step 3: Open Browser
```
http://localhost:3001
```

### Step 4: See It Work!
- Make requests
- Check VARDAx dashboard: http://localhost:3000
- See ML analysis in real-time

---

## 💡 Real-World Examples

### Example 1: E-commerce API

```javascript
const express = require('express');
const vardax = require('vardax-connect');

const app = express();

// Protect entire API
app.use(vardax('vardax://localhost:8000?mode=protect'));

app.get('/api/products', (req, res) => {
  // Protected from attacks
  res.json({ products: [] });
});

app.post('/api/checkout', (req, res) => {
  // Protected from fraud
  res.json({ order: 'created' });
});

app.listen(3000);
```

### Example 2: Admin Dashboard

```javascript
const express = require('express');
const vardax = require('vardax-connect');

const app = express();

// Public routes (no protection)
app.get('/', (req, res) => {
  res.send('Home page');
});

// Admin routes (protected)
const adminRouter = express.Router();
adminRouter.use(vardax('vardax://localhost:8000?mode=protect&blockThreshold=0.7'));

adminRouter.get('/dashboard', (req, res) => {
  res.send('Admin dashboard');
});

app.use('/admin', adminRouter);
app.listen(3000);
```

### Example 3: Existing Project

If you already have an Express app:

```javascript
// Your existing app.js
const express = require('express');
const vardax = require('vardax-connect'); // 1. Add this import

const app = express();

// Your existing middleware
app.use(express.json());
app.use(express.static('public'));

// 2. Add this line
app.use(vardax('vardax://localhost:8000?mode=monitor'));

// Your existing routes (unchanged)
app.get('/api/data', (req, res) => {
  res.json({ data: 'your data' });
});

app.listen(3000);
```

---

## 🔧 Connection String Options

```javascript
// Basic (monitor mode)
vardax://localhost:8000

// Protect mode (blocks attacks)
vardax://localhost:8000?mode=protect

// With API key
vardax://localhost:8000?apiKey=your-secret-key

// Custom thresholds
vardax://localhost:8000?mode=protect&blockThreshold=0.9

// Debug mode
vardax://localhost:8000?mode=monitor&debug=true

// Remote VARDAx (via ngrok)
vardax://abc123.ngrok.io?mode=monitor
```

---

## 📊 What Happens

```
User Request
    ↓
vardax-connect (analyzes request)
    ↓
VARDAx ML Engine (scores 0-1)
    ↓
Decision (allow/block)
    ↓
Your Route Handler
```

---

## 🎯 Use Cases

### 1. Protect Your API
```javascript
app.use(vardax('vardax://localhost:8000'));
```

### 2. Protect Specific Routes
```javascript
apiRouter.use(vardax('vardax://localhost:8000'));
app.use('/api', apiRouter);
```

### 3. Different Protection Levels
```javascript
// Light protection for public API
publicRouter.use(vardax('vardax://localhost:8000?blockThreshold=0.9'));

// Strict protection for admin
adminRouter.use(vardax('vardax://localhost:8000?blockThreshold=0.6'));
```

### 4. Monitor Production Traffic
```javascript
// In production, just monitor
if (process.env.NODE_ENV === 'production') {
  app.use(vardax('vardax://prod.vardax.io?mode=monitor'));
}
```

---

## 📝 Access Analysis Results

```javascript
app.use(vardax('vardax://localhost:8000'));

app.get('/api/data', (req, res) => {
  // Access VARDAx analysis
  console.log('Anomaly score:', req.vardax.score);
  console.log('Request ID:', req.vardax.requestId);
  console.log('Explanations:', req.vardax.explanations);
  
  res.json({ data: 'your data' });
});
```

---

## 🧪 Test It Now

### Terminal 1: Start VARDAx
```bash
npm run dev
```

### Terminal 2: Run Demo
```bash
cd vardax-connect-demo
npm install
npm start
```

### Terminal 3: Test
```bash
# Normal request
curl http://localhost:3001/api/users

# Attack (will be detected)
curl "http://localhost:3001/api/users?id=1' OR '1'='1"
```

### Browser: Check Dashboard
```
http://localhost:3000
```

---

## 📚 Files to Check

- `vardax-connect-demo/app.js` - Complete working example
- `vardax-connect/examples/complete-app.js` - Full example
- `vardax-connect/examples/protect-specific-routes.js` - Selective protection
- `vardax-connect/README.md` - Full documentation

---

## ✅ Summary

**Where to use it:** In your Express app's `app.js` or `server.js`

**How to use it:**
1. Import: `const vardax = require('vardax-connect');`
2. Add: `app.use(vardax('vardax://localhost:8000'));`
3. Done! All routes below are protected.

**When to use it:**
- Protecting APIs
- Preventing attacks
- Monitoring traffic
- Detecting anomalies

---

**It's that simple!** 🛡️

Try the demo app now:
```bash
cd vardax-connect-demo
npm install
npm start
```
