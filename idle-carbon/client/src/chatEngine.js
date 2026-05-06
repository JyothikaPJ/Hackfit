/**
 * chatEngine.js — AI Chat Response Engine
 *
 * Rule-based template engine that reads live system data
 * and generates natural-language responses.
 *
 * Can be swapped with an LLM API wrapper later — just replace
 * the `generateResponse()` function with an API call.
 */

import { getIdleRooms, detectAllIdleRooms } from './idleDetector';
import { calculateTotalWaste } from './energyCalculator';
import { getOptimizationLog, getOptimizationSummary } from './optimizationEngine';

// ━━━━━━━ INTENT MATCHING ━━━━━━━
const INTENTS = [
  {
    id: 'why_optimized',
    patterns: [/why\s+was\s+(.+?)\s+optimized/i, /why\s+did\s+(.+?)\s+get\s+optimized/i, /explain\s+(.+?)\s+optimization/i],
    handler: handleWhyOptimized,
  },
  {
    id: 'energy_saved',
    patterns: [/how\s+much\s+energy/i, /energy\s+saved/i, /total\s+savings/i, /kWh\s+saved/i],
    handler: handleEnergySaved,
  },
  {
    id: 'idle_rooms',
    patterns: [/which\s+rooms?\s+(?:are|is)\s+idle/i, /idle\s+rooms?/i, /unused\s+rooms?/i, /vacant\s+rooms?/i],
    handler: handleIdleRooms,
  },
  {
    id: 'cost_saved',
    patterns: [/cost\s+(?:saved|lost)/i, /how\s+much\s+money/i, /dollar/i, /\$.*saved/i],
    handler: handleCostSaved,
  },
  {
    id: 'optimization_log',
    patterns: [/optimization\s+(?:log|history|record)/i, /what\s+was\s+optimized/i, /show\s+log/i],
    handler: handleOptLog,
  },
  {
    id: 'room_status',
    patterns: [/(?:status|info)\s+(?:of|for)\s+(.+)/i, /how\s+is\s+(.+)/i, /tell\s+me\s+about\s+(.+)/i],
    handler: handleRoomStatus,
  },
  {
    id: 'energy_waste',
    patterns: [/energy\s+wast/i, /wasted\s+energy/i, /how\s+much.*wast/i],
    handler: handleEnergyWaste,
  },
  {
    id: 'help',
    patterns: [/help/i, /what\s+can\s+you/i, /how\s+to\s+use/i, /commands/i],
    handler: handleHelp,
  },
];

// ━━━━━━━ MAIN RESPONSE GENERATOR ━━━━━━━
/**
 * Generate a response for a user message.
 * Replace this function with an LLM API call for production.
 *
 * @param {string} message — user input
 * @param {Array}  rooms   — current room state array
 * @returns {string}       — AI response text
 */
export function generateResponse(message, rooms) {
  const trimmed = message.trim();
  if (!trimmed) return "Please type a question about the building systems.";

  for (const intent of INTENTS) {
    for (const pattern of intent.patterns) {
      const match = trimmed.match(pattern);
      if (match) {
        return intent.handler(match, rooms);
      }
    }
  }

  return handleFallback(trimmed, rooms);
}

// ━━━━━━━ INTENT HANDLERS ━━━━━━━

function handleWhyOptimized(match, rooms) {
  const roomQuery = match[1]?.trim();
  const log = getOptimizationLog();
  const entry = log.find(e =>
    e.room.toLowerCase().includes(roomQuery.toLowerCase())
  );

  if (!entry) {
    return `I don't have a record of ${roomQuery} being optimized. It may not have been optimized yet, or the room name might be different.`;
  }

  const lines = [
    `**${entry.room}** was optimized because:`,
    `• It had **zero occupancy** for **${entry.idleMinutes} minutes** (${(entry.idleMinutes / 60).toFixed(1)} hours).`,
    `• The following systems were still consuming energy:`,
  ];
  entry.subsystems.forEach(sub => {
    lines.push(`  → **${sub.label}** was ${sub.action} (saved ${sub.energySaved} kWh)`);
  });
  lines.push(`\n**Total saved:** ${entry.energySaved} kWh / $${entry.costSaved.toFixed(2)}`);
  return lines.join('\n');
}

function handleEnergySaved(match, rooms) {
  const summary = getOptimizationSummary();
  const waste = calculateTotalWaste(rooms);

  if (summary.totalOptimizations === 0) {
    return `No optimizations have been performed yet. Currently, idle rooms are wasting approximately **${waste.totalEnergyWasted} kWh**. Consider optimizing them!`;
  }

  return [
    `📊 **Energy Savings Summary:**`,
    `• **${summary.totalOptimizations}** rooms optimized`,
    `• **${summary.totalEnergySaved} kWh** total energy saved`,
    `• **$${summary.totalCostSaved.toFixed(2)}** total cost saved`,
    ``,
    waste.totalIdleRooms > 0
      ? `⚠️ There are still **${waste.totalIdleRooms}** idle rooms wasting **${waste.totalEnergyWasted} kWh**. You can optimize them to save more.`
      : `✅ All idle rooms have been addressed!`,
  ].join('\n');
}

