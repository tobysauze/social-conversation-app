import React, { useState, useEffect, useCallback } from 'react';
import { gamesAPI, peopleAPI } from '../services/api';
import {
  Sparkles,
  Loader2,
  Music,
  User as UserIcon,
  Lightbulb,
  Eye,
  EyeOff,
  Copy,
  RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';

const TABS = [
  { key: 'name_riff', label: 'Name Riff',     icon: UserIcon, color: 'text-amber-500',  hint: 'Pop-culture spins on a name (Mel → "Mel Mel Cool J")' },
  { key: 'band_name', label: 'Band Names',    icon: Music,    color: 'text-pink-500',   hint: 'Outrageous band names with a genre tag' },
  { key: 'two_truths', label: 'Two Truths',   icon: Lightbulb, color: 'text-indigo-500', hint: 'Two truths and a lie about a person or topic' }
];

const copyText = async (text, label = 'Copied') => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(label);
  } catch (_) {
    toast.error('Copy failed');
  }
};

const Games = () => {
  const [tab, setTab] = useState('name_riff');
  const [input, setInput] = useState('');
  const [personId, setPersonId] = useState('');
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [revealLie, setRevealLie] = useState(false);

  useEffect(() => {
    peopleAPI.getPeople().then((res) => setPeople(res.data.people || [])).catch(() => {});
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setRevealLie(false);
  }, []);

  useEffect(() => { reset(); }, [tab, reset]);

  const handleGenerate = async (e) => {
    e?.preventDefault?.();
    if (loading) return;

    const usingPerson = (tab === 'name_riff' || tab === 'two_truths') && personId;
    if (!usingPerson && !input.trim() && tab !== 'band_name') {
      toast.error(tab === 'name_riff' ? 'Type a name or pick a person' : 'Type a subject');
      return;
    }

    setLoading(true);
    setResult(null);
    setRevealLie(false);
    try {
      const res = await gamesAPI.generate({
        game: tab,
        input: input.trim(),
        personId: usingPerson ? Number(personId) : null
      });
      setResult(res.data);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  const showPersonPicker = tab === 'name_riff' || tab === 'two_truths';
  const inputPlaceholder = {
    name_riff:  'Type a name (or pick from People below)',
    band_name:  'Optional vibe or theme — leave blank for chaos',
    two_truths: 'Subject (a person, place, hobby, anything)'
  }[tab];

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-2 text-pink-500 mb-1">
        <Sparkles className="w-5 h-5" />
        <span className="text-xs uppercase tracking-wide font-semibold">Word games</span>
      </div>
      <h1 className="text-2xl font-bold text-gray-900">Games</h1>
      <p className="text-sm text-gray-600 mt-1 mb-6">
        Quick conversational generators. Pull one up when you're with friends and the chat has stalled.
      </p>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-4 overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 min-w-fit flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className={`w-4 h-4 ${active ? t.color : ''}`} />
              {t.label}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-gray-500 mb-4">{TABS.find((t) => t.key === tab)?.hint}</p>

      {/* Input form */}
      <form onSubmit={handleGenerate} className="card mb-6">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={inputPlaceholder}
          className="input-field w-full mb-3"
        />

        {showPersonPicker && people.length > 0 && (
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">Or pick someone from People</label>
            <select
              value={personId}
              onChange={(e) => { setPersonId(e.target.value); setInput(''); }}
              className="input-field w-full"
            >
              <option value="">— none —</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.name}{p.relationship ? ` (${p.relationship})` : ''}</option>
              ))}
            </select>
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full inline-flex items-center justify-center">
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
          {loading ? 'Generating' : 'Generate'}
        </button>
      </form>

      {/* Result */}
      {result && tab === 'name_riff' && Array.isArray(result.riffs) && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Riffs on "{result.name}"</h2>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              className="text-xs text-gray-500 hover:text-gray-700 inline-flex items-center"
            >
              <RefreshCw className="w-3 h-3 mr-1" /> More
            </button>
          </div>
          <ul className="space-y-2">
            {result.riffs.map((r, i) => (
              <li key={i} className="flex items-start justify-between gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{r.riff}</p>
                  {r.explanation && <p className="text-xs text-gray-600 mt-0.5">{r.explanation}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => copyText(r.riff)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                  title="Copy"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result && tab === 'band_name' && Array.isArray(result.names) && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">
              {result.theme ? `Bands inspired by "${result.theme}"` : 'Fresh band names'}
            </h2>
            <button type="button" onClick={handleGenerate} disabled={loading} className="text-xs text-gray-500 hover:text-gray-700 inline-flex items-center">
              <RefreshCw className="w-3 h-3 mr-1" /> More
            </button>
          </div>
          <ul className="space-y-2">
            {result.names.map((b, i) => (
              <li key={i} className="flex items-start justify-between gap-2 px-3 py-2 bg-pink-50 border border-pink-100 rounded-lg">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{b.name}</p>
                  {b.genre && <p className="text-xs text-gray-600 mt-0.5">{b.genre}</p>}
                </div>
                <button type="button" onClick={() => copyText(b.name)} className="p-1 text-gray-400 hover:text-gray-600" title="Copy">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result && tab === 'two_truths' && Array.isArray(result.statements) && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">About "{result.subject}"</h2>
            <button type="button" onClick={handleGenerate} disabled={loading} className="text-xs text-gray-500 hover:text-gray-700 inline-flex items-center">
              <RefreshCw className="w-3 h-3 mr-1" /> Another
            </button>
          </div>
          <ol className="space-y-2 mb-4">
            {result.statements.map((s, i) => {
              const isLie = revealLie && i === result.lie_index;
              return (
                <li
                  key={i}
                  className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-sm ${
                    isLie
                      ? 'bg-red-50 border-red-200 text-red-900'
                      : revealLie
                        ? 'bg-green-50 border-green-200 text-green-900'
                        : 'bg-gray-50 border-gray-200 text-gray-900'
                  }`}
                >
                  <span className="font-semibold opacity-60">{i + 1}.</span>
                  <span className="flex-1">{s}</span>
                  {isLie && <span className="text-xs font-semibold uppercase">Lie</span>}
                  {revealLie && !isLie && <span className="text-xs font-semibold uppercase">Truth</span>}
                </li>
              );
            })}
          </ol>
          <button
            type="button"
            onClick={() => setRevealLie((v) => !v)}
            className="btn-secondary inline-flex items-center"
          >
            {revealLie ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
            {revealLie ? 'Hide answer' : 'Reveal the lie'}
          </button>
        </div>
      )}
    </div>
  );
};

export default Games;
