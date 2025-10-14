/*
  One-off script to migrate data from the existing SQLite DB
  into Postgres via Prisma. Run locally:
  node server/prisma/seed-sqlite-to-pg.js
*/
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const path = require('path');
const Database = require('better-sqlite3');

async function main() {
  const sqlitePath = path.join(__dirname, '..', 'database', 'social_conversation.db');
  const sdb = new Database(sqlitePath);

  const users = sdb.prepare('SELECT * FROM users').all();

  for (const u of users) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, password: u.password_hash },
      create: {
        email: u.email,
        password: u.password_hash,
        name: u.name
      }
    });

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
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('Migration complete.');
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });





