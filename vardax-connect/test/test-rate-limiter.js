/**
 * Rate Limiter Tests for @vardax/connect
 * Tests the VardaxRateLimiter class without Redis (local fallback mode)
 */

const { VardaxRateLimiter } = require('../lib/rate-limiter');

console.log('🧪 Testing VardaxRateLimiter\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`✅ ${name}`);
        passed++;
    } catch (error) {
        console.log(`❌ ${name}`);
        console.log(`   Error: ${error.message}`);
        failed++;
    }
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`${message}: expected ${expected}, got ${actual}`);
    }
}

function assertTrue(value, message) {
    if (!value) {
        throw new Error(`${message}: expected truthy value`);
    }
}

function assertFalse(value, message) {
    if (value) {
        throw new Error(`${message}: expected falsy value`);
    }
}

// Test 1: Constructor defaults
test('Constructor sets default values', () => {
    const limiter = new VardaxRateLimiter();
    assertEqual(limiter.keyPrefix, 'vardax:rl', 'keyPrefix');
    assertEqual(limiter.failOpen, true, 'failOpen');
    assertEqual(limiter.debug, false, 'debug');
});

// Test 2: Constructor with options
test('Constructor accepts custom options', () => {
    const limiter = new VardaxRateLimiter({
        keyPrefix: 'custom:rl',
        failOpen: false,
        debug: true
    });
    assertEqual(limiter.keyPrefix, 'custom:rl', 'keyPrefix');
    assertEqual(limiter.failOpen, false, 'failOpen');
    assertEqual(limiter.debug, true, 'debug');
});

// Test 3: Default profiles exist
test('Default rate limit profiles exist', () => {
    const limiter = new VardaxRateLimiter();
    assertTrue(limiter.profiles.default, 'default profile');
    assertTrue(limiter.profiles.strict, 'strict profile');
    assertTrue(limiter.profiles.relaxed, 'relaxed profile');
    assertTrue(limiter.profiles.auth, 'auth profile');
    assertTrue(limiter.profiles.api, 'api profile');
});

// Test 4: Profile values are correct
test('Profile values are correct', () => {
    const limiter = new VardaxRateLimiter();
    assertEqual(limiter.profiles.default.capacity, 100, 'default capacity');
    assertEqual(limiter.profiles.default.refillRate, 10, 'default refillRate');
    assertEqual(limiter.profiles.auth.capacity, 5, 'auth capacity');
    assertEqual(limiter.profiles.auth.refillRate, 0.1, 'auth refillRate');
});

// Test 5: getLimits returns correct profile
test('getLimits returns correct profile for endpoint', () => {
    const limiter = new VardaxRateLimiter();
    
    const authLimits = limiter.getLimits('/api/auth/login');
    assertEqual(authLimits.capacity, 5, 'auth endpoint capacity');
    
    const defaultLimits = limiter.getLimits('/api/unknown');
    assertEqual(defaultLimits.capacity, 100, 'unknown endpoint uses default');
});

// Test 6: getLimits prefix matching
test('getLimits matches endpoint prefixes', () => {
    const limiter = new VardaxRateLimiter({
        endpointLimits: {
            '/api/v1/': 'api'
        }
    });
    
    const limits = limiter.getLimits('/api/v1/users');
    assertEqual(limits.capacity, 60, 'prefix match capacity');
});

// Test 7: getClientIp from x-forwarded-for
test('getClientIp extracts from x-forwarded-for', () => {
    const limiter = new VardaxRateLimiter();
    const req = {
        headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
        ip: '127.0.0.1'
    };
    assertEqual(limiter.getClientIp(req), '1.2.3.4', 'first IP from xff');
});

// Test 8: getClientIp from x-real-ip
test('getClientIp extracts from x-real-ip', () => {
    const limiter = new VardaxRateLimiter();
    const req = {
        headers: { 'x-real-ip': '10.0.0.1' },
        ip: '127.0.0.1'
    };
    assertEqual(limiter.getClientIp(req), '10.0.0.1', 'x-real-ip');
});

// Test 9: getClientIp fallback to req.ip
test('getClientIp falls back to req.ip', () => {
    const limiter = new VardaxRateLimiter();
    const req = {
        headers: {},
        ip: '192.168.1.1'
    };
    assertEqual(limiter.getClientIp(req), '192.168.1.1', 'req.ip fallback');
});

// Test 10: Local fallback rate limiting
test('checkLimitLocal allows requests within limit', () => {
    const limiter = new VardaxRateLimiter();
    const limits = { capacity: 10, refillRate: 1 };
    
    const result = limiter.checkLimitLocal('1.2.3.4', '/test', limits);
    assertTrue(result.allowed, 'first request allowed');
    assertEqual(result.remaining, 9, 'remaining tokens');
    assertEqual(result.limit, 10, 'limit value');
    assertTrue(result.fallback, 'fallback flag set');
});

// Test 11: Local fallback blocks after limit
test('checkLimitLocal blocks after exceeding limit', () => {
    const limiter = new VardaxRateLimiter();
    const limits = { capacity: 3, refillRate: 0.1 };
    
    // Exhaust the limit
    for (let i = 0; i < 3; i++) {
        limiter.checkLimitLocal('exhaust-ip', '/test', limits);
    }
    
    // Next request should be blocked
    const result = limiter.checkLimitLocal('exhaust-ip', '/test', limits);
    assertFalse(result.allowed, 'request blocked after limit');
    assertEqual(result.remaining, 0, 'no remaining tokens');
    assertTrue(result.retryAfter > 0, 'retry after set');
});

