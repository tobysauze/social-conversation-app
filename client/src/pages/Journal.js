import React, { useState, useEffect } from 'react';
import { journalAPI, storiesAPI, peopleAPI } from '../services/api';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Calendar, 
  Clock, 
  Sparkles,
  BookOpen,
  MessageSquare,
  ArrowRight,
  Brain
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import ExtractedStoriesModal from '../components/ExtractedStoriesModal';
import ProfileSuggestionsModal from '../components/ProfileSuggestionsModal';

const Journal = () => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [formData, setFormData] = useState({
    content: '',
    mood: '',
    tags: []
  });
  const [submitting, setSubmitting] = useState(false);
  const [extractingStories, setExtractingStories] = useState(null);
  const [showExtractedStories, setShowExtractedStories] = useState(false);
  const [extractedStories, setExtractedStories] = useState([]);
  const [currentJournalId, setCurrentJournalId] = useState(null);
  const [showProfileSuggestions, setShowProfileSuggestions] = useState(false);
  const [profileSuggestions, setProfileSuggestions] = useState([]);
  const [analyzingProfile, setAnalyzingProfile] = useState(false);

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    try {
      const response = await journalAPI.getEntries();
      setEntries(response.data.entries || []);
    } catch (error) {
      console.error('Error loading entries:', error);
      toast.error('Failed to load journal entries');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.content.trim()) {
      toast.error('Please enter some content');
      return;
    }

    setSubmitting(true);
    try {
      if (editingEntry) {
        await journalAPI.updateEntry(editingEntry.id, formData);
        toast.success('Entry updated successfully');
      } else {
        await journalAPI.createEntry(formData);
        toast.success('Entry created successfully');
      }
      
      setFormData({ content: '', mood: '', tags: [] });
      setShowForm(false);
      setEditingEntry(null);
      loadEntries();
    } catch (error) {
      console.error('Error saving entry:', error);
      toast.error('Failed to save entry');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (entry) => {
    setEditingEntry(entry);
    setFormData({
      content: entry.content,
      mood: entry.mood || '',
      tags: entry.tags ? JSON.parse(entry.tags) : []
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this entry?')) {
      return;
    }

    try {
      await journalAPI.deleteEntry(id);
      toast.success('Entry deleted successfully');
      loadEntries();
    } catch (error) {
      console.error('Error deleting entry:', error);
      toast.error('Failed to delete entry');
    }
  };

  const handleExtractStories = async (entryId) => {
    setExtractingStories(entryId);
    try {
      const response = await storiesAPI.extractStories(entryId);
      const stories = response.data.stories;
      
      setExtractedStories(stories);
      setCurrentJournalId(entryId);
      setShowExtractedStories(true);
      
      if (stories.length === 0) {
        toast('No story-worthy content found in this entry', { icon: 'ℹ️' });
      } else {
        toast.success(`Found ${stories.length} potential story${stories.length > 1 ? 'ies' : ''}!`);
      }
    } catch (error) {
      console.error('Error extracting stories:', error);
      toast.error('Failed to extract stories');
    } finally {
      setExtractingStories(null);
    }
  };

  const handleCreateStory = async (storyIdea) => {
    try {
      // Create a basic story from the extracted idea
      const storyData = {
        title: storyIdea.title,
        content: storyIdea.core_event,
        tone: storyIdea.tone,
        duration_seconds: 30,
        journal_entry_id: currentJournalId,
        tags: [storyIdea.tone]
      };

      await storiesAPI.createStory(storyData);
      toast.success('Story created successfully!');
      setShowExtractedStories(false);
      
      // Navigate to stories page or show success message
      setTimeout(() => {
        window.location.href = '/stories';
      }, 1000);
    } catch (error) {
      console.error('Error creating story:', error);
      toast.error('Failed to create story');
    }
  };

  const handleAnalyzeForPeople = async (entryId) => {
    setAnalyzingProfile(entryId);
    try {
      const entry = entries.find(e => e.id === entryId);
      if (!entry) {
        toast.error('Entry not found');
        return;
      }

      console.log('Analyzing journal entry for people:', entry.content);
      const response = await peopleAPI.analyzeJournal(entry.content);
      console.log('Analysis response:', response);
      const insights = response.data.insights;

      if (insights.length === 0) {
        toast('No people insights found in this entry', { icon: 'ℹ️' });
      } else {
        console.log('Found insights:', insights);
        setProfileSuggestions(insights);
        setShowProfileSuggestions(true);
        toast.success(`Found insights about ${insights.length} person${insights.length > 1 ? 's' : ''}!`);
      }
    } catch (error) {
      console.error('Error analyzing for people:', error);
      console.error('Error response:', error.response?.data);
      toast.error(`Failed to analyze entry: ${error.response?.data?.error || error.message}`);
    } finally {
      setAnalyzingProfile(null);
    }
  };

  const handleProfileInsightsApplied = () => {
    setShowProfileSuggestions(false);
    setProfileSuggestions([]);
    // Optionally reload people data or show success message
    toast.success('Profile insights applied successfully!');
  };

  const moodEmojis = {
    happy: '😊',
    sad: '😢',
    excited: '🤩',
    anxious: '😰',
    calm: '😌',
    annoyed: '😒',
    frustrated: '😤',
    grateful: '🙏',
    confused: '😕',
    proud: '😎',
    tired: '😴'
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Journal</h1>
          <p className="text-gray-600 mt-1">
            Capture your thoughts and experiences to create conversation stories
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary flex items-center"
        >
          <Plus className="w-5 h-5 mr-2" />
          New Entry
        </button>
      </div>

      {/* Entry Form */}
      {showForm && (
        <div className="card mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {editingEntry ? 'Edit Entry' : 'New Journal Entry'}
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
                What's on your mind?
              </label>
              <textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={6}
                className="input-field w-full"
                placeholder="Write about your day, experiences, thoughts, or anything that happened..."
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="mood" className="block text-sm font-medium text-gray-700 mb-2">
                  How are you feeling?
                </label>
                <select
                  id="mood"
                  value={formData.mood}
                  onChange={(e) => setFormData({ ...formData, mood: e.target.value })}
                  className="input-field"
                >
                  <option value="">Select a mood</option>
                  {Object.entries(moodEmojis).map(([mood, emoji]) => (
                    <option key={mood} value={mood}>
                      {emoji} {mood.charAt(0).toUpperCase() + mood.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-2">
                  Tags (comma-separated)
                </label>
                <input
                  id="tags"
                  type="text"
                  value={formData.tags.join(', ')}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    tags: e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag)
                  })}
                  className="input-field"
                  placeholder="work, travel, family, etc."
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingEntry(null);
                  setFormData({ content: '', mood: '', tags: [] });
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary"
              >
                {submitting ? 'Saving...' : editingEntry ? 'Update Entry' : 'Save Entry'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Entries List */}
      {entries.length > 0 ? (
        <div className="space-y-6">
          {entries.map((entry) => (
            <div key={entry.id} className="card">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600">
                      {format(new Date(entry.created_at), 'MMM d, yyyy')}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600">
                      {format(new Date(entry.created_at), 'h:mm a')}
                    </span>
                  </div>
                  {entry.mood && (
                    <span className="text-lg">
                      {moodEmojis[entry.mood]}
                    </span>
                  )}
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleExtractStories(entry.id)}
                    disabled={extractingStories === entry.id}
                    className="p-2 text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors duration-200"
                    title="Extract stories"
                  >
                    {extractingStories === entry.id ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleAnalyzeForPeople(entry.id)}
                    disabled={analyzingProfile === entry.id}
                    className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                    title="Analyze for people insights"
                  >
                    {analyzingProfile === entry.id ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    ) : (
                      <Brain className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleEdit(entry)}
                    className="p-2 text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                    title="Edit entry"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors duration-200"
                    title="Delete entry"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="prose max-w-none">
                <p className="text-gray-900 whitespace-pre-wrap">{entry.content}</p>
              </div>

              {entry.tags && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {JSON.parse(entry.tags).map((tag, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span className="flex items-center">
                      <BookOpen className="w-4 h-4 mr-1" />
                      {entry.content.length} characters
                    </span>
                    <span className="flex items-center">
                      <MessageSquare className="w-4 h-4 mr-1" />
                      Story potential
                    </span>
                  </div>
                  
                  <button
                    onClick={() => handleExtractStories(entry.id)}
                    disabled={extractingStories === entry.id}
                    className="btn-outline text-sm flex items-center"
                  >
                    {extractingStories === entry.id ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary-600 mr-2"></div>
                        Extracting...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Extract Stories
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No journal entries yet</h3>
          <p className="text-gray-600 mb-6">
            Start writing about your experiences to create conversation stories
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary flex items-center mx-auto"
          >
            <Plus className="w-5 h-5 mr-2" />
            Write your first entry
          </button>
        </div>
      )}

      {/* Extracted Stories Modal */}
      <ExtractedStoriesModal
        isOpen={showExtractedStories}
        onClose={() => setShowExtractedStories(false)}
        stories={extractedStories}
        onCreateStory={handleCreateStory}
      />

      {/* Profile Suggestions Modal */}
      <ProfileSuggestionsModal
        isOpen={showProfileSuggestions}
        onClose={() => setShowProfileSuggestions(false)}
        suggestions={profileSuggestions}
        onApplyInsights={handleProfileInsightsApplied}
      />
    </div>
  );
};

export default Journal;
