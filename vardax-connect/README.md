# vardax-connect

Connect any Node.js/Express app to VARDAx ML-Powered WAF with one command.

## Installation

```bash
npm install vardax-connect
```

That's it. No other setup required.

## Quick Start

```javascript
const express = require('express');
const vardax = require('vardax-connect');

const app = express();

// Add VARDAx protection - one line
app.use(vardax('vardax://your-vardax-server:8000'));

app.get('/', (req, res) => {
  res.send('Protected by VARDAx!');
});

app.listen(3000);
```

## Connection String

```
vardax://host:port?apiKey=KEY&mode=MODE
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `host` | required | VARDAx server hostname |
| `port` | `8000` | VARDAx server port |
| `apiKey` | none | API key for authentication |
| `mode` | `monitor` | `monitor` (log only) or `protect` (block threats) |
| `timeout` | `5000` | Request timeout in ms |
| `blockThreshold` | `0.8` | Score threshold to block (0-1) |
| `failOpen` | `true` | Allow traffic if VARDAx is unreachable |

## Examples

### Monitor Mode (default)
```javascript
app.use(vardax('vardax://localhost:8000'));
```

### Protect Mode (blocks threats)
```javascript
app.use(vardax('vardax://localhost:8000?mode=protect&blockThreshold=0.7'));
```

### With API Key
```javascript
app.use(vardax('vardax://api.vardax.io:8000?apiKey=your-key&mode=protect'));
```

### With Rate Limiting
```javascript
const { VardaxRateLimiter } = require('vardax-connect');

const limiter = new VardaxRateLimiter();
app.use(limiter.middleware());
app.use(vardax('vardax://localhost:8000?mode=protect'));
```

## What It Does

- Sends request metadata to VARDAx for ML analysis
- Adds `X-VARDAx-Protected` header to responses
- In protect mode: blocks requests with high anomaly scores
- Fails open by default (your app keeps working if VARDAx is down)

## Response Headers

| Header | Description |
|--------|-------------|
| `X-VARDAx-Protected` | `true` if request was analyzed |
| `X-VARDAx-Score` | Anomaly score (0-1) |
| `X-VARDAx-Request-ID` | Unique request identifier |

## Access Analysis Results

```javascript
app.use(vardax('vardax://localhost:8000'));

app.get('/api/data', (req, res) => {
  // Access VARDAx analysis
  console.log(req.vardax.score);        // Anomaly score
  console.log(req.vardax.requestId);    // Request ID
  
  res.json({ data: 'protected' });
});
```

## License

MIT
