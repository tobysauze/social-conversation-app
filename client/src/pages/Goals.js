import React, { useEffect, useState } from 'react';
import { goalsAPI } from '../services/api';
import { Target, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

const Goals = () => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ title: '', description: '', area: '', target_date: '' });

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

  const create = async () => {
    if (!form.title.trim()) return;
    try {
      await goalsAPI.create(form);
      setForm({ title: '', description: '', area: '', target_date: '' });
      await load();
    } catch (e) {
      console.error(e);
      toast.error('Failed to create goal');
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete goal?')) return;
    try {
      await goalsAPI.remove(id);
      await load();
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete goal');
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading…</div>;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-3xl font-bold flex items-center mb-6"><Target className="w-7 h-7 text-green-600 mr-2"/>Goals</h1>

      <div className="card mb-6 grid grid-cols-1 md:grid-cols-4 gap-3">
        <input className="input-field" placeholder="Title" value={form.title} onChange={(e)=>setForm(prev=>({ ...prev, title: e.target.value }))} />
        <input className="input-field" placeholder="Area (health, work, social…)" value={form.area} onChange={(e)=>setForm(prev=>({ ...prev, area: e.target.value }))} />
        <input type="date" className="input-field" value={form.target_date} onChange={(e)=>setForm(prev=>({ ...prev, target_date: e.target.value }))} />
        <button onClick={create} className="btn-primary flex items-center justify-center"><Plus className="w-4 h-4 mr-2"/>Add</button>
        <textarea className="input-field md:col-span-4" placeholder="Description (optional)" value={form.description} onChange={(e)=>setForm(prev=>({ ...prev, description: e.target.value }))} />
      </div>

      <div className="space-y-3">
        {items.map(g => (
          <div key={g.id} className="border rounded-lg p-4 flex items-start justify-between">
            <div>
              <div className="font-medium text-gray-900">{g.title}</div>
              <div className="text-sm text-gray-600">{g.area || '—'} {g.target_date ? `• by ${g.target_date}` : ''}</div>
              {g.description && <div className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{g.description}</div>}
            </div>
            <button onClick={()=>remove(g.id)} className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded" title="Delete"><Trash2 className="w-4 h-4"/></button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Goals;


