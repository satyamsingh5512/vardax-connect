/**
 * Usage Example - VARDAx Firewall Middleware
 */

import express from 'express';
import Redis from 'ioredis';
import {
  firewallMiddleware,
  adminMiddleware,
  MetricsCollector,
  FirewallConfig,
} from './firewall-middleware';

// ============================================================================
// CONFIGURATION
// ============================================================================

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
});

const config: FirewallConfig = {
  redis: redis as any, // ioredis is compatible
  trustedProxies: ['127.0.0.1', '10.0.0.0/8'], // Your load balancer IPs
  rateLimit: 100,
  rateLimitWindow: 60,
  maxBodySize: 1024 * 1024, // 1MB
  adminEnabled: true,
  adminToken: process.env.ADMIN_TOKEN || 'change-me-in-production',
  adminAllowedIps: ['127.0.0.1'],
  circuitBreakerThresholdMs: 100,
  circuitBreakerFailureThreshold: 5,
  circuitBreakerRecoveryMs: 30000,
  maxRegexInputLength: 2048,
  blockedPathPatterns: [
    /\.\.\//, // Path traversal
    /\.(php|asp|aspx|jsp)$/i, // Dangerous extensions
  ],
};

// ============================================================================
// EXPRESS APP
// ============================================================================

const app = express();
const metrics = new MetricsCollector();

// Mount firewall middleware FIRST (before body parsers)
app.use(firewallMiddleware(config));

// Body parser AFTER firewall (body size already checked)
app.use(express.json({ limit: '1mb' }));

// Your application routes
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Protected by VARDAx' });
});

app.post('/api/data', (req, res) => {
  res.json({ received: true, body: req.body });
});

// Admin endpoints (protected)
if (config.adminEnabled) {
  const adminRouter = express.Router();
  adminRouter.use(adminMiddleware({
    adminToken: config.adminToken,
    adminAllowedIps: config.adminAllowedIps,
  }));

  adminRouter.get('/health', (req, res) => {
    res.json({ status: 'healthy' });
  });

  adminRouter.get('/metrics', (req, res) => {
    res.json(metrics.getMetrics());
  });

  app.use('/admin', adminRouter);
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
