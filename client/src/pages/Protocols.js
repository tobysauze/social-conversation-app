import React, { useEffect, useState } from 'react';
import { CheckCircle2, ClipboardList, Plus, Save, Trash2, Pencil, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { protocolsAPI } from '../services/api';

const initialForm = {
  title: '',
  when_to_use: '',
  cadence: '',
  stepsText: ''
};

const starterProtocols = [
  {
    title: 'Social Anxiety Reset',
    when_to_use: 'Before events or when avoidance thoughts spike.',
    cadence: '3-5 times per week',
    steps: [
      'Run 2 physiological sighs, then 60 seconds of slow exhale breathing.',
      'Set one tiny social mission: ask one question.',
      'Rate anxiety from 1-10 before and after.'
    ]
  },
  {
    title: 'VO2 Max Builder',
    when_to_use: '2 sessions weekly on non-consecutive days.',
    cadence: '6-8 week cycle',
    steps: [
      'Warm up 10 minutes.',
      '4 rounds: 4 minutes hard, 3 minutes easy recovery.',
      'Cool down 8-10 minutes.'
    ]
  }
];

const Protocols = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [protocols, setProtocols] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);

  const load = async () => {
    try {
      const res = await protocolsAPI.list();
      setProtocols(res.data.protocols || []);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load protocols');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
  };

  const toSteps = (stepsText) =>
    (stepsText || '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

  const saveProtocol = async () => {
    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        when_to_use: form.when_to_use.trim(),
        cadence: form.cadence.trim(),
        steps: toSteps(form.stepsText)
      };
      if (editingId) {
        await protocolsAPI.update(editingId, payload);
        toast.success('Protocol updated');
      } else {
        await protocolsAPI.create(payload);
        toast.success('Protocol added');
      }
      resetForm();
      await load();
    } catch (e) {
      console.error(e);
      toast.error('Failed to save protocol');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (p) => {
    setEditingId(p.id);
    setForm({
      title: p.title || '',
      when_to_use: p.when_to_use || '',
      cadence: p.cadence || '',
      stepsText: (p.steps || []).join('\n')
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const removeProtocol = async (id) => {
    if (!window.confirm('Delete this protocol?')) return;
    try {
      await protocolsAPI.remove(id);
      toast.success('Deleted');
      if (Number(editingId) === Number(id)) resetForm();
      await load();
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete protocol');
    }
  };

  const addStarterProtocols = async () => {
    setSaving(true);
    try {
      for (const p of starterProtocols) {
        await protocolsAPI.create(p);
      }
      toast.success('Starter protocols added');
      await load();
    } catch (e) {
      console.error(e);
      toast.error('Failed to add starter protocols');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <ClipboardList className="w-8 h-8 text-primary-600 mr-3" />
          Protocols
        </h1>
        <p className="text-gray-600 mt-2">
          Build your own repeatable playbooks. Add, edit, and delete protocols as you discover what works.
        </p>
      </div>

      <div className="card mb-6 grid grid-cols-1 md:grid-cols-2 gap-3">
        <input
          className="input-field"
          placeholder="Protocol title"
          value={form.title}
          onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
        />
        <input
          className="input-field"
          placeholder="Cadence (e.g. 3x per week)"
          value={form.cadence}
          onChange={(e) => setForm((prev) => ({ ...prev, cadence: e.target.value }))}
        />
        <input
          className="input-field md:col-span-2"
          placeholder="When to use"
          value={form.when_to_use}
          onChange={(e) => setForm((prev) => ({ ...prev, when_to_use: e.target.value }))}
        />
        <textarea
          className="input-field md:col-span-2"
          rows={5}
          placeholder="Steps (one per line)"
          value={form.stepsText}
          onChange={(e) => setForm((prev) => ({ ...prev, stepsText: e.target.value }))}
        />
        <button
          type="button"
          onClick={saveProtocol}
          disabled={saving}
          className="btn-primary flex items-center justify-center"
        >
          {editingId ? <Save className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
          {editingId ? (saving ? 'Saving...' : 'Save') : (saving ? 'Adding...' : 'Add Protocol')}
        </button>
        <button
          type="button"
          onClick={addStarterProtocols}
          disabled={saving}
          className="btn-secondary"
        >
          Add Starter Protocols
        </button>
        {editingId && (
          <button type="button" onClick={resetForm} className="btn-secondary md:col-span-2 flex items-center justify-center">
            <X className="w-4 h-4 mr-2" />
            Cancel edit
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {protocols.map((protocol) => (
          <section key={protocol.id} className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">{protocol.title}</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => startEdit(protocol)}
                  className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded"
                  title="Edit"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => removeProtocol(protocol.id)}
                  className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {protocol.when_to_use && (
              <p className="text-sm text-gray-600 mb-4">
                <span className="font-medium text-gray-800">When to use:</span> {protocol.when_to_use}
              </p>
            )}

            <ul className="space-y-2 mb-4">
              {(protocol.steps || []).map((step, idx) => (
                <li key={`${protocol.id}-step-${idx}`} className="flex items-start text-sm text-gray-700">
                  <CheckCircle2 className="w-4 h-4 text-primary-600 mt-0.5 mr-2 shrink-0" />
                  <span>{step}</span>
                </li>
              ))}
            </ul>

            {protocol.cadence && (
              <p className="text-sm text-gray-600">
                <span className="font-medium text-gray-800">Cadence:</span> {protocol.cadence}
              </p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
};

export default Protocols;
