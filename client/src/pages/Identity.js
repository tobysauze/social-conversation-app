import React, { useEffect, useState } from 'react';
import { identityAPI } from '../services/api';
import { Heart, Save } from 'lucide-react';
import toast from 'react-hot-toast';

const Identity = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vision, setVision] = useState('');
  const [values, setValues] = useState([]);
  const [principles, setPrinciples] = useState([]);
  const [tmp, setTmp] = useState({ value: '', principle: '' });

  useEffect(() => {
    (async () => {
      try {
        const res = await identityAPI.get();
        const d = res.data.identity || { vision: '', values: [], principles: [] };
        setVision(d.vision || '');
        setValues(d.values || []);
        setPrinciples(d.principles || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await identityAPI.save({ vision, values, principles });
      toast.success('Saved');
    } catch (e) {
      console.error(e);
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading…</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold flex items-center mb-6"><Heart className="w-7 h-7 text-rose-500 mr-2"/>Who I Want To Be</h1>

      <div className="card mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Vision statement</label>
        <textarea value={vision} onChange={(e)=>setVision(e.target.value)} rows={6} className="w-full px-3 py-2 border rounded" placeholder="Describe the kind of person you aspire to be…" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <label className="block text-sm font-medium text-gray-700 mb-2">Core values</label>
          <div className="flex gap-2 mb-2">
            <input value={tmp.value} onChange={(e)=>setTmp(prev=>({ ...prev, value: e.target.value }))} className="input-field flex-1" placeholder="e.g., Curiosity"/>
            <button className="btn-primary" onClick={()=>{ if(tmp.value.trim()){ setValues(v=>[...v, tmp.value.trim()]); setTmp(prev=>({ ...prev, value: '' })); } }}>Add</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {values.map((v,i)=>(<span key={i} className="px-2 py-1 bg-rose-100 text-rose-800 text-xs rounded-full flex items-center">{v}<button onClick={()=>setValues(vals=>vals.filter((_,idx)=>idx!==i))} className="ml-2">×</button></span>))}
          </div>
        </div>
        <div className="card">
          <label className="block text-sm font-medium text-gray-700 mb-2">Guiding principles</label>
          <div className="flex gap-2 mb-2">
            <input value={tmp.principle} onChange={(e)=>setTmp(prev=>({ ...prev, principle: e.target.value }))} className="input-field flex-1" placeholder="e.g., Default to kindness"/>
            <button className="btn-primary" onClick={()=>{ if(tmp.principle.trim()){ setPrinciples(p=>[...p, tmp.principle.trim()]); setTmp(prev=>({ ...prev, principle: '' })); } }}>Add</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {principles.map((p,i)=>(<span key={i} className="px-2 py-1 bg-indigo-100 text-indigo-800 text-xs rounded-full flex items-center">{p}<button onClick={()=>setPrinciples(pr=>pr.filter((_,idx)=>idx!==i))} className="ml-2">×</button></span>))}
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end">
        <button onClick={save} disabled={saving} className="btn-primary flex items-center"><Save className="w-4 h-4 mr-2"/>{saving?'Saving…':'Save'}</button>
      </div>
    </div>
  );
};

export default Identity;


