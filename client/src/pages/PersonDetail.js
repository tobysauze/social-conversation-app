import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Edit, 
  Trash2, 
  Star, 
  MessageSquare, 
  Calendar,
  User,
  Lightbulb,
  Brain,
  Target,
  Clock,
  Plus,
  X,
  Laugh,
  Bot,
  Send,
  RefreshCw,
  Search,
  Pin,
  PinOff
} from 'lucide-react';
import { peopleAPI, jokesAPI, chatAPI } from '../services/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const PersonDetail = () => {
  const MODEL_STORAGE_KEY = 'llm_model';
  const { id } = useParams();
  const navigate = useNavigate();
  const [person, setPerson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [recommendations, setRecommendations] = useState([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [jokes, setJokes] = useState([]);
  const [loadingJokes, setLoadingJokes] = useState(false);
  const [quickNote, setQuickNote] = useState('');
  const [savingQuickNote, setSavingQuickNote] = useState(false);
  const [showAddJoke, setShowAddJoke] = useState(false);
  const [newJoke, setNewJoke] = useState({ title: '', content: '' });
  const [addingJoke, setAddingJoke] = useState(false);
  const [personChats, setPersonChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [personMessages, setPersonMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [loadingPersonChats, setLoadingPersonChats] = useState(false);
  const [loadingPersonMessages, setLoadingPersonMessages] = useState(false);
  const [sendingPersonMessage, setSendingPersonMessage] = useState(false);
  const [chatSearch, setChatSearch] = useState('');
  const [chatDateFilter, setChatDateFilter] = useState('all');
  const [messageSearch, setMessageSearch] = useState('');
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [loadingPins, setLoadingPins] = useState(false);
  const [llmProvider, setLlmProvider] = useState(null);
  const [selectedModel, setSelectedModel] = useState(
    () => localStorage.getItem(MODEL_STORAGE_KEY) || 'openai/gpt-4o-mini'
  );
  const [allModels, setAllModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelSearch, setModelSearch] = useState('');
  const [showModelPicker, setShowModelPicker] = useState(false);

  const coerceToArray = (value) => {
    if (Array.isArray(value)) {
      if (
        value.length > 1 &&
        value.every((item) => typeof item === 'string' && item.length === 1)
      ) {
        return coerceToArray(value.join(''));
      }
      if (value.length === 1 && typeof value[0] === 'string') {
        const inner = value[0].trim();
        if (inner.startsWith('[') || inner.startsWith('"[')) {
          return coerceToArray(inner);
        }
      }
      return value;
    }
    if (typeof value === 'string') {
      let parsed = value.trim();
      for (let i = 0; i < 3; i += 1) {
        if (typeof parsed === 'string' && (parsed.startsWith('[') || parsed.startsWith('"['))) {
          try {
            parsed = JSON.parse(parsed);
            continue;
          } catch (_) {
            const unescaped = parsed.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            if (unescaped !== parsed) {
              parsed = unescaped;
              continue;
            }
          }
        }
        break;
      }
      if (Array.isArray(parsed)) return parsed;
      if (typeof parsed === 'string') {
        const asString = parsed.trim();
        if (asString.startsWith('[') && asString.endsWith(']')) {
          const inner = asString.slice(1, -1).trim();
          if (inner) {
            return inner
              .split(',')
              .map((v) => v.trim().replace(/^"+|"+$/g, '').replace(/^'+|'+$/g, ''))
              .filter(Boolean);
          }
        }
        if (asString.includes(',')) {
          return asString
            .split(',')
            .map((v) => v.trim().replace(/^"+|"+$/g, '').replace(/^'+|'+$/g, ''))
            .filter(Boolean);
        }
        return asString ? [asString.replace(/^"+|"+$/g, '').replace(/^'+|'+$/g, '')] : [];
      }
    }
    return [];
  };

  const formatDateSafe = (value) => {
    if (!value) return 'Unknown';
    const d = new Date(value);
    if (isNaN(d.getTime())) return 'Unknown';
    return format(d, 'MMM d, yyyy');
  };

  const formatDateTime = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    return format(d, 'MMM d, yyyy h:mm a');
  };

  const applyDateFilter = (value) => {
    if (chatDateFilter === 'all') return true;
    const d = new Date(value);
    if (isNaN(d.getTime())) return false;
    const now = Date.now();
    const days = chatDateFilter === '7d' ? 7 : 30;
    return now - d.getTime() <= days * 24 * 60 * 60 * 1000;
  };

  const filteredChats = personChats.filter((chat) => {
    const q = chatSearch.trim().toLowerCase();
    const textMatch = !q
      || (chat.title || '').toLowerCase().includes(q)
      || (chat.summary || '').toLowerCase().includes(q);
    const dateMatch = applyDateFilter(chat.updated_at || chat.created_at);
    return textMatch && dateMatch;
  });

  const filteredMessages = personMessages.filter((m) => {
    if (showPinnedOnly && !Number(m.is_pinned)) return false;
    const q = messageSearch.trim().toLowerCase();
    if (!q) return true;
    return (m.content || '').toLowerCase().includes(q);
  });

  const visibleModels = useMemo(() => {
    const q = modelSearch.trim().toLowerCase();
    if (!q) return allModels;
    return allModels.filter(
      (m) =>
        (m.name || '').toLowerCase().includes(q) ||
        (m.id || '').toLowerCase().includes(q)
    );
  }, [allModels, modelSearch]);

  const handleAddQuickNote = async () => {
    if (!quickNote.trim()) return;
    setSavingQuickNote(true);
    try {
      const timestamp = format(new Date(), 'MMM d, yyyy h:mm a');
      const observations = `[${timestamp}] ${quickNote.trim()}`;
      await peopleAPI.applyInsights(id, { observations });
      setQuickNote('');
      await loadPerson();
      toast.success('Note added');
    } catch (error) {
      console.error('Error adding quick note:', error);
      toast.error('Failed to add note');
    } finally {
      setSavingQuickNote(false);
    }
  };

  useEffect(() => {
    loadPerson();
    loadJokes();
    loadPersonChats();
    loadPinnedMessages();
    (async () => {
      try {
        const v = await chatAPI.version();
        setLlmProvider(v.data?.provider || null);
      } catch (e) {
        console.error('Error reading chat provider:', e);
      }
      try {
        setModelsLoading(true);
        const modelsRes = await chatAPI.models('');
        setAllModels(modelsRes.data?.models || []);
      } catch (e) {
        console.error('Error loading OpenRouter models:', e);
      } finally {
        setModelsLoading(false);
      }
    })();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    try {
      if (selectedModel) localStorage.setItem(MODEL_STORAGE_KEY, selectedModel);
    } catch (_) {}
  }, [selectedModel]);

  useEffect(() => {
    loadPersonMessages(activeChatId);
  }, [activeChatId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadPerson = async () => {
    try {
      const response = await peopleAPI.getPerson(id);
      const personData = response.data.person; // Backend returns { person: ... }
      
      // Backend already parses JSON fields, just ensure dates are valid
      const parsedPerson = {
        ...personData,
        // Normalize array fields to always be arrays (handle accidental stringified arrays)
        interests: coerceToArray(personData.interests),
        personality_traits: coerceToArray(personData.personality_traits),
        shared_experiences: coerceToArray(personData.shared_experiences),
        story_preferences: coerceToArray(personData.story_preferences),
        // Ensure dates are valid
        created_at: personData.created_at || new Date().toISOString(),
        updated_at: personData.updated_at || new Date().toISOString()
      };
      
      setPerson(parsedPerson);
      setEditForm(parsedPerson);
    } catch (error) {
      console.error('Error loading person:', error);
      toast.error('Failed to load person details');
    } finally {
      setLoading(false);
    }
  };

  const loadJokes = async () => {
    setLoadingJokes(true);
    try {
      const response = await jokesAPI.getJokesForPerson(id);
      setJokes(response.data.jokes || []);
    } catch (error) {
      console.error('Error loading jokes:', error);
      // Don't show error toast for jokes as it's not critical
    } finally {
      setLoadingJokes(false);
    }
  };

  const loadPersonChats = async () => {
    setLoadingPersonChats(true);
    try {
      const res = await peopleAPI.listPersonChats(id);
      const chats = res.data.conversations || [];
      setPersonChats(chats);
      if (chats.length > 0) {
        setActiveChatId((prev) => prev || chats[0].id);
      } else {
        setActiveChatId(null);
        setPersonMessages([]);
      }
    } catch (error) {
      console.error('Error loading person chats:', error);
      toast.error('Failed to load person chat history');
    } finally {
      setLoadingPersonChats(false);
    }
  };

  const loadPinnedMessages = async () => {
    setLoadingPins(true);
    try {
      const res = await peopleAPI.listPersonPins(id);
      setPinnedMessages(res.data.pins || []);
    } catch (error) {
      console.error('Error loading pinned messages:', error);
      toast.error('Failed to load pinned messages');
    } finally {
      setLoadingPins(false);
    }
  };

  const loadPersonMessages = async (conversationId) => {
    if (!conversationId) {
      setPersonMessages([]);
      return;
    }
    setLoadingPersonMessages(true);
    try {
      const res = await peopleAPI.getPersonChatMessages(id, conversationId);
      setPersonMessages(res.data.messages || []);
    } catch (error) {
      console.error('Error loading person chat messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setLoadingPersonMessages(false);
    }
  };

  const togglePinMessage = async (message) => {
    try {
      const pinned = Number(message.is_pinned) ? false : true;
      await peopleAPI.pinPersonMessage(id, message.id, { pinned });
      await Promise.all([loadPersonMessages(activeChatId), loadPinnedMessages()]);
      toast.success(pinned ? 'Message pinned' : 'Message unpinned');
    } catch (error) {
      console.error('Error toggling message pin:', error);
      toast.error('Failed to update pin');
    }
  };

  const sendPersonMessage = async () => {
    const text = chatInput.trim();
    if (!text || sendingPersonMessage) return;
    setSendingPersonMessage(true);
    setChatInput('');

    const optimistic = {
      id: `tmp-${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString()
    };
    setPersonMessages((prev) => [...prev, optimistic]);

    try {
      const res = await peopleAPI.sendPersonChatMessage(id, {
        conversationId: activeChatId,
        message: text,
        useMemory: true,
        model: selectedModel || undefined
      });
      const convId = res.data.conversationId;
      if (!activeChatId && convId) {
        setActiveChatId(convId);
      }
      await Promise.all([loadPersonChats(), loadPersonMessages(convId || activeChatId), loadPinnedMessages()]);
    } catch (error) {
      console.error('Error sending person chat message:', error);
      setPersonMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setChatInput(text);
      toast.error(error.response?.data?.error || 'Failed to send message');
    } finally {
      setSendingPersonMessage(false);
    }
  };

  const startNewPersonChat = () => {
    setActiveChatId(null);
    setPersonMessages([]);
  };

  const deletePersonChat = async (conversationId) => {
    if (!window.confirm('Delete this chat for this person?')) return;
    try {
      await peopleAPI.deletePersonChat(id, conversationId);
      await loadPersonChats();
      if (Number(activeChatId) === Number(conversationId)) {
        setActiveChatId(null);
        setPersonMessages([]);
      }
      await loadPinnedMessages();
      toast.success('Chat deleted');
    } catch (error) {
      console.error('Error deleting person chat:', error);
      toast.error('Failed to delete chat');
    }
  };

  const handleSave = async () => {
    try {
      const updateData = {
        ...editForm,
        interests: JSON.stringify(editForm.interests || []),
        personality_traits: JSON.stringify(editForm.personality_traits || []),
        shared_experiences: JSON.stringify(editForm.shared_experiences || []),
        story_preferences: JSON.stringify(editForm.story_preferences || [])
      };

      await peopleAPI.updatePerson(id, updateData);
      await loadPerson();
      setEditing(false);
      toast.success('Person updated successfully!');
    } catch (error) {
      console.error('Error updating person:', error);
      toast.error('Failed to update person');
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this person? This action cannot be undone.')) {
      try {
        await peopleAPI.deletePerson(id);
        toast.success('Person deleted successfully');
        navigate('/people');
      } catch (error) {
        console.error('Error deleting person:', error);
        toast.error('Failed to delete person');
      }
    }
  };

  const handleGetRecommendations = async () => {
    setLoadingRecommendations(true);
    try {
      const response = await peopleAPI.getStoryRecommendations(id);
      setRecommendations(response.data.recommendations || []);
      toast.success('Recommendations loaded!');
    } catch (error) {
      console.error('Error getting recommendations:', error);
      toast.error('Failed to load recommendations');
    } finally {
      setLoadingRecommendations(false);
    }
  };

  const handleAddJoke = async () => {
    if (!newJoke.title.trim() || !newJoke.content.trim()) {
      toast.error('Please enter a title and content');
      return;
    }
    setAddingJoke(true);
    try {
      const res = await jokesAPI.createJoke({ title: newJoke.title.trim(), content: newJoke.content.trim() });
      const created = res.data.joke;
      await jokesAPI.tagPerson(created.id, id);
      setNewJoke({ title: '', content: '' });
      setShowAddJoke(false);
      await loadJokes();
      toast.success('Joke added to this profile');
    } catch (error) {
      console.error('Error adding joke:', error);
      toast.error('Failed to add joke');
    } finally {
      setAddingJoke(false);
    }
  };

  const handleUnlinkJoke = async (jokeId) => {
    try {
      await jokesAPI.untagPerson(jokeId, id);
      await loadJokes();
      toast.success('Joke removed from this profile');
    } catch (error) {
      console.error('Error unlinking joke:', error);
      toast.error('Failed to remove joke from profile');
    }
  };

  const addArrayItem = (field, value) => {
    if (value.trim()) {
      setEditForm(prev => ({
        ...prev,
        [field]: [...(prev[field] || []), value.trim()]
      }));
    }
  };

  const removeArrayItem = (field, index) => {
    setEditForm(prev => ({
      ...prev,
      [field]: (prev[field] || []).filter((_, i) => i !== index)
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!person) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Person not found</h2>
          <p className="text-gray-600 mb-4">The person you're looking for doesn't exist.</p>
          <button
            onClick={() => navigate('/people')}
            className="btn-primary"
          >
            Back to People
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/people')}
                className="mr-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{person.name}</h1>
                <p className="text-gray-600">
                  {person.relationship && `${person.relationship} • `}
                  {person.how_met && `Met: ${person.how_met}`}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {!editing ? (
                <>
                  <button
                    onClick={() => setEditing(true)}
                    className="btn-secondary flex items-center"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </button>
                  <button
                    onClick={handleDelete}
                    className="btn-danger flex items-center"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setEditing(false);
                      setEditForm(person);
                    }}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="btn-primary"
                  >
                    Save Changes
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Basic Information */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <User className="w-5 h-5 mr-2" />
                Basic Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      value={editForm.name || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  ) : (
                    <p className="text-gray-900">{person.name}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Relationship
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      value={editForm.relationship || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, relationship: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  ) : (
                    <p className="text-gray-900">{person.relationship || 'Not specified'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    How you met
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      value={editForm.how_met || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, how_met: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  ) : (
                    <p className="text-gray-900">{person.how_met || 'Not specified'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Conversation Style
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      value={editForm.conversation_style || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, conversation_style: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  ) : (
                    <p className="text-gray-900">{person.conversation_style || 'Not specified'}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Interests */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Lightbulb className="w-5 h-5 mr-2" />
                Interests
              </h2>
              {editing ? (
                <div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {(editForm.interests || []).map((interest, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                      >
                        {interest}
                        <button
                          onClick={() => removeArrayItem('interests', index)}
                          className="ml-2 text-blue-600 hover:text-blue-800"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex">
                    <input
                      type="text"
                      placeholder="Add interest"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          addArrayItem('interests', e.target.value);
                          e.target.value = '';
                        }
                      }}
                    />
                    <button
                      onClick={(e) => {
                        const input = e.target.previousElementSibling;
                        addArrayItem('interests', input.value);
                        input.value = '';
                      }}
                      className="px-4 py-2 bg-primary-600 text-white rounded-r-lg hover:bg-primary-700"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {person.interests.length > 0 ? (
                    person.interests.map((interest, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                      >
                        {interest}
                      </span>
                    ))
                  ) : (
                    <p className="text-gray-500 italic">No interests recorded</p>
                  )}
                </div>
              )}
            </div>

            {/* Personality Traits */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Brain className="w-5 h-5 mr-2" />
                Personality Traits
              </h2>
              {editing ? (
                <div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {(editForm.personality_traits || []).map((trait, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full"
                      >
                        {trait}
                        <button
                          onClick={() => removeArrayItem('personality_traits', index)}
                          className="ml-2 text-green-600 hover:text-green-800"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex">
                    <input
                      type="text"
                      placeholder="Add trait"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          addArrayItem('personality_traits', e.target.value);
                          e.target.value = '';
                        }
                      }}
                    />
                    <button
                      onClick={(e) => {
                        const input = e.target.previousElementSibling;
                        addArrayItem('personality_traits', input.value);
                        input.value = '';
                      }}
                      className="px-4 py-2 bg-primary-600 text-white rounded-r-lg hover:bg-primary-700"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {person.personality_traits.length > 0 ? (
                    person.personality_traits.map((trait, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full"
                      >
                        {trait}
                      </span>
                    ))
                  ) : (
                    <p className="text-gray-500 italic">No personality traits recorded</p>
                  )}
                </div>
              )}
            </div>

            {/* Story Preferences */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Target className="w-5 h-5 mr-2" />
                Story Preferences
              </h2>
              {editing ? (
                <div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {(editForm.story_preferences || []).map((preference, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full"
                      >
                        {preference}
                        <button
                          onClick={() => removeArrayItem('story_preferences', index)}
                          className="ml-2 text-purple-600 hover:text-purple-800"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex">
                    <input
                      type="text"
                      placeholder="Add preference"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          addArrayItem('story_preferences', e.target.value);
                          e.target.value = '';
                        }
                      }}
                    />
                    <button
                      onClick={(e) => {
                        const input = e.target.previousElementSibling;
                        addArrayItem('story_preferences', input.value);
                        input.value = '';
                      }}
                      className="px-4 py-2 bg-primary-600 text-white rounded-r-lg hover:bg-primary-700"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {person.story_preferences.length > 0 ? (
                    person.story_preferences.map((preference, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full"
                      >
                        {preference}
                      </span>
                    ))
                  ) : (
                    <p className="text-gray-500 italic">No story preferences recorded</p>
                  )}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <MessageSquare className="w-5 h-5 mr-2" />
                Notes
              </h2>
              {editing ? (
                <textarea
                  value={editForm.notes || ''}
                  onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Add notes about this person..."
                />
              ) : (
                <p className="text-gray-900 whitespace-pre-wrap">
                  {person.notes || 'No notes recorded'}
                </p>
              )}

              {/* Quick Note input - always available */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">Quick note</label>
                <div className="flex items-start space-x-3">
                  <textarea
                    value={quickNote}
                    onChange={(e) => setQuickNote(e.target.value)}
                    rows={3}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Add a quick note..."
                  />
                  <button
                    onClick={handleAddQuickNote}
                    disabled={savingQuickNote || !quickNote.trim()}
                    className="btn-primary"
                  >
                    {savingQuickNote ? 'Adding...' : 'Add'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">Appends a timestamped note to this profile.</p>
              </div>
            </div>

            {/* Jokes Section */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Laugh className="w-5 h-5 mr-2" />
                Jokes for {person.name}
              </h2>
              
              {loadingJokes ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                </div>
              ) : jokes.length === 0 ? (
                <div className="text-center py-6">
                  <Laugh className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm mb-4">
                    No jokes tagged for {person.name} yet
                  </p>
                  <div className="max-w-2xl mx-auto text-left">
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-2">Add a joke for {person.name}</h4>
                      <div className="space-y-3">
                        <input
                          type="text"
                          placeholder="Title"
                          value={newJoke.title}
                          onChange={(e)=>setNewJoke(prev=>({ ...prev, title: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                        <textarea
                          rows={3}
                          placeholder="Joke content"
                          value={newJoke.content}
                          onChange={(e)=>setNewJoke(prev=>({ ...prev, content: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                        <div className="flex items-center space-x-3">
                          <button onClick={handleAddJoke} disabled={addingJoke} className="btn-primary text-sm">
                            {addingJoke ? 'Adding...' : 'Add Joke'}
                          </button>
                          <button onClick={()=>navigate('/jokes')} className="btn-secondary text-sm">Go to Jokes</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {jokes.map((joke) => (
                    <div key={joke.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-medium text-gray-900 text-sm">{joke.title}</h3>
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleUnlinkJoke(joke.id)}
                            className="px-2 py-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
                            title="Remove from this person"
                          >
                            Remove
                          </button>
                          {joke.category && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                              {joke.category}
                            </span>
                          )}
                          {joke.difficulty && (
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                              {joke.difficulty}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-gray-700 text-sm leading-relaxed mb-2">
                        {joke.content}
                      </p>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>
                          {(() => {
                            const dateValue = joke.created_at || joke.createdAt;
                            const d = dateValue ? new Date(dateValue) : null;
                            return d && !isNaN(d.getTime())
                              ? `Created ${format(d, 'MMM d, yyyy')}`
                              : 'Created: Unknown';
                          })()}
                        </span>
                        {(joke.times_told || joke.timesTold) > 0 && (
                          <span className="flex items-center">
                            <Star className="w-3 h-3 mr-1" />
                            {`Told ${joke.times_told || joke.timesTold} times`}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="pt-2">
                    {!showAddJoke ? (
                      <button
                        onClick={()=>setShowAddJoke(true)}
                        className="w-full btn-primary text-sm mb-2"
                      >
                        Add Joke To This Person
                      </button>
                    ) : (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-2">
                        <div className="space-y-3">
                          <input
                            type="text"
                            placeholder="Title"
                            value={newJoke.title}
                            onChange={(e)=>setNewJoke(prev=>({ ...prev, title: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          />
                          <textarea
                            rows={3}
                            placeholder="Joke content"
                            value={newJoke.content}
                            onChange={(e)=>setNewJoke(prev=>({ ...prev, content: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          />
                          <div className="flex items-center space-x-3">
                            <button onClick={handleAddJoke} disabled={addingJoke} className="btn-primary text-sm">
                              {addingJoke ? 'Adding...' : 'Add Joke'}
                            </button>
                            <button onClick={()=>{ setShowAddJoke(false); setNewJoke({ title:'', content:'' }); }} className="btn-secondary text-sm">Cancel</button>
                          </div>
                        </div>
                      </div>
                    )}
                    <button
                      onClick={() => navigate('/jokes')}
                      className="w-full btn-secondary text-sm"
                    >
                      Manage All Jokes
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button
                  onClick={handleGetRecommendations}
                  disabled={loadingRecommendations}
                  className="w-full btn-primary flex items-center justify-center"
                >
                  {loadingRecommendations ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Loading...
                    </>
                  ) : (
                    <>
                      <Star className="w-4 h-4 mr-2" />
                      Get Story Recommendations
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Person-specific AI chat */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Bot className="w-5 h-5 mr-2 text-primary-600" />
                  AI Chat About {person.name}
                </h3>
                <button onClick={startNewPersonChat} className="btn-secondary text-xs">New Chat</button>
              </div>

              <p className="text-xs text-gray-600 mb-3">
                This chat uses this person&apos;s profile as context and saves history with timestamps.
              </p>

              {llmProvider === 'openrouter' && (
                <div className="mb-3 border border-gray-200 rounded-lg p-3 bg-white">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="text-xs text-gray-600">Model</div>
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      onClick={() => setShowModelPicker((v) => !v)}
                    >
                      {showModelPicker ? 'Hide models' : 'Choose model'}
                    </button>
                  </div>
                  <div className="text-sm text-gray-900 truncate">{selectedModel}</div>
                  {showModelPicker && (
                    <div className="mt-2">
                      <div className="relative mb-2">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                        <input
                          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="Search OpenRouter models..."
                          value={modelSearch}
                          onChange={(e) => setModelSearch(e.target.value)}
                        />
                      </div>
                      <div className="max-h-48 overflow-auto border border-gray-200 rounded-lg">
                        {modelsLoading ? (
                          <div className="p-2 text-sm text-gray-500">Loading models...</div>
                        ) : visibleModels.length === 0 ? (
                          <div className="p-2 text-sm text-gray-500">No models found</div>
                        ) : (
                          visibleModels.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              className={`w-full text-left px-3 py-2 text-sm border-b last:border-b-0 hover:bg-gray-50 ${
                                selectedModel === m.id ? 'bg-primary-50 text-primary-700' : 'text-gray-800'
                              }`}
                              onClick={() => {
                                setSelectedModel(m.id);
                                setShowModelPicker(false);
                              }}
                            >
                              <div className="font-medium truncate">{m.name || m.id}</div>
                              <div className="text-xs text-gray-500 truncate">{m.id}</div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 gap-2 mb-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="Search chats by title or summary..."
                    value={chatSearch}
                    onChange={(e) => setChatSearch(e.target.value)}
                  />
                </div>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  value={chatDateFilter}
                  onChange={(e) => setChatDateFilter(e.target.value)}
                >
                  <option value="all">All dates</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                </select>
              </div>

              <div className="border border-gray-200 rounded-lg mb-3 max-h-32 overflow-auto">
                {loadingPersonChats ? (
                  <div className="p-3 text-sm text-gray-500">Loading chats...</div>
                ) : filteredChats.length === 0 ? (
                  <div className="p-3 text-sm text-gray-500">No chats match your filters.</div>
                ) : (
                  filteredChats.map((chat) => (
                    <div
                      key={chat.id}
                      className={`px-3 py-2 border-b last:border-b-0 cursor-pointer ${
                        Number(activeChatId) === Number(chat.id) ? 'bg-primary-50' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setActiveChatId(chat.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{chat.title || 'Untitled chat'}</div>
                          <div className="text-[11px] text-gray-500">{formatDateTime(chat.updated_at || chat.created_at)}</div>
                        </div>
                        <button
                          className="text-red-600 hover:text-red-700 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            deletePersonChat(chat.id);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="border border-gray-200 rounded-lg p-3 h-64 overflow-auto mb-3 space-y-2 bg-gray-50">
                <div className="flex items-center gap-2 mb-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                    <input
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                      placeholder="Search messages..."
                      value={messageSearch}
                      onChange={(e) => setMessageSearch(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className={`px-3 py-2 rounded-lg text-xs border ${
                      showPinnedOnly
                        ? 'bg-primary-100 text-primary-700 border-primary-300'
                        : 'bg-white text-gray-700 border-gray-300'
                    }`}
                    onClick={() => setShowPinnedOnly((v) => !v)}
                  >
                    {showPinnedOnly ? 'Pinned only' : 'All messages'}
                  </button>
                </div>

                {loadingPersonMessages ? (
                  <div className="text-sm text-gray-500">Loading messages...</div>
                ) : filteredMessages.length === 0 ? (
                  <div className="text-sm text-gray-500">
                    No messages match your filter.
                  </div>
                ) : (
                  filteredMessages.map((m) => (
                    <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className="max-w-[90%]">
                        <div
                          className={`rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                            m.role === 'user'
                              ? 'bg-primary-600 text-white'
                              : 'bg-white border border-gray-200 text-gray-900'
                          }`}
                        >
                          {m.content}
                        </div>
                        <div className={`text-[11px] mt-1 flex items-center gap-2 ${m.role === 'user' ? 'justify-end text-gray-500' : 'text-gray-500'}`}>
                          <span>{formatDateTime(m.created_at)}</span>
                          <button
                            type="button"
                            className={`inline-flex items-center ${Number(m.is_pinned) ? 'text-primary-600' : 'text-gray-400 hover:text-gray-600'}`}
                            title={Number(m.is_pinned) ? 'Unpin message' : 'Pin important message'}
                            onClick={() => togglePinMessage(m)}
                          >
                            {Number(m.is_pinned) ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex items-end gap-2">
                <textarea
                  rows={2}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                  placeholder={`Message about ${person.name}...`}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendPersonMessage();
                    }
                  }}
                />
                <button
                  onClick={sendPersonMessage}
                  disabled={sendingPersonMessage || !chatInput.trim()}
                  className="btn-primary flex items-center"
                >
                  {sendingPersonMessage ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Pinned chat messages */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                <Pin className="w-5 h-5 mr-2 text-primary-600" />
                Pinned Messages
              </h3>
              {loadingPins ? (
                <div className="text-sm text-gray-500">Loading pinned messages...</div>
              ) : pinnedMessages.length === 0 ? (
                <div className="text-sm text-gray-500">No pinned messages yet.</div>
              ) : (
                <div className="space-y-3 max-h-56 overflow-auto">
                  {pinnedMessages.map((pinItem) => (
                    <button
                      type="button"
                      key={pinItem.id}
                      className="w-full text-left border border-gray-200 rounded-lg p-3 hover:bg-gray-50"
                      onClick={() => setActiveChatId(pinItem.conversation_id)}
                    >
                      <div className="text-xs text-gray-500 mb-1">{pinItem.conversation_title || 'Chat'}</div>
                      <div className="text-sm text-gray-800 line-clamp-2">{pinItem.content}</div>
                      <div className="text-[11px] text-gray-500 mt-2">{formatDateTime(pinItem.pinned_at)}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Recommendations */}
            {recommendations.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Story Recommendations</h3>
                <div className="space-y-4">
                  {recommendations.map((rec, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-2">{rec.title}</h4>
                      <p className="text-sm text-gray-600 mb-2">{rec.reason}</p>
                      <p className="text-xs text-gray-500">{rec.conversation_starter}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Profile Info</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 mr-2" />
                  Created: {formatDateSafe(person.created_at || person.createdAt)}
                </div>
                <div className="flex items-center">
                  <Clock className="w-4 h-4 mr-2" />
                  Updated: {formatDateSafe(person.updated_at || person.updatedAt)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PersonDetail;
