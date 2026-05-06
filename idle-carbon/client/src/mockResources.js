/**
 * mockResources.js — Role-Based Optimization Management Mock Data & Engine
 *
 * Provides:
 *  - Infrastructure resource mock data  (rooms, servers, backup nodes, DBs)
 *  - RBAC permission helpers
 *  - Live randomisation (call randomiseTick() every N seconds)
 *  - Optimization simulation functions
 *  - Optimization-request lifecycle  (pending → approved | rejected)
 *  - Security-alert mock data
 */

// Simple unique-id helper — no external dependency needed
const uuid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// ━━━━━━━ RESOURCE DEFINITIONS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Base catalogue — never mutated directly, used as template for live state */
const BASE_RESOURCES = [
  // ── Rooms (non-critical) ────────────────────────────────────────────────
  { id: 'room_b3',   name: 'Room B3',          type: 'Room',            category: 'room',    critical: false, occupancy: 0,  hvacStatus: 'ON',   idleTime: 120, energyConsumption: 3.2, cpuUsage: null,  status: 'Idle'    },
  { id: 'room_a1',   name: 'Room A1',          type: 'Room',            category: 'room',    critical: false, occupancy: 0,  hvacStatus: 'ON',   idleTime: 65,  energyConsumption: 2.8, cpuUsage: null,  status: 'Idle'    },
  { id: 'room_c2',   name: 'Conference C2',    type: 'Room',            category: 'room',    critical: false, occupancy: 0,  hvacStatus: 'ON',   idleTime: 45,  energyConsumption: 4.1, cpuUsage: null,  status: 'Idle'    },
  { id: 'room_d4',   name: 'Lab D4',           type: 'Room',            category: 'room',    critical: false, occupancy: 3,  hvacStatus: 'ON',   idleTime: 0,   energyConsumption: 3.5, cpuUsage: null,  status: 'Active'  },

  // ── Non-critical servers ────────────────────────────────────────────────
  { id: 'server_12', name: 'Server-12',        type: 'Server',          category: 'server',  critical: false, occupancy: null, hvacStatus: null, idleTime: 95,  energyConsumption: 4.5, cpuUsage: 3,   status: 'Running' },
  { id: 'server_07', name: 'Dev-Server-07',    type: 'Server',          category: 'server',  critical: false, occupancy: null, hvacStatus: null, idleTime: 180, energyConsumption: 3.8, cpuUsage: 1,   status: 'Running' },
  { id: 'vm_ci_05',  name: 'CI-Runner-05',     type: 'VM',              category: 'vm',      critical: false, occupancy: null, hvacStatus: null, idleTime: 75,  energyConsumption: 2.1, cpuUsage: 2,   status: 'Running' },
  { id: 'vm_stg_02', name: 'Staging-VM-02',    type: 'VM',              category: 'vm',      critical: false, occupancy: null, hvacStatus: null, idleTime: 240, energyConsumption: 2.9, cpuUsage: 4,   status: 'Running' },

  // ── Critical infrastructure (Admin-only) ────────────────────────────────
  { id: 'backup_node_1', name: 'Backup-Node-1',    type: 'Backup Server',    category: 'backup',   critical: true,  occupancy: null, hvacStatus: null, idleTime: 30, energyConsumption: 6.1, cpuUsage: 4,   status: 'Running' },
  { id: 'backup_node_2', name: 'Backup-Node-2',    type: 'Backup Server',    category: 'backup',   critical: true,  occupancy: null, hvacStatus: null, idleTime: 10, energyConsumption: 5.9, cpuUsage: 6,   status: 'Running' },
  { id: 'db_primary',    name: 'Database-Primary', type: 'Database Server',  category: 'database', critical: true,  occupancy: null, hvacStatus: null, idleTime: 0,  energyConsumption: 7.8, cpuUsage: 22,  status: 'Running' },
  { id: 'db_replica',    name: 'Database-Replica', type: 'Database Server',  category: 'database', critical: true,  occupancy: null, hvacStatus: null, idleTime: 0,  energyConsumption: 6.4, cpuUsage: 18,  status: 'Running' },
  { id: 'firewall_01',   name: 'Firewall-01',      type: 'Network Security', category: 'network',  critical: true,  occupancy: null, hvacStatus: null, idleTime: 0,  energyConsumption: 2.3, cpuUsage: 31,  status: 'Running' },
];

