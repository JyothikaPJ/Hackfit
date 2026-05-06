require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDB } = require('./db');
const { seed } = require('./seed');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Init database and seed data
initDB();
seed();

// Routes
app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/metrics', require('./routes/metrics'));
app.use('/api/v1/actions', require('./routes/actions'));
app.use('/api/v1/leaderboard', require('./routes/leaderboard'));
app.use('/api/v1/dashboard', require('./routes/dashboard'));
app.use('/api/v1/chat', require('./routes/chat'));
app.use('/api/v1/reports', require('./routes/reports'));

// Baselines route
const { authMiddleware, requireRole } = require('./middleware');
const { getStore } = require('./db');
app.put('/api/v1/baselines/:teamId', authMiddleware, requireRole('admin'), (req, res) => {
  try {
    const { baselineUsage } = req.body;
    if (baselineUsage === undefined || baselineUsage < 0) {
      return res.status(400).json({ success: false, error: 'Valid baselineUsage required' });
    }
    const store = getStore();
    const dept = store.departments.find(d => d.id === req.params.teamId);
    if (!dept) return res.status(404).json({ success: false, error: 'Department not found' });
    dept.baselineUsage = baselineUsage;
    dept.updatedAt = new Date().toISOString();
    res.json({ success: true, data: dept });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.listen(PORT, () => {
  console.log(`\n🚀 Idle Carbon API running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health\n`);
});
