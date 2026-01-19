import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Bot, Plus, Trash2, Send, RefreshCw, Search } from 'lucide-react';
import { chatAPI } from '../services/api';

const MODEL_STORAGE_KEY = 'llm_model';
const OPENROUTER_MODELS = [
  { label: 'OpenAI: GPT-4o mini', value: 'openai/gpt-4o-mini' },
  { label: 'OpenAI: GPT-4o', value: 'openai/gpt-4o' },
  { label: 'Anthropic: Claude 3.5 Sonnet', value: 'anthropic/claude-3.5-sonnet' },
  { label: 'Google: Gemini 1.5 Pro', value: 'google/gemini-1.5-pro' }
];
const OPENAI_MODELS = [
  { label: 'GPT-4o mini', value: 'gpt-4o-mini' },
  { label: 'GPT-4o', value: 'gpt-4o' }
];

const fmtCost = (v) => {
  if (v === null || v === undefined) return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return '$0';
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
};

const Chat = () => {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [useMemory, setUseMemory] = useState(true);
  const [provider, setProvider] = useState(null); // 'openrouter' | 'openai' | 'none'
  const [defaultModel, setDefaultModel] = useState(null);
  const [model, setModel] = useState(() => localStorage.getItem(MODEL_STORAGE_KEY) || 'openai/gpt-4o-mini');
  const [customModel, setCustomModel] = useState('');
  const [modelQuery, setModelQuery] = useState('');
  const [allModels, setAllModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [showModelBrowser, setShowModelBrowser] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const endRef = useRef(null);

  const activeConversation = useMemo(
    () => conversations.find((c) => Number(c.id) === Number(activeId)) || null,
    [conversations, activeId]
  );

  const scrollToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = async () => {
    setLoadingList(true);
    try {
      const res = await chatAPI.listConversations();
      const list = res.data.conversations || [];
      setConversations(list);
      if (!activeId && list.length) setActiveId(list[0].id);
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.error || 'Failed to load conversations');
    } finally {
      setLoadingList(false);
    }
  };

  const loadMessages = async (conversationId) => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);
    try {
      const res = await chatAPI.getMessages(conversationId);
      setMessages(res.data.messages || []);
      setTimeout(scrollToBottom, 50);
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.error || 'Failed to load messages');
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const v = await chatAPI.version();
        const p = v.data?.provider || null;
        const dm = v.data?.model || null;
        setProvider(p);
        setDefaultModel(dm);

        const allowed = new Set((p === 'openai' ? OPENAI_MODELS : OPENROUTER_MODELS).map((m) => m.value));
        const stored = localStorage.getItem(MODEL_STORAGE_KEY);
        const initial = stored || dm || (p === 'openai' ? OPENAI_MODELS[0].value : OPENROUTER_MODELS[0].value);

        if (!allowed.has(initial) && initial !== '__custom__') {
          const fallback = dm || (p === 'openai' ? OPENAI_MODELS[0].value : OPENROUTER_MODELS[0].value);
          setModel(fallback);
          try { localStorage.setItem(MODEL_STORAGE_KEY, fallback); } catch (_) {}
          toast.error('Selected model is not available on the current backend provider. Switched to a supported model.');
        } else if (initial) {
          setModel(initial);
        }
      } catch (e) {
        console.error(e);
        // If version fails, keep previous behavior
      }
      loadConversations();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadOpenRouterModels = async (q) => {
    setModelsLoading(true);
    try {
      const res = await chatAPI.models(q);
      setAllModels(res.data.models || []);
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.error || 'Failed to load OpenRouter models');
    } finally {
      setModelsLoading(false);
    }
  };

  useEffect(() => {
    if (provider !== 'openrouter') return;
    // load full list once, then let user search (server-side filtering)
    loadOpenRouterModels('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  useEffect(() => {
    try {
      if (model) localStorage.setItem(MODEL_STORAGE_KEY, model);
    } catch (_) {}
  }, [model]);

  const availableModels = useMemo(() => {
    if (provider === 'openai') return OPENAI_MODELS;
    return OPENROUTER_MODELS;
  }, [provider]);

  const openRouterVisible = useMemo(() => {
    const q = modelQuery.trim().toLowerCase();
    const base = allModels || [];
    if (!q) return base;
    return base.filter((m) => (m.name || '').toLowerCase().includes(q) || (m.id || '').toLowerCase().includes(q));
  }, [allModels, modelQuery]);

  useEffect(() => {
    loadMessages(activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const startNewChat = () => {
    setActiveId(null);
    setMessages([]);
    setInput('');
  };

  const deleteConversation = async (conversationId) => {
    if (!window.confirm('Delete this conversation?')) return;
    try {
      await chatAPI.deleteConversation(conversationId);
      toast.success('Deleted');
      const next = conversations.filter((c) => Number(c.id) !== Number(conversationId));
      setConversations(next);
      if (Number(activeId) === Number(conversationId)) {
        setActiveId(next[0]?.id || null);
        if (!next.length) startNewChat();
      }
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.error || 'Delete failed');
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setInput('');

    // optimistic user message
    const optimistic = { id: `tmp-${Date.now()}`, role: 'user', content: text, created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(scrollToBottom, 50);

    try {
      const res = await chatAPI.sendMessage({ conversationId: activeId, message: text, useMemory, model });
      const convId = res.data.conversationId;
      const assistantText = res.data.assistant;

      if (!activeId && convId) {
        setActiveId(convId);
        await loadConversations();
      }

      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimistic.id),
        { id: `${Date.now()}-u`, role: 'user', content: text, created_at: optimistic.created_at },
        { id: `${Date.now()}-a`, role: 'assistant', content: assistantText, created_at: new Date().toISOString() }
      ]);
      setTimeout(scrollToBottom, 50);
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.error || 'Failed to send');
      // restore input
      setInput(text);
      // remove optimistic
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <Bot className="w-7 h-7 text-primary-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Chat</h1>
            <p className="text-sm text-gray-600">Chat, save conversations, and use them as future context.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <span className="whitespace-nowrap">Model</span>
            {provider === 'openrouter' ? (
              <>
                <button
                  type="button"
                  className="input-field bg-white text-black h-9 py-1 inline-flex items-center justify-between"
                  style={{ minWidth: 320 }}
                  disabled={sending}
                  onClick={() => setShowModelBrowser((v) => !v)}
                  title="Browse all OpenRouter models"
                >
                  <span className="truncate">{model || defaultModel || 'Select a model'}</span>
                  <Search className="w-4 h-4 ml-2 text-gray-500" />
                </button>
              </>
            ) : (
              <select
                value={model}
                onChange={(e) => {
                  setModel(e.target.value);
                  setCustomModel('');
                }}
                className="input-field bg-white text-black h-9 py-1"
                style={{ minWidth: 200 }}
                disabled={sending}
              >
                {availableModels.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 select-none">
            <input
              type="checkbox"
              className="rounded border-gray-300"
              checked={useMemory}
              onChange={(e) => setUseMemory(e.target.checked)}
            />
            Use saved chats as memory
          </label>
          <button className="btn-secondary inline-flex items-center" onClick={loadConversations} disabled={loadingList || sending}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
          <button className="btn-primary inline-flex items-center" onClick={startNewChat} disabled={sending}>
            <Plus className="w-4 h-4 mr-2" />
            New chat
          </button>
        </div>
      </div>

      <div className="relative flex gap-6">
        {/* Collapsible sidebar */}
        <div
          className={`hidden lg:flex flex-col transition-[width,opacity] duration-200 ease-out ${
            sidebarOpen ? 'w-[340px] opacity-100' : 'w-0 opacity-0'
          }`}
          aria-hidden={!sidebarOpen}
        >
          <div className="card h-[70vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-gray-900">Saved chats</h2>
                {loadingList && <span className="text-xs text-gray-500">Loading…</span>}
              </div>
              <button
                type="button"
                className="text-xs text-gray-500 hover:text-gray-700"
                onClick={() => setSidebarOpen(false)}
                title="Collapse"
              >
                Collapse
              </button>
            </div>
            <div className="overflow-auto flex-1 divide-y divide-gray-200">
              {conversations.length === 0 ? (
                <div className="text-sm text-gray-500 py-3">No saved chats yet.</div>
              ) : (
                conversations.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActiveId(c.id)}
                    className={`w-full text-left py-3 px-2 rounded-md hover:bg-gray-50 transition-colors ${
                      Number(activeId) === Number(c.id) ? 'bg-primary-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{c.title || 'Untitled'}</div>
                        <div className="text-xs text-gray-600 truncate">{c.summary || '—'}</div>
                      </div>
                      <button
                        type="button"
                        className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
                        title="Delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteConversation(c.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Sticky "tab" handle when sidebar is collapsed */}
        <button
          type="button"
          className={`hidden lg:flex items-center justify-center absolute top-28 z-10 transition-all duration-200 ${
            sidebarOpen ? 'left-[340px] opacity-0 pointer-events-none' : 'left-0 opacity-100'
          }`}
          onClick={() => setSidebarOpen(true)}
          title="Show saved chats"
        >
          <div className="bg-primary-600 text-white px-2 py-3 rounded-r-lg shadow-md text-xs font-semibold tracking-wide">
            Saved
          </div>
        </button>

        {/* Chat window (full remaining width) */}
        <div className="card flex-1 h-[70vh] flex flex-col">
          <div className="border-b border-gray-200 pb-3 mb-3">
            <div className="text-sm font-semibold text-gray-900">
              {activeConversation ? activeConversation.title || 'Chat' : 'New chat'}
            </div>
            <div className="text-xs text-gray-600">
              {activeConversation?.summary ? `Memory summary: ${activeConversation.summary}` : 'Send a message to begin.'}
            </div>
          </div>

          <div className="flex-1 overflow-auto space-y-3 pr-2">
            {loadingMessages ? (
              <div className="text-sm text-gray-500">Loading…</div>
            ) : messages.length === 0 ? (
              <div className="text-sm text-gray-500">
                Ask anything you’re thinking about. Your chats are saved and can be used as context later.
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'bg-primary-600 text-white'
                        : 'bg-white border border-gray-200 text-gray-900'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))
            )}
            {sending && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl px-4 py-3 text-sm bg-white border border-gray-200 text-gray-600">
                  Thinking…
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="pt-3 border-t border-gray-200 mt-3">
            <div className="flex items-end gap-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={2}
                className="input-field flex-1 bg-white text-black placeholder-gray-400"
                placeholder="Type your message… (Enter to send, Shift+Enter for newline)"
                disabled={sending}
              />
              <button className="btn-primary inline-flex items-center" onClick={send} disabled={sending || !input.trim()}>
                <Send className="w-4 h-4 mr-2" />
                Send
              </button>
            </div>
            <div className="text-xs text-gray-500 mt-2">
              Note: If OPENAI_API_KEY isn’t set on the server, you’ll get a friendly “AI not configured” response.
            </div>
          </div>
        </div>
      </div>

      {/* OpenRouter model browser */}
      {provider === 'openrouter' && showModelBrowser && (
        <div className="mt-4 card">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <div className="text-sm font-semibold text-gray-900">OpenRouter models</div>
              <div className="text-xs text-gray-600">
                Prices shown are approx. <span className="font-medium">USD per 1M tokens</span> (prompt / completion) as reported by OpenRouter.
              </div>
            </div>
            <button type="button" className="btn-secondary" onClick={() => { setModelQuery(''); loadOpenRouterModels(''); }}>
              Refresh list
            </button>
          </div>

          <div className="flex items-center gap-3 mb-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                value={modelQuery}
                onChange={(e) => setModelQuery(e.target.value)}
                className="input-field bg-white text-black pl-9"
                placeholder="Search models (e.g. claude, gemini, llama, gpt-4o)…"
              />
            </div>
            <button
              type="button"
              className="btn-primary"
              disabled={modelsLoading}
              onClick={() => loadOpenRouterModels(modelQuery)}
              title="Server-side search"
            >
              Search
            </button>
          </div>

          {modelsLoading ? (
            <div className="text-sm text-gray-500">Loading models…</div>
          ) : (
            <div className="max-h-[420px] overflow-auto border border-gray-200 rounded-lg divide-y divide-gray-200 bg-white">
              {openRouterVisible.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">No models match your search.</div>
              ) : (
                openRouterVisible.map((m) => {
                  const p = m.pricing_per_million || {};
                  const promptCost = p.prompt ?? null;
                  const completionCost = p.completion ?? null;
                  return (
                    <button
                      type="button"
                      key={m.id}
                      className={`w-full text-left p-3 hover:bg-gray-50 ${
                        model === m.id ? 'bg-primary-50' : ''
                      }`}
                      onClick={() => {
                        setModel(m.id);
                        setShowModelBrowser(false);
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{m.name || m.id}</div>
                          <div className="text-xs text-gray-600 truncate">{m.id}</div>
                          {m.context_length ? (
                            <div className="text-xs text-gray-500 mt-1">
                              Context: {Number(m.context_length).toLocaleString()} tokens
                            </div>
                          ) : null}
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-700">
                            <span className="font-medium">{fmtCost(promptCost)}</span> / <span className="font-medium">{fmtCost(completionCost)}</span>
                          </div>
                          <div className="text-[11px] text-gray-500">prompt / completion</div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Chat;

