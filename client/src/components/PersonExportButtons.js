import React, { useState } from 'react';
import { peopleAPI } from '../services/api';
import { Copy, Download, Archive, Check, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

// Renders the three "off-site" actions for a person's profile:
//   1. Copy markdown to clipboard — fastest way to paste into Claude.ai/ChatGPT
//   2. Download this person as .md
//   3. Download the whole vault as a single .md file
//
// The vault download uses an authenticated axios fetch + Blob URL because the
// /api/people/vault endpoint requires a JWT header, so a plain <a href> would
// hit the 401 path.

const PersonExportButtons = ({ personId, personName }) => {
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingVault, setDownloadingVault] = useState(false);

  const fetchMarkdown = async () => {
    const res = await peopleAPI.getMarkdown(personId);
    return { markdown: res.data.markdown || '', filename: res.data.filename || `${personName || 'person'}.md` };
  };

  const triggerDownload = (text, filename, mime = 'text/markdown') => {
    const blob = new Blob([text], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleCopy = async () => {
    if (copying) return;
    setCopying(true);
    try {
      const { markdown } = await fetchMarkdown();
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      toast.success('Profile markdown copied — paste it into any LLM');
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error(e);
      toast.error('Copy failed');
    } finally {
      setCopying(false);
    }
  };

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const { markdown, filename } = await fetchMarkdown();
      triggerDownload(markdown, filename);
    } catch (e) {
      console.error(e);
      toast.error('Download failed');
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadVault = async () => {
    if (downloadingVault) return;
    setDownloadingVault(true);
    try {
      // axios won't auto-set Authorization on a plain anchor; use the API
      // client (responseType text so we don't get [object Object]).
      const res = await peopleAPI.downloadVault
        ? await peopleAPI.downloadVault()
        : await fetch(peopleAPI.downloadVaultUrl(), {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token') || ''}`
            }
          }).then((r) => {
            if (!r.ok) throw new Error(`Vault download failed (${r.status})`);
            return r.text().then((markdown) => ({ data: markdown }));
          });
      const markdown = typeof res.data === 'string' ? res.data : (res.data?.markdown || '');
      triggerDownload(markdown, 'people-vault.md');
    } catch (e) {
      console.error(e);
      toast.error('Vault download failed');
    } finally {
      setDownloadingVault(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={handleCopy}
        disabled={copying}
        className="inline-flex items-center px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        title="Copy this person's profile as markdown — paste into Claude/ChatGPT"
      >
        {copying ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> :
          copied  ? <Check  className="w-4 h-4 mr-1.5 text-green-600" /> :
                    <Copy   className="w-4 h-4 mr-1.5" />}
        {copied ? 'Copied' : 'Copy markdown'}
      </button>
      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        className="inline-flex items-center px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        title="Download this person as a .md file"
      >
        {downloading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />}
        .md
      </button>
      <button
        type="button"
        onClick={handleDownloadVault}
        disabled={downloadingVault}
        className="inline-flex items-center px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        title="Download every person as a single markdown vault file"
      >
        {downloadingVault ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Archive className="w-4 h-4 mr-1.5" />}
        Vault
      </button>
    </div>
  );
};

export default PersonExportButtons;
