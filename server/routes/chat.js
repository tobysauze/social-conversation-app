const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { prisma } = require('../prisma/client');
const OpenAI = require('openai');

const router = express.Router();

const LLM_API_KEY = process.env.OPENROUTER_API_KEY;
const LLM_BASE_URL = 'https://openrouter.ai/api/v1';
const CHAT_MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';

const defaultHeaders = process.env.OPENROUTER_API_KEY
  ? {
      ...(process.env.OPENROUTER_SITE_URL ? { 'HTTP-Referer': process.env.OPENROUTER_SITE_URL } : {}),
      ...(process.env.OPENROUTER_APP_NAME ? { 'X-Title': process.env.OPENROUTER_APP_NAME } : {})
    }
  : undefined;

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

let openRouterModelsCache = { ts: 0, data: null };
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
  if (!resp.ok) throw new Error(`OpenRouter models request failed: ${resp.status}`);
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

router.get('/_version', (_req, res) => {
  return res.json({
    git: process.env.RENDER_GIT_COMMIT || process.env.COMMIT_REF || process.env.VERCEL_GIT_COMMIT_SHA || null,
    node: process.version,
    provider: process.env.OPENROUTER_API_KEY ? 'openrouter' : 'none',
    model: CHAT_MODEL,
    has_llm_key: Boolean(LLM_API_KEY),
    db: 'postgres',
    ts: new Date().toISOString()
  });
});

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

router.post('/_dbtest', authenticateToken, async (req, res) => {
  try {
    const conv = await prisma.aiConversation.create({
      data: { userId: req.user.userId, title: `dbtest-${Date.now()}` }
    });
    await prisma.aiConversation.delete({ where: { id: conv.id } });
    return res.json({ ok: true, db: 'postgres' });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: 'DB write failed',
      message: e?.message || 'Unknown error'
    });
  }
});

async function getPersonContextForUser(userId, personId) {
  if (!personId) return '';
  const person = await prisma.person.findFirst({
    where: { id: Number(personId), userId: Number(userId) }
  });
  if (!person) return '';

  const safeList = (value) => {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  };

  const interests = safeList(person.interests);
  const traits = safeList(person.personalityTraits);
  const shared = safeList(person.sharedExperiences);
  const preferences = safeList(person.storyPreferences);

  const lines = [
    `Person: ${person.name}`,
    `Relationship: ${person.relationship || 'unknown'}`,
    `How we met: ${person.howMet || 'unknown'}`,
    `Conversation style: ${person.conversationStyle || 'unknown'}`,
    `Interests: ${interests.join(', ') || 'none'}`,
    `Personality traits: ${traits.join(', ') || 'none'}`,
    `Shared experiences: ${shared.join(', ') || 'none'}`,
    `Story preferences: ${preferences.join(', ') || 'none'}`,
    `Notes: ${person.notes || 'none'}`
  ];

  const textUploads = await prisma.personTextUpload.findMany({
    where: { personId: Number(personId) },
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  if (textUploads.length > 0) {
    lines.push('');
    lines.push('=== Past text message conversations with this person ===');
    for (const upload of textUploads) {
      const maxChars = 3000;
      const truncated = upload.content.length > maxChars
        ? upload.content.slice(-maxChars) + '\n... (older messages truncated)'
        : upload.content;
      lines.push(`\n--- ${upload.label} ---`);
      lines.push(truncated);
    }
  }

  return lines.join('\n');
}

function makeTitleFromMessage(msg) {
  const s = (msg || '').trim().replace(/\s+/g, ' ');
  return !s ? 'New chat' : s.length > 60 ? `${s.slice(0, 57)}…` : s;
}

function safeSummaryFallback(messages) {
  const text = (messages || [])
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
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
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
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

async function getAssistantReply({ model, memorySummaries, messages, personContext = '' }) {
  if (!LLM_API_KEY) {
    return `AI is not configured on the server yet. Set OPENROUTER_API_KEY and restart the backend.`;
  }
  const memoryBlock = (memorySummaries || []).length
    ? `\n\nSaved chat memory (summaries of the user's prior chats):\n${memorySummaries.map((s, i) => `(${i + 1}) ${s}`).join('\n')}\n`
    : '';
  const personBlock = personContext
    ? `\n\nPerson context for this conversation (IMPORTANT):\n${personContext}\n\nRole clarity:\n- The user chatting with you is the account owner seeking better connection with this person.\n- The profile above describes someone else, not the user.\n- Do NOT address the user as if they are this person.\n- Give guidance from the user's perspective: how to understand this person, communicate with them, and build a better relationship.\n- When useful, suggest concrete next messages/questions/actions the user can try with this person.`
    : '';

  const system = `You are a helpful, friendly AI chat assistant. Be conversational, ask clarifying questions when needed, and keep responses grounded and practical.${memoryBlock}${personBlock}
Use the saved chat memory as background context when it's relevant. Do NOT invent details if memory doesn't specify them.`;

  const res = await openai.chat.completions.create({
    model: model || CHAT_MODEL,
    messages: [{ role: 'system', content: system }, ...messages],
    temperature: 0.7,
    max_tokens: 650
  });
  return res.choices?.[0]?.message?.content?.trim() || 'Sorry—no response.';
}

// List conversations (general chat, no person context)
router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const rows = await prisma.aiConversation.findMany({
      where: { userId: req.user.userId, personId: null },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, summary: true, createdAt: true, updatedAt: true }
    });
    return res.json({ conversations: rows });
  } catch (e) {
    console.error('List conversations error:', e);
    return res.status(500).json({ error: 'Database error' });
  }
});

