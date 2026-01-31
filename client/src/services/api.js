import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://social-conversation-app.onrender.com/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Optional: user-selected LLM model (used by /api/chat and can be reused elsewhere)
    const llmModel = localStorage.getItem('llm_model');
    if (llmModel) {
      config.headers['X-LLM-Model'] = llmModel;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      delete api.defaults.headers.common['Authorization'];
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (name, email, password) => api.post('/auth/register', { name, email, password }),
  getMe: () => api.get('/auth/me'),
  changePassword: (currentPassword, newPassword) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
};

// Journal API
export const journalAPI = {
  getEntries: (page = 1, limit = 20) => api.get(`/journal?page=${page}&limit=${limit}`),
  getEntry: (id) => api.get(`/journal/${id}`),
  createEntry: (data) => api.post('/journal', data),
  updateEntry: (id, data) => api.put(`/journal/${id}`, data),
  deleteEntry: (id) => api.delete(`/journal/${id}`),
  getEntriesByDateRange: (start, end) => api.get(`/journal/date-range/${start}/${end}`),
  analyzeInsights: (id) => api.post(`/journal/${id}/analyze-insights`),
};

// Stories API
export const storiesAPI = {
  getStories: (page = 1, limit = 20, tone) => {
    const params = new URLSearchParams({ page, limit });
    if (tone) params.append('tone', tone);
    return api.get(`/stories?${params}`);
  },
  getStory: (id) => api.get(`/stories/${id}`),
  extractStories: (journalId) => api.post(`/stories/extract/${journalId}`),
  createStory: (data) => api.post('/stories', data),
  updateStory: (id, data) => api.patch(`/stories/${id}`, data),
  refineStory: (id, data) => api.post(`/stories/${id}/refine`, data),
  previewRefinePrompt: (id, data) => api.post(`/stories/${id}/refine?preview=prompt`, data),
  getConversationStarters: (id) => api.get(`/stories/${id}/conversation-starters`),
  deleteStory: (id) => api.delete(`/stories/${id}`),
};

// Practice API
export const practiceAPI = {
  getSessions: (page = 1, limit = 20) => api.get(`/practice/sessions?page=${page}&limit=${limit}`),
  getSession: (id) => api.get(`/practice/sessions/${id}`),
  startSession: (data) => api.post('/practice/sessions', data),
  getFeedback: (data) => api.post('/practice/feedback', data),
  getConversationStarters: (storyId) => api.get(`/practice/conversation-starters?story_id=${storyId}`),
  getStats: () => api.get('/practice/stats'),
};

// People API
export const peopleAPI = {
  getPeople: () => api.get('/people'),
  getPerson: (id) => api.get(`/people/${id}`),
  createPerson: (data) => api.post('/people', data),
  updatePerson: (id, data) => api.put(`/people/${id}`, data),
  deletePerson: (id) => api.delete(`/people/${id}`),
  getStoryRecommendations: (id) => api.get(`/people/${id}/story-recommendations`),
  tagStory: (personId, storyId) => api.post(`/people/${personId}/tag-story/${storyId}`),
  untagStory: (personId, storyId) => api.delete(`/people/${personId}/tag-story/${storyId}`),
  tagJournal: (personId, journalId) => api.post(`/people/${personId}/tag-journal/${journalId}`),
  untagJournal: (personId, journalId) => api.delete(`/people/${personId}/tag-journal/${journalId}`),
  analyzeJournal: (journalContent) => api.post('/people/analyze-journal', { journalContent }),
  applyInsights: (personId, insights) => api.post(`/people/${personId}/apply-insights`, { insights })
};

  // Jokes API
  export const jokesAPI = {
    getJokes: (page = 1, limit = 20) => api.get(`/jokes?page=${page}&limit=${limit}`),
    getJoke: (id) => api.get(`/jokes/${id}`),
    createJoke: (data) => api.post('/jokes', data),
    updateJoke: (id, data) => api.put(`/jokes/${id}`, data),
    deleteJoke: (id) => api.delete(`/jokes/${id}`),
    generateJoke: (prompt, category, difficulty, personId) => api.post('/jokes/generate', { prompt, category, difficulty, personId }),
    tagPerson: (jokeId, personId) => api.post(`/jokes/${jokeId}/tag-person/${personId}`),
    untagPerson: (jokeId, personId) => api.delete(`/jokes/${jokeId}/tag-person/${personId}`),
    getJokesForPerson: (personId) => api.get(`/jokes/person/${personId}`),
    iterateJoke: (jokeId, conversationHistory) => api.post(`/jokes/${jokeId}/iterate`, { conversationHistory }),
    categorize: (jokeId) => api.post(`/jokes/${jokeId}/categorize`)
  };

