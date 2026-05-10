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
  RefreshCw,
  Heart,
  Trash2,
  Wand2
} from 'lucide-react';
import toast from 'react-hot-toast';

const TABS = [
  { key: 'name_riff',  label: 'Name Riff',  icon: UserIcon,  color: 'text-amber-500',   hint: 'Pop-culture spins on a name (Mel → "Mel Mel Cool J")' },
  { key: 'band_name',  label: 'Band Names', icon: Music,     color: 'text-pink-500',    hint: 'Outrageous band names with a genre tag' },
  { key: 'two_truths', label: 'Two Truths', icon: Lightbulb, color: 'text-indigo-500',  hint: 'Two truths and a lie about a person or topic' }
];

const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success('Copied');
  } catch (_) {
    toast.error('Copy failed');
  }
};

// Build a canonical comparable string for each game-item shape so we can match
// generated items against saved ones (and dedupe across regenerations).
function itemKey(game, item) {
  if (!item) return '';
  if (game === 'name_riff') return (item.riff || '').trim().toLowerCase();
  if (game === 'band_name') return (item.name || '').trim().toLowerCase();
  if (game === 'two_truths') {
    return JSON.stringify((item.statements || []).map((s) => (s || '').trim().toLowerCase()));
  }
  return '';
}

// Build the (content, metadata) we'll persist per game.
function persistShape(game, item, ctx) {
  if (game === 'name_riff') {
    return {
      content: item.riff,
      metadata: { name: ctx.name || null, explanation: item.explanation || null }
    };
  }
  if (game === 'band_name') {
    return {
      content: item.name,
      metadata: { genre: item.genre || null, theme: ctx.theme || null }
    };
  }
  if (game === 'two_truths') {
    return {
      content: JSON.stringify(item.statements || []),
      metadata: { subject: ctx.subject || null, lie_index: item.lie_index ?? 0 }
    };
  }
  return null;
}

