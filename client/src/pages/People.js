import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { peopleAPI } from '../services/api';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Users, 
  Heart, 
  MessageSquare,
  Sparkles,
  UserPlus,
  Search,
  Filter
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const People = () => {
  const navigate = useNavigate();
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    relationship: '',
    how_met: '',
    interests: [],
    personality_traits: [],
    conversation_style: '',
    shared_experiences: [],
    story_preferences: [],
    notes: ''
  });

  const [newInterest, setNewInterest] = useState('');
  const [newTrait, setNewTrait] = useState('');
  const [newExperience, setNewExperience] = useState('');
  const [newPreference, setNewPreference] = useState('');

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

  useEffect(() => {
    loadPeople();
  }, []);

  const loadPeople = async () => {
    try {
      const response = await peopleAPI.getPeople();
      const peopleData = (response.data.people || []).map(p => ({
        ...p,
        interests: coerceToArray(p.interests),
        personality_traits: coerceToArray(p.personality_traits),
        shared_experiences: coerceToArray(p.shared_experiences),
        story_preferences: coerceToArray(p.story_preferences)
      }));
      setPeople(peopleData);
    } catch (error) {
      console.error('Error loading people:', error);
      toast.error('Failed to load people');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingPerson) {
        await peopleAPI.updatePerson(editingPerson.id, formData);
        toast.success('Person updated successfully!');
      } else {
        await peopleAPI.createPerson(formData);
        toast.success('Person added successfully!');
      }
      
      setShowForm(false);
      setEditingPerson(null);
      resetForm();
      loadPeople();
    } catch (error) {
      console.error('Error saving person:', error);
      toast.error('Failed to save person');
    }
  };

  const handleEdit = (person) => {
    setEditingPerson(person);
    setFormData({
      name: person.name,
      relationship: person.relationship || '',
      how_met: person.how_met || '',
      interests: person.interests || [],
      personality_traits: person.personality_traits || [],
      conversation_style: person.conversation_style || '',
      shared_experiences: person.shared_experiences || [],
      story_preferences: person.story_preferences || [],
      notes: person.notes || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (personId) => {
    if (!window.confirm('Are you sure you want to delete this person?')) {
      return;
    }

    try {
      await peopleAPI.deletePerson(personId);
      toast.success('Person deleted successfully');
      loadPeople();
    } catch (error) {
      console.error('Error deleting person:', error);
      toast.error('Failed to delete person');
    }
  };

  const handleCardClick = (person) => {
    navigate(`/people/${person.id}`);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      relationship: '',
      how_met: '',
      interests: [],
      personality_traits: [],
      conversation_style: '',
      shared_experiences: [],
      story_preferences: [],
      notes: ''
    });
    setNewInterest('');
    setNewTrait('');
    setNewExperience('');
    setNewPreference('');
  };

  const addInterest = () => {
    if (newInterest.trim()) {
      setFormData(prev => ({
        ...prev,
        interests: [...prev.interests, newInterest.trim()]
      }));
      setNewInterest('');
    }
  };

  const removeInterest = (index) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.filter((_, i) => i !== index)
    }));
  };

  const addTrait = () => {
    if (newTrait.trim()) {
      setFormData(prev => ({
        ...prev,
        personality_traits: [...prev.personality_traits, newTrait.trim()]
      }));
      setNewTrait('');
    }
  };

  const removeTrait = (index) => {
    setFormData(prev => ({
      ...prev,
      personality_traits: prev.personality_traits.filter((_, i) => i !== index)
    }));
  };

  const addExperience = () => {
    if (newExperience.trim()) {
      setFormData(prev => ({
        ...prev,
        shared_experiences: [...prev.shared_experiences, newExperience.trim()]
      }));
      setNewExperience('');
    }
  };

  const removeExperience = (index) => {
    setFormData(prev => ({
      ...prev,
      shared_experiences: prev.shared_experiences.filter((_, i) => i !== index)
    }));
  };

  const addPreference = () => {
    if (newPreference.trim()) {
      setFormData(prev => ({
        ...prev,
        story_preferences: [...prev.story_preferences, newPreference.trim()]
      }));
      setNewPreference('');
    }
  };

  const removePreference = (index) => {
    setFormData(prev => ({
      ...prev,
      story_preferences: prev.story_preferences.filter((_, i) => i !== index)
    }));
  };

  const getStoryRecommendations = async (person) => {
    setSelectedPerson(person);
    setLoadingRecommendations(true);
    try {
      const response = await peopleAPI.getStoryRecommendations(person.id);
      setRecommendations(response.data.recommendations || []);
    } catch (error) {
      console.error('Error getting recommendations:', error);
      toast.error('Failed to get story recommendations');
    } finally {
      setLoadingRecommendations(false);
    }
  };

  const filteredPeople = people.filter(person => {
    const term = searchTerm.toLowerCase();
    const interests = Array.isArray(person.interests) ? person.interests : [];
    return (
      person.name.toLowerCase().includes(term) ||
      (person.relationship && person.relationship.toLowerCase().includes(term)) ||
      interests.some(interest => (interest || '').toLowerCase().includes(term))
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-primary-100 rounded-lg">
            <Users className="w-8 h-8 text-primary-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">People</h1>
            <p className="text-gray-600">Manage your social connections and get personalized story recommendations</p>
          </div>
        </div>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingPerson(null);
            resetForm();
          }}
          className="btn-primary flex items-center"
        >
          <UserPlus className="w-5 h-5 mr-2" />
          Add Person
        </button>
      </div>

      {/* Search and Filter */}
      <div className="mb-6 flex items-center space-x-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search people by name, relationship, or interests..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* People Grid */}
      {filteredPeople.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPeople.map((person) => (
            <div 
              key={person.id} 
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => handleCardClick(person)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-1">{person.name}</h3>
                  <p className="text-gray-600 text-sm">{person.relationship || 'No relationship specified'}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      getStoryRecommendations(person);
                    }}
                    className="p-2 text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
                    title="Get story recommendations"
                  >
                    <Sparkles className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(person);
                    }}
                    className="p-2 text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Edit person"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(person.id);
                    }}
                    className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete person"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {person.interests && person.interests.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Interests</h4>
                    <div className="flex flex-wrap gap-1">
                      {person.interests.map((interest, index) => (
                        <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                          {interest}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {person.personality_traits && person.personality_traits.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Personality</h4>
                    <div className="flex flex-wrap gap-1">
                      {person.personality_traits.map((trait, index) => (
                        <span key={index} className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                          {trait}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {person.conversation_style && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">Conversation Style</h4>
                    <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                      {person.conversation_style}
                    </span>
                  </div>
                )}

                {person.notes && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">Notes</h4>
                    <p className="text-sm text-gray-600 line-clamp-2">{person.notes}</p>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={() => getStoryRecommendations(person)}
                  className="w-full btn-outline text-sm flex items-center justify-center"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Get Story Recommendations
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No people found</h3>
          <p className="text-gray-600 mb-6">
            {searchTerm ? 'Try adjusting your search terms' : 'Start building your social network by adding people you know'}
          </p>
          {!searchTerm && (
            <button
              onClick={() => {
                setShowForm(true);
                setEditingPerson(null);
                resetForm();
              }}
              className="btn-primary flex items-center mx-auto"
            >
              <UserPlus className="w-5 h-5 mr-2" />
              Add your first person
            </button>
          )}
        </div>
      )}

      {/* Add/Edit Person Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingPerson ? 'Edit Person' : 'Add New Person'}
              </h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingPerson(null);
                  resetForm();
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <span className="text-gray-500">×</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Enter their name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Relationship</label>
                    <input
                      type="text"
                      value={formData.relationship}
                      onChange={(e) => setFormData(prev => ({ ...prev, relationship: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="e.g., Friend, Colleague, Family"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">How you met</label>
                  <input
                    type="text"
                    value={formData.how_met}
                    onChange={(e) => setFormData(prev => ({ ...prev, how_met: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="e.g., Through work, at a party, mutual friend"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Conversation Style</label>
                  <select
                    value={formData.conversation_style}
                    onChange={(e) => setFormData(prev => ({ ...prev, conversation_style: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="">Select conversation style</option>
                    <option value="casual">Casual & Light</option>
                    <option value="deep">Deep & Meaningful</option>
                    <option value="humorous">Humorous & Playful</option>
                    <option value="intellectual">Intellectual & Thoughtful</option>
                    <option value="supportive">Supportive & Empathetic</option>
                  </select>
                </div>

                {/* Interests */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Interests</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {formData.interests.map((interest, index) => (
                      <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full flex items-center">
                        {interest}
                        <button
                          type="button"
                          onClick={() => removeInterest(index)}
                          className="ml-2 text-blue-600 hover:text-blue-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={newInterest}
                      onChange={(e) => setNewInterest(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addInterest())}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Add an interest"
                    />
                    <button
                      type="button"
                      onClick={addInterest}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Personality Traits */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Personality Traits</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {formData.personality_traits.map((trait, index) => (
                      <span key={index} className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full flex items-center">
                        {trait}
                        <button
                          type="button"
                          onClick={() => removeTrait(index)}
                          className="ml-2 text-green-600 hover:text-green-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={newTrait}
                      onChange={(e) => setNewTrait(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTrait())}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Add a personality trait"
                    />
                    <button
                      type="button"
                      onClick={addTrait}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Any additional notes about this person..."
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 mt-6 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingPerson(null);
                    resetForm();
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                >
                  {editingPerson ? 'Update Person' : 'Add Person'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Story Recommendations Modal */}
      {selectedPerson && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Story Recommendations for {selectedPerson.name}
                </h2>
                <p className="text-gray-600">AI-powered suggestions based on their interests and personality</p>
              </div>
              <button
                onClick={() => setSelectedPerson(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <span className="text-gray-500">×</span>
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              {loadingRecommendations ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : recommendations.length > 0 ? (
                <div className="space-y-6">
                  {recommendations.map((rec, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">{rec.title}</h3>
                      <div className="space-y-3">
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-1">Why this would interest them:</h4>
                          <p className="text-gray-600">{rec.reason}</p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-1">Connection to their profile:</h4>
                          <p className="text-gray-600">{rec.connection}</p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-1">Conversation starter:</h4>
                          <p className="text-gray-600">{rec.conversation_starter}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No recommendations available</h3>
                  <p className="text-gray-600">
                    Add more stories and journal entries to get personalized recommendations for {selectedPerson.name}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default People;
