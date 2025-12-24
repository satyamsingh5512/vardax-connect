/**
 * Complete Express App Protected by VARDAx
 * 
 * This is a full example showing where to use vardax-connect
 */

const express = require('express');
const vardax = require('vardax-connect'); // or '@vardax/connect' if published

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// 🛡️ ADD VARDAX PROTECTION HERE
// ============================================
app.use(vardax('vardax://localhost:8000?mode=monitor'));
// This line protects ALL routes below it
// ============================================

// Your routes (now protected by VARDAx)
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to my API',
    protected: true,
    anomaly_score: req.vardax?.score || 0
  });
});

app.get('/api/users', (req, res) => {
  // This route is protected
  // VARDAx analyzed the request before it got here
  res.json({
    users: [
      { id: 1, name: 'John' },
      { id: 2, name: 'Jane' }
    ]
  });
});

app.post('/api/login', (req, res) => {
  // This route is protected from brute force attacks
  const { username, password } = req.body;
  
  // Your login logic here
  res.json({ success: true });
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
  console.log('Protected by VARDAx!');
});
