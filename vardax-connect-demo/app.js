/**
 * VARDAx Connect Demo App
 * 
 * Run this to see vardax-connect in action!
 * 
 * Prerequisites:
 * 1. Start VARDAx: npm run dev (in main directory)
 * 2. Install dependencies: npm install
 * 3. Run this: node app.js
 * 4. Test: curl http://localhost:3001/api/users
 */

const express = require('express');
const path = require('path');

// Import vardax-connect from parent directory
const vardax = require('../vardax-connect/index.js');

const app = express();
const PORT = 3001;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ============================================
// 🛡️ VARDAX PROTECTION
// ============================================
app.use(vardax('vardax://localhost:8000?mode=monitor&debug=true'));
// All routes below are now protected!
// ============================================

// Home page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>VARDAx Protected App</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          max-width: 800px;
          margin: 50px auto;
          padding: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        .container {
          background: white;
          color: #333;
          padding: 40px;
          border-radius: 20px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        h1 { color: #667eea; }
        .badge {
          background: #10b981;
          color: white;
          padding: 5px 15px;
          border-radius: 20px;
          font-size: 14px;
          display: inline-block;
          margin-bottom: 20px;
        }
        .endpoint {
          background: #f0f0f0;
          padding: 15px;
          margin: 10px 0;
          border-radius: 8px;
          border-left: 4px solid #667eea;
        }
        code {
          background: #1f2937;
          color: #10b981;
          padding: 2px 8px;
          border-radius: 4px;
          font-family: monospace;
        }
        .score {
          background: #f0f9ff;
          border: 2px solid #3b82f6;
          padding: 15px;
          border-radius: 8px;
          margin: 20px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🛡️ VARDAx Protected App</h1>
        <div class="badge">Protected by ML-Powered WAF</div>
        
        <div class="score">
          <strong>Your Anomaly Score:</strong> ${req.vardax?.score.toFixed(2) || 0}
          <br>
          <small>Lower is better (0 = normal, 1 = suspicious)</small>
        </div>
        
        <h2>Test Endpoints:</h2>
        
        <div class="endpoint">
          <strong>GET /api/users</strong><br>
          <code>curl http://localhost:${PORT}/api/users</code>
        </div>
        
        <div class="endpoint">
          <strong>POST /api/login</strong><br>
          <code>curl -X POST http://localhost:${PORT}/api/login -H "Content-Type: application/json" -d '{"username":"admin","password":"test"}'</code>
        </div>
        
        <div class="endpoint">
          <strong>SQL Injection Test</strong><br>
          <code>curl "http://localhost:${PORT}/api/users?id=1' OR '1'='1"</code>
        </div>
        
        <div class="endpoint">
          <strong>Path Traversal Test</strong><br>
          <code>curl http://localhost:${PORT}/api/files/../../etc/passwd</code>
        </div>
        
        <h2>Check VARDAx Dashboard:</h2>
        <p>Open <a href="http://localhost:3000" target="_blank">http://localhost:3000</a> to see all requests being analyzed!</p>
      </div>
    </body>
    </html>
  `);
});

// API endpoints
app.get('/api/users', (req, res) => {
  console.log('📊 VARDAx Analysis:', {
    score: req.vardax?.score,
    requestId: req.vardax?.requestId
  });
  
  res.json({
    users: [
      { id: 1, name: 'John Doe', email: 'john@example.com' },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
    ],
    vardax: {
      protected: true,
      anomaly_score: req.vardax?.score || 0,
      request_id: req.vardax?.requestId
    }
  });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  console.log('🔐 Login attempt:', {
    username,
    anomaly_score: req.vardax?.score
  });
  
  // Simulate login
  if (username === 'admin' && password === 'admin123') {
    res.json({
      success: true,
      token: 'jwt-token-here',
      vardax_score: req.vardax?.score
    });
  } else {
    res.status(401).json({
      success: false,
      error: 'Invalid credentials'
    });
  }
});

app.get('/api/files/:filename', (req, res) => {
  const { filename } = req.params;
  
  console.log('📁 File request:', {
    filename,
    anomaly_score: req.vardax?.score
  });
  
  res.json({
    filename,
    content: 'File content here',
    vardax_score: req.vardax?.score
  });
});

app.get('/api/products', (req, res) => {
  res.json({
    products: [
      { id: 1, name: 'Product A', price: 99.99 },
      { id: 2, name: 'Product B', price: 149.99 }
    ]
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║  🛡️  VARDAx Connect Demo App                              ║
║                                                            ║
║  Status: Running                                          ║
║  Port: ${PORT}                                                 ║
║  Protected by: VARDAx ML-Powered WAF                      ║
║                                                            ║
║  🌐 Open: http://localhost:${PORT}                            ║
║  📊 Dashboard: http://localhost:3000                      ║
║                                                            ║
║  Test commands:                                           ║
║  curl http://localhost:${PORT}/api/users                      ║
║  curl "http://localhost:${PORT}/api/users?id=1' OR '1'='1"   ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});
