import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Feather, Pencil, Save, X, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { soulAPI } from '../services/api';

// soul.md — one markdown blob per user. The thing they read every day
// as a reminder of how they want to live, what to focus on, who to be.
//
// Default view is READ mode (calm, readable typography), because the
// primary use is daily reading. Edit toggle reveals a plain textarea.

// Inline markdown renderer — heading levels, paragraphs, bullets,
// numbered lists, bold, italic, inline code, links. Same shape as the
// one in Me.js but tuned for prose reading rather than profile editing
// (larger text, more breathing room).
function renderMarkdown(src) {
  if (!src) return null;
  const lines = src.split('\n');
  const blocks = [];
  let listBuffer = null;
  let paraBuffer = [];

  const flushList = () => { if (listBuffer) { blocks.push(listBuffer); listBuffer = null; } };
  const flushPara = () => {
    if (paraBuffer.length === 0) return;
    blocks.push({ type: 'p', content: paraBuffer.join(' ') });
    paraBuffer = [];
  };

  for (const raw of lines) {
    const trimmed = raw.trim();

    if (trimmed === '') {
      flushList();
      flushPara();
      continue;
    }

    if (trimmed === '---' || trimmed === '***') {
      flushList(); flushPara();
      blocks.push({ type: 'hr' });
      continue;
    }

    const h = /^(#{1,4})\s+(.*)$/.exec(trimmed);
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
        listBuffer = { type: 'list', ordered, items: [] };
      }
      listBuffer.items.push(item);
      continue;
    }

    flushList();
    paraBuffer.push(trimmed);
  }
  flushList();
  flushPara();

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
      if (tok.startsWith('**')) parts.push(<strong key={key++} className="font-semibold text-gray-900">{tok.slice(2, -2)}</strong>);
      else if (tok.startsWith('*')) parts.push(<em key={key++} className="italic text-gray-700">{tok.slice(1, -1)}</em>);
      else if (tok.startsWith('`')) parts.push(<code key={key++} className="px-1 py-0.5 bg-gray-100 rounded text-sm">{tok.slice(1, -1)}</code>);
      else {
        const lm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok);
        if (lm) parts.push(<a key={key++} href={lm[2]} className="text-indigo-600 hover:underline" target="_blank" rel="noreferrer">{lm[1]}</a>);
      }
      rest = rest.slice(m.index + tok.length);
    }
    return parts;
  };

  return blocks.map((b, i) => {
    if (b.type === 'hr') return <hr key={i} className="my-8 border-t border-gray-200" />;
    if (b.type === 'h1') return <h1 key={i} className="text-3xl font-bold text-gray-900 mt-8 mb-4 leading-tight">{renderInline(b.content)}</h1>;
    if (b.type === 'h2') return <h2 key={i} className="text-xl font-semibold text-gray-900 mt-8 mb-3">{renderInline(b.content)}</h2>;
    if (b.type === 'h3') return <h3 key={i} className="text-lg font-semibold text-gray-800 mt-6 mb-2">{renderInline(b.content)}</h3>;
    if (b.type === 'h4') return <h4 key={i} className="text-base font-semibold text-gray-800 mt-5 mb-2">{renderInline(b.content)}</h4>;
    if (b.type === 'p')  return <p key={i} className="text-[17px] text-gray-800 my-4 leading-[1.75]">{renderInline(b.content)}</p>;
    if (b.type === 'list') {
      const Tag = b.ordered ? 'ol' : 'ul';
      return (
        <Tag key={i} className={`${b.ordered ? 'list-decimal' : 'list-disc'} list-outside ml-6 my-4 space-y-2`}>
          {b.items.map((it, j) => (
            <li key={j} className="text-[17px] text-gray-800 leading-[1.75]">{renderInline(it)}</li>
          ))}
        </Tag>
      );
    }
    return null;
  });
}

