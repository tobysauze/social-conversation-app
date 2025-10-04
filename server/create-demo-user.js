const bcrypt = require('bcryptjs');
const { getDatabase } = require('./database/init');

async function createDemoUser() {
  try {
    const db = getDatabase();
    
    // Check if demo user already exists
    db.get('SELECT id FROM users WHERE email = ?', ['demo@storyconnect.com'], async (err, row) => {
      if (err) {
        console.error('Error checking for demo user:', err);
        return;
      }
      
      if (row) {
        console.log('Demo user already exists');
        return;
      }

      // Create demo user
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash('demo123', saltRounds);

      db.run(
        'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
        ['demo@storyconnect.com', passwordHash, 'Demo User'],
        function(err) {
          if (err) {
            console.error('Error creating demo user:', err);
          } else {
            console.log('Demo user created successfully with ID:', this.lastID);
          }
        }
      );
    });
  } catch (error) {
    console.error('Error in createDemoUser:', error);
  }
}

createDemoUser();



