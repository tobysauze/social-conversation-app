const OpenAI = require('openai');
const { prisma } = require('../prisma/client');

// Embeddings go through the direct OpenAI API (OpenRouter does not proxy /embeddings).
const openaiDirect = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const EMBED_MODEL = process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small';
const EMBED_DIM = 1536; // text-embedding-3-small native dimension

let ensured = false;
let extensionAvailable = null; // null = unknown, true/false = checked

async function ensureMemoryTable() {
  if (ensured) return { extensionAvailable };
  try {
    // 1) extension. If this throws, we set extensionAvailable=false and keep
    // the table around in a fallback shape so callers can detect and warn.
    try {
      await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector`);
      extensionAvailable = true;
    } catch (extErr) {
      console.warn('pgvector extension not available:', extErr?.message);
      extensionAvailable = false;
    }

    if (extensionAvailable) {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS memory_embeddings (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          source_type TEXT NOT NULL,
          source_id INTEGER NOT NULL,
          content TEXT NOT NULL,
          metadata JSONB,
          embedding vector(${EMBED_DIM}),
          model TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_memory_embeddings_unique
          ON memory_embeddings(user_id, source_type, source_id)
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_memory_embeddings_user
          ON memory_embeddings(user_id)
      `);
      // Cosine-distance ANN index. hnsw if available, ivfflat fallback, neither is also fine
      // for a personal-scale dataset (sequential scan is plenty fast under a few thousand rows).
      try {
        await prisma.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS idx_memory_embeddings_hnsw
            ON memory_embeddings USING hnsw (embedding vector_cosine_ops)
        `);
      } catch (hnswErr) {
        try {
          await prisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS idx_memory_embeddings_ivfflat
              ON memory_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
          `);
        } catch (_) {
          // No ANN index — that's fine for small datasets.
        }
      }
    }
  } catch (e) {
    console.warn('Could not ensure memory_embeddings table:', e?.message);
  }
  ensured = true;
  return { extensionAvailable };
}

function isAvailable() {
  return Boolean(openaiDirect) && extensionAvailable === true;
}

async function embed(text) {
  if (!openaiDirect) throw new Error('OPENAI_API_KEY is not configured on the server');
  const cleaned = (text || '').toString().slice(0, 8000); // hard cap on input length
  if (!cleaned.trim()) throw new Error('Cannot embed empty text');
  const res = await openaiDirect.embeddings.create({
    model: EMBED_MODEL,
    input: cleaned
  });
  return res.data[0].embedding; // array of floats, length 1536
}

// pgvector accepts the JSON-array literal form like '[0.1,0.2,...]' as a vector.
function vectorLiteral(arr) {
  return JSON.stringify(arr);
}

async function embedAndStore({ userId, sourceType, sourceId, content, metadata = null }) {
  await ensureMemoryTable();
  if (!isAvailable()) return null;

  const text = (content || '').toString().trim();
  if (!text) return null;

  const vector = await embed(text);
  const vec = vectorLiteral(vector);
  const meta = metadata ? JSON.stringify(metadata) : null;

  await prisma.$executeRawUnsafe(
    `INSERT INTO memory_embeddings (user_id, source_type, source_id, content, metadata, embedding, model, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::vector, $7, NOW(), NOW())
     ON CONFLICT (user_id, source_type, source_id) DO UPDATE SET
       content    = EXCLUDED.content,
       metadata   = EXCLUDED.metadata,
       embedding  = EXCLUDED.embedding,
       model      = EXCLUDED.model,
       updated_at = NOW()`,
    userId,
    sourceType,
    sourceId,
    text,
    meta,
    vec,
    EMBED_MODEL
  );
  return true;
}

async function deleteMemory({ userId, sourceType, sourceId }) {
  await ensureMemoryTable();
  if (!isAvailable()) return null;
  await prisma.$executeRawUnsafe(
    `DELETE FROM memory_embeddings WHERE user_id=$1 AND source_type=$2 AND source_id=$3`,
    userId,
    sourceType,
    sourceId
  );
  return true;
}

async function searchSimilar({ userId, query, limit = 8, sourceTypes = null, maxDistance = 0.85 }) {
  await ensureMemoryTable();
  if (!isAvailable()) return [];
  const q = (query || '').toString().trim();
  if (!q) return [];

  const queryVec = await embed(q);
  const vec = vectorLiteral(queryVec);

  // Cosine distance via the <=> operator. Lower = more similar.
  let rows;
  if (Array.isArray(sourceTypes) && sourceTypes.length) {
    rows = await prisma.$queryRawUnsafe(
      `SELECT id, source_type, source_id, content, metadata,
              (embedding <=> $2::vector) AS distance
         FROM memory_embeddings
        WHERE user_id = $1 AND source_type = ANY($3)
        ORDER BY embedding <=> $2::vector
        LIMIT $4`,
      userId,
      vec,
      sourceTypes,
      limit
    );
  } else {
    rows = await prisma.$queryRawUnsafe(
      `SELECT id, source_type, source_id, content, metadata,
              (embedding <=> $2::vector) AS distance
         FROM memory_embeddings
        WHERE user_id = $1
        ORDER BY embedding <=> $2::vector
        LIMIT $3`,
      userId,
      vec,
      limit
    );
  }

  return rows
    .filter((r) => Number(r.distance) <= maxDistance)
    .map((r) => ({
      id: Number(r.id),
      sourceType: r.source_type,
      sourceId: Number(r.source_id),
      content: r.content,
      metadata: r.metadata || null,
      distance: Number(r.distance)
    }));
}

async function getStats(userId) {
  await ensureMemoryTable();
  if (!extensionAvailable) {
    return { available: false, total: 0, bySourceType: {} };
  }
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT source_type, COUNT(*)::int AS c FROM memory_embeddings WHERE user_id=$1 GROUP BY source_type`,
      userId
    );
    const bySourceType = {};
    let total = 0;
    for (const r of rows) {
      const c = Number(r.c) || 0;
      bySourceType[r.source_type] = c;
      total += c;
    }
    return { available: true, total, bySourceType };
  } catch (e) {
    console.warn('Memory stats error:', e?.message);
    return { available: false, total: 0, bySourceType: {} };
  }
}

module.exports = {
  ensureMemoryTable,
  isAvailable,
  embed,
  embedAndStore,
  deleteMemory,
  searchSimilar,
  getStats
};
