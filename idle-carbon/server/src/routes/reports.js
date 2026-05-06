/**
 * routes/reports.js — Optimization Report API
 *
 * GET  /api/v1/reports/optimizations  — aggregated data for report generation (manager)
 * POST /api/v1/reports                — manager submits a completed report
 * GET  /api/v1/reports/admin          — admin views all submitted reports
 */

const express = require('express');
const { v4: uuid } = require('uuid');
const { getStore } = require('../db');
const { authMiddleware, requireRole } = require('../middleware');

const router = express.Router();
router.use(authMiddleware);

// ─── helpers ──────────────────────────────────────────────────────────────────

const RESOURCE_LABELS = {
  cloud:    { type: 'VM / Cloud',  issue: 'Zombie VM',       action: 'Server sleep mode' },
  hvac:     { type: 'HVAC',        issue: 'Idle Room',        action: 'HVAC turned OFF'  },
  lighting: { type: 'Lighting',    issue: 'Energy Vampire',   action: 'Lights turned OFF' },
  machine:  { type: 'Server',      issue: 'Sleeping Server',  action: 'Server suspended'  },
};

const KWH_RATE = 0.20; // $/kWh

function periodStartDate(period) {
  const d = new Date();
  if (period === 'weekly')  d.setDate(d.getDate() - 7);
  if (period === 'monthly') d.setDate(d.getDate() - 30);
  else d.setHours(0, 0, 0, 0); // today
  return d;
}

