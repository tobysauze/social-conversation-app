const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const extractStories = async (journalContent) => {
  try {
    const prompt = `
You are a helpful assistant that extracts potential conversation stories from journal entries. 
Look for interesting anecdotes, observations, experiences, or moments that could be turned into engaging 30-60 second stories for social conversations.

From this journal entry, identify 1-3 potential story-worthy moments:

"${journalContent}"

For each potential story, provide:
1. A brief title (2-4 words)
2. The core event/experience in 1-2 sentences
3. The emotional tone (funny, thoughtful, surprising, relatable, etc.)
4. Why it would be interesting to others

Format your response as JSON:
{
  "stories": [
    {
      "title": "Story title",
      "core_event": "Brief description of what happened",
      "tone": "emotional_tone",
      "interest_reason": "Why this would be engaging to others"
    }
  ]
}

If no story-worthy content is found, return: {"stories": []}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const content = response.choices[0].message.content;
    return JSON.parse(content);
  } catch (error) {
    console.error('Error extracting stories:', error);
    throw new Error('Failed to extract stories from journal entry');
  }
};

const buildRefinePrompt = (storyContent, tone = 'casual', duration = 30, notes = '') => {
  const prompt = `You are a skilled storyteller whose job is to create short, funny, or impressive stories designed to be told casually at a bar or pub to entertain and connect with people.

Tone: Conversational, natural, confident, and slightly mischievous — like someone who's been around, seen some things, and knows how to tell a good story without trying too hard.

Length: Around ${duration} seconds when spoken out loud (roughly ${Math.floor(duration * 2.5)} words).

Setting: Bars or pubs — stories should sound believable and conversational, not theatrical or rehearsed. They should feel like something that might actually have happened to a friend-of-a-friend, or something that could happen to you.

Goal: Make people laugh, make them curious, or make them go "no way, that's wild." The story should make the teller seem interesting, fun, and a little unpredictable — but not arrogant or fake.

Avoid: Long exposition, too many characters, heavy topics (politics, religion, tragedy), or anything that feels like a stand-up routine. Keep it light, playful, and natural.

Optional twist: Add a clever or ironic ending — something that makes people chuckle or shake their heads.

User preferences to honor (if any):
"""
${notes}
"""

Original story:
"""
${storyContent}
"""

Rewrite this story following ALL the guidelines above. Return ONLY the rewritten story text, no preface or explanation.
`;
  return prompt;
};

const refineStory = async (storyContent, tone = 'casual', duration = 30, notes = '') => {
  try {
    const prompt = buildRefinePrompt(storyContent, tone, duration, notes);

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.9,
      max_tokens: 300,
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error refining story:', error);
    throw new Error('Failed to refine story');
  }
};

const generateConversationStarters = async (storyContent) => {
  try {
    const prompt = `
Based on this story, generate 3-5 conversation starter questions that could naturally lead to sharing this story or asking others about similar experiences.

Story: "${storyContent}"

Generate questions that:
- Are open-ended and engaging
- Could naturally lead to sharing this story
- Ask about similar experiences
- Are appropriate for casual social settings

Format as JSON:
{
  "questions": [
    "Question 1?",
    "Question 2?",
    "Question 3?"
  ]
}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 500,
    });

    const content = response.choices[0].message.content;
    return JSON.parse(content);
  } catch (error) {
    console.error('Error generating conversation starters:', error);
    throw new Error('Failed to generate conversation starters');
  }
};

