import React, { useState, useEffect, useRef, useCallback } from 'react';
import { peopleAPI } from '../services/api';
import {
  StickyNote,
  Mic,
  Square,
  Loader2,
  Plus,
  Trash2,
  Sparkles,
  Check,
  X
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const NOTE_TYPES = [
  { key: 'observation',    label: 'Observation',    color: 'bg-gray-100 text-gray-800' },
  { key: 'story',          label: 'Story',          color: 'bg-amber-100 text-amber-800' },
  { key: 'preference',     label: 'Preference',     color: 'bg-emerald-100 text-emerald-800' },
  { key: 'speech_quirk',   label: 'Speech quirk',   color: 'bg-purple-100 text-purple-800' },
  { key: 'open_thread',    label: 'Open thread',    color: 'bg-blue-100 text-blue-800' },
  { key: 'pain_point',     label: 'Pain point',     color: 'bg-red-100 text-red-800' },
  { key: 'value',          label: 'Value',          color: 'bg-indigo-100 text-indigo-800' },
  { key: 'character',      label: 'Character',      color: 'bg-pink-100 text-pink-800' },
  { key: 'recent_context', label: 'Recent context', color: 'bg-teal-100 text-teal-800' }
];

const typeMeta = (key) => NOTE_TYPES.find((t) => t.key === key) || NOTE_TYPES[0];

const PersonNotesPanel = ({ personId, personName }) => {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Manual add
  const [newContent, setNewContent] = useState('');
  const [newType, setNewType] = useState('observation');
  const [saving, setSaving] = useState(false);

  // Filter
  const [filterType, setFilterType] = useState('');

  // Voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [extracting, setExtracting] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  // Extraction review modal
  const [showReview, setShowReview] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [keptFlags, setKeptFlags] = useState([]); // parallel array of booleans

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await peopleAPI.listNotes(personId);
      setNotes(res.data.notes || []);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load notes');
    } finally {
      setLoading(false);
    }
  }, [personId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    return () => {
      const r = mediaRecorderRef.current;
      if (r && r.state !== 'inactive') {
        r.stream?.getTracks().forEach((t) => t.stop());
        try { r.stop(); } catch (_) {}
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleAddManual = async (e) => {
    e?.preventDefault?.();
    const content = newContent.trim();
    if (!content) return;
    setSaving(true);
    try {
      const res = await peopleAPI.createNote(personId, { content, noteType: newType, source: 'manual' });
      setNotes((prev) => [res.data.note, ...prev]);
      setNewContent('');
      toast.success('Note added');
    } catch (e) {
      console.error(e);
      toast.error('Failed to add note');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (noteId) => {
    if (!window.confirm('Delete this note?')) return;
    try {
      await peopleAPI.deleteNote(personId, noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete');
    }
  };

  // --- Voice recording -----------------------------------------------------

  const pickMime = () => {
    if (typeof MediaRecorder === 'undefined') return '';
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
    return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || '';
  };

  const startRecording = async () => {
    if (isRecording || extracting) return;
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      toast.error('Voice recording is not supported in this browser');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMime();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        setIsRecording(false);

        const blobType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: blobType });
        audioChunksRef.current = [];
        if (blob.size === 0) {
          toast.error('No audio captured');
          return;
        }
        const ext = blobType.includes('mp4') ? 'mp4' : blobType.includes('ogg') ? 'ogg' : 'webm';

        setExtracting(true);
        try {
          const res = await peopleAPI.extractFromAudio(personId, blob, `recording.${ext}`);
          const ts = res.data.transcript || '';
          const sugg = Array.isArray(res.data.suggestions) ? res.data.suggestions : [];
          if (sugg.length === 0) {
            toast(ts ? 'No clear notes to extract from that' : 'No speech detected', { icon: 'ℹ️' });
            return;
          }
          setTranscript(ts);
          setSuggestions(sugg);
          setKeptFlags(sugg.map(() => true));
          setShowReview(true);
        } catch (err) {
          console.error(err);
          toast.error(err.response?.data?.error || 'Extraction failed');
        } finally {
          setExtracting(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (err) {
      console.error(err);
      toast.error('Could not access microphone');
    }
  };

  const stopRecording = () => {
    const r = mediaRecorderRef.current;
    if (r && r.state !== 'inactive') r.stop();
  };

  const fmtTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const handleSaveKept = async () => {
    const toSave = suggestions
      .map((s, i) => keptFlags[i] ? s : null)
      .filter(Boolean);
    if (toSave.length === 0) {
      setShowReview(false);
      return;
    }
    try {
      const res = await peopleAPI.bulkSaveNotes(personId, toSave);
      const saved = res.data.notes || [];
      setNotes((prev) => [...saved, ...prev]);
      toast.success(`Saved ${saved.length} note${saved.length === 1 ? '' : 's'}`);
      setShowReview(false);
      setTranscript('');
      setSuggestions([]);
      setKeptFlags([]);
    } catch (e) {
      console.error(e);
      toast.error('Failed to save');
    }
  };

  const filtered = filterType ? notes.filter((n) => n.noteType === filterType) : notes;
  const counts = notes.reduce((acc, n) => {
    acc[n.noteType] = (acc[n.noteType] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <StickyNote className="w-5 h-5 text-indigo-500" />
          <h3 className="text-lg font-semibold text-gray-900">Notes</h3>
          <span className="text-sm text-gray-400">({notes.length})</span>
        </div>
        <div className="flex items-center gap-2">
          {extracting && (
            <span className="inline-flex items-center text-xs text-gray-600">
              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Extracting…
            </span>
          )}
          {isRecording ? (
            <button
              type="button"
              onClick={stopRecording}
              className="inline-flex items-center px-3 py-1.5 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700"
            >
              <Square className="w-4 h-4 mr-1.5" />
              Stop · {fmtTime(seconds)}
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              disabled={extracting}
              className="inline-flex items-center px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              title="Record a voice note — auto-extracts structured notes"
            >
              <Mic className="w-4 h-4 mr-1.5" />
              Voice note
            </button>
          )}
        </div>
      </div>

      {/* Filter chips */}
      {notes.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          <button
            type="button"
            onClick={() => setFilterType('')}
            className={`px-2 py-0.5 text-xs rounded-full border ${
              filterType === '' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-300'
            }`}
          >
            All <span className="opacity-70">{notes.length}</span>
          </button>
          {NOTE_TYPES.filter((t) => counts[t.key]).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setFilterType(filterType === t.key ? '' : t.key)}
              className={`px-2 py-0.5 text-xs rounded-full border ${
                filterType === t.key ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-300'
              }`}
            >
              {t.label} <span className="opacity-70">{counts[t.key]}</span>
            </button>
          ))}
        </div>
      )}

      {/* Manual add */}
      <form onSubmit={handleAddManual} className="border border-dashed border-gray-300 rounded-lg p-3 mb-3 bg-gray-50">
        <div className="flex gap-2 mb-2">
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            className="text-xs px-2 py-1 border border-gray-300 rounded-md bg-white"
          >
            {NOTE_TYPES.map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
        </div>
        <textarea
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          rows={2}
          placeholder={`What did you notice about ${personName || 'them'}?`}
          className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white"
        />
        <div className="flex justify-end mt-2">
          <button
            type="submit"
            disabled={saving || !newContent.trim()}
            className="btn-primary text-sm inline-flex items-center px-3 py-1.5"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            {saving ? 'Saving…' : 'Add note'}
          </button>
        </div>
      </form>

      {/* Notes list */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map((i) => <div key={i} className="h-12 bg-gray-100 animate-pulse rounded-md" />)}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-500 italic text-center py-4">
          {notes.length === 0
            ? 'No notes yet. Hit Voice note to record a quick ramble — it gets auto-parsed.'
            : 'No notes of this type yet.'}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {filtered.map((n) => {
            const meta = typeMeta(n.noteType);
            return (
              <li key={n.id} className="group flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50">
                <span className={`flex-shrink-0 px-1.5 py-0.5 text-[10px] uppercase tracking-wide font-semibold rounded ${meta.color}`}>
                  {meta.label}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{n.content}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {n.createdAt ? format(new Date(n.createdAt), 'MMM d, yyyy h:mm a') : ''}
                    {n.source && n.source !== 'manual' && <span className="ml-1">· {n.source}</span>}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(n.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Extraction review modal */}
      {showReview && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                <h3 className="text-base font-semibold text-gray-900">Review suggested notes</h3>
              </div>
              <button onClick={() => setShowReview(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              {transcript && (
                <details className="mb-3 text-xs text-gray-500">
                  <summary className="cursor-pointer">Show transcript</summary>
                  <p className="mt-1 whitespace-pre-wrap bg-gray-50 p-2 rounded">{transcript}</p>
                </details>
              )}
              <p className="text-sm text-gray-600 mb-3">
                Uncheck any you don't want to keep. Edit type/text inline.
              </p>
              <ul className="space-y-2">
                {suggestions.map((s, i) => {
                  const meta = typeMeta(s.note_type);
                  return (
                    <li key={i} className={`border rounded-lg p-3 ${keptFlags[i] ? 'border-gray-300' : 'border-gray-200 opacity-50'}`}>
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={keptFlags[i]}
                          onChange={(e) => setKeptFlags((prev) => prev.map((v, j) => j === i ? e.target.checked : v))}
                          className="mt-1.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <select
                              value={s.note_type}
                              onChange={(e) => setSuggestions((prev) => prev.map((x, j) => j === i ? { ...x, note_type: e.target.value } : x))}
                              className={`text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded border-0 ${meta.color}`}
                            >
                              {NOTE_TYPES.map((t) => (
                                <option key={t.key} value={t.key}>{t.label}</option>
                              ))}
                            </select>
                          </div>
                          <textarea
                            value={s.content}
                            onChange={(e) => setSuggestions((prev) => prev.map((x, j) => j === i ? { ...x, content: e.target.value } : x))}
                            rows={2}
                            className="w-full text-sm border border-gray-200 rounded p-2 focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-gray-200 sticky bottom-0 bg-white">
              <button onClick={() => setShowReview(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSaveKept} className="btn-primary inline-flex items-center">
                <Check className="w-4 h-4 mr-1.5" />
                Save {keptFlags.filter(Boolean).length} note{keptFlags.filter(Boolean).length === 1 ? '' : 's'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonNotesPanel;
