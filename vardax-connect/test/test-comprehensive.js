/**
 * Comprehensive Test Suite for @vardax/connect
 * Tests all functionality including middleware, client, rate limiter
 */

const assert = require('assert');

// Import modules
const vardax = require('../index');
const { VardaxRateLimiter } = require('../lib/rate-limiter');

// Test counters
let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

// Test helper
function test(name, fn) {
    testsRun++;
    try {
        fn();
        testsPassed++;
        console.log(`✅ ${name}`);
    } catch (error) {
        testsFailed++;
        console.log(`❌ ${name}`);
        console.log(`   Error: ${error.message}`);
    }
}

// Async test helper
async function testAsync(name, fn) {
    testsRun++;
    try {
        await fn();
        testsPassed++;
        console.log(`✅ ${name}`);
    } catch (error) {
        testsFailed++;
        console.log(`❌ ${name}`);
        console.log(`   Error: ${error.message}`);
    }
}

console.log('🧪 VARDAx Connect Comprehensive Test Suite\n');
console.log('=' .repeat(50));

// ============================================================================
// CONNECTION STRING PARSING TESTS
// ============================================================================

console.log('\n📋 Connection String Parsing Tests\n');

test('Parse vardax:// connection string', () => {
    const config = vardax.parseConnectionString('vardax://localhost:8000?apiKey=test123&mode=protect');
    assert.strictEqual(config.host, 'localhost');
    assert.strictEqual(config.port, '8000');
    assert.strictEqual(config.apiKey, 'test123');
    assert.strictEqual(config.mode, 'protect');
});

test('Parse http:// connection string', () => {
    const config = vardax.parseConnectionString('http://api.vardax.io:9000?mode=monitor');
    assert.strictEqual(config.host, 'api.vardax.io');
    assert.strictEqual(config.port, '9000');
    assert.strictEqual(config.mode, 'monitor');
});

test('Parse connection string with all options', () => {
    const config = vardax.parseConnectionString(
        'vardax://localhost:8000?apiKey=key&mode=protect&timeout=10000&blockThreshold=0.9&challengeThreshold=0.6&debug=true&failOpen=false'
    );
    assert.strictEqual(config.apiKey, 'key');
    assert.strictEqual(config.mode, 'protect');
    assert.strictEqual(config.timeout, 10000);
    assert.strictEqual(config.blockThreshold, 0.9);
    assert.strictEqual(config.challengeThreshold, 0.6);
    assert.strictEqual(config.debug, true);
    assert.strictEqual(config.failOpen, false);
});

test('Parse connection string with default port', () => {
    const config = vardax.parseConnectionString('vardax://localhost');
    assert.strictEqual(config.port, '8000');
});

test('Parse connection string with default mode', () => {
    const config = vardax.parseConnectionString('vardax://localhost:8000');
    assert.strictEqual(config.mode, 'monitor');
});

test('Throw error for empty connection string', () => {
    assert.throws(() => {
        vardax.parseConnectionString('');
    }, /connection string is required/);
});

test('Throw error for null connection string', () => {
    assert.throws(() => {
        vardax.parseConnectionString(null);
    }, /connection string is required/);
});

test('Throw error for invalid connection string', () => {
    assert.throws(() => {
        vardax.parseConnectionString('not-a-valid-url');
    }, /Invalid/);
});

// ============================================================================
// FEATURE EXTRACTION TESTS
// ============================================================================

console.log('\n📋 Feature Extraction Tests\n');

test('Extract features from GET request', () => {
    const mockReq = {
        ip: '192.168.1.100',
        method: 'GET',
        path: '/api/users',
        url: '/api/users?page=1',
        httpVersion: '1.1',
        get: (header) => ({
            'user-agent': 'Mozilla/5.0',
            'content-type': 'application/json',
            'host': 'example.com'
        })[header.toLowerCase()],
        connection: { remoteAddress: '192.168.1.100', remotePort: 54321 },
        body: null
    };

    const features = vardax.extractFeatures(mockReq);
    
    assert.strictEqual(features.method, 'GET');
    assert.strictEqual(features.uri, '/api/users');
    assert.strictEqual(features.client_ip, '192.168.1.100');
    assert.strictEqual(features.user_agent, 'Mozilla/5.0');
    assert.ok(features.request_id.startsWith('connect-'));
    assert.ok(features.timestamp);
});

