const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Determine database location
// Default: use the repo-bundled file in this directory
const bundledDbDir = __dirname;
const bundledDbPath = path.join(bundledDbDir, 'social_conversation.db');

// Production: use a persistent disk if provided (e.g., Render disk mounted at /data)
const persistentDir = process.env.DATABASE_DIR || (process.env.RENDER ? '/data' : null);
let effectiveDbPath = bundledDbPath;

if (persistentDir) {
  // Ensure persistent dir exists
  try {
    if (!fs.existsSync(persistentDir)) {
      fs.mkdirSync(persistentDir, { recursive: true });
    }
  } catch (e) {
    console.warn('Could not create persistent DB dir, falling back to bundled path:', e?.message);
  }

  const persistentDbPath = path.join(persistentDir, 'social_conversation.db');
  // Seed from bundled DB on first run if persistent DB missing
  try {
    if (!fs.existsSync(persistentDbPath)) {
      if (fs.existsSync(bundledDbPath)) {
        fs.copyFileSync(bundledDbPath, persistentDbPath);
        console.log('Seeded persistent database from bundled DB');
      }
    }
    effectiveDbPath = persistentDbPath;
  } catch (e) {
    console.warn('Could not use persistent DB path, falling back to bundled path:', e?.message);
  }
}

const db = new Database(effectiveDbPath);

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

    console.log('✅ Database tables created successfully');
    return Promise.resolve();
  } catch (error) {
    console.error('Error creating database tables:', error);
    return Promise.reject(error);
  }
};

// Helper function to get database instance
const getDatabase = () => db;

module.exports = { initDatabase, getDatabase };