// ━━━━━━━ LIVE STATE  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Mutable live resource state — components get a copy via getResources() */
let liveResources = BASE_RESOURCES.map(r => ({ ...r, optimized: false, optimizationResult: null }));

/** Shallow-clone for React usage (avoids reference equality issues) */
export function getResources() {
  return liveResources.map(r => ({ ...r }));
}

/**
 * Randomise numeric fields slightly to simulate live sensor data.
 * Call every 10 seconds from a useEffect.
 */
export function randomiseTick() {
  liveResources = liveResources.map(r => {
    if (r.optimized) return r; // frozen after optimization
    const jitter = (base, range) => Math.round((base + (Math.random() - 0.5) * range) * 10) / 10;

    return {
      ...r,
      energyConsumption: Math.max(0.1, jitter(r.energyConsumption, 0.4)),
      cpuUsage:  r.cpuUsage  != null ? Math.max(0, Math.min(100, jitter(r.cpuUsage, 3)))  : null,
      idleTime:  r.idleTime  > 0     ? r.idleTime + 1                                     : r.idleTime,
    };
  });
}

// ━━━━━━━ RBAC ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const PERMISSIONS = {
  manager: {
    canOptimize:       (r) => !r.critical,
    canRequestOptimize:(r) => r.critical,
    canViewAll:        false,
    canApproveRequests:false,
    canViewAlerts:     false,
  },
  admin: {
    canOptimize:       () => true,
    canRequestOptimize:() => false,
    canViewAll:        true,
    canApproveRequests:true,
    canViewAlerts:     true,
  },
};

export function canOptimize(role, resource)        { return PERMISSIONS[role]?.canOptimize(resource) ?? false; }
export function canRequestOptimize(role, resource) { return PERMISSIONS[role]?.canRequestOptimize(resource) ?? false; }

// ━━━━━━━ IDLE / ZOMBIE DETECTION  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function getIdleResources(resources) {
  return resources.filter(r =>
    !r.optimized && (
      (r.category === 'room'   && r.occupancy === 0 && r.idleTime >= 30) ||
      (r.category === 'server' && r.cpuUsage != null && r.cpuUsage < 10 && r.idleTime > 60) ||
      (r.category === 'vm'     && r.cpuUsage != null && r.cpuUsage < 5)
    )
  );
}

export function getZombieResources(resources) {
  return resources.filter(r =>
    !r.optimized && r.status === 'Running' && (
      (r.category === 'vm'     && r.cpuUsage != null && r.cpuUsage < 5) ||
      (r.category === 'server' && r.idleTime > 120)                     ||
      (r.category === 'backup' && r.cpuUsage != null && r.cpuUsage < 8)
    )
  );
}

export function getZombieLabel(r) {
  if (r.category === 'vm'     && r.cpuUsage < 5)  return '🧟 Zombie VM';
  if (r.category === 'server' && r.idleTime > 120) return '💤 Sleeping Server';
  if (r.category === 'backup')                    return '⚡ Energy Vampire';
  return '🧟 Zombie';
}

// ━━━━━━━ OPTIMIZATION SIMULATION  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const OPT_ACTIONS = {
  room:     { action: 'HVAC turned OFF · Lights turned OFF',      kwhPerHour: 3.0 },
  server:   { action: 'Server moved to sleep mode',               kwhPerHour: 2.5 },
  vm:       { action: 'VM suspended · workload migrated',         kwhPerHour: 1.8 },
  backup:   { action: 'Backup node → low-power mode · CPU throttled · cooling reduced', kwhPerHour: 4.2 },
  database: { action: 'Replica queries rerouted · cooling reduced · non-essential tasks paused', kwhPerHour: 3.5 },
  network:  { action: 'Traffic-aware power scaling applied',      kwhPerHour: 1.0 },
};

