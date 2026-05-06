import { useState, useEffect } from 'react';
import { getActions, approveAction, dismissAction, getIdleMetrics } from '../api';

export default function ManagerDashboard() {
  const [actions, setActions] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});

  const fetchData = async () => {
    try {
      const [actionsRes, metricsRes] = await Promise.all([
        getActions(),
        getIdleMetrics()
      ]);
      setActions(actionsRes.data.data);
      setMetrics(metricsRes.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleApprove = async (id) => {
    setActionLoading(prev => ({ ...prev, [id]: 'approving' }));
    try {
      await approveAction(id);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to approve');
    }
    setActionLoading(prev => ({ ...prev, [id]: null }));
  };

  const handleDismiss = async (id) => {
    setActionLoading(prev => ({ ...prev, [id]: 'dismissing' }));
    try {
      await dismissAction(id);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to dismiss');
    }
    setActionLoading(prev => ({ ...prev, [id]: null }));
  };

  if (loading) return <div className="loading">Loading dashboard...</div>;

  const pendingActions = actions.filter(a => a.status === 'pending');
  const completedActions = actions.filter(a => a.status !== 'pending');

  const totalSaved = completedActions
    .filter(a => a.status === 'approved' || a.status === 'auto-executed')
    .reduce((sum, a) => sum + (a.actualSavings || a.estimatedSavings || 0), 0);

  return (
    <div className="dashboard">
      <h2>Manager Dashboard</h2>

      <div className="stats-grid">
        <div className="stat-card orange">
          <div className="stat-icon">⏳</div>
          <div className="stat-value">{pendingActions.length}</div>
          <div className="stat-label">Pending Actions</div>
        </div>
        <div className="stat-card green">
          <div className="stat-icon">✅</div>
          <div className="stat-value">{completedActions.filter(a => a.status === 'approved').length}</div>
          <div className="stat-label">Approved</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-icon">⚡</div>
          <div className="stat-value">{metrics.length}</div>
          <div className="stat-label">Idle Resources</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-icon">💰</div>
          <div className="stat-value">${totalSaved.toFixed(2)}</div>
          <div className="stat-label">Total Saved</div>
        </div>
      </div>

      {pendingActions.length > 0 && (
        <div className="panel">
          <h3>⚠️ Pending Approval</h3>
          <div className="action-list">
            {pendingActions.map(a => (
              <div key={a.id} className="action-card pending">
                <div className="action-info">
                  <span className={`badge badge-${a.resourceType}`}>{a.resourceType}</span>
                  <strong>{a.resourceId}</strong>
                  <span className="action-type">{a.actionType}</span>
                  <span className="action-savings">Est. ${(a.estimatedSavings || 0).toFixed(2)}</span>
                </div>
                <div className="action-buttons">
                  <button className="btn-approve" onClick={() => handleApprove(a.id)} disabled={actionLoading[a.id]}>
                    {actionLoading[a.id] === 'approving' ? '...' : '✓ Approve'}
                  </button>
                  <button className="btn-dismiss" onClick={() => handleDismiss(a.id)} disabled={actionLoading[a.id]}>
                    {actionLoading[a.id] === 'dismissing' ? '...' : '✗ Dismiss'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="panel">
        <h3>📋 Action History</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Resource</th>
              <th>Type</th>
              <th>Action</th>
              <th>Status</th>
              <th>Savings</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {completedActions.slice(0, 20).map(a => (
              <tr key={a.id}>
                <td>{a.resourceId}</td>
                <td><span className={`badge badge-${a.resourceType}`}>{a.resourceType}</span></td>
                <td>{a.actionType}</td>
                <td><span className={`status status-${a.status}`}>{a.status}</span></td>
                <td>${(a.actualSavings || a.estimatedSavings || 0).toFixed(2)}</td>
                <td>{a.executedAt ? new Date(a.executedAt).toLocaleString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
