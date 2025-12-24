# @vardax/connect

**Connect any Node.js/Express application to VARDAx ML-Powered WAF with a simple connection string.**

Like connecting to a database, but for security! 🛡️

---

## 🚀 Quick Start

### Installation

```bash
npm install @vardax/connect
```

### Basic Usage

```javascript
const express = require('express');
const vardax = require('@vardax/connect');

const app = express();

// Connect to VARDAx with a connection string
app.use(vardax('vardax://localhost:8000?mode=monitor'));

// Your routes
app.get('/', (req, res) => {
  res.json({ message: 'Protected by VARDAx!' });
});

app.listen(3000);
```

**That's it!** All requests are now analyzed by VARDAx ML engine.

---

## 📝 Connection String Format

```
vardax://host:port?apiKey=key&mode=protect&blockThreshold=0.8
```

### Parameters:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `host` | `localhost` | VARDAx API host |
| `port` | `8000` | VARDAx API port |
| `apiKey` | - | Optional API key for authentication |
| `mode` | `monitor` | `monitor` (log only) or `protect` (block attacks) |
| `timeout` | `5000` | Request timeout in milliseconds |
| `blockThreshold` | `0.8` | Anomaly score threshold for blocking (0-1) |
| `challengeThreshold` | `0.5` | Anomaly score threshold for challenge (0-1) |
| `debug` | `false` | Enable debug logging |
| `failOpen` | `true` | Allow requests if VARDAx is unreachable |
| `blockPage` | - | Custom block page URL |

---

## 📚 Examples

### Example 1: Monitor Mode (Recommended for Testing)

```javascript
const vardax = require('@vardax/connect');

// Just monitor and log - don't block anything
app.use(vardax('vardax://localhost:8000?mode=monitor&debug=true'));
```

### Example 2: Protect Mode (Active Blocking)

```javascript
const vardax = require('@vardax/connect');

// Block suspicious requests
app.use(vardax('vardax://localhost:8000?mode=protect&blockThreshold=0.8'));
```

### Example 3: With API Key

```javascript
const vardax = require('@vardax/connect');

// Secure connection with API key
app.use(vardax('vardax://localhost:8000?apiKey=your-secret-key&mode=protect'));
```

### Example 4: Remote VARDAx (via ngrok)

```javascript
const vardax = require('@vardax/connect');

// Connect to VARDAx exposed via ngrok
app.use(vardax('vardax://abc123.ngrok.io?mode=monitor'));
```

### Example 5: Custom Block Page

```javascript
const vardax = require('@vardax/connect');

app.use(vardax('vardax://localhost:8000?mode=protect&blockPage=/blocked.html'));

// Serve custom block page
app.get('/blocked.html', (req, res) => {
  res.send('<h1>Access Denied</h1><p>Your request was blocked by security.</p>');
});
```

### Example 6: Environment Variables

```javascript
const vardax = require('@vardax/connect');

// Use environment variable for connection string
const connectionString = process.env.VARDAX_CONNECTION_STRING || 'vardax://localhost:8000';
app.use(vardax(connectionString));
```

---

## 🔧 Advanced Usage

### Manual Analysis (Without Middleware)

```javascript
const { createClient } = require('@vardax/connect');

const client = createClient('vardax://localhost:8000');

// Analyze a request manually
const analysis = await client.analyze({
  request_id: 'manual-123',
  timestamp: new Date().toISOString(),
  client_ip: '192.168.1.100',
  method: 'GET',
  uri: '/api/users',
  user_agent: 'Mozilla/5.0...'
});

console.log('Anomaly score:', analysis.score);
console.log('Allowed:', analysis.allowed);
```

### Check VARDAx Status

```javascript
const { createClient } = require('@vardax/connect');

const client = createClient('vardax://localhost:8000');

const status = await client.getStatus();
console.log('Connected:', status.connected);
```

### Access Analysis Results

```javascript
app.use(vardax('vardax://localhost:8000?mode=monitor'));

app.get('/api/data', (req, res) => {
  // Access VARDAx analysis
  if (req.vardax) {
    console.log('Anomaly score:', req.vardax.score);
    console.log('Request ID:', req.vardax.requestId);
  }
  
  res.json({ data: 'your data' });
});
```

### Custom Options

```javascript
const { createMiddleware } = require('@vardax/connect');

const vardaxMiddleware = createMiddleware('vardax://localhost:8000', {
  mode: 'protect',
  blockThreshold: 0.9,
  debug: true,
  failOpen: false // Fail closed - block if VARDAx is down
});

app.use(vardaxMiddleware);
```

---

## 🎯 Use Cases

### 1. Protect Express API

```javascript
const express = require('express');
const vardax = require('@vardax/connect');

const app = express();

// Protect all routes
app.use(vardax('vardax://localhost:8000?mode=protect'));

app.get('/api/users', (req, res) => {
  // This route is protected by VARDAx
  res.json({ users: [] });
});
```

### 2. Protect Specific Routes Only

```javascript
const express = require('express');
const vardax = require('@vardax/connect');

const app = express();

// Public routes (no protection)
app.get('/', (req, res) => {
  res.send('Home page');
});

// Protected routes
const protectedRouter = express.Router();
protectedRouter.use(vardax('vardax://localhost:8000?mode=protect'));
protectedRouter.get('/admin', (req, res) => {
  res.send('Admin panel');
});

app.use('/admin', protectedRouter);
```

