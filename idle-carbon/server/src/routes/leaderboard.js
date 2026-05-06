const express = require('express');
const { getStore } = require('../db');
const { authMiddleware } = require('../middleware');

const router = express.Router();
router.use(authMiddleware);

// GET /api/v1/leaderboard
router.get('/', (req, res) => {
  try {
    const store = getStore();
    const leaderboard = store.departments.map(dept => {
      const improvement = dept.baselineUsage > 0
        ? ((dept.baselineUsage - dept.currentUsage) / dept.baselineUsage * 100)
        : 0;

      return {
        departmentId: dept.id,
        departmentName: dept.name,
        baselineUsage: dept.baselineUsage,
        currentUsage: Math.round(dept.currentUsage * 10) / 10,
        improvementPercent: Math.round(improvement * 10) / 10,
        teamSize: dept.teamSize,
      };
    });

    leaderboard.sort((a, b) => b.improvementPercent - a.improvementPercent);
    leaderboard.forEach((entry, idx) => { entry.rank = idx + 1; });

    res.json({ success: true, data: leaderboard });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
