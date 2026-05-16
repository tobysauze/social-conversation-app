import React, { useEffect, useState, useCallback, useRef } from 'react';
import { meAPI } from '../services/api';
import {
  User as UserIcon,
  Copy,
  Download,
  Sparkles,
  Save,
  Loader2,
  Check,
  FileText,
  Eye,
  Code,
  Wand2,
  X
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

const TEMPLATE = `# Me

## Snapshot
One paragraph: who you are right now, the life-stage, what you're doing, what matters.

## How I think / how I work
- Things that are always true about how you reason / show up
- Quirks or defaults

## What I'm into
- Interests, current obsessions, taste

## What I care about (values)
- The things you would defend
- Non-negotiables

## What I'm working on (current focus / goals)
-

## What I struggle with
- Patterns you're trying to change
- Recurring fears

## How to talk to me
- Things that land well
- Things that don't
- Tone I want from an AI: direct, no hedging, push back when I'm wrong, skip disclaimers, etc.

## Context that's usually relevant
- Health, relationship, work, etc.
`;

// Tiny inline markdown renderer — handles the subset that shows up in a
// personal profile (headings, bullets, numbered lists, paragraphs, bold,
// italic, inline code, links). Not a full implementation; keeps us off
// the react-markdown dependency for a v1.
function renderMarkdownPreview(src) {
  if (!src) return null;
  const lines = src.split('\n');
  const blocks = [];
  let listBuffer = null; // { ordered: bool, items: [] }
  let paraBuffer = [];

  const flushList = () => {
    if (!listBuffer) return;
    blocks.push(listBuffer);
    listBuffer = null;
  };
  const flushPara = () => {
    if (paraBuffer.length === 0) return;
    blocks.push({ type: 'p', content: paraBuffer.join(' ') });
    paraBuffer = [];
  };

  for (const raw of lines) {
    const line = raw;
    const trimmed = line.trim();

    if (trimmed === '') {
      flushList();
      flushPara();
      continue;
    }

    const h = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (h) {
      flushList(); flushPara();
      blocks.push({ type: `h${h[1].length}`, content: h[2] });
      continue;
    }

    const ul = /^[-*]\s+(.*)$/.exec(trimmed);
    const ol = /^\d+\.\s+(.*)$/.exec(trimmed);
    if (ul || ol) {
      flushPara();
      const item = (ul ? ul[1] : ol[1]);
      const ordered = !!ol;
      if (!listBuffer || listBuffer.ordered !== ordered) {
        flushList();
        listBuffer = { type: 'ul', ordered, items: [] };
      }
      listBuffer.items.push(item);
      continue;
    }

    // Inline paragraph line
    flushList();
    paraBuffer.push(trimmed);
  }
  flushList();
  flushPara();

  // Inline formatting: **bold**, *italic*, `code`, [text](url)
  const renderInline = (text) => {
    const parts = [];
    let rest = text;
    let key = 0;
    const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/;
    while (rest.length) {
      const m = rest.match(re);
      if (!m) {
        parts.push(<span key={key++}>{rest}</span>);
        break;
      }
      if (m.index > 0) parts.push(<span key={key++}>{rest.slice(0, m.index)}</span>);
      const tok = m[0];
      if (tok.startsWith('**')) parts.push(<strong key={key++}>{tok.slice(2, -2)}</strong>);
      else if (tok.startsWith('*')) parts.push(<em key={key++}>{tok.slice(1, -1)}</em>);
      else if (tok.startsWith('`')) parts.push(<code key={key++} className="px-1 py-0.5 bg-gray-100 rounded text-xs">{tok.slice(1, -1)}</code>);
      else {
        const lm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok);
        if (lm) parts.push(<a key={key++} href={lm[2]} className="text-indigo-600 hover:underline" target="_blank" rel="noreferrer">{lm[1]}</a>);
      }
      rest = rest.slice(m.index + tok.length);
    }
    return parts;
  };

  return blocks.map((b, i) => {
    if (b.type === 'h1') return <h1 key={i} className="text-2xl font-bold text-gray-900 mt-4 mb-2">{renderInline(b.content)}</h1>;
    if (b.type === 'h2') return <h2 key={i} className="text-lg font-semibold text-gray-900 mt-4 mb-1.5">{renderInline(b.content)}</h2>;
    if (b.type === 'h3') return <h3 key={i} className="text-base font-semibold text-gray-800 mt-3 mb-1">{renderInline(b.content)}</h3>;
    if (b.type === 'p')  return <p  key={i} className="text-sm text-gray-800 my-2 leading-relaxed">{renderInline(b.content)}</p>;
    if (b.type === 'ul') {
      const Tag = b.ordered ? 'ol' : 'ul';
      return (
        <Tag key={i} className={`${b.ordered ? 'list-decimal' : 'list-disc'} list-outside ml-5 my-2 space-y-0.5`}>
          {b.items.map((it, j) => <li key={j} className="text-sm text-gray-800 leading-relaxed">{renderInline(it)}</li>)}
        </Tag>
      );
    }
    return null;
  });
}

