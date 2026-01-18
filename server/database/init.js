const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

function canUseDir(dir) {
  try {
    if (!dir) return false;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.W_OK);
    const testFile = path.join(dir, `.writetest-${process.pid}-${Date.now()}`);
    fs.writeFileSync(testFile, 'ok');
    fs.unlinkSync(testFile);
    return true;
  } catch (_) {
    return false;
  }
}

// Determine database location
// Default: use the repo-bundled file in this directory
const bundledDbDir = __dirname;
const bundledDbPath = path.join(bundledDbDir, 'social_conversation.db');

// Prefer a writable persistent disk if provided (e.g., Render disk mounted at /data).
// Fallback in production to OS temp dir to avoid "readonly database" issues.
const candidateDirs = [
  process.env.DATABASE_DIR,
  process.env.RENDER ? '/data' : null,
  process.env.NODE_ENV === 'production' ? (process.env.TMPDIR || '/tmp') : null
].filter(Boolean);

const persistentDir = candidateDirs.find(canUseDir) || null;
let effectiveDbPath = bundledDbPath;

if (persistentDir) {
  const persistentDbPath = path.join(persistentDir, 'social_conversation.db');
  // Seed from bundled DB on first run if persistent DB missing
  try {
    if (!fs.existsSync(persistentDbPath)) {
      if (fs.existsSync(bundledDbPath)) {
        fs.copyFileSync(bundledDbPath, persistentDbPath);
        console.log('Seeded persistent database from bundled DB');
      }
    }
    // Ensure the DB file is writable (some environments preserve read-only mode on copy)
    try {
      fs.chmodSync(persistentDbPath, 0o664);
    } catch (_) {}
    effectiveDbPath = persistentDbPath;
    console.log(`Using database at: ${effectiveDbPath}`);
  } catch (e) {
    console.warn('Could not use persistent DB path, falling back to bundled path:', e?.message);
  }
}

const db = new Database(effectiveDbPath);

// Improve reliability under concurrent access (best-effort)
try {
  db.pragma('journal_mode = WAL');
} catch (_) {}
try {
  db.pragma('busy_timeout = 5000');
} catch (_) {}
try {
  db.pragma('synchronous = NORMAL');
} catch (_) {}

