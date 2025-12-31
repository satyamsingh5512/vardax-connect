/**
 * @vardax/connect
 * 
 * Connect any Node.js/Express application to VARDAx ML-Powered WAF
 * 
 * Usage:
 *   const vardax = require('@vardax/connect');
 *   app.use(vardax('vardax://localhost:8000?apiKey=your-key&mode=protect'));
 */

const axios = require('axios');

/**
 * Parse VARDAx connection string
 * Format: vardax://host:port?apiKey=key&mode=monitor&timeout=5000
 */
function parseConnectionString(connectionString) {
  if (!connectionString) {
    throw new Error('VARDAx connection string is required');
  }

  // Support both vardax:// and http(s)://
  let urlString = connectionString;
  if (connectionString.startsWith('vardax://')) {
    urlString = connectionString.replace('vardax://', 'http://');
  }

  try {
    const url = new URL(urlString);
    const params = new URLSearchParams(url.search);

    return {
      host: url.hostname,
      port: url.port || '8000',
      protocol: url.protocol.replace(':', ''),
      apiKey: params.get('apiKey') || params.get('api_key') || '',
      mode: params.get('mode') || 'monitor', // 'monitor' or 'protect'
      timeout: parseInt(params.get('timeout') || '5000'),
      blockThreshold: parseFloat(params.get('blockThreshold') || '0.8'),
      challengeThreshold: parseFloat(params.get('challengeThreshold') || '0.5'),
      debug: params.get('debug') === 'true',
      failOpen: params.get('failOpen') !== 'false', // Default true
      customBlockPage: params.get('blockPage') || null
    };
  } catch (error) {
    throw new Error(`Invalid VARDAx connection string: ${error.message}`);
  }
}

/**
 * Extract request features for VARDAx
 */
function extractFeatures(req) {
  const timestamp = new Date().toISOString();
  const requestId = `connect-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  return {
    request_id: requestId,
    timestamp: timestamp,
    client_ip: req.ip || req.connection.remoteAddress || 'unknown',
    client_port: req.connection.remotePort || 0,
    method: req.method,
    uri: req.path || req.url,
    query_string: req.url.includes('?') ? req.url.split('?')[1] : null,
    protocol: `HTTP/${req.httpVersion}`,
    user_agent: req.get('user-agent') || null,
    referer: req.get('referer') || null,
    content_type: req.get('content-type') || null,
    content_length: parseInt(req.get('content-length') || '0'),
    has_auth_header: !!req.get('authorization'),
    has_cookie: !!req.get('cookie'),
    body_length: req.body ? JSON.stringify(req.body).length : 0,
    origin: req.get('origin') || null,
    host: req.get('host') || null
  };
}

/**
 * Send request to VARDAx for analysis
 */
async function analyzeRequest(features, config) {
  const apiUrl = `${config.protocol}://${config.host}:${config.port}/api/v1/traffic/ingest`;

  const headers = {
    'Content-Type': 'application/json',
    'X-VARDAx-Connect': 'nodejs'
  };

  if (config.apiKey) {
    headers['X-API-Key'] = config.apiKey;
  }

  try {
    const response = await axios.post(apiUrl, features, {
      headers: headers,
      timeout: config.timeout
    });

    if (config.debug) {
      console.log('[VARDAx] Analysis result:', response.data);
    }

    return {
      allowed: true, // VARDAx doesn't block by default, just analyzes
      score: response.data.anomaly_score || 0,
      explanations: response.data.explanations || [],
      requestId: features.request_id
    };
  } catch (error) {
    if (config.debug) {
      console.error('[VARDAx] Analysis error:', error.message);
    }

    // Fail open by default - allow request if VARDAx is unreachable
    if (config.failOpen) {
      return { allowed: true, score: 0, explanations: [], error: error.message };
    } else {
      return { allowed: false, score: 1.0, explanations: ['VARDAx unreachable'], error: error.message };
    }
  }
}

/**
 * Create VARDAx middleware
 */
function createMiddleware(connectionString, options = {}) {
  const config = parseConnectionString(connectionString);
  
  // Merge options
  Object.assign(config, options);

  if (config.debug) {
    console.log('[VARDAx] Initialized with config:', {
      host: config.host,
      port: config.port,
      mode: config.mode,
      blockThreshold: config.blockThreshold
    });
  }

  // Return Express middleware
  return async function vardaxMiddleware(req, res, next) {
    try {
      // Extract features
      const features = extractFeatures(req);

      // Analyze with VARDAx (async, non-blocking in monitor mode)
      const analysis = await analyzeRequest(features, config);

      // Add VARDAx headers to response
      res.setHeader('X-VARDAx-Protected', 'true');
      res.setHeader('X-VARDAx-Score', analysis.score.toFixed(2));
      res.setHeader('X-VARDAx-Request-ID', analysis.requestId);

      // Protect mode - block high-risk requests
      if (config.mode === 'protect') {
        if (analysis.score >= config.blockThreshold) {
          // Block request
          if (config.customBlockPage) {
            return res.redirect(config.customBlockPage);
          }

          return res.status(403).json({
            error: 'Request blocked by VARDAx WAF',
            reason: 'Suspicious activity detected',
            anomaly_score: analysis.score,
            explanations: analysis.explanations.slice(0, 3).map(e => e.description || e),
            request_id: analysis.requestId,
            support: 'Contact support if you believe this is an error'
          });
        }

        // Challenge medium-risk requests
        if (analysis.score >= config.challengeThreshold) {
          res.setHeader('X-VARDAx-Challenge', 'true');
          // In production, you'd serve a CAPTCHA here
        }
      }

      // Attach analysis to request for logging
      req.vardax = {
        score: analysis.score,
        explanations: analysis.explanations,
        requestId: analysis.requestId
      };

      // Continue to next middleware
      next();

    } catch (error) {
      if (config.debug) {
        console.error('[VARDAx] Middleware error:', error);
      }

      // Fail open - continue request
      if (config.failOpen) {
        next();
      } else {
        res.status(500).json({
          error: 'Security check failed',
          message: 'Unable to verify request safety'
        });
      }
    }
  };
}

/**
 * Create VARDAx client for manual analysis
 */
function createClient(connectionString) {
  const config = parseConnectionString(connectionString);

  return {
    /**
     * Analyze a request manually
     */
    async analyze(requestData) {
      return await analyzeRequest(requestData, config);
    },

    /**
     * Get VARDAx status
     */
    async getStatus() {
      const url = `${config.protocol}://${config.host}:${config.port}/health`;
      try {
        const response = await axios.get(url, { timeout: config.timeout });
        return { connected: true, status: response.data };
      } catch (error) {
        return { connected: false, error: error.message };
      }
    },

    /**
     * Get configuration
     */
    getConfig() {
      return { ...config };
    }
  };
}

// Main export - middleware factory
module.exports = createMiddleware;

// Named exports
module.exports.createMiddleware = createMiddleware;
module.exports.createClient = createClient;
module.exports.parseConnectionString = parseConnectionString;
module.exports.extractFeatures = extractFeatures;

// Rate limiter export
module.exports.VardaxRateLimiter = require('./lib/rate-limiter').VardaxRateLimiter;
