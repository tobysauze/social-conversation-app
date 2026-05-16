// Renders a person + their notes into an Obsidian-style markdown file.
// The file layout intentionally mirrors what the user would maintain by hand:
// YAML frontmatter for machine-readable fields, then prose sections grouped by
// note_type. We never persist this — it's regenerated on read, so it's always
// current with whatever's in the DB.

function safeJsonArr(s) {
  if (!s) return [];
  if (Array.isArray(s)) return s;
  try { const a = JSON.parse(s); return Array.isArray(a) ? a : []; }
  catch (_) { return []; }
}

const SECTION_ORDER = [
  ['snapshot',        'Snapshot'],
  ['character',       'Character / observations'],
  ['value',           'Values'],
  ['preference',      'Preferences'],
  ['story',           "Stories they've told"],
  ['speech_quirk',    'Speech quirks'],
  ['observation',     'Observations'],
  ['pain_point',      'Pain points / sensitive'],
  ['open_thread',     'Open threads'],
  ['recent_context',  'Recent context']
];

function isoDate(d) {
  if (!d) return null;
  try { return new Date(d).toISOString().slice(0, 10); }
  catch (_) { return null; }
}

function frontmatterValue(v) {
  if (v == null || v === '') return null;
  if (Array.isArray(v)) return v.length ? `[${v.map((x) => JSON.stringify(x)).join(', ')}]` : null;
  if (typeof v === 'string') {
    // Quote if it contains special YAML chars; otherwise leave bare.
    if (/[:#\[\]{},&*!|>'"%@`]|^\s|\s$/.test(v) || v.includes('\n')) return JSON.stringify(v);
    return v;
  }
  return String(v);
}

function buildFrontmatter(person, notes) {
  const lastContact = notes.length
    ? isoDate(notes[0].createdAt) // notes are passed sorted newest-first
    : isoDate(person.updatedAt);

  const fields = {
    name: person.name,
    relationship: person.relationship || null,
    how_met: person.howMet || null,
    last_contact: lastContact,
    interests: safeJsonArr(person.interests).slice(0, 12),
    personality_traits: safeJsonArr(person.personalityTraits).slice(0, 12)
  };

  const lines = ['---'];
  for (const [k, v] of Object.entries(fields)) {
    const out = frontmatterValue(v);
    if (out != null) lines.push(`${k}: ${out}`);
  }
  lines.push('---');
  return lines.join('\n');
}

function buildSection(label, notes) {
  if (!notes.length) return null;
  const lines = [`## ${label}`, ''];
  for (const n of notes) {
    const date = isoDate(n.createdAt);
    const dateSuffix = date ? `  _(${date})_` : '';
    lines.push(`- ${n.content}${dateSuffix}`);
  }
  return lines.join('\n');
}

function buildSnapshot(person) {
  // The "Snapshot" section reuses the structured profile fields on the Person
  // record. Notes-of-type-snapshot are rare; if any exist, they get appended.
  const lines = [];
  if (person.conversationStyle) lines.push(`Conversation style: ${person.conversationStyle}`);
  if (person.sharedExperiences) lines.push(`Shared: ${person.sharedExperiences}`);
  if (person.notes) lines.push('', person.notes);
  return lines.length ? lines.join('\n') : null;
}

function renderPersonMarkdown(person, notes = []) {
  const sorted = [...notes].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Group notes by type so each section renders cleanly. Anything with an
  // unrecognized type ends up in "Observations" so it's never lost.
  const grouped = new Map();
  const knownTypes = new Set(SECTION_ORDER.map((s) => s[0]));
  for (const n of sorted) {
    const key = knownTypes.has(n.noteType) ? n.noteType : 'observation';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(n);
  }

  const blocks = [];
  blocks.push(buildFrontmatter(person, sorted));
  blocks.push('');
  blocks.push(`# ${person.name}`);

  const snapshot = buildSnapshot(person);
  if (snapshot) {
    blocks.push('');
    blocks.push('## Snapshot');
    blocks.push('');
    blocks.push(snapshot);
  }

  for (const [type, label] of SECTION_ORDER) {
    if (type === 'snapshot') continue; // already handled above
    const section = buildSection(label, grouped.get(type) || []);
    if (section) {
      blocks.push('');
      blocks.push(section);
    }
  }

  return blocks.join('\n') + '\n';
}

// Combined "vault" view — a single markdown file containing every person in
// the user's people list, separated by horizontal rules. This is what the
// "Download vault" button produces. Single-file is cheap, no zip dependency,
// and paste-into-LLM friendly.
function renderVaultMarkdown(peopleWithNotes) {
  const sections = peopleWithNotes.map(({ person, notes }) => renderPersonMarkdown(person, notes));
  const header = `# People vault\n\nGenerated ${new Date().toISOString().slice(0, 10)}. Each person below is a self-contained markdown block — paste any one (or all of them) into an LLM for context.\n\n---\n\n`;
  return header + sections.join('\n\n---\n\n');
}

function slugify(name) {
  return (name || 'person')
    .toString()
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'person';
}

module.exports = {
  renderPersonMarkdown,
  renderVaultMarkdown,
  slugify
};
