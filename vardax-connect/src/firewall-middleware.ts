/**
 * VARDAx Firewall Middleware - Production-Ready Edge WAF
 * 
 * Assumptions (safe defaults):
 * - Redis is single-instance; for cluster, adjust client accordingly
 * - Trusted proxies must be explicitly configured; empty = trust none
 * - Body parsing deferred until after cheap checks pass
 * - ML scoring is always async; never blocks request path
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { createHash, randomUUID } from 'crypto';
import { Socket } from 'net';

// ============================================================================
// TYPES & CONFIGURATION
// ============================================================================

/** Redis client interface - compatible with ioredis/node-redis */
export interface RedisClient {
  evalsha(sha: string, numKeys: number, ...args: (string | number)[]): Promise<[number, number, number]>;
  script(command: 'LOAD', script: string): Promise<string>;
  ping(): Promise<string>;
  quit(): Promise<void>;
}

/** Async logger interface */
export interface AsyncLogger {
  enqueue(level: 'info' | 'warn' | 'error', data: Record<string, unknown>): void;
  flush(): Promise<void>;
}

/** Scoring service interface */
export interface ScoringService {
  enqueue(event: ScoringEvent): void;
}

export interface ScoringEvent {
  requestId: string;
  timestamp: number;
  clientIp: string;
  method: string;
  path: string;
  userAgent: string | null;
  contentLength: number;
  headers: Record<string, string>;
}

export interface FirewallConfig {
  /** Redis client instance */
  redis: RedisClient;
  
  /** Trusted proxy IPs/CIDRs that can set X-Forwarded-For */
  trustedProxies: string[];
  
  /** Rate limit: requests per window */
  rateLimit: number;
  
  /** Rate limit window in seconds */
  rateLimitWindow: number;
  
  /** Max body size in bytes (default 1MB) */
  maxBodySize: number;
  
  /** Enable admin endpoints */
  adminEnabled: boolean;
  
  /** Admin auth token (required if adminEnabled) */
  adminToken?: string;
  
  /** Admin IP allowlist */
  adminAllowedIps: string[];
  
  /** Circuit breaker: max Redis latency ms before shedding load */
  circuitBreakerThresholdMs: number;
  
  /** Circuit breaker: consecutive failures before opening */
  circuitBreakerFailureThreshold: number;
  
  /** Circuit breaker: recovery time ms */
  circuitBreakerRecoveryMs: number;
  
  /** Custom async logger (optional) */
  logger?: AsyncLogger;
  
  /** Custom scoring service (optional) */
  scoringService?: ScoringService;
  
  /** Blocked paths regex patterns (pre-validated safe patterns) */
  blockedPathPatterns?: RegExp[];
  
  /** Max input length for regex checks */
  maxRegexInputLength: number;
}

const DEFAULT_CONFIG: Partial<FirewallConfig> = {
  rateLimit: 100,
  rateLimitWindow: 60,
  maxBodySize: 1024 * 1024, // 1MB
  adminEnabled: false,
  adminAllowedIps: [],
  circuitBreakerThresholdMs: 100,
  circuitBreakerFailureThreshold: 5,
  circuitBreakerRecoveryMs: 30000,
  maxRegexInputLength: 2048,
  blockedPathPatterns: [],
};

// ============================================================================
// REDIS LUA TOKEN BUCKET SCRIPT
// ============================================================================

/**
 * Atomic token bucket rate limiter.
 * Returns: [allowed (0/1), remaining tokens, retry_after_seconds]
 * 
 * Why Lua: Single atomic operation prevents race conditions.
 * No GET-then-SET pattern that could allow burst bypass.
 */
const TOKEN_BUCKET_LUA = `
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

return {allowed, remaining, retry_after}
`;

// ============================================================================
// IN-MEMORY ASYNC LOG QUEUE
// ============================================================================

/**
 * Non-blocking log queue with background flushing.
 * Why: Synchronous logging blocks the event loop and adds latency.
 */
class DefaultAsyncLogger implements AsyncLogger {
  private queue: Array<{ level: string; data: Record<string, unknown>; ts: number }> = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private maxQueueSize = 10000;

