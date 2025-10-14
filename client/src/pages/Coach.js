import React, { useEffect, useState } from 'react';
import { coachAPI, journalAPI } from '../services/api';
import { Brain, RefreshCw, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

const Coach = () => {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [journalEntries, setJournalEntries] = useState([]);
  const [selectedEntryId, setSelectedEntryId] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [issuesRes, journalRes] = await Promise.all([
          coachAPI.listIssues(),
          journalAPI.getEntries(1, 20)
        ]);
        setIssues(issuesRes.data.issues || []);
        setJournalEntries(journalRes.data.entries || []);
      } catch (e) {
        console.error(e);
        toast.error('Failed to load coach data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const performScan = async () => {
    if (!selectedEntryId) {
      toast.error('Choose a journal entry to scan');
      return;
    }
    const entry = journalEntries.find(e => String(e.id) === String(selectedEntryId));
    if (!entry) {
      toast.error('Entry not found');
      return;
    }
    setScanning(true);
    try {
      await coachAPI.scanJournal(selectedEntryId, entry.content);
      const refreshed = await coachAPI.listIssues();
      setIssues(refreshed.data.issues || []);
      toast.success('Analysis complete');
    } catch (e) {
      console.error(e);
      toast.error('Scan failed');
    } finally {
      setScanning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Brain className="w-6 h-6 mr-2 text-purple-600" /> Coach
          </h1>
          <div className="flex items-center space-x-2">
            <select
              value={selectedEntryId}
              onChange={(e) => setSelectedEntryId(e.target.value)}
              className="px-3 py-2 border rounded-lg"
            >
              <option value="">Pick journal entry</option>
              {journalEntries.map(e => (
                <option key={e.id} value={e.id}>{String(e.content).slice(0, 60)}{e.content.length>60?'…':''}</option>
              ))}
            </select>
            <button
              onClick={performScan}
              disabled={scanning}
              className="btn-primary flex items-center"
            >
              {scanning ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Scanning…
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" /> Analyze
                </>
              )}
            </button>
          </div>
        </div>

        {issues.length === 0 ? (
          <div className="bg-white p-6 rounded-lg border text-gray-600">No issues yet. Analyze a journal entry to get started.</div>
        ) : (
          <div className="space-y-3">
            {issues.map(issue => (
              <div key={issue.id} className="bg-white border rounded-lg p-4 flex items-start justify-between">
                <div>
                  <div className="text-sm text-gray-500">{issue.theme} • severity {issue.severity}/10 • conf {Math.round((issue.confidence||0)*100)}%</div>
                  <div className="mt-1 text-gray-900">“{issue.span_text}”</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {(issue.cognitive_distortions||[]).map((d,i)=>(<span key={i} className="px-2 py-1 bg-amber-100 text-amber-800 rounded-full">{d}</span>))}
                    {(issue.suggested_techniques||[]).map((t,i)=>(<span key={i} className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full">{t}</span>))}
                  </div>
                </div>
                <button className="text-primary-600 hover:text-primary-700 flex items-center text-sm">
                  Work through <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Coach;


