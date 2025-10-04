import axios from 'axios';

const API_BASE_URL = 'https://social-conversation-app.onrender.com/api';

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
};

// Journal API
export const journalAPI = {
  getEntries: (page = 1, limit = 20) => api.get(`/journal?page=${page}&limit=${limit}`),
  getEntry: (id) => api.get(`/journal/${id}`),
  createEntry: (data) => api.post('/journal', data),
  updateEntry: (id, data) => api.put(`/journal/${id}`, data),
  deleteEntry: (id) => api.delete(`/journal/${id}`),
  getEntriesByDateRange: (start, end) => api.get(`/journal/date-range/${start}/${end}`),
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
  refineStory: (id, data) => api.post(`/stories/${id}/refine`, data),
  getConversationStarters: (id) => api.get(`/stories/${id}/conversation-starters`),
  updateStory: (id, data) => api.patch(`/stories/${id}`, data),
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
    iterateJoke: (jokeId, conversationHistory) => api.post(`/jokes/${jokeId}/iterate`, { conversationHistory })
  };

export default api;