  constructor(flushIntervalMs = 1000) {
    this.flushInterval = setInterval(() => this.flush(), flushIntervalMs);
  }

  enqueue(level: 'info' | 'warn' | 'error', data: Record<string, unknown>): void {
    // Drop oldest if queue full - never block
    if (this.queue.length >= this.maxQueueSize) {
      this.queue.shift();
    }
    this.queue.push({ level, data, ts: Date.now() });
  }

  async flush(): Promise<void> {
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0, 1000);
    // In production: send to log aggregator (stdout for now)
    for (const entry of batch) {
      process.stdout.write(JSON.stringify({ ...entry.data, level: entry.level, ts: entry.ts }) + '\n');
    }
  }

  destroy(): void {
    if (this.flushInterval) clearInterval(this.flushInterval);
  }
}

// ============================================================================
// IN-MEMORY SCORING QUEUE
// ============================================================================

/**
 * Async scoring queue - never blocks request path.
 * Why: ML inference is slow; emit events for async processing.
 */
class DefaultScoringService implements ScoringService {
  private queue: ScoringEvent[] = [];
  private processInterval: NodeJS.Timeout | null = null;

  constructor(processIntervalMs = 100) {
    this.processInterval = setInterval(() => this.process(), processIntervalMs);
  }

  enqueue(event: ScoringEvent): void {
    if (this.queue.length < 50000) {
      this.queue.push(event);
    }
    // Drop if queue full - graceful degradation
  }

  private async process(): Promise<void> {
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0, 100);
    // In production: send to ML scoring service via HTTP/gRPC/queue
    await this.sendToScoringService(batch);
  }

  /** Stub: Replace with actual ML service call */
  private async sendToScoringService(events: ScoringEvent[]): Promise<void> {
    // Example: await fetch('http://ml-service/score', { method: 'POST', body: JSON.stringify(events) });
    // For now, just acknowledge receipt
    void events;
  }

  destroy(): void {
    if (this.processInterval) clearInterval(this.processInterval);
  }
}

// ============================================================================
// METRICS COUNTERS
// ============================================================================

/**
 * Simple in-memory metrics with percentile tracking.
 * Why: Avoid external calls in hot path; flush periodically.
 */
export class MetricsCollector {
  private requestCount = 0;
  private errorCount = 0;
  private rateLimitedCount = 0;
  private latencies: number[] = [];
  private maxLatencySamples = 10000;

  recordRequest(latencyMs: number, error = false, rateLimited = false): void {
    this.requestCount++;
    if (error) this.errorCount++;
    if (rateLimited) this.rateLimitedCount++;
    
    if (this.latencies.length < this.maxLatencySamples) {
      this.latencies.push(latencyMs);
    } else {
      // Reservoir sampling for bounded memory
      const idx = Math.floor(Math.random() * this.requestCount);
      if (idx < this.maxLatencySamples) {
        this.latencies[idx] = latencyMs;
      }
    }
  }

  getMetrics(): {
    requestCount: number;
    errorRate: number;
    rateLimitedCount: number;
    p50: number;
    p95: number;
    p99: number;
  } {
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const p = (pct: number) => sorted[Math.floor(sorted.length * pct)] || 0;
    
    return {
      requestCount: this.requestCount,
      errorRate: this.requestCount > 0 ? this.errorCount / this.requestCount : 0,
      rateLimitedCount: this.rateLimitedCount,
      p50: p(0.5),
      p95: p(0.95),
      p99: p(0.99),
    };
  }

  reset(): void {
    this.requestCount = 0;
    this.errorCount = 0;
    this.rateLimitedCount = 0;
    this.latencies = [];
  }
}

// ============================================================================
// CIRCUIT BREAKER
// ============================================================================

/**
 * Circuit breaker for Redis/downstream protection.
 * Why: Prevents cascade failures when Redis is slow/down.
 */
class CircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private failureThreshold: number,
    private recoveryMs: number
  ) {}

  recordSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  recordFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();
    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
    }
  }

  isOpen(): boolean {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure > this.recoveryMs) {
        this.state = 'half-open';
        return false;
      }
      return true;
    }
    return false;
  }

  getState(): string {
    return this.state;
  }
}