const Soul = () => {
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Read mode is the default — this page is for daily reading first,
  // editing second. We flip to edit automatically when the soul is empty
  // so a new user lands directly on the place they need to type.
  const [mode, setMode] = useState('read');

  const textareaRef = useRef(null);
  const dirty = content !== originalContent;

  const load = useCallback(async () => {
    setLoading(true);
    // Render cold-start safety net (same as Me.js): unblock the UI after
    // 6s even if the request hangs.
    const safetyTimer = setTimeout(() => setLoading(false), 6000);
    try {
      const res = await soulAPI.get();
      const c = res.data.content || '';
      setContent(c);
      setOriginalContent(c);
      setUpdatedAt(res.data.updatedAt || null);
      if (!c.trim()) setMode('edit');
    } catch (e) {
      console.error('[soul] load failed:', e?.response?.status, e?.message);
      toast.error('Failed to load — you can still write below');
      setMode('edit');
    } finally {
      clearTimeout(safetyTimer);
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (saving || !dirty) return;
    setSaving(true);
    try {
      const res = await soulAPI.save(content);
      const c = res.data.content || '';
      setOriginalContent(c);
      setUpdatedAt(res.data.updatedAt || null);
      toast.success('Saved');
      // After a successful save, drop back to read mode if there's
      // content to read — the daily-reading view is the point of being
      // here.
      if (c.trim()) setMode('read');
    } catch (e) {
      console.error(e);
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (dirty && !window.confirm('Discard your unsaved edits?')) return;
    setContent(originalContent);
    setMode(originalContent.trim() ? 'read' : 'edit');
  };

  const lastUpdatedLabel = updatedAt
    ? `Last updated ${formatDistanceToNow(new Date(updatedAt), { addSuffix: true })}`
    : 'Not saved yet';

  const isEmpty = !content.trim() && !originalContent.trim();

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-indigo-500 mb-1">
          <Feather className="w-5 h-5" />
          <span className="text-xs uppercase tracking-wide font-semibold">Soul</span>
        </div>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Your soul.md</h1>
            <p className="text-sm text-gray-600 mt-1 max-w-prose">
              A private, ever-evolving reminder of how you want to live, what to focus on,
              who to be. Read it daily to let it settle into you.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {mode === 'read' && (
              <button
                type="button"
                onClick={() => {
                  setMode('edit');
                  setTimeout(() => textareaRef.current?.focus(), 0);
                }}
                className="inline-flex items-center px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                title="Edit your soul.md"
              >
                <Pencil className="w-4 h-4 mr-1.5" />
                Edit
              </button>
            )}
            {mode === 'edit' && (
              <>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className="inline-flex items-center px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  title="Discard unsaved edits"
                >
                  <X className="w-4 h-4 mr-1.5" />
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !dirty}
                  className="inline-flex items-center px-3 py-1.5 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Save changes"
                >
                  {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="text-xs text-gray-500 mt-3">
          {lastUpdatedLabel}
          {dirty && mode === 'edit' && <span className="ml-2 text-amber-600">· unsaved changes</span>}
        </div>
      </div>

      {mode === 'read' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 px-8 py-10">
          {loading ? (
            <div className="text-sm text-gray-400 inline-flex items-center">
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Loading…
            </div>
          ) : isEmpty ? (
            <div className="text-gray-500 text-base leading-relaxed max-w-prose">
              <p className="mb-3">Nothing here yet.</p>
              <p>
                Tap <strong>Edit</strong> above and paste in your script for settling, your reminders to
                yourself, your principles, your daily reading — anything you want to come back to.
                It stays private to your account.
              </p>
            </div>
          ) : (
            <article className="text-gray-800">
              {renderMarkdown(content)}
            </article>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-300 focus-within:border-indigo-400 transition-colors">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={loading}
            placeholder={loading ? 'Loading…' : 'Paste or write your soul.md here. Markdown is welcome.'}
            className="w-full h-[70vh] p-6 font-mono text-sm text-gray-900 placeholder-gray-400 bg-white rounded-2xl focus:outline-none resize-none disabled:opacity-60 disabled:cursor-wait"
            spellCheck
          />
        </div>
      )}
    </div>
  );
};

export default Soul;
