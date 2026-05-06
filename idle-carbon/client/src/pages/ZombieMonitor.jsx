import { useState, useCallback } from 'react';
import {
  generateInfrastructureData,
  detectZombies,
  getZombies,
  fixZombie,
  getZombieFixSummary,
} from '../zombieDetector';

// Steps executed for each zombie type (shown in order during fix)
const FIX_STEPS = {
  zombie_vm: [
    { icon: '🔍', text: 'Validating low CPU metrics...' },
    { icon: '📦', text: 'Draining active connections...' },
    { icon: '💾', text: 'Snapshotting VM state...' },
    { icon: '🛑', text: 'Terminating VM process...' },
  ],
  sleeping_server: [
    { icon: '🔍', text: 'Confirming idle duration...' },
    { icon: '🔌', text: 'Flushing pending I/O requests...' },
    { icon: '💤', text: 'Initiating sleep mode (ACPI S3)...' },
    { icon: '💡', text: 'Cutting non-essential power rails...' },
  ],
  energy_vampire: [
    { icon: '🔍', text: 'Confirming zero occupancy...' },
    { icon: '🌡', text: 'Ramping down HVAC compressor...' },
    { icon: '💡', text: 'Turning off lighting circuits...' },
    { icon: '🔒', text: 'Locking room controls...' },
  ],
};