/**
 * Simulate optimizing a resource.
 * Mutates liveResources and returns a result descriptor.
 */
export function optimizeResource(resourceId) {
  const idx = liveResources.findIndex(r => r.id === resourceId);
  if (idx === -1) return null;

  const r = liveResources[idx];
  const cfg = OPT_ACTIONS[r.category] || { action: 'Resource optimized', kwhPerHour: 1.5 };
  const idleHours = Math.max((r.idleTime || 60) / 60, 0.5);
  const energySaved = Math.round(cfg.kwhPerHour * idleHours * 100) / 100;
  const costSaved   = Math.round(energySaved * 0.20 * 100) / 100;

  const result = {
    resourceId: r.id,
    resourceName: r.name,
    action: cfg.action,
    energySaved,
    costSaved,
    timestamp: new Date().toISOString(),
  };

  liveResources[idx] = {
    ...r,
    optimized: true,
    optimizationResult: result,
    status: r.category === 'room' ? 'Idle (Optimized)' : 'Low-Power Mode',
    hvacStatus: r.category === 'room' ? 'OFF' : r.hvacStatus,
    energyConsumption: Math.round(r.energyConsumption * 0.15 * 10) / 10,
    cpuUsage: r.cpuUsage != null ? Math.round(r.cpuUsage * 0.1 * 10) / 10 : null,
  };

  optimizationLog.push(result);
  return result;
}

// Optimization history log (for manager reports)
let optimizationLog = [];
export function getOptimizationHistory() { return [...optimizationLog]; }
export function clearOptimizationHistory() { optimizationLog = []; }

// ━━━━━━━ OPTIMIZATION REQUESTS  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

let reqCounter = 100;
let optimizationRequests = [
  // Pre-seeded demo requests
  {
    request_id: 'REQ-098',
    manager_name: 'DS Team Lead',
    resource_id: 'backup_node_2',
    resource_name: 'Backup-Node-2',
    resource_type: 'Backup Server',
    issue_detected: 'CPU usage below 8% for 30+ minutes',
    suggested_action: 'Move to low-power sleep mode',
    status: 'Pending',
    created_at: new Date(Date.now() - 20 * 60000).toISOString(),
    resolved_at: null,
    rejected_reason: null,
  },
  {
    request_id: 'REQ-099',
    manager_name: 'Facilities Manager 1',
    resource_id: 'db_replica',
    resource_name: 'Database-Replica',
    resource_type: 'Database Server',
    issue_detected: 'Replica read traffic near zero for 1 hour',
    suggested_action: 'Reduce replica CPU allocation temporarily',
    status: 'Pending',
    created_at: new Date(Date.now() - 5 * 60000).toISOString(),
    resolved_at: null,
    rejected_reason: null,
  },
];

export function getOptimizationRequests() { return [...optimizationRequests]; }

export function createOptimizationRequest({ managerName, resource, issueDetected, suggestedAction }) {
  reqCounter += 1;
  const req = {
    request_id:      `REQ-${reqCounter}`,
    manager_name:    managerName,
    resource_id:     resource.id,
    resource_name:   resource.name,
    resource_type:   resource.type,
    issue_detected:  issueDetected,
    suggested_action: suggestedAction,
    status:          'Pending',
    created_at:      new Date().toISOString(),
    resolved_at:     null,
    rejected_reason: null,
  };
  optimizationRequests.unshift(req);
  return req;
}

export function approveRequest(requestId) {
  const req = optimizationRequests.find(r => r.request_id === requestId);
  if (!req) return null;
  req.status = 'Approved';
  req.resolved_at = new Date().toISOString();
  // Actually execute the optimization too
  const result = optimizeResource(req.resource_id);
  return { req, result };
}

export function rejectRequest(requestId, reason = 'Rejected by Admin') {
  const req = optimizationRequests.find(r => r.request_id === requestId);
  if (!req) return null;
  req.status = 'Rejected';
  req.resolved_at = new Date().toISOString();
  req.rejected_reason = reason;
  return req;
}

// ━━━━━━━ SECURITY ALERTS  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

