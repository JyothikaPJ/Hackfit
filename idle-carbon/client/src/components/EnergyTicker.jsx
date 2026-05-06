/**
 * EnergyTicker.jsx — Live energy emergency headline strip.
 * Shown globally at the top of every manager page.
 */

function buildHeadlines(metrics, pendingCount) {
  const totalKwh  = metrics.reduce((s, m) => s + (m.usageValue  || 0), 0);
  const totalCost = metrics.reduce((s, m) => s + (m.costSaved   || 0), 0);
  const totalCO2  = metrics.reduce((s, m) => s + (m.carbonSaved || 0), 0);
  const hvac      = metrics.filter(m => m.type === 'hvac');
  const cloud     = metrics.filter(m => m.type === 'cloud');
  const lighting  = metrics.filter(m => m.type === 'lighting');
  const worst     = [...metrics].sort((a, b) => (b.usageValue || 0) - (a.usageValue || 0))[0];

  const lines = [];

  if (metrics.length > 0)
    lines.push(`⚡ ALERT — ${metrics.length} idle system${metrics.length > 1 ? 's' : ''} in your department consuming ${totalKwh.toFixed(1)} kWh RIGHT NOW`);
  if (totalCost > 0)
    lines.push(`💸 Every minute of inaction costs $${(totalCost / 60).toFixed(3)} — projected daily loss: $${(totalCost * 24).toFixed(2)}`);
  if (worst)
    lines.push(`🔥 TOP OFFENDER: ${worst.resourceId} — ${(worst.usageValue || 0).toFixed(1)} kWh wasted while completely idle`);
  if (hvac.length > 0)
    lines.push(`🌡 ${hvac.length} HVAC unit${hvac.length > 1 ? 's' : ''} running in empty rooms — $${hvac.reduce((s, m) => s + (m.costSaved || 0), 0).toFixed(2)} burned per cycle`);
  if (cloud.length > 0)
    lines.push(`🧟 ${cloud.length} zombie cloud VM${cloud.length > 1 ? 's' : ''} at <5% CPU — $${cloud.reduce((s, m) => s + (m.costSaved || 0), 0).toFixed(2)} for zero output`);
  if (lighting.length > 0)
    lines.push(`💡 ${lighting.length} lighting circuit${lighting.length > 1 ? 's' : ''} on in unoccupied zones — shut them down now`);
  if (pendingCount > 0)
    lines.push(`⏳ ${pendingCount} optimization action${pendingCount > 1 ? 's' : ''} awaiting your approval — every delay is measured in dollars`);
  if (totalCO2 > 0)
    lines.push(`🌍 Idle systems emitting ${totalCO2.toFixed(1)} kg CO₂ — act now to reduce your carbon footprint`);
  if (totalCost > 0)
    lines.push(`💰 Fixing ALL idle resources saves an estimated $${totalCost.toFixed(2)} — approve pending actions`);

  if (lines.length === 0)
    lines.push('✅ No idle resources detected — your department is running efficiently right now');

  return lines;
}

export default function EnergyTicker({ metrics = [], pendingCount = 0 }) {
  const headlines = buildHeadlines(metrics, pendingCount);
  const all = [...headlines, ...headlines]; // duplicate for seamless CSS loop

  return (
    <div className="energy-ticker">
      <div className="ticker-badge">
        <div className="ticker-dot" />
        <span className="ticker-label">Energy Alert</span>
      </div>
      <div className="ticker-track">
        <div className="ticker-content">
          {all.map((h, i) => (
            <span key={i} className="ticker-item">
              {h}
              <span className="ticker-sep">◆</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
