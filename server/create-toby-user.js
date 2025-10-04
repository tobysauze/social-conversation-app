const bcrypt = require('bcryptjs');
const { getDatabase } = require('./database/init');

async function createTobyUser() {
  try {
    const db = getDatabase();
    
    // Check if Toby user already exists
    db.get('SELECT id FROM users WHERE name = ?', ['Toby'], async (err, row) => {
      if (err) {
        console.error('Error checking for Toby user:', err);
        return;
      }
      
      if (row) {
        console.log('Toby user already exists');
        return;
      }

      // Create Toby user
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash('Amazon12308', saltRounds);

      db.run(
        'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
        ['toby@example.com', passwordHash, 'Toby'],
        function(err) {
          if (err) {
            console.error('Error creating Toby user:', err);
          } else {
            console.log('Toby user created successfully with ID:', this.lastID);
            console.log('Username: Toby');
            console.log('Password: Amazon12308');
          }
        }
      );
    });
  } catch (error) {
    console.error('Error in createTobyUser:', error);
  }
}

createTobyUser();
