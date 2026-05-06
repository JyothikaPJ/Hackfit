import { useState, useEffect } from 'react';
import { getLeaderboard } from '../api';

export default function LeaderboardPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    getLeaderboard().then(res => {
      setData(res.data.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="loading">Loading department progress...</div>;

  return (
    <div className="dashboard">
      <h2>⚡ Department Energy Progress</h2>
      <p className="subtitle">Energy reduction relative to baseline · Refreshes every 30s</p>

      <div className="leaderboard-cards">
        {data.map(entry => (
          <div key={entry.departmentId} className="leaderboard-card">
            <div className="lb-info">
              <h3>{entry.departmentName}</h3>
              <div className="lb-details">
                <span>Baseline: {entry.baselineUsage} kWh</span>
                <span>Current: {entry.currentUsage} kWh</span>
                <span>Team Size: {entry.teamSize}</span>
              </div>
            </div>
            <div className="lb-score">
              <div className="improvement-value">{entry.improvementPercent}%</div>
              <div className="improvement-label">improvement</div>
              <div className="improvement-bar">
                <div className="improvement-fill" style={{ width: `${Math.min(entry.improvementPercent * 2, 100)}%` }}></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