let securityAlerts = [
  {
    id: 'alert-001',
    severity: 'critical',
    resource: 'Database-Primary',
    resource_id: 'db_primary',
    message: 'CPU spike to 98% detected — possible rogue process or abnormal load.',
    time: '02:15 AM',
    date: new Date(Date.now() - 6 * 3600000).toISOString(),
    acknowledged: false,
  },
  {
    id: 'alert-002',
    severity: 'warning',
    resource: 'Firewall-01',
    resource_id: 'firewall_01',
    message: 'Unusual outbound traffic pattern detected on port 4444. Possible unauthorized access.',
    time: '04:47 AM',
    date: new Date(Date.now() - 4 * 3600000).toISOString(),
    acknowledged: false,
  },
  {
    id: 'alert-003',
    severity: 'warning',
    resource: 'Backup-Node-1',
    resource_id: 'backup_node_1',
    message: 'Backup verification checksum mismatch on last 3 snapshots.',
    time: '07:30 AM',
    date: new Date(Date.now() - 2 * 3600000).toISOString(),
    acknowledged: false,
  },
  {
    id: 'alert-004',
    severity: 'info',
    resource: 'Database-Replica',
    resource_id: 'db_replica',
    message: 'Replication lag exceeded 30 seconds threshold for 5 minutes.',
    time: '09:12 AM',
    date: new Date(Date.now() - 45 * 60000).toISOString(),
    acknowledged: true,
  },
];

export function getSecurityAlerts() { return [...securityAlerts]; }

export function acknowledgeAlert(alertId) {
  const a = securityAlerts.find(x => x.id === alertId);
  if (a) a.acknowledged = true;
}

// Occasionally inject a new random alert (called from randomiseTick periodically)
let alertInjectionCounter = 0;
const RANDOM_ALERT_MSGS = [
  { resource: 'Database-Primary', msg: 'CPU usage spiked above 90% — monitoring closely.' },
  { resource: 'Firewall-01',      msg: 'SSH brute-force attempt blocked from external IP.' },
  { resource: 'Backup-Node-1',    msg: 'Storage utilization crossed 85% threshold.' },
];
export function maybeInjectAlert() {
  alertInjectionCounter++;
  if (alertInjectionCounter % 6 === 0) { // every ~60 s (6 × 10 s ticks)
    const tmpl = RANDOM_ALERT_MSGS[Math.floor(Math.random() * RANDOM_ALERT_MSGS.length)];
    const now = new Date();
    securityAlerts.unshift({
      id: `alert-${uuid().slice(0, 8)}`,
      severity: Math.random() > 0.5 ? 'warning' : 'critical',
      resource: tmpl.resource,
      resource_id: '',
      message: tmpl.msg,
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: now.toISOString(),
      acknowledged: false,
    });
    // Keep max 10 alerts
    if (securityAlerts.length > 10) securityAlerts.pop();
  }
}

// ━━━━━━━ REPORT BUILDER  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function buildOptimizationReport(resources) {
  const history = getOptimizationHistory();
  const idleDetected  = getIdleResources(resources).length + history.length;
  const zombieFixed   = history.filter(h => ['server','vm','backup'].includes(
    resources.find(r => r.id === h.resourceId)?.category || ''
  )).length;
  const totalEnergy   = history.reduce((s, h) => s + h.energySaved, 0);
  const totalCost     = history.reduce((s, h) => s + h.costSaved, 0);

  return {
    reportId:          `RPT-${Date.now()}`,
    generatedAt:       new Date().toISOString(),
    idleRoomsDetected: idleDetected,
    zombieResourcesFixed: zombieFixed + optimizationRequests.filter(r => r.status === 'Approved').length,
    totalEnergySavedKwh: Math.round((totalEnergy + optimizationRequests.filter(r => r.status === 'Approved').length * 3.5) * 100) / 100,
    totalCostSaved:      Math.round((totalCost   + optimizationRequests.filter(r => r.status === 'Approved').length * 0.70) * 100) / 100,
    optimizationsPerformed: history.length + optimizationRequests.filter(r => r.status === 'Approved').length,
    details: history,
  };
}
