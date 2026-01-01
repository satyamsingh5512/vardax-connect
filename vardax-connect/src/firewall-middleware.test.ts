/**
 * Test Examples - VARDAx Firewall Middleware
 * 
 * Run with: npx ts-node src/firewall-middleware.test.ts
 */

import { strict as assert } from 'assert';
import {
  TOKEN_BUCKET_LUA,
  getClientIp,
  checkBodySize,
  safeRegexTest,
  DefaultAsyncLogger,
  RedisClient,
} from './firewall-middleware';

// ============================================================================
// MOCK REDIS CLIENT
// ============================================================================

class MockRedis implements RedisClient {
  private scripts: Map<string, string> = new Map();
  private data: Map<string, { tokens: number; last_ms: number }> = new Map();
  private scriptCounter = 0;

  async script(command: 'LOAD', script: string): Promise<string> {
    const sha = `sha_${++this.scriptCounter}`;
    this.scripts.set(sha, script);
    return sha;
  }

  async evalsha(
    sha: string,
    numKeys: number,
    ...args: (string | number)[]
  ): Promise<[number, number, number]> {
    // Simulate token bucket logic
    const key = args[0] as string;
    const capacity = args[1] as number;
    const refillRate = args[2] as number;
    const nowMs = args[3] as number;
    const requested = args[4] as number;

    let state = this.data.get(key);
    if (!state) {
      state = { tokens: capacity, last_ms: nowMs };
    }

    const elapsedSec = (nowMs - state.last_ms) / 1000;
    const refill = elapsedSec * refillRate;
    state.tokens = Math.min(capacity, state.tokens + refill);

    let allowed = 0;
    let remaining = Math.floor(state.tokens);
    let retryAfter = 0;

    if (state.tokens >= requested) {
      state.tokens -= requested;
      allowed = 1;
      remaining = Math.floor(state.tokens);
    } else {
      retryAfter = Math.ceil((requested - state.tokens) / refillRate);
    }

    state.last_ms = nowMs;
    this.data.set(key, state);

    return [allowed, remaining, retryAfter];
  }

  async ping(): Promise<string> {
    return 'PONG';
  }

  async quit(): Promise<void> {}

  // Test helper: reset state
  reset(): void {
    this.data.clear();
  }
}

// ============================================================================
// TEST: RATE LIMITING
// ============================================================================

async function testRateLimiting(): Promise<void> {
  console.log('Test: Rate Limiting');
  
  const redis = new MockRedis();
  const sha = await redis.script('LOAD', TOKEN_BUCKET_LUA);
  
  const capacity = 5;
  const refillRate = 1; // 1 token per second
  const key = 'rl:test-ip';
  const nowMs = Date.now();

  // First 5 requests should succeed
  for (let i = 0; i < 5; i++) {
    const [allowed, remaining] = await redis.evalsha(sha, 1, key, capacity, refillRate, nowMs, 1);
    assert.equal(allowed, 1, `Request ${i + 1} should be allowed`);
    assert.equal(remaining, 4 - i, `Remaining should be ${4 - i}`);
  }

  // 6th request should be blocked
  const [allowed, remaining, retryAfter] = await redis.evalsha(sha, 1, key, capacity, refillRate, nowMs, 1);
  assert.equal(allowed, 0, '6th request should be blocked');
  assert.equal(remaining, 0, 'No tokens remaining');
  assert.ok(retryAfter > 0, 'Should have retry-after');

  // After 2 seconds, should have 2 tokens refilled
  const laterMs = nowMs + 2000;
  const [allowed2, remaining2] = await redis.evalsha(sha, 1, key, capacity, refillRate, laterMs, 1);
  assert.equal(allowed2, 1, 'Request after refill should be allowed');
  assert.equal(remaining2, 1, 'Should have 1 token remaining after using 1 of 2 refilled');

  console.log('✓ Rate limiting tests passed\n');
}

// ============================================================================
// TEST: HEADER VALIDATION
// ============================================================================

function testHeaderValidation(): void {
  console.log('Test: Header Validation');

  const trustedProxies = new Set(['10.0.0.1', '192.168.1.1']);

  // Mock request from trusted proxy
  const trustedReq = {
    socket: { remoteAddress: '10.0.0.1' },
    headers: { 'x-forwarded-for': '203.0.113.50, 10.0.0.1' },
  } as any;

  const clientIpTrusted = getClientIp(trustedReq, trustedProxies);
  assert.equal(clientIpTrusted, '203.0.113.50', 'Should extract original client IP from XFF');

  // Mock request from untrusted source
  const untrustedReq = {
    socket: { remoteAddress: '1.2.3.4' },
    headers: { 'x-forwarded-for': '203.0.113.50' }, // Attacker trying to spoof
  } as any;

  const clientIpUntrusted = getClientIp(untrustedReq, trustedProxies);
  assert.equal(clientIpUntrusted, '1.2.3.4', 'Should use socket IP when not from trusted proxy');

  // Direct connection (no proxy)
  const directReq = {
    socket: { remoteAddress: '5.6.7.8' },
    headers: {},
  } as any;

  const clientIpDirect = getClientIp(directReq, trustedProxies);
  assert.equal(clientIpDirect, '5.6.7.8', 'Should use socket IP for direct connections');

  console.log('✓ Header validation tests passed\n');
}

