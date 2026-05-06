const express = require('express');
const { prisma } = require('../prisma/client');
const { authenticateToken } = require('../middleware/auth');
const { generateDailyBriefing } = require('../services/openai');

const router = express.Router();

let ensuredBriefingTable = false;
async function ensureBriefingTable() {
  if (ensuredBriefingTable) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS daily_briefings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        date DATE NOT NULL,
        briefing_json TEXT NOT NULL,
        signals_json TEXT,
        model TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_briefings_user_date
        ON daily_briefings(user_id, date)
    `);
  } catch (e) {
    console.warn('Could not ensure daily_briefings table exists:', e?.message);
  }
  ensuredBriefingTable = true;
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoDate(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

// Build the structured snapshot we hand to the LLM. Keep this small and concrete —
// the LLM is much better at synthesizing a focused signal pack than browsing raw rows.
async function buildSignals(userId) {
  const today = todayDate();
  const sevenDaysAgo = daysAgoDate(7);
  const fourteenDaysAgo = daysAgoDate(14);
  const thirtyDaysAgo = daysAgoDate(30);

  const startOfDay = new Date(sevenDaysAgo + 'T00:00:00Z');

  const [journalEntries, triggers, goals, people, identity] = await Promise.all([
    prisma.journalEntry.findMany({
      where: { userId, createdAt: { gte: startOfDay } },
      orderBy: { createdAt: 'desc' },
      take: 14
    }),
    prisma.anxietyTrigger.findMany({
      where: { userId, createdAt: { gte: new Date(fourteenDaysAgo + 'T00:00:00Z') } },
      orderBy: { createdAt: 'desc' },
      take: 20
    }),
    prisma.goal.findMany({
      where: { userId, status: 'active' },
      orderBy: { updatedAt: 'desc' },
      take: 10
    }),
    prisma.person.findMany({
      where: { userId },
      take: 50,
      select: { id: true, name: true, relationship: true }
    }),
    prisma.identityVision.findUnique({ where: { userId } }).catch(() => null)
  ]);

  // Wellness — raw table, only fetch if it exists. Wellness ensures itself when
  // its own routes are hit; we shouldn't crash if it's empty/missing.
  let wellness = [];
  try {
    wellness = await prisma.$queryRawUnsafe(
      `SELECT date, sleep_score, sleep_quality, exercise_minutes, exercise_intensity, diet_quality
         FROM wellness_entries
        WHERE user_id=$1 AND date >= $2
        ORDER BY date DESC
        LIMIT 14`,
      userId,
      sevenDaysAgo
    );
  } catch (_) {}

  // Today's day plan (if present)
  let dayPlanItems = [];
  try {
    const plan = await prisma.dayPlan.findFirst({
      where: { userId, date: new Date(today + 'T00:00:00Z') },
      include: { items: { orderBy: { sortOrder: 'asc' } } }
    });
    if (plan?.items) {
      dayPlanItems = plan.items.map((it) => ({
        title: it.title,
        planned_minutes: it.plannedMinutes,
        completed: it.completed,
        start_at: it.startAt || null,
        is_recurring: it.isRecurring
      }));
    }
  } catch (_) {}

  // People mentioned recently — soft proxy for "haven't been in touch."
  // Look at the names that appear in the last 30 days of journal text and surface
  // people NOT mentioned there.
  let peopleNotMentioned = [];
  try {
    const recentJournals = await prisma.journalEntry.findMany({
      where: { userId, createdAt: { gte: new Date(thirtyDaysAgo + 'T00:00:00Z') } },
      select: { content: true }
    });
    const blob = recentJournals.map((j) => (j.content || '').toLowerCase()).join('\n');
    peopleNotMentioned = people
      .filter((p) => p.name && !blob.includes(p.name.toLowerCase()))
      .slice(0, 8)
      .map((p) => ({ name: p.name, relationship: p.relationship || null }));
  } catch (_) {}

  const moodCounts = {};
  for (const e of journalEntries) {
    if (e.mood) moodCounts[e.mood] = (moodCounts[e.mood] || 0) + 1;
  }

  return {
    today,
    weekday: new Date(today + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long' }),
    journal_last_7_days: journalEntries.map((e) => ({
      date: e.createdAt.toISOString().slice(0, 10),
      mood: e.mood || null,
      // truncate so the prompt stays compact — the LLM doesn't need full essays
      excerpt: (e.content || '').slice(0, 600)
    })),
    mood_counts_last_7_days: moodCounts,
    wellness_last_7_days: (wellness || []).map((w) => ({
      date: typeof w.date === 'string' ? w.date : new Date(w.date).toISOString().slice(0, 10),
      sleep_score: w.sleep_score ?? null,
      sleep_quality: w.sleep_quality ?? null,
      exercise_minutes: w.exercise_minutes ?? null,
      exercise_intensity: w.exercise_intensity ?? null,
      diet_quality: w.diet_quality ?? null
    })),
    anxiety_triggers_last_14_days: triggers.map((t) => ({
      title: t.title,
      category: t.category || null,
      intensity: t.intensity ?? null,
      created_at: t.createdAt.toISOString().slice(0, 10)
    })),
    active_goals: goals.map((g) => ({
      title: g.title,
      area: g.area || null,
      target_date: g.targetDate ? g.targetDate.toISOString().slice(0, 10) : null
    })),
    today_day_plan: dayPlanItems,
    people: people.map((p) => ({ name: p.name, relationship: p.relationship || null })),
    people_not_mentioned_recently: peopleNotMentioned,
    identity: identity
      ? {
          values: safeJsonArr(identity.values),
          principles: safeJsonArr(identity.principles),
          vision_points: safeJsonArr(identity.visionPoints)
        }
      : null
  };
}

function safeJsonArr(s) {
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

// GET /api/briefing/today
// Returns today's briefing, generating + caching it on first call.
router.get('/today', authenticateToken, async (req, res) => {
  await ensureBriefingTable();
  const userId = req.user.userId;
  const date = todayDate();
  const force = req.query.regenerate === '1' || req.query.regenerate === 'true';

  try {
    if (!force) {
      const cached = await prisma.$queryRawUnsafe(
        `SELECT briefing_json, created_at, updated_at FROM daily_briefings WHERE user_id=$1 AND date=$2`,
        userId,
        date
      );
      if (cached && cached[0]) {
        return res.json({
          briefing: JSON.parse(cached[0].briefing_json),
          generatedAt: cached[0].updated_at || cached[0].created_at,
          cached: true,
          date
        });
      }
    }

    const signals = await buildSignals(userId);
    const briefing = await generateDailyBriefing(signals);

    await prisma.$executeRawUnsafe(
      `INSERT INTO daily_briefings (user_id, date, briefing_json, signals_json, model, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (user_id, date) DO UPDATE SET
         briefing_json = EXCLUDED.briefing_json,
         signals_json  = EXCLUDED.signals_json,
         model         = EXCLUDED.model,
         updated_at    = NOW()`,
      userId,
      date,
      JSON.stringify(briefing),
      JSON.stringify(signals),
      process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini'
    );

    res.json({ briefing, generatedAt: new Date().toISOString(), cached: false, date });
  } catch (e) {
    console.error('Briefing error:', e);
    res.status(500).json({ error: e.message || 'Failed to build briefing' });
  }
});

module.exports = router;
