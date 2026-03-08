const jwt = require('jsonwebtoken');
const { prisma } = require('../prisma/client');

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

const getUserById = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: Number(userId) },
    select: { id: true, email: true, name: true, createdAt: true }
  });
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    created_at: user.createdAt
  };
};

module.exports = { authenticateToken, getUserById };

