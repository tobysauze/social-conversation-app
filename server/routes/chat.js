const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { getDatabase, dbPath, ensureSqliteUser } = require('../database/init');
const OpenAI = require('openai');

const router = express.Router();

// OpenRouter-only (OpenAI-compatible API)
const LLM_API_KEY = process.env.OPENROUTER_API_KEY;
const LLM_BASE_URL = 'https://openrouter.ai/api/v1';
const CHAT_MODEL =
  process.env.OPENROUTER_MODEL ||
  'openai/gpt-4o-mini';

const defaultHeaders = process.env.OPENROUTER_API_KEY
  ? {
      ...(process.env.OPENROUTER_SITE_URL ? { 'HTTP-Referer': process.env.OPENROUTER_SITE_URL } : {}),
      ...(process.env.OPENROUTER_APP_NAME ? { 'X-Title': process.env.OPENROUTER_APP_NAME } : {})
    }
  : undefined;

// Create a local OpenAI-compatible client
const openai = new OpenAI({
  apiKey: LLM_API_KEY,
  ...(LLM_BASE_URL ? { baseURL: LLM_BASE_URL } : {}),
  ...(defaultHeaders ? { defaultHeaders } : {})
});

function pickModel(req) {
  const headerModel = req.headers['x-llm-model'];
  const bodyModel = req.body?.model;
  const m = (bodyModel || headerModel || '').toString().trim();
  return m || CHAT_MODEL;
}

// OpenRouter model catalog (public) with lightweight caching
let openRouterModelsCache = {
  ts: 0,
  data: null
};
const OPENROUTER_MODELS_TTL_MS = 10 * 60 * 1000;

function toNumber(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function pricingPerMillion(pricing) {
  if (!pricing || typeof pricing !== 'object') return null;
  const out = {};
  for (const [k, v] of Object.entries(pricing)) {
    const perToken = toNumber(v);
    if (perToken === null) continue;
    out[k] = perToken * 1_000_000;
  }
  return Object.keys(out).length ? out : null;
}

async function fetchOpenRouterModels() {
  const now = Date.now();
  if (openRouterModelsCache.data && now - openRouterModelsCache.ts < OPENROUTER_MODELS_TTL_MS) {
    return openRouterModelsCache.data;
  }

  const resp = await fetch('https://openrouter.ai/api/v1/models');
  if (!resp.ok) {
    throw new Error(`OpenRouter models request failed: ${resp.status}`);
  }
  const json = await resp.json();
  const models = Array.isArray(json?.data) ? json.data : [];

  const normalized = models.map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    context_length: m.context_length,
    created: m.created,
    pricing: m.pricing || null,
    pricing_per_million: pricingPerMillion(m.pricing)
  }));

  openRouterModelsCache = { ts: now, data: normalized };
  return normalized;
}

// Simple endpoint to help verify which deploy is live
router.get('/_version', (_req, res) => {
  const provider = process.env.OPENROUTER_API_KEY ? 'openrouter' : 'none';
  return res.json({
    git: process.env.RENDER_GIT_COMMIT || process.env.COMMIT_REF || process.env.VERCEL_GIT_COMMIT_SHA || null,
    node: process.version,
    provider,
    model: CHAT_MODEL,
    has_llm_key: Boolean(LLM_API_KEY),
    db_path: dbPath,
    ts: new Date().toISOString()
  });
});

// List OpenRouter models (with pricing). Supports optional search query `q`.
router.get('/models', authenticateToken, async (req, res) => {
  try {
    const q = (req.query?.q || '').toString().trim().toLowerCase();
    const models = await fetchOpenRouterModels();
    const filtered = q
      ? models.filter((m) => (m.id || '').toLowerCase().includes(q) || (m.name || '').toLowerCase().includes(q))
      : models;
    filtered.sort((a, b) => (a.name || a.id || '').localeCompare(b.name || b.id || ''));
    return res.json({
      provider: 'openrouter',
      count: filtered.length,
      cached_at: openRouterModelsCache.ts ? new Date(openRouterModelsCache.ts).toISOString() : null,
      models: filtered
    });
  } catch (e) {
    console.error('OpenRouter models error:', e);
    return res.status(500).json({ error: 'Failed to load OpenRouter models' });
  }
});

// Authenticated DB sanity check (helps debug production write failures)
router.post('/_dbtest', authenticateToken, (req, res) => {
  try {
    const db = getDatabase();
    const uid = req.user.userId;
    ensureSqliteUser({ id: uid, email: req.user.email, name: req.user.email });
    const info = db
      .prepare(`INSERT INTO ai_conversations (user_id, title) VALUES (?, ?)`)
      .run(uid, `dbtest-${Date.now()}`);
    const convId = Number(info.lastInsertRowid);
    db.prepare(`DELETE FROM ai_conversations WHERE id = ? AND user_id = ?`).run(convId, uid);
    return res.json({ ok: true, db_path: dbPath });
  } catch (e) {
    const msg = e?.message || 'Unknown DB error';
    return res.status(500).json({
      ok: false,
      error: 'DB write failed',
      db_path: dbPath,
      message: msg
    });
  }
});

