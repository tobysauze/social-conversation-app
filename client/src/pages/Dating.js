import React, { useEffect, useMemo, useState } from 'react';
import { Heart, Plus, Save, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { datingAPI } from '../services/api';

const reflectionQuestions = [
  'What values do I need us to share to feel safe and aligned long-term?',
  'What relationship dynamic do I want day-to-day (communication, conflict style, affection, independence)?',
  'What are my non-negotiables vs preferences?',
  'What patterns from my past relationships do I not want to repeat?',
  'What kind of life do I want to build with a partner in 3-5 years?'
];

const emptyProfile = {
  partner_vision: '',
  must_haves: [],
  nice_to_haves: [],
  red_flags: [],
  self_reflection_answers: {}
};

const Dating = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(emptyProfile);
  const [drafts, setDrafts] = useState({ must: '', nice: '', red: '' });

  useEffect(() => {
    (async () => {
      try {
        const res = await datingAPI.get();
        const p = res.data?.profile || emptyProfile;
        setProfile({
          partner_vision: p.partner_vision || '',
          must_haves: p.must_haves || [],
          nice_to_haves: p.nice_to_haves || [],
          red_flags: p.red_flags || [],
          self_reflection_answers: p.self_reflection_answers || {}
        });
      } catch (e) {
        console.error(e);
        toast.error('Failed to load dating profile');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const completionScore = useMemo(() => {
    let score = 0;
    if (profile.partner_vision.trim()) score += 1;
    if (profile.must_haves.length) score += 1;
    if (profile.nice_to_haves.length) score += 1;
    if (profile.red_flags.length) score += 1;
    const answered = reflectionQuestions.filter((q) => (profile.self_reflection_answers?.[q] || '').trim()).length;
    if (answered >= 3) score += 1;
    return `${score}/5`;
  }, [profile]);

  const save = async () => {
    setSaving(true);
    try {
      await datingAPI.save(profile);
      toast.success('Dating profile saved');
    } catch (e) {
      console.error(e);
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const addItem = (field, draftKey) => {
    const value = (drafts[draftKey] || '').trim();
    if (!value) return;
    setProfile((prev) => ({ ...prev, [field]: [...prev[field], value] }));
    setDrafts((prev) => ({ ...prev, [draftKey]: '' }));
  };

  const removeItem = (field, idx) => {
    setProfile((prev) => ({ ...prev, [field]: prev[field].filter((_, i) => i !== idx) }));
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center text-gray-900">
          <Heart className="w-7 h-7 text-pink-600 mr-2" />
          Dating
        </h1>
        <p className="text-gray-600 mt-2">
          Define what you want in a partner so your dating choices match your values and long-term goals.
        </p>
        <p className="text-sm text-gray-500 mt-1">Clarity score: {completionScore}</p>
      </div>

      <div className="card mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          What do you want in a partner?
        </label>
        <textarea
          rows={4}
          className="input-field"
          placeholder="Write a short vision of the relationship and partner you want."
          value={profile.partner_vision}
          onChange={(e) => setProfile((prev) => ({ ...prev, partner_vision: e.target.value }))}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-3">Must-haves</h2>
          <div className="flex gap-2 mb-3">
            <input
              className="input-field"
              value={drafts.must}
              onChange={(e) => setDrafts((prev) => ({ ...prev, must: e.target.value }))}
              placeholder="e.g. Kind, emotionally available"
            />
            <button className="btn-primary" onClick={() => addItem('must_haves', 'must')}>
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            {profile.must_haves.map((item, idx) => (
              <div key={`${item}-${idx}`} className="flex items-center justify-between text-sm border rounded px-2 py-1">
                <span>{item}</span>
                <button onClick={() => removeItem('must_haves', idx)} className="text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-3">Nice-to-haves</h2>
          <div className="flex gap-2 mb-3">
            <input
              className="input-field"
              value={drafts.nice}
              onChange={(e) => setDrafts((prev) => ({ ...prev, nice: e.target.value }))}
              placeholder="e.g. Loves travel, playful humor"
            />
            <button className="btn-primary" onClick={() => addItem('nice_to_haves', 'nice')}>
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            {profile.nice_to_haves.map((item, idx) => (
              <div key={`${item}-${idx}`} className="flex items-center justify-between text-sm border rounded px-2 py-1">
                <span>{item}</span>
                <button onClick={() => removeItem('nice_to_haves', idx)} className="text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-3">Red flags</h2>
          <div className="flex gap-2 mb-3">
            <input
              className="input-field"
              value={drafts.red}
              onChange={(e) => setDrafts((prev) => ({ ...prev, red: e.target.value }))}
              placeholder="e.g. Dishonesty, contempt"
            />
            <button className="btn-primary" onClick={() => addItem('red_flags', 'red')}>
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            {profile.red_flags.map((item, idx) => (
              <div key={`${item}-${idx}`} className="flex items-center justify-between text-sm border rounded px-2 py-1">
                <span>{item}</span>
                <button onClick={() => removeItem('red_flags', idx)} className="text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card mb-6">
        <h2 className="font-semibold text-gray-900 mb-3">Self-reflection questions</h2>
        <div className="space-y-4">
          {reflectionQuestions.map((question) => (
            <div key={question}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{question}</label>
              <textarea
                rows={3}
                className="input-field"
                value={profile.self_reflection_answers?.[question] || ''}
                onChange={(e) =>
                  setProfile((prev) => ({
                    ...prev,
                    self_reflection_answers: {
                      ...(prev.self_reflection_answers || {}),
                      [question]: e.target.value
                    }
                  }))
                }
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button className="btn-primary flex items-center" onClick={save} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save Dating Profile'}
        </button>
      </div>
    </div>
  );
};

export default Dating;
