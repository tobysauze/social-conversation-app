import React, { useEffect, useState, useCallback } from 'react';
import { memoryAPI } from '../services/api';
import { Database, RefreshCw, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

const SOURCE_LABELS = {
  journal: 'Journal entries',
  dream: 'Dreams',
  trigger: 'Anxiety triggers',
  belief: 'Beliefs',
  protocol: 'Protocols',
  goal: 'Goals',
  person: 'People',
  story: 'Stories',
  identity: 'Identity / vision'
};

const Memory = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reindexing, setReindexing] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [error, setError] = useState(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await memoryAPI.getStats();
      setStats(res.data);
      setError(null);
    } catch (e) {
      console.error(e);
      setError(e.response?.data?.error || 'Failed to load memory stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleReindex = async () => {
    if (reindexing) return;
    setReindexing(true);
    setLastResult(null);
    setError(null);
    try {
      const res = await memoryAPI.reindex();
      setLastResult(res.data);
      setStats(res.data.stats || stats);
      toast.success('Memory reindexed');
    } catch (e) {
      console.error(e);
      const msg = e.response?.data?.error || 'Reindex failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setReindexing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-indigo-500">
            <Database className="w-5 h-5" />
            <span className="text-xs uppercase tracking-wide font-semibold">Memory</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">Personal memory bank</h1>
          <p className="text-sm text-gray-600 mt-1">
            Embeddings of your journal, dreams, beliefs, triggers, goals, people and identity work.
            The AI Chat uses these to ground its replies in your actual data.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="card animate-pulse h-32"></div>
      ) : (
        <>
          {stats && stats.available === false && (
            <div className="card border border-amber-200 bg-amber-50 text-amber-800 mb-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">pgvector is not enabled on your database.</p>
                  <p className="mt-1">
                    Run <code className="bg-amber-100 px-1 rounded">CREATE EXTENSION vector;</code> on your
                    Postgres instance, then click Reindex. On Render and Supabase, pgvector is supported
                    but may need to be enabled in the dashboard.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="card mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700">What's stored</h2>
              <span className="text-sm text-gray-500">
                {stats?.total ?? 0} item{stats?.total === 1 ? '' : 's'}
              </span>
            </div>
            {stats?.total > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(stats.bySourceType).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg text-sm">
                    <span className="text-gray-700">{SOURCE_LABELS[type] || type}</span>
                    <span className="font-semibold text-gray-900">{count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No memories indexed yet. Click Reindex to embed your data.</p>
            )}
          </div>

          {/* Action */}
          <div className="card mb-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-sm font-medium text-gray-900">Rebuild memory index</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Walks every source table and (re-)embeds each row. Idempotent.
                </p>
              </div>
              <button
                onClick={handleReindex}
                disabled={reindexing}
                className="btn-primary inline-flex items-center"
              >
                {reindexing ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-1.5" />
                )}
                {reindexing ? 'Reindexing…' : 'Reindex'}
              </button>
            </div>
          </div>

          {error && (
            <div className="card border border-red-200 bg-red-50 text-red-800 mb-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div className="text-sm">{error}</div>
              </div>
            </div>
          )}

          {lastResult && (
            <div className="card mb-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <h2 className="text-sm font-semibold text-gray-700">Last reindex</h2>
              </div>
              <div className="space-y-1 text-sm text-gray-700">
                {Object.entries(lastResult.counts || {}).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span>{SOURCE_LABELS[type] || type}</span>
                    <span className="text-gray-500">{count} embedded</span>
                  </div>
                ))}
              </div>
              {Array.isArray(lastResult.errors) && lastResult.errors.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-amber-700">
                  {lastResult.errors.length} item(s) failed — first error:{' '}
                  <code>{lastResult.errors[0].error}</code>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Memory;
