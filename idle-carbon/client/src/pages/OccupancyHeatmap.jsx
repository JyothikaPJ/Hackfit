import { useState, useEffect, useRef, useCallback } from 'react';
import {
  createInitialRoomData,
  detectAllIdleRooms,
  getIdleRooms,
  updateRoomOccupancy,
  CONFIG,
} from '../idleDetector';
import {
  optimizeRoom,
  getRoomSubsystemStatus,
  getOptimizationLog,
  getOptimizationSummary,
} from '../optimizationEngine';
import EnergyWasteMonitor from './EnergyWasteMonitor';

// ━━━━━━━ COLOR MAPPING — ENERGY WASTE ONLY ━━━━━━━
// wasteLevel: 0–100 %  (from getWasteLevel)
function getWasteColor(wasteLevel) {
  if (wasteLevel <= 30) return { bg: 'rgba(16, 185, 129, 0.25)', border: '#10B981', text: '#34D399', label: 'LOW' };
  if (wasteLevel <= 60) return { bg: 'rgba(245, 158, 11, 0.25)', border: '#F59E0B', text: '#FBBF24', label: 'MODERATE' };
  return               { bg: 'rgba(239, 68, 68, 0.25)',  border: '#EF4444', text: '#F87171', label: 'HIGH' };
}

// ━━━━━━━ WASTE METER LOGIC ━━━━━━━
// Waste only applies when the room is EMPTY.
// If people are present, resources are being used legitimately — no waste.
function getWasteLevel(room) {
  if (room.occupancy > 0) return 0; // occupied → resources are justified, 0% waste
  const kwh = (room.hvacOn ? 3.0 : 0) + (room.lightsOn ? 0.5 : 0);
  return Math.round((kwh / 3.5) * 100); // empty room → all energy is wasted
}
function getWasteClass(level) {
  if (level <= 30) return 'waste-low';
  if (level <= 60) return 'waste-medium';
  return 'waste-high';
}

// ━━━━━━━ LIVE DATA GENERATOR ━━━━━━━
function generateLiveReadings(rooms) {
  return rooms.map(r => ({
    room: r.room,
    occupancy: Math.floor(Math.random() * 11),
    hvacOn:   Math.random() > 0.3,
    lightsOn: Math.random() > 0.2,
  }));
}

// ━━━━━━━ RESOURCE ISSUE DETECTION ━━━━━━━
function getInfraIssue(room) {
  if (room.occupancy === 0 && (room.hvacOn || room.lightsOn))
    return 'energy-waste';
  if (room.occupancy > 3 && !room.hvacOn)
    return 'comfort-risk';
  return null;
}

