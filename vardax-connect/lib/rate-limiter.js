/**
 * VARDAx Rate Limiter
 * Production-ready token bucket rate limiting with Redis backend
 * 
 * @module @vardax/connect/rate-limiter
 */

const crypto = require('crypto');

// Lua script for atomic token bucket
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
        this.redis = options.redis || null;
        this.scriptSha = null;
        this.keyPrefix = options.keyPrefix || 'vardax:rl';
        this.failOpen = options.failOpen !== false;
        this.debug = options.debug || false;

        // Rate limit profiles
        this.profiles = {
            default: { capacity: 100, refillRate: 10 },
            strict: { capacity: 20, refillRate: 2 },
            relaxed: { capacity: 500, refillRate: 50 },
            auth: { capacity: 5, refillRate: 0.1 },
            api: { capacity: 60, refillRate: 1 }
        };

        // Endpoint overrides
        this.endpointLimits = options.endpointLimits || {
            '/api/auth/login': 'auth',
            '/api/auth/register': 'auth',
            '/api/auth/reset-password': 'auth',
            '/graphql': 'strict'
        };

        // Local fallback
        this.localCounters = new Map();
        this.cleanupInterval = setInterval(() => {
            const now = Date.now();
            for (const [key, data] of this.localCounters) {
                if (now - data.timestamp > 60000) {
                    this.localCounters.delete(key);
                }
            }
        }, 30000);
    }

    async ensureScript() {
        if (!this.redis) return null;
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
        const xff = req.headers['x-forwarded-for'];
        if (xff) return xff.split(',')[0].trim();
        const realIp = req.headers['x-real-ip'];
        if (realIp) return realIp;
        return req.ip || req.connection?.remoteAddress || 'unknown';
    }

    getLimits(endpoint) {
        if (this.endpointLimits[endpoint]) {
            const profile = this.endpointLimits[endpoint];
            return this.profiles[profile] || this.profiles.default;
        }
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

        if (!this.redis) {
            return this.checkLimitLocal(ip, endpoint, limits);
        }

        try {
            const sha = await this.ensureScript();
            const result = await this.redis.evalsha(
                sha, 1, key,
                limits.capacity, limits.refillRate, nowMs, tokensRequested
            );
            return {
                allowed: result[0] === 1,
                remaining: result[1],
                retryAfter: result[2],
                limit: result[3]
            };
        } catch (err) {
            if (err.message?.includes('NOSCRIPT')) {
                this.scriptSha = null;
                return this.checkLimit(ip, endpoint, tokensRequested);
            }
            if (this.debug) console.error('[VardaxRL] Redis error:', err.message);
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
            if (skipPaths.has(req.path)) return next();

            const ip = self.getClientIp(req);
            const endpoint = req.path;

            try {
                const result = await self.checkLimit(ip, endpoint);
                res.setHeader('X-RateLimit-Limit', result.limit);
                res.setHeader('X-RateLimit-Remaining', result.remaining);

                if (!result.allowed) {
                    res.setHeader('Retry-After', result.retryAfter);
                    res.setHeader('X-RateLimit-Reset', Math.ceil(Date.now() / 1000) + result.retryAfter);
                    if (self.debug) console.log(`[VardaxRL] Rate limited: ${ip} on ${endpoint}`);
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
                if (self.failOpen) next();
                else res.status(503).json({ error: 'service_unavailable' });
            }
        };
    }

    async close() {
        clearInterval(this.cleanupInterval);
        if (this.redis) await this.redis.quit();
    }
}

module.exports = VardaxRateLimiter;
module.exports.VardaxRateLimiter = VardaxRateLimiter;
module.exports.LUA_SCRIPT = LUA_SCRIPT;