const initDatabase = () => {
  try {
    // Users table
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Journal entries table
    db.exec(`
      CREATE TABLE IF NOT EXISTS journal_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        mood TEXT,
        tags TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    // Stories table
    db.exec(`
      CREATE TABLE IF NOT EXISTS stories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        journal_entry_id INTEGER,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        tone TEXT NOT NULL,
        duration_seconds INTEGER DEFAULT 30,
        tags TEXT,
        times_told INTEGER DEFAULT 0,
        success_rating INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (journal_entry_id) REFERENCES journal_entries (id) ON DELETE SET NULL
      )
    `);

    // Practice sessions table
    db.exec(`
      CREATE TABLE IF NOT EXISTS practice_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        story_id INTEGER,
        session_type TEXT NOT NULL,
        feedback TEXT,
        rating INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (story_id) REFERENCES stories (id) ON DELETE SET NULL
      )
    `);

    // Conversation starters table
    db.exec(`
      CREATE TABLE IF NOT EXISTS conversation_starters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        story_id INTEGER,
        question TEXT NOT NULL,
        context TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (story_id) REFERENCES stories (id) ON DELETE SET NULL
      )
    `);

    // People table
    db.exec(`
      CREATE TABLE IF NOT EXISTS people (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        relationship TEXT,
        how_met TEXT,
        interests TEXT, -- JSON array of interests
        personality_traits TEXT, -- JSON array of traits
        conversation_style TEXT, -- casual, deep, humorous, etc.
        shared_experiences TEXT, -- JSON array of experiences
        story_preferences TEXT, -- JSON array of preferred story types
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    // Story-people relationship table (many-to-many)
    db.exec(`
      CREATE TABLE IF NOT EXISTS story_people (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        story_id INTEGER NOT NULL,
        person_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (story_id) REFERENCES stories (id) ON DELETE CASCADE,
        FOREIGN KEY (person_id) REFERENCES people (id) ON DELETE CASCADE,
        UNIQUE(story_id, person_id)
      )
    `);

    // Journal-people relationship table (many-to-many)
    db.exec(`
      CREATE TABLE IF NOT EXISTS journal_people (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        journal_entry_id INTEGER NOT NULL,
        person_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (journal_entry_id) REFERENCES journal_entries (id) ON DELETE CASCADE,
        FOREIGN KEY (person_id) REFERENCES people (id) ON DELETE CASCADE,
        UNIQUE(journal_entry_id, person_id)
      )
    `);

    // Jokes table
    db.exec(`
      CREATE TABLE IF NOT EXISTS jokes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT, -- pun, story, one-liner, etc.
        difficulty TEXT, -- easy, medium, hard
        times_told INTEGER DEFAULT 0,
        success_rating INTEGER, -- 1-5 rating
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    // Joke-people relationship table (many-to-many)
    db.exec(`
      CREATE TABLE IF NOT EXISTS joke_people (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        joke_id INTEGER NOT NULL,
        person_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (joke_id) REFERENCES jokes (id) ON DELETE CASCADE,
        FOREIGN KEY (person_id) REFERENCES people (id) ON DELETE CASCADE,
        UNIQUE(joke_id, person_id)
      )
    `);

    // Apple Health raw intake events
    db.exec(`
      CREATE TABLE IF NOT EXISTS health_intake_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        source TEXT, -- e.g., apple_health_shortcut
        event_type TEXT, -- daily_summary, workout, sleep, etc.
        event_date TEXT, -- ISO date (YYYY-MM-DD) for grouping
        payload_json TEXT NOT NULL, -- raw JSON payload as received
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
      )
    `);

    // AI chat conversations (saved "memory")
    db.exec(`
      CREATE TABLE IF NOT EXISTS ai_conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT,
        summary TEXT, -- short summary used as memory context for future chats
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_updated
      ON ai_conversations(user_id, updated_at)
    `);

    // AI chat messages
    db.exec(`
      CREATE TABLE IF NOT EXISTS ai_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL,
        role TEXT NOT NULL, -- 'user' | 'assistant' | 'system'
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES ai_conversations (id) ON DELETE CASCADE
      )
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id_id
      ON ai_messages(conversation_id, id)
    `);

    // Genome uploads metadata (file stored on disk)
    db.exec(`
      CREATE TABLE IF NOT EXISTS genome_uploads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        original_name TEXT NOT NULL,
        stored_name TEXT NOT NULL,
        mime_type TEXT,
        size_bytes INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_genome_uploads_user_id_created_at
      ON genome_uploads(user_id, created_at)
    `);

    console.log('✅ Database tables created successfully');
    return Promise.resolve();
  } catch (error) {
    console.error('Error creating database tables:', error);
    return Promise.reject(error);
  }
};

// Helper function to get database instance
const getDatabase = () => db;

// Ensure a user row exists in SQLite for FK constraints (when auth comes from Postgres/Prisma).
// This keeps legacy SQLite tables working in production.
function ensureSqliteUser({ id, email, name }) {
  const userId = Number(id);
  if (!userId) return;

  const safeEmail = (email && String(email).trim()) || `user${userId}@local`;
  const safeName = (name && String(name).trim()) || safeEmail;
  const passwordHash = 'external-auth'; // placeholder; not used when auth is via JWT/Prisma

  // If the ID exists, we're done
  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  if (existing) return;

  // Insert with explicit id (SQLite allows this even with AUTOINCREMENT)
  try {
    db.prepare(
      `INSERT INTO users (id, email, password_hash, name)
       VALUES (?, ?, ?, ?)`
    ).run(userId, safeEmail, passwordHash, safeName);
  } catch (e) {
    // Best-effort: if email is taken, fall back to a unique placeholder.
    const fallbackEmail = `user${userId}-${Date.now()}@local`;
    try {
      db.prepare(
        `INSERT INTO users (id, email, password_hash, name)
         VALUES (?, ?, ?, ?)`
      ).run(userId, fallbackEmail, passwordHash, safeName);
    } catch (_) {}
  }
}

module.exports = { initDatabase, getDatabase, dbPath: effectiveDbPath, ensureSqliteUser };