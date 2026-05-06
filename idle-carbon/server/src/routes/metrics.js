const express = require('express');
const { getStore } = require('../db');
const { authMiddleware, requireRole } = require('../middleware');

const router = express.Router();
router.use(authMiddleware);

// GET /api/v1/metrics/idle
router.get('/idle', requireRole('manager', 'admin'), (req, res) => {
  try {
    const store = getStore();
    const { type, teamId } = req.query;
    let results = store.idleMetrics.filter(m => m.isIdle);

    if (type) results = results.filter(m => m.type === type);
    if (req.user.role === 'manager') {
      results = results.filter(m => m.teamId === req.user.departmentId);
    } else if (teamId) {
      results = results.filter(m => m.teamId === teamId);
    }

    // Attach department names
    results = results.map(m => {
      const dept = store.departments.find(d => d.id === m.teamId);
      return { ...m, departmentName: dept ? dept.name : 'Unknown' };
    });

    results.sort((a, b) => new Date(b.detectedAt) - new Date(a.detectedAt));
    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
