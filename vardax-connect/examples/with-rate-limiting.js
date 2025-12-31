/**
 * Example: VARDAx Connect with Rate Limiting
 * 
 * This example shows how to combine VARDAx ML protection
 * with Redis-backed rate limiting for complete DDoS defense.
 */

const express = require('express');
const Redis = require('ioredis');
const vardax = require('@vardax/connect');
const { VardaxRateLimiter } = require('@vardax/connect');

const app = express();
app.use(express.json());

// Initialize Redis connection
const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: 3
});

// Initialize rate limiter with Redis
const rateLimiter = new VardaxRateLimiter({
    redis: redis,
    debug: process.env.NODE_ENV !== 'production',
    failOpen: true,
    endpointLimits: {
        '/api/auth/login': 'auth',
        '/api/auth/register': 'auth',
        '/api/v1/': 'api',
        '/graphql': 'strict'
    }
});

// Layer 1: Rate limiting (before VARDAx)
app.use(rateLimiter.middleware({
    skipPaths: ['/health', '/ready', '/metrics']
}));

// Layer 2: VARDAx ML protection
app.use(vardax(process.env.VARDAX_URL || 'vardax://localhost:8000?mode=protect'));

// Health check (no rate limiting)
app.get('/health', (req, res) => {
    res.json({ status: 'healthy' });
});

// Protected API endpoints
app.get('/api/v1/data', (req, res) => {
    res.json({
        message: 'Protected data',
        vardax: req.vardax
    });
});

app.post('/api/auth/login', (req, res) => {
    // Auth logic here
    res.json({ token: 'example-token' });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('Shutting down...');
    await rateLimiter.close();
    process.exit(0);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Rate limiting: enabled');
    console.log('VARDAx protection: enabled');
});
