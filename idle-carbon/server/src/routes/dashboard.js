const express = require('express');
const { getStore } = require('../db');
const { authMiddleware, requireRole } = require('../middleware');

const router = express.Router();
router.use(authMiddleware);

// GET /api/v1/dashboard/employee
router.get('/employee', (req, res) => {
  try {
    const store = getStore();
    const dept = store.departments.find(d => d.id === req.user.departmentId);

    // Team savings
    const teamMetrics = store.idleMetrics.filter(m => m.teamId === req.user.departmentId && m.isIdle);
    const totalCarbon = teamMetrics.reduce((sum, m) => sum + m.carbonSaved, 0);
    const totalCost = teamMetrics.reduce((sum, m) => sum + m.costSaved, 0);
    const totalKwh = teamMetrics.reduce((sum, m) => sum + m.usageValue, 0);

    // Team rank
    const ranked = store.departments.map(d => ({
      id: d.id,
      improvement: d.baselineUsage > 0 ? ((d.baselineUsage - d.currentUsage) / d.baselineUsage * 100) : 0
    })).sort((a, b) => b.improvement - a.improvement);
    const teamRank = ranked.findIndex(d => d.id === req.user.departmentId) + 1;
    const teamImprovement = ranked.find(d => d.id === req.user.departmentId)?.improvement || 0;

    // Notifications
    const notifications = store.notifications
      .filter(n => n.userId === req.user.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10);

    // Idle alerts
    const idleAlerts = teamMetrics
      .sort((a, b) => new Date(b.detectedAt) - new Date(a.detectedAt))
      .slice(0, 5)
      .map(m => ({ ...m, departmentName: dept ? dept.name : 'Unknown' }));

    res.json({
      success: true,
      data: {
        department: dept ? { name: dept.name, teamSize: dept.teamSize } : null,
        savings: {
          kwhSaved: Math.round(totalKwh * 10) / 10,
          costSaved: Math.round(totalCost * 100) / 100,
          carbonSaved: Math.round(totalCarbon * 10) / 10
        },
        leaderboard: {
          rank: teamRank,
          totalTeams: store.departments.length,
          improvementPercent: Math.round(teamImprovement * 10) / 10
        },
        notifications,
        idleAlerts
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/dashboard/admin
router.get('/admin', requireRole('admin'), (req, res) => {
  try {
    const store = getStore();
    const idleMetrics = store.idleMetrics.filter(m => m.isIdle);
    const totalCarbon = idleMetrics.reduce((sum, m) => sum + m.carbonSaved, 0);
    const totalCost = idleMetrics.reduce((sum, m) => sum + m.costSaved, 0);
    const totalKwh = idleMetrics.reduce((sum, m) => sum + m.usageValue, 0);

    // Action stats
    const statusMap = {};
    store.optimizationActions.forEach(a => {
      if (!statusMap[a.status]) statusMap[a.status] = { count: 0, totalSavings: 0 };
      statusMap[a.status].count++;
      statusMap[a.status].totalSavings += a.estimatedSavings || 0;
    });
    const actionStats = Object.entries(statusMap).map(([status, data]) => ({ status, ...data }));

    // Department breakdown
    const departments = store.departments.map(d => {
      const deptMetrics = idleMetrics.filter(m => m.teamId === d.id);
      return {
        ...d,
        idleCount: deptMetrics.length,
        deptCarbon: Math.round(deptMetrics.reduce((s, m) => s + m.carbonSaved, 0) * 10) / 10,
        deptCost: Math.round(deptMetrics.reduce((s, m) => s + m.costSaved, 0) * 100) / 100
      };
    });

    // Detection log
    const { type: filterType, teamId: filterTeam } = req.query;
    let log = [...idleMetrics];
    if (filterType) log = log.filter(m => m.type === filterType);
    if (filterTeam) log = log.filter(m => m.teamId === filterTeam);
    log = log.map(m => {
      const dept = store.departments.find(d => d.id === m.teamId);
      return { ...m, departmentName: dept ? dept.name : 'Unknown' };
    }).sort((a, b) => new Date(b.detectedAt) - new Date(a.detectedAt)).slice(0, 50);

    res.json({
      success: true,
      data: {
        totals: {
          kwhSaved: Math.round(totalKwh * 10) / 10,
          costSaved: Math.round(totalCost * 100) / 100,
          carbonSaved: Math.round(totalCarbon * 10) / 10,
          totalDetections: idleMetrics.length
        },
        actionStats,
        departments,
        detectionLog: log
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
