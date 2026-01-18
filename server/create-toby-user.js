const bcrypt = require('bcryptjs');
const { getDatabase } = require('./database/init');

async function createTobyUser() {
  try {
    const db = getDatabase();
    
    // Check if Toby user already exists (better-sqlite3 is sync)
    const existing = db.prepare('SELECT id FROM users WHERE name = ?').get('Toby');
    if (existing) {
      console.log('Toby user already exists');
      return;
    }

    // Create Toby user
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash('Amazon12308', saltRounds);

    const info = db
      .prepare('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)')
      .run('toby@example.com', passwordHash, 'Toby');

    console.log('Toby user created successfully with ID:', info.lastInsertRowid);
    console.log('Username: Toby');
    console.log('Password: Amazon12308');
  } catch (error) {
    console.error('Error in createTobyUser:', error);
  }
}

createTobyUser();





