import { useState, useEffect, useRef } from 'react';

// ━━━━━━━ ENERGY MODEL ━━━━━━━
const ENERGY_kWh = {
  hvac:      3.0,
  lights:    0.5,
  projector: 1.0,
  computers: 0.7,
};

function calcEnergy(room) {
  let total = 0;
  if (room.hvacOn)      total += ENERGY_kWh.hvac;
  if (room.lightsOn)    total += ENERGY_kWh.lights;
  if (room.projectorOn) total += ENERGY_kWh.projector;
  if (room.computersOn) total += ENERGY_kWh.computers;
  return Math.round(total * 10) / 10; // 1 decimal place
}

// ━━━━━━━ STATUS / COLOR — ENERGY ONLY ━━━━━━━
function getEnergyStatus(kwh) {
  if (kwh <= 1.5)  return { label: 'LOW',      bg: 'rgba(16,185,129,0.2)',  border: '#10B981', text: '#34D399', barColor: '#10B981' };
  if (kwh <= 3.5)  return { label: 'MODERATE', bg: 'rgba(245,158,11,0.2)', border: '#F59E0B', text: '#FBBF24', barColor: '#F59E0B' };
  return            { label: 'HIGH',     bg: 'rgba(239,68,68,0.2)',  border: '#EF4444', text: '#F87171', barColor: '#EF4444' };
}

// ━━━━━━━ RESOURCE SIMULATION ━━━━━━━
const ROOMS = [
  'Room A', 'Room B', 'Room C', 'Room D',
  'Room E', 'Room F', 'Room G', 'Room H',
  'Boardroom', 'Lab 1', 'Lab 2', 'Lobby',
];

function generateRoomStates() {
  return ROOMS.map(name => {
    const hvacOn      = Math.random() > 0.5;
    const lightsOn    = Math.random() > 0.4;
    const projectorOn = Math.random() > 0.7;
    const computersOn = Math.random() > 0.3;
    const occupancy   = Math.floor(Math.random() * 11); // informational only
    return { name, hvacOn, lightsOn, projectorOn, computersOn, occupancy };
  });
}

// Active resource descriptors
const RESOURCE_META = [
  { key: 'hvacOn',      icon: '❄',  label: 'HVAC'      },
  { key: 'lightsOn',    icon: '💡', label: 'Lights'     },
  { key: 'projectorOn', icon: '📽', label: 'Projector'  },
  { key: 'computersOn', icon: '🖥', label: 'Computers'  },
];

