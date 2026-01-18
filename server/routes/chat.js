const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { getDatabase } = require('../database/init');
const OpenAI = require('openai');

const router = express.Router();

// Create a local OpenAI client (keeps this route self-contained)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';

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
  if (!process.env.OPENAI_API_KEY) return safeSummaryFallback(messages);
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

async function getAssistantReply({ memorySummaries, messages }) {
  if (!process.env.OPENAI_API_KEY) {
    return `AI is not configured on the server yet. Set OPENAI_API_KEY and restart the backend.`;
  }

  const memoryBlock = (memorySummaries || []).length
    ? `\n\nSaved chat memory (summaries of the user's prior chats):\n${memorySummaries.map((s, i) => `(${i + 1}) ${s}`).join('\n')}\n`
    : '';

  const system = `You are a helpful, friendly AI chat assistant. Be conversational, ask clarifying questions when needed, and keep responses grounded and practical.${memoryBlock}
Use the saved chat memory as background context when it’s relevant. Do NOT invent details if memory doesn’t specify them.`;

  const res = await openai.chat.completions.create({
    model: CHAT_MODEL,
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

// Send a message (creates a conversation if needed)
router.post('/message', authenticateToken, async (req, res) => {
  const { conversationId, message, useMemory = true } = req.body || {};
  const userMessage = (message || '').toString().trim();
  if (!userMessage) return res.status(400).json({ error: 'message is required' });

  try {
    const db = getDatabase();
    const uid = req.user.userId;

    let convId = conversationId ? Number(conversationId) : null;
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
    let assistantText;
    try {
      assistantText = await getAssistantReply({
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

