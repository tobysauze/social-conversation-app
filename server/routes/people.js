const express = require('express');
const { prisma } = require('../prisma/client');
const { authenticateToken } = require('../middleware/auth');
const { getStoryRecommendations, analyzeJournalForPeopleInsights } = require('../services/openai');

const router = express.Router();

// Get all people for a user
router.get('/', authenticateToken, async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  try {
    const people = await prisma.person.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit)
    });
    const legacy = people.map(p => ({
      id: p.id,
      user_id: p.userId,
      name: p.name,
      relationship: p.relationship,
      how_met: p.howMet,
      interests: p.interests,
      personality_traits: p.personalityTraits,
      conversation_style: p.conversationStyle,
      shared_experiences: p.sharedExperiences,
      story_preferences: p.storyPreferences,
      notes: p.notes,
      created_at: p.createdAt,
      updated_at: p.updatedAt
    }));
    res.json({ people: legacy });
  } catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Get a specific person
router.get('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const person = await prisma.person.findFirst({
      where: { id: Number(id), userId: req.user.userId }
    });
    if (!person) return res.status(404).json({ error: 'Person not found' });
    const legacy = {
      id: person.id,
      user_id: person.userId,
      name: person.name,
      relationship: person.relationship,
      how_met: person.howMet,
      interests: person.interests,
      personality_traits: person.personalityTraits,
      conversation_style: person.conversationStyle,
      shared_experiences: person.sharedExperiences,
      story_preferences: person.storyPreferences,
      notes: person.notes,
      created_at: person.createdAt,
      updated_at: person.updatedAt
    };
    res.json({ person: legacy });
  } catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Create a new person
router.post('/', authenticateToken, async (req, res) => {
  const {
    name,
    relationship,
    how_met,
    interests = [],
    personality_traits = [],
    conversation_style,
    shared_experiences = [],
    story_preferences = [],
    notes
  } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    const person = await prisma.person.create({
      data: {
        userId: req.user.userId,
        name,
        relationship: relationship || null,
        howMet: how_met || null,
        interests: JSON.stringify(interests || []),
        personalityTraits: JSON.stringify(personality_traits || []),
        conversationStyle: conversation_style || null,
        sharedExperiences: JSON.stringify(shared_experiences || []),
        storyPreferences: JSON.stringify(story_preferences || []),
        notes: notes || null
      }
    });
    const legacy = {
      id: person.id,
      user_id: person.userId,
      name: person.name,
      relationship: person.relationship,
      how_met: person.howMet,
      interests: person.interests,
      personality_traits: person.personalityTraits,
      conversation_style: person.conversationStyle,
      shared_experiences: person.sharedExperiences,
      story_preferences: person.storyPreferences,
      notes: person.notes,
      created_at: person.createdAt,
      updated_at: person.updatedAt
    };
    res.status(201).json({ person: legacy });
  } catch (e) {
    res.status(500).json({ error: 'Failed to create person' });
  }
});

// Update a person
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const {
    name,
    relationship,
    how_met,
    interests = [],
    personality_traits = [],
    conversation_style,
    shared_experiences = [],
    story_preferences = [],
    notes
  } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    const person = await prisma.person.update({
      where: { id: Number(id) },
      data: {
        name,
        relationship: relationship || null,
        howMet: how_met || null,
        interests: JSON.stringify(interests || []),
        personalityTraits: JSON.stringify(personality_traits || []),
        conversationStyle: conversation_style || null,
        sharedExperiences: JSON.stringify(shared_experiences || []),
        storyPreferences: JSON.stringify(story_preferences || []),
        notes: notes || null
      }
    });
    const legacy = {
      id: person.id,
      user_id: person.userId,
      name: person.name,
      relationship: person.relationship,
      how_met: person.howMet,
      interests: person.interests,
      personality_traits: person.personalityTraits,
      conversation_style: person.conversationStyle,
      shared_experiences: person.sharedExperiences,
      story_preferences: person.storyPreferences,
      notes: person.notes,
      created_at: person.createdAt,
      updated_at: person.updatedAt
    };
    res.json({ person: legacy });
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Person not found' });
    res.status(500).json({ error: 'Failed to update person' });
  }
});

// Delete a person
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.person.delete({ where: { id: Number(id) } });
    res.json({ message: 'Person deleted successfully' });
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Person not found' });
    res.status(500).json({ error: 'Failed to delete person' });
  }
});

// Get story recommendations for a person
router.get('/:id/story-recommendations', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    // Get person details
    db.get(
      'SELECT * FROM people WHERE id = ? AND user_id = ?',
      [id, req.user.userId],
      async (err, person) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        if (!person) {
          return res.status(404).json({ error: 'Person not found' });
        }

        // Get user's stories and journal entries
        db.all(
          `SELECT s.*, je.content as journal_content 
           FROM stories s 
           LEFT JOIN journal_entries je ON s.journal_entry_id = je.id 
           WHERE s.user_id = ? 
           ORDER BY s.created_at DESC`,
          [req.user.userId],
          async (err, stories) => {
            if (err) {
              return res.status(500).json({ error: 'Database error' });
            }

            try {
              // Parse person's JSON fields
              const parsedPerson = {
                ...person,
                interests: person.interests ? JSON.parse(person.interests) : [],
                personality_traits: person.personality_traits ? JSON.parse(person.personality_traits) : [],
                shared_experiences: person.shared_experiences ? JSON.parse(person.shared_experiences) : [],
                story_preferences: person.story_preferences ? JSON.parse(person.story_preferences) : []
              };

              // Get AI recommendations
              const recommendations = await getStoryRecommendations(parsedPerson, stories);
              res.json({ recommendations });
            } catch (error) {
              console.error('Error getting story recommendations:', error);
              res.status(500).json({ error: 'Failed to get story recommendations' });
            }
          }
        );
      }
    );
  } catch (error) {
    console.error('Story recommendations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Tag a story with a person
router.post('/:id/tag-story/:storyId', authenticateToken, (req, res) => {
  const { id: personId, storyId } = req.params;
  const db = getDatabase();

  db.run(
    'INSERT OR IGNORE INTO story_people (story_id, person_id) VALUES (?, ?)',
    [storyId, personId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to tag story' });
      }

      res.json({ message: 'Story tagged successfully' });
    }
  );
});

// Remove tag from a story
router.delete('/:id/tag-story/:storyId', authenticateToken, (req, res) => {
  const { id: personId, storyId } = req.params;
  const db = getDatabase();

  db.run(
    'DELETE FROM story_people WHERE story_id = ? AND person_id = ?',
    [storyId, personId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to remove tag' });
      }

      res.json({ message: 'Tag removed successfully' });
    }
  );
});

