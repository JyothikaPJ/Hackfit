require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');
const { getStore, initDB } = require('./db');

function seed() {
  console.log('🌱 Seeding database...');
  initDB();

  const store = getStore();

  // Clear existing data
  store.departments = [];
  store.users = [];
  store.idleMetrics = [];
  store.optimizationActions = [];
  store.notifications = [];
  store.optimizationReports = [];

  // Departments (PRD Section 12)
  const departments = [
    { id: uuid(), name: 'Data Science', baselineUsage: 1000, currentUsage: 750, teamSize: 12, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: uuid(), name: 'Procurement', baselineUsage: 400, currentUsage: 328, teamSize: 10, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: uuid(), name: 'HR', baselineUsage: 200, currentUsage: 176, teamSize: 8, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: uuid(), name: 'Facilities / IT', baselineUsage: 350, currentUsage: 315, teamSize: 10, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  ];
  store.departments.push(...departments);
  console.log(`  ✅ ${departments.length} departments created`);

  const hash = bcrypt.hashSync('password123', 10);
  const users = [];
  const [ds, pr, hr, fi] = departments;

  // Data Science: 12
  for (let i = 1; i <= 8; i++) users.push({ id: uuid(), email: `ds.scientist${i}@company.com`, password: hash, name: `Data Scientist ${i}`, role: 'employee', departmentId: ds.id });
  for (let i = 1; i <= 3; i++) users.push({ id: uuid(), email: `ds.engineer${i}@company.com`, password: hash, name: `ML Engineer ${i}`, role: 'employee', departmentId: ds.id });
  users.push({ id: uuid(), email: 'ds.lead@company.com', password: hash, name: 'DS Team Lead', role: 'manager', departmentId: ds.id });

  // Procurement: 10
  for (let i = 1; i <= 7; i++) users.push({ id: uuid(), email: `proc.officer${i}@company.com`, password: hash, name: `Procurement Officer ${i}`, role: 'employee', departmentId: pr.id });
  for (let i = 1; i <= 2; i++) users.push({ id: uuid(), email: `proc.manager${i}@company.com`, password: hash, name: `Procurement Manager ${i}`, role: 'manager', departmentId: pr.id });
  users.push({ id: uuid(), email: 'proc.admin@company.com', password: hash, name: 'Procurement Admin', role: 'admin', departmentId: pr.id });

  // HR: 8
  for (let i = 1; i <= 5; i++) users.push({ id: uuid(), email: `hr.generalist${i}@company.com`, password: hash, name: `HR Generalist ${i}`, role: 'employee', departmentId: hr.id });
  for (let i = 1; i <= 2; i++) users.push({ id: uuid(), email: `hr.manager${i}@company.com`, password: hash, name: `HR Manager ${i}`, role: 'manager', departmentId: hr.id });
  users.push({ id: uuid(), email: 'hr.recruiter@company.com', password: hash, name: 'HR Recruiter', role: 'employee', departmentId: hr.id });

  // Facilities / IT: 10
  for (let i = 1; i <= 5; i++) users.push({ id: uuid(), email: `it.engineer${i}@company.com`, password: hash, name: `IT Engineer ${i}`, role: 'employee', departmentId: fi.id });
  for (let i = 1; i <= 3; i++) users.push({ id: uuid(), email: `maint.staff${i}@company.com`, password: hash, name: `Maintenance Staff ${i}`, role: 'employee', departmentId: fi.id });
  for (let i = 1; i <= 2; i++) users.push({ id: uuid(), email: `fac.manager${i}@company.com`, password: hash, name: `Facilities Manager ${i}`, role: 'manager', departmentId: fi.id });

  store.users.push(...users);
  console.log(`  ✅ ${users.length} users created`);

  // Idle Metrics (PRD Section 12)
  const metrics = [];
  const now = new Date();

  // 12 idle cloud VMs
  for (let i = 1; i <= 8; i++) {
    metrics.push({
      id: uuid(), type: 'cloud', resourceId: `vm-ds-${String(i).padStart(3, '0')}`,
      teamId: ds.id, usageValue: 30 + Math.random() * 20, baselineUsage: 100,
      isIdle: true, carbonSaved: 12 + Math.random() * 8, costSaved: 2.5 + Math.random() * 2,
      detectedAt: new Date(now - Math.random() * 86400000).toISOString()
    });
  }
  for (let i = 1; i <= 4; i++) {
    metrics.push({
      id: uuid(), type: 'cloud', resourceId: `vm-proc-${String(i).padStart(3, '0')}`,
      teamId: pr.id, usageValue: 15 + Math.random() * 10, baselineUsage: 50,
      isIdle: true, carbonSaved: 8 + Math.random() * 5, costSaved: 1.5 + Math.random() * 1.5,
      detectedAt: new Date(now - Math.random() * 86400000).toISOString()
    });
  }

  // 4 HVAC idle
  const hvacDepts = [hr, fi, pr, ds];
  for (let i = 1; i <= 4; i++) {
    metrics.push({
      id: uuid(), type: 'hvac', resourceId: `hvac-room-${100 + i}`,
      teamId: hvacDepts[i - 1].id, usageValue: 5 + Math.random() * 3, baselineUsage: 25,
      isIdle: true, carbonSaved: 15 + Math.random() * 10, costSaved: 3 + Math.random() * 2,
      detectedAt: new Date(now - Math.random() * 43200000).toISOString()
    });
  }

  // 8 lighting idle
  for (let i = 1; i <= 8; i++) {
    metrics.push({
      id: uuid(), type: 'lighting', resourceId: `lights-floor-${i}`,
      teamId: departments[i % 4].id, usageValue: 2 + Math.random() * 2, baselineUsage: 10,
      isIdle: true, carbonSaved: 5 + Math.random() * 3, costSaved: 1 + Math.random() * 1,
      detectedAt: new Date(now - Math.random() * 28800000).toISOString()
    });
  }
  store.idleMetrics.push(...metrics);
  console.log(`  ✅ ${metrics.length} idle metrics created`);

  // Optimization Actions
  const actionMap = { 'cloud': 'shutdown', 'hvac': 'hvac-off', 'lighting': 'lights-off', 'machine': 'suspend' };
  metrics.forEach((m, idx) => {
    const actionType = actionMap[m.type] || 'shutdown';
    const requiresApproval = m.type === 'cloud' || m.type === 'machine';

    if (requiresApproval) {
      if (idx % 3 === 0) {
        store.optimizationActions.push({
          id: uuid(), metricId: m.id, status: 'pending', actionType,
          approvedBy: null, executedAt: null, estimatedSavings: m.costSaved,
          actualSavings: null, createdAt: m.detectedAt
        });
      } else {
        const mgr = users.find(u => u.role === 'manager' && u.departmentId === m.teamId);
        store.optimizationActions.push({
          id: uuid(), metricId: m.id, status: 'approved', actionType,
          approvedBy: mgr ? mgr.id : null, executedAt: m.detectedAt,
          estimatedSavings: m.costSaved, actualSavings: m.costSaved, createdAt: m.detectedAt
        });
      }
    } else {
      store.optimizationActions.push({
        id: uuid(), metricId: m.id, status: 'auto-executed', actionType,
        approvedBy: null, executedAt: m.detectedAt
        , estimatedSavings: m.costSaved, actualSavings: m.costSaved, createdAt: m.detectedAt
      });
    }
  });
  console.log(`  ✅ ${store.optimizationActions.length} optimization actions created`);

  // Notifications for managers
  const managers = users.filter(u => u.role === 'manager');
  managers.forEach(mgr => {
    store.notifications.push(
      { id: uuid(), userId: mgr.id, message: 'Idle cloud VM detected in your team', type: 'alert', resourceName: 'vm-ds-001', isRead: false, createdAt: new Date().toISOString() },
      { id: uuid(), userId: mgr.id, message: 'HVAC idle in meeting room 101', type: 'info', resourceName: 'hvac-room-101', isRead: false, createdAt: new Date().toISOString() }
    );
  });
  console.log(`  ✅ ${managers.length * 2} notifications created`);

  // Seed sample optimization reports
  store.optimizationReports = [];
  const dsLead = users.find(u => u.email === 'ds.lead@company.com');
  if (dsLead) {
    store.optimizationReports.push({
      report_id: uuid(),
      manager_id: dsLead.id,
      manager_name: dsLead.name,
      department: 'Data Science',
      date_generated: new Date(now - 3 * 24 * 3600000).toISOString(),
      period: 'weekly',
      status: 'reviewed',
      manager_comments: 'Most optimizations occurred during off-peak hours. Recommend automatic scheduling for recurring idle VMs.',
      ai_summary: 'This week the system reduced energy waste by 28% by automatically shutting down idle HVAC systems and zombie servers across the Data Science department.',
      energy_saved_kwh: 47.2,
      cost_saved: 9.44,
      optimizations_count: 8,
      report_data_json: {},
      reviewed_at: new Date(now - 2 * 24 * 3600000).toISOString(),
    });
    store.optimizationReports.push({
      report_id: uuid(),
      manager_id: dsLead.id,
      manager_name: dsLead.name,
      department: 'Data Science',
      date_generated: new Date(now - 1 * 24 * 3600000).toISOString(),
      period: 'today',
      status: 'submitted',
      manager_comments: 'ML training VMs left running overnight. Escalating for policy review.',
      ai_summary: 'Today the system detected 4 zombie VMs and 2 idle HVAC units, saving an estimated 12.4 kWh and $2.48 in energy costs.',
      energy_saved_kwh: 12.4,
      cost_saved: 2.48,
      optimizations_count: 6,
      report_data_json: {},
    });
  }
  const facMgr = users.find(u => u.email === 'fac.manager1@company.com');
  if (facMgr) {
    store.optimizationReports.push({
      report_id: uuid(),
      manager_id: facMgr.id,
      manager_name: facMgr.name,
      department: 'Facilities / IT',
      date_generated: new Date(now - 5 * 3600000).toISOString(),
      period: 'today',
      status: 'submitted',
      manager_comments: 'Conference rooms HVAC off after 6 PM saved significant energy.',
      ai_summary: 'Today 3 HVAC units and 5 lighting circuits were automatically shut down, resulting in 8.6 kWh savings across Facilities.',
      energy_saved_kwh: 8.6,
      cost_saved: 1.72,
      optimizations_count: 8,
      report_data_json: {},
    });
  }
  console.log(`  ✅ ${store.optimizationReports.length} sample reports created`);

  console.log('\n🎉 Seeding complete!');
  console.log('\n📋 Demo Accounts:');
  console.log('  Employee:  proc.officer1@company.com / password123');
  console.log('  Manager:   ds.lead@company.com / password123');
  console.log('  Admin:     proc.admin@company.com / password123');
}

module.exports = { seed };

// Run directly
if (require.main === module) {
  seed();
  console.log('\nNote: Data is in-memory only. Run this within the server for persistence.');
}
