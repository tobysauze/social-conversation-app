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
  const [worksheetOpen, setWorksheetOpen] = useState(false);
  const [activeIssue, setActiveIssue] = useState(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [record, setRecord] = useState({
    situation: '',
    automaticThought: '',
    emotions: '',
    evidenceFor: '',
    evidenceAgainst: '',
    balancedThought: '',
    postSeverity: ''
  });

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

  const openWorksheet = (issue) => {
    setActiveIssue(issue);
    setWorksheetOpen(true);
    setStepIdx(0);
    setRecord({
      situation: '',
      automaticThought: issue?.span_text || '',
      emotions: '',
      evidenceFor: '',
      evidenceAgainst: '',
      balancedThought: '',
      postSeverity: String(Math.max(0, (issue?.severity ?? 5) - 2))
    });
  };

  const closeWorksheet = () => {
    setWorksheetOpen(false);
    setActiveIssue(null);
  };

  const finishWorksheet = async () => {
    if (!activeIssue) return;
    try {
      await coachAPI.updateIssue(activeIssue.id, {
        status: 'completed',
        severity: Number(record.postSeverity) || 0
      });
      const refreshed = await coachAPI.listIssues();
      setIssues(refreshed.data.issues || []);
      toast.success('Worksheet saved');
      closeWorksheet();
    } catch (e) {
      console.error(e);
      toast.error('Failed to save');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const steps = [
    { key: 'situation', label: 'Situation (when/where/with whom?)', placeholder: 'Describe the situation briefly' },
    { key: 'automaticThought', label: 'Automatic thought', placeholder: 'What went through your mind?' },
    { key: 'emotions', label: 'Emotions (and intensity 0–100)', placeholder: 'e.g., Anxiety 70, Embarrassment 40' },
    { key: 'evidenceFor', label: 'Evidence supporting the thought', placeholder: 'Facts that support the thought' },
    { key: 'evidenceAgainst', label: 'Evidence against the thought', placeholder: 'Facts that don’t fit the thought' },
    { key: 'balancedThought', label: 'Balanced alternative thought', placeholder: 'A more accurate/helpful way to see this' },
    { key: 'postSeverity', label: 'Re‑rate emotion (0–100) after reframing', placeholder: 'e.g., Anxiety 35' }
  ];

  const step = steps[Math.min(stepIdx, steps.length - 1)];

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
                {issue.status !== 'open' ? (
                  <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">Completed</span>
                ) : (
                  <button onClick={()=>openWorksheet(issue)} className="text-primary-600 hover:text-primary-700 flex items-center text-sm">
                    Work through <ChevronRight className="w-4 h-4 ml-1" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {worksheetOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">CBT Thought Record</h2>
              <p className="text-sm text-gray-500 mt-1">Issue: {activeIssue?.theme} • “{activeIssue?.span_text}”</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-sm text-gray-500">Step {stepIdx + 1} of {steps.length}</div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{step.label}</label>
              {step.key === 'postSeverity' ? (
                <input
                  type="text"
                  value={record.postSeverity}
                  onChange={(e)=>setRecord(prev=>({ ...prev, postSeverity: e.target.value }))}
                  className="w-full px-3 py-2 border rounded"
                  placeholder={step.placeholder}
                />
              ) : (
                <textarea
                  rows={4}
                  value={record[step.key]}
                  onChange={(e)=>setRecord(prev=>({ ...prev, [step.key]: e.target.value }))}
                  className="w-full px-3 py-2 border rounded"
                  placeholder={step.placeholder}
                />
              )}
              <div className="flex items-center justify-between pt-4">
                <button
                  onClick={closeWorksheet}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <div className="space-x-2">
                  <button
                    onClick={()=>setStepIdx(i=>Math.max(0, i-1))}
                    className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-50"
                    disabled={stepIdx===0}
                  >
                    Back
                  </button>
                  {stepIdx < steps.length - 1 ? (
                    <button
                      onClick={()=>setStepIdx(i=>Math.min(steps.length-1, i+1))}
                      className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
                    >
                      Next
                    </button>
                  ) : (
                    <button
                      onClick={finishWorksheet}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Save
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Coach;



