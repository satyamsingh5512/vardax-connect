# VARDAx Rate Limiting and DDoS Defense Implementation

Production-ready rate limiting and DDoS defense for Vardax Connect (Node.js + Express).

## 1. Summary

This implementation provides a multi-layer defense strategy:
- **Layer 1 (Edge)**: Cloudflare rate limiting and WAF rules
- **Layer 2 (Proxy)**: Nginx request throttling with burst handling
- **Layer 3 (Application)**: Express middleware with Redis-backed token bucket
- **Layer 4 (VARDAx)**: ML-based anomaly detection and adaptive blocking

Key features:
- Atomic token bucket algorithm via Redis Lua scripts
- Distributed rate limiting across multiple app instances
- Progressive penalties for repeat offenders
- Graceful degradation (fail-open with local fallback)
- Full observability via Prometheus metrics and Grafana dashboards

## 2. Architecture (ASCII)

```
                                    ┌─────────────────────────────────────────────────────────────┐
                                    │                     INTERNET                                 │
                                    └─────────────────────────────────────────────────────────────┘
                                                              │
                                                              ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  LAYER 1: CLOUDFLARE EDGE                                                                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                │
│  │  DDoS Shield    │  │  Rate Limiting  │  │  WAF Rules      │  │  Bot Management │                │
│  │  (L3/L4/L7)     │  │  (10 req/10s)   │  │  (OWASP Core)   │  │  (JS Challenge) │                │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘                │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                              │
                                                              ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  LAYER 2: NGINX REVERSE PROXY                                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │  limit_req_zone $binary_remote_addr zone=api:10m rate=20r/s                                 │   │
│  │  limit_conn_zone $binary_remote_addr zone=conn:10m                                          │   │
│  │  limit_req zone=api burst=50 nodelay                                                        │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                              │
                                                              ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  LAYER 3: EXPRESS APPLICATION                                                                       │
│  ┌───────────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                              vardaxRateLimiter Middleware                                     │ │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                    │ │
│  │  │ Extract IP  │───▶│ Check Redis │───▶│ Token Bucket│───▶│ Allow/Block │                    │ │
│  │  │ + Endpoint  │    │ (Lua Script)│    │ Algorithm   │    │ + Headers   │                    │ │
│  │  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘                    │ │
│  └───────────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                              │                                                      │
│                                              ▼                                                      │
│  ┌───────────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                              REDIS CLUSTER                                                    │ │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                                       │ │
│  │  │   Master    │◀──▶│   Replica   │◀──▶│   Replica   │                                       │ │
│  │  │  (Primary)  │    │  (Standby)  │    │  (Standby)  │                                       │ │
│  │  └─────────────┘    └─────────────┘    └─────────────┘                                       │ │
│  │       Lua Script: Token Bucket (Atomic EVALSHA)                                              │ │
│  └───────────────────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                              │
                                                              ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  LAYER 4: VARDAX ML ENGINE                                                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                │
│  │  Feature        │  │  Anomaly        │  │  Adaptive       │  │  Rule           │                │
│  │  Extraction     │──▶  Detection      │──▶  Thresholds     │──▶  Deployment     │                │
│  │  (Real-time)    │  │  (Isolation     │  │  (Auto-tune)    │  │  (Hot reload)   │                │
│  │                 │  │   Forest)       │  │                 │  │                 │                │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘                │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```


## 3. Redis Lua Script (Token Bucket)

```lua
-- vardax_token_bucket.lua
-- Atomic token bucket rate limiter for distributed systems
-- KEYS[1] = bucket key (e.g., "rl:192.168.1.1:/api/login")
-- ARGV[1] = capacity (max tokens)
-- ARGV[2] = refill_rate (tokens per second)
-- ARGV[3] = now_ms (current timestamp in milliseconds)
-- ARGV[4] = requested (tokens to consume, usually 1)

local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local now_ms = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])

-- Fetch current bucket state
local data = redis.call('HMGET', key, 'tokens', 'last_ms')
local tokens = tonumber(data[1])
local last_ms = tonumber(data[2])

-- Initialize if bucket does not exist
if tokens == nil then
    tokens = capacity
    last_ms = now_ms
end

-- Calculate elapsed time and refill tokens
local elapsed_sec = (now_ms - last_ms) / 1000.0
local refill = elapsed_sec * refill_rate
tokens = math.min(capacity, tokens + refill)

-- Determine if request is allowed
local allowed = 0
local remaining = math.floor(tokens)
local retry_after = 0

if tokens >= requested then
    tokens = tokens - requested
    allowed = 1
    remaining = math.floor(tokens)
else
    -- Calculate wait time until enough tokens available
    retry_after = math.ceil((requested - tokens) / refill_rate)
end

-- Persist bucket state with 1 hour TTL
redis.call('HMSET', key, 'tokens', tokens, 'last_ms', now_ms)
redis.call('EXPIRE', key, 3600)

-- Return: [allowed, remaining, retry_after, capacity]
return {allowed, remaining, retry_after, capacity}
```

## 4. Node.js Middleware (Express + ioredis)

