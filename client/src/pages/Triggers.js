import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, Plus, Trash2, Save, X } from 'lucide-react';
import { triggersAPI } from '../services/api';

const Triggers = () => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ title: '', category: '', intensity: '', notes: '' });

  const reset = () => setForm({ title: '', category: '', intensity: '', notes: '' });

  const load = async () => {
    setLoading(true);
    try {
      const res = await triggersAPI.list();
      setItems(res.data.triggers || []);
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.error || 'Failed to load triggers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const canSave = useMemo(() => form.title.trim().length > 0, [form.title]);

  const startEdit = (t) => {
    setEditingId(t.id);
    setForm({
      title: t.title || '',
      category: t.category || '',
      intensity: t.intensity ?? '',
      notes: t.notes || ''
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    reset();
  };

  const save = async () => {
    if (!canSave) return;
    setCreating(true);
    try {
      const payload = {
        title: form.title.trim(),
        category: form.category.trim() || null,
        intensity: form.intensity === '' ? null : Number(form.intensity),
        notes: form.notes.trim() || null
      };

      if (editingId) {
        await triggersAPI.update(editingId, payload);
        toast.success('Updated');
      } else {
        await triggersAPI.create(payload);
        toast.success('Added');
      }

      cancelEdit();
      await load();
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.error || 'Failed to save');
    } finally {
      setCreating(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this trigger?')) return;
    try {
      await triggersAPI.remove(id);
      toast.success('Deleted');
      await load();
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.error || 'Failed to delete');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <AlertTriangle className="w-8 h-8 text-amber-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Triggers</h1>
            <p className="text-gray-600">Track anxiety triggers so you can spot patterns and reduce them over time.</p>
          </div>
        </div>
      </div>

      <div className="card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <input
            className="input-field md:col-span-4"
            placeholder="Trigger title (required)"
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
          />
          <input
            className="input-field md:col-span-3"
            placeholder="Category (optional)"
            value={form.category}
            onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
          />
          <input
            type="number"
            min="1"
            max="10"
            className="input-field md:col-span-2"
            placeholder="Intensity 1-10"
            value={form.intensity}
            onChange={(e) => setForm((p) => ({ ...p, intensity: e.target.value }))}
          />
          <div className="md:col-span-3 flex gap-2">
            <button
              className="btn-primary flex-1 inline-flex items-center justify-center"
              onClick={save}
              disabled={creating || !canSave}
            >
              {editingId ? <Save className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              {editingId ? 'Save' : 'Add'}
            </button>
            {editingId && (
              <button className="btn-secondary inline-flex items-center" onClick={cancelEdit} disabled={creating}>
                <X className="w-4 h-4 mr-2" /> Cancel
              </button>
            )}
          </div>
          <textarea
            className="input-field md:col-span-12"
            rows={3}
            placeholder="Notes (what happened / what you felt / what helped)…"
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          />
        </div>
      </div>

      {loading ? (
        <div className="text-gray-500">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-gray-500">No triggers yet. Add your first above.</div>
      ) : (
        <div className="space-y-3">
          {items.map((t) => (
            <div key={t.id} className="border border-gray-200 rounded-lg p-4 flex items-start justify-between gap-4">
              <button
                type="button"
                className="text-left flex-1 min-w-0"
                onClick={() => startEdit(t)}
                title="Click to edit"
              >
                <div className="flex items-center gap-2">
                  <div className="font-medium text-gray-900 truncate">{t.title}</div>
                  {t.intensity ? (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800">
                      {t.intensity}/10
                    </span>
                  ) : null}
                  {t.category ? (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700">
                      {t.category}
                    </span>
                  ) : null}
                </div>
                {t.notes ? <div className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{t.notes}</div> : null}
                <div className="text-xs text-gray-500 mt-2">
                  Updated: {t.updated_at ? new Date(t.updated_at).toLocaleString() : '—'}
                </div>
              </button>
              <button
                type="button"
                onClick={() => remove(t.id)}
                className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Triggers;