const practiceFeedback = async (storyContent, userDelivery) => {
  try {
    const prompt = `
You are a supportive conversation coach. A user is practicing telling this story:

Original story: "${storyContent}"

User's delivery: "${userDelivery}"

Provide constructive feedback on:
1. Clarity and flow
2. Engagement level
3. Timing and pacing
4. Areas for improvement
5. What they did well

Keep feedback encouraging and specific. Suggest 1-2 concrete improvements.

Format as JSON:
{
  "feedback": "Overall feedback text",
  "strengths": ["strength 1", "strength 2"],
  "improvements": ["improvement 1", "improvement 2"],
  "rating": 8
}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
      max_tokens: 400,
    });

    const content = response.choices[0].message.content;
    return JSON.parse(content);
  } catch (error) {
    console.error('Error generating practice feedback:', error);
    throw new Error('Failed to generate practice feedback');
  }
};

const getStoryRecommendations = async (person, stories) => {
  try {
    const prompt = `
You are a helpful assistant that recommends stories and journal entries for specific people based on their interests and personality.

Person Profile:
- Name: ${person.name}
- Relationship: ${person.relationship || 'Not specified'}
- How we met: ${person.how_met || 'Not specified'}
- Interests: ${person.interests.join(', ') || 'Not specified'}
- Personality traits: ${person.personality_traits.join(', ') || 'Not specified'}
- Conversation style: ${person.conversation_style || 'Not specified'}
- Shared experiences: ${person.shared_experiences.join(', ') || 'Not specified'}
- Story preferences: ${person.story_preferences.join(', ') || 'Not specified'}
- Notes: ${person.notes || 'None'}

Available Stories and Journal Entries:
${stories.map((story, index) => `
${index + 1}. Title: ${story.title}
   Content: ${story.content}
   Tone: ${story.tone}
   Journal Content: ${story.journal_content || 'N/A'}
`).join('\n')}

Based on this person's profile, recommend 3-5 stories or journal entries that would be most interesting to them. For each recommendation, explain:
1. Why this story would appeal to them
2. How it connects to their interests or personality
3. What conversation it might spark

Format your response as valid JSON (no markdown code blocks):
{
  "recommendations": [
    {
      "story_id": 1,
      "title": "Story title",
      "reason": "Why this person would find this interesting",
      "connection": "How it connects to their interests/personality",
      "conversation_starter": "What this might lead to in conversation"
    }
  ]
}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 1500,
    });

    const content = response.choices[0].message.content;
    
    // Clean up the response to ensure valid JSON
    let cleanedContent = content.trim();
    
    // Remove any markdown code blocks if present
    if (cleanedContent.startsWith('```json')) {
      cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    try {
      return JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('JSON Parse Error in getStoryRecommendations:', parseError);
      console.error('Raw content:', content);
      console.error('Cleaned content:', cleanedContent);
      
      // Return a safe fallback
      return {
        recommendations: []
      };
    }
  } catch (error) {
    console.error('Error getting story recommendations:', error);
    throw new Error('Failed to get story recommendations');
  }
};

const analyzeJournalForPeopleInsights = async (journalContent, existingPeople = []) => {
  try {
    const peopleNames = existingPeople.map(person => person.name).join(', ');
    
    const prompt = `
You are a helpful assistant that analyzes journal entries to extract insights about people mentioned in them.

Journal Entry:
"${journalContent}"

Existing People in Database:
${existingPeople.length > 0 ? existingPeople.map(p => `ID: ${p.id}, Name: ${p.name}`).join(', ') : 'No existing people in database'}

Analyze this journal entry and identify:
1. People mentioned (by name or description like "my colleague", "the barista", etc.)
2. For each person, extract insights about:
   - Interests and hobbies they showed
   - Personality traits observed
   - Conversation preferences or style
   - Things they seemed to enjoy or dislike
   - Any other relevant information

IMPORTANT: If a person mentioned in the journal matches an existing person by name, set:
- "is_existing_person": true
- "existing_person_id": the ID number from the existing people list above

If it's a new person, set:
- "is_existing_person": false  
- "existing_person_id": null

Format your response as valid JSON (no markdown code blocks):
{
  "people_insights": [
    {
      "person_name": "Name or description of person",
      "is_existing_person": false,
      "existing_person_id": null,
      "new_insights": {
        "interests": ["interest1", "interest2"],
        "personality_traits": ["trait1", "trait2"],
        "conversation_style": "style description",
        "preferences": ["preference1", "preference2"],
        "observations": "What you observed about them"
      },
      "confidence": 0.8
    }
  ]
}

Only include people who are clearly mentioned or described. Be conservative - only extract insights you're confident about.
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const content = response.choices[0].message.content;
    
    // Clean up the response to ensure valid JSON
    let cleanedContent = content.trim();
    
    // Remove any markdown code blocks if present
    if (cleanedContent.startsWith('```json')) {
      cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    try {
      return JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('JSON Parse Error in analyzeJournalForPeopleInsights:', parseError);
      console.error('Raw content:', content);
      console.error('Cleaned content:', cleanedContent);
      
      // Return a safe fallback
      return {
        people_insights: []
      };
    }
  } catch (error) {
    console.error('Error analyzing journal for people insights:', error);
    throw new Error('Failed to analyze journal for people insights');
  }
};