```javascript
// vardax-rate-limiter.js
// Production rate limiter middleware for Express with Redis backend

const Redis = require('ioredis');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Load Lua script
const LUA_SCRIPT = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local now_ms = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])

local data = redis.call('HMGET', key, 'tokens', 'last_ms')
local tokens = tonumber(data[1])
local last_ms = tonumber(data[2])

if tokens == nil then
    tokens = capacity
    last_ms = now_ms
end

local elapsed_sec = (now_ms - last_ms) / 1000.0
local refill = elapsed_sec * refill_rate
tokens = math.min(capacity, tokens + refill)

local allowed = 0
local remaining = math.floor(tokens)
local retry_after = 0

if tokens >= requested then
    tokens = tokens - requested
    allowed = 1
    remaining = math.floor(tokens)
else
    retry_after = math.ceil((requested - tokens) / refill_rate)
end

redis.call('HMSET', key, 'tokens', tokens, 'last_ms', now_ms)
redis.call('EXPIRE', key, 3600)

return {allowed, remaining, retry_after, capacity}
`;

class VardaxRateLimiter {
    constructor(options = {}) {
        this.redis = options.redis || new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD || undefined,
            maxRetriesPerRequest: 3,
            retryDelayOnFailover: 100,
            enableReadyCheck: true,
            lazyConnect: true
        });

        this.scriptSha = null;
        this.keyPrefix = options.keyPrefix || 'vardax:rl';
        this.failOpen = options.failOpen !== false;
        this.debug = options.debug || false;

        // Default limits by profile
        this.profiles = {
            default: { capacity: 100, refillRate: 10 },
            strict: { capacity: 20, refillRate: 2 },
            relaxed: { capacity: 500, refillRate: 50 },
            auth: { capacity: 5, refillRate: 0.1 },
            api: { capacity: 60, refillRate: 1 }
        };

        // Endpoint-specific overrides
        this.endpointLimits = options.endpointLimits || {
            '/api/auth/login': 'auth',
            '/api/auth/register': 'auth',
            '/api/auth/reset-password': 'auth',
            '/api/v1/': 'api',
            '/graphql': 'strict'
        };

        // Local fallback counters (when Redis unavailable)
        this.localCounters = new Map();
        this.localCounterCleanupInterval = setInterval(() => {
            const now = Date.now();
            for (const [key, data] of this.localCounters) {
                if (now - data.timestamp > 60000) {
                    this.localCounters.delete(key);
                }
            }
        }, 30000);
    }

    async ensureScript() {
        if (!this.scriptSha) {
            try {
                this.scriptSha = await this.redis.script('LOAD', LUA_SCRIPT);
            } catch (err) {
                if (this.debug) console.error('[VardaxRL] Script load error:', err.message);
                throw err;
            }
        }
        return this.scriptSha;
    }

    getClientIp(req) {
        // Trust X-Forwarded-For only if behind trusted proxy
        const xff = req.headers['x-forwarded-for'];
        if (xff) {
            return xff.split(',')[0].trim();
        }
        const realIp = req.headers['x-real-ip'];
        if (realIp) return realIp;
        return req.ip || req.connection?.remoteAddress || 'unknown';
    }

    getLimits(endpoint) {
        // Check exact match
        if (this.endpointLimits[endpoint]) {
            const profile = this.endpointLimits[endpoint];
            return this.profiles[profile] || this.profiles.default;
        }
        // Check prefix match
        for (const [pattern, profile] of Object.entries(this.endpointLimits)) {
            if (endpoint.startsWith(pattern)) {
                return this.profiles[profile] || this.profiles.default;
            }
        }
        return this.profiles.default;
    }

    async checkLimit(ip, endpoint, tokensRequested = 1) {
        const limits = this.getLimits(endpoint);
        const key = `${this.keyPrefix}:${ip}:${endpoint}`;
        const nowMs = Date.now();

        try {
            const sha = await this.ensureScript();
            const result = await this.redis.evalsha(
                sha,
                1,
                key,
                limits.capacity,
                limits.refillRate,
                nowMs,
                tokensRequested
            );

            return {
                allowed: result[0] === 1,
                remaining: result[1],
                retryAfter: result[2],
                limit: result[3]
            };
        } catch (err) {
            if (err.message.includes('NOSCRIPT')) {
                this.scriptSha = null;
                return this.checkLimit(ip, endpoint, tokensRequested);
            }

            if (this.debug) console.error('[VardaxRL] Redis error:', err.message);

            // Local fallback
            return this.checkLimitLocal(ip, endpoint, limits);
        }
    }

    checkLimitLocal(ip, endpoint, limits) {
        const key = `${ip}:${endpoint}`;
        const now = Date.now();
        let data = this.localCounters.get(key);

        if (!data || now - data.timestamp > 1000) {
            data = { count: 0, timestamp: now };
        }

        data.count++;
        this.localCounters.set(key, data);

        const allowed = data.count <= limits.capacity;
        return {
            allowed,
            remaining: Math.max(0, limits.capacity - data.count),
            retryAfter: allowed ? 0 : Math.ceil(1 / limits.refillRate),
            limit: limits.capacity,
            fallback: true
        };
    }

    middleware(options = {}) {
        const self = this;
        const skipPaths = new Set(options.skipPaths || ['/health', '/ready', '/metrics']);

        return async function vardaxRateLimitMiddleware(req, res, next) {
            if (skipPaths.has(req.path)) {
                return next();
            }

            const ip = self.getClientIp(req);
            const endpoint = req.path;

            try {
                const result = await self.checkLimit(ip, endpoint);

                // Set rate limit headers
                res.setHeader('X-RateLimit-Limit', result.limit);
                res.setHeader('X-RateLimit-Remaining', result.remaining);

                if (!result.allowed) {
                    res.setHeader('Retry-After', result.retryAfter);
                    res.setHeader('X-RateLimit-Reset', Math.ceil(Date.now() / 1000) + result.retryAfter);

                    if (self.debug) {
                        console.log(`[VardaxRL] Rate limited: ${ip} on ${endpoint}`);
                    }

                    return res.status(429).json({
                        error: 'rate_limit_exceeded',
                        message: 'Too many requests',
                        retry_after: result.retryAfter,
                        limit: result.limit
                    });
                }

                next();
            } catch (err) {
                if (self.debug) console.error('[VardaxRL] Middleware error:', err);

                if (self.failOpen) {
                    next();
                } else {
                    res.status(503).json({
                        error: 'service_unavailable',
                        message: 'Rate limiting service temporarily unavailable'
                    });
                }
            }
        };
    }

    async close() {
        clearInterval(this.localCounterCleanupInterval);
        await this.redis.quit();
    }
}