const Me = () => {
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState('edit'); // edit | preview | split
  const [copied, setCopied] = useState(false);

  const [extracting, setExtracting] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const textareaRef = useRef(null);

  const dirty = content !== originalContent;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await meAPI.getProfile();
      setContent(res.data.content || '');
      setOriginalContent(res.data.content || '');
      setUpdatedAt(res.data.updatedAt || null);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (saving || !dirty) return;
    setSaving(true);
    try {
      const res = await meAPI.saveProfile(content);
      setOriginalContent(res.data.content || '');
      setUpdatedAt(res.data.updatedAt || null);
      toast.success('Saved');
    } catch (e) {
      console.error(e);
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleInsertTemplate = () => {
    if (content.trim() && !window.confirm('Replace the current content with the starter template?')) return;
    setContent(TEMPLATE);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleCopy = async () => {
    try {
      const text = content + (updatedAt ? `\n\n_Last updated: ${new Date(updatedAt).toISOString().slice(0, 10)}_\n` : '');
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Copied — paste into any LLM');
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {
      toast.error('Copy failed');
    }
  };

  const handleDownload = () => {
    const text = content + (updatedAt ? `\n\n_Last updated: ${new Date(updatedAt).toISOString().slice(0, 10)}_\n` : '');
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'me.md';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleExtract = async () => {
    if (extracting) return;
    setExtracting(true);
    try {
      const res = await meAPI.extractSuggestions();
      const sugg = Array.isArray(res.data.suggestions) ? res.data.suggestions : [];
      if (sugg.length === 0) {
        toast('Not enough data yet to suggest much', { icon: 'ℹ️' });
        return;
      }
      setSuggestions(sugg);
      setShowSuggestions(true);
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.error || 'Extraction failed');
    } finally {
      setExtracting(false);
    }
  };

  const appendSuggestion = (s) => {
    const headline = `## ${s.section}`;
    const block = (content.includes(headline) ? '' : `\n\n${headline}\n`) + (s.content || '');
    setContent((prev) => (prev || '').replace(/\s+$/, '') + '\n' + block + '\n');
    toast.success(`Added to ${s.section}`);
  };

  const lastUpdatedLabel = updatedAt
    ? `Last updated ${formatDistanceToNow(new Date(updatedAt), { addSuffix: true })}`
    : 'Not saved yet';

  const stale = updatedAt && (Date.now() - new Date(updatedAt).getTime()) > 60 * 24 * 60 * 60 * 1000;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-indigo-500 mb-1">
            <UserIcon className="w-5 h-5" />
            <span className="text-xs uppercase tracking-wide font-semibold">Me</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Your me.md</h1>
          <p className="text-sm text-gray-600 mt-1">
            Hand-written. The chat coach reads this before every reply, and you can copy or
            download it to paste into any other LLM as context.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
            title="Copy me.md to clipboard"
          >
            {copied ? <Check className="w-4 h-4 mr-1.5 text-green-600" /> : <Copy className="w-4 h-4 mr-1.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            <Download className="w-4 h-4 mr-1.5" />
            me.md
          </button>
          <button
            type="button"
            onClick={handleExtract}
            disabled={extracting}
            className="inline-flex items-center px-3 py-1.5 text-sm rounded-lg border border-indigo-300 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
            title="Use your journals, beliefs, goals etc. to suggest sections"
          >
            {extracting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Wand2 className="w-4 h-4 mr-1.5" />}
            Pull from my data
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div className="text-xs text-gray-500">
          {lastUpdatedLabel}
          {stale && <span className="ml-2 text-amber-600">· been a while, worth a refresh?</span>}
        </div>

        <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-md">
          {[
            { k: 'edit',    label: 'Edit',    icon: Code },
            { k: 'split',   label: 'Split',   icon: FileText },
            { k: 'preview', label: 'Preview', icon: Eye }
          ].map(({ k, label, icon: Icon }) => (
            <button
              key={k}
              type="button"
              onClick={() => setView(k)}
              className={`inline-flex items-center px-2.5 py-1 text-xs rounded-md ${view === k ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Icon className="w-3.5 h-3.5 mr-1" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Editor / preview */}
      <div className={`grid gap-4 ${view === 'split' ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
        {(view === 'edit' || view === 'split') && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {loading ? (
              <div className="h-[60vh] animate-pulse bg-gray-50" />
            ) : (
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={`Empty for now. Tap "Insert template" below to start with section headers, or write freely.`}
                className="w-full h-[60vh] p-4 font-mono text-sm text-gray-900 bg-white rounded-lg focus:outline-none resize-none"
                spellCheck
              />
            )}
          </div>
        )}

        {(view === 'preview' || view === 'split') && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 overflow-y-auto h-[60vh] prose-sm">
            {content.trim() ? renderMarkdownPreview(content) : (
              <p className="text-sm text-gray-400 italic">Preview will appear here once you start writing.</p>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-3 gap-3 flex-wrap">
        <button
          type="button"
          onClick={handleInsertTemplate}
          className="text-xs text-indigo-600 hover:text-indigo-800"
        >
          Insert template
        </button>
        <div className="flex items-center gap-2">
          {dirty && <span className="text-xs text-amber-600">Unsaved changes</span>}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !dirty}
            className="btn-primary inline-flex items-center px-4 py-1.5 text-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Suggestions modal */}
      {showSuggestions && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                <h3 className="text-base font-semibold text-gray-900">Suggestions from your data</h3>
              </div>
              <button onClick={() => setShowSuggestions(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-600 mb-3">
                Tap "Add to profile" to append a suggestion into the right section of your me.md. You can edit afterwards.
              </p>
              <ul className="space-y-3">
                {suggestions.map((s, i) => (
                  <li key={i} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-xs uppercase tracking-wide font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                        {s.section}
                      </span>
                      <button
                        onClick={() => appendSuggestion(s)}
                        className="text-xs text-indigo-600 hover:text-indigo-800"
                      >
                        + Add to profile
                      </button>
                    </div>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{s.content}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-gray-200 sticky bottom-0 bg-white">
              <button onClick={() => setShowSuggestions(false)} className="btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Me;
