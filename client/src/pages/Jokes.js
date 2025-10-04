import React, { useState, useEffect } from 'react';
import { jokesAPI, peopleAPI } from '../services/api';
import JokeIterationModal from '../components/JokeIterationModal';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Laugh, 
  Sparkles,
  Users,
  Search,
  Filter,
  Tag,
  Star,
  Clock,
  Bot
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const Jokes = () => {
  const [jokes, setJokes] = useState([]);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingJoke, setEditingJoke] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('');
  const [generatingJoke, setGeneratingJoke] = useState(false);
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [selectedJokeId, setSelectedJokeId] = useState(null);
  const [showIterationModal, setShowIterationModal] = useState(false);
  const [selectedJokeForIteration, setSelectedJokeForIteration] = useState(null);

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: '',
    difficulty: '',
    notes: ''
  });

  const [generateFormData, setGenerateFormData] = useState({
    prompt: '',
    category: '',
    difficulty: '',
    personId: ''
  });

  const categories = ['pun', 'one-liner', 'story', 'observational', 'wordplay', 'situational', 'general'];
  const difficulties = ['easy', 'medium', 'hard'];

  useEffect(() => {
    loadJokes();
    loadPeople();
  }, []);

  const loadJokes = async () => {
    try {
      const response = await jokesAPI.getJokes();
      setJokes(response.data.jokes || []);
    } catch (error) {
      console.error('Error loading jokes:', error);
      toast.error('Failed to load jokes');
    } finally {
      setLoading(false);
    }
  };

  const loadPeople = async () => {
    try {
      const response = await peopleAPI.getPeople();
      setPeople(response.data.people || []);
    } catch (error) {
      console.error('Error loading people:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingJoke) {
        await jokesAPI.updateJoke(editingJoke.id, formData);
        toast.success('Joke updated successfully!');
      } else {
        await jokesAPI.createJoke(formData);
        toast.success('Joke created successfully!');
      }
      
      setShowForm(false);
      setEditingJoke(null);
      resetForm();
      loadJokes();
    } catch (error) {
      console.error('Error saving joke:', error);
      toast.error('Failed to save joke');
    }
  };

  const handleGenerateJoke = async (e) => {
    e.preventDefault();
    setGeneratingJoke(true);
    try {
      const response = await jokesAPI.generateJoke(
        generateFormData.prompt,
        generateFormData.category,
        generateFormData.difficulty,
        generateFormData.personId || null
      );
      
      const generatedJoke = response.data.joke;
      
      // Pre-fill the form with the generated joke
      setFormData({
        title: generatedJoke.title,
        content: generatedJoke.content,
        category: generatedJoke.category,
        difficulty: generatedJoke.difficulty,
        notes: generatedJoke.explanation
      });
      
      setShowGenerateForm(false);
      setShowForm(true);
      resetGenerateForm();
      
      toast.success('Joke generated! Review and save it.');
    } catch (error) {
      console.error('Error generating joke:', error);
      toast.error('Failed to generate joke');
    } finally {
      setGeneratingJoke(false);
    }
  };

  const handleEdit = (joke) => {
    setEditingJoke(joke);
    setFormData({
      title: joke.title,
      content: joke.content,
      category: joke.category || '',
      difficulty: joke.difficulty || '',
      notes: joke.notes || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (jokeId) => {
    if (!window.confirm('Are you sure you want to delete this joke?')) {
      return;
    }

    try {
      await jokesAPI.deleteJoke(jokeId);
      toast.success('Joke deleted successfully');
      loadJokes();
    } catch (error) {
      console.error('Error deleting joke:', error);
      toast.error('Failed to delete joke');
    }
  };

  const handleUntagPerson = async (jokeId, personId) => {
    try {
      await jokesAPI.untagPerson(jokeId, personId);
      toast.success('Joke untagged from person!');
      loadJokes();
    } catch (error) {
      console.error('Error untagging joke:', error);
      toast.error('Failed to untag joke');
    }
  };

  const handleTagPerson = (jokeId) => {
    setSelectedJokeId(jokeId);
    setShowTagModal(true);
  };

  const handleTagToPerson = async (personId) => {
    try {
      await jokesAPI.tagPerson(selectedJokeId, personId);
      toast.success('Joke tagged to person!');
      setShowTagModal(false);
      setSelectedJokeId(null);
      loadJokes();
    } catch (error) {
      console.error('Error tagging joke:', error);
      toast.error('Failed to tag joke');
    }
  };

  const handleIterateJoke = (joke) => {
    setSelectedJokeForIteration(joke);
    setShowIterationModal(true);
  };

  const handleSaveImprovedJoke = async (improvedJoke) => {
    try {
      await jokesAPI.updateJoke(selectedJokeForIteration.id, improvedJoke);
      toast.success('Improved joke saved successfully!');
      loadJokes(); // Refresh the jokes list
    } catch (error) {
      console.error('Error saving improved joke:', error);
      toast.error('Failed to save improved joke');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      category: '',
      difficulty: '',
      notes: ''
    });
  };

  const resetGenerateForm = () => {
    setGenerateFormData({
      prompt: '',
      category: '',
      difficulty: '',
      personId: ''
    });
  };

  const filteredJokes = jokes.filter(joke => {
    const matchesSearch = joke.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         joke.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || joke.category === selectedCategory;
    const matchesDifficulty = !selectedDifficulty || joke.difficulty === selectedDifficulty;
    
    return matchesSearch && matchesCategory && matchesDifficulty;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <Laugh className="w-8 h-8 mr-3 text-yellow-500" />
            Jokes
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Create and manage your joke collection for different audiences
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowGenerateForm(true)}
            className="btn-secondary flex items-center"
          >
            <Sparkles className="w-5 h-5 mr-2" />
            Generate with AI
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary flex items-center"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Joke
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-8">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search jokes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>
          <div className="flex gap-4">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </option>
              ))}
            </select>
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">All Difficulties</option>
              {difficulties.map(difficulty => (
                <option key={difficulty} value={difficulty}>
                  {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Jokes List */}
      {filteredJokes.length === 0 ? (
        <div className="text-center py-12">
          <Laugh className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No jokes yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Start building your joke collection to make conversations more engaging!
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary flex items-center mx-auto"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create your first joke
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredJokes.map((joke) => (
            <div key={joke.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{joke.title}</h3>
                  <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                    {joke.category && (
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-xs">
                        {joke.category}
                      </span>
                    )}
                    {joke.difficulty && (
                      <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-xs">
                        {joke.difficulty}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleIterateJoke(joke)}
                    className="p-2 text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900 rounded-lg transition-colors"
                    title="Iterate with AI"
                  >
                    <Bot className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleTagPerson(joke.id)}
                    className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900 rounded-lg transition-colors"
                    title="Tag to person"
                  >
                    <Tag className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleEdit(joke)}
                    className="p-2 text-gray-600 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="Edit joke"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(joke.id)}
                    className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg transition-colors"
                    title="Delete joke"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                  {joke.content}
                </p>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center space-x-4">
                  <span className="flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    {format(new Date(joke.created_at), 'MMM d, yyyy')}
                  </span>
                  {joke.times_told > 0 && (
                    <span className="flex items-center">
                      <Star className="w-3 h-3 mr-1" />
                      Told {joke.times_told} times
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Joke Form */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {editingJoke ? 'Edit Joke' : 'Create New Joke'}
              </h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingJoke(null);
                  resetForm();
                }}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Joke Content *
                  </label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                    rows="4"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Category
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="">Select category</option>
                      {categories.map(category => (
                        <option key={category} value={category}>
                          {category.charAt(0).toUpperCase() + category.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Difficulty
                    </label>
                    <select
                      value={formData.difficulty}
                      onChange={(e) => setFormData(prev => ({ ...prev, difficulty: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="">Select difficulty</option>
                      {difficulties.map(difficulty => (
                        <option key={difficulty} value={difficulty}>
                          {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    rows="2"
                    placeholder="Any additional notes about this joke..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingJoke(null);
                    resetForm();
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                >
                  {editingJoke ? 'Update Joke' : 'Create Joke'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generate Joke Form */}
      {showGenerateForm && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
                <Sparkles className="w-6 h-6 mr-2 text-yellow-500" />
                Generate Joke with AI
              </h2>
              <button
                onClick={() => {
                  setShowGenerateForm(false);
                  resetGenerateForm();
                }}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleGenerateJoke} className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    What kind of joke do you want? *
                  </label>
                  <textarea
                    value={generateFormData.prompt}
                    onChange={(e) => setGenerateFormData(prev => ({ ...prev, prompt: e.target.value }))}
                    rows="3"
                    placeholder="e.g., 'A joke about cats and dogs', 'Something funny about work meetings', 'A pun about food'..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Category
                    </label>
                    <select
                      value={generateFormData.category}
                      onChange={(e) => setGenerateFormData(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="">Any category</option>
                      {categories.map(category => (
                        <option key={category} value={category}>
                          {category.charAt(0).toUpperCase() + category.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Difficulty
                    </label>
                    <select
                      value={generateFormData.difficulty}
                      onChange={(e) => setGenerateFormData(prev => ({ ...prev, difficulty: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="">Any difficulty</option>
                      {difficulties.map(difficulty => (
                        <option key={difficulty} value={difficulty}>
                          {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Target Person (Optional)
                  </label>
                  <select
                    value={generateFormData.personId}
                    onChange={(e) => setGenerateFormData(prev => ({ ...prev, personId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">No specific person</option>
                    {people.map(person => (
                      <option key={person.id} value={person.id}>
                        {person.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Select a person to generate a joke tailored to their interests and personality
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowGenerateForm(false);
                    resetGenerateForm();
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generatingJoke}
                  className="btn-primary flex items-center"
                >
                  {generatingJoke ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate Joke
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tag Person Modal */}
      {showTagModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
                <Tag className="w-6 h-6 mr-2 text-blue-500" />
                Tag Joke to Person
              </h2>
              <button
                onClick={() => {
                  setShowTagModal(false);
                  setSelectedJokeId(null);
                }}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Select a person to tag this joke to. The joke will appear on their profile page.
              </p>
              
              {people.length === 0 ? (
                <div className="text-center py-6">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm mb-4">
                    No people added yet
                  </p>
                  <button
                    onClick={() => {
                      setShowTagModal(false);
                      setSelectedJokeId(null);
                      // Navigate to people page - you might want to add navigation here
                    }}
                    className="btn-primary text-sm"
                  >
                    Add People First
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {people.map((person) => (
                    <button
                      key={person.id}
                      onClick={() => handleTagToPerson(person.id)}
                      className="w-full text-left p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white">{person.name}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {person.relationship || 'No relationship specified'}
                          </p>
                        </div>
                        <Tag className="w-4 h-4 text-gray-400" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Joke Iteration Modal */}
      <JokeIterationModal
        isOpen={showIterationModal}
        onClose={() => {
          setShowIterationModal(false);
          setSelectedJokeForIteration(null);
        }}
        joke={selectedJokeForIteration}
        onSaveImproved={handleSaveImprovedJoke}
      />
    </div>
  );
};

export default Jokes;