const Games = () => {
  const [tab, setTab] = useState('name_riff');
  const [input, setInput] = useState('');
  const [personId, setPersonId] = useState('');
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [revealLie, setRevealLie] = useState(false);
  const [saved, setSaved] = useState([]);
  const [savingKey, setSavingKey] = useState(null);
  const [direction, setDirection] = useState('');

  useEffect(() => {
    peopleAPI.getPeople().then((res) => setPeople(res.data.people || [])).catch(() => {});
  }, []);

  const loadSaved = useCallback(async (game) => {
    try {
      const res = await gamesAPI.listSaved(game);
      setSaved(res.data.saved || []);
    } catch (e) {
      console.error('Saved load failed:', e);
    }
  }, []);

  // Reset transient state and reload saved list whenever the tab changes.
  useEffect(() => {
    setResult(null);
    setRevealLie(false);
    setDirection('');
    loadSaved(tab);
  }, [tab, loadSaved]);

  const showPersonPicker = tab === 'name_riff' || tab === 'two_truths';
  const inputPlaceholder = {
    name_riff:  'Type a name (or pick from People below)',
    band_name:  'Optional vibe or theme — leave blank for chaos',
    two_truths: 'Subject (a person, place, hobby, anything)'
  }[tab];

  // Build the array of "previous" items the model should avoid repeating, so
  // a refine call doesn't just regenerate the same list.
  const buildPrevious = () => {
    if (!result) return [];
    if (tab === 'name_riff') return (result.riffs || []).map((r) => r.riff);
    if (tab === 'band_name') return (result.names || []).map((n) => n.name);
    if (tab === 'two_truths') return (result.statements || []);
    return [];
  };

  const performGenerate = async ({ withRefinement = false } = {}) => {
    if (loading) return;

    const usingPerson = (tab === 'name_riff' || tab === 'two_truths') && personId;
    if (!usingPerson && !input.trim() && tab !== 'band_name') {
      toast.error(tab === 'name_riff' ? 'Type a name or pick a person' : 'Type a subject');
      return;
    }

    setLoading(true);
    if (!withRefinement) {
      setResult(null);
      setRevealLie(false);
    }
    try {
      const res = await gamesAPI.generate({
        game: tab,
        input: input.trim(),
        personId: usingPerson ? Number(personId) : null,
        previous: withRefinement ? buildPrevious() : [],
        direction: withRefinement ? direction.trim() : ''
      });
      setResult(res.data);
      setRevealLie(false);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = (e) => {
    e?.preventDefault?.();
    performGenerate({ withRefinement: false });
  };

  const handleRefine = (e) => {
    e?.preventDefault?.();
    if (!direction.trim() && (!result || !buildPrevious().length)) {
      toast.error('Type a direction first, e.g. "lean into 90s rappers"');
      return;
    }
    performGenerate({ withRefinement: true });
  };

  const handleMore = () => {
    // "More" button when there's no direction text — same as refine, just
    // anti-repeat without explicit instruction.
    performGenerate({ withRefinement: true });
  };

  // Saved-set membership keyed by canonical content. For name_riff and band_name
  // that's a lowercased string; for two_truths it's the JSON-encoded statement
  // array — which is also exactly what we persist as `content`.
  const savedKeys = new Set(saved.map((s) => (s.content || '').trim().toLowerCase()));
  const matchKey = (k) => savedKeys.has((k || '').trim().toLowerCase());
  const findSaved = (k) => saved.find((s) => (s.content || '').trim().toLowerCase() === (k || '').trim().toLowerCase());

  const handleToggleSave = async (item, ctxOverride = null) => {
    const ctx = ctxOverride || (
      tab === 'name_riff' ? { name: result?.name } :
      tab === 'band_name' ? { theme: result?.theme } :
      tab === 'two_truths' ? { subject: result?.subject } : {}
    );
    const shape = persistShape(tab, item, ctx);
    if (!shape) return;

    const key = (shape.content || '').trim().toLowerCase();
    const existing = findSaved(key);
    if (existing) {
      // Already saved — unsave.
      try {
        setSavingKey(key);
        await gamesAPI.deleteSaved(existing.id);
        setSaved((prev) => prev.filter((s) => s.id !== existing.id));
      } catch (e) {
        console.error(e);
        toast.error('Failed to remove');
      } finally {
        setSavingKey(null);
      }
      return;
    }

    try {
      setSavingKey(key);
      const res = await gamesAPI.save({ game: tab, content: shape.content, metadata: shape.metadata });
      setSaved((prev) => [res.data, ...prev]);
      toast.success('Saved');
    } catch (e) {
      console.error(e);
      toast.error('Failed to save');
    } finally {
      setSavingKey(null);
    }
  };

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

      {/* Saved section (collapsed by default if empty) */}
      {saved.length > 0 && (
        <div className="card mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
              <h2 className="text-sm font-semibold text-gray-700">
                Saved {TABS.find((t) => t.key === tab)?.label.toLowerCase()}
                <span className="ml-1 text-gray-400">({saved.length})</span>
              </h2>
            </div>
          </div>
          <ul className="space-y-1.5">
            {saved.map((s) => (
              <li key={s.id} className="flex items-start justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 group">
                <div className="min-w-0">
                  {tab === 'two_truths' ? (() => {
                    let stmts = [];
                    try { stmts = JSON.parse(s.content || '[]'); } catch (_) {}
                    return (
                      <div className="text-sm text-gray-800">
                        {stmts.map((st, i) => (
                          <div key={i} className={i === (s.metadata?.lie_index ?? -1) ? 'text-red-700' : ''}>
                            <span className="text-gray-400 mr-1">{i + 1}.</span>{st}
                          </div>
                        ))}
                        {s.metadata?.subject && (
                          <div className="text-xs text-gray-500 mt-0.5">about {s.metadata.subject}</div>
                        )}
                      </div>
                    );
                  })() : (
                    <div>
                      <p className="text-sm font-semibold text-gray-900 truncate">{s.content}</p>
                      {(s.metadata?.explanation || s.metadata?.genre) && (
                        <p className="text-xs text-gray-500 truncate">{s.metadata.explanation || s.metadata.genre}</p>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {tab !== 'two_truths' && (
                    <button onClick={() => copyText(s.content)} className="p-1 text-gray-400 hover:text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity" title="Copy">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      try {
                        await gamesAPI.deleteSaved(s.id);
                        setSaved((prev) => prev.filter((x) => x.id !== s.id));
                      } catch (_) { toast.error('Failed to remove'); }
                    }}
                    className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

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

      {/* Results */}
      {result && tab === 'name_riff' && Array.isArray(result.riffs) && (
        <ResultsList
          title={`Riffs on "${result.name}"`}
          tone="amber"
          items={result.riffs.map((r) => ({
            primary: r.riff,
            secondary: r.explanation,
            key: itemKey('name_riff', r),
            raw: r
          }))}
          onSave={(item) => handleToggleSave(item.raw, { name: result.name })}
          onCopy={(item) => copyText(item.primary)}
          isSaved={(item) => matchKey(item.key)}
          savingKey={savingKey}
          onMore={handleMore}
          loading={loading}
        />
      )}

      {result && tab === 'band_name' && Array.isArray(result.names) && (
        <ResultsList
          title={result.theme ? `Bands inspired by "${result.theme}"` : 'Fresh band names'}
          tone="pink"
          items={result.names.map((b) => ({
            primary: b.name,
            secondary: b.genre,
            key: itemKey('band_name', b),
            raw: b
          }))}
          onSave={(item) => handleToggleSave(item.raw, { theme: result.theme })}
          onCopy={(item) => copyText(item.primary)}
          isSaved={(item) => matchKey(item.key)}
          savingKey={savingKey}
          onMore={handleMore}
          loading={loading}
        />
      )}

      {result && tab === 'two_truths' && Array.isArray(result.statements) && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">About "{result.subject}"</h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleToggleSave(result, { subject: result.subject })}
                disabled={savingKey != null}
                className={`p-1.5 rounded-md transition-colors ${
                  matchKey(itemKey('two_truths', result))
                    ? 'text-rose-500 hover:bg-rose-50'
                    : 'text-gray-400 hover:text-rose-500 hover:bg-rose-50'
                }`}
                title={matchKey(itemKey('two_truths', result)) ? 'Remove from saved' : 'Save'}
              >
                <Heart className={`w-4 h-4 ${matchKey(itemKey('two_truths', result)) ? 'fill-current' : ''}`} />
              </button>
              <button type="button" onClick={handleMore} disabled={loading} className="text-xs text-gray-500 hover:text-gray-700 inline-flex items-center px-1.5">
                <RefreshCw className="w-3 h-3 mr-1" /> Another
              </button>
            </div>
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

      {/* Refine direction */}
      {result && (
        <form onSubmit={handleRefine} className="card mt-4">
          <label className="flex items-center gap-2 mb-2 text-sm font-semibold text-gray-700">
            <Wand2 className="w-4 h-4 text-purple-500" />
            Take it further
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Type a direction and tap Refine — the model will avoid repeating what's above and lean into your instruction.
          </p>
          <textarea
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
            rows={2}
            placeholder='e.g. "more 90s hip-hop", "make them weirder and more specific", "less puns, more absurdist"'
            className="input-field w-full mb-3"
          />
          <button type="submit" disabled={loading} className="btn-secondary inline-flex items-center">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
            Refine
          </button>
        </form>
      )}
    </div>
  );
};

// Reusable list block for name_riff and band_name (two_truths is unique enough
// to render inline in the parent component).
const ResultsList = ({ title, tone, items, onSave, onCopy, isSaved, savingKey, onMore, loading }) => {
  const toneClasses = tone === 'amber'
    ? 'bg-amber-50 border-amber-100'
    : 'bg-pink-50 border-pink-100';

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
        <button type="button" onClick={onMore} disabled={loading} className="text-xs text-gray-500 hover:text-gray-700 inline-flex items-center">
          <RefreshCw className="w-3 h-3 mr-1" /> More
        </button>
      </div>
      <ul className="space-y-2">
        {items.map((item, i) => {
          const saved = isSaved(item);
          const busy = savingKey === item.key;
          return (
            <li key={i} className={`flex items-start justify-between gap-2 px-3 py-2 border rounded-lg ${toneClasses}`}>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">{item.primary}</p>
                {item.secondary && <p className="text-xs text-gray-600 mt-0.5">{item.secondary}</p>}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => onSave(item)}
                  disabled={busy}
                  className={`p-1 rounded-md transition-colors ${
                    saved ? 'text-rose-500 hover:bg-white' : 'text-gray-400 hover:text-rose-500 hover:bg-white'
                  }`}
                  title={saved ? 'Remove from saved' : 'Save'}
                >
                  {busy ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Heart className={`w-4 h-4 ${saved ? 'fill-current' : ''}`} />
                  )}
                </button>
                <button type="button" onClick={() => onCopy(item)} className="p-1 text-gray-400 hover:text-gray-700" title="Copy">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default Games;