// Tag a journal entry with a person
router.post('/:id/tag-journal/:journalId', authenticateToken, (req, res) => {
  const { id: personId, journalId } = req.params;
  const db = getDatabase();

  db.run(
    'INSERT OR IGNORE INTO journal_people (journal_entry_id, person_id) VALUES (?, ?)',
    [journalId, personId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to tag journal entry' });
      }

      res.json({ message: 'Journal entry tagged successfully' });
    }
  );
});

// Remove tag from a journal entry
router.delete('/:id/tag-journal/:journalId', authenticateToken, (req, res) => {
  const { id: personId, journalId } = req.params;
  const db = getDatabase();

  db.run(
    'DELETE FROM journal_people WHERE journal_entry_id = ? AND person_id = ?',
    [journalId, personId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to remove tag' });
      }

      res.json({ message: 'Tag removed successfully' });
    }
  );
});

// Analyze journal entry for people insights
router.post('/analyze-journal', authenticateToken, async (req, res) => {
  try {
    const { journalContent } = req.body;
    
    if (!journalContent) {
      return res.status(400).json({ error: 'Journal content is required' });
    }

    const db = getDatabase();

    // Get existing people for this user
    db.all(
      'SELECT * FROM people WHERE user_id = ?',
      [req.user.userId],
      async (err, existingPeople) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        if (!existingPeople) { // Handle case where no people exist
          existingPeople = [];
        }

        console.log('Existing people for user:', existingPeople);

        try {
          // Parse existing people data
          const parsedPeople = existingPeople.map(person => ({
            ...person,
            interests: person.interests ? JSON.parse(person.interests) : [],
            personality_traits: person.personality_traits ? JSON.parse(person.personality_traits) : [],
            shared_experiences: person.shared_experiences ? JSON.parse(person.shared_experiences) : [],
            story_preferences: person.story_preferences ? JSON.parse(person.story_preferences) : []
          }));

          // Analyze journal for people insights
          const insights = await analyzeJournalForPeopleInsights(journalContent, parsedPeople);
          console.log('AI returned insights:', insights);
          res.json({ insights: insights.people_insights });
        } catch (error) {
          console.error('Error analyzing journal:', error);
          res.status(500).json({ error: 'Failed to analyze journal entry' });
        }
      }
    );
  } catch (error) {
    console.error('Journal analysis error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Apply insights to a person's profile
router.post('/:id/apply-insights', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { insights } = req.body;

  console.log('Applying insights to person:', id, 'Insights:', insights);

  if (!insights) {
    return res.status(400).json({ error: 'Insights are required' });
  }

  const db = getDatabase();

  // Get current person data
  db.get(
    'SELECT * FROM people WHERE id = ? AND user_id = ?',
    [id, req.user.userId],
    (err, person) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!person) {
        return res.status(404).json({ error: 'Person not found' });
      }

      // Parse current data
      const currentInterests = person.interests ? JSON.parse(person.interests) : [];
      const currentTraits = person.personality_traits ? JSON.parse(person.personality_traits) : [];
      const currentPreferences = person.story_preferences ? JSON.parse(person.story_preferences) : [];

      // Merge new insights with existing data
      const updatedInterests = [...new Set([...currentInterests, ...(insights.interests || [])])];
      const updatedTraits = [...new Set([...currentTraits, ...(insights.personality_traits || [])])];
      const updatedPreferences = [...new Set([...currentPreferences, ...(insights.preferences || [])])];

      // Update conversation style if provided
      const updatedConversationStyle = insights.conversation_style || person.conversation_style;

      // Update person
      db.run(
        `UPDATE people SET 
          interests = ?, 
          personality_traits = ?, 
          story_preferences = ?,
          conversation_style = ?,
          notes = CASE 
            WHEN notes IS NULL OR notes = '' THEN ?
            ELSE notes || '\n\n' || ?
          END,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND user_id = ?`,
        [
          JSON.stringify(updatedInterests),
          JSON.stringify(updatedTraits),
          JSON.stringify(updatedPreferences),
          updatedConversationStyle,
          insights.observations || '',
          insights.observations || '',
          id,
          req.user.userId
        ],
        function(err) {
          if (err) {
            console.error('Database error updating person:', err);
            return res.status(500).json({ error: 'Failed to update person: ' + err.message });
          }

          if (this.changes === 0) {
            return res.status(404).json({ error: 'Person not found' });
          }

          console.log('Successfully applied insights to person:', id);
          res.json({ message: 'Insights applied successfully' });
        }
      );
    }
  );
});

module.exports = router;