function handleIdleRooms(match, rooms) {
  const idle = getIdleRooms(detectAllIdleRooms(rooms));

  if (idle.length === 0) {
    return `✅ No idle rooms detected right now. All rooms are either occupied or haven't been idle long enough (threshold: 30 minutes).`;
  }

  const lines = [`⚠️ **${idle.length} idle room(s) detected:**\n`];
  idle.forEach(r => {
    lines.push(`• **${r.room}** — idle for **${r.idleMinutes} minutes** (occupancy: ${r.occupancy})`);
  });
  lines.push(`\nThese rooms still have HVAC, lights, and servers running. Click **"Optimize Resource"** on the Heatmap page to save energy.`);
  return lines.join('\n');
}

function handleCostSaved(match, rooms) {
  const summary = getOptimizationSummary();
  const waste = calculateTotalWaste(rooms);

  const lines = [`💰 **Cost Analysis:**\n`];
  if (summary.totalOptimizations > 0) {
    lines.push(`• Cost saved from optimizations: **$${summary.totalCostSaved.toFixed(2)}**`);
  }
  if (waste.totalIdleRooms > 0) {
    lines.push(`• Cost currently being lost to idle rooms: **$${waste.totalCostLost.toFixed(2)}**`);
    lines.push(`\nOptimize the remaining ${waste.totalIdleRooms} idle room(s) to save an additional $${waste.totalCostLost.toFixed(2)}.`);
  } else if (summary.totalOptimizations === 0) {
    lines.push(`No optimizations performed yet and no idle rooms detected.`);
  }
  return lines.join('\n');
}

function handleOptLog(match, rooms) {
  const log = getOptimizationLog();

  if (log.length === 0) {
    return `📋 The optimization log is empty. No rooms have been optimized yet. Go to the Heatmap page and click **"Optimize Resource"** on idle rooms.`;
  }

  const lines = [`📋 **Optimization Log** (${log.length} entries):\n`];
  log.forEach(entry => {
    const time = new Date(entry.timestamp).toLocaleTimeString();
    lines.push(`• **${entry.room}** — saved **${entry.energySaved} kWh** / **$${entry.costSaved.toFixed(2)}** at ${time}`);
  });
  return lines.join('\n');
}

function handleRoomStatus(match, rooms) {
  const roomQuery = match[1]?.trim();
  const room = rooms.find(r =>
    r.room.toLowerCase().includes(roomQuery.toLowerCase())
  );

  if (!room) {
    return `I couldn't find a room matching "${roomQuery}". Available rooms: ${rooms.map(r => r.room).join(', ')}`;
  }

  const lines = [`🏢 **${room.room} Status:**\n`];
  lines.push(`• Occupancy: **${room.occupancy} people**`);
  lines.push(`• Status: **${room.isIdle ? '⚠️ Idle' : '✅ Active'}**`);
  if (room.isIdle) {
    lines.push(`• Idle for: **${room.idleMinutes} minutes**`);
    lines.push(`\n💡 Recommendation: Optimize this room to save energy.`);
  }
  return lines.join('\n');
}

function handleEnergyWaste(match, rooms) {
  const waste = calculateTotalWaste(rooms);

  if (waste.totalIdleRooms === 0) {
    return `✅ No energy is currently being wasted — no rooms are idle.`;
  }

  const lines = [`⚡ **Energy Waste Report:**\n`];
  lines.push(`• **${waste.totalIdleRooms}** rooms currently idle`);
  lines.push(`• **${waste.totalEnergyWasted} kWh** being wasted`);
  lines.push(`• **$${waste.totalCostLost.toFixed(2)}** cost lost`);
  lines.push(`\nBreakdown per room:`);
  waste.roomBreakdown.forEach(r => {
    lines.push(`  • ${r.room}: ${r.energyWasted} kWh ($${r.costLost.toFixed(2)})`);
  });
  return lines.join('\n');
}

function handleHelp() {
  return [
    `🤖 **I can help you with:**\n`,
    `• **"Which rooms are idle?"** — see currently unused rooms`,
    `• **"Why was Room B optimized?"** — explain optimization decisions`,
    `• **"How much energy was saved?"** — total savings summary`,
    `• **"How much energy is being wasted?"** — current waste report`,
    `• **"Cost saved today"** — financial impact`,
    `• **"Show optimization log"** — full history`,
    `• **"Status of Room A"** — check a specific room`,
  ].join('\n');
}

function handleFallback(message, rooms) {
  const idle = getIdleRooms(detectAllIdleRooms(rooms));
  const summary = getOptimizationSummary();

  return [
    `I'm not sure I understand that question. Here's a quick overview:\n`,
    `• **${idle.length}** idle rooms detected`,
    `• **${summary.totalOptimizations}** optimizations performed`,
    `• **${summary.totalEnergySaved} kWh** total energy saved`,
    `\nTry asking: "Which rooms are idle?" or "How much energy was saved?" — or type **"help"** for all commands.`,
  ].join('\n');
}
