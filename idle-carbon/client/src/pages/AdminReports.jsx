/**
 * AdminReports.jsx — Admin view for all submitted optimization reports
 *
 * Shows submitted manager reports with filters, summary cards,
 * and a drill-down modal showing the EXACT same report the manager generated.
 */

import { useState, useEffect } from 'react';
import { getAdminReports, markReportReviewed } from '../api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';

const CHART_COLORS = ['#10B981', '#EF4444', '#3B82F6', '#8B5CF6', '#F59E0B'];

const PERIOD_LABELS = { today: 'Today', weekly: 'Weekly', monthly: 'Monthly' };

function StatusBadge({ status }) {
  const cfg = {
    submitted: { bg: 'rgba(245,158,11,0.15)', color: '#F59E0B', label: '📨 Submitted' },
    reviewed:  { bg: 'rgba(16,185,129,0.15)',  color: '#10B981', label: '✅ Reviewed'  },
  }[status] || { bg: 'rgba(255,255,255,0.05)', color: '#888', label: status };
  return (
    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600, background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

// ─── Exact replica of the manager's report view ───────────────────────────────
function ReportModal({ report, onClose, onReviewed }) {
  const [marking, setMarking] = useState(false);
  const d = report.report_data_json || {};
  const { meta = {}, summary = {}, energyImpact = {}, rows = [], charts = {} } = d;

  const handleMark = async () => {
    setMarking(true);
    try {
      await markReportReviewed(report.report_id);
      onReviewed();
    } catch (_) {}
    setMarking(false);
  };

  const SectionLabel = ({ children }) => (
    <h3 style={{ margin: '1.4rem 0 0.7rem', color: '#10B981', fontSize: '0.95rem', fontWeight: 700 }}>{children}</h3>
  );

  const StatCard = ({ icon, value, label, color }) => {
    const colors = {
      green:  { bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.2)',  val: '#10B981' },
      blue:   { bg: 'rgba(59,130,246,0.08)',   border: 'rgba(59,130,246,0.2)',  val: '#3B82F6' },
      orange: { bg: 'rgba(245,158,11,0.08)',   border: 'rgba(245,158,11,0.2)',  val: '#F59E0B' },
      purple: { bg: 'rgba(139,92,246,0.08)',   border: 'rgba(139,92,246,0.2)',  val: '#8B5CF6' },
    }[color] || { bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.08)', val: '#ddd' };
    return (
      <div style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 12,
        padding: '1rem', textAlign: 'center' }}>
        <div style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>{icon}</div>
        <div style={{ fontSize: '1.3rem', fontWeight: 700, color: colors.val, marginBottom: '0.2rem' }}>{value}</div>
        <div style={{ fontSize: '0.72rem', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      </div>
    );
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 1000,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '1.5rem 1rem', overflowY: 'auto',
    }} onClick={onClose}>
      <div style={{
        background: '#0f0f1a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16,
        padding: '2rem', maxWidth: 980, width: '100%', marginBottom: '1.5rem',
      }} onClick={e => e.stopPropagation()}>

        {/* ── Toolbar ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.8rem' }}>
          <div>
            <h2 style={{ marginBottom: '0.2rem' }}>📊 Optimization Report</h2>
            <p style={{ color: '#666', fontSize: '0.85rem' }}>
              Submitted by <strong style={{ color: '#ddd' }}>{report.manager_name}</strong> ·{' '}
              {PERIOD_LABELS[report.period] || report.period}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
            <StatusBadge status={report.status} />
            {report.status === 'submitted' && (
              <button onClick={handleMark} disabled={marking}
                style={{ padding: '0.5rem 1.1rem', borderRadius: 8, border: '1px solid rgba(16,185,129,0.4)',
                  background: 'rgba(16,185,129,0.1)', color: '#10B981', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                {marking ? '⏳ Marking…' : '✅ Mark as Reviewed'}
              </button>
            )}
            <button onClick={onClose}
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#888', cursor: 'pointer', borderRadius: 8, padding: '0.5rem 0.9rem', fontSize: '1rem' }}>
              ✕
            </button>
          </div>
        </div>

        {/* ── Report Header Panel ── */}
        <div style={{ padding: '1rem 1.2rem', background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.2)',
          borderRadius: 12, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#666', textTransform: 'uppercase', letterSpacing: 1 }}>Optimization Report</div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#ddd', marginTop: '0.2rem' }}>
              {meta.department || report.department} — {PERIOD_LABELS[meta.period || report.period] || report.period} Report
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '0.82rem', color: '#888' }}>
            <div>Generated by <strong style={{ color: '#ddd' }}>{meta.managerName || report.manager_name}</strong></div>
            <div>{new Date(meta.dateGenerated || report.date_generated).toLocaleString()}</div>
          </div>
        </div>

        {/* ── AI Summary ── */}
        {report.ai_summary && (
          <div style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(59,130,246,0.08))',
            border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, padding: '1rem', marginBottom: '1rem',
            display: 'flex', gap: '0.8rem', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '1.8rem', flexShrink: 0 }}>🤖</span>
            <div>
              <div style={{ fontSize: '0.72rem', color: '#10B981', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: '0.4rem' }}>AI-Generated Summary</div>
              <p style={{ color: '#ccc', lineHeight: 1.7, fontSize: '0.94rem' }}>{report.ai_summary}</p>
            </div>
          </div>
        )}

        {/* ── Optimization Summary KPI Cards ── */}
        {summary && Object.keys(summary).length > 0 && (
          <>
            <SectionLabel>📌 Optimization Summary</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.8rem', marginBottom: '0.5rem' }}>
              <StatCard icon="🏢" value={summary.totalIdleRoomsDetected ?? '—'}     label="Idle Rooms Detected"       color="orange" />
              <StatCard icon="✅" value={summary.totalOptimizationsPerformed ?? '—'} label="Optimizations Performed"  color="green"  />
              <StatCard icon="🧟" value={summary.zombieResourcesDetected ?? '—'}     label="Zombie Resources Detected" color="purple" />
              <StatCard icon="🔧" value={summary.zombieResourcesFixed ?? '—'}        label="Zombie Resources Fixed"   color="blue"   />
            </div>
          </>
        )}

        {/* ── Energy Impact KPI Cards ── */}
        {energyImpact && Object.keys(energyImpact).length > 0 && (
          <>
            <SectionLabel>⚡ Energy Impact</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.8rem', marginBottom: '0.5rem' }}>
              <StatCard icon="🌿" value={`${(energyImpact.totalEnergySavedKwh || 0).toFixed(1)} kWh`}  label="Total Energy Saved"        color="green"  />
              <StatCard icon="💰" value={`$${(energyImpact.totalCostSaved || 0).toFixed(2)}`}           label="Total Cost Saved"           color="blue"   />
              <StatCard icon="📉" value={`${(energyImpact.energyWastedBeforeOpt || 0).toFixed(1)} kWh`} label="Energy Wasted Before Opt."  color="orange" />
              <StatCard icon="📈" value={`${(energyImpact.energySavedAfterOpt || 0).toFixed(1)} kWh`}   label="Energy Saved After Opt."    color="purple" />
            </div>
          </>
        )}

        {/* ── Charts ── */}
        {charts && (
          <>
            <SectionLabel>📊 Visual Summary</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px,1fr))', gap: '1rem', marginBottom: '0.5rem' }}>

              {/* Savings per room */}
              {charts.savingsPerRoom && charts.savingsPerRoom.length > 0 && (
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '1rem' }}>
                  <h4 style={{ marginBottom: '0.7rem', fontSize: '0.88rem', color: '#aaa' }}>⚡ Energy Saved per Resource (kWh)</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={charts.savingsPerRoom} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" horizontal={false} />
                      <XAxis type="number" stroke="#555" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" stroke="#555" tick={{ fontSize: 9 }} width={85} />
                      <Tooltip contentStyle={{ background: '#1e1e2e', border: '1px solid #333', borderRadius: 8, fontSize: '0.8rem' }} />
                      <Bar dataKey="kwh" fill="#10B981" radius={[0, 4, 4, 0]} name="kWh Saved" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Optimizations per hour */}
              {charts.optimizationsPerHour && (
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '1rem' }}>
                  <h4 style={{ marginBottom: '0.7rem', fontSize: '0.88rem', color: '#aaa' }}>🕐 Optimizations per Hour</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={charts.optimizationsPerHour.slice(0, 24)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                      <XAxis dataKey="hour" stroke="#555" tick={{ fontSize: 8 }} interval={3} />
                      <YAxis stroke="#555" tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: '#1e1e2e', border: '1px solid #333', borderRadius: 8, fontSize: '0.8rem' }} />
                      <Line type="monotone" dataKey="count" stroke="#3B82F6" strokeWidth={2} dot={{ r: 2 }} name="Actions" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Zombie breakdown */}
              {charts.zombieBreakdown && !charts.zombieBreakdown.every(d => d.value === 0) && (
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '1rem' }}>
                  <h4 style={{ marginBottom: '0.7rem', fontSize: '0.88rem', color: '#aaa' }}>🧟 Zombie Resources Breakdown</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={charts.zombieBreakdown} cx="50%" cy="50%" outerRadius={70} dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                        {charts.zombieBreakdown.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
                      </Pie>
                      <Legend wrapperStyle={{ fontSize: '0.78rem' }} />
                      <Tooltip contentStyle={{ background: '#1e1e2e', border: '1px solid #333', borderRadius: 8, fontSize: '0.8rem' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Full Optimization Details Table ── */}
        {rows && rows.length > 0 && (
          <>
            <SectionLabel>📋 Optimization Details</SectionLabel>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '1rem', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    {['Room / Resource','Type','Issue Detected','Action Taken','Energy Saved (kWh)','Cost Saved','Timestamp','Status'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', color: '#666', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '7px 10px', color: '#ddd', fontWeight: 600 }}>{row.resourceName}</td>
                      <td style={{ padding: '7px 10px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600,
                          background: 'rgba(59,130,246,0.12)', color: '#60A5FA' }}>{row.resourceType}</span>
                      </td>
                      <td style={{ padding: '7px 10px', color: '#F59E0B' }}>{row.issueDetected}</td>
                      <td style={{ padding: '7px 10px', color: '#60A5FA', fontSize: '0.8rem' }}>{row.actionTaken}</td>
                      <td style={{ padding: '7px 10px', color: '#10B981', fontWeight: 600 }}>{(row.energySavedKwh ?? 0).toFixed(2)}</td>
                      <td style={{ padding: '7px 10px', color: '#34D399' }}>${(row.costSaved ?? 0).toFixed(2)}</td>
                      <td style={{ padding: '7px 10px', color: '#888', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{new Date(row.timestamp).toLocaleString()}</td>
                      <td style={{ padding: '7px 10px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600,
                          background: row.status === 'approved' || row.status === 'auto-executed' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                          color:      row.status === 'approved' || row.status === 'auto-executed' ? '#10B981'              : '#F59E0B' }}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── Manager Comments ── */}
        {report.manager_comments && (
          <>
            <SectionLabel>💬 Manager Comments</SectionLabel>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 12, padding: '1rem' }}>
              <p style={{ color: '#ccc', lineHeight: 1.7, fontSize: '0.9rem', fontStyle: 'italic', margin: 0 }}>
                "{report.manager_comments}"
              </p>
            </div>
          </>
        )}

        {/* ── Bottom actions ── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.7rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
          <button onClick={onClose}
            style={{ padding: '0.6rem 1.3rem', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
              background: 'transparent', color: '#888', cursor: 'pointer', fontWeight: 600 }}>
            Close
          </button>
          {report.status === 'submitted' && (
            <button onClick={handleMark} disabled={marking}
              style={{ padding: '0.6rem 1.3rem', borderRadius: 8, border: '1px solid rgba(16,185,129,0.4)',
                background: 'rgba(16,185,129,0.1)', color: '#10B981', cursor: 'pointer', fontWeight: 600 }}>
              {marking ? '⏳ Marking…' : '✅ Mark as Reviewed'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminReports() {
  const [reports, setReports]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [selected, setSelected] = useState(null);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const filters = {};
      if (dateFrom) filters.from = new Date(dateFrom).toISOString();
      if (dateTo)   filters.to   = new Date(dateTo + 'T23:59:59').toISOString();
      const res = await getAdminReports(filters);
      setReports(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReports(); }, []);

  const handleReviewed = () => {
    setSelected(null);
    fetchReports();
  };

  // Summary KPIs
  const totalEnergy  = reports.reduce((s, r) => s + r.energy_saved_kwh, 0);
  const totalCost    = reports.reduce((s, r) => s + r.cost_saved, 0);
  const totalActions = reports.reduce((s, r) => s + r.optimizations_count, 0);
  const pending      = reports.filter(r => r.status === 'submitted').length;

  return (
    <div className="dashboard">
      <h2 style={{ marginBottom: '0.3rem' }}>📑 Submitted Optimization Reports</h2>
      <p className="subtitle">Review manager-submitted energy optimization reports</p>

      {/* KPI Strip */}
      <div className="stats-grid" style={{ marginTop: '1.2rem' }}>
        <div className="stat-card orange"><div className="stat-icon">📨</div><div className="stat-value">{pending}</div><div className="stat-label">Awaiting Review</div></div>
        <div className="stat-card green"><div className="stat-icon">🌿</div><div className="stat-value">{totalEnergy.toFixed(1)} kWh</div><div className="stat-label">Total Energy Saved</div></div>
        <div className="stat-card blue"><div className="stat-icon">💰</div><div className="stat-value">${totalCost.toFixed(2)}</div><div className="stat-label">Total Cost Saved</div></div>
        <div className="stat-card purple"><div className="stat-icon">✅</div><div className="stat-value">{totalActions}</div><div className="stat-label">Total Optimizations</div></div>
      </div>

      {/* Filters */}
      <div className="panel" style={{ marginTop: '1.2rem' }}>
        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <label style={{ fontSize: '0.72rem', color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="baseline-input" style={{ width: 150 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <label style={{ fontSize: '0.72rem', color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="baseline-input" style={{ width: 150 }} />
          </div>
          <button
            onClick={fetchReports}
            style={{ alignSelf: 'flex-end', padding: '0.55rem 1.2rem', borderRadius: 8, border: '1px solid rgba(59,130,246,0.4)', background: 'rgba(59,130,246,0.1)', color: '#60A5FA', cursor: 'pointer', fontWeight: 600 }}>
            🔍 Filter
          </button>
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); setTimeout(fetchReports, 0); }}
              style={{ alignSelf: 'flex-end', padding: '0.55rem 1rem', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#888', cursor: 'pointer' }}>
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      {/* Reports Table */}
      <div className="panel" style={{ marginTop: '1rem' }}>
        {loading ? (
          <div className="loading">Loading reports…</div>
        ) : reports.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.8rem' }}>📭</div>
            <p>No reports submitted yet.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Manager</th>
                  <th>Department</th>
                  <th>Period</th>
                  <th>Energy Saved</th>
                  <th>Cost Saved</th>
                  <th>Optimizations</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {reports.map(r => (
                  <tr key={r.report_id}>
                    <td><strong>{r.manager_name}</strong></td>
                    <td>{r.department}</td>
                    <td><span style={{ fontSize: '0.8rem', color: '#888' }}>{PERIOD_LABELS[r.period] || r.period}</span></td>
                    <td style={{ color: '#10B981', fontWeight: 600 }}>{r.energy_saved_kwh.toFixed(1)} kWh</td>
                    <td style={{ color: '#34D399' }}>${r.cost_saved.toFixed(2)}</td>
                    <td>{r.optimizations_count}</td>
                    <td style={{ fontSize: '0.8rem', color: '#888' }}>{new Date(r.date_generated).toLocaleDateString()}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td>
                      <button onClick={() => setSelected(r)}
                        style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#ccc', cursor: 'pointer', fontSize: '0.8rem' }}>
                        👁 View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <ReportModal report={selected} onClose={() => setSelected(null)} onReviewed={handleReviewed} />
      )}
    </div>
  );
}
