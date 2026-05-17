const express = require('express');
const { prisma } = require('../prisma/client');
const { authenticateToken } = require('../middleware/auth');
const OpenAI = require('openai');

const router = express.Router();

// Raw OpenRouter client — same setup the chat route uses. Embedded here to
// avoid pulling in a heavier service refactor for one extra LLM call.
const LLM_API_KEY = process.env.OPENROUTER_API_KEY;
const LLM_BASE_URL = 'https://openrouter.ai/api/v1';
const CHAT_MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
const openai = LLM_API_KEY
  ? new OpenAI({ apiKey: LLM_API_KEY, baseURL: LLM_BASE_URL })
  : null;

// Single per-user profile blob. Stored as raw markdown so what you read is
// what gets downloaded. One row per user; the user IS the key.
let ensuredUserProfiles = false;
async function ensureUserProfilesTable() {
  if (ensuredUserProfiles) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        user_id INTEGER PRIMARY KEY,
        content TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
  } catch (e) {
    console.warn('Could not ensure user_profiles table:', e?.message);
  }
  ensuredUserProfiles = true;
}

async function loadProfile(userId) {
  await ensureUserProfilesTable();
  const rows = await prisma.$queryRawUnsafe(
    `SELECT user_id, content, updated_at FROM user_profiles WHERE user_id = $1`,
    Number(userId)
  );
  const row = (rows || [])[0];
  return row
    ? { content: row.content || '', updatedAt: row.updated_at }
    : { content: '', updatedAt: null };
}

