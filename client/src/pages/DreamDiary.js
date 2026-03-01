import React, { useState, useEffect } from 'react';
import { dreamsAPI } from '../services/api';
import {
  Plus,
  Edit,
  Trash2,
  Calendar,
  Clock,
  Moon,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import DreamAnalysisModal from '../components/DreamAnalysisModal';

const sleepQualityOptions = [
  { value: 'rested', label: 'Rested', emoji: '😴' },
  { value: 'restless', label: 'Restless', emoji: '😵' },
  { value: 'vivid', label: 'Vivid', emoji: '✨' },
  { value: 'lucid', label: 'Lucid', emoji: '👁️' },
  { value: 'fragmented', label: 'Fragmented', emoji: '🧩' },
  { value: 'nightmare', label: 'Intense/Nightmare', emoji: '😰' },
];

const DreamDiary = () => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [formData, setFormData] = useState({
    content: '',
    title: '',
    sleep_quality: '',
    tags: [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [analyzingId, setAnalyzingId] = useState(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [dreamAnalysis, setDreamAnalysis] = useState(null);

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    try {
      const response = await dreamsAPI.getEntries();
      setEntries(response.data.entries || []);
    } catch (error) {
      console.error('Error loading dream entries:', error);
      toast.error('Failed to load dream entries');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.content.trim()) {
      toast.error('Please describe your dream');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        content: formData.content,
        title: formData.title || undefined,
        sleep_quality: formData.sleep_quality || undefined,
        tags: formData.tags.length ? formData.tags : undefined,
      };

      if (editingEntry) {
        await dreamsAPI.updateEntry(editingEntry.id, payload);
        toast.success('Dream updated');
      } else {
        await dreamsAPI.createEntry(payload);
        toast.success('Dream recorded');
      }

      setFormData({ content: '', title: '', sleep_quality: '', tags: [] });
      setShowForm(false);
      setEditingEntry(null);
      loadEntries();
    } catch (error) {
      console.error('Error saving dream:', error);
      toast.error('Failed to save dream');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (entry) => {
    setEditingEntry(entry);
    setFormData({
      content: entry.content,
      title: entry.title || '',
      sleep_quality: entry.sleep_quality || '',
      tags: entry.tags ? JSON.parse(entry.tags) : [],
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this dream entry?')) return;

    try {
      await dreamsAPI.deleteEntry(id);
      toast.success('Dream deleted');
      loadEntries();
    } catch (error) {
      console.error('Error deleting dream:', error);
      toast.error('Failed to delete dream');
    }
  };

  const handleAnalyze = async (entryId) => {
    setAnalyzingId(entryId);
    try {
      const response = await dreamsAPI.analyze(entryId);
      setDreamAnalysis(response.data.analysis);
      setShowAnalysis(true);
      toast.success('Analysis complete');
    } catch (error) {
      console.error('Error analyzing dream:', error);
      toast.error(error.response?.data?.error || 'Failed to analyze dream');
    } finally {
      setAnalyzingId(null);
    }
  };

  const showStoredAnalysis = (entry) => {
    if (entry.analysis) {
      try {
        setDreamAnalysis(typeof entry.analysis === 'string' ? JSON.parse(entry.analysis) : entry.analysis);
        setShowAnalysis(true);
      } catch {
        toast.error('Could not load saved analysis');
      }
    } else {
      handleAnalyze(entry.id);
    }
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Moon className="w-8 h-8 mr-3 text-violet-600" />
            Dream Diary
          </h1>
          <p className="text-gray-600 mt-1">
            Record your dreams and explore possible meanings
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary flex items-center bg-violet-600 hover:bg-violet-700"
        >
          <Plus className="w-5 h-5 mr-2" />
          New Dream
        </button>
      </div>

      {showForm && (
        <div className="card mb-8 border-violet-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {editingEntry ? 'Edit Dream' : 'Record a Dream'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                Title (optional)
              </label>
              <input
                id="title"
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="input-field"
                placeholder="e.g. Flying over mountains"
              />
            </div>

            <div>
              <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
                Describe your dream
              </label>
              <textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={8}
                className="input-field w-full"
                placeholder="Write down everything you remember — people, places, feelings, colors, sounds..."
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="sleep_quality" className="block text-sm font-medium text-gray-700 mb-2">
                  Sleep quality
                </label>
                <select
                  id="sleep_quality"
                  value={formData.sleep_quality}
                  onChange={(e) => setFormData({ ...formData, sleep_quality: e.target.value })}
                  className="input-field"
                >
                  <option value="">Select...</option>
                  {sleepQualityOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.emoji} {opt.label}
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
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean),
                    })
                  }
                  className="input-field"
                  placeholder="recurring, flying, water, etc."
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingEntry(null);
                  setFormData({ content: '', title: '', sleep_quality: '', tags: [] });
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button type="submit" disabled={submitting} className="btn-primary bg-violet-600 hover:bg-violet-700">
                {submitting ? 'Saving...' : editingEntry ? 'Update' : 'Save Dream'}
              </button>
            </div>
          </form>
        </div>
      )}

      {entries.length > 0 ? (
        <div className="space-y-6">
          {entries.map((entry) => (
            <div key={entry.id} className="card border-violet-50 hover:border-violet-100 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center flex-wrap gap-3">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-violet-400" />
                    <span className="text-sm text-gray-600">
                      {format(new Date(entry.created_at), 'MMM d, yyyy')}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-violet-400" />
                    <span className="text-sm text-gray-600">
                      {format(new Date(entry.created_at), 'h:mm a')}
                    </span>
                  </div>
                  {entry.title && (
                    <span className="font-medium text-violet-800">{entry.title}</span>
                  )}
                  {entry.sleep_quality && (
                    <span className="text-sm text-gray-500">
                      {sleepQualityOptions.find((o) => o.value === entry.sleep_quality)?.emoji || ''}{' '}
                      {entry.sleep_quality}
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => showStoredAnalysis(entry)}
                    disabled={analyzingId === entry.id}
                    className="p-2 text-violet-600 hover:text-violet-700 hover:bg-violet-50 rounded-lg transition-colors"
                    title="Analyze dream meaning"
                  >
                    {analyzingId === entry.id ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-violet-600"></div>
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleEdit(entry)}
                    className="p-2 text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
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
                  {JSON.parse(entry.tags).map((tag, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-violet-100 text-violet-700 text-xs rounded-full"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
                <button
                  onClick={() => showStoredAnalysis(entry)}
                  disabled={analyzingId === entry.id}
                  className="btn-outline text-sm flex items-center border-violet-200 text-violet-700 hover:bg-violet-50"
                >
                  {analyzingId === entry.id ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-violet-600 mr-2"></div>
                      Analyzing...
                    </>
                  ) : entry.analysis ? (
                    <>
                      <Moon className="w-4 h-4 mr-2" />
                      View analysis
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Analyze meaning
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="w-20 h-20 rounded-full bg-violet-100 flex items-center justify-center mx-auto mb-6">
            <Moon className="w-10 h-10 text-violet-600" />
          </div>
          <h3 className="text-xl font-medium text-gray-900 mb-2">No dreams recorded yet</h3>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">
            Write down your dreams when you wake up — the sooner you record them, the more you&apos;ll remember.
            You can explore possible meanings with AI analysis.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary flex items-center mx-auto bg-violet-600 hover:bg-violet-700"
          >
            <Plus className="w-5 h-5 mr-2" />
            Record your first dream
          </button>
        </div>
      )}

      <DreamAnalysisModal
        isOpen={showAnalysis}
        onClose={() => setShowAnalysis(false)}
        analysis={dreamAnalysis}
      />
    </div>
  );
};

export default DreamDiary;