// ============================================================================
// SAFE CLIENT IP EXTRACTION
// ============================================================================

/**
 * Extract client IP safely.
 * Why: Only trust X-Forwarded-For from known proxies to prevent spoofing.
 */
function getClientIp(req: Request, trustedProxies: Set<string>): string {
  const socketIp = (req.socket as Socket).remoteAddress || '0.0.0.0';
  
  // Only trust forwarded headers if request came from trusted proxy
  if (!trustedProxies.has(socketIp)) {
    return socketIp;
  }

  const xff = req.headers['x-forwarded-for'];
  if (xff) {
    const ips = (Array.isArray(xff) ? xff[0] : xff).split(',').map(s => s.trim());
    // Return leftmost non-trusted IP (original client)
    for (const ip of ips) {
      if (!trustedProxies.has(ip)) {
        return ip;
      }
    }
  }

  const realIp = req.headers['x-real-ip'];
  if (realIp && typeof realIp === 'string') {
    return realIp;
  }

  return socketIp;
}

// ============================================================================
// BODY SIZE GUARD
// ============================================================================

/**
 * Early body size rejection using Content-Length header.
 * Why: Reject oversized payloads before wasting resources parsing.
 */
function checkBodySize(req: Request, maxSize: number): { ok: boolean; size: number } {
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  return {
    ok: contentLength <= maxSize,
    size: contentLength,
  };
}

// ============================================================================
// SAFE REGEX MATCHING
// ============================================================================

/**
 * Safe regex check with input length cap.
 * Why: Prevents ReDoS by limiting input before regex evaluation.
 */
function safeRegexTest(pattern: RegExp, input: string, maxLength: number): boolean {
  if (input.length > maxLength) {
    input = input.slice(0, maxLength);
  }
  return pattern.test(input);
}

// ============================================================================
// MAIN MIDDLEWARE FACTORY
// ============================================================================

