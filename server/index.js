const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const journalRoutes = require('./routes/journal');
const storyRoutes = require('./routes/stories');
const practiceRoutes = require('./routes/practice');
const peopleRoutes = require('./routes/people');
const jokesRoutes = require('./routes/jokes');
const adminRoutes = require('./routes/admin');
const wellnessRoutes = require('./routes/wellness');
const ingestRoutes = require('./routes/ingest');
const coachRoutes = require('./routes/coach');
const identityRoutes = require('./routes/identity');
const goalsRoutes = require('./routes/goals');
const wellnessImportRoutes = require('./routes/wellness_import');
// Prisma client (Postgres)
let prisma = null;
try {
  const { PrismaClient } = require('@prisma/client');
  prisma = new PrismaClient();
} catch (e) {
  console.warn('Prisma not initialized yet (likely before migration).');
}

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());

// Rate limiting - disabled for development
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100, // limit each IP to 100 requests per windowMs
//   trustProxy: false // Disable trust proxy for development
// });
// app.use(limiter);

// CORS configuration
const allowedOriginRegexes = [
  /https?:\/\/.*\.vercel\.app$/i,
  /https?:\/\/localhost(:\d+)?$/i
];

const corsOptions = {
  credentials: true,
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    // Always allow explicit FRONTEND_URL if provided
    if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) {
      return callback(null, true);
    }

    // Allow common dev URL
    if (process.env.NODE_ENV !== 'production' && origin.startsWith('http://localhost:3000')) {
      return callback(null, true);
    }

    // Allow any *.vercel.app domain
    const isAllowed = allowedOriginRegexes.some((re) => re.test(origin));
    if (isAllowed) return callback(null, true);

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  }
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/journal', journalRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/practice', practiceRoutes);
app.use('/api/people', peopleRoutes);
app.use('/api/jokes', jokesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/wellness', wellnessRoutes);
app.use('/api/ingest', ingestRoutes);
app.use('/api/coach', coachRoutes);
app.use('/api/identity', identityRoutes);
app.use('/api/goals', goalsRoutes);
app.use('/api/wellness-import', wellnessImportRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Health check endpoint for Railway
app.get('/api/health', (req, res) => {
  console.log('Health check requested');
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    port: PORT,
    nodeEnv: process.env.NODE_ENV
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server immediately, initialize database in background
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 Social Conversation App API ready!`);
  console.log(`🌐 Health check available at: http://0.0.0.0:${PORT}/api/health`);
  if (prisma) {
    console.log('✅ Prisma ready for Postgres');
  } else {
    console.log('ℹ️ Using legacy SQLite until Prisma is configured.');
  }
});
