const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');
const { prisma } = require('../prisma/client');

const router = express.Router();

function assertAdmin(req) {
  const keyFromEnv = process.env.ADMIN_KEY;
  const key = req.header('x-admin-key') || req.query.key;
  if (!keyFromEnv) {
    throw new Error('ADMIN_KEY not set on server');
  }
  if (key !== keyFromEnv) {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }
}

router.get('/migrate', async (req, res) => {
  try {
    assertAdmin(req);

    const sqlitePath = path.join(__dirname, '..', 'database', 'social_conversation.db');
    const sdb = new Database(sqlitePath);

    const users = sdb.prepare('SELECT * FROM users').all();
    let totals = { users: 0, journalEntries: 0, stories: 0, people: 0, conversationStarters: 0, practiceSessions: 0 };

    for (const u of users) {
      const user = await prisma.user.upsert({
        where: { email: u.email },
        update: { name: u.name, password: u.password_hash },
        create: { email: u.email, password: u.password_hash, name: u.name }
      });
      totals.users += 1;

      const entries = sdb.prepare('SELECT * FROM journal_entries WHERE user_id = ?').all(u.id);
      for (const e of entries) {
        await prisma.journalEntry.upsert({
          where: { id: e.id },
          update: {
            userId: user.id,
            content: e.content,
            mood: e.mood || null,
            tags: e.tags || null,
            createdAt: new Date(e.created_at),
            updatedAt: new Date(e.updated_at)
          },
          create: {
            id: e.id,
            userId: user.id,
            content: e.content,
            mood: e.mood || null,
            tags: e.tags || null,
            createdAt: new Date(e.created_at),
            updatedAt: new Date(e.updated_at)
          }
        });
        totals.journalEntries += 1;
      }

      const stories = sdb.prepare('SELECT * FROM stories WHERE user_id = ?').all(u.id);
      for (const s of stories) {
        await prisma.story.upsert({
          where: { id: s.id },
          update: {
            userId: user.id,
            journalEntryId: s.journal_entry_id || null,
            title: s.title,
            content: s.content,
            tone: s.tone,
            durationSeconds: s.duration_seconds,
            tags: s.tags || null,
            timesTold: s.times_told,
            successRating: s.success_rating || null,
            createdAt: new Date(s.created_at),
            updatedAt: new Date(s.updated_at)
          },
          create: {
            id: s.id,
            userId: user.id,
            journalEntryId: s.journal_entry_id || null,
            title: s.title,
            content: s.content,
            tone: s.tone,
            durationSeconds: s.duration_seconds,
            tags: s.tags || null,
            timesTold: s.times_told,
            successRating: s.success_rating || null,
            createdAt: new Date(s.created_at),
            updatedAt: new Date(s.updated_at)
          }
        });
        totals.stories += 1;
      }

      const people = sdb.prepare('SELECT * FROM people WHERE user_id = ?').all(u.id);
      for (const p of people) {
        await prisma.person.upsert({
          where: { id: p.id },
          update: {
            userId: user.id,
            name: p.name,
            relationship: p.relationship || null,
            howMet: p.how_met || null,
            interests: p.interests || null,
            personalityTraits: p.personality_traits || null,
            conversationStyle: p.conversation_style || null,
            sharedExperiences: p.shared_experiences || null,
            storyPreferences: p.story_preferences || null,
            notes: p.notes || null,
            createdAt: new Date(p.created_at),
            updatedAt: new Date(p.updated_at)
          },
          create: {
            id: p.id,
            userId: user.id,
            name: p.name,
            relationship: p.relationship || null,
            howMet: p.how_met || null,
            interests: p.interests || null,
            personalityTraits: p.personality_traits || null,
            conversationStyle: p.conversation_style || null,
            sharedExperiences: p.shared_experiences || null,
            storyPreferences: p.story_preferences || null,
            notes: p.notes || null,
            createdAt: new Date(p.created_at),
            updatedAt: new Date(p.updated_at)
          }
        });
        totals.people += 1;
      }

      const starters = sdb.prepare('SELECT * FROM conversation_starters WHERE user_id = ?').all(u.id);
      for (const c of starters) {
        await prisma.conversationStarter.upsert({
          where: { id: c.id },
          update: {
            userId: user.id,
            storyId: c.story_id || null,
            question: c.question,
            context: c.context || null,
            createdAt: new Date(c.created_at)
          },
          create: {
            id: c.id,
            userId: user.id,
            storyId: c.story_id || null,
            question: c.question,
            context: c.context || null,
            createdAt: new Date(c.created_at)
          }
        });
        totals.conversationStarters += 1;
      }

      const sessions = sdb.prepare('SELECT * FROM practice_sessions WHERE user_id = ?').all(u.id);
      for (const ps of sessions) {
        await prisma.practiceSession.upsert({
          where: { id: ps.id },
          update: {
            userId: user.id,
            storyId: ps.story_id || null,
            sessionType: ps.session_type,
            feedback: ps.feedback || null,
            rating: ps.rating || null,
            createdAt: new Date(ps.created_at)
          },
          create: {
            id: ps.id,
            userId: user.id,
            storyId: ps.story_id || null,
            sessionType: ps.session_type,
            feedback: ps.feedback || null,
            rating: ps.rating || null,
            createdAt: new Date(ps.created_at)
          }
        });
        totals.practiceSessions += 1;
      }
    }

    res.json({ ok: true, migratedUsers: users.length, totals });
  } catch (err) {
    console.error('Migration error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Migration failed' });
  }
});

module.exports = router;


