/**
 * Protected Demo Website Backend
 * 
 * This is a simple Node.js server that will be PROTECTED by VARDAx.
 * All traffic goes through VARDAx first.
 * 
 * Architecture:
 * User → VARDAx (localhost:8000) → This Server (localhost:4000)
 */

const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 4000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// ============================================================================
// ROUTES - These will be protected by VARDAx
// ============================================================================

// Home page
app.get('/', (req, res) => {
    res.json({
        message: 'Welcome to Protected Demo Website',
        protected_by: 'VARDAx ML-Powered WAF',
        status: 'operational'
    });
});

// User API (vulnerable to SQL injection if not protected)
app.get('/api/users', (req, res) => {
    const { id, search } = req.query;
    
    // Simulate database query (vulnerable without WAF)
    if (id) {
        // This would be vulnerable to SQL injection
        // VARDAx should block: ?id=1' OR '1'='1
        res.json({
            user: {
                id: id,
                name: 'John Doe',
                email: 'john@example.com'
            }
        });
    } else if (search) {
        // This would be vulnerable to XSS
        // VARDAx should block: ?search=<script>alert('xss')</script>
        res.json({
            results: [
                { id: 1, name: search }
            ]
        });
    } else {
        res.json({
            users: [
                { id: 1, name: 'John Doe', email: 'john@example.com' },
                { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
            ]
        });
    }
});

// Products API
app.get('/api/products', (req, res) => {
    res.json({
        products: [
            { id: 1, name: 'Product A', price: 99.99 },
            { id: 2, name: 'Product B', price: 149.99 },
            { id: 3, name: 'Product C', price: 199.99 }
        ]
    });
});

// File download (vulnerable to path traversal if not protected)
app.get('/api/files/:filename', (req, res) => {
    const { filename } = req.params;
    
    // This would be vulnerable to path traversal
    // VARDAx should block: /api/files/../../etc/passwd
    res.json({
        filename: filename,
        content: 'File content here',
        size: 1024
    });
});

// Admin endpoint (should be protected)
app.get('/admin/config', (req, res) => {
    // This should be blocked by VARDAx for unauthorized access
    res.json({
        config: {
            database: 'postgresql://localhost:5432/mydb',
            api_key: 'secret-key-12345',
            debug: true
        }
    });
});

// Login endpoint (vulnerable to brute force)
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    
    // Simulate login
    // VARDAx should detect credential stuffing attacks
    if (username === 'admin' && password === 'admin123') {
        res.json({
            success: true,
            token: 'jwt-token-here',
            user: { username: 'admin' }
        });
    } else {
        res.status(401).json({
            success: false,
            error: 'Invalid credentials'
        });
    }
});

// Search endpoint (vulnerable to XSS)
app.get('/api/search', (req, res) => {
    const { q } = req.query;
    
    // This would be vulnerable to XSS
    // VARDAx should block: ?q=<script>alert('xss')</script>
    res.json({
        query: q,
        results: [
            { id: 1, title: `Results for: ${q}` }
        ]
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not found',
        path: req.path
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        error: 'Internal server error'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║  🛡️  Protected Demo Website                               ║
║                                                            ║
║  Status: Running                                          ║
║  Port: ${PORT}                                                 ║
║  Protected by: VARDAx ML-Powered WAF                      ║
║                                                            ║
║  ⚠️  DO NOT ACCESS DIRECTLY!                              ║
║  All traffic must go through VARDAx proxy                 ║
║                                                            ║
║  Access via: http://localhost:8000/protected/*            ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
    `);
});
