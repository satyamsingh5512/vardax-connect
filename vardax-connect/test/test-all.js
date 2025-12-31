/**
 * Comprehensive Test Suite for @vardax/connect
 * Run: node test/test-all.js
 */

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║           VARDAx Connect - Comprehensive Test Suite          ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

const vardax = require('../index');
const { VardaxRateLimiter } = require('../lib/rate-limiter');

let totalPassed = 0;
let totalFailed = 0;
const results = [];

function section(name) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`  ${name}`);
    console.log('─'.repeat(60));
}

function test(name, fn) {
    try {
        const result = fn();
        if (result instanceof Promise) {
            return result.then(() => {
                console.log(`  ✅ ${name}`);
                totalPassed++;
                results.push({ name, status: 'passed' });
            }).catch(err => {
                console.log(`  ❌ ${name}`);
                console.log(`     Error: ${err.message}`);
                totalFailed++;
                results.push({ name, status: 'failed', error: err.message });
            });
        }
        console.log(`  ✅ ${name}`);
        totalPassed++;
        results.push({ name, status: 'passed' });
    } catch (error) {
        console.log(`  ❌ ${name}`);
        console.log(`     Error: ${error.message}`);
        totalFailed++;
        results.push({ name, status: 'failed', error: error.message });
    }
}