export function firewallMiddleware(userConfig: FirewallConfig): RequestHandler {
  const config = { ...DEFAULT_CONFIG, ...userConfig } as Required<FirewallConfig>;
  
  // Initialize components
  const trustedProxies = new Set(config.trustedProxies);
  const logger = config.logger || new DefaultAsyncLogger();
  const scoringService = config.scoringService || new DefaultScoringService();
  const metrics = new MetricsCollector();
  const circuitBreaker = new CircuitBreaker(
    config.circuitBreakerFailureThreshold,
    config.circuitBreakerRecoveryMs
  );

  let luaScriptSha: string | null = null;

  // Load Lua script on first use
  async function ensureLuaScript(): Promise<string> {
    if (!luaScriptSha) {
      luaScriptSha = await config.redis.script('LOAD', TOKEN_BUCKET_LUA);
    }
    return luaScriptSha;
  }

  // Rate limit check using atomic Lua script
  async function checkRateLimit(clientIp: string): Promise<{ allowed: boolean; remaining: number; retryAfter: number }> {
    const sha = await ensureLuaScript();
    const key = `rl:${clientIp}`;
    const refillRate = config.rateLimit / config.rateLimitWindow;
    const nowMs = Date.now();

    const [allowed, remaining, retryAfter] = await config.redis.evalsha(
      sha, 1, key,
      config.rateLimit, refillRate, nowMs, 1
    );

    return { allowed: allowed === 1, remaining, retryAfter };
  }

  // JSON error response helper
  function jsonError(res: Response, status: number, code: string, message: string): void {
    res.status(status).json({ error: code, message });
  }

  // Main middleware function
  return async function firewall(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const requestId = randomUUID();
    
    // Attach request ID for tracing
    res.setHeader('X-Request-ID', requestId);

    try {
      // 1. Extract client IP safely
      const clientIp = getClientIp(req, trustedProxies);

      // 2. Early body size check (before any parsing)
      const bodyCheck = checkBodySize(req, config.maxBodySize);
      if (!bodyCheck.ok) {
        metrics.recordRequest(Date.now() - startTime, true, false);
        logger.enqueue('warn', { event: 'body_too_large', requestId, clientIp, size: bodyCheck.size });
        jsonError(res, 413, 'PAYLOAD_TOO_LARGE', 'Request body exceeds size limit');
        return;
      }

      // 3. Blocked path patterns (safe regex with length cap)
      const path = req.path || req.url.split('?')[0];
      for (const pattern of config.blockedPathPatterns || []) {
        if (safeRegexTest(pattern, path, config.maxRegexInputLength)) {
          metrics.recordRequest(Date.now() - startTime, true, false);
          logger.enqueue('warn', { event: 'blocked_path', requestId, clientIp, path });
          jsonError(res, 403, 'FORBIDDEN', 'Access denied');
          return;
        }
      }

      // 4. Circuit breaker check
      if (circuitBreaker.isOpen()) {
        metrics.recordRequest(Date.now() - startTime, true, false);
        logger.enqueue('warn', { event: 'circuit_open', requestId, clientIp });
        jsonError(res, 503, 'SERVICE_UNAVAILABLE', 'Service temporarily unavailable');
        return;
      }

      // 5. Rate limiting with Redis
      try {
        const rateLimitStart = Date.now();
        const rateResult = await checkRateLimit(clientIp);
        const rateLimitLatency = Date.now() - rateLimitStart;

        // Check Redis latency for circuit breaker
        if (rateLimitLatency > config.circuitBreakerThresholdMs) {
          circuitBreaker.recordFailure();
        } else {
          circuitBreaker.recordSuccess();
        }

        res.setHeader('X-RateLimit-Limit', config.rateLimit);
        res.setHeader('X-RateLimit-Remaining', rateResult.remaining);

        if (!rateResult.allowed) {
          res.setHeader('Retry-After', rateResult.retryAfter);
          metrics.recordRequest(Date.now() - startTime, false, true);
          logger.enqueue('info', { event: 'rate_limited', requestId, clientIp, retryAfter: rateResult.retryAfter });
          jsonError(res, 429, 'RATE_LIMITED', 'Too many requests');
          return;
        }
      } catch (redisError) {
        circuitBreaker.recordFailure();
        // Fail open: allow request but log the error
        logger.enqueue('error', { event: 'redis_error', requestId, error: String(redisError) });
      }

      // 6. Emit to async scoring service (non-blocking)
      const scoringEvent: ScoringEvent = {
        requestId,
        timestamp: startTime,
        clientIp,
        method: req.method,
        path,
        userAgent: req.headers['user-agent'] || null,
        contentLength: bodyCheck.size,
        headers: {
          host: req.headers.host || '',
          origin: (req.headers.origin as string) || '',
          referer: (req.headers.referer as string) || '',
        },
      };
      scoringService.enqueue(scoringEvent);

      // 7. Log request (non-blocking)
      logger.enqueue('info', { event: 'request', requestId, clientIp, method: req.method, path });

      // 8. Record metrics
      metrics.recordRequest(Date.now() - startTime, false, false);

      // Continue to next middleware
      next();

    } catch (error) {
      metrics.recordRequest(Date.now() - startTime, true, false);
      logger.enqueue('error', { event: 'middleware_error', requestId, error: String(error) });
      jsonError(res, 500, 'INTERNAL_ERROR', 'Internal server error');
    }
  };
}

// ============================================================================
// ADMIN ENDPOINTS MIDDLEWARE
// ============================================================================

export function adminMiddleware(config: Pick<FirewallConfig, 'adminToken' | 'adminAllowedIps'>): RequestHandler {
  const allowedIps = new Set(config.adminAllowedIps);

  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIp = (req.socket as Socket).remoteAddress || '';
    
    // IP allowlist check
    if (allowedIps.size > 0 && !allowedIps.has(clientIp)) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'IP not allowed' });
      return;
    }

    // Token auth check
    const token = req.headers['x-admin-token'];
    if (!token || token !== config.adminToken) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid admin token' });
      return;
    }

    next();
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  TOKEN_BUCKET_LUA,
  DefaultAsyncLogger,
  DefaultScoringService,
  getClientIp,
  checkBodySize,
  safeRegexTest,
};
