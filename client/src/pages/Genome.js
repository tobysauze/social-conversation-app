import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { UploadCloud, FileText, Trash2, Download } from 'lucide-react';
import { genomeAPI } from '../services/api';

const formatBytes = (bytes) => {
  if (bytes === null || bytes === undefined) return '—';
  const n = Number(bytes);
  if (!Number.isFinite(n)) return '—';
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
};

const Genome = () => {
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const accept = useMemo(
    () => [
      '.txt',
      '.csv',
      '.tsv',
      '.vcf',
      '.vcf.gz',
      '.zip'
    ].join(','),
    []
  );

  const load = async () => {
    setLoading(true);
    try {
      const res = await genomeAPI.list();
      setUploads(res.data.uploads || []);
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.error || 'Failed to load uploads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    try {
      await genomeAPI.upload(file, (p) => setProgress(p));
      toast.success('Uploaded');
      await load();
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this upload?')) return;
    try {
      await genomeAPI.remove(id);
      toast.success('Deleted');
      await load();
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.error || 'Delete failed');
    }
  };

  const handleDownload = (id) => {
    // Use a normal navigation so the browser handles file download
    window.location.href = `${genomeAPI.downloadUrl(id)}`;
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <UploadCloud className="w-8 h-8 text-primary-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Genome Upload</h1>
            <p className="text-gray-600">
              Upload your genome data (e.g. 23andMe TXT/CSV, VCF). Files stay private to your account.
            </p>
          </div>
        </div>
      </div>

      <div className="card mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="text-sm text-gray-700">
            <div className="font-medium text-gray-900 mb-1">Upload a file</div>
            <div className="text-gray-600">
              Supported: TXT, CSV/TSV, VCF, ZIP. Large files may take a bit.
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="btn-primary cursor-pointer inline-flex items-center">
              <FileText className="w-5 h-5 mr-2" />
              Choose file
              <input
                type="file"
                accept={accept}
                className="hidden"
                disabled={uploading}
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </label>
            {uploading && (
              <div className="text-sm text-gray-700">
                Uploading… {progress ? `${progress}%` : ''}
              </div>
            )}
          </div>
        </div>

        {uploading && (
          <div className="mt-4 w-full bg-gray-200 rounded h-2 overflow-hidden">
            <div
              className="h-2 bg-primary-600"
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
        )}
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Your uploads</h2>
          <button className="btn-secondary" onClick={load} disabled={loading || uploading}>
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="text-gray-500">Loading…</div>
        ) : uploads.length === 0 ? (
          <div className="text-gray-500">No genome files uploaded yet.</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {uploads.map((u) => (
              <div key={u.id} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 truncate">{u.original_name}</div>
                  <div className="text-xs text-gray-600">
                    {formatBytes(u.size_bytes)} • {u.created_at ? new Date(u.created_at).toLocaleString() : '—'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded"
                    title="Download"
                    onClick={() => handleDownload(u.id)}
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
                    title="Delete"
                    onClick={() => handleDelete(u.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Genome;


