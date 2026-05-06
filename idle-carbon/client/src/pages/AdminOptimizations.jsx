/**
 * AdminOptimizations.jsx — Admin Role-Based Optimization Control Center
 *
 * • Critical Resource Monitor  (live, randomised every 10 s)
 * • Optimization Requests panel  (Approve → executes optimization | Reject)
 * • Security Alerts panel with severity badges + acknowledge
 * • All-resource table for full visibility
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getResources,
  randomiseTick,
  maybeInjectAlert,
  getOptimizationRequests,
  approveRequest,
  rejectRequest,
  getSecurityAlerts,
  acknowledgeAlert,
  optimizeResource,
} from '../mockResources';

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmtKwh  = (n) => `${(+n).toFixed(1)} kWh`;
const fmtCost = (n) => `$${(+n).toFixed(2)}`;
const elapsed = (iso) => {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  return mins >= 60 ? `${Math.floor(mins/60)}h ${mins%60}m ago` : `${mins}m ago`;
};

const SEV_CFG = {
  critical: { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.35)',  color: '#F87171', label: '🔴 Critical' },
  warning:  { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.30)', color: '#FBBF24', label: '🟡 Warning'  },
  info:     { bg: 'rgba(59,130,246,0.10)', border: 'rgba(59,130,246,0.25)', color: '#60A5FA', label: '🔵 Info'     },
};

const CAT_ICON = { room: '🏢', server: '🖥', vm: '☁️', backup: '💾', database: '🗄', network: '🔒' };

// ─── Sections tabs ────────────────────────────────────────────────────────────
const TABS = [
  { id: 'requests', label: '📨 Requests'          },
  { id: 'critical', label: '🔒 Critical Resources' },
  { id: 'alerts',   label: '🚨 Security Alerts'   },
  { id: 'all',      label: '📋 All Resources'      },
];

// ─── Request Card ─────────────────────────────────────────────────────────────
function RequestCard({ req, onApprove, onReject, loading }) {
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason]         = useState('');

  const isPending  = req.status === 'Pending';
  const isApproved = req.status === 'Approved';
  const isRejected = req.status === 'Rejected';

  const statusStyle = {
    Pending:  { bg: 'rgba(245,158,11,0.15)',  color: '#FBBF24' },
    Approved: { bg: 'rgba(16,185,129,0.15)',  color: '#10B981' },
    Rejected: { bg: 'rgba(239,68,68,0.15)',   color: '#F87171' },
  }[req.status] || {};

  return (
    <div style={{
      borderRadius: 14, padding: '1.2rem 1.4rem',
      background: 'rgba(20,20,35,0.85)', border: '1px solid rgba(255,255,255,0.07)',
      borderLeft: `4px solid ${isPending ? '#F59E0B' : isApproved ? '#10B981' : '#EF4444'}`,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.8rem' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#aaa', marginBottom: '0.15rem' }}>
            {req.request_id} · <span style={{ color: '#888' }}>{elapsed(req.created_at)}</span>
          </div>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: '#ddd' }}>{req.resource_name}</div>
          <div style={{ fontSize: '0.78rem', color: '#888' }}>{req.resource_type}</div>
        </div>
        <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700,
          background: statusStyle.bg, color: statusStyle.color }}>
          {req.status}
        </span>
      </div>

      {/* Details */}
      <div style={{ fontSize: '0.82rem', marginBottom: '0.9rem', lineHeight: 1.6 }}>
        <div><span style={{ color: '#888' }}>Manager: </span><strong style={{ color: '#ddd' }}>{req.manager_name}</strong></div>
        <div><span style={{ color: '#888' }}>Issue: </span><span style={{ color: '#F59E0B' }}>{req.issue_detected}</span></div>
        <div><span style={{ color: '#888' }}>Suggested: </span><span style={{ color: '#60A5FA' }}>{req.suggested_action}</span></div>
        {req.rejected_reason && (
          <div style={{ marginTop: '0.4rem' }}><span style={{ color: '#888' }}>Reason: </span><span style={{ color: '#F87171' }}>{req.rejected_reason}</span></div>
        )}
      </div>

      {/* Approved result */}
      {isApproved && req.result && (
        <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
          borderRadius: 8, padding: '0.6rem 0.9rem', marginBottom: '0.7rem', fontSize: '0.82rem' }}>
          <div style={{ color: '#10B981', fontWeight: 700, marginBottom: '0.25rem' }}>✅ Optimization Executed</div>
          <div style={{ color: '#aaa' }}>{req.result.action}</div>
          <div style={{ color: '#34D399', fontWeight: 600, marginTop: '0.2rem' }}>
            {fmtKwh(req.result.energySaved)} saved · {fmtCost(req.result.costSaved)}
          </div>
        </div>
      )}

      {/* Actions */}
      {isPending && (
        showReject ? (
          <div>
            <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Rejection reason (optional)"
              style={{ width: '100%', padding: '0.5rem 0.8rem', borderRadius: 8, marginBottom: '0.5rem',
                border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#ccc', fontSize: '0.82rem' }}
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => onReject(req.request_id, reason || 'Rejected by Admin')} disabled={loading}
                className="btn-dismiss" style={{ flex: 1 }}>
                Confirm Reject
              </button>
              <button onClick={() => setShowReject(false)} style={{ flex: 1, padding: '0.4rem', borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#888', cursor: 'pointer', fontSize: '0.8rem' }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => onApprove(req.request_id)} disabled={loading}
              className="btn-approve" style={{ flex: 1 }}>
              {loading ? '⏳ Executing…' : '✅ Approve & Execute'}
            </button>
            <button onClick={() => setShowReject(true)} className="btn-dismiss" style={{ flex: 1 }}>
              ✕ Reject
            </button>
          </div>
        )
      )}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────
export default function AdminOptimizations() {
  const [resources, setResources]   = useState(() => getResources());
  const [requests, setRequests]     = useState(() => getOptimizationRequests());
  const [alerts, setAlerts]         = useState(() => getSecurityAlerts());
  const [tab, setTab]               = useState('requests');
  const [loading, setLoading]       = useState({});
  const [directOpt, setDirectOpt]   = useState({});

  // Live tick every 10 s
  useEffect(() => {
    const id = setInterval(() => {
      randomiseTick();
      maybeInjectAlert();
      setResources(getResources());
      setRequests(getOptimizationRequests());
      setAlerts(getSecurityAlerts());
    }, 10000);
    return () => clearInterval(id);
  }, []);

  // ── approve ───────────────────────────────────────────────────────────────
  const handleApprove = useCallback((requestId) => {
    setLoading(prev => ({ ...prev, [requestId]: true }));
    setTimeout(() => {
      const outcome = approveRequest(requestId);
      if (outcome) {
        // Save result onto the request for display
        const req = getOptimizationRequests().find(r => r.request_id === requestId);
        if (req) req.result = outcome.result;
      }
      setRequests(getOptimizationRequests());
      setResources(getResources());
      setLoading(prev => ({ ...prev, [requestId]: false }));
    }, 1800);
  }, []);

  // ── reject ────────────────────────────────────────────────────────────────
  const handleReject = useCallback((requestId, reason) => {
    rejectRequest(requestId, reason);
    setRequests(getOptimizationRequests());
  }, []);

  // ── direct optimize (admin can do anything) ───────────────────────────────
  const handleDirectOptimize = useCallback((id) => {
    setDirectOpt(prev => ({ ...prev, [id]: true }));
    setTimeout(() => {
      optimizeResource(id);
      setResources(getResources());
      setDirectOpt(prev => ({ ...prev, [id]: false }));
    }, 1400);
  }, []);

  // ── acknowledge alert ─────────────────────────────────────────────────────
  const handleAcknowledge = useCallback((id) => {
    acknowledgeAlert(id);
    setAlerts(getSecurityAlerts());
  }, []);

  // Derived
  const criticalResources = resources.filter(r => r.critical);
  const pendingRequests   = requests.filter(r => r.status === 'Pending');
  const unresolvedAlerts  = alerts.filter(a => !a.acknowledged);
  const allTabs = TABS.map(t => {
    let badge = null;
    if (t.id === 'requests') badge = pendingRequests.length;
    if (t.id === 'alerts')   badge = unresolvedAlerts.length;
    return { ...t, badge };
  });

  // Totals
  const approvedReqs     = requests.filter(r => r.status === 'Approved');
  const totalSavedKwh    = resources.filter(r => r.optimized).reduce((s, r) => s + (r.optimizationResult?.energySaved || 0), 0);
  const totalSavedCost   = resources.filter(r => r.optimized).reduce((s, r) => s + (r.optimizationResult?.costSaved  || 0), 0);

  return (
    <div className="dashboard">
      <h2>🔐 Admin Optimization Control Center</h2>
      <p className="subtitle">Approve requests · Manage critical infrastructure · Monitor security alerts</p>

      {/* ── KPIs ── */}
      <div className="stats-grid">
        <div className="stat-card orange"><div className="stat-icon">📨</div><div className="stat-value">{pendingRequests.length}</div><div className="stat-label">Pending Requests</div></div>
        <div className="stat-card purple"><div className="stat-icon">🔒</div><div className="stat-value">{criticalResources.length}</div><div className="stat-label">Critical Resources</div></div>
        <div className="stat-card red" style={{ background:'rgba(20,20,35,0.8)', border:'1px solid rgba(255,255,255,0.06)' }}>
          <div className="stat-icon">🚨</div><div className="stat-value" style={{ color:'#F87171' }}>{unresolvedAlerts.length}</div><div className="stat-label">Unresolved Alerts</div>
        </div>
        <div className="stat-card green"><div className="stat-icon">🌿</div><div className="stat-value">{fmtKwh(totalSavedKwh)}</div><div className="stat-label">Total Energy Saved</div></div>
      </div>

      {/* ── Tab Bar ── */}
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.2rem', flexWrap: 'wrap' }}>
        {allTabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: '0.5rem 1.1rem', borderRadius: 10, border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: '0.83rem', transition: 'all 0.2s', position: 'relative',
              background: tab === t.id ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.04)',
              color:      tab === t.id ? '#10B981'               : '#888',
              borderBottom: tab === t.id ? '2px solid #10B981' : '2px solid transparent',
            }}>
            {t.label}
            {t.badge > 0 && (
              <span style={{ marginLeft: '0.5rem', background: '#EF4444', color: '#fff',
                borderRadius: 20, padding: '1px 7px', fontSize: '0.68rem', fontWeight: 800 }}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ━━━━ TAB: REQUESTS ━━━━ */}
      {tab === 'requests' && (
        <>
          {requests.length === 0 ? (
            <div className="panel" style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.8rem' }}>📭</div>
              <p>No optimization requests yet.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px,1fr))', gap: '1rem' }}>
              {requests.map(req => (
                <RequestCard key={req.request_id} req={req}
                  onApprove={handleApprove} onReject={handleReject}
                  loading={loading[req.request_id]} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ━━━━ TAB: CRITICAL RESOURCES ━━━━ */}
      {tab === 'critical' && (
        <>
          <p style={{ color: '#666', fontSize: '0.82rem', marginBottom: '1rem' }}>
            Only Admins can directly optimize critical infrastructure.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px,1fr))', gap: '1rem' }}>
            {criticalResources.map(r => {
              const isOpt = r.optimized;
              return (
                <div key={r.id} style={{
                  borderRadius: 14, padding: '1.2rem 1.4rem',
                  background: isOpt ? 'rgba(16,185,129,0.07)' : 'rgba(20,20,35,0.85)',
                  border: `1px solid ${isOpt ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                  borderLeft: `4px solid ${isOpt ? '#10B981' : '#EF4444'}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span style={{ fontSize: '1.6rem' }}>{CAT_ICON[r.category]}</span>
                      <div>
                        <div style={{ fontWeight: 700, color: '#ddd' }}>{r.name}</div>
                        <div style={{ fontSize: '0.72rem', color: '#888' }}>{r.type}</div>
                      </div>
                    </div>
                    {isOpt
                      ? <span style={{ fontSize: '0.72rem', background: 'rgba(16,185,129,0.2)', color: '#10B981', padding: '2px 9px', borderRadius: 20, fontWeight: 700 }}>✅ Optimized</span>
                      : <span style={{ fontSize: '0.72rem', background: 'rgba(239,68,68,0.15)', color: '#F87171', padding: '2px 9px', borderRadius: 20, fontWeight: 700 }}>🔒 Critical</span>
                    }
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem 1rem', fontSize: '0.8rem', marginBottom: '0.9rem' }}>
                    <div><span style={{ color:'#666' }}>Energy: </span><span style={{ color: r.energyConsumption > 6 ? '#F59E0B' : '#ccc', fontWeight: r.energyConsumption > 6 ? 700 : 400 }}>{r.energyConsumption.toFixed(1)} kWh</span></div>
                    {r.cpuUsage != null && <div><span style={{ color:'#666' }}>CPU: </span><span style={{ color: r.cpuUsage > 80 ? '#F87171' : r.cpuUsage < 10 ? '#FBBF24' : '#ccc', fontWeight: 600 }}>{r.cpuUsage.toFixed(0)}%</span></div>}
                    <div><span style={{ color:'#666' }}>Status: </span><span style={{ color:'#ccc' }}>{r.status}</span></div>
                    {r.idleTime > 0 && <div><span style={{ color:'#666' }}>Idle: </span><span style={{ color: r.idleTime > 30 ? '#FBBF24' : '#ccc' }}>{r.idleTime}m</span></div>}
                  </div>

                  {isOpt && r.optimizationResult && (
                    <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
                      borderRadius: 8, padding: '0.6rem', marginBottom: '0.6rem', fontSize: '0.8rem' }}>
                      <div style={{ color: '#10B981', fontWeight: 700 }}>✅ Optimization Complete</div>
                      <div style={{ color: '#aaa', marginTop: '0.2rem' }}>{r.optimizationResult.action}</div>
                      <div style={{ color: '#34D399', fontWeight: 600, marginTop: '0.2rem' }}>
                        Saved: {fmtKwh(r.optimizationResult.energySaved)} · {fmtCost(r.optimizationResult.costSaved)}
                      </div>
                    </div>
                  )}

                  {!isOpt && (
                    <button onClick={() => handleDirectOptimize(r.id)} disabled={directOpt[r.id]}
                      style={{
                        width: '100%', padding: '0.55rem', borderRadius: 9, border: 'none', cursor: 'pointer',
                        background: directOpt[r.id] ? 'rgba(239,68,68,0.1)' : 'linear-gradient(135deg,#EF4444,#DC2626)',
                        color: directOpt[r.id] ? '#F87171' : '#fff', fontWeight: 700, fontSize: '0.85rem',
                      }}>
                      {directOpt[r.id] ? '⏳ Optimizing…' : '🔐 Execute Optimization (Admin Only)'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ━━━━ TAB: SECURITY ALERTS ━━━━ */}
      {tab === 'alerts' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <p style={{ color: '#666', fontSize: '0.82rem' }}>
              Anomalies auto-detected across critical infrastructure · New alerts injected every ~60 s (demo).
            </p>
            <span style={{ fontSize: '0.78rem', color: '#888', background: 'rgba(255,255,255,0.05)', padding: '3px 10px', borderRadius: 20 }}>
              {unresolvedAlerts.length} unresolved
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            {alerts.map(a => {
              const cfg = SEV_CFG[a.severity] || SEV_CFG.info;
              return (
                <div key={a.id} style={{
                  borderRadius: 12, padding: '1.1rem 1.3rem',
                  background: a.acknowledged ? 'rgba(255,255,255,0.02)' : cfg.bg,
                  border: `1px solid ${a.acknowledged ? 'rgba(255,255,255,0.05)' : cfg.border}`,
                  opacity: a.acknowledged ? 0.55 : 1, transition: 'all 0.3s',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: cfg.color, background: cfg.bg,
                          border: `1px solid ${cfg.border}`, padding: '2px 9px', borderRadius: 20 }}>
                          {cfg.label}
                        </span>
                        <span style={{ fontSize: '0.78rem', color: '#888' }}>{a.time} · {elapsed(a.date)}</span>
                      </div>
                      <div style={{ fontWeight: 700, color: '#ddd', marginBottom: '0.3rem' }}>
                        {CAT_ICON[getResources().find(r => r.id === a.resource_id)?.category] || '⚠'} {a.resource}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#bbb', lineHeight: 1.5 }}>{a.message}</div>
                    </div>
                    {!a.acknowledged && (
                      <button onClick={() => handleAcknowledge(a.id)}
                        style={{ marginLeft: '1rem', padding: '0.4rem 0.9rem', borderRadius: 8, flexShrink: 0,
                          border: `1px solid ${cfg.border}`, background: cfg.bg, color: cfg.color,
                          cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        ✓ Acknowledge
                      </button>
                    )}
                    {a.acknowledged && (
                      <span style={{ marginLeft: '1rem', fontSize: '0.75rem', color: '#555', flexShrink: 0 }}>Acknowledged</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ━━━━ TAB: ALL RESOURCES ━━━━ */}
      {tab === 'all' && (
        <div className="panel">
          <h3>📋 Full Infrastructure Inventory</h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Resource</th><th>Type</th><th>Critical</th>
                  <th>Energy (kWh)</th><th>CPU %</th><th>Status</th>
                  <th>Idle Time</th><th>State</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {resources.map(r => (
                  <tr key={r.id}>
                    <td><strong>{r.name}</strong></td>
                    <td>
                      <span style={{ fontSize: '0.75rem', padding: '2px 7px', borderRadius: 6,
                        background: r.critical ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.12)',
                        color: r.critical ? '#F87171' : '#60A5FA', fontWeight: 600 }}>
                        {r.type}
                      </span>
                    </td>
                    <td style={{ color: r.critical ? '#F87171' : '#10B981', fontWeight: 700 }}>
                      {r.critical ? '🔒 Yes' : '✓ No'}
                    </td>
                    <td style={{ color: r.energyConsumption > 6 ? '#F59E0B' : '#ccc', fontWeight: r.energyConsumption > 6 ? 700 : 400 }}>
                      {r.energyConsumption.toFixed(1)}
                    </td>
                    <td style={{ color: r.cpuUsage != null && r.cpuUsage > 80 ? '#F87171' : r.cpuUsage != null && r.cpuUsage < 10 ? '#FBBF24' : '#ccc', fontWeight: 600 }}>
                      {r.cpuUsage != null ? `${r.cpuUsage.toFixed(0)}%` : '—'}
                    </td>
                    <td style={{ color: '#888', fontSize: '0.82rem' }}>{r.status}</td>
                    <td style={{ color: r.idleTime > 60 ? '#F59E0B' : '#888', fontSize: '0.82rem' }}>
                      {r.idleTime > 0 ? `${r.idleTime}m` : '—'}
                    </td>
                    <td>
                      {r.optimized ? (
                        <span style={{ fontSize: '0.75rem', background: 'rgba(16,185,129,0.15)', color: '#10B981', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>Optimized</span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.05)', color: '#888', padding: '2px 8px', borderRadius: 10 }}>Active</span>
                      )}
                    </td>
                    <td>
                      {!r.optimized && (
                        <button onClick={() => handleDirectOptimize(r.id)} disabled={directOpt[r.id]}
                          style={{ padding: '3px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: '0.75rem',
                            background: r.critical ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
                            color: r.critical ? '#F87171' : '#10B981', fontWeight: 700 }}>
                          {directOpt[r.id] ? '⏳' : '⚡ Optimize'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
