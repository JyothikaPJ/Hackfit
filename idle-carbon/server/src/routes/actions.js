const express = require('express');
const { v4: uuid } = require('uuid');
const { getStore } = require('../db');
const { authMiddleware, requireRole } = require('../middleware');

const router = express.Router();
router.use(authMiddleware);

// GET /api/v1/actions
router.get('/', requireRole('manager', 'admin'), (req, res) => {
  try {
    const store = getStore();
    let results = [...store.optimizationActions];

    if (req.user.role === 'manager') {
      results = results.filter(a => {
        const metric = store.idleMetrics.find(m => m.id === a.metricId);
        return metric && metric.teamId === req.user.departmentId;
      });
    }

    const { status } = req.query;
    if (status) results = results.filter(a => a.status === status);

    // Enrich with metric and department data
    results = results.map(a => {
      const metric = store.idleMetrics.find(m => m.id === a.metricId);
      const dept = metric ? store.departments.find(d => d.id === metric.teamId) : null;
      return {
        ...a,
        resourceType: metric ? metric.type : null,
        resourceId: metric ? metric.resourceId : null,
        carbonSaved: metric ? metric.carbonSaved : 0,
        costSaved: metric ? metric.costSaved : 0,
        departmentName: dept ? dept.name : 'Unknown'
      };
    });

    results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/actions/approve/:id
router.post('/approve/:id', requireRole('manager'), (req, res) => {
  try {
    const store = getStore();
    const action = store.optimizationActions.find(a => a.id === req.params.id);
    if (!action) return res.status(404).json({ success: false, error: 'Action not found' });
    if (action.status !== 'pending') return res.status(400).json({ success: false, error: 'Action is not pending' });

    const metric = store.idleMetrics.find(m => m.id === action.metricId);
    if (req.user.role === 'manager' && metric && metric.teamId !== req.user.departmentId) {
      return res.status(403).json({ success: false, error: 'Not your department' });
    }

    const now = new Date().toISOString();
    action.status = 'approved';
    action.approvedBy = req.user.id;
    action.executedAt = now;
    action.actualSavings = action.estimatedSavings;

    // Update department currentUsage
    if (metric) {
      const dept = store.departments.find(d => d.id === metric.teamId);
      if (dept) {
        dept.currentUsage = Math.max(0, dept.currentUsage - action.estimatedSavings);
        dept.updatedAt = now;
      }
    }

    res.json({
      success: true,
      data: {
        ...action,
        resourceType: metric ? metric.type : null,
        resourceId: metric ? metric.resourceId : null,
        carbonSaved: metric ? metric.carbonSaved : 0,
        costSaved: metric ? metric.costSaved : 0
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/actions/dismiss/:id
router.post('/dismiss/:id', requireRole('manager'), (req, res) => {
  try {
    const store = getStore();
    const action = store.optimizationActions.find(a => a.id === req.params.id);
    if (!action) return res.status(404).json({ success: false, error: 'Action not found' });
    if (action.status !== 'pending') return res.status(400).json({ success: false, error: 'Action is not pending' });

    const metric = store.idleMetrics.find(m => m.id === action.metricId);
    if (req.user.role === 'manager' && metric && metric.teamId !== req.user.departmentId) {
      return res.status(403).json({ success: false, error: 'Not your department' });
    }

    action.status = 'dismissed';
    action.executedAt = new Date().toISOString();

    res.json({ success: true, data: { id: action.id, status: 'dismissed' } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