const generateJoke = async (prompt, category = null, difficulty = null, personInfo = null) => {
  try {
    let personContext = '';
    if (personInfo) {
      personContext = `
Person Context:
- Name: ${personInfo.name}
- Interests: ${personInfo.interests.join(', ')}
- Personality: ${personInfo.personality_traits.join(', ')}
- Conversation Style: ${personInfo.conversation_style}

Create a joke that would appeal to this person's sense of humor and interests.
`;
    }

    const categoryContext = category ? `Category: ${category}\n` : '';
    const difficultyContext = difficulty ? `Difficulty Level: ${difficulty}\n` : '';

    const aiPrompt = `
You are a professional comedian and joke writer. Create a funny, appropriate joke based on the user's request.

${personContext}${categoryContext}${difficultyContext}
User Request: "${prompt}"

Create a joke that is:
- Funny and well-crafted
- Appropriate for general audiences
- Easy to remember and tell
- Matches the requested category and difficulty level
${personInfo ? '- Tailored to appeal to the specific person mentioned' : ''}

Format your response as JSON:
{
  "title": "Short, catchy title for the joke",
  "content": "The complete joke text",
  "category": "joke category (pun, one-liner, story, observational, etc.)",
  "difficulty": "difficulty level (easy, medium, hard)",
  "explanation": "Brief explanation of why this joke works"
}

Make sure the joke is original and creative. Avoid offensive, inappropriate, or controversial content.
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: aiPrompt }],
      temperature: 0.8,
      max_tokens: 1000,
    });

    const content = response.choices[0].message.content;
    
    // Clean up the response to ensure valid JSON
    let cleanedContent = content.trim();
    
    // Remove any markdown code blocks if present
    if (cleanedContent.startsWith('```json')) {
      cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    try {
      return JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('JSON Parse Error in generateJoke:', parseError);
      console.error('Raw content:', content);
      console.error('Cleaned content:', cleanedContent);
      
      // Return a safe fallback
      return {
        title: "Generated Joke",
        content: "I apologize, but I couldn't generate a proper joke at this time. Please try again!",
        category: "general",
        difficulty: "easy",
        explanation: "Fallback response due to parsing error"
      };
    }
  } catch (error) {
    console.error('Error generating joke:', error);
    throw new Error('Failed to generate joke');
  }
};

const iterateJoke = async (joke, conversationHistory = []) => {
  try {
    let conversationContext = '';
    if (conversationHistory.length > 0) {
      conversationContext = `
Previous conversation:
${conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}
`;
    }

    const aiPrompt = `
You are a professional comedy writer and joke improvement expert. Your task is to help improve jokes through collaborative iteration.

${conversationContext}
Current joke to improve:
Title: ${joke.title}
Content: ${joke.content}
Category: ${joke.category || 'general'}
Difficulty: ${joke.difficulty || 'medium'}

${conversationHistory.length === 0 ? `
Please provide an improved version of this joke. Consider:
- Making it funnier and more engaging
- Improving the timing and delivery
- Enhancing the punchline
- Making it more memorable
- Keeping the same general concept but improving execution

Provide your improved version and explain what changes you made and why they make the joke better.
` : `
Based on our conversation, please provide your next suggestion for improving this joke. Be specific about what you're changing and why.
`}

Format your response as JSON:
{
  "improved_joke": {
    "title": "Improved joke title",
    "content": "The improved joke text",
    "category": "joke category",
    "difficulty": "difficulty level"
  },
  "explanation": "Explanation of what was improved and why",
  "suggestions": ["Additional suggestion 1", "Additional suggestion 2"]
}

Make sure the improved joke is genuinely funnier and more polished than the original.
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: aiPrompt }],
      temperature: 0.8,
      max_tokens: 1000,
    });

    const content = response.choices[0].message.content;

    // Clean up the response to ensure valid JSON
    let cleanedContent = content.trim();

    // Remove any markdown code blocks if present
    if (cleanedContent.startsWith('```json')) {
      cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    try {
      return JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('JSON Parse Error in iterateJoke:', parseError);
      console.error('Raw content:', content);
      console.error('Cleaned content:', cleanedContent);

      // Return a safe fallback
      return {
        improved_joke: {
          title: joke.title,
          content: joke.content,
          category: joke.category || "general",
          difficulty: joke.difficulty || "medium"
        },
        explanation: "I apologize, but I couldn't process the joke improvement at this time. Please try again!",
        suggestions: ["Try rephrasing the joke", "Consider a different punchline"]
      };
    }
  } catch (error) {
    console.error('Error iterating joke:', error);
    throw new Error('Failed to iterate joke');
  }
};

