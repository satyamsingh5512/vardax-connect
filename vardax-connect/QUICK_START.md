# ⚡ Quick Start - @vardax/connect

**Get your Node.js app protected in 60 seconds!**

---

## Step 1: Install

```bash
npm install @vardax/connect
```

## Step 2: Add One Line

```javascript
const vardax = require('@vardax/connect');
app.use(vardax('vardax://localhost:8000'));
```

## Step 3: Done! ✅

All requests are now analyzed by VARDAx ML engine.

---

## Connection String Examples

### Local Development
```javascript
app.use(vardax('vardax://localhost:8000?mode=monitor'));
```

### Production (Protect Mode)
```javascript
app.use(vardax('vardax://localhost:8000?mode=protect&apiKey=secret'));
```

### Remote VARDAx (ngrok)
```javascript
app.use(vardax('vardax://abc123.ngrok.io?mode=monitor'));
```

### Environment Variable
```javascript
app.use(vardax(process.env.VARDAX_CONNECTION_STRING));
```

---

## Complete Example

```javascript
const express = require('express');
const vardax = require('@vardax/connect');

const app = express();

// Connect to VARDAx
app.use(vardax('vardax://localhost:8000?mode=monitor&debug=true'));

// Your routes
app.get('/api/users', (req, res) => {
  console.log('Anomaly score:', req.vardax.score);
  res.json({ users: [] });
});

app.listen(3000);
```

---

## Test It

```bash
# Start your app
node app.js

# Make a request
curl http://localhost:3000/api/users

# Check VARDAx dashboard
open http://localhost:3000
```

---

## Next Steps

- Read full [README.md](README.md)
- Try [examples/](examples/)
- Run tests: `npm test`