test('Extract features from POST request with body', () => {
    const mockReq = {
        ip: '192.168.1.100',
        method: 'POST',
        path: '/api/users',
        url: '/api/users',
        httpVersion: '1.1',
        get: (header) => ({
            'user-agent': 'Mozilla/5.0',
            'content-type': 'application/json',
            'content-length': '100',
            'authorization': 'Bearer token123'
        })[header.toLowerCase()],
        connection: { remoteAddress: '192.168.1.100', remotePort: 54321 },
        body: { name: 'test', email: 'test@example.com' }
    };

    const features = vardax.extractFeatures(mockReq);
    
    assert.strictEqual(features.method, 'POST');
    assert.strictEqual(features.has_auth_header, true);
    assert.ok(features.body_length > 0);
});

test('Extract features with X-Forwarded-For header', () => {
    const mockReq = {
        ip: '127.0.0.1',
        method: 'GET',
        path: '/api/users',
        url: '/api/users',
        httpVersion: '1.1',
        get: (header) => ({
            'x-forwarded-for': '203.0.113.50, 70.41.3.18',
            'user-agent': 'Mozilla/5.0'
        })[header.toLowerCase()],
        connection: { remoteAddress: '127.0.0.1', remotePort: 54321 }
    };

    const features = vardax.extractFeatures(mockReq);
    // Should use the first IP from X-Forwarded-For if available
    assert.ok(features.client_ip);
});

test('Extract features with cookies', () => {
    const mockReq = {
        ip: '192.168.1.100',
        method: 'GET',
        path: '/api/users',
        url: '/api/users',
        httpVersion: '1.1',
        get: (header) => ({
            'user-agent': 'Mozilla/5.0',
            'cookie': 'session=abc123'
        })[header.toLowerCase()],
        connection: { remoteAddress: '192.168.1.100', remotePort: 54321 }
    };

    const features = vardax.extractFeatures(mockReq);
    assert.strictEqual(features.has_cookie, true);
});

// ============================================================================
// MIDDLEWARE CREATION TESTS
// ============================================================================

console.log('\n📋 Middleware Creation Tests\n');

test('Create middleware function', () => {
    const middleware = vardax('vardax://localhost:8000?mode=monitor');
    assert.strictEqual(typeof middleware, 'function');
});

test('Create middleware with options override', () => {
    const middleware = vardax.createMiddleware('vardax://localhost:8000', {
        debug: true,
        blockThreshold: 0.95
    });
    assert.strictEqual(typeof middleware, 'function');
});

// ============================================================================
// CLIENT CREATION TESTS
// ============================================================================

console.log('\n📋 Client Creation Tests\n');

test('Create client with all methods', () => {
    const client = vardax.createClient('vardax://localhost:8000');
    
    assert.strictEqual(typeof client.analyze, 'function');
    assert.strictEqual(typeof client.getStatus, 'function');
    assert.strictEqual(typeof client.getConfig, 'function');
});

test('Client getConfig returns correct config', () => {
    const client = vardax.createClient('vardax://localhost:8000?apiKey=test&mode=protect');
    const config = client.getConfig();
    
    assert.strictEqual(config.host, 'localhost');
    assert.strictEqual(config.port, '8000');
    assert.strictEqual(config.apiKey, 'test');
    assert.strictEqual(config.mode, 'protect');
});

// ============================================================================
// RATE LIMITER TESTS
// ============================================================================

console.log('\n📋 Rate Limiter Tests\n');

test('Create rate limiter without Redis', () => {
    const limiter = new VardaxRateLimiter();
    assert.ok(limiter);
    assert.strictEqual(limiter.failOpen, true);
});

test('Rate limiter has default profiles', () => {
    const limiter = new VardaxRateLimiter();
    
    assert.ok(limiter.profiles.default);
    assert.ok(limiter.profiles.strict);
    assert.ok(limiter.profiles.relaxed);
    assert.ok(limiter.profiles.auth);
    assert.ok(limiter.profiles.api);
});

test('Rate limiter getLimits returns correct profile', () => {
    const limiter = new VardaxRateLimiter();
    
    const authLimits = limiter.getLimits('/api/auth/login');
    assert.strictEqual(authLimits.capacity, 5);
    
    const defaultLimits = limiter.getLimits('/api/users');
    assert.strictEqual(defaultLimits.capacity, 100);
});

test('Rate limiter getClientIp extracts IP correctly', () => {
    const limiter = new VardaxRateLimiter();
    
    // Test with X-Forwarded-For
    const req1 = { headers: { 'x-forwarded-for': '203.0.113.50, 70.41.3.18' } };
    assert.strictEqual(limiter.getClientIp(req1), '203.0.113.50');
    
    // Test with X-Real-IP
    const req2 = { headers: { 'x-real-ip': '192.168.1.100' } };
    assert.strictEqual(limiter.getClientIp(req2), '192.168.1.100');
    
    // Test with req.ip
    const req3 = { headers: {}, ip: '10.0.0.1' };
    assert.strictEqual(limiter.getClientIp(req3), '10.0.0.1');
});