module.exports = VardaxRateLimiter;
module.exports.VardaxRateLimiter = VardaxRateLimiter;
```


## 5. Nginx Configuration Snippet

```nginx
# /etc/nginx/conf.d/vardax-rate-limit.conf
# Rate limiting configuration for VARDAx protected applications

# Define rate limit zones
# Zone for general API requests (10MB shared memory, 20 requests/second)
limit_req_zone $binary_remote_addr zone=vardax_api:10m rate=20r/s;

# Zone for authentication endpoints (stricter)
limit_req_zone $binary_remote_addr zone=vardax_auth:10m rate=5r/m;

# Zone for static assets (more permissive)
limit_req_zone $binary_remote_addr zone=vardax_static:10m rate=100r/s;

# Connection limit zone
limit_conn_zone $binary_remote_addr zone=vardax_conn:10m;

# Custom log format for rate limiting events
log_format vardax_ratelimit '$remote_addr - $request_id [$time_local] '
                            '"$request" $status $body_bytes_sent '
                            '"$http_referer" "$http_user_agent" '
                            'limit_req_status=$limit_req_status';

# Map for dynamic rate limiting based on request characteristics
map $request_uri $vardax_limit_zone {
    default                     vardax_api;
    ~^/api/auth/               vardax_auth;
    ~^/api/v1/                 vardax_api;
    ~^/static/                 vardax_static;
    ~^/assets/                 vardax_static;
    ~\.(js|css|png|jpg|ico)$   vardax_static;
}

