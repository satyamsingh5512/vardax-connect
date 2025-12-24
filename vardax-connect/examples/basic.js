/**
 * Basic example - Monitor mode
 */

const express = require('express');
const vardax = require('@vardax/connect');

const app = express();

// Connect to VARDAx in monitor mode
app.use(vardax('vardax://localhost:8000?mode=monitor'));

app.get('/', (req, res) => {
  res.json({
    message: 'Hello! This app is protected by VARDAx',
    anomaly_score: req.vardax?.score || 0
  });
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
  console.log('VARDAx dashboard: http://localhost:3000');
});