const nowSql = () => "DATETIME('now')";

function makeTitleFromMessage(msg) {
  const s = (msg || '').trim().replace(/\s+/g, ' ');
  if (!s) return 'New chat';
  return s.length > 60 ? `${s.slice(0, 57)}…` : s;
}

function safeSummaryFallback(messages) {
  const text = (messages || [])
    .filter(m => m.role === 'user')
    .map(m => m.content)
    .join('\n')
    .trim();
  if (!text) return null;
  const s = text.length > 400 ? `${text.slice(0, 397)}…` : text;
  return `User topics:\n- ${s.replace(/\n+/g, '\n- ')}`;
}

async function summarizeConversation(messages) {
  if (!LLM_API_KEY) return safeSummaryFallback(messages);
  const transcript = (messages || [])
    .slice(-24)
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');
  const prompt = `Summarize this conversation for future reference in a personal AI chat assistant.
Return a compact summary (max 8 bullet points) that captures:
- what the user was thinking/feeling
- key facts/preferences
- any decisions or next steps

Conversation:\n${transcript}\n
Return ONLY the bullet points.`;

  const res = await openai.chat.completions.create({
    model: CHAT_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 260
  });
  return res.choices?.[0]?.message?.content?.trim() || null;
}

async function getAssistantReply({ model, memorySummaries, messages }) {
  if (!LLM_API_KEY) {
    return `AI is not configured on the server yet. Set OPENROUTER_API_KEY and restart the backend.`;
  }

  const memoryBlock = (memorySummaries || []).length
    ? `\n\nSaved chat memory (summaries of the user's prior chats):\n${memorySummaries.map((s, i) => `(${i + 1}) ${s}`).join('\n')}\n`
    : '';

  const system = `You are a helpful, friendly AI chat assistant. Be conversational, ask clarifying questions when needed, and keep responses grounded and practical.${memoryBlock}
Use the saved chat memory as background context when it’s relevant. Do NOT invent details if memory doesn’t specify them.`;

  const res = await openai.chat.completions.create({
    model: model || CHAT_MODEL,
    messages: [
      { role: 'system', content: system },
      ...messages
    ],
    temperature: 0.7,
    max_tokens: 650
  });

  return res.choices?.[0]?.message?.content?.trim() || 'Sorry—no response.';
}

// List conversations
router.get('/conversations', authenticateToken, (req, res) => {
  try {
    const db = getDatabase();
    const rows = db.prepare(
      `SELECT id, title, summary, created_at, updated_at
       FROM ai_conversations
       WHERE user_id = ?
       ORDER BY updated_at DESC`
    ).all(req.user.userId);
    return res.json({ conversations: rows });
  } catch (e) {
    console.error('List conversations error:', e);
    return res.status(500).json({ error: 'Database error' });
  }
});

// Get messages for a conversation
router.get('/conversations/:id/messages', authenticateToken, (req, res) => {
  try {
    const conversationId = Number(req.params.id);
    const db = getDatabase();
    const conv = db.prepare(
      `SELECT id FROM ai_conversations WHERE id = ? AND user_id = ?`
    ).get(conversationId, req.user.userId);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });

    const rows = db.prepare(
      `SELECT id, role, content, created_at
       FROM ai_messages
       WHERE conversation_id = ?
       ORDER BY id ASC`
    ).all(conversationId);
    return res.json({ messages: rows });
  } catch (e) {
    console.error('Get messages error:', e);
    return res.status(500).json({ error: 'Database error' });
  }
});

// Rename a conversation
router.patch('/conversations/:id', authenticateToken, (req, res) => {
  try {
    const conversationId = Number(req.params.id);
    const title = (req.body?.title || '').toString().trim();
    if (!title) return res.status(400).json({ error: 'title is required' });

    const db = getDatabase();
    const uid = req.user.userId;
    ensureSqliteUser({ id: uid, email: req.user.email, name: req.user.email });

    const existing = db
      .prepare(`SELECT id FROM ai_conversations WHERE id = ? AND user_id = ?`)
      .get(conversationId, uid);
    if (!existing) return res.status(404).json({ error: 'Conversation not found' });

    db.prepare(
      `UPDATE ai_conversations
       SET title = ?, updated_at = ${nowSql()}
       WHERE id = ? AND user_id = ?`
    ).run(title, conversationId, uid);

    const row = db
      .prepare(`SELECT id, title, summary, created_at, updated_at FROM ai_conversations WHERE id = ? AND user_id = ?`)
      .get(conversationId, uid);
    return res.json({ conversation: row });
  } catch (e) {
    console.error('Rename conversation error:', e);
    return res.status(500).json({ error: 'Database error' });
  }
});

