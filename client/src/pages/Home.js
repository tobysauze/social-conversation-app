import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { dayplanAPI } from '../services/api';
import {
  Clock,
  Plus,
  Trash2,
  Check,
  Edit3,
  Save,
  RotateCcw,
  ChevronDown,
  Settings,
  X,
  Timer,
  Target,
  Zap,
  Repeat,
  MapPin
} from 'lucide-react';
import toast from 'react-hot-toast';

function formatTime12h(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function formatMinutes(mins) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const Home = () => {
  const { user } = useAuth();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [editingStartTime, setEditingStartTime] = useState(false);
  const [startTimeInput, setStartTimeInput] = useState('');
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemMinutes, setNewItemMinutes] = useState(30);
  const [newItemRecurring, setNewItemRecurring] = useState(false);
  const [newItemStartAt, setNewItemStartAt] = useState('');
  const [showTemplateSettings, setShowTemplateSettings] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadPlan = useCallback(async () => {
    try {
      const response = await dayplanAPI.getPlan();
      setPlan(response.data.plan);
    } catch (error) {
      console.error('Error loading day plan:', error);
      toast.error('Failed to load day plan');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  const handleUpdateStartTime = async () => {
    if (!startTimeInput) return;
    setSaving(true);
    try {
      await dayplanAPI.updateStartTime(startTimeInput);
      await loadPlan();
      setEditingStartTime(false);
      toast.success('Start time updated');
    } catch {
      toast.error('Failed to update start time');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleComplete = async (item) => {
    try {
      const newCompleted = !item.completed;
      const data = { completed: newCompleted };
      if (newCompleted && item.actual_minutes === null) {
        data.actual_minutes = item.planned_minutes;
      }
      await dayplanAPI.updateItem(item.id, data);
      await loadPlan();
    } catch {
      toast.error('Failed to update item');
    }
  };

  const handleStartEditing = (item) => {
    setEditingItemId(item.id);
    setEditValues({
      title: item.title,
      planned_minutes: item.planned_minutes,
      actual_minutes: item.actual_minutes ?? '',
      start_at: item.start_at || ''
    });
  };

  const handleSaveItem = async (itemId) => {
    setSaving(true);
    try {
      const data = {
        title: editValues.title,
        planned_minutes: Number(editValues.planned_minutes),
        start_at: editValues.start_at || null
      };
      if (editValues.actual_minutes !== '') {
        data.actual_minutes = Number(editValues.actual_minutes);
      }
      await dayplanAPI.updateItem(itemId, data);
      await loadPlan();
      setEditingItemId(null);
      toast.success('Item updated');
    } catch {
      toast.error('Failed to update item');
    } finally {
      setSaving(false);
    }
  };

  const handleAddItem = async () => {
    if (!newItemTitle.trim()) return;
    setSaving(true);
    try {
      await dayplanAPI.addItem({
        title: newItemTitle.trim(),
        planned_minutes: Number(newItemMinutes),
        is_recurring: newItemRecurring,
        start_at: newItemStartAt || null
      });
      await loadPlan();
      setNewItemTitle('');
      setNewItemMinutes(30);
      setNewItemRecurring(false);
      setNewItemStartAt('');
      setShowAddItem(false);
      toast.success(newItemRecurring ? 'Daily item added' : 'Item added');
    } catch {
      toast.error('Failed to add item');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleRecurring = async (item) => {
    try {
      const newRecurring = !item.is_recurring;
      await dayplanAPI.updateItem(item.id, { is_recurring: newRecurring });
      await loadPlan();
      toast.success(newRecurring ? 'Now repeats daily' : 'No longer repeats daily');
    } catch {
      toast.error('Failed to update');
    }
  };

  const handleDeleteItem = async (itemId) => {
    try {
      await dayplanAPI.deleteItem(itemId);
      await loadPlan();
      toast.success('Item removed');
    } catch {
      toast.error('Failed to remove item');
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!plan) return;
    setSaving(true);
    try {
      await dayplanAPI.updateTemplate({
        default_start_time: plan.start_time,
        items: plan.items.map((item, idx) => ({
          title: item.title,
          default_minutes: item.planned_minutes,
          start_at: item.start_at || null,
          sort_order: idx
        }))
      });
      toast.success('Saved as default template');
      setShowTemplateSettings(false);
    } catch {
      toast.error('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleResetToTemplate = async () => {
    setSaving(true);
    try {
      const tmplRes = await dayplanAPI.getTemplate();
      const tmpl = tmplRes.data.template;
      await dayplanAPI.updateStartTime(tmpl.default_start_time);
      for (const item of plan.items) {
        await dayplanAPI.deleteItem(item.id);
      }
      for (const item of tmpl.items) {
        await dayplanAPI.addItem({
          title: item.title,
          planned_minutes: item.default_minutes,
          start_at: item.start_at || null
        });
      }
      await loadPlan();
      toast.success('Reset to template');
      setShowTemplateSettings(false);
    } catch {
      toast.error('Failed to reset');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="h-16 bg-gray-200 rounded mb-4"></div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 bg-gray-200 rounded mb-3"></div>
          ))}
        </div>
      </div>
    );
  }

  const items = plan?.items || [];
  const totalPlanned = plan?.total_planned_minutes || 0;
  const totalActual = plan?.total_actual_minutes || 0;
  const completedCount = plan?.completed_count || 0;
  const totalCount = plan?.total_count || 0;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const currentTimeStr = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
  let activeIndex = -1;
  for (let i = 0; i < items.length; i++) {
    if (!items[i].completed && items[i].scheduled_time <= currentTimeStr) {
      activeIndex = i;
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Day Plan</h1>
          <p className="text-sm text-gray-500 mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button
          onClick={() => setShowTemplateSettings(!showTemplateSettings)}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          title="Template settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Template Settings Dropdown */}
      {showTemplateSettings && (
        <div className="card mb-4 border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Template Settings</h3>
          <div className="flex gap-3">
            <button
              onClick={handleSaveAsTemplate}
              disabled={saving}
              className="btn-primary text-sm flex items-center gap-1"
            >
              <Save className="w-4 h-4" />
              Save current as default
            </button>
            <button
              onClick={handleResetToTemplate}
              disabled={saving}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1"
            >
              <RotateCcw className="w-4 h-4" />
              Reset to default
            </button>
          </div>
        </div>
      )}

      {/* Progress & Summary */}
      <div className="card mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-sm text-gray-600">
              <Target className="w-4 h-4 text-indigo-500" />
              <span><strong>{completedCount}</strong>/{totalCount} done</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-gray-600">
              <Timer className="w-4 h-4 text-green-500" />
              <span>{formatMinutes(totalPlanned)} planned</span>
            </div>
            {totalActual > 0 && (
              <div className="flex items-center gap-1.5 text-sm text-gray-600">
                <Zap className="w-4 h-4 text-amber-500" />
                <span>{formatMinutes(totalActual)} actual</span>
              </div>
            )}
          </div>
          <span className="text-sm font-semibold text-indigo-600">{progress}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      {/* Start Time */}
      <div className="card mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-500" />
            <span className="text-sm font-medium text-gray-700">Day starts at</span>
          </div>
          {editingStartTime ? (
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={startTimeInput}
                onChange={(e) => setStartTimeInput(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <button
                onClick={handleUpdateStartTime}
                disabled={saving}
                className="p-1.5 text-green-600 hover:bg-green-50 rounded"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => setEditingStartTime(false)}
                className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setEditingStartTime(true); setStartTimeInput(plan?.start_time || '08:00'); }}
              className="text-lg font-semibold text-gray-900 hover:text-indigo-600 transition-colors cursor-pointer"
            >
              {plan ? formatTime12h(plan.start_time) : '8:00 AM'}
            </button>
          )}
        </div>
      </div>

      {/* Items List */}
      <div className="space-y-2 mb-4">
        {items.map((item, idx) => {
          const isEditing = editingItemId === item.id;
          const isActive = idx === activeIndex;
          const timeDiff = item.actual_minutes !== null && item.actual_minutes !== undefined
            ? item.actual_minutes - item.planned_minutes
            : null;

          return (
            <div
              key={item.id}
              className={`card transition-all duration-200 ${
                item.completed
                  ? 'bg-gray-50 border-gray-200'
                  : isActive
                    ? 'border-indigo-300 bg-indigo-50 shadow-sm ring-1 ring-indigo-200'
                    : 'border-gray-200'
              }`}
            >
              {isEditing ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editValues.title}
                    onChange={(e) => setEditValues({ ...editValues, title: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                    placeholder="Item title"
                  />
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-xs text-gray-500 block mb-1">Planned (min)</label>
                      <input
                        type="number"
                        value={editValues.planned_minutes}
                        onChange={(e) => setEditValues({ ...editValues, planned_minutes: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500"
                        min="1"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-gray-500 block mb-1">Actual (min)</label>
                      <input
                        type="number"
                        value={editValues.actual_minutes}
                        onChange={(e) => setEditValues({ ...editValues, actual_minutes: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500"
                        placeholder="—"
                        min="0"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-gray-500 block mb-1">Start at</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="time"
                          value={editValues.start_at}
                          onChange={(e) => setEditValues({ ...editValues, start_at: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500"
                        />
                        {editValues.start_at && (
                          <button
                            type="button"
                            onClick={() => setEditValues({ ...editValues, start_at: '' })}
                            className="p-1 text-gray-400 hover:text-red-500"
                            title="Remove fixed time"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setEditingItemId(null)}
                      className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSaveItem(item.id)}
                      disabled={saving}
                      className="btn-primary text-sm flex items-center gap-1"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  {/* Checkbox */}
                  <button
                    onClick={() => handleToggleComplete(item)}
                    className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                      item.completed
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'border-gray-300 hover:border-indigo-400'
                    }`}
                  >
                    {item.completed && <Check className="w-3.5 h-3.5" />}
                  </button>

                  {/* Time indicator */}
                  <div className="flex-shrink-0 w-20 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {item.start_at && (
                        <MapPin className="w-3 h-3 text-amber-500" title="Fixed time" />
                      )}
                      <span className={`text-sm font-mono ${
                        item.completed ? 'text-gray-400' : isActive ? 'text-indigo-700 font-semibold' : 'text-gray-600'
                      }`}>
                        {formatTime12h(item.scheduled_time)}
                      </span>
                    </div>
                  </div>

                  {/* Title & duration */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className={`text-sm font-medium truncate ${
                        item.completed ? 'text-gray-400 line-through' : 'text-gray-900'
                      }`}>
                        {item.title}
                      </p>
                      {item.is_recurring && (
                        <Repeat className="w-3 h-3 text-indigo-400 flex-shrink-0" title="Repeats daily" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">
                        {formatMinutes(item.planned_minutes)}
                      </span>
                      {item.actual_minutes !== null && item.actual_minutes !== undefined && (
                        <>
                          <span className="text-xs text-gray-300">&rarr;</span>
                          <span className={`text-xs font-medium ${
                            timeDiff > 0 ? 'text-red-500' : timeDiff < 0 ? 'text-green-500' : 'text-gray-500'
                          }`}>
                            {formatMinutes(item.actual_minutes)}
                            {timeDiff !== 0 && (
                              <span className="ml-1">
                                ({timeDiff > 0 ? '+' : ''}{timeDiff}m)
                              </span>
                            )}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleToggleRecurring(item)}
                      className={`p-1.5 rounded transition-colors ${
                        item.is_recurring
                          ? 'text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50'
                          : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50'
                      }`}
                      title={item.is_recurring ? 'Repeats daily (click to make one-time)' : 'One-time (click to repeat daily)'}
                    >
                      <Repeat className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleStartEditing(item)}
                      className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                      title="Edit"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* End Time */}
      {items.length > 0 && plan?.end_time_display && (
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-4">
          <ChevronDown className="w-4 h-4" />
          <span>Day ends at <strong className="text-gray-700">{plan.end_time_display}</strong></span>
        </div>
      )}

      {/* Add Item */}
      {showAddItem ? (
        <div className="card border border-dashed border-indigo-300 bg-indigo-50/50">
          <div className="space-y-3">
            <input
              type="text"
              value={newItemTitle}
              onChange={(e) => setNewItemTitle(e.target.value)}
              placeholder="What do you need to do?"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
            />
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">Duration:</label>
                <input
                  type="number"
                  value={newItemMinutes}
                  onChange={(e) => setNewItemMinutes(e.target.value)}
                  className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
                  min="1"
                />
                <span className="text-xs text-gray-400">min</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">Start at:</label>
                <input
                  type="time"
                  value={newItemStartAt}
                  onChange={(e) => setNewItemStartAt(e.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
                />
                {newItemStartAt && (
                  <button
                    type="button"
                    onClick={() => setNewItemStartAt('')}
                    className="p-1 text-gray-400 hover:text-red-500"
                    title="Remove fixed time"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setNewItemRecurring(!newItemRecurring)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  newItemRecurring
                    ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                    : 'bg-white border-gray-300 text-gray-500 hover:border-indigo-300'
                }`}
              >
                <Repeat className="w-3.5 h-3.5" />
                {newItemRecurring ? 'Daily' : 'One-time'}
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-xs space-y-0.5">
                {newItemStartAt && (
                  <p className="text-amber-600">Pinned to {formatTime12h(newItemStartAt)}</p>
                )}
                {newItemRecurring && (
                  <p className="text-indigo-600">Repeats every day</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowAddItem(false); setNewItemTitle(''); setNewItemMinutes(30); setNewItemRecurring(false); setNewItemStartAt(''); }}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddItem}
                  disabled={saving || !newItemTitle.trim()}
                  className="btn-primary text-sm"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAddItem(true)}
          className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors flex items-center justify-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" />
          Add item
        </button>
      )}
    </div>
  );
};

export default Home;
