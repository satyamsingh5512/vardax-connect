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
 * Format: vardax://host:port?apiKey=key&mode=monitor&timeout=5000&serviceName=my-app
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
      customBlockPage: params.get('blockPage') || null,
      // Service identification
      serviceName: params.get('serviceName') || params.get('name') || null,
      serviceId: params.get('serviceId') || null,
      environment: params.get('env') || params.get('environment') || 'development',
      version: params.get('version') || '1.0.0'
    };
  } catch (error) {
    throw new Error(`Invalid VARDAx connection string: ${error.message}`);
  }
}

/**
 * Extract request features for VARDAx
 */
function extractFeatures(req, config) {
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
    host: req.get('host') || null,
    // Service identification
    service_id: config.serviceId || null
  };
}

/**
 * Register service with VARDAx
 */
async function registerService(config) {
  const apiUrl = `${config.protocol}://${config.host}:${config.port}/api/v1/services/register`;
  
  const serviceData = {
    service_id: config.serviceId,
    name: config.serviceName || 'Node.js App',
    host: require('os').hostname(),
    port: process.env.PORT || 3000,
    environment: config.environment,
    version: config.version,
    framework: 'express',
    mode: config.mode
  };

  try {
    const response = await axios.post(apiUrl, serviceData, {
      headers: { 'Content-Type': 'application/json' },
      timeout: config.timeout
    });
    
    if (config.debug) {
      console.log('[VARDAx] Service registered:', response.data);
    }
    
    return response.data;
  } catch (error) {
    if (config.debug) {
      console.error('[VARDAx] Service registration failed:', error.message);
    }
    return null;
  }
}

/**
 * Send heartbeat to VARDAx
 */
async function sendHeartbeat(config, stats) {
  const apiUrl = `${config.protocol}://${config.host}:${config.port}/api/v1/services/heartbeat`;
  
  try {
    await axios.post(apiUrl, {
      service_id: config.serviceId,
      requests_total: stats.requestsTotal,
      anomalies_total: stats.anomaliesTotal
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 2000
    });
  } catch (error) {
    // Silent fail for heartbeat
  }
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
  
  // Generate service ID if not provided
  if (!config.serviceId) {
    config.serviceId = `svc-${config.serviceName || 'app'}-${Date.now().toString(36)}`;
  }

  // Stats tracking
  const stats = {
    requestsTotal: 0,
    anomaliesTotal: 0
  };

  if (config.debug) {
    console.log('[VARDAx] Initialized with config:', {
      host: config.host,
      port: config.port,
      mode: config.mode,
      blockThreshold: config.blockThreshold,
      serviceName: config.serviceName,
      serviceId: config.serviceId
    });
  }

  // Register service on startup
  registerService(config).then(result => {
    if (result && result.service_id) {
      config.serviceId = result.service_id;
    }
  });

  // Start heartbeat interval (every 15 seconds)
  setInterval(() => {
    sendHeartbeat(config, stats);
  }, 15000);

  // Return Express middleware
  return async function vardaxMiddleware(req, res, next) {
    try {
      // Track request
      stats.requestsTotal++;
      
      // Extract features
      const features = extractFeatures(req, config);

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
module.exports.createVardaxMiddleware = function(options) {
  // Convenience function that accepts an options object
  // Usage: createVardaxMiddleware({ apiUrl: 'http://localhost:8000', mode: 'monitor', serviceName: 'my-app' })
  const { apiUrl, apiKey, mode, serviceName, serviceId, environment, version, ...rest } = options;
  
  let connectionString = apiUrl || 'http://localhost:8000';
  const params = new URLSearchParams();
  
  if (apiKey) params.set('apiKey', apiKey);
  if (mode) params.set('mode', mode);
  if (serviceName) params.set('serviceName', serviceName);
  if (serviceId) params.set('serviceId', serviceId);
  if (environment) params.set('environment', environment);
  if (version) params.set('version', version);
  
  const paramString = params.toString();
  if (paramString) {
    connectionString += (connectionString.includes('?') ? '&' : '?') + paramString;
  }
  
  return createMiddleware(connectionString, rest);
};
module.exports.createClient = createClient;
module.exports.parseConnectionString = parseConnectionString;
module.exports.extractFeatures = extractFeatures;

// Rate limiter export
module.exports.VardaxRateLimiter = require('./lib/rate-limiter').VardaxRateLimiter;