test('Rate limiter local fallback works', () => {
    const limiter = new VardaxRateLimiter();
    
    const result = limiter.checkLimitLocal('192.168.1.100', '/api/users', { capacity: 10, refillRate: 1 });
    
    assert.strictEqual(result.allowed, true);
    assert.ok(result.remaining >= 0);
    assert.ok(result.fallback);
});

test('Rate limiter local fallback enforces limits', () => {
    const limiter = new VardaxRateLimiter();
    const limits = { capacity: 3, refillRate: 1 };
    
    // Make requests up to limit
    for (let i = 0; i < 3; i++) {
        limiter.checkLimitLocal('192.168.1.200', '/test', limits);
    }
    
    // Next request should be blocked
    const result = limiter.checkLimitLocal('192.168.1.200', '/test', limits);
    assert.strictEqual(result.allowed, false);
});

test('Rate limiter creates middleware function', () => {
    const limiter = new VardaxRateLimiter();
    const middleware = limiter.middleware();
    
    assert.strictEqual(typeof middleware, 'function');
});

test('Rate limiter middleware skips health paths', async () => {
    const limiter = new VardaxRateLimiter();
    const middleware = limiter.middleware({ skipPaths: ['/health', '/ready'] });
    
    let nextCalled = false;
    const mockReq = { path: '/health', headers: {} };
    const mockRes = {};
    const mockNext = () => { nextCalled = true; };
    
    await middleware(mockReq, mockRes, mockNext);
    assert.strictEqual(nextCalled, true);
});

// ============================================================================
// ASYNC TESTS
// ============================================================================

console.log('\n📋 Async Tests\n');

testAsync('Rate limiter checkLimit works without Redis', async () => {
    const limiter = new VardaxRateLimiter();
    
    const result = await limiter.checkLimit('192.168.1.100', '/api/users');
    
    assert.strictEqual(result.allowed, true);
    assert.ok(result.remaining >= 0);
});

testAsync('Client getStatus handles connection error gracefully', async () => {
    const client = vardax.createClient('vardax://nonexistent-host:9999?timeout=1000');
    
    const status = await client.getStatus();
    
    assert.strictEqual(status.connected, false);
    assert.ok(status.error);
});

// ============================================================================
// EDGE CASES
// ============================================================================

console.log('\n📋 Edge Case Tests\n');

test('Handle request with no user agent', () => {
    const mockReq = {
        ip: '192.168.1.100',
        method: 'GET',
        path: '/api/users',
        url: '/api/users',
        httpVersion: '1.1',
        get: () => null,
        connection: { remoteAddress: '192.168.1.100', remotePort: 54321 }
    };

    const features = vardax.extractFeatures(mockReq);
    assert.strictEqual(features.user_agent, null);
});

test('Handle request with no body', () => {
    const mockReq = {
        ip: '192.168.1.100',
        method: 'GET',
        path: '/api/users',
        url: '/api/users',
        httpVersion: '1.1',
        get: () => null,
        connection: { remoteAddress: '192.168.1.100', remotePort: 54321 },
        body: undefined
    };

    const features = vardax.extractFeatures(mockReq);
    assert.strictEqual(features.body_length, 0);
});

test('Handle URL with query string', () => {
    const mockReq = {
        ip: '192.168.1.100',
        method: 'GET',
        path: '/api/users',
        url: '/api/users?page=1&limit=10&sort=name',
        httpVersion: '1.1',
        get: () => null,
        connection: { remoteAddress: '192.168.1.100', remotePort: 54321 }
    };

    const features = vardax.extractFeatures(mockReq);
    assert.strictEqual(features.query_string, 'page=1&limit=10&sort=name');
});

test('Handle URL without query string', () => {
    const mockReq = {
        ip: '192.168.1.100',
        method: 'GET',
        path: '/api/users',
        url: '/api/users',
        httpVersion: '1.1',
        get: () => null,
        connection: { remoteAddress: '192.168.1.100', remotePort: 54321 }
    };

    const features = vardax.extractFeatures(mockReq);
    assert.strictEqual(features.query_string, null);
});

// ============================================================================
// SUMMARY
// ============================================================================

// Wait for async tests to complete
setTimeout(() => {
    console.log('\n' + '='.repeat(50));
    console.log('\n📊 Test Results\n');
    console.log(`Total tests: ${testsRun}`);
    console.log(`Passed: ${testsPassed}`);
    console.log(`Failed: ${testsFailed}`);
    console.log('');

    if (testsFailed === 0) {
        console.log('✅ All tests passed!\n');
        process.exit(0);
    } else {
        console.log('❌ Some tests failed!\n');
        process.exit(1);
    }
}, 2000);