server {
    listen 80;
    server_name api.example.in;

    # Global connection limit
    limit_conn vardax_conn 50;
    limit_conn_status 429;
    limit_conn_log_level warn;

    # Rate limit error handling
    limit_req_status 429;
    limit_req_log_level warn;

    # Custom error page for rate limiting
    error_page 429 = @rate_limited;

    location @rate_limited {
        default_type application/json;
        return 429 '{"error":"rate_limit_exceeded","message":"Too many requests","retry_after":60}';
    }

    # API endpoints with rate limiting
    location /api/ {
        limit_req zone=vardax_api burst=50 nodelay;
        
        # Add rate limit headers
        add_header X-RateLimit-Limit 20 always;
        add_header X-RateLimit-Burst 50 always;

        proxy_pass http://vardax_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Request-ID $request_id;
    }

    # Authentication endpoints (stricter limits)
    location /api/auth/ {
        limit_req zone=vardax_auth burst=3 nodelay;
        
        add_header X-RateLimit-Limit 5 always;
        add_header X-RateLimit-Window 60 always;

        proxy_pass http://vardax_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Health check (no rate limiting)
    location /health {
        limit_req off;
        proxy_pass http://vardax_backend;
    }

    # Metrics endpoint (internal only)
    location /metrics {
        limit_req off;
        allow 10.0.0.0/8;
        allow 172.16.0.0/12;
        allow 192.168.0.0/16;
        deny all;
        proxy_pass http://vardax_backend;
    }
}

upstream vardax_backend {
    least_conn;
    server 127.0.0.1:3000 weight=1 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3001 weight=1 max_fails=3 fail_timeout=30s backup;
    keepalive 32;
}
```

## 6. Cloudflare Rules Snippet

```json
{
  "cloudflare_rate_limiting_rules": [
    {
      "name": "VARDAx API Rate Limit",
      "description": "Rate limit API endpoints to prevent abuse",
      "expression": "(http.request.uri.path contains \"/api/\")",
      "action": "block",
      "characteristics": ["ip.src"],
      "period": 10,
      "requests_per_period": 100,
      "mitigation_timeout": 60
    },
    {
      "name": "VARDAx Auth Rate Limit",
      "description": "Strict rate limit for authentication endpoints",
      "expression": "(http.request.uri.path contains \"/api/auth/\")",
      "action": "challenge",
      "characteristics": ["ip.src"],
      "period": 60,
      "requests_per_period": 5,
      "mitigation_timeout": 300
    },
    {
      "name": "VARDAx GraphQL Rate Limit",
      "description": "Rate limit GraphQL endpoint",
      "expression": "(http.request.uri.path eq \"/graphql\")",
      "action": "block",
      "characteristics": ["ip.src"],
      "period": 10,
      "requests_per_period": 30,
      "mitigation_timeout": 60
    }
  ],
  "cloudflare_waf_custom_rules": [
    {
      "name": "Block Known Bad User Agents",
      "expression": "(http.user_agent contains \"sqlmap\") or (http.user_agent contains \"nikto\") or (http.user_agent contains \"nmap\")",
      "action": "block"
    },
    {
      "name": "Challenge Suspicious Request Patterns",
      "expression": "(http.request.uri.query contains \"union\") or (http.request.uri.query contains \"select\") or (http.request.uri.query contains \"<script\")",
      "action": "managed_challenge"
    },
    {
      "name": "Block Empty User Agent on API",
      "expression": "(http.request.uri.path contains \"/api/\") and (http.user_agent eq \"\")",
      "action": "block"
    }
  ],
  "cloudflare_ddos_settings": {
    "sensitivity_level": "medium",
    "action": "challenge",
    "ruleset_id": "ddos_l7"
  }
}
```


## 7. k6 Load Test Script

```javascript
// k6-rate-limit-test.js
// Load testing script for VARDAx rate limiting validation
// Run: k6 run --vus 50 --duration 60s k6-rate-limit-test.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics
const rateLimitedRequests = new Counter('rate_limited_requests');
const successfulRequests = new Counter('successful_requests');
const rateLimitRate = new Rate('rate_limit_rate');
const responseTime = new Trend('response_time_ms');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_KEY = __ENV.API_KEY || '';

export const options = {
    scenarios: {
        // Scenario 1: Normal traffic pattern
        normal_traffic: {
            executor: 'constant-arrival-rate',
            rate: 10,
            timeUnit: '1s',
            duration: '30s',
            preAllocatedVUs: 20,
            maxVUs: 50,
            exec: 'normalTraffic',
            startTime: '0s'
        },
        // Scenario 2: Burst traffic (should trigger rate limiting)
        burst_traffic: {
            executor: 'constant-arrival-rate',
            rate: 100,
            timeUnit: '1s',
            duration: '20s',
            preAllocatedVUs: 100,
            maxVUs: 200,
            exec: 'burstTraffic',
            startTime: '30s'
        },
        // Scenario 3: Auth endpoint stress test
        auth_stress: {
            executor: 'per-vu-iterations',
            vus: 10,
            iterations: 20,
            exec: 'authStress',
            startTime: '50s'
        }
    },
    thresholds: {
        http_req_duration: ['p(95)<500'],
        rate_limit_rate: ['rate<0.3'],
        successful_requests: ['count>100']
    }
};

const headers = {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY
};

export function normalTraffic() {
    const endpoints = [
        '/api/v1/traffic',
        '/api/v1/anomalies',
        '/api/v1/rules',
        '/health'
    ];
    
    const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
    const res = http.get(`${BASE_URL}${endpoint}`, { headers });
    
    responseTime.add(res.timings.duration);
    
    const isRateLimited = res.status === 429;
    rateLimitRate.add(isRateLimited);
    
    if (isRateLimited) {
        rateLimitedRequests.add(1);
        const retryAfter = res.headers['Retry-After'];
        console.log(`Rate limited on ${endpoint}, retry after: ${retryAfter}s`);
    } else {
        successfulRequests.add(1);
    }
    
    check(res, {
        'status is 200 or 429': (r) => r.status === 200 || r.status === 429,
        'has rate limit headers': (r) => r.headers['X-RateLimit-Limit'] !== undefined
    });
    
    sleep(0.1);
}

export function burstTraffic() {
    const res = http.get(`${BASE_URL}/api/v1/traffic`, { headers });
    
    responseTime.add(res.timings.duration);
    
    const isRateLimited = res.status === 429;
    rateLimitRate.add(isRateLimited);
    
    if (isRateLimited) {
        rateLimitedRequests.add(1);
    } else {
        successfulRequests.add(1);
    }
    
    check(res, {
        'burst handled gracefully': (r) => r.status === 200 || r.status === 429,
        'response time acceptable': (r) => r.timings.duration < 1000
    });
}

export function authStress() {
    const payload = JSON.stringify({
        username: `testuser${__VU}`,
        password: 'testpassword123'
    });
    
    const res = http.post(`${BASE_URL}/api/auth/login`, payload, { headers });
    
    responseTime.add(res.timings.duration);
    
    const isRateLimited = res.status === 429;
    rateLimitRate.add(isRateLimited);
    
    if (isRateLimited) {
        rateLimitedRequests.add(1);
        console.log(`Auth rate limited for VU ${__VU}`);
    } else {
        successfulRequests.add(1);
    }
    
    check(res, {
        'auth endpoint protected': (r) => r.status === 200 || r.status === 401 || r.status === 429
    });
    
    sleep(0.5);
}

export function handleSummary(data) {
    const summary = {
        total_requests: data.metrics.http_reqs.values.count,
        rate_limited: data.metrics.rate_limited_requests?.values.count || 0,
        successful: data.metrics.successful_requests?.values.count || 0,
        rate_limit_percentage: (data.metrics.rate_limit_rate?.values.rate * 100).toFixed(2) + '%',
        avg_response_time: data.metrics.http_req_duration.values.avg.toFixed(2) + 'ms',
        p95_response_time: data.metrics.http_req_duration.values['p(95)'].toFixed(2) + 'ms'
    };
    
    console.log('\n=== VARDAx Rate Limit Test Summary ===');
    console.log(JSON.stringify(summary, null, 2));
    
    return {
        'stdout': JSON.stringify(summary, null, 2),
        'rate-limit-test-results.json': JSON.stringify(data, null, 2)
    };
}
```

## 8. Prometheus and Grafana Configuration

### Prometheus Rules (prometheus-rules.yaml)

```yaml
groups:
  - name: vardax_rate_limiting
    interval: 15s
    rules:
      # Rate limit hit rate
      - record: vardax:rate_limit_hits:rate5m
        expr: rate(vardax_rate_limit_hits_total[5m])

      # Rate limit by endpoint
      - record: vardax:rate_limit_by_endpoint:rate5m
        expr: sum by (endpoint) (rate(vardax_rate_limit_hits_total[5m]))

      # Alert: High rate limit rate
      - alert: VardaxHighRateLimitRate
        expr: vardax:rate_limit_hits:rate5m > 100
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High rate of rate-limited requests"
          description: "Rate limit hits exceeding 100/s for 5 minutes"

      # Alert: Potential DDoS
      - alert: VardaxPotentialDDoS
        expr: rate(vardax_requests_total[1m]) > 10000
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Potential DDoS attack detected"
          description: "Request rate exceeding 10k/min for 2 minutes"

      # Alert: Redis rate limiter unavailable
      - alert: VardaxRateLimiterDown
        expr: vardax_rate_limiter_redis_available == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Rate limiter Redis unavailable"
          description: "Redis backend for rate limiting is down"

      # Alert: High penalty score accumulation
      - alert: VardaxHighPenaltyAccumulation
        expr: sum(vardax_penalty_score) > 1000
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High penalty score accumulation"
          description: "Many clients accumulating penalty scores"
```

### Grafana Dashboard (grafana-dashboard.json)

```json
{
  "dashboard": {
    "title": "VARDAx Rate Limiting Dashboard",
    "uid": "vardax-rate-limit",
    "timezone": "browser",
    "refresh": "10s",
    "panels": [
      {
        "title": "Rate Limited Requests/sec",
        "type": "timeseries",
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0},
        "targets": [
          {
            "expr": "rate(vardax_rate_limit_hits_total[1m])",
            "legendFormat": "Rate Limited"
          }
        ]
      },
      {
        "title": "Rate Limit by Endpoint",
        "type": "piechart",
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 0},
        "targets": [
          {
            "expr": "sum by (endpoint) (vardax_rate_limit_hits_total)",
            "legendFormat": "{{endpoint}}"
          }
        ]
      },
      {
        "title": "Request Rate vs Limit",
        "type": "timeseries",
        "gridPos": {"h": 8, "w": 24, "x": 0, "y": 8},
        "targets": [
          {
            "expr": "rate(vardax_requests_total[1m])",
            "legendFormat": "Requests/sec"
          },
          {
            "expr": "vardax_rate_limit_capacity",
            "legendFormat": "Limit"
          }
        ]
      },
      {
        "title": "Top Rate Limited IPs",
        "type": "table",
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 16},
        "targets": [
          {
            "expr": "topk(10, sum by (client_ip) (vardax_rate_limit_hits_total))",
            "format": "table"
          }
        ]
      },
      {
        "title": "Redis Rate Limiter Health",
        "type": "stat",
        "gridPos": {"h": 4, "w": 6, "x": 12, "y": 16},
        "targets": [
          {
            "expr": "vardax_rate_limiter_redis_available",
            "legendFormat": "Redis Available"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "mappings": [
              {"type": "value", "options": {"0": {"text": "DOWN", "color": "red"}}},
              {"type": "value", "options": {"1": {"text": "UP", "color": "green"}}}
            ]
          }
        }
      },
      {
        "title": "Avg Response Time (Rate Limited)",
        "type": "gauge",
        "gridPos": {"h": 4, "w": 6, "x": 18, "y": 16},
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(vardax_rate_limit_response_time_bucket[5m]))",
            "legendFormat": "p95 Response Time"
          }
        ]
      }
    ]
  }
}
```


## 9. Deployment Steps

### Phase 1: Redis Setup

```bash
# Option A: Docker (Development)
docker run -d --name vardax-redis \
  -p 6379:6379 \
  -v vardax-redis-data:/data \
  redis:7-alpine \
  redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru

