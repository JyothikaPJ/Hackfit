/**
 * ResourceManager.jsx — Manager's Role-Based Optimization Dashboard
 *
 * • Live resource tiles (rooms, servers, VMs) updated every 10 s
 * • [Optimize] for non-critical resources  → animated result
 * • "⚠ Admin Authorization Required" / [Request Optimization]  for critical
 * • Idle Resource Monitor, Zombie Monitor, Energy Waste Summary sections
 * • Quick Optimization Report  (Generate → Download PDF / Submit to Admin)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getResources,
  randomiseTick,
  maybeInjectAlert,
  getIdleResources,
  canOptimize,
  canRequestOptimize,
  optimizeResource,
  createOptimizationRequest,
} from '../mockResources';
import { useAuth } from '../AuthContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmtKwh  = (n) => `${n.toFixed(1)} kWh`;
const fmtCost = (n) => `$${n.toFixed(2)}`;
const elapsedLabel = (minutes) =>
  minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;

const TYPE_ICON = { Room: '🏢', Server: '🖥', VM: '☁️', 'Backup Server': '💾', 'Database Server': '🗄', 'Network Security': '🔒' };
const CRIT_COLOR = 'rgba(239,68,68,0.12)';
// Steps shown when optimizing each resource category
const OPT_STEPS = {
  room:     [
    { icon: '🔍', text: 'Verifying zero occupancy...' },
    { icon: '🌡', text: 'Sending HVAC shutdown command...' },
    { icon: '💡', text: 'Turning off lighting circuits...' },
    { icon: '📺', text: 'Putting AV equipment on standby...' },
  ],
  server:   [
    { icon: '🔍', text: 'Checking for active sessions...' },
    { icon: '🔌', text: 'Draining connections...' },
    { icon: '💤', text: 'Initiating sleep mode (ACPI S3)...' },
    { icon: '⚡', text: 'Cutting non-essential power rails...' },
  ],
  vm:       [
    { icon: '🔍', text: 'Validating low CPU metrics...' },
    { icon: '📦', text: 'Draining active workloads...' },
    { icon: '💾', text: 'Snapshotting VM state...' },
    { icon: '⏸', text: 'Suspending VM instance...' },
  ],
  backup:   [
    { icon: '🔍', text: 'Checking backup schedule...' },
    { icon: '⚙', text: 'Throttling CPU via cgroup limits...' },
    { icon: '❄', text: 'Reducing cooling fan speed...' },
    { icon: '📅', text: 'Rescheduling jobs to off-peak hours...' },
  ],
  database: [
    { icon: '🔍', text: 'Checking replica read traffic...' },
    { icon: '🔀', text: 'Rerouting queries to primary via HAProxy...' },
    { icon: '⬇', text: 'Reducing replica CPU allocation...' },
    { icon: '⏸', text: 'Pausing non-critical replication tasks...' },
  ],
  network:  [
    { icon: '🔍', text: 'Analysing live traffic patterns...' },
    { icon: '📊', text: 'Applying traffic-aware power scaling...' },
    { icon: '✅', text: 'Firewall running in efficient mode...' },
  ],
};const CRIT_BORDER = 'rgba(239,68,68,0.35)';

// ─── Resource Card ─────────────────────────────────────────────────────────
function ResourceCard({ resource, role, onOptimize, onRequest, optimizing, requesting, optSteps }) {
  const res   = resource;
  const icon  = TYPE_ICON[res.type] || '📦';
  const isCrit = res.critical;
  const isOpt  = res.optimized;

  const cardStyle = {
    borderRadius: 14,
    padding: '1.2rem 1.4rem',
    border: `1px solid ${isCrit ? CRIT_BORDER : 'rgba(255,255,255,0.07)'}`,
    background: isCrit
      ? CRIT_COLOR
      : isOpt
        ? 'rgba(16,185,129,0.07)'
        : 'rgba(20,20,35,0.85)',
    transition: 'all 0.3s',
    position: 'relative',
  };

  return (
    <div style={cardStyle}>
      {/* Critical badge */}
      {isCrit && (
        <div style={{ position: 'absolute', top: 10, right: 12, fontSize: '0.7rem', fontWeight: 700,
          background: 'rgba(239,68,68,0.2)', color: '#F87171', padding: '2px 8px', borderRadius: 20,
          border: '1px solid rgba(239,68,68,0.3)' }}>
          🔒 CRITICAL
        </div>
      )}
      {isOpt && (
        <div style={{ position: 'absolute', top: 10, right: 12, fontSize: '0.7rem', fontWeight: 700,
          background: 'rgba(16,185,129,0.2)', color: '#10B981', padding: '2px 8px', borderRadius: 20 }}>
          ✅ OPTIMIZED
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.8rem' }}>
        <span style={{ fontSize: '1.6rem' }}>{icon}</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#ddd' }}>{res.name}</div>
          <div style={{ fontSize: '0.72rem', color: '#888', marginTop: '1px' }}>{res.type}</div>
        </div>
      </div>

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem 1rem', fontSize: '0.8rem', marginBottom: '0.9rem' }}>
        <MetricRow label="Energy" value={`${res.energyConsumption.toFixed(1)} kWh`} accent={res.energyConsumption > 5} />
        {res.category === 'room' ? (
          <>
            <MetricRow label="Occupancy" value={`${res.occupancy} people`} />
            <MetricRow label="Idle Time"  value={res.idleTime > 0 ? elapsedLabel(res.idleTime) : '—'} accent={res.idleTime > 60} />
            <MetricRow label="HVAC"       value={res.hvacStatus} accent={res.hvacStatus === 'ON' && res.occupancy === 0} />
          </>
        ) : (
          <>
            <MetricRow label="CPU"        value={res.cpuUsage != null ? `${res.cpuUsage.toFixed(0)}%` : '—'} accent={!isCrit && res.cpuUsage < 10} />
            <MetricRow label="Idle Time"  value={res.idleTime > 0 ? elapsedLabel(res.idleTime) : '—'} />
            <MetricRow label="Status"     value={res.status} />
          </>
        )}
      </div>

      {/* Optimization result */}
      {isOpt && res.optimizationResult && (
        <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
          borderRadius: 8, padding: '0.6rem 0.9rem', marginBottom: '0.7rem', fontSize: '0.82rem' }}>
          <div style={{ color: '#10B981', fontWeight: 700, marginBottom: '0.4rem' }}>✅ Optimization Complete</div>
          {/* Show all steps taken */}
          {(optSteps?.[res.id] || []).map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem',
              color: '#aaa', fontSize: '0.78rem', marginBottom: '0.2rem' }}>
              <span>{s.icon}</span><span>{s.text}</span>
              <span style={{ marginLeft: 'auto', color: '#10B981', fontSize: '0.72rem' }}>✔</span>
            </div>
          ))}
          <div style={{ color: '#34D399', fontWeight: 600, marginTop: '0.5rem', borderTop: '1px solid rgba(16,185,129,0.15)', paddingTop: '0.4rem' }}>
            ⚡ {fmtKwh(res.optimizationResult.energySaved)} saved &nbsp;·&nbsp; 💰 {fmtCost(res.optimizationResult.costSaved)} recovered
          </div>
        </div>
      )}

      {/* Step log while optimizing */}
      {!isOpt && optimizing[res.id] && (optSteps?.[res.id] || []).length > 0 && (
        <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8,
          padding: '0.55rem 0.75rem', marginBottom: '0.6rem',
          display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.78rem' }}>
          {(optSteps[res.id] || []).map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#ccc' }}>
              <span>{s.icon}</span><span>{s.text}</span>
              <span style={{ marginLeft: 'auto', color: '#10B981' }}>✔</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#888' }}>
            <span className="opt-spinner" style={{ width: 10, height: 10, borderWidth: 2 }}></span>
            <span>Applying changes...</span>
          </div>
        </div>
      )}

      {/* Actions */}
      {!isOpt && (
        <>
          {/* Non-critical: Optimize directly */}
          {canOptimize(role, res) && (
            <button
              onClick={() => onOptimize(res.id)}
              disabled={optimizing[res.id]}
              style={{
                width: '100%', padding: '0.55rem', borderRadius: 9, border: 'none',
                background: optimizing[res.id] ? 'rgba(16,185,129,0.1)' : 'linear-gradient(135deg,#10B981,#059669)',
                color: optimizing[res.id] ? '#10B981' : '#fff',
                fontWeight: 700, cursor: optimizing[res.id] ? 'default' : 'pointer', fontSize: '0.85rem',
                transition: 'all 0.2s',
              }}>
              {optimizing[res.id] ? '⏳ Optimizing…' : '⚡ Optimize'}
            </button>
          )}

          {/* Critical: Request only */}
          {canRequestOptimize(role, res) && (
            <div>
              <div style={{ fontSize: '0.78rem', color: '#F87171', background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '0.45rem 0.7rem',
                marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                ⚠ Admin Authorization Required
              </div>
              <button
                onClick={() => onRequest(res)}
                disabled={requesting[res.id]}
                style={{
                  width: '100%', padding: '0.5rem', borderRadius: 9,
                  border: '1px solid rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.1)',
                  color: requesting[res.id] ? '#888' : '#F59E0B',
                  fontWeight: 700, cursor: requesting[res.id] ? 'default' : 'pointer', fontSize: '0.82rem',
                }}>
                {requesting[res.id] ? '✅ Request Sent' : '📨 Request Optimization'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MetricRow({ label, value, accent }) {
  return (
    <div>
      <span style={{ color: '#666', fontSize: '0.72rem' }}>{label}: </span>
      <span style={{ color: accent ? '#F59E0B' : '#ccc', fontWeight: accent ? 700 : 400 }}>{value}</span>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────
export default function ResourceManager() {
  const { user } = useAuth();
  const role = user?.role || 'manager';
  const navigate = useNavigate();

  const [resources, setResources] = useState(() => getResources());
  const [optimizing, setOptimizing] = useState({});
  const [requesting, setRequesting] = useState({});
  const [optSteps, setOptSteps] = useState({});
  const [tab, setTab] = useState('idle'); // idle | energy

  // Live tick every 10 s
  useEffect(() => {
    const id = setInterval(() => {
      randomiseTick();
      maybeInjectAlert();
      setResources(getResources());
    }, 10000);
    return () => clearInterval(id);
  }, []);

  // ── optimize ──────────────────────────────────────────────────────────────
  const handleOptimize = useCallback((id) => {
    setOptimizing(prev => ({ ...prev, [id]: true }));
    setOptSteps(prev => ({ ...prev, [id]: [] }));

    const resource = getResources().find(r => r.id === id);
    const steps = OPT_STEPS[resource?.category] || [{ icon: '⚙', text: 'Applying optimization...' }];

    // Reveal steps one by one
    steps.forEach((step, i) => {
      setTimeout(() => {
        setOptSteps(prev => ({
          ...prev,
          [id]: [...(prev[id] || []), step],
        }));
      }, 300 + i * 450);
    });

    // Commit after all steps
    setTimeout(() => {
      optimizeResource(id);
      setResources(getResources());
      setOptimizing(prev => ({ ...prev, [id]: false }));
    }, 300 + steps.length * 450 + 300);
  }, []);

  // ── request ───────────────────────────────────────────────────────────────
  const handleRequest = useCallback((resource) => {
    createOptimizationRequest({
      managerName: user?.name || 'Manager',
      resource,
      issueDetected: resource.cpuUsage != null
        ? `Low CPU usage (${resource.cpuUsage?.toFixed(0)}%) detected for ${elapsedLabel(resource.idleTime)}`
        : `Idle for ${elapsedLabel(resource.idleTime)} with no occupancy`,
      suggestedAction: resource.category === 'backup' ? 'Move to low-power sleep mode' : 'Throttle CPU & reduce cooling',
    });
    setRequesting(prev => ({ ...prev, [resource.id]: true }));
  }, [user]);

  // ── derive current data ───────────────────────────────────────────────────
  const idleResources   = getIdleResources(resources);
  const optimizedList   = resources.filter(r => r.optimized);

  const totalSavedKwh  = optimizedList.reduce((s, r) => s + (r.optimizationResult?.energySaved || 0), 0);
  const totalSavedCost = optimizedList.reduce((s, r) => s + (r.optimizationResult?.costSaved  || 0), 0);

  // Energy chart data
  const energyChartData = resources
    .filter(r => !r.critical)
    .map(r => ({ name: r.name.replace(/-/g,' ').slice(0,10), kwh: r.energyConsumption }))
    .sort((a,b) => b.kwh - a.kwh)
    .slice(0, 8);


  const TABS = [
    { id: 'idle',   label: `🏙 Idle Resources (${idleResources.length})` },
    { id: 'energy', label: '⚡ Energy Waste'                                },
  ];

  return (
    <div className="dashboard">
      {/* ── Header ── */}
      <div style={{ marginBottom: '1.4rem' }}>
        <h2>🛡 Resource Optimization Manager</h2>
        <p className="subtitle">Monitor, optimize non-critical resources · Request Admin approval for critical infrastructure</p>
      </div>

      {/* ── KPI Strip ── */}
      <div className="stats-grid">
        <div className="stat-card orange"><div className="stat-icon">🏚</div><div className="stat-value">{idleResources.length}</div><div className="stat-label">Idle Resources</div></div>
        <div className="stat-card green"><div className="stat-icon">🌿</div><div className="stat-value">{fmtKwh(totalSavedKwh)}</div><div className="stat-label">Energy Saved Today</div></div>
        <div className="stat-card blue"><div className="stat-icon">💰</div><div className="stat-value">{fmtCost(totalSavedCost)}</div><div className="stat-label">Cost Saved Today</div></div>
      </div>

      {/* ── Tab Bar ── */}
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.2rem', flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: '0.5rem 1.1rem', borderRadius: 10, border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: '0.83rem', transition: 'all 0.2s',
              background: tab === t.id ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.04)',
              color:      tab === t.id ? '#10B981'               : '#888',
              borderBottom: tab === t.id ? '2px solid #10B981' : '2px solid transparent',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ━━━━ TAB: IDLE RESOURCES ━━━━ */}
      {tab === 'idle' && (
        <>
          <p style={{ color: '#666', fontSize: '0.82rem', marginBottom: '1rem' }}>
            Resources idle for ≥ 30 min · Non-critical resources can be optimized directly.
          </p>
          {idleResources.length === 0 ? (
            <div className="panel" style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.8rem' }}>✅</div>
              <p>No idle resources detected right now.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {idleResources.map(r => (
                <ResourceCard key={r.id} resource={r} role={role}
                  onOptimize={handleOptimize} onRequest={handleRequest}
                  optimizing={optimizing} requesting={requesting} optSteps={optSteps} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ━━━━ TAB: ENERGY WASTE ━━━━ */}
      {tab === 'energy' && (
        <>
          <div className="panel-grid">
            <div className="panel">
              <h3>⚡ Energy Consumption by Resource (kWh)</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={energyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="name" stroke="#aaa" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#aaa" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#1e1e2e', border: '1px solid #333', borderRadius: 8 }} />
                  <Bar dataKey="kwh" fill="#F59E0B" radius={[4,4,0,0]} name="kWh" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="panel">
              <h3>📋 Waste Summary</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {resources.filter(r => !r.critical && !r.optimized).map(r => (
                  <div key={r.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.6rem 0.8rem', borderRadius: 8, background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.05)',
                  }}>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ddd' }}>{r.name}</div>
                      <div style={{ fontSize: '0.72rem', color: '#888' }}>{r.type}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: '#F59E0B', fontWeight: 700, fontSize: '0.9rem' }}>{r.energyConsumption.toFixed(1)} kWh</div>
                      <div style={{ color: '#888', fontSize: '0.72rem' }}>${(r.energyConsumption * 0.2).toFixed(2)}/hr</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="panel">
            <h3>✅ Optimized Resources</h3>
            {optimizedList.length === 0 ? (
              <p style={{ color: '#666', fontSize: '0.85rem' }}>No resources optimized yet — go to the Idle tab to start.</p>
            ) : (
              <table className="data-table">
                <thead><tr>
                  <th>Resource</th><th>Type</th><th>Action</th><th>Energy Saved</th><th>Cost Saved</th><th>Time</th>
                </tr></thead>
                <tbody>
                  {optimizedList.map(r => (
                    <tr key={r.id}>
                      <td><strong>{r.name}</strong></td>
                      <td><span className="badge badge-cloud">{r.type}</span></td>
                      <td style={{ color: '#60A5FA', fontSize: '0.8rem' }}>{r.optimizationResult?.action}</td>
                      <td style={{ color: '#10B981', fontWeight: 600 }}>{fmtKwh(r.optimizationResult?.energySaved || 0)}</td>
                      <td style={{ color: '#34D399' }}>{fmtCost(r.optimizationResult?.costSaved || 0)}</td>
                      <td style={{ color: '#888', fontSize: '0.78rem' }}>{new Date(r.optimizationResult?.timestamp).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ━━━━ REPORT BANNER ━━━━ */}
      <div style={{ marginTop: '1.5rem', padding: '1rem 1.4rem',
        background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)',
        borderRadius: 12, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.8rem' }}>
        <div>
          <div style={{ fontWeight: 700, color: '#e0e0e0', marginBottom: '0.2rem' }}>📊 Optimization Report</div>
          <div style={{ fontSize: '0.82rem', color: '#888' }}>
            Generate a full report with charts, AI summary, PDF export and admin submission.
          </div>
        </div>
        <button onClick={() => navigate('/reports')}
          style={{ padding: '0.6rem 1.4rem', borderRadius: 9, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg,#10B981,#059669)', color: '#fff',
            fontWeight: 700, fontSize: '0.85rem' }}>
          → Open Full Report
        </button>
      </div>
    </div>
  );
}