export default function ZombieMonitor() {
  const [resources, setResources] = useState(() => detectZombies(generateInfrastructureData()));
  const [fixing, setFixing] = useState({});
  const [fixed, setFixed] = useState({});
  const [fixResults, setFixResults] = useState({});
  const [fixSteps, setFixSteps] = useState({});  // {[id]: [{icon,text,done}]}
  const [, setTick] = useState(0); // force re-render for summary

  const zombies = getZombies(resources);
  const healthy = resources.filter(r => !r.isZombie);
  const summary = getZombieFixSummary();

  const handleFix = useCallback((zombie) => {
    setFixing(prev => ({ ...prev, [zombie.id]: true }));
    setFixSteps(prev => ({ ...prev, [zombie.id]: [] }));

    const steps = FIX_STEPS[zombie.zombieType] || [
      { icon: '🔧', text: 'Cleaning up resource...' },
    ];

    // Reveal each step one at a time
    steps.forEach((step, i) => {
      setTimeout(() => {
        setFixSteps(prev => ({
          ...prev,
          [zombie.id]: [...(prev[zombie.id] || []), { ...step, done: true }],
        }));
      }, 400 + i * 500);
    });

    // After all steps, run the actual fix
    setTimeout(() => {
      const result = fixZombie(zombie);
      setFixResults(prev => ({ ...prev, [zombie.id]: result }));
      setFixed(prev => ({ ...prev, [zombie.id]: true }));
      setFixing(prev => ({ ...prev, [zombie.id]: false }));
      setResources(prev => prev.map(r => r.id === zombie.id ? { ...r, isZombie: false, wasFixed: true } : r));
      setTick(t => t + 1);
    }, 400 + steps.length * 500 + 300);
  }, []);

  const handleRescan = () => {
    setResources(detectZombies(generateInfrastructureData()));
    setFixed({});
    setFixResults({});
    setFixing({});
    setFixSteps({});
  };

  // Group zombies by type
  const zombieVMs = zombies.filter(z => z.zombieType === 'zombie_vm');
  const sleepingServers = zombies.filter(z => z.zombieType === 'sleeping_server');
  const energyVampires = zombies.filter(z => z.zombieType === 'energy_vampire');
  const fixedResources = resources.filter(r => r.wasFixed);

  return (
    <div className="dashboard">
      <div className="heatmap-header">
        <div>
          <h2>🧟 Zombie Resource Monitor</h2>
          <p className="subtitle">Detect and eliminate wasteful infrastructure resources</p>
        </div>
        <button className="btn-simulate" onClick={handleRescan}>
          🔄 Rescan Infrastructure
        </button>
      </div>

      {/* Summary Stats */}
      <div className="stats-grid">
        <div className="stat-card purple">
          <div className="stat-icon">🧟</div>
          <div className="stat-value">{zombies.length}</div>
          <div className="stat-label">Active Zombies</div>
        </div>
        <div className="stat-card green">
          <div className="stat-icon">✅</div>
          <div className="stat-value">{summary.fixedToday}</div>
          <div className="stat-label">Zombies Fixed Today</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-icon">⚡</div>
          <div className="stat-value">{summary.totalEnergySaved}</div>
          <div className="stat-label">kWh Saved</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-icon">💰</div>
          <div className="stat-value">${summary.totalCostSaved.toFixed(2)}</div>
          <div className="stat-label">Cost Saved</div>
        </div>
      </div>

      {/* Zombie Cards */}
      {zombies.length === 0 && fixedResources.length === 0 && (
        <div className="panel">
          <p className="empty" style={{ textAlign: 'center', padding: '2rem' }}>✅ No zombie resources detected! Infrastructure is running clean.</p>
        </div>
      )}

      {zombieVMs.length > 0 && (
        <ZombieSection title="🧟 Zombie VMs" subtitle="Running but doing nothing (CPU < 5%)"
          items={zombieVMs} fixing={fixing} fixed={fixed} fixResults={fixResults} fixSteps={fixSteps} onFix={handleFix} />
      )}

      {sleepingServers.length > 0 && (
        <ZombieSection title="💤 Sleeping Servers" subtitle="Idle for over 2 hours"
          items={sleepingServers} fixing={fixing} fixed={fixed} fixResults={fixResults} fixSteps={fixSteps} onFix={handleFix} />
      )}

      {energyVampires.length > 0 && (
        <ZombieSection title="⚡ Energy Vampires" subtitle="High energy draw with zero occupancy"
          items={energyVampires} fixing={fixing} fixed={fixed} fixResults={fixResults} fixSteps={fixSteps} onFix={handleFix} />
      )}

      {/* Fixed Resources */}
      {fixedResources.length > 0 && (
        <div className="panel opt-log-panel">
          <h3>✅ Eliminated Zombies ({fixedResources.length})</h3>
          <div className="opt-log-list">
            {summary.log.map(entry => (
              <div key={entry.id} className="opt-log-item">
                <div className="opt-log-room">{entry.zombieEmoji} {entry.resourceName}</div>
                <div className="opt-log-detail">
                  {entry.action} · saved <strong>{entry.energySaved} kWh</strong> / <strong>${entry.costSaved.toFixed(2)}</strong>
                </div>
                <div className="opt-log-time">{new Date(entry.timestamp).toLocaleTimeString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Healthy Resources */}
      <div className="panel">
        <h3>🟢 Healthy Resources ({healthy.length})</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Location</th>
              <th>Status</th>
              <th>CPU</th>
              <th>Energy</th>
            </tr>
          </thead>
          <tbody>
            {healthy.filter(r => !r.wasFixed).map(r => (
              <tr key={r.id}>
                <td><strong>{r.name}</strong></td>
                <td><span className={`badge badge-${r.category}`}>{r.category}</span></td>
                <td>{r.location}</td>
                <td><span className="status status-approved">healthy</span></td>
                <td>{r.cpuPercent !== null ? `${r.cpuPercent}%` : '—'}</td>
                <td>{r.energyDraw} kWh</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ━━━━━━━ ZOMBIE SECTION COMPONENT ━━━━━━━
function ZombieSection({ title, subtitle, items, fixing, fixed, fixResults, fixSteps, onFix }) {
  return (
    <div className="panel zombie-section">
      <h3>{title}</h3>
      <p className="zombie-subtitle">{subtitle}</p>
      <div className="zombie-grid">
        {items.map(zombie => {
          const isFixing = fixing[zombie.id];
          const isFixed  = fixed[zombie.id];
          const result   = fixResults[zombie.id];
          const steps    = fixSteps[zombie.id] || [];

          return (
            <div key={zombie.id} className={`zombie-card ${isFixing ? 'zc-fixing' : ''} ${isFixed ? 'zc-fixed' : ''}`}
              style={{ '--zombie-color': zombie.zombieColor }}>
              <div className="zc-header">
                <span className="zc-emoji">{zombie.zombieEmoji}</span>
                <span className="zc-type" style={{ color: zombie.zombieColor }}>{zombie.zombieLabel}</span>
              </div>
              <div className="zc-name">{zombie.name}</div>
              <div className="zc-location">{zombie.location}</div>

              <div className="zc-stats">
                {zombie.cpuPercent !== null && (
                  <div className="zc-stat">
                    <span className="zc-stat-label">CPU</span>
                    <span className="zc-stat-value" style={{ color: zombie.cpuPercent < 5 ? '#F87171' : '#34D399' }}>
                      {zombie.cpuPercent}%
                    </span>
                  </div>
                )}
                {zombie.occupancy !== null && (
                  <div className="zc-stat">
                    <span className="zc-stat-label">Occupancy</span>
                    <span className="zc-stat-value" style={{ color: zombie.occupancy === 0 ? '#F87171' : '#34D399' }}>
                      {zombie.occupancy}
                    </span>
                  </div>
                )}
                <div className="zc-stat">
                  <span className="zc-stat-label">Energy</span>
                  <span className="zc-stat-value">{zombie.energyDraw} kWh</span>
                </div>
                {zombie.idleMinutes > 0 && (
                  <div className="zc-stat">
                    <span className="zc-stat-label">Idle</span>
                    <span className="zc-stat-value">{zombie.idleMinutes} min</span>
                  </div>
                )}
              </div>

              <div className="zc-reason">{zombie.zombieReason}</div>

              {/* Step-by-step fix log */}
              {(isFixing || isFixed) && steps.length > 0 && (
                <div style={{
                  margin: '0.7rem 0 0.4rem',
                  background: 'rgba(0,0,0,0.25)',
                  borderRadius: 8,
                  padding: '0.55rem 0.75rem',
                  fontSize: '0.78rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.3rem',
                }}>
                  {steps.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#ccc', animation: 'fadeInStep 0.3s ease' }}>
                      <span style={{ fontSize: '0.85rem' }}>{s.icon}</span>
                      <span>{s.text}</span>
                      <span style={{ marginLeft: 'auto', color: '#10B981', fontSize: '0.72rem' }}>✔</span>
                    </div>
                  ))}
                  {isFixing && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#888' }}>
                      <span className="opt-spinner" style={{ width: 10, height: 10, borderWidth: 2 }}></span>
                      <span>Working...</span>
                    </div>
                  )}
                </div>
              )}

              {isFixed && result ? (
                <div className="zc-fixed-msg" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div>✅ <strong>{result.action}</strong></div>
                  <div style={{ fontSize: '0.78rem', color: '#34D399' }}>
                    ⚡ {result.energySaved} kWh saved &nbsp;·&nbsp; 💰 ${result.costSaved.toFixed(2)} recovered
                  </div>
                </div>
              ) : !isFixing ? (
                <button className="btn-fix" onClick={() => onFix(zombie)}
                  style={{ '--btn-color': zombie.zombieColor }}>
                  🔧 Fix Resource
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

