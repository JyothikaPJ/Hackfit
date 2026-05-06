/**
 * OptimizationReport.jsx — Manager Optimization Report Generator
 *
 * Managers can generate, preview, comment on, and submit
 * energy optimization reports to the Admin.
 */

import { useState, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { getOptimizationData, submitReport } from '../api';
import { useAuth } from '../AuthContext';

// ─── constants ────────────────────────────────────────────────────────────────
const PERIODS = [
  { value: 'today',   label: 'Today'   },
  { value: 'weekly',  label: 'Weekly'  },
  { value: 'monthly', label: 'Monthly' },
];

const CHART_COLORS = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444'];

// ─── AI summary generator (local, no external LLM needed) ────────────────────
function generateAISummary(data, period) {
  const { summary, energyImpact, charts } = data;
  const pct = energyImpact.energyWastedBeforeOpt > 0
    ? Math.round((energyImpact.totalEnergySavedKwh / energyImpact.energyWastedBeforeOpt) * 100)
    : 0;
  const periodLabel = { today: 'Today', weekly: 'This week', monthly: 'This month' }[period] || period;
  const topRoom = charts.savingsPerRoom.sort((a, b) => b.kwh - a.kwh)[0];
  const peakHour = charts.optimizationsPerHour.sort((a, b) => b.count - a.count)[0];

  let sentences = [];
  sentences.push(
    `${periodLabel} the system reduced energy waste by ${pct}% by automatically shutting down ` +
    `idle HVAC systems and zombie servers across ${data.meta.department}.`
  );
  if (summary.totalOptimizationsPerformed > 0) {
    sentences.push(
      `A total of ${summary.totalOptimizationsPerformed} optimization actions were executed, ` +
      `saving ${energyImpact.totalEnergySavedKwh.toFixed(1)} kWh and $${energyImpact.totalCostSaved.toFixed(2)} in energy costs.`
    );
  }
  if (topRoom) {
    sentences.push(
      `The highest savings came from ${topRoom.name} (${topRoom.kwh.toFixed(1)} kWh recovered).`
    );
  }
  if (summary.zombieResourcesDetected > 0) {
    sentences.push(
      `${summary.zombieResourcesDetected} zombie resource(s) were detected; ` +
      `${summary.zombieResourcesFixed} were remediated automatically.`
    );
  }
  if (peakHour && peakHour.count > 0) {
    sentences.push(
      `Optimization activity peaked at ${peakHour.hour}, suggesting off-peak scheduling would be most effective.`
    );
  }
  return sentences.join(' ');
}

// ─── sub-components ───────────────────────────────────────────────────────────
function StatCard({ icon, value, label, color }) {
  return (
    <div className={`stat-card ${color}`}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function SectionLabel({ children }) {
  return <h3 style={{ margin: '1.5rem 0 0.8rem', color: '#10B981', fontSize: '1rem', fontWeight: 700 }}>{children}</h3>;
}

// ─── main component ───────────────────────────────────────────────────────────
export default function OptimizationReport() {
  const { user } = useAuth();
  const [period, setPeriod]         = useState('today');
  const [reportData, setReportData] = useState(null);
  const [aiSummary, setAiSummary]   = useState('');
  const [comments, setComments]     = useState('');
  const [loading, setLoading]       = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [error, setError]           = useState('');
  const printRef = useRef();

  // ── generate ───────────────────────────────────────────────────────
  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    setSubmitted(false);
    try {
      const res = await getOptimizationData(period);
      const data = res.data.data;
      const summary = generateAISummary(data, period);
      setReportData(data);
      setAiSummary(summary);
      setComments('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate report. Is the server running?');
    } finally {
      setLoading(false);
    }
  };

  // ── submit ─────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!reportData) return;
    setSubmitting(true);
    try {
      await submitReport({ period, managerComments: comments, aiSummary, reportData });
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit report.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── download (print-to-PDF) ────────────────────────────────────────
  const handleDownload = () => {
    window.print();
  };

  // ─────────────────────────────────────────────────────────────────
  return (
    <div className="dashboard" ref={printRef}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.8rem' }}>
        <div>
          <h2 style={{ marginBottom: '0.2rem' }}>📊 Optimization Report Generator</h2>
          <p className="subtitle">Generate &amp; submit energy optimization reports to Admin</p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={period}
            onChange={e => setPeriod(e.target.value)}
            className="filter-select"
            style={{ padding: '0.55rem 1rem' }}
          >
            {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <button className="btn-primary" style={{ width: 'auto', padding: '0.55rem 1.4rem' }}
            onClick={handleGenerate} disabled={loading}>
            {loading ? '⏳ Generating…' : '⚡ Generate Report'}
          </button>
          {reportData && (
            <>
              <button
                onClick={handleDownload}
                style={{ padding: '0.55rem 1.2rem', borderRadius: 8, border: '1px solid rgba(59,130,246,0.4)', background: 'rgba(59,130,246,0.1)', color: '#60A5FA', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>
                📄 Download PDF
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || submitted}
                style={{ padding: '0.55rem 1.2rem', borderRadius: 8, border: '1px solid rgba(16,185,129,0.4)', background: submitted ? 'rgba(16,185,129,0.25)' : 'rgba(16,185,129,0.1)', color: '#10B981', cursor: submitted ? 'default' : 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>
                {submitted ? '✅ Submitted!' : submitting ? '⏳ Submitting…' : '📨 Submit to Admin'}
              </button>
            </>
          )}
        </div>
      </div>

      {error && <div className="error-msg" style={{ marginBottom: '1rem' }}>{error}</div>}

      {!reportData && !loading && (
        <div className="panel" style={{ textAlign: 'center', padding: '4rem 2rem', color: '#666' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📋</div>
          <h3 style={{ color: '#888', marginBottom: '0.5rem' }}>No report generated yet</h3>
          <p style={{ fontSize: '0.9rem' }}>Select a period and click <strong style={{ color: '#10B981' }}>Generate Report</strong> to begin.</p>
        </div>
      )}

      {reportData && (() => {
        const { meta, summary, energyImpact, rows, charts } = reportData;
        return (
          <>
            {/* ── Report Header ── */}
            <div className="panel" style={{ borderColor: 'rgba(16,185,129,0.25)', background: 'rgba(16,185,129,0.04)', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#666', textTransform: 'uppercase', letterSpacing: 1 }}>Optimization Report</div>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#ddd', marginTop: '0.2rem' }}>
                    {meta.department} — {PERIODS.find(p => p.value === meta.period)?.label} Report
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.82rem', color: '#888' }}>
                  <div>Generated by <strong style={{ color: '#ddd' }}>{meta.managerName}</strong></div>
                  <div>{new Date(meta.dateGenerated).toLocaleString()}</div>
                </div>
              </div>
            </div>

            {/* ── AI Summary ── */}
            <div className="panel" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(59,130,246,0.08))', borderColor: 'rgba(16,185,129,0.2)', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '1.8rem', flexShrink: 0 }}>🤖</span>
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#10B981', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: '0.4rem' }}>AI-Generated Summary</div>
                  <p style={{ color: '#ccc', lineHeight: 1.7, fontSize: '0.95rem' }}>{aiSummary}</p>
                </div>
              </div>
            </div>

            {/* ── Summary KPI Cards ── */}
            <SectionLabel>📌 Optimization Summary</SectionLabel>
            <div className="stats-grid">
              <StatCard icon="🏢" value={summary.totalIdleRoomsDetected}      label="Idle Rooms Detected"        color="orange" />
              <StatCard icon="✅" value={summary.totalOptimizationsPerformed}  label="Optimizations Performed"   color="green"  />
              <StatCard icon="🧟" value={summary.zombieResourcesDetected}      label="Zombie Resources Detected"  color="purple" />
              <StatCard icon="🔧" value={summary.zombieResourcesFixed}         label="Zombie Resources Fixed"    color="blue"   />
            </div>

            {/* ── Energy Impact Cards ── */}
            <SectionLabel>⚡ Energy Impact</SectionLabel>
            <div className="stats-grid">
              <StatCard icon="🌿" value={`${energyImpact.totalEnergySavedKwh.toFixed(1)} kWh`} label="Total Energy Saved"        color="green"  />
              <StatCard icon="💰" value={`$${energyImpact.totalCostSaved.toFixed(2)}`}          label="Total Cost Saved"           color="blue"   />
              <StatCard icon="📉" value={`${energyImpact.energyWastedBeforeOpt.toFixed(1)} kWh`} label="Energy Wasted Before Opt." color="orange" />
              <StatCard icon="📈" value={`${energyImpact.energySavedAfterOpt.toFixed(1)} kWh`} label="Energy Saved After Opt."   color="purple" />
            </div>

            {/* ── Charts ── */}
            <SectionLabel>📊 Visual Summary</SectionLabel>
            <div className="panel-grid">

              {/* Savings per room */}
              <div className="panel">
                <h3 style={{ marginBottom: '0.8rem', fontSize: '0.95rem' }}>⚡ Energy Saved per Resource (kWh)</h3>
                {charts.savingsPerRoom.length === 0 ? (
                  <p style={{ color: '#666', padding: '2rem', textAlign: 'center' }}>No data for this period.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={charts.savingsPerRoom} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                      <XAxis type="number" stroke="#aaa" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" stroke="#aaa" tick={{ fontSize: 10 }} width={90} />
                      <Tooltip contentStyle={{ background: '#1e1e2e', border: '1px solid #333', borderRadius: 8 }} />
                      <Bar dataKey="kwh" fill="#10B981" radius={[0, 4, 4, 0]} name="kWh Saved" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Optimizations per hour */}
              <div className="panel">
                <h3 style={{ marginBottom: '0.8rem', fontSize: '0.95rem' }}>🕐 Optimizations per Hour</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={charts.optimizationsPerHour.filter(d => d.count > 0 || true).slice(0, 24)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="hour" stroke="#aaa" tick={{ fontSize: 9 }} interval={3} />
                    <YAxis stroke="#aaa" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: '#1e1e2e', border: '1px solid #333', borderRadius: 8 }} />
                    <Line type="monotone" dataKey="count" stroke="#3B82F6" strokeWidth={2} dot={{ r: 2 }} name="Actions" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Zombie breakdown */}
              <div className="panel">
                <h3 style={{ marginBottom: '0.8rem', fontSize: '0.95rem' }}>🧟 Zombie Resources Breakdown</h3>
                {charts.zombieBreakdown.every(d => d.value === 0) ? (
                  <p style={{ color: '#666', padding: '2rem', textAlign: 'center' }}>No zombie resources detected.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={charts.zombieBreakdown} cx="50%" cy="50%" outerRadius={80} dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                        {charts.zombieBreakdown.map((_, i) => <Cell key={i} fill={['#10B981', '#EF4444'][i % 2]} />)}
                      </Pie>
                      <Legend />
                      <Tooltip contentStyle={{ background: '#1e1e2e', border: '1px solid #333', borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* ── Details Table ── */}
            <SectionLabel>📋 Optimization Details</SectionLabel>
            <div className="panel">
              {rows.length === 0 ? (
                <p style={{ color: '#666', padding: '2rem', textAlign: 'center' }}>No optimization actions found for this period.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Room / Resource</th>
                        <th>Type</th>
                        <th>Issue Detected</th>
                        <th>Action Taken</th>
                        <th>Energy Saved (kWh)</th>
                        <th>Cost Saved</th>
                        <th>Timestamp</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr key={i}>
                          <td><strong>{row.resourceName}</strong></td>
                          <td><span className={`badge badge-${row.resourceType.toLowerCase().replace(/ \/ /g, '-')}`}>{row.resourceType}</span></td>
                          <td style={{ color: '#F59E0B' }}>{row.issueDetected}</td>
                          <td style={{ color: '#60A5FA', fontSize: '0.85rem' }}>{row.actionTaken}</td>
                          <td style={{ color: '#10B981', fontWeight: 600 }}>{row.energySavedKwh.toFixed(2)}</td>
                          <td style={{ color: '#34D399' }}>${row.costSaved.toFixed(2)}</td>
                          <td style={{ fontSize: '0.8rem', color: '#888' }}>{new Date(row.timestamp).toLocaleString()}</td>
                          <td>
                            <span style={{
                              padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600,
                              background: row.status === 'approved' || row.status === 'auto-executed'
                                ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                              color: row.status === 'approved' || row.status === 'auto-executed'
                                ? '#10B981' : '#F59E0B',
                            }}>
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ── Manager Comments ── */}
            <SectionLabel>💬 Manager Comments</SectionLabel>
            <div className="panel">
              <p style={{ fontSize: '0.82rem', color: '#888', marginBottom: '0.6rem' }}>
                Add your observations or recommendations before submitting to Admin.
              </p>
              <textarea
                value={comments}
                onChange={e => setComments(e.target.value)}
                disabled={submitted}
                placeholder='e.g. "Most optimizations occurred during off-peak hours. Recommend automatic scheduling."'
                style={{
                  width: '100%', minHeight: 100, padding: '0.75rem', borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)',
                  color: '#ddd', fontSize: '0.9rem', resize: 'vertical', fontFamily: 'Inter, sans-serif',
                  lineHeight: 1.6,
                }}
              />
              {submitted && (
                <div style={{ marginTop: '0.8rem', padding: '0.75rem 1rem', borderRadius: 10, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#10B981', fontSize: '0.9rem' }}>
                  ✅ Report successfully submitted to Admin for review.
                </div>
              )}
            </div>

            {/* ── Action Buttons (bottom) ── */}
            <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'flex-end', marginTop: '0.5rem', flexWrap: 'wrap' }} className="no-print">
              <button onClick={handleDownload}
                style={{ padding: '0.65rem 1.4rem', borderRadius: 10, border: '1px solid rgba(59,130,246,0.4)', background: 'rgba(59,130,246,0.1)', color: '#60A5FA', cursor: 'pointer', fontWeight: 600 }}>
                📄 Download as PDF
              </button>
              <button onClick={handleSubmit} disabled={submitting || submitted}
                style={{ padding: '0.65rem 1.4rem', borderRadius: 10, border: '1px solid rgba(16,185,129,0.4)', background: submitted ? 'rgba(16,185,129,0.25)' : 'rgba(16,185,129,0.1)', color: '#10B981', cursor: submitted ? 'default' : 'pointer', fontWeight: 600 }}>
                {submitted ? '✅ Submitted to Admin' : submitting ? '⏳ Submitting…' : '📨 Submit to Admin'}
              </button>
            </div>
          </>
        );
      })()}
    </div>
  );
}