// Send a message (creates a conversation if needed)
router.post('/message', authenticateToken, async (req, res) => {
  const { conversationId, message, useMemory = true } = req.body || {};
  const userMessage = (message || '').toString().trim();
  if (!userMessage) return res.status(400).json({ error: 'message is required' });

  try {
    const db = getDatabase();
    const uid = req.user.userId;
    ensureSqliteUser({ id: uid, email: req.user.email, name: req.user.email });

    let convId = conversationId ? Number(conversationId) : null;
    try {
      if (convId) {
        const conv = db.prepare('SELECT id FROM ai_conversations WHERE id = ? AND user_id = ?').get(convId, uid);
        if (!conv) return res.status(404).json({ error: 'Conversation not found' });
      } else {
        const info = db.prepare(
          `INSERT INTO ai_conversations (user_id, title)
           VALUES (?, ?)`
        ).run(uid, makeTitleFromMessage(userMessage));
        convId = Number(info.lastInsertRowid);
      }

      // Insert user message
      db.prepare(
        `INSERT INTO ai_messages (conversation_id, role, content)
         VALUES (?, ?, ?)`
      ).run(convId, 'user', userMessage);
    } catch (dbWriteErr) {
      console.error('Chat DB write failed:', dbWriteErr);
      const msg = dbWriteErr?.message || 'Database write failed';
      const looksReadonly = /readonly|SQLITE_READONLY/i.test(msg);
      return res.status(500).json({
        error: looksReadonly
          ? 'Chat storage is read-only on the server. Configure a writable DATABASE_DIR or attach a persistent disk.'
          : 'Failed to save chat message',
        // Include error message so we can diagnose (permissions vs missing tables vs locks)
        message: msg
      });
    }

    // Load recent messages for this conversation
    const recentRows = db.prepare(
      `SELECT role, content
       FROM ai_messages
       WHERE conversation_id = ?
       ORDER BY id DESC
       LIMIT 24`
    ).all(convId).reverse();

    // Load memory summaries from other conversations
    const memorySummaries = useMemory
      ? db.prepare(
          `SELECT summary
           FROM ai_conversations
           WHERE user_id = ?
             AND id != ?
             AND summary IS NOT NULL
             AND TRIM(summary) != ''
           ORDER BY updated_at DESC
           LIMIT 8`
        ).all(uid, convId).map(r => r.summary)
      : [];

    // Get assistant reply; if OpenAI errors, degrade gracefully instead of 500-ing the whole request.
    const chosenModel = pickModel(req);

    let assistantText;
    try {
      assistantText = await getAssistantReply({
        model: chosenModel,
        memorySummaries,
        messages: recentRows
      });
    } catch (aiErr) {
      console.error('AI chat completion failed:', aiErr);
      const msg = aiErr?.message || 'Unknown error';
      assistantText =
        process.env.NODE_ENV === 'production'
          ? `The AI service is temporarily unavailable. Please try again in a minute.`
          : `AI call failed: ${msg}`;
    }

    // Insert assistant message
    db.prepare(
      `INSERT INTO ai_messages (conversation_id, role, content)
       VALUES (?, ?, ?)`
    ).run(convId, 'assistant', assistantText);

    // Update conversation updated_at
    db.prepare(
      `UPDATE ai_conversations
       SET updated_at = ${nowSql()}
       WHERE id = ? AND user_id = ?`
    ).run(convId, uid);

    // Refresh recent with assistant included for summary
    const recentWithAssistant = db.prepare(
      `SELECT role, content
       FROM ai_messages
       WHERE conversation_id = ?
       ORDER BY id DESC
       LIMIT 24`
    ).all(convId).reverse();

    // Update summary (best-effort)
    try {
      const summary = await summarizeConversation(recentWithAssistant);
      if (summary) {
        db.prepare(
          `UPDATE ai_conversations
           SET summary = ?, updated_at = ${nowSql()}
           WHERE id = ? AND user_id = ?`
        ).run(summary, convId, uid);
      }
    } catch (sumErr) {
      console.warn('Chat summary failed:', sumErr?.message);
    }

    return res.json({
      conversationId: convId,
      assistant: assistantText
    });
  } catch (e) {
    console.error('Chat message error:', e);
    return res.status(500).json({ error: 'Failed to send message' });
  }
});

// Delete a conversation
router.delete('/conversations/:id', authenticateToken, (req, res) => {
  try {
    const conversationId = Number(req.params.id);
    const db = getDatabase();
    const info = db.prepare(
      `DELETE FROM ai_conversations WHERE id = ? AND user_id = ?`
    ).run(conversationId, req.user.userId);
    if (!info.changes) return res.status(404).json({ error: 'Conversation not found' });
    return res.json({ status: 'deleted' });
  } catch (e) {
    console.error('Delete conversation error:', e);
    return res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;