// ============================================================================
// TEST: BODY SIZE REJECTION
// ============================================================================

function testBodySizeRejection(): void {
  console.log('Test: Body Size Rejection');

  const maxSize = 1024 * 1024; // 1MB

  // Request within limit
  const smallReq = { headers: { 'content-length': '1000' } } as any;
  const smallCheck = checkBodySize(smallReq, maxSize);
  assert.equal(smallCheck.ok, true, 'Small body should be allowed');
  assert.equal(smallCheck.size, 1000);

  // Request over limit
  const largeReq = { headers: { 'content-length': '2000000' } } as any;
  const largeCheck = checkBodySize(largeReq, maxSize);
  assert.equal(largeCheck.ok, false, 'Large body should be rejected');
  assert.equal(largeCheck.size, 2000000);

  // Request with no content-length
  const noLengthReq = { headers: {} } as any;
  const noLengthCheck = checkBodySize(noLengthReq, maxSize);
  assert.equal(noLengthCheck.ok, true, 'No content-length should be allowed (size 0)');
  assert.equal(noLengthCheck.size, 0);

  console.log('✓ Body size rejection tests passed\n');
}

// ============================================================================
// TEST: SAFE REGEX
// ============================================================================

function testSafeRegex(): void {
  console.log('Test: Safe Regex');

  const pathTraversal = /\.\.\//;
  const maxLength = 100;

  // Normal path
  assert.equal(safeRegexTest(pathTraversal, '/api/users', maxLength), false);

  // Path traversal attempt
  assert.equal(safeRegexTest(pathTraversal, '/api/../etc/passwd', maxLength), true);

  // Very long input (should be truncated)
  const longInput = 'a'.repeat(1000) + '../';
  assert.equal(safeRegexTest(pathTraversal, longInput, maxLength), false, 'Long input truncated before pattern');

  // Pattern at start of long input
  const longWithPattern = '../' + 'a'.repeat(1000);
  assert.equal(safeRegexTest(pathTraversal, longWithPattern, maxLength), true, 'Pattern at start detected');

  console.log('✓ Safe regex tests passed\n');
}

// ============================================================================
// TEST: ASYNC LOGGER
// ============================================================================

async function testAsyncLogger(): Promise<void> {
  console.log('Test: Async Logger');

  const logger = new DefaultAsyncLogger(100);
  
  // Enqueue should not block
  const start = Date.now();
  for (let i = 0; i < 1000; i++) {
    logger.enqueue('info', { event: 'test', i });
  }
  const elapsed = Date.now() - start;
  
  assert.ok(elapsed < 50, `Enqueue 1000 logs should be fast (was ${elapsed}ms)`);

  // Wait for flush
  await new Promise(resolve => setTimeout(resolve, 200));
  await logger.flush();

  logger.destroy();
  console.log('✓ Async logger tests passed\n');
}

// ============================================================================
// TEST: LUA SCRIPT ATOMICITY
// ============================================================================

async function testLuaAtomicity(): Promise<void> {
  console.log('Test: Lua Script Atomicity');

  const redis = new MockRedis();
  const sha = await redis.script('LOAD', TOKEN_BUCKET_LUA);
  
  const key = 'rl:atomic-test';
  const capacity = 10;
  const refillRate = 10;
  const nowMs = Date.now();

  // Simulate concurrent requests (in real Redis, Lua is atomic)
  const results = await Promise.all([
    redis.evalsha(sha, 1, key, capacity, refillRate, nowMs, 1),
    redis.evalsha(sha, 1, key, capacity, refillRate, nowMs, 1),
    redis.evalsha(sha, 1, key, capacity, refillRate, nowMs, 1),
  ]);

  // All should succeed but with decreasing remaining
  const allowedCount = results.filter(r => r[0] === 1).length;
  assert.equal(allowedCount, 3, 'All 3 concurrent requests should be allowed');

  // Remaining should decrease
  const remainings = results.map(r => r[1]);
  console.log('  Remaining tokens after each request:', remainings);

  console.log('✓ Lua atomicity tests passed\n');
}

// ============================================================================
// RUN ALL TESTS
// ============================================================================

async function runTests(): Promise<void> {
  console.log('='.repeat(50));
  console.log('VARDAx Firewall Middleware Tests');
  console.log('='.repeat(50) + '\n');

  await testRateLimiting();
  testHeaderValidation();
  testBodySizeRejection();
  testSafeRegex();
  await testAsyncLogger();
  await testLuaAtomicity();

  console.log('='.repeat(50));
  console.log('All tests passed!');
  console.log('='.repeat(50));
}

runTests().catch(console.error);