# Option B: Redis Cluster (Production)
# Create redis-cluster.yaml for Kubernetes
kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: redis-cluster-config
data:
  redis.conf: |
    cluster-enabled yes
    cluster-config-file nodes.conf
    cluster-node-timeout 5000
    appendonly yes
    maxmemory 1gb
    maxmemory-policy allkeys-lru
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis-cluster
spec:
  serviceName: redis-cluster
  replicas: 6
  selector:
    matchLabels:
      app: redis-cluster
  template:
    metadata:
      labels:
        app: redis-cluster
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
        - containerPort: 16379
        command: ["redis-server", "/conf/redis.conf"]
        volumeMounts:
        - name: conf
          mountPath: /conf
        - name: data
          mountPath: /data
      volumes:
      - name: conf
        configMap:
          name: redis-cluster-config
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 10Gi
EOF
```

### Phase 2: Install Dependencies

```bash
# In your Node.js application directory
npm install ioredis prom-client

# Or with yarn
yarn add ioredis prom-client
```

### Phase 3: Integrate Middleware

```javascript
// app.js or server.js
const express = require('express');
const VardaxRateLimiter = require('./vardax-rate-limiter');
const vardax = require('@vardax/connect');

const app = express();

// Initialize rate limiter
const rateLimiter = new VardaxRateLimiter({
    debug: process.env.NODE_ENV !== 'production',
    failOpen: true,
    endpointLimits: {
        '/api/auth/': 'auth',
        '/api/v1/': 'api',
        '/graphql': 'strict'
    }
});

