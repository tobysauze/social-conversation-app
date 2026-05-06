import React, { useEffect, useState, useCallback } from 'react';
import { briefingAPI } from '../services/api';
import {
  Sun,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Users,
  Target as TargetIcon,
  ListChecks,
  TrendingUp,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const toneClass = (tone) => {
  switch (tone) {
    case 'positive': return 'border-green-200 bg-green-50 text-green-800';
    case 'warning':  return 'border-amber-200 bg-amber-50 text-amber-800';
    default:         return 'border-gray-200 bg-gray-50 text-gray-800';
  }
};

const toneIcon = (tone) => {
  if (tone === 'positive') return <CheckCircle2 className="w-4 h-4 text-green-600" />;
  if (tone === 'warning')  return <AlertTriangle className="w-4 h-4 text-amber-600" />;
  return <Sparkles className="w-4 h-4 text-gray-500" />;
};

const Briefing = () => {
  const [briefing, setBriefing] = useState(null);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (regenerate = false) => {
    if (regenerate) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const res = await briefingAPI.getToday(regenerate);
      setBriefing(res.data.briefing || null);
      setGeneratedAt(res.data.generatedAt || null);
    } catch (e) {
      console.error('Failed to load briefing:', e);
      setError(e.response?.data?.error || 'Failed to load briefing');
      if (regenerate) toast.error('Failed to regenerate briefing');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  const handleRegenerate = () => {
    if (refreshing) return;
    load(true);
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-32 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 bg-gray-200 rounded"></div>)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-indigo-500">
            <Sun className="w-5 h-5" />
            <span className="text-xs uppercase tracking-wide font-semibold">Daily Briefing</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </h1>
          {generatedAt && (
            <p className="text-xs text-gray-500 mt-1">
              Generated {format(new Date(generatedAt), 'p')}
            </p>
          )}
        </div>
        <button
          onClick={handleRegenerate}
          disabled={refreshing}
          className="inline-flex items-center px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          title="Rebuild briefing from latest data"
        >
          {refreshing ? (
            <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-1.5" />
          )}
          {refreshing ? 'Refreshing' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="card border border-red-200 bg-red-50 text-red-800 mb-6">
          <p className="font-medium">Couldn't generate briefing</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {!briefing && !error && (
        <div className="card text-center py-12">
          <Sparkles className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No briefing yet for today.</p>
          <button onClick={handleRegenerate} className="btn-primary mt-4">Generate</button>
        </div>
      )}

      {briefing && (
        <>
          {/* Greeting + summary */}
          <div className="card mb-6">
            {briefing.greeting && (
              <p className="text-sm text-indigo-600 font-medium">{briefing.greeting}</p>
            )}
            {briefing.summary && (
              <p className="text-gray-900 mt-2 whitespace-pre-wrap leading-relaxed">{briefing.summary}</p>
            )}
            {briefing.today_focus && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-1">
                  <TargetIcon className="w-4 h-4 text-indigo-500" />
                  Focus for today
                </div>
                <p className="text-gray-700 text-sm whitespace-pre-wrap">{briefing.today_focus}</p>
              </div>
            )}
          </div>

          {/* Highlights */}
          {Array.isArray(briefing.highlights) && briefing.highlights.length > 0 && (
            <Section title="Highlights" icon={<TrendingUp className="w-4 h-4 text-indigo-500" />}>
              <div className="space-y-2">
                {briefing.highlights.map((h, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-sm ${toneClass(h.tone)}`}
                  >
                    <div className="flex-shrink-0 mt-0.5">{toneIcon(h.tone)}</div>
                    <div>{h.label}</div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Open threads */}
          {Array.isArray(briefing.open_threads) && briefing.open_threads.length > 0 && (
            <Section title="Open threads" icon={<ListChecks className="w-4 h-4 text-indigo-500" />}>
              <ul className="space-y-1.5 text-sm text-gray-800">
                {briefing.open_threads.map((t, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Patterns */}
          {Array.isArray(briefing.patterns) && briefing.patterns.length > 0 && (
            <Section title="Patterns" icon={<Sparkles className="w-4 h-4 text-indigo-500" />}>
              <ul className="space-y-1.5 text-sm text-gray-800">
                {briefing.patterns.map((p, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* People */}
          {Array.isArray(briefing.people_to_reconnect) && briefing.people_to_reconnect.length > 0 && (
            <Section title="People to reconnect with" icon={<Users className="w-4 h-4 text-indigo-500" />}>
              <ul className="space-y-1.5 text-sm">
                {briefing.people_to_reconnect.map((p, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>
                      <span className="font-medium text-gray-900">{p.name}</span>
                      {p.reason && <span className="text-gray-600"> — {p.reason}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </>
      )}
    </div>
  );
};

const Section = ({ title, icon, children }) => (
  <div className="card mb-4">
    <div className="flex items-center gap-2 mb-3">
      {icon}
      <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
    </div>
    {children}
  </div>
);

export default Briefing;
