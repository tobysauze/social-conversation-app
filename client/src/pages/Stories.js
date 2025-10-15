import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, Search, Filter, X, Save, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { storiesAPI } from '../services/api';

const Stories = () => {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedStory, setSelectedStory] = useState(null);
  const [isImprovingStory, setIsImprovingStory] = useState(false);
  const [improvedStory, setImprovedStory] = useState(null);
  const [refineControls, setRefineControls] = useState({ tone: 'funny', duration: 45, notes: '' });
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptText, setPromptText] = useState('');
  const [newStory, setNewStory] = useState({
    title: '',
    content: '',
    tags: []
  });
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await storiesAPI.getStories();
        const list = (res.data.stories || []).map(s => ({
          id: s.id,
          title: s.title,
          content: s.content,
          createdAt: s.created_at || s.createdAt,
          tags: Array.isArray(s.tags) ? s.tags : (typeof s.tags === 'string' && s.tags.startsWith('[') ? JSON.parse(s.tags) : (s.tags ? [s.tags] : []))
        }));
        setStories(list);
      } catch (e) {
        console.error('Failed to load stories', e);
        toast.error('Failed to load stories');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredStories = stories.filter(story =>
    story.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    story.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setNewStory({ title: '', content: '', tags: [] });
    setTagInput('');
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !newStory.tags.includes(tagInput.trim())) {
      setNewStory({
        ...newStory,
        tags: [...newStory.tags, tagInput.trim()]
      });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setNewStory({
      ...newStory,
      tags: newStory.tags.filter(tag => tag !== tagToRemove)
    });
  };

  const handleSaveStory = async () => {
    if (!newStory.title.trim() || !newStory.content.trim()) {
      toast.error('Please fill in both title and content');
      return;
    }
    try {
      const res = await storiesAPI.createStory({ title: newStory.title, content: newStory.content, tone: 'casual', duration_seconds: 30, tags: newStory.tags });
      const s = res.data.story;
      const created = {
        id: s.id,
        title: s.title,
        content: s.content,
        createdAt: s.created_at || s.createdAt,
        tags: Array.isArray(s.tags) ? s.tags : (typeof s.tags === 'string' && s.tags.startsWith('[') ? JSON.parse(s.tags) : (s.tags ? [s.tags] : []))
      };
      setStories([created, ...stories]);
      toast.success('Story saved successfully!');
      handleCloseModal();
    } catch (e) {
      console.error('Create story failed', e);
      toast.error('Failed to save story');
    }
  };

  const handleViewStory = (story) => {
    setSelectedStory(story);
    setIsViewModalOpen(true);
  };

  const handleCloseViewModal = () => {
    setIsViewModalOpen(false);
    setSelectedStory(null);
    setImprovedStory(null);
  };

  const handleImproveStory = async () => {
    if (!selectedStory) return;
    
    setIsImprovingStory(true);
    try {
      const res = await storiesAPI.refineStory(selectedStory.id, { 
        tone: refineControls.tone || 'casual', 
        duration: Number(refineControls.duration) || 30,
        notes: refineControls.notes || ''
      });
      const s = res.data.story;
      const improved = {
        title: s.title,
        content: s.content,
        tags: [...(selectedStory.tags || []), 'improved']
      };
      setImprovedStory(improved);
      // Update local list with refined content
      setStories(prev => prev.map(st => st.id === selectedStory.id ? { ...st, content: s.content } : st));
      toast.success('Story improved!');
    } catch (error) {
      toast.error('Failed to improve story. Please try again.');
    } finally {
      setIsImprovingStory(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading stories...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <BookOpen className="h-8 w-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">My Stories</h1>
            </div>
            <button 
              onClick={handleOpenModal}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
            >
              <Plus className="h-5 w-5" />
              <span>New Story</span>
            </button>
          </div>

          {/* Search and Filter */}
          <div className="flex space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search stories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center space-x-2">
              <Filter className="h-5 w-5" />
              <span>Filter</span>
            </button>
          </div>
        </div>

        {/* Stories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStories.map((story) => (
            <div key={story.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <h3 className="text-xl font-semibold text-gray-900 mb-3">{story.title}</h3>
              <p className="text-gray-600 mb-4 line-clamp-3">{story.content}</p>
              
              <div className="flex flex-wrap gap-2 mb-4">
                {story.tags.map((tag, index) => (
                  <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
              
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>{new Date(story.createdAt).toLocaleDateString()}</span>
                <button 
                  onClick={() => handleViewStory(story)}
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  Read More
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredStories.length === 0 && (
          <div className="text-center py-12">
            <BookOpen className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No stories found</h3>
            <p className="text-gray-600 mb-6">
              {searchTerm ? 'Try adjusting your search terms.' : 'Start writing your first story to build your conversation skills.'}
            </p>
            <button className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors">
              Write Your First Story
            </button>
          </div>
        )}
      </div>

      {/* New Story Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Write New Story</h2>
                <button
                  onClick={handleCloseModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Story Form */}
              <div className="space-y-6">
                {/* Title */}
                <div>
                  <label htmlFor="story-title" className="block text-sm font-medium text-gray-700 mb-2">
                    Story Title
                  </label>
                  <input
                    id="story-title"
                    type="text"
                    value={newStory.title}
                    onChange={(e) => setNewStory({ ...newStory, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter a title for your story..."
                  />
                </div>

                {/* Content */}
                <div>
                  <label htmlFor="story-content" className="block text-sm font-medium text-gray-700 mb-2">
                    Story Content
                  </label>
                  <textarea
                    id="story-content"
                    value={newStory.content}
                    onChange={(e) => setNewStory({ ...newStory, content: e.target.value })}
                    rows={8}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="Write your story here... Share your conversation experiences, social interactions, or any insights you've gained."
                  />
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tags
                  </label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {newStory.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center space-x-2"
                      >
                        <span>{tag}</span>
                        <button
                          onClick={() => handleRemoveTag(tag)}
                          className="hover:text-blue-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Add a tag..."
                    />
                    <button
                      onClick={handleAddTag}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end space-x-3 mt-8 pt-6 border-t border-gray-200">
                <button
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveStory}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                >
                  <Save className="h-4 w-4" />
                  <span>Save Story</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Story Modal */}
      {isViewModalOpen && selectedStory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">{selectedStory.title}</h2>
                <button
                  onClick={handleCloseViewModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Story Meta */}
              <div className="mb-6">
                <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                  <span>Created: {new Date(selectedStory.createdAt).toLocaleDateString()}</span>
                </div>
                
                {/* Tags */}
                {selectedStory.tags && selectedStory.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedStory.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Story Content */}
              <div className="prose max-w-none">
                <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {selectedStory.content}
                </div>
              </div>

              {/* Improved Story Section */}
              {improvedStory && (
                <div className="mt-8 p-6 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
                  <div className="flex items-center space-x-2 mb-4">
                    <Sparkles className="h-5 w-5 text-purple-600" />
                    <h3 className="text-lg font-semibold text-purple-900">AI-Enhanced Story</h3>
                  </div>
                  
                  <div className="prose max-w-none">
                    <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {improvedStory.content}
                    </div>
                  </div>
                  
                  <div className="mt-4 flex flex-wrap gap-2">
                    {improvedStory.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-700">Tone</label>
                  <select
                    value={refineControls.tone}
                    onChange={(e)=>setRefineControls(prev=>({ ...prev, tone: e.target.value }))}
                    className="px-2 py-1 border rounded"
                  >
                    {['casual','funny','thoughtful','self-deprecating','dramatic'].map(t=>(
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <label className="text-sm text-gray-700">Duration (sec)</label>
                  <input
                    type="number"
                    min={15}
                    max={120}
                    value={refineControls.duration}
                    onChange={(e)=>setRefineControls(prev=>({ ...prev, duration: e.target.value }))}
                    className="w-20 px-2 py-1 border rounded"
                  />
                </div>

                <div className="flex-1 mx-4">
                  <textarea
                    placeholder="What to change? What you liked/disliked…"
                    value={refineControls.notes}
                    onChange={(e)=>setRefineControls(prev=>({ ...prev, notes: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 border rounded"
                  />
                  <div className="mt-2 flex items-center gap-3 text-sm">
                    <button
                      type="button"
                      className="px-3 py-1 border rounded"
                      onClick={async ()=>{
                        try {
                          const res = await storiesAPI.previewRefinePrompt(selectedStory.id, {
                            tone: refineControls.tone,
                            duration: Number(refineControls.duration) || 30,
                            notes: refineControls.notes
                          });
                          setPromptText(res.data.prompt || '');
                          setShowPrompt(true);
                        } catch (e) {
                          console.error(e);
                          setPromptText('');
                          setShowPrompt(true);
                        }
                      }}
                    >
                      Preview prompt
                    </button>
                    {showPrompt && (
                      <button type="button" className="text-gray-600 underline" onClick={()=>setShowPrompt(false)}>Hide prompt</button>
                    )}
                  </div>
                  {showPrompt && (
                    <pre className="mt-2 p-3 bg-gray-50 border rounded text-xs whitespace-pre-wrap max-h-60 overflow-auto">{promptText || 'No prompt available.'}</pre>
                  )}
                </div>

                <button
                  onClick={handleImproveStory}
                  disabled={isImprovingStory}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isImprovingStory ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Improving...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      <span>Improve Story</span>
                    </>
                  )}
                </button>
                
                <button
                  onClick={handleCloseViewModal}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Stories;