router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const profile = await loadProfile(req.user.userId);
    res.json(profile);
  } catch (e) {
    console.error('me profile load error:', e);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

router.put('/profile', authenticateToken, async (req, res) => {
  await ensureUserProfilesTable();
  // Treat empty/missing body as clearing; the file is the source of truth.
  const content = (req.body?.content ?? '').toString();
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO user_profiles (user_id, content, updated_at)
         VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()`,
      Number(req.user.userId),
      content
    );
    const profile = await loadProfile(req.user.userId);
    res.json(profile);
  } catch (e) {
    console.error('me profile save error:', e);
    res.status(500).json({ error: 'Failed to save profile' });
  }
});

// --- Combined me.md renderer ----------------------------------------------
//
// The exported me.md bundles the hand-written profile with structured data
// from the goals/identity/beliefs/triggers/dating tables, so what you paste
// into another LLM is a complete picture of who the user is right now.
//
// Sections only render when they have data — no empty headings.

function fmtDate(d) {
  if (!d) return null;
  try { return new Date(d).toISOString().slice(0, 10); } catch (_) { return null; }
}

function bullet(s) { return `- ${s}`; }

function renderGoalsSection(goals) {
  if (!goals?.length) return null;
  const active = goals.filter((g) => g.status === 'active');
  const other = goals.filter((g) => g.status !== 'active');
  const blocks = ['## Goals'];

  const renderGoal = (g) => {
    const meta = [];
    if (g.area) meta.push(g.area);
    if (g.targetDate) meta.push(`by ${fmtDate(g.targetDate)}`);
    const metaSuffix = meta.length ? ` _(${meta.join(', ')})_` : '';
    const desc = g.description ? `\n  ${g.description.replace(/\n+/g, ' ')}` : '';
    return `- **${g.title}**${metaSuffix}${desc}`;
  };

  if (active.length) {
    blocks.push('');
    blocks.push('### Active');
    blocks.push(...active.map(renderGoal));
  }
  if (other.length) {
    blocks.push('');
    blocks.push('### Other');
    blocks.push(...other.map(renderGoal));
  }
  return blocks.join('\n');
}

function renderIdentitySection(v) {
  if (!v) return null;
  const parts = ['## Identity'];
  if (v.vision) {
    parts.push('');
    parts.push('**Vision**');
    parts.push(v.vision);
  }
  for (const [field, label] of [
    ['values', 'Values'],
    ['principles', 'Principles'],
    ['traits', 'Traits'],
    ['visionPoints', 'Vision points']
  ]) {
    const arr = safeJsonArr(v[field]);
    if (arr.length) {
      parts.push('');
      parts.push(`**${label}**`);
      parts.push(...arr.map(bullet));
    }
  }
  return parts.length > 1 ? parts.join('\n') : null;
}

function renderBeliefsSection(beliefs) {
  if (!beliefs?.length) return null;
  const parts = ["## Beliefs I'm working on"];
  for (const b of beliefs) {
    parts.push('');
    parts.push(`- **Current:** "${b.currentBelief}"`);
    parts.push(`  **Desired:** "${b.desiredBelief}"`);
    if (b.changePlan) parts.push(`  **Plan:** ${b.changePlan.replace(/\n+/g, ' ')}`);
  }
  return parts.join('\n');
}

function renderTriggersSection(triggers) {
  if (!triggers?.length) return null;
  const parts = ['## Anxiety triggers'];
  for (const t of triggers) {
    const meta = [];
    if (t.category) meta.push(t.category);
    if (t.intensity != null) meta.push(`intensity ${t.intensity}/10`);
    const metaSuffix = meta.length ? ` _(${meta.join(', ')})_` : '';
    const notes = t.notes ? `\n  ${t.notes.replace(/\n+/g, ' ')}` : '';
    parts.push(`- **${t.title}**${metaSuffix}${notes}`);
  }
  return parts.join('\n');
}

function renderRequirements(label, req) {
  if (!req) return null;
  const lines = [];
  if (req.partner_vision) {
    lines.push(`**${label} — partner vision**`);
    lines.push(req.partner_vision);
  }
  const groups = [
    ['Must haves', req.must_haves],
    ['Nice to haves', req.nice_to_haves],
    ['Red flags', req.red_flags],
    ['Shared interests', req.interests]
  ];
  for (const [name, arr] of groups) {
    if (Array.isArray(arr) && arr.length) {
      if (lines.length) lines.push('');
      lines.push(`**${label} — ${name.toLowerCase()}**`);
      lines.push(...arr.filter(Boolean).map(bullet));
    }
  }
  return lines.length ? lines.join('\n') : null;
}

function renderDatingSection(dating) {
  if (!dating) return null;
  const parts = ['## Dating'];
  const short = renderRequirements('Short-term', dating.shortTerm);
  const long  = renderRequirements('Long-term',  dating.longTerm);
  if (short) { parts.push(''); parts.push(short); }
  if (long)  { parts.push(''); parts.push(long); }
  const reflection = dating.selfReflectionAnswers;
  if (reflection && typeof reflection === 'object') {
    const entries = Object.entries(reflection).filter(([, v]) => v && String(v).trim());
    if (entries.length) {
      parts.push('');
      parts.push('**Self-reflection**');
      for (const [q, a] of entries) {
        parts.push(`- _${q.replace(/_/g, ' ')}:_ ${String(a).trim()}`);
      }
    }
  }
  return parts.length > 1 ? parts.join('\n') : null;
}

async function loadStructuredForUser(userId) {
  const [goals, identity, beliefs, triggers, datingRow] = await Promise.all([
    prisma.goal.findMany({ where: { userId }, orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }] }),
    prisma.identityVision.findUnique({ where: { userId } }).catch(() => null),
    prisma.belief.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' } }),
    prisma.anxietyTrigger.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' } }),
    prisma.datingProfile.findUnique({ where: { userId } }).catch(() => null)
  ]);

  // Reuse the dating route's parse shape — JSON in DB, objects out.
  const parseJson = (v) => {
    if (!v) return null;
    if (typeof v === 'object') return v;
    try { return JSON.parse(v); } catch (_) { return null; }
  };

  const dating = datingRow
    ? {
        shortTerm: parseJson(datingRow.shortTermRequirements),
        longTerm: parseJson(datingRow.longTermRequirements),
        selfReflectionAnswers: parseJson(datingRow.selfReflectionAnswers)
      }
    : null;

  return { goals, identity, beliefs, triggers, dating };
}

// Markdown download view — combined by default. ?profileOnly=1 returns just
// the hand-written content (the slim version) for when the user only wants
// to paste their narrative profile somewhere.
router.get('/markdown', authenticateToken, async (req, res) => {
  const profileOnly = req.query.profileOnly === '1' || req.query.profileOnly === 'true';
  try {
    const { content, updatedAt } = await loadProfile(req.user.userId);
    const footer = updatedAt
      ? `\n\n_Last updated: ${new Date(updatedAt).toISOString().slice(0, 10)}_\n`
      : '';

    let markdown = (content || '').trimEnd();

    if (!profileOnly) {
      const data = await loadStructuredForUser(req.user.userId);
      const sections = [
        renderGoalsSection(data.goals),
        renderIdentitySection(data.identity),
        renderBeliefsSection(data.beliefs),
        renderTriggersSection(data.triggers),
        renderDatingSection(data.dating)
      ].filter(Boolean);

      if (sections.length) {
        const divider = markdown ? '\n\n---\n\n' : '';
        markdown = markdown + divider + sections.join('\n\n');
      }
    }

    markdown = markdown + footer;

    // Browsers calling this via fetch+blob URL ignore Content-Disposition.
    // We still set it so a direct-link download (if ever used) gets a nice
    // filename out of the box.
    const filename = profileOnly ? 'me-profile.md' : 'me.md';
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(markdown);
  } catch (e) {
    console.error('me markdown error:', e);
    res.status(500).json({ error: 'Failed to render markdown' });
  }
});

// "Pull from my data" — scans recent journals + active goals + beliefs +
// triggers + identity vision, then asks the LLM to propose paragraphs the
// user can paste/edit into their profile. Read-only on the server side —
// nothing gets auto-written to user_profiles.
router.post('/extract', authenticateToken, async (req, res) => {
  if (!openai) {
    return res.status(503).json({ error: 'OPENROUTER_API_KEY is not configured.' });
  }
  try {
    const userId = req.user.userId;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 60);

    const [journals, goals, beliefs, triggers, identity, existing] = await Promise.all([
      prisma.journalEntry.findMany({
        where: { userId, createdAt: { gte: sevenDaysAgo } },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: { content: true, mood: true, createdAt: true }
      }),
      prisma.goal.findMany({ where: { userId, status: 'active' }, take: 20 }),
      prisma.belief.findMany({ where: { userId }, take: 20 }),
      prisma.anxietyTrigger.findMany({ where: { userId }, take: 20 }),
      prisma.identityVision.findUnique({ where: { userId } }).catch(() => null),
      loadProfile(userId)
    ]);

    const snapshot = {
      existing_profile: existing.content || '',
      identity: identity
        ? {
            vision: identity.vision || null,
            values: safeJsonArr(identity.values),
            principles: safeJsonArr(identity.principles),
            traits: safeJsonArr(identity.traits)
          }
        : null,
      active_goals: goals.map((g) => ({ title: g.title, area: g.area || null, description: g.description || null })),
      beliefs: beliefs.map((b) => ({ current: b.currentBelief, desired: b.desiredBelief })),
      recent_triggers: triggers.map((t) => ({ title: t.title, category: t.category || null, intensity: t.intensity ?? null })),
      recent_journal_excerpts: journals.slice(0, 12).map((j) => ({
        date: j.createdAt.toISOString().slice(0, 10),
        mood: j.mood || null,
        excerpt: (j.content || '').slice(0, 500)
      }))
    };

    const prompt = `
You're helping the user maintain a personal "me.md" profile they paste into other LLMs as context. Based on the data snapshot below, propose 3-7 short suggestions they could ADD to their profile. Do NOT rewrite their existing profile. Each suggestion should be a labeled paragraph or bullet they can copy into the right section.

Tone: their own voice, specific, no LinkedIn-summary phrasing. First-person. If the data is thin in some area, skip that area rather than padding.

Snapshot (existing_profile is what they already have, so don't duplicate it):
"""
${JSON.stringify(snapshot, null, 2)}
"""

Return ONLY valid JSON in this exact shape:
{
  "suggestions": [
    {
      "section": "How I think / how I work",
      "content": "I default to..."
    }
  ]
}

Allowed section names — pick the best fit per suggestion (don't invent new ones):
- Snapshot
- How I think / how I work
- What I'm into
- What I care about
- What I'm working on
- What I struggle with
- How to talk to me
- Context that's usually relevant
`;

    const response = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: 'system', content: 'You produce short, honest, first-person profile suggestions as strict JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.5,
      max_tokens: 900
    });

    const raw = response.choices?.[0]?.message?.content || '';
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch (_) {
      const m = raw.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : { suggestions: [] };
    }
    const suggestions = Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];
    res.json({ suggestions });
  } catch (e) {
    console.error('me extract error:', e);
    res.status(500).json({ error: e.message || 'Failed to extract suggestions' });
  }
});

function safeJsonArr(s) {
  if (!s) return [];
  if (Array.isArray(s)) return s;
  try { const a = JSON.parse(s); return Array.isArray(a) ? a : []; }
  catch (_) { return []; }
}

module.exports = router;
module.exports.loadProfile = loadProfile;