// ━━━━━━━ COMPONENT ━━━━━━━
export default function BuildingHeatmap() {
  const [rooms, setRooms] = useState(() => generateRoomStates());
  const intervalRef = useRef(null);

  // Refresh resource states every 5 seconds (simulation tick)
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setRooms(generateRoomStates());
    }, 5000);
    return () => clearInterval(intervalRef.current);
  }, []);

  // Derived stats for header strip
  const energyValues = rooms.map(r => calcEnergy(r));
  const low      = rooms.filter((_, i) => energyValues[i] <= 1.5).length;
  const moderate = rooms.filter((_, i) => energyValues[i] > 1.5 && energyValues[i] <= 3.5).length;
  const high     = rooms.filter((_, i) => energyValues[i] > 3.5).length;
  const totalKwh = energyValues.reduce((a, b) => a + b, 0).toFixed(1);

  return (
    <div className="dashboard">

      {/* ━━━ Header ━━━ */}
      <div className="heatmap-header">
        <div>
          <h2>🏢 Building Heatmap</h2>
          <p className="subtitle">Energy-based room status — Digital Twin live view</p>
        </div>
        <div className="live-indicator">
          <span className="pulse-dot live"></span> Live
        </div>
      </div>

      {/* ━━━ Legend / Stats strip ━━━ */}
      <div className="heatmap-stats">
        <div className="hm-stat"><span className="hm-dot green"></span><span>Low (≤1.5 kWh)</span><strong>{low}</strong></div>
        <div className="hm-stat"><span className="hm-dot yellow"></span><span>Moderate (1.6–3.5 kWh)</span><strong>{moderate}</strong></div>
        <div className="hm-stat"><span className="hm-dot red"></span><span>High (&gt;3.5 kWh)</span><strong>{high}</strong></div>
        <div className="hm-stat total"><span>Total Rooms</span><strong>{rooms.length}</strong></div>
        <div className="hm-stat total"><span>⚡ Total Energy</span><strong>{totalKwh} kWh</strong></div>
      </div>

      {/* ━━━ Heatmap Grid ━━━ */}
      <div className="heatmap-grid">
        {rooms.map((room, idx) => {
          const kwh    = energyValues[idx];
          const status = getEnergyStatus(kwh);
          const activeResources = RESOURCE_META.filter(r => room[r.key]);
          // Energy bar — max scale is 5.2 kWh (all resources on)
          const barPct = Math.min((kwh / 5.2) * 100, 100);

          return (
            <div
              key={room.name}
              className="heatmap-tile"
              style={{ background: status.bg, borderColor: status.border }}
            >
              {/* Status label */}
              <div
                className="bh-status-badge"
                style={{ background: status.border + '33', color: status.text, borderColor: status.border }}
              >
                {status.label}
              </div>

              {/* Room name */}
              <div className="tile-room" style={{ marginTop: '0.4rem' }}>{room.name}</div>

              {/* Energy value */}
              <div className="bh-energy-value" style={{ color: status.text }}>
                {kwh} <span className="bh-energy-unit">kWh</span>
              </div>

              {/* Energy bar */}
              <div className="tile-bar" style={{ marginBottom: '0.75rem' }}>
                <div
                  className="tile-bar-fill"
                  style={{ width: `${barPct}%`, background: status.barColor }}
                />
              </div>

              {/* Resources running */}
              <div className="bh-resources-heading">Resources Running</div>
              {activeResources.length > 0 ? (
                <div className="tile-resources">
                  {activeResources.map(r => (
                    <span key={r.key} className="res-chip res-on">
                      {r.icon} {r.label}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="bh-no-resources">None</div>
              )}

              {/* Occupancy (informational only — does NOT affect color) */}
              <div className="bh-occupancy-info">
                👤 {room.occupancy} {room.occupancy === 1 ? 'person' : 'people'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
import { useState, useEffect, useRef } from 'react';

// ━━━━━━━ ENERGY MODEL ━━━━━━━
const ENERGY_kWh = {
  hvac:      3.0,
  lights:    0.5,
  projector: 1.0,
  computers: 0.7,
};

function calcEnergy(room) {
  let total = 0;
  if (room.hvacOn)      total += ENERGY_kWh.hvac;
  if (room.lightsOn)    total += ENERGY_kWh.lights;
  if (room.projectorOn) total += ENERGY_kWh.projector;
  if (room.computersOn) total += ENERGY_kWh.computers;
  return Math.round(total * 10) / 10; // 1 decimal place
}

// ━━━━━━━ STATUS / COLOR — ENERGY ONLY ━━━━━━━
function getEnergyStatus(kwh) {
  if (kwh <= 1.5)  return { label: 'LOW',      bg: 'rgba(16,185,129,0.2)',  border: '#10B981', text: '#34D399', barColor: '#10B981' };
  if (kwh <= 3.5)  return { label: 'MODERATE', bg: 'rgba(245,158,11,0.2)', border: '#F59E0B', text: '#FBBF24', barColor: '#F59E0B' };
  return            { label: 'HIGH',     bg: 'rgba(239,68,68,0.2)',  border: '#EF4444', text: '#F87171', barColor: '#EF4444' };
}

// ━━━━━━━ RESOURCE SIMULATION ━━━━━━━
const ROOMS = [
  'Room A', 'Room B', 'Room C', 'Room D',
  'Room E', 'Room F', 'Room G', 'Room H',
  'Boardroom', 'Lab 1', 'Lab 2', 'Lobby',
];

function generateRoomStates() {
  return ROOMS.map(name => {
    const hvacOn      = Math.random() > 0.5;
    const lightsOn    = Math.random() > 0.4;
    const projectorOn = Math.random() > 0.7;
    const computersOn = Math.random() > 0.3;
    const occupancy   = Math.floor(Math.random() * 11); // informational only
    return { name, hvacOn, lightsOn, projectorOn, computersOn, occupancy };
  });
}

// Active resource descriptors
const RESOURCE_META = [
  { key: 'hvacOn',      icon: '❄',  label: 'HVAC'      },
  { key: 'lightsOn',    icon: '💡', label: 'Lights'     },
  { key: 'projectorOn', icon: '📽', label: 'Projector'  },
  { key: 'computersOn', icon: '🖥', label: 'Computers'  },
];

// ━━━━━━━ COMPONENT ━━━━━━━
export default function BuildingHeatmap() {
  const [rooms, setRooms] = useState(() => generateRoomStates());
  const intervalRef = useRef(null);

  // Refresh resource states every 5 seconds (simulation tick)
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setRooms(generateRoomStates());
    }, 5000);
    return () => clearInterval(intervalRef.current);
  }, []);

  // Derived stats for header strip
  const energyValues = rooms.map(r => calcEnergy(r));
  const low      = rooms.filter((_, i) => energyValues[i] <= 1.5).length;
  const moderate = rooms.filter((_, i) => energyValues[i] > 1.5 && energyValues[i] <= 3.5).length;
  const high     = rooms.filter((_, i) => energyValues[i] > 3.5).length;
  const totalKwh = energyValues.reduce((a, b) => a + b, 0).toFixed(1);

  return (
    <div className="dashboard">

      {/* ━━━ Header ━━━ */}
      <div className="heatmap-header">
        <div>
          <h2>🏢 Building Heatmap</h2>
          <p className="subtitle">Energy-based room status — Digital Twin live view</p>
        </div>
        <div className="live-indicator">
          <span className="pulse-dot live"></span> Live
        </div>
      </div>

      {/* ━━━ Legend / Stats strip ━━━ */}
      <div className="heatmap-stats">
        <div className="hm-stat"><span className="hm-dot green"></span><span>Low (≤1.5 kWh)</span><strong>{low}</strong></div>
        <div className="hm-stat"><span className="hm-dot yellow"></span><span>Moderate (1.6–3.5 kWh)</span><strong>{moderate}</strong></div>
        <div className="hm-stat"><span className="hm-dot red"></span><span>High (&gt;3.5 kWh)</span><strong>{high}</strong></div>
        <div className="hm-stat total"><span>Total Rooms</span><strong>{rooms.length}</strong></div>
        <div className="hm-stat total"><span>⚡ Total Energy</span><strong>{totalKwh} kWh</strong></div>
      </div>

      {/* ━━━ Heatmap Grid ━━━ */}
      <div className="heatmap-grid">
        {rooms.map((room, idx) => {
          const kwh    = energyValues[idx];
          const status = getEnergyStatus(kwh);
          const activeResources = RESOURCE_META.filter(r => room[r.key]);
          // Energy bar — max scale is 5.2 kWh (all resources on)
          const barPct = Math.min((kwh / 5.2) * 100, 100);

          return (
            <div
              key={room.name}
              className="heatmap-tile"
              style={{ background: status.bg, borderColor: status.border }}
            >
              {/* Status label */}
              <div
                className="bh-status-badge"
                style={{ background: status.border + '33', color: status.text, borderColor: status.border }}
              >
                {status.label}
              </div>

              {/* Room name */}
              <div className="tile-room" style={{ marginTop: '0.4rem' }}>{room.name}</div>

              {/* Energy value */}
              <div className="bh-energy-value" style={{ color: status.text }}>
                {kwh} <span className="bh-energy-unit">kWh</span>
              </div>

              {/* Energy bar */}
              <div className="tile-bar" style={{ marginBottom: '0.75rem' }}>
                <div
                  className="tile-bar-fill"
                  style={{ width: `${barPct}%`, background: status.barColor }}
                />
              </div>

              {/* Resources running */}
              <div className="bh-resources-heading">Resources Running</div>
              {activeResources.length > 0 ? (
                <div className="tile-resources">
                  {activeResources.map(r => (
                    <span key={r.key} className="res-chip res-on">
                      {r.icon} {r.label}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="bh-no-resources">None</div>
              )}

              {/* Occupancy (informational only — does NOT affect color) */}
              <div className="bh-occupancy-info">
                👤 {room.occupancy} {room.occupancy === 1 ? 'person' : 'people'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
