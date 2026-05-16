// Centralized text-builders + sync helpers for the memory_embeddings layer.
// Each source-table route can fire-and-forget syncMemory(sourceType, row) on
// create/update and syncMemoryDelete on delete, and the backfill route
// (POST /api/memory/reindex) reuses the same builders.

const { embedAndStore, deleteMemory, isAvailable } = require('./embeddings');

function safeTags(tagStr) {
  if (!tagStr) return [];
  try { const a = JSON.parse(tagStr); return Array.isArray(a) ? a : []; }
  catch (_) { return []; }
}
function safeJsonArr(s) {
  if (!s) return [];
  try { const a = JSON.parse(s); return Array.isArray(a) ? a : []; }
  catch (_) { return []; }
}

const builders = {
  journal: (e) => ({
    text: `Journal entry on ${e.createdAt.toISOString().slice(0, 10)}${e.mood ? `, feeling ${e.mood}` : ''}${e.tags ? ` (tags: ${safeTags(e.tags).join(', ')})` : ''}:\n${e.content}`,
    metadata: { date: e.createdAt.toISOString().slice(0, 10), mood: e.mood || null }
  }),
  dream: (e) => ({
    text: `Dream on ${e.createdAt.toISOString().slice(0, 10)}${e.title ? ` — ${e.title}` : ''}:\n${e.content}`,
    metadata: { date: e.createdAt.toISOString().slice(0, 10), title: e.title || null }
  }),
  trigger: (t) => ({
    text: `Anxiety trigger${t.category ? ` [${t.category}]` : ''}${t.intensity != null ? ` (intensity ${t.intensity}/10)` : ''}: ${t.title}${t.notes ? `\n${t.notes}` : ''}`,
    metadata: { title: t.title, category: t.category || null }
  }),
  belief: (b) => ({
    text: `Belief work — current: "${b.currentBelief}"\nDesired: "${b.desiredBelief}"${b.changePlan ? `\nChange plan: ${b.changePlan}` : ''}`,
    metadata: { current: b.currentBelief, desired: b.desiredBelief }
  }),
  protocol: (p) => ({
    text: `Protocol: ${p.title}${p.whenToUse ? `\nWhen to use: ${p.whenToUse}` : ''}${p.steps ? `\nSteps: ${p.steps}` : ''}`,
    metadata: { title: p.title }
  }),
  goal: (g) => ({
    text: `Goal${g.area ? ` (${g.area})` : ''}: ${g.title}${g.description ? `\n${g.description}` : ''}`,
    metadata: { title: g.title, status: g.status, area: g.area || null }
  }),
  person: (p) => {
    const parts = [`Person: ${p.name}${p.relationship ? ` (${p.relationship})` : ''}`];
    if (p.howMet) parts.push(`How met: ${p.howMet}`);
    if (p.interests) parts.push(`Interests: ${p.interests}`);
    if (p.personalityTraits) parts.push(`Personality: ${p.personalityTraits}`);
    if (p.conversationStyle) parts.push(`Conversation style: ${p.conversationStyle}`);
    if (p.sharedExperiences) parts.push(`Shared: ${p.sharedExperiences}`);
    if (p.notes) parts.push(`Notes: ${p.notes}`);
    return { text: parts.join('\n'), metadata: { name: p.name, relationship: p.relationship || null } };
  },
  story: (s) => ({
    text: `Story: ${s.title}\n${s.content}`,
    metadata: { title: s.title }
  }),
  identity: (v) => {
    const parts = ['Identity / vision'];
    if (v.vision) parts.push(`Vision: ${v.vision}`);
    for (const f of ['values', 'principles', 'traits', 'visionPoints']) {
      const arr = safeJsonArr(v[f]);
      if (arr.length) parts.push(`${f}: ${arr.join('; ')}`);
    }
    return { text: parts.join('\n'), metadata: null };
  },
  // person_note rows arrive with .id, .userId, .personId, .personName,
  // .noteType, .content, .createdAt. Embedding includes the person name so
  // semantic search across all people works even without a personId filter.
  person_note: (n) => {
    const date = n.createdAt ? new Date(n.createdAt).toISOString().slice(0, 10) : null;
    const text = `Note about ${n.personName || 'a person'}${date ? ` (${date})` : ''} [${n.noteType || 'observation'}]: ${n.content}`;
    return { text, metadata: { person_id: n.personId || null, person_name: n.personName || null, note_type: n.noteType || null, date } };
  }
};

function buildFor(sourceType, row) {
  const fn = builders[sourceType];
  if (!fn) return null;
  return fn(row);
}

// Fire-and-forget. Routes call this after a successful write — we don't want a
// transient embeddings failure to take down a journal save.
function syncMemory(sourceType, row) {
  if (!isAvailable()) return;
  if (!row || row.id == null || row.userId == null) return;
  const built = buildFor(sourceType, row);
  if (!built || !built.text || !built.text.trim()) return;
  embedAndStore({
    userId: row.userId,
    sourceType,
    sourceId: row.id,
    content: built.text,
    metadata: built.metadata || null
  }).catch((e) => console.warn(`[memory] ${sourceType} sync failed:`, e?.message));
}

function syncMemoryDelete(userId, sourceType, sourceId) {
  if (!isAvailable()) return;
  if (userId == null || sourceId == null) return;
  deleteMemory({ userId, sourceType, sourceId: Number(sourceId) })
    .catch((e) => console.warn(`[memory] ${sourceType} delete failed:`, e?.message));
}

module.exports = {
  builders,
  buildFor,
  syncMemory,
  syncMemoryDelete
};
