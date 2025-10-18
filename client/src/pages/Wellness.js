import React, { useEffect, useState } from 'react';
import { wellnessAPI } from '../services/api';
import { Calendar, Plus, TrendingUp, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const todayISO = () => new Date().toISOString().slice(0,10);

const Wellness = () => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [correlations, setCorrelations] = useState(null);
  const [form, setForm] = useState({
    date: todayISO(),
    supplements: [],
    medication: [],
    diet_quality: '',
    exercise_minutes: '',
    exercise_intensity: '',
    sleep_quality: '',
    sleep_score: '',
    weight_kg: '',
    height_cm: '',
    bmi: '',
    body_fat_percent: ''
  });
  const [supp, setSupp] = useState('');
  const [med, setMed] = useState('');
  const [dietItem, setDietItem] = useState('');
  const [presetLoading, setPresetLoading] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const [listRes, corrRes] = await Promise.all([
        wellnessAPI.list(),
        wellnessAPI.correlations()
      ]);
      setEntries(listRes.data.wellness || []);
      setCorrelations(corrRes.data.correlations || null);
      // Pull preset once
      setPresetLoading(true);
      try {
        const pr = await wellnessAPI.getPreset();
        const p = pr.data.preset || { supplements: [], medication: [], diet_items: [] };
        // initialize form stacks if empty
        setForm(prev => ({
          ...prev,
          supplements: prev.supplements?.length ? prev.supplements : p.supplements,
          medication: prev.medication?.length ? prev.medication : p.medication,
          diet_items: prev.diet_items?.length ? prev.diet_items : p.diet_items
        }));
      } catch (_) {}
      setPresetLoading(false);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load wellness data');
    } finally {
      setLoading(false);
    }
  };

  const addTo = (key, value) => {
    if (!value.trim()) return;
    setForm(prev => ({ ...prev, [key]: [...(prev[key]||[]), value.trim()] }));
  };

  const removeFrom = (key, idx) => {
    setForm(prev => ({ ...prev, [key]: (prev[key]||[]).filter((_,i)=>i!==idx) }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        date: form.date,
        supplements: form.supplements,
        medication: form.medication,
        diet_items: form.diet_items || [],
        diet_quality: form.diet_quality ? Number(form.diet_quality) : null,
        exercise_minutes: form.exercise_minutes ? Number(form.exercise_minutes) : 0,
        exercise_intensity: form.exercise_intensity ? Number(form.exercise_intensity) : null,
        sleep_quality: form.sleep_quality ? Number(form.sleep_quality) : null,
        sleep_score: form.sleep_score ? Number(form.sleep_score) : null,
        weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
        height_cm: form.height_cm ? Number(form.height_cm) : null,
        bmi: form.bmi ? Number(form.bmi) : null,
        body_fat_percent: form.body_fat_percent ? Number(form.body_fat_percent) : null
      };
      await wellnessAPI.upsert(payload);
      toast.success('Saved');
      await load();
    } catch (e) {
      console.error(e);
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const savePreset = async () => {
    try {
      await wellnessAPI.savePreset({
        supplements: form.supplements || [],
        medication: form.medication || [],
        diet_items: form.diet_items || []
      });
      toast.success('Defaults saved');
    } catch (e) {
      console.error(e);
      toast.error('Failed to save defaults');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this wellness entry?')) return;
    try {
      await wellnessAPI.remove(id);
      toast.success('Deleted');
      await load();
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete');
    }
  };

  const corrBadge = (v) => {
    if (v === null || v === undefined) return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">n/a</span>;
    const strength = Math.abs(v);
    const color = strength > 0.6 ? 'bg-green-100 text-green-800' : strength > 0.3 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-700';
    return <span className={`px-2 py-1 text-xs rounded ${color}`}>{v.toFixed(2)}</span>;
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <Calendar className="w-8 h-8 text-primary-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Wellness</h1>
            <p className="text-gray-600">Track supplements, diet, exercise, sleep and see correlations with mood</p>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center">
          <Plus className="w-5 h-5 mr-2" /> {saving ? 'Saving...' : 'Save Entry'}
        </button>
      </div>

      {/* Form */}
      <div className="card mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
            <input type="date" value={form.date} onChange={(e)=>setForm({...form, date: e.target.value})} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Diet quality (1-5)</label>
            <input type="number" min="1" max="5" value={form.diet_quality} onChange={(e)=>setForm({...form, diet_quality: e.target.value})} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Exercise minutes</label>
            <input type="number" min="0" value={form.exercise_minutes} onChange={(e)=>setForm({...form, exercise_minutes: e.target.value})} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Exercise intensity (1-5)</label>
            <input type="number" min="1" max="5" value={form.exercise_intensity} onChange={(e)=>setForm({...form, exercise_intensity: e.target.value})} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Sleep quality (1-5)</label>
            <input type="number" min="1" max="5" value={form.sleep_quality} onChange={(e)=>setForm({...form, sleep_quality: e.target.value})} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Sleep score</label>
            <input type="number" min="0" max="100" value={form.sleep_score} onChange={(e)=>setForm({...form, sleep_score: e.target.value})} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Weight (kg)</label>
            <input type="number" min="0" step="0.1" value={form.weight_kg} onChange={(e)=>{
              const weight_kg = e.target.value;
              setForm(prev=>{
                const height_m = Number(prev.height_cm||0)/100;
                const bmi = height_m>0 && weight_kg ? (Number(weight_kg)/(height_m*height_m)).toFixed(1) : '';
                return { ...prev, weight_kg, bmi };
              });
            }} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Height (cm)</label>
            <input type="number" min="0" step="0.5" value={form.height_cm} onChange={(e)=>{
              const height_cm = e.target.value;
              setForm(prev=>{
                const height_m = Number(height_cm||0)/100;
                const bmi = height_m>0 && prev.weight_kg ? (Number(prev.weight_kg)/(height_m*height_m)).toFixed(1) : '';
                return { ...prev, height_cm, bmi };
              });
            }} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">BMI (auto)</label>
            <input type="number" step="0.1" value={form.bmi} onChange={(e)=>setForm({...form, bmi: e.target.value})} className="input-field" placeholder="auto-calculated from height & weight" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Body fat %</label>
            <input type="number" min="0" max="100" step="0.1" value={form.body_fat_percent} onChange={(e)=>setForm({...form, body_fat_percent: e.target.value})} className="input-field" />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Supplements</label>
            <div className="flex space-x-2 mb-2">
              <input type="text" value={supp} onChange={(e)=>setSupp(e.target.value)} className="input-field flex-1" placeholder="e.g., Vitamin D" />
              <button type="button" onClick={()=>{addTo('supplements', supp); setSupp('');}} className="btn-primary">Add</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(form.supplements||[]).map((s,i)=>(
                <span key={i} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full flex items-center">
                  {s}
                  <button onClick={()=>removeFrom('supplements', i)} className="ml-2 text-blue-600">×</button>
                </span>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Medication</label>
            <div className="flex space-x-2 mb-2">
              <input type="text" value={med} onChange={(e)=>setMed(e.target.value)} className="input-field flex-1" placeholder="e.g., Ibuprofen 200mg" />
              <button type="button" onClick={()=>{addTo('medication', med); setMed('');}} className="btn-primary">Add</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(form.medication||[]).map((m,i)=>(
                <span key={i} className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full flex items-center">
                  {m}
                  <button onClick={()=>removeFrom('medication', i)} className="ml-2 text-purple-600">×</button>
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Diet items (recurring)</label>
          <div className="flex space-x-2 mb-2">
            <input type="text" value={dietItem} onChange={(e)=>setDietItem(e.target.value)} className="input-field flex-1" placeholder="e.g., Oats, Coffee" />
            <button type="button" onClick={()=>{addTo('diet_items', dietItem); setDietItem('');}} className="btn-primary">Add</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(form.diet_items||[]).map((d,i)=>(
              <span key={i} className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full flex items-center">
                {d}
                <button onClick={()=>removeFrom('diet_items', i)} className="ml-2 text-green-600">×</button>
              </span>
            ))}
          </div>
        </div>
        <div className="mt-6 flex items-center justify-end">
          <button type="button" onClick={savePreset} className="btn-secondary" disabled={presetLoading}>Save as defaults</button>
        </div>
      </div>

      {/* Correlations */}
      <div className="card mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center"><TrendingUp className="w-5 h-5 mr-2"/>Correlations with mood</h2>
        {correlations ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="flex items-center justify-between"><span>Exercise minutes</span>{corrBadge(correlations.exercise_minutes)}</div>
            <div className="flex items-center justify-between"><span>Exercise intensity</span>{corrBadge(correlations.exercise_intensity)}</div>
            <div className="flex items-center justify-between"><span>Diet quality</span>{corrBadge(correlations.diet_quality)}</div>
            <div className="flex items-center justify-between"><span>Sleep quality</span>{corrBadge(correlations.sleep_quality)}</div>
            <div className="flex items-center justify-between"><span>Sleep score</span>{corrBadge(correlations.sleep_score)}</div>
            <div className="flex items-center justify-between"><span>Supplements count</span>{corrBadge(correlations.supplements_count)}</div>
            <div className="flex items-center justify-between"><span>Medication count</span>{corrBadge(correlations.medication_count)}</div>
          </div>
        ) : (
          <p className="text-gray-600 text-sm">No correlation data yet.</p>
        )}
        <p className="text-xs text-gray-500 mt-3">Values are Pearson r (−1 strong negative … +1 strong positive). Uses your daily average mood from journal entries.</p>
      </div>

      {/* Recent entries */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-gray-500">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="text-gray-500">No entries yet. Add your first above.</div>
        ) : (
          entries.map(e => (
            <div key={e.id} className="border border-gray-200 rounded-lg p-4 flex items-start justify-between">
              <div>
                <div className="font-medium text-gray-900">{format(new Date(e.date), 'MMM d, yyyy')}</div>
                <div className="text-sm text-gray-700 mt-1">
                  <span className="mr-3">Diet: {e.diet_quality ?? '—'}</span>
                  <span className="mr-3">Exercise: {e.exercise_minutes}m{e.exercise_intensity ? ` @${e.exercise_intensity}` : ''}</span>
                  <span className="mr-3">Sleep: {e.sleep_quality ?? '—'} / {e.sleep_score ?? '—'}</span>
                  {e.weight_kg ? <span className="mr-3">Weight: {e.weight_kg}kg</span> : null}
                  {e.bmi ? <span className="mr-3">BMI: {e.bmi}</span> : null}
                  {e.body_fat_percent ? <span className="mr-3">BF%: {e.body_fat_percent}</span> : null}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {e.supplements?.length ? `Supp: ${e.supplements.join(', ')}` : ''}
                  {e.medication?.length ? `  Meds: ${e.medication.join(', ')}` : ''}
                </div>
              </div>
              <button onClick={()=>handleDelete(e.id)} className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded" title="Delete"><Trash2 className="w-4 h-4"/></button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Wellness;