router.get('/conversations/:id/messages', authenticateToken, async (req, res) => {
  try {
    const conversationId = Number(req.params.id);
    const conv = await prisma.aiConversation.findFirst({
      where: { id: conversationId, userId: req.user.userId, personId: null }
    });
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });

    const rows = await prisma.aiMessage.findMany({
      where: { conversationId },
      orderBy: { id: 'asc' },
      select: { id: true, role: true, content: true, createdAt: true }
    });
    return res.json({ messages: rows });
  } catch (e) {
    console.error('Get messages error:', e);
    return res.status(500).json({ error: 'Database error' });
  }
});

router.patch('/conversations/:id', authenticateToken, async (req, res) => {
  try {
    const conversationId = Number(req.params.id);
    const title = (req.body?.title || '').toString().trim();
    if (!title) return res.status(400).json({ error: 'title is required' });

    const conv = await prisma.aiConversation.updateMany({
      where: { id: conversationId, userId: req.user.userId, personId: null },
      data: { title }
    });
    if (conv.count === 0) return res.status(404).json({ error: 'Conversation not found' });

    const row = await prisma.aiConversation.findFirst({
      where: { id: conversationId, userId: req.user.userId },
      select: { id: true, title: true, summary: true, createdAt: true, updatedAt: true }
    });
    return res.json({ conversation: row });
  } catch (e) {
    console.error('Rename conversation error:', e);
    return res.status(500).json({ error: 'Database error' });
  }
});

router.post('/message', authenticateToken, async (req, res) => {
  const { conversationId, message, useMemory = true, personId = null } = req.body || {};
  const userMessage = (message || '').toString().trim();
  if (!userMessage) return res.status(400).json({ error: 'message is required' });

  try {
    const uid = req.user.userId;
    const personIdNum = personId ? Number(personId) : null;

    let conv;
    if (conversationId) {
      conv = await prisma.aiConversation.findFirst({
        where: {
          id: Number(conversationId),
          userId: uid,
          personId: personIdNum
        }
      });
      if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    } else {
      conv = await prisma.aiConversation.create({
        data: {
          userId: uid,
          personId: personIdNum,
          title: makeTitleFromMessage(userMessage)
        }
      });
    }

    await prisma.aiMessage.create({
      data: { conversationId: conv.id, role: 'user', content: userMessage }
    });

    const recentRows = await prisma.aiMessage.findMany({
      where: { conversationId: conv.id },
      orderBy: { id: 'desc' },
      take: 24,
      select: { role: true, content: true }
    });
    const messagesForAI = recentRows.reverse();

    const memorySummaries = useMemory
      ? (
          await prisma.aiConversation.findMany({
            where: {
              userId: uid,
              id: { not: conv.id },
              personId: personIdNum,
              summary: { not: null }
            },
            orderBy: { updatedAt: 'desc' },
            take: 8,
            select: { summary: true }
          })
        )
          .map((r) => r.summary)
          .filter(Boolean)
      : [];

    const chosenModel = pickModel(req);
    const personContext = personIdNum ? await getPersonContextForUser(uid, personIdNum) : '';

    let assistantText;
    try {
      assistantText = await getAssistantReply({
        model: chosenModel,
        memorySummaries,
        messages: messagesForAI,
        personContext
      });
    } catch (aiErr) {
      console.error('AI chat completion failed:', aiErr);
      assistantText =
        process.env.NODE_ENV === 'production'
          ? `The AI service is temporarily unavailable. Please try again in a minute.`
          : `AI call failed: ${aiErr?.message || 'Unknown error'}`;
    }

    await prisma.aiMessage.create({
      data: { conversationId: conv.id, role: 'assistant', content: assistantText }
    });

    await prisma.aiConversation.update({
      where: { id: conv.id },
      data: { updatedAt: new Date() }
    });

    const recentWithAssistant = await prisma.aiMessage.findMany({
      where: { conversationId: conv.id },
      orderBy: { id: 'desc' },
      take: 24,
      select: { role: true, content: true }
    });
    const forSummary = recentWithAssistant.reverse();

    try {
      const summary = await summarizeConversation(forSummary);
      if (summary) {
        await prisma.aiConversation.update({
          where: { id: conv.id },
          data: { summary }
        });
      }
    } catch (sumErr) {
      console.warn('Chat summary failed:', sumErr?.message);
    }

    return res.json({ conversationId: conv.id, assistant: assistantText });
  } catch (e) {
    console.error('Chat message error:', e);
    return res.status(500).json({ error: 'Failed to send message' });
  }
});

