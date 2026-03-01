import React, { useEffect, useMemo, useState } from 'react';
import { Heart, Plus, Save, Trash2, Zap, Target } from 'lucide-react';
import toast from 'react-hot-toast';
import { datingAPI } from '../services/api';

const reflectionQuestions = [
  'What values do I need us to share to feel safe and aligned long-term?',
  'What relationship dynamic do I want day-to-day (communication, conflict style, affection, independence)?',
  'What are my non-negotiables vs preferences?',
  'What patterns from my past relationships do I not want to repeat?',
  'What kind of life do I want to build with a partner in 3-5 years?'
];

const emptyRequirements = {
  partner_vision: '',
  must_haves: [],
  nice_to_haves: [],
  red_flags: [],
  interests: []
};

const emptyProfile = {
  short_term: { ...emptyRequirements },
  long_term: { ...emptyRequirements },
  self_reflection_answers: {}
};

const RequirementSection = ({
  title,
  icon: Icon,
  data,
  onUpdate,
  drafts,
  onDraftChange,
  draftKeys
}) => {
  const addItem = (field, draftKey) => {
    const value = (drafts[draftKey] || '').trim();
    if (!value) return;
    onUpdate({ ...data, [field]: [...(data[field] || []), value] });
    onDraftChange({ ...drafts, [draftKey]: '' });
  };

  const removeItem = (field, idx) => {
    onUpdate({
      ...data,
      [field]: (data[field] || []).filter((_, i) => i !== idx)
    });
  };

  return (
    <div className="card mb-6">
      <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Icon className="w-5 h-5 text-pink-600" />
        {title}
      </h2>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          What do you want in this type of partner?
        </label>
        <textarea
          rows={3}
          className="input-field"
          placeholder="Write a short vision of what you want from this relationship."
          value={data.partner_vision || ''}
          onChange={(e) => onUpdate({ ...data, partner_vision: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Must-haves</h3>
          <div className="flex gap-2 mb-2">
            <input
              className="input-field text-sm"
              value={drafts[draftKeys.must] || ''}
              onChange={(e) =>
                onDraftChange({ ...drafts, [draftKeys.must]: e.target.value })
              }
              placeholder="e.g. Kind, emotionally available"
            />
            <button
              className="btn-primary shrink-0"
              onClick={() => addItem('must_haves', draftKeys.must)}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-1">
            {(data.must_haves || []).map((item, idx) => (
              <div
                key={`${item}-${idx}`}
                className="flex items-center justify-between text-sm border rounded px-2 py-1"
              >
                <span>{item}</span>
                <button
                  onClick={() => removeItem('must_haves', idx)}
                  className="text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Nice-to-haves</h3>
          <div className="flex gap-2 mb-2">
            <input
              className="input-field text-sm"
              value={drafts[draftKeys.nice] || ''}
              onChange={(e) =>
                onDraftChange({ ...drafts, [draftKeys.nice]: e.target.value })
              }
              placeholder="e.g. Loves travel, playful humor"
            />
            <button
              className="btn-primary shrink-0"
              onClick={() => addItem('nice_to_haves', draftKeys.nice)}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-1">
            {(data.nice_to_haves || []).map((item, idx) => (
              <div
                key={`${item}-${idx}`}
                className="flex items-center justify-between text-sm border rounded px-2 py-1"
              >
                <span>{item}</span>
                <button
                  onClick={() => removeItem('nice_to_haves', idx)}
                  className="text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Red flags</h3>
          <div className="flex gap-2 mb-2">
            <input
              className="input-field text-sm"
              value={drafts[draftKeys.red] || ''}
              onChange={(e) =>
                onDraftChange({ ...drafts, [draftKeys.red]: e.target.value })
              }
              placeholder="e.g. Dishonesty, contempt"
            />
            <button
              className="btn-primary shrink-0"
              onClick={() => addItem('red_flags', draftKeys.red)}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-1">
            {(data.red_flags || []).map((item, idx) => (
              <div
                key={`${item}-${idx}`}
                className="flex items-center justify-between text-sm border rounded px-2 py-1"
              >
                <span>{item}</span>
                <button
                  onClick={() => removeItem('red_flags', idx)}
                  className="text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Interests they must have
          </h3>
          <div className="flex gap-2 mb-2">
            <input
              className="input-field text-sm"
              value={drafts[draftKeys.interests] || ''}
              onChange={(e) =>
                onDraftChange({ ...drafts, [draftKeys.interests]: e.target.value })
              }
              placeholder="e.g. Hiking, reading, music"
            />
            <button
              className="btn-primary shrink-0"
              onClick={() => addItem('interests', draftKeys.interests)}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-1">
            {(data.interests || []).map((item, idx) => (
              <div
                key={`${item}-${idx}`}
                className="flex items-center justify-between text-sm border rounded px-2 py-1"
              >
                <span>{item}</span>
                <button
                  onClick={() => removeItem('interests', idx)}
                  className="text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const Dating = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(emptyProfile);
  const [drafts, setDrafts] = useState({
    short_must: '',
    short_nice: '',
    short_red: '',
    short_interests: '',
    long_must: '',
    long_nice: '',
    long_red: '',
    long_interests: ''
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await datingAPI.get();
        const p = res.data?.profile || emptyProfile;
        setProfile({
          short_term: {
            ...emptyRequirements,
            ...(p.short_term || {})
          },
          long_term: {
            ...emptyRequirements,
            ...(p.long_term || {})
          },
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
    const st = profile.short_term || emptyRequirements;
    const lt = profile.long_term || emptyRequirements;
    if (st.partner_vision?.trim()) score += 1;
    if (lt.partner_vision?.trim()) score += 1;
    if (st.must_haves?.length || lt.must_haves?.length) score += 1;
    if (st.red_flags?.length || lt.red_flags?.length) score += 1;
    const answered = reflectionQuestions.filter(
      (q) => (profile.self_reflection_answers?.[q] || '').trim()
    ).length;
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

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center text-gray-900">
          <Heart className="w-7 h-7 text-pink-600 mr-2" />
          Dating
        </h1>
        <p className="text-gray-600 mt-2">
          Define what you want in a partner for both short-term and long-term
          relationships—so you can be clear about your expectations when meeting
          someone and figure out what you want from them, if anything at all.
        </p>
        <p className="text-sm text-gray-500 mt-1">Clarity score: {completionScore}</p>
      </div>

      <RequirementSection
        title="Short-term partner requirements"
        icon={Zap}
        data={profile.short_term || emptyRequirements}
        onUpdate={(data) =>
          setProfile((prev) => ({ ...prev, short_term: data }))
        }
        drafts={drafts}
        onDraftChange={setDrafts}
        draftKeys={{
          must: 'short_must',
          nice: 'short_nice',
          red: 'short_red',
          interests: 'short_interests'
        }}
      />

      <RequirementSection
        title="Long-term partner requirements"
        icon={Target}
        data={profile.long_term || emptyRequirements}
        onUpdate={(data) =>
          setProfile((prev) => ({ ...prev, long_term: data }))
        }
        drafts={drafts}
        onDraftChange={setDrafts}
        draftKeys={{
          must: 'long_must',
          nice: 'long_nice',
          red: 'long_red',
          interests: 'long_interests'
        }}
      />

      <div className="card mb-6">
        <h2 className="font-semibold text-gray-900 mb-3">Self-reflection questions</h2>
        <div className="space-y-4">
          {reflectionQuestions.map((question) => (
            <div key={question}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {question}
              </label>
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
        <button
          className="btn-primary flex items-center"
          onClick={save}
          disabled={saving}
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save Dating Profile'}
        </button>
      </div>
    </div>
  );
};

export default Dating;