// Wellness API
export const wellnessAPI = {
  list: (start, end) => {
    const params = new URLSearchParams();
    if (start && end) { params.set('start', start); params.set('end', end); }
    const q = params.toString();
    return api.get(`/wellness${q ? `?${q}` : ''}`);
  },
  upsert: (data) => api.post('/wellness', data),
  remove: (id) => api.delete(`/wellness/${id}`),
  correlations: () => api.get('/wellness/correlations'),
  getPreset: () => api.get('/wellness/preset'),
  savePreset: (data) => api.post('/wellness/preset', data)
};

// Coach API
export const coachAPI = {
  scanJournal: (journalId, content) => api.post(`/coach/scan/${journalId}`, { content }),
  listIssues: () => api.get('/coach/issues'),
  updateIssue: (id, data) => api.patch(`/coach/issues/${id}`, data)
};

// Identity & Goals API
export const identityAPI = {
  get: () => api.get('/identity'),
  save: (data) => api.post('/identity', data),
  generateVision: (vision_points) => api.post('/identity/generate-vision', { vision_points })
};

export const goalsAPI = {
  list: () => api.get('/goals'),
  create: (data) => api.post('/goals', data),
  update: (id, data) => api.patch(`/goals/${id}`, data),
  remove: (id) => api.delete(`/goals/${id}`)
};

// Triggers API
export const triggersAPI = {
  list: () => api.get('/triggers'),
  create: (data) => api.post('/triggers', data),
  update: (id, data) => api.patch(`/triggers/${id}`, data),
  remove: (id) => api.delete(`/triggers/${id}`)
};

// Beliefs API
export const beliefsAPI = {
  list: () => api.get('/beliefs'),
  create: (data) => api.post('/beliefs', data),
  update: (id, data) => api.patch(`/beliefs/${id}`, data),
  remove: (id) => api.delete(`/beliefs/${id}`)
};

// AI Chat API
export const chatAPI = {
  listConversations: () => api.get('/chat/conversations'),
  getMessages: (conversationId) => api.get(`/chat/conversations/${conversationId}/messages`),
  sendMessage: ({ conversationId, message, useMemory = true, model }) =>
    api.post('/chat/message', { conversationId, message, useMemory, model }),
  renameConversation: (conversationId, title) => api.patch(`/chat/conversations/${conversationId}`, { title }),
  deleteConversation: (conversationId) => api.delete(`/chat/conversations/${conversationId}`),
  version: () => api.get('/chat/_version'),
  models: (q) => api.get('/chat/models', { params: q ? { q } : undefined })
};

// Genome upload API
export const genomeAPI = {
  list: () => api.get('/genome'),
  upload: (file, onProgress) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/genome/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (evt) => {
        if (!onProgress) return;
        const total = evt.total || 0;
        if (!total) return;
        const pct = Math.round((evt.loaded / total) * 100);
        onProgress(pct);
      }
    });
  },
  remove: (id) => api.delete(`/genome/${id}`),
  downloadUrl: (id) => `${API_BASE_URL}/genome/${id}/download`
};

export default api;
