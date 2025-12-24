/**
 * Protect Only Specific Routes
 * 
 * You can choose which routes to protect
 */

const express = require('express');
const vardax = require('vardax-connect');

const app = express();
app.use(express.json());

// Public routes (no protection)
app.get('/', (req, res) => {
  res.send('Public home page');
});

app.get('/about', (req, res) => {
  res.send('About page');
});

// Protected API routes
const apiRouter = express.Router();

// Add VARDAx protection to API routes only
apiRouter.use(vardax('vardax://localhost:8000?mode=protect'));

apiRouter.get('/users', (req, res) => {
  res.json({ users: [] });
});

apiRouter.post('/orders', (req, res) => {
  res.json({ order: 'created' });
});

app.use('/api', apiRouter);

// Admin routes (extra protection)
const adminRouter = express.Router();

// Stricter protection for admin
adminRouter.use(vardax('vardax://localhost:8000?mode=protect&blockThreshold=0.7'));

adminRouter.get('/dashboard', (req, res) => {
  res.send('Admin dashboard');
});

app.use('/admin', adminRouter);

app.listen(3000);