// ━━━━━━━ COMPONENT ━━━━━━━
export default function OccupancyHeatmap() {
  const [rooms, setRooms] = useState(() => {
    const initial = createInitialRoomData();
    return detectAllIdleRooms(initial);
  });
  const [tooltip, setTooltip] = useState({ visible: false, text: '', x: 0, y: 0 });
  const [optimizing, setOptimizing] = useState({});
  const [optimResults, setOptimResults] = useState({});
  const [logVersion, setLogVersion] = useState(0);
  const liveIntervalRef = useRef(null);
  const idleCheckRef = useRef(null);

  // ━━━ Idle detection — runs every 60 seconds ━━━
  useEffect(() => {
    setRooms(prev => detectAllIdleRooms(prev));
    idleCheckRef.current = setInterval(() => {
      console.log(`🔍 Idle check running at ${new Date().toLocaleTimeString()}`);
      setRooms(prev => detectAllIdleRooms(prev));
    }, CONFIG.CHECK_INTERVAL_MS);
    return () => clearInterval(idleCheckRef.current);
  }, []);

  // ━━━ Always-on live data — updates every 5 seconds ━━━
  useEffect(() => {
    const tick = () => {
      setRooms(prev => {
        const readings = generateLiveReadings(prev);
        // Merge resource states into room objects
        const withResources = prev.map(r => {
          const rd = readings.find(x => x.room === r.room) || {};
          return { ...r, hvacOn: rd.hvacOn ?? r.hvacOn, lightsOn: rd.lightsOn ?? r.lightsOn };
        });
        const updated = updateRoomOccupancy(withResources, readings);
        return detectAllIdleRooms(updated);
      });
    };
    tick();
    liveIntervalRef.current = setInterval(tick, 5000);
    return () => clearInterval(liveIntervalRef.current);
  }, []);

  // ━━━ ONE-CLICK OPTIMIZE ━━━
  const handleOptimize = useCallback((room) => {
    setOptimizing(prev => ({ ...prev, [room.room]: 'animating' }));

    // Simulate 1.5s turn-off animation
    setTimeout(() => {
      const result = optimizeRoom(room);
      setOptimResults(prev => ({ ...prev, [room.room]: result }));
      setOptimizing(prev => ({ ...prev, [room.room]: 'done' }));
      setLogVersion(v => v + 1);
    }, 1500);
  }, []);

  const handleMouseEnter = (e, room) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      visible: true,
      text: room.isIdle
        ? `⚠ Idle for ${room.idleMinutes} min — systems still running`
        : `✅ ${room.room} is active`,
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
    });
  };

  const handleMouseLeave = () => setTooltip(prev => ({ ...prev, visible: false }));

  const idleRooms = getIdleRooms(rooms);
  // Stat counts driven by energy waste level, not occupancy
  const wasteLow      = rooms.filter(r => getWasteLevel(r) <= 30).length;
  const wasteModerate = rooms.filter(r => { const w = getWasteLevel(r); return w > 30 && w <= 60; }).length;
  const wasteHigh     = rooms.filter(r => getWasteLevel(r) > 60).length;
  const optLog = getOptimizationLog();
  const optSummary = getOptimizationSummary();

  return (
    <div className="dashboard">
      <div className="heatmap-header">
        <div>
          <h2>🏢 Occupancy Heatmap</h2>
          <p className="subtitle">Digital Twin — Real-time room occupancy visualization</p>
        </div>
        <div className="live-indicator">
          <span className="pulse-dot live"></span> Live
        </div>
      </div>

      {/* Legend + Stats — energy waste based */}
      <div className="heatmap-stats">
        <div className="hm-stat"><span className="hm-dot green"></span><span>Low (≤30% waste)</span><strong>{wasteLow}</strong></div>
        <div className="hm-stat"><span className="hm-dot yellow"></span><span>Moderate (31–60%)</span><strong>{wasteModerate}</strong></div>
        <div className="hm-stat"><span className="hm-dot red"></span><span>High (&gt;60%)</span><strong>{wasteHigh}</strong></div>
        <div className="hm-stat total"><span>Total Rooms</span><strong>{rooms.length}</strong></div>
        {idleRooms.length > 0 && (
          <div className="hm-stat idle-stat"><span>⚠️ Idle</span><strong>{idleRooms.length}</strong></div>
        )}
      </div>

      {/* ━━━ IDLE ROOMS WITH OPTIMIZE ━━━ */}
      {idleRooms.length > 0 && (
        <div className="panel idle-panel">
          <h3>⚠️ Idle Rooms Detected</h3>
          <div className="idle-room-list">
            {idleRooms.map(room => {
              const state = optimizing[room.room];
              const result = optimResults[room.room];
              const subsystems = getRoomSubsystemStatus(room.room);

              return (
                <div key={room.room} className={`idle-optimize-card ${state === 'animating' ? 'optimizing' : ''} ${result ? 'optimized' : ''}`}>
                  <div className="ioc-header">
                    <div className="idle-room-icon">⚠</div>
                    <div className="idle-room-info">
                      <strong>Idle Room Detected</strong>
                      <span>Room: <em>{room.room}</em> — idle for <em>{room.idleMinutes} min</em></span>
                    </div>
                    <div className="idle-room-badge">⚠ Idle Resource</div>
                  </div>

                  {/* Subsystem Status */}
                  <div className="ioc-subsystems">
                    {subsystems.map(sub => (
                      <div key={sub.label} className={`subsys-chip ${state === 'animating' ? 'shutting-down' : ''} ${!sub.isRunning ? 'off' : ''}`}>
                        <span className={`subsys-dot ${sub.isRunning ? 'running' : 'stopped'}`}></span>
                        {sub.label}: {state === 'animating' ? 'Shutting down...' : sub.status}
                      </div>
                    ))}
                  </div>

                  {/* Optimize Button or Result */}
                  {result ? (
                    <div className="opt-result">
                      <div className="opt-result-icon">✅</div>
                      <div>
                        <strong>Optimization Complete</strong>
                        <span>Energy saved: {result.energySaved} kWh · Cost saved: ${result.costSaved.toFixed(2)}</span>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="btn-optimize"
                      onClick={() => handleOptimize(room)}
                      disabled={state === 'animating'}
                    >
                      {state === 'animating' ? (
                        <><span className="opt-spinner"></span> Optimizing...</>
                      ) : (
                        '⚡ Optimize Resource'
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ━━━ OPTIMIZATION LOG ━━━ */}
      {optLog.length > 0 && (
        <div className="panel opt-log-panel">
          <h3>
            📋 Optimization Log
            <span className="opt-summary">
              {optSummary.totalOptimizations} optimizations · {optSummary.totalEnergySaved} kWh · ${optSummary.totalCostSaved.toFixed(2)} saved
            </span>
          </h3>
          <div className="opt-log-list">
            {optLog.map(entry => (
              <div key={entry.id} className="opt-log-item">
                <div className="opt-log-room">✅ {entry.room}</div>
                <div className="opt-log-detail">
                  saved <strong>{entry.energySaved} kWh</strong> / <strong>${entry.costSaved.toFixed(2)}</strong>
                </div>
                <div className="opt-log-subs">
                  {entry.subsystems.map(s => (
                    <span key={s.id} className="opt-log-sub">{s.label} → {s.action}</span>
                  ))}
                </div>
                <div className="opt-log-time">{new Date(entry.timestamp).toLocaleTimeString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Heatmap Grid */}
      <div className="heatmap-grid">
        {rooms.map(room => {
          const wasteLevel = getWasteLevel(room);
          const wasteClass = getWasteClass(wasteLevel);
          const issue = getInfraIssue(room);

          // Idle rooms with active resources → HIGH (empty + resources burning = max waste)
          // Idle rooms with no resources    → LOW  (nothing running, no waste)
          // Occupied rooms                  → energy-waste color (always LOW since waste=0)
          // Empty non-idle rooms            → energy-waste color based on resources
          let color;
          if (room.isIdle) {
            const hasActiveResources = room.hvacOn || room.lightsOn;
            color = hasActiveResources
              ? { bg: 'rgba(239, 68, 68, 0.35)',  border: '#EF4444', text: '#F87171', label: 'HIGH' }
              : { bg: 'rgba(16, 185, 129, 0.25)', border: '#10B981', text: '#34D399', label: 'LOW' };
          } else {
            color = getWasteColor(wasteLevel);
          }
          return (
            <div
              key={room.room}
              className={`heatmap-tile ${room.isIdle ? 'tile-idle' : ''} ${issue ? `tile-issue-${issue}` : ''}`}
              style={{ background: color.bg, borderColor: color.border }}
              onMouseEnter={e => handleMouseEnter(e, room)}
              onMouseLeave={handleMouseLeave}
            >
              {room.isIdle && <div className="tile-idle-badge">⚠ IDLE</div>}
              <div className="tile-status" style={{ color: color.text }}>{color.label}</div>
              <div className="tile-room">{room.room}</div>

              {/* ── People count ── */}
              <div className="tile-people">
                <span className="tile-people-icon">👤</span>
                <span className="tile-people-count" style={{ color: color.text }}>
                  {room.occupancy}
                </span>
                <span className="tile-people-label">
                  {room.occupancy === 1 ? 'person' : 'people'}
                </span>
              </div>

              <div className="tile-count" style={{ color: color.text }}>
                {room.isIdle ? room.idleMinutes : '—'}
              </div>
              <div className="tile-unit">{room.isIdle ? 'min idle' : 'active'}</div>

              {/* ── Resource Status Chips ── */}
              <div className="tile-resources">
                <span className={`res-chip ${room.hvacOn ? 'res-on' : 'res-off'}`}>
                  ❄ HVAC {room.hvacOn ? 'ON' : 'OFF'}
                </span>
                <span className={`res-chip ${room.lightsOn ? 'res-on' : 'res-off'}`}>
                  💡 {room.lightsOn ? 'ON' : 'OFF'}
                </span>
              </div>

              {/* ── Infra Issue Badge ── */}
              {issue === 'energy-waste' && (
                <div className="infra-badge energy-waste-badge">
                  ⚡ Energy Waste
                  <span className="infra-badge-sub">
                    {[room.hvacOn && 'HVAC', room.lightsOn && 'Lights'].filter(Boolean).join(' + ')} ON while empty
                  </span>
                </div>
              )}
              {issue === 'comfort-risk' && (
                <div className="infra-badge comfort-risk-badge">
                  ❄ Comfort Risk
                  <span className="infra-badge-sub">HVAC OFF while occupied</span>
                </div>
              )}

              {/* ── Idle time bar (capped at 120 min = 100%) ── */}
              <div className="tile-bar">
                <div className="tile-bar-fill" style={{
                  width: `${Math.min((room.idleMinutes / 120) * 100, 100)}%`,
                  background: room.isIdle ? color.border : 'rgba(255,255,255,0.15)',
                }}></div>
              </div>

              {/* ── Energy Waste Meter ── */}
              <div className="waste-meter-wrap">
                <div className="waste-meter-header">
                  <span className="waste-meter-label">Energy Waste</span>
                  <span className={`waste-meter-pct waste-pct-${wasteClass}`}>{wasteLevel}%</span>
                </div>
                <div className="waste-meter">
                  <div className={`waste-meter-fill ${wasteClass}`} style={{ width: wasteLevel + '%' }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Energy Waste Monitor */}
      <EnergyWasteMonitor rooms={rooms} />

      {/* Tooltip */}
      {tooltip.visible && (
        <div className="heatmap-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          {tooltip.text}
        </div>
      )}

    </div>
  );
}