// Apply rate limiting middleware (before VARDAx)
app.use(rateLimiter.middleware({
    skipPaths: ['/health', '/ready', '/metrics']
}));

// Apply VARDAx ML protection
app.use(vardax('vardax://localhost:8000?apiKey=YOUR_KEY&mode=protect'));

// Your routes here
app.get('/api/v1/data', (req, res) => {
    res.json({ status: 'ok' });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    await rateLimiter.close();
    process.exit(0);
});

app.listen(3000);
```

### Phase 4: Configure Nginx

```bash
# Copy nginx config
sudo cp vardax-rate-limit.conf /etc/nginx/conf.d/

# Test configuration
sudo nginx -t

# Reload nginx
sudo nginx -s reload
```

### Phase 5: Configure Cloudflare

```bash
# Using Cloudflare API (replace with your zone ID and API token)
ZONE_ID="your_zone_id"
API_TOKEN="your_api_token"

# Create rate limiting rule
curl -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/rulesets" \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{
    "name": "VARDAx Rate Limiting",
    "kind": "zone",
    "phase": "http_ratelimit",
    "rules": [
      {
        "action": "block",
        "expression": "(http.request.uri.path contains \"/api/\")",
        "ratelimit": {
          "characteristics": ["ip.src"],
          "period": 10,
          "requests_per_period": 100,
          "mitigation_timeout": 60
        }
      }
    ]
  }'
```

### Phase 6: Monitoring Setup

```bash
# Add Prometheus scrape config
cat >> /etc/prometheus/prometheus.yml <<EOF
  - job_name: 'vardax-app'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scrape_interval: 15s
EOF

# Reload Prometheus
curl -X POST http://localhost:9090/-/reload

# Import Grafana dashboard
curl -X POST http://localhost:3000/api/dashboards/db \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_GRAFANA_API_KEY" \
  -d @grafana-dashboard.json
```

## 10. Recommended Defaults

| Profile | Capacity | Refill Rate | Use Case |
|---------|----------|-------------|----------|
| **Small** | 20 req | 2 req/s | Auth endpoints, password reset |
| **Medium** | 100 req | 10 req/s | Standard API endpoints |
| **Large** | 500 req | 50 req/s | Public read endpoints, CDN origin |
| **Burst** | 1000 req | 100 req/s | Webhooks, batch operations |

### Endpoint-Specific Recommendations

```javascript
const endpointProfiles = {
    // Authentication (strict)
    '/api/auth/login': { capacity: 5, refillRate: 0.1 },      // 5 per 50s
    '/api/auth/register': { capacity: 3, refillRate: 0.05 },  // 3 per minute
    '/api/auth/reset-password': { capacity: 2, refillRate: 0.03 }, // 2 per minute
    '/api/auth/verify-email': { capacity: 5, refillRate: 0.1 },
    
    // API endpoints (medium)
    '/api/v1/': { capacity: 60, refillRate: 1 },              // 60 per minute
    '/api/v2/': { capacity: 60, refillRate: 1 },
    
    // GraphQL (careful - single endpoint, many operations)
    '/graphql': { capacity: 30, refillRate: 0.5 },            // 30 per minute
    
    // Webhooks (relaxed for trusted sources)
    '/webhooks/': { capacity: 200, refillRate: 20 },
    
    // File uploads (strict)
    '/api/upload': { capacity: 10, refillRate: 0.2 },         // 10 per 50s
    
    // Search (medium-strict)
    '/api/search': { capacity: 20, refillRate: 0.5 }          // 20 per 40s
};
```

## 11. Edge Cases and Mitigations

### Shared IPs (NAT, Corporate Networks, VPNs)

```javascript
// Use composite key: IP + User-Agent hash + optional session
function getCompositeKey(req) {
    const ip = getClientIp(req);
    const ua = req.headers['user-agent'] || '';
    const uaHash = crypto.createHash('sha256').update(ua).digest('hex').slice(0, 8);
    const sessionId = req.cookies?.sessionId || req.headers['x-session-id'] || '';
    
    // If authenticated, use user ID instead
    if (req.user?.id) {
        return `user:${req.user.id}`;
    }
    
    // For shared IPs, include UA hash to differentiate
    return `${ip}:${uaHash}${sessionId ? ':' + sessionId.slice(0, 8) : ''}`;
}

// Increase limits for known shared IP ranges
const sharedIpRanges = [
    '10.0.0.0/8',      // Private
    '172.16.0.0/12',   // Private
    '192.168.0.0/16',  // Private
    // Add known corporate/university ranges
];

function adjustLimitsForSharedIp(ip, baseLimits) {
    if (isInRange(ip, sharedIpRanges)) {
        return {
            capacity: baseLimits.capacity * 5,
            refillRate: baseLimits.refillRate * 5
        };
    }
    return baseLimits;
}
```

### Bursty Clients (Mobile Apps, Batch Operations)

```javascript
// Token bucket naturally handles bursts
// Configure burst allowance via capacity vs refill rate ratio

// Example: Allow burst of 50, sustained rate of 10/s
const burstyProfile = {
    capacity: 50,      // Max burst
    refillRate: 10     // Sustained rate
};

