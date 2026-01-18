const bcrypt = require('bcryptjs');
const { getDatabase } = require('./database/init');

async function createDemoUser() {
  try {
    const db = getDatabase();
    
    // Check if demo user already exists (better-sqlite3 is sync)
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get('demo@storyconnect.com');
    if (existing) {
      console.log('Demo user already exists');
      return;
    }

    // Create demo user
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash('demo123', saltRounds);

    const info = db
      .prepare('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)')
      .run('demo@storyconnect.com', passwordHash, 'Demo User');

    console.log('Demo user created successfully with ID:', info.lastInsertRowid);
  } catch (error) {
    console.error('Error in createDemoUser:', error);
  }
}

createDemoUser();








