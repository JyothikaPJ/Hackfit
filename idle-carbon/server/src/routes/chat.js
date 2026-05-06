/**
 * AI Chat Route — Proxies chat requests to OpenRouter LLM API.
 * Tries multiple free models with automatic fallback.
 * The API key stays server-side (never exposed to the browser).
 */

const express = require('express');
const router = express.Router();

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const API_KEY = process.env.OPENROUTER_API_KEY;

// Models to try in order — if one is rate-limited, try the next
const MODELS = [
  'google/gemma-3-12b-it:free',
  'google/gemma-3-27b-it:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'mistralai/mistral-small-3.1-24b-instruct:free',
  'qwen/qwen3-4b:free',
  'nvidia/nemotron-nano-9b-v2:free',
  'google/gemma-3-4b-it:free',
];

// System prompt with full building context
const SYSTEM_PROMPT = `You are the Idle Carbon AI Assistant — a smart building optimization advisor built into an Enterprise Sustainability platform.

You help users understand their building's energy usage, idle room detection, optimization decisions, and zombie resource detection.

SYSTEM CONTEXT:
- Platform: "Idle Carbon Budget + Idle Infrastructure Detector"
- Monitors room occupancy via IoT sensors and cloud infrastructure via APIs
- Rooms with 0 occupancy for 30+ minutes → flagged as "idle"
- Idle rooms waste energy: HVAC, lights, and servers keep running
- Users can "Optimize" idle rooms → turns off HVAC, lights, puts servers to sleep
- Energy rate: 3 kWh/hour per room, electricity cost: $0.20/kWh
- A room with 0 people is VACANT. It becomes IDLE after 30 minutes of being vacant.

ZOMBIE RESOURCE TYPES:
- 🧟 Zombie VM: running but CPU < 5%
- 💤 Sleeping Server: idle for 2+ hours with no requests
- ⚡ Energy Vampire: high energy draw with zero occupancy

FEATURES:
- Digital Twin Occupancy Heatmap with color-coded rooms (green=vacant, yellow=moderate, red=high)
- Idle Room Detection with 30-minute threshold
- Energy Waste Counter showing kWh wasted and cost lost
- One-Click Optimization to shut down idle room subsystems
- Zombie Resource Monitor to detect and fix wasteful infrastructure
- Fairness-based leaderboard ranking departments by improvement %

CRITICAL INSTRUCTIONS:
- Live building data is provided to you before each question — ALWAYS use it to give specific answers
- NEVER say you need more data if the building data is already provided above
- NEVER quote raw field names, JSON keys, or variable names (like "idleRooms" or "totalRooms") — speak in plain English
- Reference actual room names (Room A, Room G, etc.) and real numbers from the data
- If no rooms are idle yet, explain why (e.g. "Room G is vacant but has only been empty for 15 minutes, below the 30-minute threshold")
- Be conversational, helpful, and concise (2-5 sentences unless detail is requested)
- Use emoji naturally to make responses engaging`;

/**
 * Try calling OpenRouter with each model until one works.
 */
async function callLLM(llmMessages) {
  for (const model of MODELS) {
    try {
      const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:5173',
          'X-Title': 'Idle Carbon AI Assistant',
        },
        body: JSON.stringify({
          model,
          messages: llmMessages,
          max_tokens: 500,
          temperature: 0.7,
        }),
      });

      const data = await response.json();

      if (data.choices?.[0]?.message?.content) {
        console.log(`✅ LLM response from ${model}`);
        return data.choices[0].message.content;
      }

      // Rate limited or error — try next model
      console.log(`⚠️ ${model} failed: ${data.error?.message?.slice(0, 80) || 'unknown'}`);
    } catch (err) {
      console.log(`❌ ${model} error: ${err.message}`);
    }
  }

  return null; // All models failed
}

router.post('/', async (req, res) => {
  try {
    const { messages, systemData } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    if (!API_KEY) {
      return res.status(500).json({ error: 'OpenRouter API key not configured' });
    }

    // Build the context-enriched prompt
    const llmMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
    ];

    // Inject current system data as context — sent as pre-formatted plain English
    if (systemData) {
      const dataText = typeof systemData === 'string'
        ? systemData
        : JSON.stringify(systemData, null, 2);
      llmMessages.push({
        role: 'system',
        content: `LIVE BUILDING DATA (answer from this — do NOT ask the user for data that is already here):\n\n${dataText}`,
      });
    }

    // Add conversation messages
    messages.forEach(msg => {
      llmMessages.push({
        role: msg.role === 'ai' ? 'assistant' : 'user',
        content: msg.text,
      });
    });

    const reply = await callLLM(llmMessages);

    if (reply) {
      res.json({ success: true, reply });
    } else {
      res.status(502).json({ error: 'All LLM models are currently rate-limited. Please try again in a minute.' });
    }
  } catch (err) {
    console.error('Chat route error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
