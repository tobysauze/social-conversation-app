const jwt = require('jsonwebtoken');
const { getDatabase } = require('../database/init');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

const getUserById = (userId) => {
  return new Promise((resolve, reject) => {
    try {
      const db = getDatabase();
      const row = db
        .prepare('SELECT id, email, name, created_at FROM users WHERE id = ?')
        .get(userId);
      resolve(row || null);
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = { authenticateToken, getUserById };

