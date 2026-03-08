const express = require('express');
const { prisma } = require('../prisma/client');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

function toJsonArray(input) {
  if (Array.isArray(input)) return input.map((v) => String(v).trim()).filter(Boolean);
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return [];
    return trimmed
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

function parseStoredArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

const emptyRequirements = {
  partner_vision: '',
  must_haves: [],
  nice_to_haves: [],
  red_flags: [],
  interests: []
};

function parseRequirements(value) {
  if (!value) return emptyRequirements;
  if (typeof value === 'object' && value !== null) return value;
  if (typeof value !== 'string') return emptyRequirements;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object') {
      return {
        partner_vision: parsed.partner_vision || '',
        must_haves: parseStoredArray(parsed.must_haves),
        nice_to_haves: parseStoredArray(parsed.nice_to_haves),
        red_flags: parseStoredArray(parsed.red_flags),
        interests: parseStoredArray(parsed.interests)
      };
    }
  } catch (_) {}
  return emptyRequirements;
}

function buildProfileResponse(row) {
  const selfReflection =
    typeof row.selfReflectionAnswers === 'string'
      ? (() => {
          try {
            return JSON.parse(row.selfReflectionAnswers || '{}');
          } catch (_) {
            return {};
          }
        })()
      : row.selfReflectionAnswers || {};

  const shortTerm = parseRequirements(row.shortTermRequirements);
  const longTerm = parseRequirements(row.longTermRequirements);

  return {
    short_term: shortTerm,
    long_term: longTerm,
    self_reflection_answers: selfReflection
  };
}

const emptyProfileResponse = {
  short_term: emptyRequirements,
  long_term: emptyRequirements,
  self_reflection_answers: {}
};

router.get('/', authenticateToken, async (req, res) => {
  try {
    const profile = await prisma.datingProfile.findUnique({
      where: { userId: req.user.userId }
    });
    if (!profile) {
      return res.json({ profile: emptyProfileResponse });
    }
    return res.json({ profile: buildProfileResponse(profile) });
  } catch (e) {
    console.error('Dating GET error:', e);
    return res.status(500).json({ error: 'Database error' });
  }
});

function toRequirements(obj) {
  if (!obj || typeof obj !== 'object') return emptyRequirements;
  return {
    partner_vision: (obj.partner_vision || '').toString().trim(),
    must_haves: toJsonArray(obj.must_haves),
    nice_to_haves: toJsonArray(obj.nice_to_haves),
    red_flags: toJsonArray(obj.red_flags),
    interests: toJsonArray(obj.interests)
  };
}

router.post('/', authenticateToken, async (req, res) => {
  const payload = req.body || {};

  const shortTerm = toRequirements(payload.short_term);
  const longTerm = toRequirements(payload.long_term);
  const selfReflectionAnswers =
    payload.self_reflection_answers && typeof payload.self_reflection_answers === 'object'
      ? payload.self_reflection_answers
      : {};

  const shortTermJson = JSON.stringify(shortTerm);
  const longTermJson = JSON.stringify(longTerm);
  const selfReflectionJson = JSON.stringify(selfReflectionAnswers);

  try {
    await prisma.datingProfile.upsert({
      where: { userId: req.user.userId },
      create: {
        userId: req.user.userId,
        shortTermRequirements: shortTermJson,
        longTermRequirements: longTermJson,
        selfReflectionAnswers: selfReflectionJson
      },
      update: {
        shortTermRequirements: shortTermJson,
        longTermRequirements: longTermJson,
        selfReflectionAnswers: selfReflectionJson
      }
    });
    return res.json({ message: 'Saved' });
  } catch (e) {
    console.error('Dating POST error:', e);
    return res.status(500).json({ error: 'Failed to save dating profile' });
  }
});

module.exports = router;
