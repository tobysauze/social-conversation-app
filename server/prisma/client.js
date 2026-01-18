let PrismaClient;
try {
  ({ PrismaClient } = require('@prisma/client'));
} catch (e) {
  // Allow running in SQLite-only mode (e.g., local dev without installing Prisma deps)
  module.exports = { prisma: null };
  return;
}

let prisma;
if (!global.__prisma) {
  global.__prisma = new PrismaClient();
}
prisma = global.__prisma;

module.exports = { prisma };







