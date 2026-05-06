import React, { useEffect, useState, useCallback } from 'react';
import { ingestAPI } from '../services/api';
import {
  Heart,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  Smartphone,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const CopyField = ({ label, value, secret = false }) => {
  const [shown, setShown] = useState(!secret);
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copied`);
      setTimeout(() => setCopied(false), 1500);
    } catch (_) {
      toast.error('Copy failed');
    }
  };

  return (
    <div className="mb-3">
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <div className="flex items-stretch border border-gray-300 rounded-lg overflow-hidden bg-white">
        <code className="flex-1 px-3 py-2 text-sm font-mono text-gray-800 truncate">
          {!value
            ? <span className="italic text-gray-400">not set</span>
            : (shown ? value : '•'.repeat(Math.min(28, value.length)))}
        </code>
        {secret && (
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            className="px-3 border-l border-gray-300 text-gray-500 hover:bg-gray-50"
            title={shown ? 'Hide' : 'Reveal'}
          >
            {shown ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
        <button
          type="button"
          onClick={onCopy}
          disabled={!value}
          className="px-3 border-l border-gray-300 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
          title="Copy"
        >
          {copied ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};

const HealthSync = () => {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ingestAPI.getInfo();
      setInfo(res.data);
      setError(null);
    } catch (e) {
      console.error(e);
      setError(e.response?.data?.error || 'Failed to load sync info');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const sampleBody = info
    ? JSON.stringify({
        user_id: info.userId,
        event_date: '2026-05-06',
        sleep_score: 78,
        exercise_minutes: 32,
        exercise_intensity: 3
      }, null, 2)
    : '';

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-2 text-rose-500 mb-1">
        <Heart className="w-5 h-5" />
        <span className="text-xs uppercase tracking-wide font-semibold">Health Sync</span>
      </div>
      <h1 className="text-2xl font-bold text-gray-900">Apple Health → Innerwork</h1>
      <p className="text-sm text-gray-600 mt-1 mb-6">
        iOS Shortcuts can read HealthKit data and POST it here on a schedule. The endpoint upserts into
        your daily wellness entries automatically.
      </p>

      {loading && (
        <div className="card animate-pulse h-40"></div>
      )}

      {!loading && error && (
        <div className="card border border-red-200 bg-red-50 text-red-800 mb-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5" />
            <div className="text-sm">{error}</div>
          </div>
        </div>
      )}

      {!loading && info && (
        <>
          {!info.tokenConfigured && (
            <div className="card border border-amber-200 bg-amber-50 text-amber-800 mb-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">HEALTH_INGEST_TOKEN is not configured on the server.</p>
                  <p className="mt-1">
                    Set it in your Render environment variables (any long random string), redeploy,
                    then refresh this page.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Connection details */}
          <div className="card mb-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Connection details</h2>
            <CopyField label="Endpoint URL" value={info.endpoint} />
            <CopyField label="Auth token (X-Ingest-Token header)" value={info.token || ''} secret />
            <CopyField label="Your user_id (include in the JSON body)" value={String(info.userId)} />
          </div>

          {/* Walkthrough */}
          <div className="card mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Smartphone className="w-4 h-4 text-indigo-500" />
              <h2 className="text-sm font-semibold text-gray-700">iOS Shortcut walkthrough</h2>
            </div>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700 leading-relaxed">
              <li>On your iPhone, open the <strong>Shortcuts</strong> app and tap <strong>+</strong> to create a new shortcut.</li>
              <li>
                Add <code className="bg-gray-100 px-1 rounded">Find Health Samples</code> actions for the
                metrics you want — e.g. <em>Sleep Analysis</em> (Asleep) and <em>Active Energy</em> for
                the previous day. Use a <code className="bg-gray-100 px-1 rounded">Get Statistic</code>
                action to total or average them.
              </li>
              <li>
                Add a <code className="bg-gray-100 px-1 rounded">Dictionary</code> action with these keys:
                <pre className="mt-1.5 bg-gray-50 border border-gray-200 rounded p-2 text-xs whitespace-pre-wrap font-mono">{sampleBody}</pre>
                Replace the literal numbers with the magic-variable outputs from your Health actions.
              </li>
              <li>
                Add <code className="bg-gray-100 px-1 rounded">Get Contents of URL</code>, set:
                <ul className="list-disc list-inside ml-4 mt-1 space-y-0.5 text-xs text-gray-600">
                  <li>URL: the endpoint above</li>
                  <li>Method: <strong>POST</strong></li>
                  <li>Request Body: <strong>JSON</strong> → tap "Show More" → set body to your dictionary</li>
                  <li>Headers: add <code className="bg-gray-100 px-1 rounded">X-Ingest-Token</code> with your token, plus <code className="bg-gray-100 px-1 rounded">Content-Type</code>: <code className="bg-gray-100 px-1 rounded">application/json</code></li>
                </ul>
              </li>
              <li>
                Open the <strong>Automation</strong> tab in Shortcuts and create a new <em>Personal Automation</em>
                that runs your shortcut at, e.g., 7am every day. Toggle <strong>Run Immediately</strong> on so it
                fires without prompting.
              </li>
              <li>
                Run the shortcut once manually to confirm it works — you should see an event appear below
                within a few seconds.
              </li>
            </ol>
            <p className="text-xs text-gray-500 mt-3">
              Accepted JSON keys: <code>user_id</code> (required), <code>event_date</code>, <code>sleep_score</code>,
              <code>sleep_quality</code> (1–5), <code>exercise_minutes</code>, <code>exercise_intensity</code>,
              and any other fields — the full payload is also stored as a raw event.
            </p>
          </div>

          {/* Recent events */}
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Recent ingest events</h2>
            {(!info.recentEvents || info.recentEvents.length === 0) ? (
              <p className="text-sm text-gray-500">
                No events yet. Once you trigger your Shortcut, the most recent ingestions will show here.
              </p>
            ) : (
              <div className="space-y-2">
                {info.recentEvents.map((e) => {
                  const p = e.payload || {};
                  return (
                    <div key={e.id} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          <span className="font-medium text-gray-900">
                            {e.eventType || 'event'}
                          </span>
                          {e.eventDate && (
                            <span className="text-xs text-gray-500">{e.eventDate}</span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400">
                          {e.createdAt ? format(new Date(e.createdAt), 'MMM d, p') : ''}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-600">
                        {p.sleep_score != null && <span>sleep_score: <strong>{p.sleep_score}</strong></span>}
                        {p.sleep_quality != null && <span>sleep_quality: <strong>{p.sleep_quality}</strong></span>}
                        {p.exercise_minutes != null && <span>exercise: <strong>{p.exercise_minutes}m</strong></span>}
                        {p.exercise_intensity != null && <span>intensity: <strong>{p.exercise_intensity}</strong></span>}
                        {e.source && <span className="text-gray-400">via {e.source}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default HealthSync;