function assert(condition, message) {
    if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`${message || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
}

async function runTests() {
    // ═══════════════════════════════════════════════════════════════
    // SECTION 1: Connection String Parsing
    // ═══════════════════════════════════════════════════════════════
    section('1. Connection String Parsing');

    test('Parse vardax:// protocol', () => {
        const config = vardax.parseConnectionString('vardax://localhost:8000');
        assertEqual(config.host, 'localhost');
        assertEqual(config.port, '8000');
    });

    test('Parse http:// protocol', () => {
        const config = vardax.parseConnectionString('http://api.example.in:3000');
        assertEqual(config.host, 'api.example.in');
        assertEqual(config.port, '3000');
    });

    test('Parse with API key', () => {
        const config = vardax.parseConnectionString('vardax://localhost:8000?apiKey=secret123');
        assertEqual(config.apiKey, 'secret123');
    });

    test('Parse mode parameter', () => {
        const config = vardax.parseConnectionString('vardax://localhost:8000?mode=protect');
        assertEqual(config.mode, 'protect');
    });

    test('Parse all parameters', () => {
        const url = 'vardax://localhost:8000?apiKey=key&mode=protect&timeout=3000&blockThreshold=0.9&debug=true';
        const config = vardax.parseConnectionString(url);
        assertEqual(config.apiKey, 'key');
        assertEqual(config.mode, 'protect');
        assertEqual(config.timeout, 3000);
        assertEqual(config.blockThreshold, 0.9);
        assertEqual(config.debug, true);
    });

    test('Default values applied', () => {
        const config = vardax.parseConnectionString('vardax://localhost:8000');
        assertEqual(config.mode, 'monitor');
        assertEqual(config.timeout, 5000);
        assertEqual(config.blockThreshold, 0.8);
        assertEqual(config.failOpen, true);
    });

    test('Throws on missing connection string', () => {
        let threw = false;
        try {
            vardax.parseConnectionString(null);
        } catch (e) {
            threw = true;
        }
        assert(threw, 'Should throw on null');
    });

    test('Throws on invalid URL', () => {
        let threw = false;
        try {
            vardax.parseConnectionString('not-a-url');
        } catch (e) {
            threw = true;
        }
        assert(threw, 'Should throw on invalid URL');
    });

    // ═══════════════════════════════════════════════════════════════
    // SECTION 2: Feature Extraction
    // ═══════════════════════════════════════════════════════════════
    section('2. Feature Extraction');

    test('Extract basic request features', () => {
        const req = createMockRequest();
        const features = vardax.extractFeatures(req);
        
        assertEqual(features.method, 'GET');
        assertEqual(features.uri, '/api/users');
        assertEqual(features.client_ip, '192.168.1.100');
    });

    test('Extract headers', () => {
        const req = createMockRequest();
        const features = vardax.extractFeatures(req);
        
        assertEqual(features.user_agent, 'Mozilla/5.0 Test');
        assertEqual(features.content_type, 'application/json');
    });

    test('Extract query string', () => {
        const req = createMockRequest({ url: '/api/users?id=123&name=test' });
        const features = vardax.extractFeatures(req);
        
        assertEqual(features.query_string, 'id=123&name=test');
    });

    test('Handle missing headers gracefully', () => {
        const req = {
            ip: '1.2.3.4',
            method: 'GET',
            path: '/test',
            url: '/test',
            httpVersion: '1.1',
            get: () => null,
            connection: { remoteAddress: '1.2.3.4', remotePort: 12345 }
        };
        const features = vardax.extractFeatures(req);
        
        assertEqual(features.user_agent, null);
        assertEqual(features.referer, null);
    });

    test('Generate unique request ID', () => {
        const req = createMockRequest();
        const features1 = vardax.extractFeatures(req);
        const features2 = vardax.extractFeatures(req);
        
        assert(features1.request_id !== features2.request_id, 'Request IDs should be unique');
        assert(features1.request_id.startsWith('connect-'), 'Request ID format');
    });

    // ═══════════════════════════════════════════════════════════════
    // SECTION 3: Middleware Creation
    // ═══════════════════════════════════════════════════════════════
    section('3. Middleware Creation');

    test('Create middleware function', () => {
        const middleware = vardax('vardax://localhost:8000');
        assertEqual(typeof middleware, 'function');
    });

    test('Create middleware with options', () => {
        const middleware = vardax.createMiddleware('vardax://localhost:8000', {
            mode: 'protect',
            debug: true
        });
        assertEqual(typeof middleware, 'function');
    });

    test('Middleware has correct arity (3 params)', () => {
        const middleware = vardax('vardax://localhost:8000');
        assertEqual(middleware.length, 3); // req, res, next
    });

    // ═══════════════════════════════════════════════════════════════
    // SECTION 4: Client Creation
    // ═══════════════════════════════════════════════════════════════
    section('4. Client Creation');

    test('Create client', () => {
        const client = vardax.createClient('vardax://localhost:8000');
        assert(client !== null);
    });

    test('Client has analyze method', () => {
        const client = vardax.createClient('vardax://localhost:8000');
        assertEqual(typeof client.analyze, 'function');
    });

    test('Client has getStatus method', () => {
        const client = vardax.createClient('vardax://localhost:8000');
        assertEqual(typeof client.getStatus, 'function');
    });

    test('Client has getConfig method', () => {
        const client = vardax.createClient('vardax://localhost:8000');
        assertEqual(typeof client.getConfig, 'function');
    });

    test('Client getConfig returns parsed config', () => {
        const client = vardax.createClient('vardax://localhost:8000?mode=protect');
        const config = client.getConfig();
        assertEqual(config.mode, 'protect');
        assertEqual(config.host, 'localhost');
    });

    // ═══════════════════════════════════════════════════════════════
    // SECTION 5: Rate Limiter - Basic
    // ═══════════════════════════════════════════════════════════════
    section('5. Rate Limiter - Basic');

    test('Create rate limiter', () => {
        const limiter = new VardaxRateLimiter();
        assert(limiter !== null);
    });

    test('Rate limiter has default profiles', () => {
        const limiter = new VardaxRateLimiter();
        assert(limiter.profiles.default);
        assert(limiter.profiles.strict);
        assert(limiter.profiles.auth);
        assert(limiter.profiles.api);
        assert(limiter.profiles.relaxed);
    });

    test('Rate limiter profile values', () => {
        const limiter = new VardaxRateLimiter();
        assertEqual(limiter.profiles.default.capacity, 100);
        assertEqual(limiter.profiles.auth.capacity, 5);
        assertEqual(limiter.profiles.strict.capacity, 20);
    });

    test('Custom rate limiter options', () => {
        const limiter = new VardaxRateLimiter({
            keyPrefix: 'test:rl',
            debug: true,
            failOpen: false
        });
        assertEqual(limiter.keyPrefix, 'test:rl');
        assertEqual(limiter.debug, true);
        assertEqual(limiter.failOpen, false);
    });

    // ═══════════════════════════════════════════════════════════════
    // SECTION 6: Rate Limiter - IP Extraction
    // ═══════════════════════════════════════════════════════════════
    section('6. Rate Limiter - IP Extraction');

    test('Extract IP from x-forwarded-for', () => {
        const limiter = new VardaxRateLimiter();
        const req = { headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } };
        assertEqual(limiter.getClientIp(req), '1.2.3.4');
    });

    test('Extract IP from x-real-ip', () => {
        const limiter = new VardaxRateLimiter();
        const req = { headers: { 'x-real-ip': '10.0.0.1' } };
        assertEqual(limiter.getClientIp(req), '10.0.0.1');
    });

    test('Extract IP from req.ip', () => {
        const limiter = new VardaxRateLimiter();
        const req = { headers: {}, ip: '192.168.1.1' };
        assertEqual(limiter.getClientIp(req), '192.168.1.1');
    });

    test('Extract IP from connection', () => {
        const limiter = new VardaxRateLimiter();
        const req = { headers: {}, connection: { remoteAddress: '172.16.0.1' } };
        assertEqual(limiter.getClientIp(req), '172.16.0.1');
    });

    test('Return unknown for missing IP', () => {
        const limiter = new VardaxRateLimiter();
        const req = { headers: {} };
        assertEqual(limiter.getClientIp(req), 'unknown');
    });

    // ═══════════════════════════════════════════════════════════════
    // SECTION 7: Rate Limiter - Endpoint Matching
    // ═══════════════════════════════════════════════════════════════
    section('7. Rate Limiter - Endpoint Matching');

    test('Match exact endpoint', () => {
        const limiter = new VardaxRateLimiter();
        const limits = limiter.getLimits('/api/auth/login');
        assertEqual(limits.capacity, 5); // auth profile
    });

    test('Match endpoint prefix', () => {
        const limiter = new VardaxRateLimiter({
            endpointLimits: { '/api/v1/': 'api' }
        });
        const limits = limiter.getLimits('/api/v1/users/123');
        assertEqual(limits.capacity, 60); // api profile
    });

    test('Return default for unknown endpoint', () => {
        const limiter = new VardaxRateLimiter();
        const limits = limiter.getLimits('/unknown/path');
        assertEqual(limits.capacity, 100); // default profile
    });

    // ═══════════════════════════════════════════════════════════════
    // SECTION 8: Rate Limiter - Local Fallback
    // ═══════════════════════════════════════════════════════════════
    section('8. Rate Limiter - Local Fallback');

    test('Local fallback allows first request', () => {
        const limiter = new VardaxRateLimiter();
        const result = limiter.checkLimitLocal('test-ip', '/test', { capacity: 10, refillRate: 1 });
        assert(result.allowed);
        assertEqual(result.remaining, 9);
    });

    test('Local fallback tracks requests', () => {
        const limiter = new VardaxRateLimiter();
        const limits = { capacity: 5, refillRate: 1 };
        
        limiter.checkLimitLocal('track-ip', '/test', limits);
        limiter.checkLimitLocal('track-ip', '/test', limits);
        const result = limiter.checkLimitLocal('track-ip', '/test', limits);
        
        assertEqual(result.remaining, 2);
    });

    test('Local fallback blocks after limit', () => {
        const limiter = new VardaxRateLimiter();
        const limits = { capacity: 3, refillRate: 0.1 };
        
        for (let i = 0; i < 3; i++) {
            limiter.checkLimitLocal('block-ip', '/test', limits);
        }
        
        const result = limiter.checkLimitLocal('block-ip', '/test', limits);
        assert(!result.allowed);
        assertEqual(result.remaining, 0);
        assert(result.retryAfter > 0);
    });

    test('Local fallback independent per IP', () => {
        const limiter = new VardaxRateLimiter();
        const limits = { capacity: 2, refillRate: 0.1 };
        
        limiter.checkLimitLocal('ip-a', '/test', limits);
        limiter.checkLimitLocal('ip-a', '/test', limits);
        limiter.checkLimitLocal('ip-a', '/test', limits); // blocked
        
        const result = limiter.checkLimitLocal('ip-b', '/test', limits);
        assert(result.allowed); // different IP, should work
    });

    test('Local fallback sets fallback flag', () => {
        const limiter = new VardaxRateLimiter();
        const result = limiter.checkLimitLocal('flag-ip', '/test', { capacity: 10, refillRate: 1 });
        assert(result.fallback === true);
    });

    // ═══════════════════════════════════════════════════════════════
    // SECTION 9: Rate Limiter - Middleware
    // ═══════════════════════════════════════════════════════════════
    section('9. Rate Limiter - Middleware');

    test('Middleware is a function', () => {
        const limiter = new VardaxRateLimiter();
        const middleware = limiter.middleware();
        assertEqual(typeof middleware, 'function');
    });

    await test('Middleware skips exempt paths', async () => {
        const limiter = new VardaxRateLimiter();
        const middleware = limiter.middleware({ skipPaths: ['/health'] });
        
        let nextCalled = false;
        await middleware(
            { path: '/health', headers: {} },
            { setHeader: () => {} },
            () => { nextCalled = true; }
        );
        
        assert(nextCalled);
    });

    await test('Middleware sets headers', async () => {
        const limiter = new VardaxRateLimiter();
        const middleware = limiter.middleware();
        
        const headers = {};
        await middleware(
            { path: '/api/test', headers: {}, ip: '1.2.3.4' },
            { setHeader: (k, v) => { headers[k] = v; } },
            () => {}
        );
        
        assert('X-RateLimit-Limit' in headers);
        assert('X-RateLimit-Remaining' in headers);
    });

    await test('Middleware returns 429 when limited', async () => {
        const limiter = new VardaxRateLimiter();
        const middleware = limiter.middleware();
        
        // Exhaust limit
        const limits = limiter.profiles.default;
        for (let i = 0; i <= limits.capacity; i++) {
            limiter.checkLimitLocal('limited-ip', '/api/test', limits);
        }
        
        let statusCode = null;
        let body = null;
        
        await middleware(
            { path: '/api/test', headers: {}, ip: 'limited-ip' },
            { 
                setHeader: () => {},
                status: (code) => {
                    statusCode = code;
                    return { json: (b) => { body = b; } };
                }
            },
            () => {}
        );
        
        assertEqual(statusCode, 429);
        assertEqual(body.error, 'rate_limit_exceeded');
    });

    // ═══════════════════════════════════════════════════════════════
    // SECTION 10: Exports
    // ═══════════════════════════════════════════════════════════════
    section('10. Module Exports');

    test('Default export is createMiddleware', () => {
        assertEqual(typeof vardax, 'function');
    });

    test('Named exports available', () => {
        assertEqual(typeof vardax.createMiddleware, 'function');
        assertEqual(typeof vardax.createClient, 'function');
        assertEqual(typeof vardax.parseConnectionString, 'function');
        assertEqual(typeof vardax.extractFeatures, 'function');
    });

    test('VardaxRateLimiter exported', () => {
        assertEqual(typeof vardax.VardaxRateLimiter, 'function');
    });

    test('LUA_SCRIPT exported from rate-limiter', () => {
        const { LUA_SCRIPT } = require('../lib/rate-limiter');
        assert(LUA_SCRIPT.includes('KEYS[1]'));
        assert(LUA_SCRIPT.includes('redis.call'));
    });

    // ═══════════════════════════════════════════════════════════════
    // SUMMARY
    // ═══════════════════════════════════════════════════════════════
    console.log('\n' + '═'.repeat(60));
    console.log('  TEST SUMMARY');
    console.log('═'.repeat(60));
    console.log(`  Total:  ${totalPassed + totalFailed}`);
    console.log(`  Passed: ${totalPassed} ✅`);
    console.log(`  Failed: ${totalFailed} ❌`);
    console.log('═'.repeat(60));

    if (totalFailed > 0) {
        console.log('\nFailed tests:');
        results.filter(r => r.status === 'failed').forEach(r => {
            console.log(`  - ${r.name}: ${r.error}`);
        });
        process.exit(1);
    } else {
        console.log('\n✅ All tests passed!\n');
    }
}

// Helper function to create mock request
function createMockRequest(overrides = {}) {
    return {
        ip: '192.168.1.100',
        method: 'GET',
        path: '/api/users',
        url: '/api/users',
        httpVersion: '1.1',
        get: (header) => {
            const headers = {
                'user-agent': 'Mozilla/5.0 Test',
                'content-type': 'application/json',
                'referer': 'http://example.in',
                'host': 'api.example.in'
            };
            return headers[header.toLowerCase()];
        },
        connection: {
            remoteAddress: '192.168.1.100',
            remotePort: 54321
        },
        body: null,
        ...overrides
    };
}

// Run tests
runTests().catch(err => {
    console.error('Test runner error:', err);
    process.exit(1);
});
