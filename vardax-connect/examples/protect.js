/**
 * Protect mode example - Active blocking
 */

const express = require('express');
const vardax = require('@vardax/connect');

const app = express();

// Connect to VARDAx in protect mode
app.use(vardax('vardax://localhost:8000?mode=protect&blockThreshold=0.8'));

app.get('/api/users', (req, res) => {
  // This route is protected
  // Malicious requests will be blocked before reaching here
  res.json({
    users: [
      { id: 1, name: 'John' },
      { id: 2, name: 'Jane' }
    ]
  });
});

app.listen(3000, () => {
  console.log('Protected server running on http://localhost:3000');
  console.log('Try: curl "http://localhost:3000/api/users?id=1\' OR \'1\'=\'1"');
});