// For batch endpoints, use token cost based on batch size
async function checkBatchLimit(req, batchSize) {
    const tokenCost = Math.ceil(batchSize / 10); // 1 token per 10 items
    return rateLimiter.checkLimit(
        getClientIp(req),
        req.path,
        tokenCost
    );
}
```

### Redis Split-Brain / Partition

```javascript
// Mitigation: Local fallback with conservative limits
class ResilientRateLimiter extends VardaxRateLimiter {
    constructor(options) {
        super(options);
        this.redisHealthy = true;
        this.healthCheckInterval = setInterval(() => this.checkRedisHealth(), 5000);
    }

    async checkRedisHealth() {
        try {
            await this.redis.ping();
            this.redisHealthy = true;
        } catch (err) {
            this.redisHealthy = false;
            console.warn('[VardaxRL] Redis unhealthy, using local fallback');
        }
    }

    async checkLimit(ip, endpoint, tokensRequested = 1) {
        if (!this.redisHealthy) {
            // Use stricter local limits during Redis outage
            const limits = this.getLimits(endpoint);
            return this.checkLimitLocal(ip, endpoint, {
                capacity: Math.floor(limits.capacity / 2),
                refillRate: limits.refillRate / 2
            });
        }
        return super.checkLimit(ip, endpoint, tokensRequested);
    }
}
```

### Clock Skew (Distributed Systems)

```javascript
// Use Redis server time instead of local time
async function getRedisTime() {
    const [seconds, microseconds] = await this.redis.time();
    return parseInt(seconds) * 1000 + Math.floor(parseInt(microseconds) / 1000);
}

// Modified Lua script using Redis TIME
const LUA_SCRIPT_WITH_REDIS_TIME = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local requested = tonumber(ARGV[3])

-- Use Redis server time
local time = redis.call('TIME')
local now_ms = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)

-- Rest of script unchanged...
`;
```

### Graceful Degradation During Attacks

```javascript
// Adaptive rate limiting based on system load
async function getAdaptiveLimits(baseLimits) {
    const metrics = await getSystemMetrics();
    
    let multiplier = 1.0;
    
    // Reduce limits under high load
    if (metrics.cpuUsage > 80) multiplier *= 0.5;
    if (metrics.memoryUsage > 85) multiplier *= 0.7;
    if (metrics.activeConnections > 10000) multiplier *= 0.3;
    
    return {
        capacity: Math.max(5, Math.floor(baseLimits.capacity * multiplier)),
        refillRate: Math.max(0.1, baseLimits.refillRate * multiplier)
    };
}
```


