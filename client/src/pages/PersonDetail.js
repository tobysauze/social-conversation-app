import React, { useState, useEffect } from 'react';
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
  Laugh
} from 'lucide-react';
import { peopleAPI, jokesAPI } from '../services/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const PersonDetail = () => {
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

  const formatDateSafe = (value) => {
    if (!value) return 'Unknown';
    const d = new Date(value);
    if (isNaN(d.getTime())) return 'Unknown';
    return format(d, 'MMM d, yyyy');
  };

  useEffect(() => {
    loadPerson();
    loadJokes();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadPerson = async () => {
    try {
      const response = await peopleAPI.getPerson(id);
      const personData = response.data.person; // Backend returns { person: ... }
      
      // Backend already parses JSON fields, just ensure dates are valid
      const parsedPerson = {
        ...personData,
        // Normalize array fields to always be arrays
        interests: Array.isArray(personData.interests) ? personData.interests : [],
        personality_traits: Array.isArray(personData.personality_traits) ? personData.personality_traits : [],
        shared_experiences: Array.isArray(personData.shared_experiences) ? personData.shared_experiences : [],
        story_preferences: Array.isArray(personData.story_preferences) ? personData.story_preferences : [],
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
                  <button
                    onClick={() => navigate('/jokes')}
                    className="btn-primary text-sm"
                  >
                    Go to Jokes
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {jokes.map((joke) => (
                    <div key={joke.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-medium text-gray-900 text-sm">{joke.title}</h3>
                        <div className="flex items-center space-x-1">
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
