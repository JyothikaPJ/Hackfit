import { useState, useRef, useEffect } from 'react';
import { generateResponse } from '../chatEngine';
import { getIdleRooms, detectAllIdleRooms } from '../idleDetector';
import { calculateTotalWaste } from '../energyCalculator';
import { getOptimizationLog, getOptimizationSummary } from '../optimizationEngine';

const API_URL = '/api/v1/chat';

const WELCOME_MSG = {
  role: 'ai',
  text: `👋 Hi! I'm your **Building AI Assistant** powered by AI.\n\nI can explain optimization decisions, report energy savings, and answer questions about room status.\n\nTry: *"Which rooms are idle?"* or type **help** for all commands.`,
};

const SUGGESTIONS = [
  'Which rooms are idle?',
  'How much energy was saved?',
  'Show optimization log',
  'How can I reduce energy waste?',
];

/**
 * Build a plain-English context string describing the live building state.
 * Sending natural language (not raw JSON) prevents the LLM from echoing JSON keys.
 */
function buildSystemData(rooms) {
  const withStatus = detectAllIdleRooms(rooms);
  const idleRooms  = getIdleRooms(withStatus);
  const vacantRooms = withStatus.filter(r => r.occupancy === 0 && !r.isIdle);
  const waste       = calculateTotalWaste(withStatus);
  const optSummary  = getOptimizationSummary();
  const optLog      = getOptimizationLog();

  const lines = [];

  // ── All rooms ──────────────────────────────────────────────────────────
  lines.push(`BUILDING OVERVIEW: ${rooms.length} rooms total`);
  lines.push('');
  lines.push('ROOM-BY-ROOM STATUS:');
  withStatus.forEach(r => {
    const level = r.occupancy === 0 ? 'VACANT'
                : r.occupancy <= 4  ? 'MODERATE OCCUPANCY'
                : 'HIGH OCCUPANCY';
    let note = '';
    if (r.isIdle)         note = ` — ⚠ IDLE for ${r.idleMinutes} minutes (HVAC + lights wasting energy)`;
    else if (r.occupancy === 0) note = ` — vacant for ${r.idleMinutes} min (not yet at 30-min idle threshold)`;
    lines.push(`  • ${r.room}: ${r.occupancy} people — ${level}${note}`);
  });
  lines.push('');

  // ── Idle summary ───────────────────────────────────────────────────────
  if (idleRooms.length > 0) {
    lines.push(`IDLE ROOMS (vacant 30+ minutes, actively wasting energy):`);
    idleRooms.forEach(r =>
      lines.push(`  • ${r.room} — idle ${r.idleMinutes} minutes`)
    );
  } else {
    lines.push('IDLE ROOMS: None have reached the 30-minute idle threshold yet.');
    if (vacantRooms.length > 0) {
      lines.push(`CURRENTLY VACANT (0 people, but under 30-min threshold):`);
      vacantRooms.forEach(r =>
        lines.push(`  • ${r.room} — vacant for ${r.idleMinutes} minutes`)
      );
    }
  }
  lines.push('');

  // ── Energy waste ───────────────────────────────────────────────────────
  lines.push(`ENERGY WASTE RIGHT NOW:`);
  lines.push(`  • ${waste.totalIdleRooms} idle rooms wasting ${waste.totalEnergyWasted} kWh ($${waste.totalCostLost.toFixed(2)} cost lost)`);
  if (waste.roomBreakdown?.length > 0) {
    waste.roomBreakdown.forEach(r =>
      lines.push(`  • ${r.room}: ${r.energyWasted} kWh ($${r.costLost.toFixed(2)})`)
    );
  }
  lines.push('');

  // ── Optimization history ───────────────────────────────────────────────
  lines.push(`OPTIMIZATION HISTORY: ${optSummary.totalOptimizations} rooms optimized, ${optSummary.totalEnergySaved} kWh saved total, $${optSummary.totalCostSaved.toFixed(2)} cost saved`);
  if (optLog.length > 0) {
    lines.push('RECENT OPTIMIZATIONS:');
    optLog.slice(0, 5).forEach(e =>
      lines.push(`  • ${e.room}: saved ${e.energySaved} kWh / $${e.costSaved.toFixed(2)}`)
    );
  }

  return lines.join('\n');
}

export default function AIChatPanel({ rooms, isOpen, onClose }) {
  const [messages, setMessages] = useState([WELCOME_MSG]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const sendMessage = async (text) => {
    const msg = text || input.trim();
    if (!msg || typing) return;

    const userMsg = { role: 'user', text: msg };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setTyping(true);

    try {
      // Try LLM API first
      const allMessages = [...messages, userMsg].filter(m => m !== WELCOME_MSG);
      const systemData = buildSystemData(rooms);

      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: allMessages, systemData }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.reply) {
          setMessages(prev => [...prev, { role: 'ai', text: data.reply }]);
          setTyping(false);
          return;
        }
      }
      throw new Error('API unavailable');
    } catch {
      // Fallback to rule-based engine
      const response = generateResponse(msg, rooms);
      setMessages(prev => [...prev, { role: 'ai', text: response }]);
      setTyping(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div className="chat-header-info">
          <span className="chat-avatar">🤖</span>
          <div>
            <strong>Building AI Assistant</strong>
            <span className="chat-status">● Online</span>
          </div>
        </div>
        <button className="chat-close" onClick={onClose}>✕</button>
      </div>

      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`chat-bubble ${msg.role}`}>
            {msg.role === 'ai' && <span className="bubble-avatar">🤖</span>}
            <div className="bubble-content">
              {msg.text.split('\n').map((line, j) => (
                <p key={j} dangerouslySetInnerHTML={{
                  __html: line
                    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*(.+?)\*/g, '<em>$1</em>')
                    || '&nbsp;'
                }} />
              ))}
            </div>
          </div>
        ))}

        {typing && (
          <div className="chat-bubble ai">
            <span className="bubble-avatar">🤖</span>
            <div className="bubble-content typing-dots">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick Suggestions */}
      <div className="chat-suggestions">
        {SUGGESTIONS.map(s => (
          <button key={s} className="suggestion-chip" onClick={() => sendMessage(s)}>
            {s}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="chat-input-bar">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about rooms, energy, optimizations..."
          className="chat-input"
        />
        <button className="chat-send" onClick={() => sendMessage()} disabled={!input.trim() || typing}>
          ➤
        </button>
      </div>
    </div>
  );
}
