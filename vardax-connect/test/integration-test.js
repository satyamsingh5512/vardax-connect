/**
 * Integration test with real VARDAx instance
 * 
 * Prerequisites:
 * 1. Start VARDAx: npm run dev
 * 2. Run this test: node test/integration-test.js
 */

const express = require('express');
const vardax = require('../index');

const app = express();
app.use(express.json());

console.log('🧪 VARDAx Integration Test\n');

// Test with monitor mode
app.use(vardax('vardax://localhost:8000?mode=monitor&debug=true'));

// Test routes
app.get('/normal', (req, res) => {
  res.json({
    message: 'Normal request',
    vardax: req.vardax
  });
});

app.get('/attack', (req, res) => {
  res.json({
    message: 'Attack simulation',
    vardax: req.vardax
  });
});

const PORT = 4001;
app.listen(PORT, () => {
  console.log(`✅ Test server running on http://localhost:${PORT}`);
  console.log('');
  console.log('Test endpoints:');
  console.log(`  curl http://localhost:${PORT}/normal`);
  console.log(`  curl "http://localhost:${PORT}/attack?id=1' OR '1'='1"`);
  console.log('');
  console.log('Check VARDAx dashboard: http://localhost:3000');
});
