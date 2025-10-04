const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateToken } = require('../middleware/auth');
const { getStoryRecommendations, analyzeJournalForPeopleInsights } = require('../services/openai');

const router = express.Router();

// Get all people for a user
router.get('/', authenticateToken, (req, res) => {
  const db = getDatabase();
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  db.all(
    `SELECT * FROM people 
     WHERE user_id = ? 
     ORDER BY created_at DESC 
     LIMIT ? OFFSET ?`,
    [req.user.userId, limit, offset],
    (err, people) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      // Parse JSON fields
      const parsedPeople = people.map(person => ({
        ...person,
        interests: person.interests ? JSON.parse(person.interests) : [],
        personality_traits: person.personality_traits ? JSON.parse(person.personality_traits) : [],
        shared_experiences: person.shared_experiences ? JSON.parse(person.shared_experiences) : [],
        story_preferences: person.story_preferences ? JSON.parse(person.story_preferences) : []
      }));
      
      res.json({ people: parsedPeople });
    }
  );
});

// Get a specific person
router.get('/:id', authenticateToken, (req, res) => {
  const db = getDatabase();
  const { id } = req.params;

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

      // Parse JSON fields
      const parsedPerson = {
        ...person,
        interests: person.interests ? JSON.parse(person.interests) : [],
        personality_traits: person.personality_traits ? JSON.parse(person.personality_traits) : [],
        shared_experiences: person.shared_experiences ? JSON.parse(person.shared_experiences) : [],
        story_preferences: person.story_preferences ? JSON.parse(person.story_preferences) : []
      };

      res.json({ person: parsedPerson });
    }
  );
});

// Create a new person
router.post('/', authenticateToken, (req, res) => {
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

  const db = getDatabase();

  db.run(
    `INSERT INTO people (
      user_id, name, relationship, how_met, interests, 
      personality_traits, conversation_style, shared_experiences, 
      story_preferences, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      req.user.userId,
      name,
      relationship,
      how_met,
      JSON.stringify(interests),
      JSON.stringify(personality_traits),
      conversation_style,
      JSON.stringify(shared_experiences),
      JSON.stringify(story_preferences),
      notes
    ],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to create person' });
      }

      // Return the created person
      db.get(
        'SELECT * FROM people WHERE id = ?',
        [this.lastID],
        (err, person) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to retrieve created person' });
          }
          
          // Parse JSON fields
          const parsedPerson = {
            ...person,
            interests: person.interests ? JSON.parse(person.interests) : [],
            personality_traits: person.personality_traits ? JSON.parse(person.personality_traits) : [],
            shared_experiences: person.shared_experiences ? JSON.parse(person.shared_experiences) : [],
            story_preferences: person.story_preferences ? JSON.parse(person.story_preferences) : []
          };
          
          res.status(201).json({ person: parsedPerson });
        }
      );
    }
  );
});

// Update a person
router.put('/:id', authenticateToken, (req, res) => {
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

  const db = getDatabase();

  db.run(
    `UPDATE people SET 
      name = ?, relationship = ?, how_met = ?, interests = ?, 
      personality_traits = ?, conversation_style = ?, shared_experiences = ?, 
      story_preferences = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND user_id = ?`,
    [
      name,
      relationship,
      how_met,
      JSON.stringify(interests),
      JSON.stringify(personality_traits),
      conversation_style,
      JSON.stringify(shared_experiences),
      JSON.stringify(story_preferences),
      notes,
      id,
      req.user.userId
    ],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to update person' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Person not found' });
      }

      // Return the updated person
      db.get(
        'SELECT * FROM people WHERE id = ?',
        [id],
        (err, person) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to retrieve updated person' });
          }
          
          // Parse JSON fields
          const parsedPerson = {
            ...person,
            interests: person.interests ? JSON.parse(person.interests) : [],
            personality_traits: person.personality_traits ? JSON.parse(person.personality_traits) : [],
            shared_experiences: person.shared_experiences ? JSON.parse(person.shared_experiences) : [],
            story_preferences: person.story_preferences ? JSON.parse(person.story_preferences) : []
          };
          
          res.json({ person: parsedPerson });
        }
      );
    }
  );
});

// Delete a person
router.delete('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const db = getDatabase();

  db.run(
    'DELETE FROM people WHERE id = ? AND user_id = ?',
    [id, req.user.userId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to delete person' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Person not found' });
      }

      res.json({ message: 'Person deleted successfully' });
    }
  );
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