// ─── GET /optimizations  ──────────────────────────────────────────────────────
// Returns pre-built data needed to render a report for the requesting manager.
router.get('/optimizations', requireRole('manager'), (req, res) => {
  try {
    const store = getStore();
    const { period = 'today' } = req.query;
    const since = periodStartDate(period);

    // Filter actions for this manager's department
    let actions = store.optimizationActions.filter(a => {
      const metric = store.idleMetrics.find(m => m.id === a.metricId);
      return metric && metric.teamId === req.user.departmentId;
    });

    // Apply period filter
    actions = actions.filter(a => new Date(a.createdAt) >= since);

    const dept = store.departments.find(d => d.id === req.user.departmentId);
    const deptName = dept ? dept.name : 'Unknown';

    // Build detail rows
    const rows = actions.map(a => {
      const metric = store.idleMetrics.find(m => m.id === a.metricId) || {};
      const labels = RESOURCE_LABELS[metric.type] || { type: metric.type || 'Resource', issue: 'Idle', action: a.actionType };
      const energySaved = metric.carbonSaved || 0;   // stored as kWh equivalent
      const costSaved   = metric.costSaved   || 0;
      return {
        resourceName:   metric.resourceId || a.id,
        resourceType:   labels.type,
        issueDetected:  labels.issue,
        actionTaken:    labels.action,
        energySavedKwh: Math.round(energySaved * 100) / 100,
        costSaved:      Math.round(costSaved    * 100) / 100,
        timestamp:      a.createdAt,
        status:         a.status,
      };
    });

    // Zombie resources — those that are still pending
    const zombieDetected = rows.filter(r => r.issueDetected === 'Zombie VM').length;
    const zombieFixed    = rows.filter(r => r.issueDetected === 'Zombie VM' && r.status !== 'pending').length;

    const approved = actions.filter(a => a.status === 'approved' || a.status === 'auto-executed');

    const totalEnergySaved = rows.reduce((s, r) => s + r.energySavedKwh, 0);
    const totalCostSaved   = rows.reduce((s, r) => s + r.costSaved,      0);
    const energyWasted     = store.idleMetrics
      .filter(m => m.teamId === req.user.departmentId)
      .reduce((s, m) => s + (m.usageValue || 0), 0);

    // Savings per room (for bar chart)
    const savingsPerRoom = {};
    rows.forEach(r => {
      savingsPerRoom[r.resourceName] = (savingsPerRoom[r.resourceName] || 0) + r.energySavedKwh;
    });

    // Optimizations per hour (for line chart)
    const perHour = {};
    actions.forEach(a => {
      const h = new Date(a.createdAt).getHours();
      perHour[h] = (perHour[h] || 0) + 1;
    });
    const optimizationsPerHour = Array.from({ length: 24 }, (_, h) => ({
      hour: `${String(h).padStart(2, '0')}:00`,
      count: perHour[h] || 0,
    }));

    res.json({
      success: true,
      data: {
        meta: {
          managerName:  req.user.name,
          department:   deptName,
          dateGenerated: new Date().toISOString(),
          period,
        },
        summary: {
          totalIdleRoomsDetected: store.idleMetrics.filter(m => m.teamId === req.user.departmentId && m.isIdle).length,
          totalOptimizationsPerformed: approved.length,
          zombieResourcesDetected: zombieDetected,
          zombieResourcesFixed:    zombieFixed,
        },
        energyImpact: {
          totalEnergySavedKwh:         Math.round(totalEnergySaved * 100) / 100,
          totalCostSaved:              Math.round(totalCostSaved   * 100) / 100,
          energyWastedBeforeOpt:       Math.round(energyWasted     * 100) / 100,
          energySavedAfterOpt:         Math.round(totalEnergySaved * 100) / 100,
        },
        rows,
        charts: {
          savingsPerRoom: Object.entries(savingsPerRoom).map(([name, kwh]) => ({ name, kwh: Math.round(kwh * 100) / 100 })),
          optimizationsPerHour,
          zombieBreakdown: [
            { name: 'Fixed',   value: zombieFixed    },
            { name: 'Pending', value: Math.max(0, zombieDetected - zombieFixed) },
          ],
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /  ──────────────────────────────────────────────────────────────────
// Manager saves + optionally submits a report to admin.
router.post('/', requireRole('manager'), (req, res) => {
  try {
    const store = getStore();
    const {
      period = 'today',
      managerComments = '',
      aiSummary = '',
      reportData = {},
    } = req.body;

    const dept = store.departments.find(d => d.id === req.user.departmentId);

    const report = {
      report_id:           uuid(),
      manager_id:          req.user.id,
      manager_name:        req.user.name,
      department:          dept ? dept.name : 'Unknown',
      date_generated:      new Date().toISOString(),
      period,
      status:              'submitted',   // submitted → reviewed
      manager_comments:    managerComments,
      ai_summary:          aiSummary,
      // Top-level KPIs mirrored for quick admin filters
      energy_saved_kwh:    reportData.energyImpact?.totalEnergySavedKwh    || 0,
      cost_saved:          reportData.energyImpact?.totalCostSaved          || 0,
      optimizations_count: reportData.summary?.totalOptimizationsPerformed  || 0,
      // Full JSON blob
      report_data_json:    reportData,
    };

    store.optimizationReports.push(report);
    res.status(201).json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /admin  ──────────────────────────────────────────────────────────────
// Admin views all submitted reports with optional date filter.
router.get('/admin', requireRole('admin'), (req, res) => {
  try {
    const store = getStore();
    const { from, to, managerId } = req.query;

    let reports = [...store.optimizationReports];

    if (from) reports = reports.filter(r => new Date(r.date_generated) >= new Date(from));
    if (to)   reports = reports.filter(r => new Date(r.date_generated) <= new Date(to));
    if (managerId) reports = reports.filter(r => r.manager_id === managerId);

    // Sort newest first
    reports.sort((a, b) => new Date(b.date_generated) - new Date(a.date_generated));

    res.json({ success: true, data: reports });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── PATCH /:reportId/status  ────────────────────────────────────────────────
// Admin marks a report as reviewed.
router.patch('/:reportId/status', requireRole('admin'), (req, res) => {
  try {
    const store = getStore();
    const report = store.optimizationReports.find(r => r.report_id === req.params.reportId);
    if (!report) return res.status(404).json({ success: false, error: 'Report not found' });

    const { status } = req.body;
    if (!['submitted', 'reviewed'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }
    report.status = status;
    report.reviewed_at = new Date().toISOString();
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