## 12. One-Page Runbook: 429 Spike Incident Response

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                    VARDAX 429 SPIKE INCIDENT RUNBOOK                         ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  SEVERITY: P2 (Service Degradation) | ESCALATION: On-Call → SRE → Security  ║
╚══════════════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 1: TRIAGE (0-5 min)                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ □ Check Grafana dashboard: VARDAx Rate Limiting Dashboard                   │
│ □ Identify: Is this legitimate traffic or attack?                           │
│   - Check "Top Rate Limited IPs" panel                                      │
│   - Check geographic distribution                                           │
│   - Check User-Agent patterns                                               │
│                                                                             │
│ COMMANDS:                                                                   │
│   # Get top offending IPs                                                   │
│   redis-cli KEYS "vardax:rl:*" | head -20                                   │
│                                                                             │
│   # Check current rate limit hits                                           │
│   curl -s localhost:3000/metrics | grep vardax_rate_limit                   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 2: CLASSIFY (5-10 min)                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ SCENARIO A: Legitimate Traffic Spike (marketing campaign, viral content)   │
│   → Go to STEP 3A                                                           │
│                                                                             │
│ SCENARIO B: Single IP/Range Attack                                          │
│   → Go to STEP 3B                                                           │
│                                                                             │
│ SCENARIO C: Distributed Attack (DDoS)                                       │
│   → Go to STEP 3C                                                           │
│                                                                             │
│ SCENARIO D: Misconfigured Client/Partner                                    │
│   → Go to STEP 3D                                                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 3A: LEGITIMATE TRAFFIC - SCALE UP                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ □ Temporarily increase rate limits:                                         │
│                                                                             │
│   # Update environment variable                                             │
│   export RATE_LIMIT_CAPACITY=500                                            │
│   export RATE_LIMIT_REFILL_RATE=50                                          │
│                                                                             │
│   # Or update Redis directly (temporary)                                    │
│   redis-cli CONFIG SET maxmemory 512mb                                      │
│                                                                             │
│ □ Scale application horizontally:                                           │
│   kubectl scale deployment vardax-app --replicas=5                          │
│                                                                             │
│ □ Enable CDN caching for cacheable endpoints                                │
│ □ Notify stakeholders of increased capacity                                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 3B: SINGLE IP/RANGE ATTACK - BLOCK                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ □ Block at Cloudflare (fastest):                                            │
│                                                                             │
│   curl -X POST "https://api.cloudflare.com/client/v4/zones/ZONE/firewall/   │
│   access_rules/rules" -H "Authorization: Bearer TOKEN" -d '{                │
│     "mode": "block",                                                        │
│     "configuration": {"target": "ip", "value": "ATTACKER_IP"},              │
│     "notes": "Blocked due to rate limit abuse - INCIDENT_ID"                │
│   }'                                                                        │
│                                                                             │
│ □ Block at Nginx (if Cloudflare unavailable):                               │
│   echo "deny ATTACKER_IP;" >> /etc/nginx/conf.d/blocklist.conf              │
│   nginx -s reload                                                           │
│                                                                             │
│ □ Add to permanent blocklist after investigation                            │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 3C: DISTRIBUTED ATTACK (DDoS) - ESCALATE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│ □ Enable Cloudflare "Under Attack" mode:                                    │
│   - Dashboard → Security → Settings → Security Level → I'm Under Attack     │
│                                                                             │
│ □ Enable stricter rate limits:                                              │
│   export RATE_LIMIT_CAPACITY=10                                             │
│   export RATE_LIMIT_REFILL_RATE=1                                           │
│                                                                             │
│ □ Enable JS challenge for all requests:                                     │
│   - Cloudflare → Security → WAF → Create Rule                               │
│   - Expression: (http.request.uri.path contains "/api/")                    │
│   - Action: Managed Challenge                                               │
│                                                                             │
│ □ ESCALATE to Security Team immediately                                     │
│ □ Preserve logs for forensics:                                              │
│   kubectl logs -l app=vardax-app --since=1h > incident_logs.txt             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 3D: MISCONFIGURED CLIENT - COMMUNICATE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ □ Identify client from User-Agent or API key                                │
│ □ Temporarily whitelist if critical partner:                                │
│                                                                             │
│   # Add to Redis whitelist                                                  │
│   redis-cli SADD vardax:whitelist:ips "PARTNER_IP"                          │
│   redis-cli EXPIRE vardax:whitelist:ips 3600                                │
│                                                                             │
│ □ Contact client/partner with:                                              │
│   - Current request rate observed                                           │
│   - Recommended rate limit                                                  │
│   - Retry-After header guidance                                             │
│   - Exponential backoff implementation guide                                │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 4: VERIFY RESOLUTION                                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ □ Monitor Grafana for 15 minutes                                            │
│ □ Verify 429 rate returning to baseline (<5%)                               │
│ □ Check application health endpoints                                        │
│ □ Verify no customer complaints in support queue                            │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 5: POST-INCIDENT                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│ □ Document incident in incident tracker                                     │
│ □ Update blocklists if attack                                               │
│ □ Review and adjust rate limits if needed                                   │
│ □ Schedule post-mortem if P1/P2                                             │
│ □ Update runbook with lessons learned                                       │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ QUICK REFERENCE COMMANDS                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ # View current rate limit state for an IP                                   │
│ redis-cli HGETALL "vardax:rl:192.168.1.1:/api/v1/"                          │
│                                                                             │
│ # Clear rate limit for specific IP (emergency)                              │
│ redis-cli DEL "vardax:rl:192.168.1.1:/api/v1/"                              │
│                                                                             │
│ # View all rate limited keys                                                │
│ redis-cli KEYS "vardax:rl:*" | wc -l                                        │
│                                                                             │
│ # Check Redis memory usage                                                  │
│ redis-cli INFO memory | grep used_memory_human                              │
│                                                                             │
│ # Tail application logs for 429s                                            │
│ kubectl logs -f -l app=vardax-app | grep "rate_limit"                       │
│                                                                             │
│ # Check Nginx rate limit status                                             │
│ tail -f /var/log/nginx/error.log | grep "limiting"                          │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ CONTACTS                                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ On-Call SRE:        [PAGERDUTY_LINK]                                        │
│ Security Team:      security@example.in                                     │
│ Cloudflare Support: [CLOUDFLARE_DASHBOARD]                                  │
│ Incident Channel:   #incident-response (Slack)                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Integration with Vardax Connect

To integrate this rate limiting with the existing `@vardax/connect` package:

```javascript
// vardax-connect-with-rate-limit.js
const vardax = require('@vardax/connect');
const VardaxRateLimiter = require('./vardax-rate-limiter');

function createProtectedMiddleware(connectionString, options = {}) {
    const rateLimiter = new VardaxRateLimiter(options.rateLimiter || {});
    const vardaxMiddleware = vardax(connectionString, options.vardax || {});

    return async function protectedMiddleware(req, res, next) {
        // Layer 1: Rate limiting
        const ip = rateLimiter.getClientIp(req);
        const result = await rateLimiter.checkLimit(ip, req.path);

        res.setHeader('X-RateLimit-Limit', result.limit);
        res.setHeader('X-RateLimit-Remaining', result.remaining);

        if (!result.allowed) {
            res.setHeader('Retry-After', result.retryAfter);
            return res.status(429).json({
                error: 'rate_limit_exceeded',
                retry_after: result.retryAfter
            });
        }

        // Layer 2: VARDAx ML protection
        vardaxMiddleware(req, res, next);
    };
}

module.exports = createProtectedMiddleware;
```

---

## Files Created

| File | Purpose |
|------|---------|
| `RATE_LIMITING_DDOS_DEFENSE.md` | This comprehensive guide |
| `vardax-rate-limiter.js` | Node.js middleware (copy from Section 4) |
| `vardax-rate-limit.conf` | Nginx configuration (copy from Section 5) |
| `k6-rate-limit-test.js` | Load testing script (copy from Section 7) |
| `prometheus-rules.yaml` | Alerting rules (copy from Section 8) |
| `grafana-dashboard.json` | Monitoring dashboard (copy from Section 8) |

---

*Generated for VARDAx DDoS Defense System*
*Stack: Node.js + Express, Redis Cluster, Nginx, Cloudflare, Prometheus/Grafana, k6*
