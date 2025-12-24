/**
 * Adding VARDAx to an Existing Express App
 * 
 * If you already have an Express app, just add 2 lines
 */

const express = require('express');
const vardax = require('vardax-connect'); // ADD THIS LINE

const app = express();

// Your existing middleware
app.use(express.json());
app.use(express.static('public'));

// ADD THIS LINE - VARDAx protection
app.use(vardax('vardax://localhost:8000?mode=monitor'));

// Your existing routes (unchanged)
app.get('/api/products', (req, res) => {
  res.json({ products: [] });
});

app.post('/api/orders', (req, res) => {
  res.json({ order: 'created' });
});

app.listen(3000);
