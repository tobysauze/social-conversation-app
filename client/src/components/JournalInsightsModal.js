import React, { useEffect, useState } from 'react';
import { Brain, Lightbulb, Target, ShieldAlert, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { beliefsAPI, goalsAPI, identityAPI, triggersAPI } from '../services/api';

const JournalInsightsModal = ({ isOpen, onClose, insights, onApplied }) => {
  const [applying, setApplying] = useState({});
  const [applied, setApplied] = useState({});

  useEffect(() => {
    if (isOpen) {
      setApplying({});
      setApplied({});
    }
  }, [isOpen, insights]);

  const markApplying = (key, value) => setApplying((prev) => ({ ...prev, [key]: value }));
  const markApplied = (key, value) => setApplied((prev) => ({ ...prev, [key]: value }));

  const handleAddGoal = async (goal, idx) => {
    const key = `goal-${idx}`;
    markApplying(key, true);
    try {
      await goalsAPI.create({
        title: goal.title?.trim(),
        description: goal.description || '',
        area: goal.area || '',
        target_date: goal.target_date || ''
      });
      markApplied(key, true);
      toast.success('Goal added');
    } catch (e) {
      console.error(e);
      toast.error('Failed to add goal');
    } finally {
      markApplying(key, false);
    }
  };

  const handleAddBelief = async (belief, idx) => {
    const key = `belief-${idx}`;
    markApplying(key, true);
    try {
      await beliefsAPI.create({
        current_belief: belief.current_belief || '',
        desired_belief: belief.desired_belief || '',
        change_plan: belief.change_plan || ''
      });
      markApplied(key, true);
      toast.success('Belief added');
    } catch (e) {
      console.error(e);
      toast.error('Failed to add belief');
    } finally {
      markApplying(key, false);
    }
  };

  const handleAddTrigger = async (trigger, idx) => {
    const key = `trigger-${idx}`;
    markApplying(key, true);
    try {
      await triggersAPI.create({
        title: trigger.title || '',
        category: trigger.category || '',
        intensity: trigger.intensity ?? null,
        notes: trigger.notes || ''
      });
      markApplied(key, true);
      toast.success('Trigger added');
    } catch (e) {
      console.error(e);
      toast.error('Failed to add trigger');
    } finally {
      markApplying(key, false);
    }
  };

  const mergeUnique = (existing, additions) => {
    const base = Array.isArray(existing) ? existing : [];
    const incoming = Array.isArray(additions) ? additions : [];
    const seen = new Set(base.map((v) => String(v).toLowerCase()));
    const merged = [...base];
    incoming.forEach((item) => {
      const trimmed = (item || '').toString().trim();
      if (!trimmed) return;
      const key = trimmed.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(trimmed);
      }
    });
    return merged;
  };

  const handleApplyIdentity = async () => {
    const key = 'identity';
    markApplying(key, true);
    try {
      const res = await identityAPI.get();
      const existing = res.data.identity || { vision: '', values: [], principles: [], traits: [], vision_points: [] };
      const next = {
        vision: existing.vision || '',
        values: mergeUnique(existing.values || [], insights.identity?.values || []),
        principles: mergeUnique(existing.principles || [], insights.identity?.principles || []),
        traits: mergeUnique(existing.traits || [], insights.identity?.traits || []),
        vision_points: mergeUnique(existing.vision_points || [], insights.identity?.vision_points || [])
      };
      await identityAPI.save(next);
      markApplied(key, true);
      toast.success('Identity updated');
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.error || 'Failed to update identity');
    } finally {
      markApplying(key, false);
    }
  };

  if (!isOpen) return null;

  const hasAny =
    (insights.goals || []).length ||
    (insights.beliefs || []).length ||
    (insights.triggers || []).length ||
    ((insights.identity?.values || []).length ||
      (insights.identity?.principles || []).length ||
      (insights.identity?.vision_points || []).length ||
      (insights.identity?.traits || []).length);

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div className="flex items-center">
            <Brain className="w-6 h-6 mr-3 text-primary-500" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Journal Insights</h2>
              <p className="text-gray-600 text-sm">
                AI found goals, beliefs, triggers, and identity notes you can add.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)] space-y-6">
          {!hasAny && (
            <div className="text-center py-8">
              <Lightbulb className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No insights detected</h3>
              <p className="text-gray-600">Try another entry with more detail.</p>
            </div>
          )}

          {(insights.goals || []).length > 0 && (
            <div className="border border-gray-200 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <Target className="w-5 h-5 text-green-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">Goals</h3>
              </div>
              <div className="space-y-3">
                {insights.goals.map((goal, idx) => {
                  const key = `goal-${idx}`;
                  return (
                    <div key={key} className="flex items-start justify-between border rounded-lg p-3">
                      <div>
                        <div className="font-medium text-gray-900">{goal.title}</div>
                        {goal.description && <div className="text-sm text-gray-600">{goal.description}</div>}
                        <div className="text-xs text-gray-500 mt-1">
                          {goal.area ? `Area: ${goal.area}` : 'Area: —'}
                          {goal.target_date ? ` • Target: ${goal.target_date}` : ''}
                        </div>
                      </div>
                      <button
                        onClick={() => handleAddGoal(goal, idx)}
                        disabled={applying[key] || applied[key]}
                        className={`flex items-center ${applied[key] ? 'bg-green-600 text-white px-3 py-1 rounded' : 'btn-primary'}`}
                      >
                        {applying[key] ? 'Adding…' : applied[key] ? 'Added ✓' : 'Add'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(insights.beliefs || []).length > 0 && (
            <div className="border border-gray-200 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <Lightbulb className="w-5 h-5 text-indigo-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">Beliefs</h3>
              </div>
              <div className="space-y-3">
                {insights.beliefs.map((belief, idx) => {
                  const key = `belief-${idx}`;
                  return (
                    <div key={key} className="border rounded-lg p-3">
                      <div className="text-sm text-gray-500">Current</div>
                      <div className="text-gray-900 mb-2">{belief.current_belief}</div>
                      <div className="text-sm text-gray-500">Desired</div>
                      <div className="text-gray-900 mb-2">{belief.desired_belief}</div>
                      {belief.change_plan && (
                        <>
                          <div className="text-sm text-gray-500">Plan</div>
                          <div className="text-gray-700 mb-2">{belief.change_plan}</div>
                        </>
                      )}
                      <div className="flex justify-end">
                        <button
                          onClick={() => handleAddBelief(belief, idx)}
                          disabled={applying[key] || applied[key]}
                          className={`flex items-center ${applied[key] ? 'bg-green-600 text-white px-3 py-1 rounded' : 'btn-primary'}`}
                        >
                          {applying[key] ? 'Adding…' : applied[key] ? 'Added ✓' : 'Add'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(insights.triggers || []).length > 0 && (
            <div className="border border-gray-200 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <ShieldAlert className="w-5 h-5 text-rose-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">Anxiety Triggers</h3>
              </div>
              <div className="space-y-3">
                {insights.triggers.map((trigger, idx) => {
                  const key = `trigger-${idx}`;
                  return (
                    <div key={key} className="flex items-start justify-between border rounded-lg p-3">
                      <div>
                        <div className="font-medium text-gray-900">{trigger.title}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {trigger.category ? `Category: ${trigger.category}` : 'Category: —'}
                          {trigger.intensity ? ` • Intensity: ${trigger.intensity}/10` : ''}
                        </div>
                        {trigger.notes && <div className="text-sm text-gray-600 mt-1">{trigger.notes}</div>}
                      </div>
                      <button
                        onClick={() => handleAddTrigger(trigger, idx)}
                        disabled={applying[key] || applied[key]}
                        className={`flex items-center ${applied[key] ? 'bg-green-600 text-white px-3 py-1 rounded' : 'btn-primary'}`}
                      >
                        {applying[key] ? 'Adding…' : applied[key] ? 'Added ✓' : 'Add'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {((insights.identity?.values || []).length ||
            (insights.identity?.principles || []).length ||
            (insights.identity?.vision_points || []).length ||
            (insights.identity?.traits || []).length) > 0 && (
            <div className="border border-gray-200 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <Brain className="w-5 h-5 text-blue-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">Identity</h3>
              </div>
              <div className="space-y-3 text-sm text-gray-700">
                {(insights.identity?.values || []).length > 0 && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Values</div>
                    <div className="flex flex-wrap gap-2">
                      {insights.identity.values.map((v, i) => (
                        <span key={`val-${i}`} className="px-2 py-1 bg-rose-100 text-rose-800 rounded-full text-xs">
                          {v}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {(insights.identity?.principles || []).length > 0 && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Principles</div>
                    <div className="flex flex-wrap gap-2">
                      {insights.identity.principles.map((p, i) => (
                        <span key={`pr-${i}`} className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {(insights.identity?.traits || []).length > 0 && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Personality</div>
                    <div className="flex flex-wrap gap-2">
                      {insights.identity.traits.map((t, i) => (
                        <span key={`tr-${i}`} className="px-2 py-1 bg-amber-100 text-amber-800 rounded-full text-xs">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {(insights.identity?.vision_points || []).length > 0 && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Vision Points</div>
                    <ul className="list-disc pl-5 space-y-1">
                      {insights.identity.vision_points.map((v, i) => (
                        <li key={`vp-${i}`}>{v}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleApplyIdentity}
                  disabled={applying.identity || applied.identity}
                  className={`flex items-center ${applied.identity ? 'bg-green-600 text-white px-3 py-1 rounded' : 'btn-primary'}`}
                >
                  {applying.identity ? 'Applying…' : applied.identity ? 'Applied ✓' : 'Add to Identity'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {Object.keys(applied).length > 0 && (
              <span className="text-green-600">✓ {Object.keys(applied).length} item(s) applied</span>
            )}
          </div>
          <div className="flex space-x-3">
            <button onClick={onClose} className="btn-secondary">
              Close
            </button>
            {Object.keys(applied).length > 0 && (
              <button
                onClick={() => {
                  onApplied && onApplied();
                  onClose();
                }}
                className="btn-primary"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default JournalInsightsModal;
