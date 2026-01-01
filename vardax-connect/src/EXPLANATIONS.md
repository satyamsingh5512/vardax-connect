# Function Explanations

## `TOKEN_BUCKET_LUA`
Atomic Lua script prevents race conditions in rate limiting. A GET-then-SET pattern would allow burst bypass under concurrent load.

## `getClientIp()`
Only trusts X-Forwarded-For from known proxy IPs. Prevents attackers from spoofing their IP by setting headers directly.

## `checkBodySize()`
Checks Content-Length header before any parsing. Rejects oversized payloads early to save CPU and memory.

## `safeRegexTest()`
Truncates input before regex evaluation. Prevents ReDoS attacks where malicious input causes exponential backtracking.

## `DefaultAsyncLogger`
Enqueues logs to memory and flushes in background. Synchronous logging would block the event loop and add latency.

## `DefaultScoringService`
Pushes events to async queue for ML processing. ML inference is slow; doing it inline would kill throughput.

## `MetricsCollector`
Uses reservoir sampling for bounded memory. Tracks p50/p95/p99 without storing all latencies.

## `CircuitBreaker`
Opens when Redis is slow/failing. Prevents cascade failures by shedding load instead of queueing requests.

## `firewallMiddleware()`
Ordered checks: body size → blocked paths → circuit breaker → rate limit. Cheapest checks first to reject bad traffic early.

## `adminMiddleware()`
Requires both IP allowlist AND token auth. Defense in depth for sensitive admin endpoints.

---

# k6 Load Test

```javascript
// k6-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 100,
  duration: '30s',
};

export default function () {
  const res = http.get('http://localhost:3000/');
  check(res, {
    'status is 200 or 429': (r) => r.status === 200 || r.status === 429,
    'has request id': (r) => r.headers['X-Request-Id'] !== undefined,
    'latency < 100ms': (r) => r.timings.duration < 100,
  });
  sleep(0.01);
}
```

Run with: `k6 run k6-test.js`

This validates that logging doesn't block - p99 should stay under 100ms even at high concurrency.