// Test 12: Different IPs have independent limits
test('Different IPs have independent local limits', () => {
    const limiter = new VardaxRateLimiter();
    const limits = { capacity: 2, refillRate: 0.1 };
    
    // Exhaust IP A
    limiter.checkLimitLocal('ip-a', '/test', limits);
    limiter.checkLimitLocal('ip-a', '/test', limits);
    const resultA = limiter.checkLimitLocal('ip-a', '/test', limits);
    
    // IP B should still work
    const resultB = limiter.checkLimitLocal('ip-b', '/test', limits);
    
    assertFalse(resultA.allowed, 'IP A blocked');
    assertTrue(resultB.allowed, 'IP B allowed');
});

// Test 13: Middleware creation
test('middleware() returns a function', () => {
    const limiter = new VardaxRateLimiter();
    const middleware = limiter.middleware();
    assertEqual(typeof middleware, 'function', 'middleware is function');
});

// Test 14: Middleware skips exempt paths
test('middleware skips configured paths', async () => {
    const limiter = new VardaxRateLimiter();
    const middleware = limiter.middleware({ skipPaths: ['/health', '/metrics'] });
    
    let nextCalled = false;
    const req = { path: '/health', headers: {} };
    const res = { setHeader: () => {} };
    const next = () => { nextCalled = true; };
    
    await middleware(req, res, next);
    assertTrue(nextCalled, 'next() called for exempt path');
});

// Test 15: Middleware sets rate limit headers
test('middleware sets rate limit headers', async () => {
    const limiter = new VardaxRateLimiter();
    const middleware = limiter.middleware();
    
    const headers = {};
    const req = { 
        path: '/api/test', 
        headers: {},
        ip: '1.2.3.4'
    };
    const res = { 
        setHeader: (name, value) => { headers[name] = value; },
        status: () => ({ json: () => {} })
    };
    const next = () => {};
    
    await middleware(req, res, next);
    
    assertTrue('X-RateLimit-Limit' in headers, 'Limit header set');
    assertTrue('X-RateLimit-Remaining' in headers, 'Remaining header set');
});

// Test 16: Middleware returns 429 when rate limited
test('middleware returns 429 when rate limited', async () => {
    const limiter = new VardaxRateLimiter();
    const middleware = limiter.middleware();
    
    // Exhaust the limit
    const limits = limiter.profiles.default;
    for (let i = 0; i < limits.capacity + 1; i++) {
        limiter.checkLimitLocal('rate-limit-ip', '/api/test', limits);
    }
    
    let statusCode = null;
    let responseBody = null;
    const headers = {};
    
    const req = { 
        path: '/api/test', 
        headers: {},
        ip: 'rate-limit-ip'
    };
    const res = { 
        setHeader: (name, value) => { headers[name] = value; },
        status: (code) => {
            statusCode = code;
            return {
                json: (body) => { responseBody = body; }
            };
        }
    };
    const next = () => {};
    
    await middleware(req, res, next);
    
    assertEqual(statusCode, 429, 'status code is 429');
    assertEqual(responseBody.error, 'rate_limit_exceeded', 'error message');
    assertTrue('Retry-After' in headers, 'Retry-After header set');
});

// Test 17: Custom endpoint limits
test('Custom endpoint limits work', () => {
    const limiter = new VardaxRateLimiter({
        endpointLimits: {
            '/custom/': 'strict'
        }
    });
    
    const limits = limiter.getLimits('/custom/endpoint');
    assertEqual(limits.capacity, 20, 'custom endpoint uses strict profile');
});

// Test 18: Close method exists
test('close() method exists and is callable', async () => {
    const limiter = new VardaxRateLimiter();
    assertEqual(typeof limiter.close, 'function', 'close is function');
    
    // Should not throw
    await limiter.close();
});

// Test 19: Lua script is exported
test('LUA_SCRIPT is exported', () => {
    const { LUA_SCRIPT } = require('../lib/rate-limiter');
    assertTrue(LUA_SCRIPT.includes('KEYS[1]'), 'Lua script has KEYS');
    assertTrue(LUA_SCRIPT.includes('ARGV[1]'), 'Lua script has ARGV');
    assertTrue(LUA_SCRIPT.includes('redis.call'), 'Lua script has redis.call');
});

// Test 20: Fail open behavior
test('Fail open allows requests on error', async () => {
    const limiter = new VardaxRateLimiter({ failOpen: true });
    
    // Force an error by using invalid redis
    limiter.redis = {
        evalsha: () => { throw new Error('Redis error'); },
        script: () => { throw new Error('Redis error'); }
    };
    limiter.scriptSha = 'fake-sha';
    
    // Should fall back to local and allow
    const result = await limiter.checkLimit('1.2.3.4', '/test');
    assertTrue(result.allowed, 'request allowed on error with failOpen');
});

console.log('\n' + '='.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(50));

if (failed > 0) {
    process.exit(1);
}