### 3. Next.js API Routes

```javascript
// pages/api/users.js
import vardax from '@vardax/connect';

const middleware = vardax('vardax://localhost:8000?mode=monitor');

export default async function handler(req, res) {
  // Apply VARDAx middleware
  await new Promise((resolve, reject) => {
    middleware(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  // Your API logic
  res.json({ users: [] });
}
```

### 4. Logging Integration

```javascript
const vardax = require('@vardax/connect');
const winston = require('winston');

const logger = winston.createLogger({
  transports: [new winston.transports.Console()]
});

app.use(vardax('vardax://localhost:8000?mode=monitor'));

app.use((req, res, next) => {
  if (req.vardax && req.vardax.score > 0.5) {
    logger.warn('Suspicious request detected', {
      ip: req.ip,
      path: req.path,
      score: req.vardax.score,
      requestId: req.vardax.requestId
    });
  }
  next();
});
```

---

## 🔒 Security Best Practices

### 1. Use Environment Variables

```javascript
// .env
VARDAX_CONNECTION_STRING=vardax://localhost:8000?apiKey=secret123&mode=protect

// app.js
require('dotenv').config();
app.use(vardax(process.env.VARDAX_CONNECTION_STRING));
```

### 2. Different Modes for Different Environments

```javascript
const mode = process.env.NODE_ENV === 'production' ? 'protect' : 'monitor';
app.use(vardax(`vardax://localhost:8000?mode=${mode}`));
```

### 3. Fail Closed in Production

```javascript
const failOpen = process.env.NODE_ENV !== 'production';
app.use(vardax(`vardax://localhost:8000?failOpen=${failOpen}`));
```

---

## 🧪 Testing

```javascript
// test.js
const request = require('supertest');
const express = require('express');
const vardax = require('@vardax/connect');

const app = express();
app.use(vardax('vardax://localhost:8000?mode=monitor'));
app.get('/', (req, res) => res.json({ ok: true }));

// Test normal request
request(app)
  .get('/')
  .expect(200)
  .expect('X-VARDAx-Protected', 'true')
  .end((err, res) => {
    console.log('Anomaly score:', res.headers['x-vardax-score']);
  });
```

---

## 📊 Response Headers

VARDAx adds these headers to all responses:

- `X-VARDAx-Protected: true` - Request was analyzed
- `X-VARDAx-Score: 0.23` - Anomaly score (0-1)
- `X-VARDAx-Request-ID: connect-123-abc` - Unique request ID
- `X-VARDAx-Challenge: true` - (Optional) Challenge required

---

## 🐛 Troubleshooting

### VARDAx Not Reachable

```javascript
// Enable debug mode
app.use(vardax('vardax://localhost:8000?debug=true'));

// Check logs for connection errors
```

### Requests Being Blocked Incorrectly

```javascript
// Lower the threshold
app.use(vardax('vardax://localhost:8000?mode=protect&blockThreshold=0.9'));

// Or use monitor mode first
app.use(vardax('vardax://localhost:8000?mode=monitor'));
```

### Check VARDAx Status

```javascript
const { createClient } = require('@vardax/connect');
const client = createClient('vardax://localhost:8000');

client.getStatus().then(status => {
  console.log('VARDAx connected:', status.connected);
});
```

---

## 🔗 Integration with Other Frameworks

### Koa

```javascript
const Koa = require('koa');
const vardax = require('@vardax/connect');

const app = new Koa();

// Convert Express middleware to Koa
const koaVardax = (ctx, next) => {
  return new Promise((resolve, reject) => {
    vardax('vardax://localhost:8000')(ctx.req, ctx.res, (err) => {
      if (err) reject(err);
      else resolve(next());
    });
  });
};

app.use(koaVardax);
```

### Fastify

```javascript
const fastify = require('fastify')();
const vardax = require('@vardax/connect');

fastify.use(vardax('vardax://localhost:8000?mode=monitor'));
```

---

## 📦 What Gets Sent to VARDAx

```json
{
  "request_id": "connect-1234567890-abc",
  "timestamp": "2024-01-01T12:00:00Z",
  "client_ip": "192.168.1.100",
  "method": "GET",
  "uri": "/api/users",
  "query_string": "id=123",
  "user_agent": "Mozilla/5.0...",
  "has_auth_header": true,
  "has_cookie": true,
  "body_length": 0
}
```

**No sensitive data is sent** - only metadata for ML analysis.

---

## 🎉 Benefits

- ✅ **Simple** - One line of code to add protection
- ✅ **Non-blocking** - Async analysis doesn't slow down requests
- ✅ **Fail-safe** - Continues working even if VARDAx is down
- ✅ **Flexible** - Monitor or protect mode
- ✅ **Framework-agnostic** - Works with Express, Next.js, Koa, etc.
- ✅ **TypeScript support** - Full type definitions included

---

## 📄 License

MIT

---

## 🔗 Links

- **VARDAx GitHub:** https://github.com/yourusername/vardax
- **Documentation:** See main README.md
- **Issues:** https://github.com/yourusername/vardax/issues

---

**Protect your Node.js apps with ML-powered security in seconds!** 🛡️
