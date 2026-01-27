import React, { useEffect, useState } from 'react';
import { goalsAPI } from '../services/api';
import { Target, Plus, Trash2, Pencil, X, Save } from 'lucide-react';
import toast from 'react-hot-toast';

const Goals = () => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ title: '', description: '', area: '', target_date: '' });
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const normalizeDateForInput = (value) => {
    if (!value) return '';
    if (typeof value !== 'string') return '';
    // If already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    // ISO timestamp
    if (value.includes('T')) return value.slice(0, 10);
    // DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
      const [dd, mm, yyyy] = value.split('/').map(Number);
      const pad = (n) => String(n).padStart(2, '0');
      return `${yyyy}-${pad(mm)}-${pad(dd)}`;
    }
    return '';
  };

  const getDaysUntil = (input) => {
    if (!input) return null;
    let target;
    // Handle Date object
    if (input instanceof Date) {
      target = input;
    } else if (typeof input === 'string') {
      // DD/MM/YYYY
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(input)) {
        const [dd, mm, yyyy] = input.split('/').map(Number);
        target = new Date(Date.UTC(yyyy, mm - 1, dd));
      }
      // YYYY-MM-DD (date only)
      else if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
        const [yyyy, mm, dd] = input.split('-').map(Number);
        target = new Date(Date.UTC(yyyy, mm - 1, dd));
      }
      // ISO timestamp
      else if (input.includes('T')) {
        const iso = new Date(input);
        if (!isNaN(iso.getTime())) target = iso;
      }
    }
    if (!target || isNaN(target.getTime())) return null;
    const targetUtc = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
    const now = new Date();
    const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    return Math.round((targetUtc - todayUtc) / 86400000);
  };

  const renderCountdown = (dateStr) => {
    const days = getDaysUntil(dateStr);
    if (days === null) return null;
    let text = '';
    let cls = 'bg-gray-100 text-gray-700';
    if (days > 7) { text = `${days}d left`; cls = 'bg-green-100 text-green-800'; }
    else if (days > 1) { text = `${days}d left`; cls = 'bg-yellow-100 text-yellow-800'; }
    else if (days === 1) { text = 'tomorrow'; cls = 'bg-yellow-100 text-yellow-800'; }
    else if (days === 0) { text = 'due today'; cls = 'bg-orange-100 text-orange-800'; }
    else { text = `${Math.abs(days)}d overdue`; cls = 'bg-red-100 text-red-800'; }
    return <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${cls}`}>{text}</span>;
  };

  const load = async () => {
    try {
      const res = await goalsAPI.list();
      setItems(res.data.goals || []);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load goals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setForm({ title: '', description: '', area: '', target_date: '' });
    setEditingId(null);
  };

  const saveGoal = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await goalsAPI.update(editingId, form);
        toast.success('Goal updated');
      } else {
        await goalsAPI.create(form);
        toast.success('Goal added');
      }
      resetForm();
      await load();
    } catch (e) {
      console.error(e);
      toast.error(editingId ? 'Failed to update goal' : 'Failed to create goal');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete goal?')) return;
    try {
      await goalsAPI.remove(id);
      if (Number(editingId) === Number(id)) {
        resetForm();
      }
      await load();
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete goal');
    }
  };

  const startEdit = (g) => {
    setEditingId(g.id);
    setForm({
      title: g.title || '',
      area: g.area || '',
      target_date: normalizeDateForInput(g.target_date),
      description: g.description || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading…</div>;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-3xl font-bold flex items-center mb-6"><Target className="w-7 h-7 text-green-600 mr-2"/>Goals</h1>

      <div className="card mb-6 grid grid-cols-1 md:grid-cols-4 gap-3">
        <input className="input-field" placeholder="Title" value={form.title} onChange={(e)=>setForm(prev=>({ ...prev, title: e.target.value }))} />
        <input className="input-field" placeholder="Area (health, work, social…)" value={form.area} onChange={(e)=>setForm(prev=>({ ...prev, area: e.target.value }))} />
        <input type="date" className="input-field" value={form.target_date} onChange={(e)=>setForm(prev=>({ ...prev, target_date: e.target.value }))} />
        <button onClick={saveGoal} disabled={saving} className="btn-primary flex items-center justify-center">
          {editingId ? <Save className="w-4 h-4 mr-2"/> : <Plus className="w-4 h-4 mr-2"/>}
          {editingId ? (saving ? 'Saving…' : 'Save') : (saving ? 'Adding…' : 'Add')}
        </button>
        <textarea className="input-field md:col-span-4" placeholder="Description (optional)" value={form.description} onChange={(e)=>setForm(prev=>({ ...prev, description: e.target.value }))} />
        {editingId && (
          <button
            type="button"
            onClick={resetForm}
            disabled={saving}
            className="btn-secondary md:col-span-4 flex items-center justify-center"
          >
            <X className="w-4 h-4 mr-2" />
            Cancel edit
          </button>
        )}
      </div>

      <div className="space-y-3">
        {items.map(g => (
          <div key={g.id} className="border rounded-lg p-4 flex items-start justify-between">
            <div>
              <div className="font-medium text-gray-900 flex items-center">{g.title} {renderCountdown(g.target_date)}</div>
              <div className="text-sm text-gray-600">{g.area || '—'} {g.target_date ? `• by ${g.target_date}` : ''}</div>
              {g.description && <div className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{g.description}</div>}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => startEdit(g)}
                className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded"
                title="Edit"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={()=>remove(g.id)} className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded" title="Delete"><Trash2 className="w-4 h-4"/></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Goals;


