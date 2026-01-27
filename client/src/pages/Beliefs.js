import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { BookOpen, Plus, Save, Trash2, X } from 'lucide-react';
import { beliefsAPI } from '../services/api';

const Beliefs = () => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ current_belief: '', desired_belief: '', change_plan: '' });

  const canSave = useMemo(
    () => form.current_belief.trim().length > 0 && form.desired_belief.trim().length > 0,
    [form.current_belief, form.desired_belief]
  );

  const reset = () => {
    setEditingId(null);
    setForm({ current_belief: '', desired_belief: '', change_plan: '' });
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await beliefsAPI.list();
      setItems(res.data.beliefs || []);
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.error || 'Failed to load beliefs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const startEdit = (b) => {
    setEditingId(b.id);
    setForm({
      current_belief: b.current_belief || '',
      desired_belief: b.desired_belief || '',
      change_plan: b.change_plan || ''
    });
  };

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = {
        current_belief: form.current_belief.trim(),
        desired_belief: form.desired_belief.trim(),
        change_plan: form.change_plan.trim() || null
      };

      if (editingId) {
        await beliefsAPI.update(editingId, payload);
        toast.success('Updated');
      } else {
        await beliefsAPI.create(payload);
        toast.success('Added');
      }

      reset();
      await load();
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.error || 'Failed to save belief');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this belief?')) return;
    try {
      await beliefsAPI.remove(id);
      toast.success('Deleted');
      await load();
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.error || 'Failed to delete');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <BookOpen className="w-8 h-8 text-indigo-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Beliefs</h1>
            <p className="text-gray-600">
              Capture what you currently believe, what you want to believe instead, and how you’ll shift it.
            </p>
          </div>
        </div>
      </div>

      <div className="card mb-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current belief</label>
            <textarea
              className="input-field bg-white text-black"
              rows={3}
              value={form.current_belief}
              onChange={(e) => setForm((p) => ({ ...p, current_belief: e.target.value }))}
              placeholder="e.g., If I speak up, people will judge me."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Desired belief</label>
            <textarea
              className="input-field bg-white text-black"
              rows={3}
              value={form.desired_belief}
              onChange={(e) => setForm((p) => ({ ...p, desired_belief: e.target.value }))}
              placeholder="e.g., If I speak up, I’ll usually be fine—and I’ll get better with reps."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">How to change it</label>
            <textarea
              className="input-field bg-white text-black"
              rows={3}
              value={form.change_plan}
              onChange={(e) => setForm((p) => ({ ...p, change_plan: e.target.value }))}
              placeholder="e.g., 1) One small comment per convo. 2) Track outcomes. 3) Reframe slip-ups as reps."
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          {editingId && (
            <button className="btn-secondary inline-flex items-center" onClick={reset} disabled={saving}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </button>
          )}
          <button className="btn-primary inline-flex items-center" onClick={save} disabled={saving || !canSave}>
            {editingId ? <Save className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            {editingId ? 'Save' : 'Add'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-500">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-gray-500">No beliefs yet. Add your first above.</div>
      ) : (
        <div className="space-y-3">
          {items.map((b) => (
            <div key={b.id} className="border border-gray-200 rounded-lg p-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Current</div>
                  <div className="text-gray-900 whitespace-pre-wrap">{b.current_belief}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Desired</div>
                  <div className="text-gray-900 whitespace-pre-wrap">{b.desired_belief}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase mb-1">How</div>
                  <div className="text-gray-900 whitespace-pre-wrap">{b.change_plan || '—'}</div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="text-xs text-gray-500">
                  Updated: {b.updated_at ? new Date(b.updated_at).toLocaleString() : '—'}
                </div>
                <div className="flex items-center gap-2">
                  <button className="btn-secondary" onClick={() => startEdit(b)}>
                    Edit
                  </button>
                  <button
                    className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
                    title="Delete"
                    onClick={() => remove(b.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Beliefs;