// Classify a joke using a rich taxonomy, and also map to a primary app category
const categorizeJoke = async (jokeText) => {
  try {
    // App-supported primary categories for storage/filters
    const primaryCategories = [
      'pun',
      'one-liner',
      'story',
      'observational',
      'wordplay',
      'situational',
      'general'
    ];

    // Full taxonomy list (condensed from user-provided taxonomy)
    const taxonomy = [
      'Puns', 'Malapropisms', 'Spoonerisms', 'Double entendre', 'Nonsense/Absurd phrasing',
      'One-liners', 'Set-up and punchline', 'Callbacks', 'Anti-jokes', 'Meta-humor',
      'Slapstick/Physical comedy', 'Situational comedy', 'Farce', 'Improvisational humor',
      'Satire', 'Parody', 'Irony', 'Sarcasm', 'Self-deprecating humor', 'Dark/gallows humor',
      'Incongruity', 'Surreal/absurdist humor', 'Shock humor', 'Blue humor', 'Deadpan',
      'Observational humor', 'Ethnic/cultural jokes', 'Generational humor', 'Inside jokes', 'Stereotype/character archetypes',
      'Practical jokes/pranks', 'Improvised banter', 'Meme humor', 'Pun chains/escalation'
    ];

    const prompt = `You are a comedy taxonomy classifier.

Classify the following joke text into:
1) primary_category: ONE of [${primaryCategories.join(', ')}] that best matches for a general app filter.
2) taxonomy_matches: the top 3 most specific categories from this taxonomy list (strings only): [${taxonomy.join(', ')}].
3) comedy_theories: zero or more of [Incongruity, Superiority, Relief].

Joke:
"""
${jokeText}
"""

Return STRICT JSON only (no markdown), like:
{
  "primary_category": "one-liner",
  "taxonomy_matches": ["One-liners", "Irony", "Deadpan"],
  "comedy_theories": ["Incongruity"]
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 400
    });

    let content = response.choices[0].message.content.trim();
    if (content.startsWith('```')) {
      content = content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
    }
    const parsed = JSON.parse(content);

    // Normalize out-of-set primary categories
    if (!primaryCategories.includes(parsed.primary_category)) {
      // Simple heuristics mapping
      const text = (parsed.primary_category || '').toLowerCase();
      let mapped = 'general';
      if (text.includes('pun') || text.includes('wordplay')) mapped = 'pun';
      else if (text.includes('one')) mapped = 'one-liner';
      else if (text.includes('observ')) mapped = 'observational';
      else if (text.includes('situat') || text.includes('slapstick') || text.includes('farce')) mapped = 'situational';
      else if (text.includes('story')) mapped = 'story';
      else if (text.includes('word')) mapped = 'wordplay';
      parsed.primary_category = mapped;
    }

    return parsed;
  } catch (error) {
    console.error('Error categorizing joke:', error);
    return {
      primary_category: 'general',
      taxonomy_matches: [],
      comedy_theories: []
    };
  }
};

// Analyze a journal entry for CBT-relevant issues and suggest techniques
const analyzeJournalForCBTIssues = async (journalContent) => {
  try {
    const prompt = `You are a careful, supportive CBT coach. Analyze the user's journal entry and extract potential issues suitable for CBT/ACT-style coaching. Do not provide diagnosis.

Return STRICT JSON with this schema:
{
  "issues": [
    {
      "theme": string,  // e.g., social anxiety, self-criticism, procrastination
      "cognitive_distortions": string[], // e.g., mind-reading, catastrophizing
      "severity": number,  // 0-10
      "confidence": number, // 0-1
      "span_text": string,  // direct quote
      "span_start": number,
      "span_end": number,
      "goal": string,  // user's desired outcome in their own words if evident
      "suggested_techniques": ["thought_record", "socratic_questioning", "behavioral_activation", "reframing"],
      "tags": string[]
    }
  ]
}

Journal entry:
"""
${journalContent}
"""`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 900
    });

    let content = response.choices[0].message.content.trim();
    if (content.startsWith('```')) {
      content = content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
    }
    const parsed = JSON.parse(content);
    if (!parsed || !Array.isArray(parsed.issues)) return { issues: [] };
    return parsed;
  } catch (error) {
    console.error('Error analyzing CBT issues:', error);
    return { issues: [] };
  }
};

module.exports = {
  extractStories,
  refineStory,
  buildRefinePrompt,
  generateConversationStarters,
  practiceFeedback,
  getStoryRecommendations,
  analyzeJournalForPeopleInsights,
  generateJoke,
  iterateJoke,
  categorizeJoke,
  analyzeJournalForCBTIssues
};