router.get('/person/:personId/conversations', authenticateToken, async (req, res) => {
  try {
    const personId = Number(req.params.personId);
    const rows = await prisma.aiConversation.findMany({
      where: { userId: req.user.userId, personId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, summary: true, createdAt: true, updatedAt: true }
    });
    return res.json({ conversations: rows });
  } catch (e) {
    console.error('List person conversations error:', e);
    return res.status(500).json({ error: 'Database error' });
  }
});

router.get('/person/:personId/conversations/:id/messages', authenticateToken, async (req, res) => {
  try {
    const personId = Number(req.params.personId);
    const conversationId = Number(req.params.id);
    const conv = await prisma.aiConversation.findFirst({
      where: { id: conversationId, userId: req.user.userId, personId }
    });
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });

    const messages = await prisma.aiMessage.findMany({
      where: { conversationId },
      orderBy: { id: 'asc' },
      include: {
        pins: {
          where: { userId: req.user.userId, personId },
          select: { id: true, note: true, pinnedAt: true }
        }
      }
    });

    const rows = messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      created_at: m.createdAt,
      is_pinned: m.pins.length > 0 ? 1 : 0,
      pinned_note: m.pins[0]?.note ?? null,
      pinned_at: m.pins[0]?.pinnedAt ?? null
    }));
    return res.json({ messages: rows });
  } catch (e) {
    console.error('Get person messages error:', e);
    return res.status(500).json({ error: 'Database error' });
  }
});

router.get('/person/:personId/pins', authenticateToken, async (req, res) => {
  try {
    const personId = Number(req.params.personId);
    const uid = req.user.userId;

    const pins = await prisma.aiMessagePin.findMany({
      where: {
        userId: uid,
        personId,
        message: {
          conversation: { userId: uid, personId }
        }
      },
      orderBy: { pinnedAt: 'desc' },
      include: {
        message: {
          include: {
            conversation: {
              select: { id: true, title: true }
            }
          }
        }
      }
    });

    const rows = pins.map((p) => ({
      id: p.id,
      message_id: p.messageId,
      note: p.note,
      pinned_at: p.pinnedAt,
      role: p.message.role,
      content: p.message.content,
      created_at: p.message.createdAt,
      conversation_id: p.message.conversation.id,
      conversation_title: p.message.conversation.title
    }));
    return res.json({ pins: rows });
  } catch (e) {
    console.error('List person pins error:', e);
    return res.status(500).json({ error: 'Database error' });
  }
});

router.post('/person/:personId/messages/:messageId/pin', authenticateToken, async (req, res) => {
  try {
    const personId = Number(req.params.personId);
    const messageId = Number(req.params.messageId);
    const shouldPin = req.body?.pinned !== false;
    const note = (req.body?.note || '').toString().trim() || null;
    const uid = req.user.userId;

    const msg = await prisma.aiMessage.findFirst({
      where: {
        id: messageId,
        conversation: { userId: uid, personId }
      }
    });
    if (!msg) return res.status(404).json({ error: 'Message not found' });

    if (shouldPin) {
      await prisma.aiMessagePin.upsert({
        where: {
          userId_personId_messageId: { userId: uid, personId, messageId }
        },
        create: { userId: uid, personId, messageId, note },
        update: { note }
      });
      return res.json({ status: 'pinned' });
    }

    await prisma.aiMessagePin.deleteMany({
      where: { userId: uid, personId, messageId }
    });
    return res.json({ status: 'unpinned' });
  } catch (e) {
    console.error('Pin person message error:', e);
    return res.status(500).json({ error: 'Failed to update pin' });
  }
});

router.delete('/person/:personId/conversations/:id', authenticateToken, async (req, res) => {
  try {
    const personId = Number(req.params.personId);
    const conversationId = Number(req.params.id);
    const result = await prisma.aiConversation.deleteMany({
      where: { id: conversationId, userId: req.user.userId, personId }
    });
    if (result.count === 0) return res.status(404).json({ error: 'Conversation not found' });
    return res.json({ status: 'deleted' });
  } catch (e) {
    console.error('Delete person conversation error:', e);
    return res.status(500).json({ error: 'Database error' });
  }
});

router.delete('/conversations/:id', authenticateToken, async (req, res) => {
  try {
    const conversationId = Number(req.params.id);
    const result = await prisma.aiConversation.deleteMany({
      where: { id: conversationId, userId: req.user.userId, personId: null }
    });
    if (result.count === 0) return res.status(404).json({ error: 'Conversation not found' });
    return res.json({ status: 'deleted' });
  } catch (e) {
    console.error('Delete conversation error:', e);
    return res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
