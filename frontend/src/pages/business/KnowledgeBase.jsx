import { useCallback, useEffect, useRef, useState } from 'react';
import { useBusiness } from '../../context/BusinessContext';
import { useToast } from '../../context/ToastContext';
import EmptyState from '../../components/common/EmptyState';
import LoadingIndicator from '../../components/common/LoadingIndicator';
import ErrorMessage from '../../components/common/ErrorMessage';
import {
  listDocuments,
  uploadDocument,
  deleteDocument,
  queryKnowledgeBase,
} from '../../services/knowledgeBase';

const ACCEPTED_EXTENSIONS = ['.pdf', '.txt', '.md', '.docx'];
const MAX_FILE_SIZE_MB = 15;

const STATUS_STYLES = {
  ready: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  processing: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  failed: 'text-red-400 bg-red-500/10 border-red-500/20',
};

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusBadge({ status }) {
  const cls = STATUS_STYLES[status] || 'text-slate-400 bg-slate-500/10 border-slate-500/20';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium capitalize ${cls}`}>
      {status}
    </span>
  );
}

function DocumentRow({ doc, onDelete, deleting }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-slate-800/70 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-200 truncate">{doc.filename}</p>
        <p className="text-xs text-slate-500 mt-0.5">
          {doc.file_type.toUpperCase()} · {formatBytes(doc.file_size_bytes)}
          {doc.status === 'ready' && doc.chunk_count != null && (
            <> · {doc.chunk_count} chunk{doc.chunk_count === 1 ? '' : 's'} indexed</>
          )}
        </p>
        {doc.status === 'failed' && doc.error_message && (
          <p className="text-xs text-red-400 mt-1">{doc.error_message}</p>
        )}
      </div>
      <StatusBadge status={doc.status} />
      <button
        onClick={() => onDelete(doc.id)}
        disabled={deleting}
        className="text-xs text-slate-500 hover:text-red-400 transition-colors disabled:opacity-40 shrink-0"
      >
        Remove
      </button>
    </div>
  );
}

function TestAssistant({ businessId }) {
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleAsk = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;
    setAsking(true);
    setError(null);
    setResult(null);
    try {
      const res = await queryKnowledgeBase(businessId, question.trim());
      setResult(res);
    } catch (err) {
      setError(err.message || 'Could not get an answer.');
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <h2 className="text-sm font-medium text-slate-200">Test knowledge base</h2>
      <p className="text-xs text-slate-500 mt-1">
        Ask a question to preview raw answers from the knowledge base above. This
        checks retrieval only — it won't detect issue reports or other assistant
        behavior. For a full preview of your assistant, use the test box on the
        Customize Assistant page instead.
      </p>
      <form onSubmit={handleAsk} className="mt-4 flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. What's your return policy?"
          className="flex-1 rounded-lg bg-slate-900 border border-slate-700/60 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all"
        />
        <button
          type="submit"
          disabled={asking || !question.trim()}
          className="rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          {asking ? 'Asking…' : 'Ask'}
        </button>
      </form>

      {error && <div className="mt-4"><ErrorMessage error={error} onDismiss={() => setError(null)} /></div>}

      {result && (
        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950 px-4 py-3">
          <p className="text-sm text-slate-200 whitespace-pre-wrap">{result.answer}</p>
          {result.grounded && result.sources?.length > 0 && (
            <p className="text-[11px] text-slate-500 mt-2">
              Answered from: {result.sources.join(', ')}
            </p>
          )}
          {!result.grounded && (
            <p className="text-[11px] text-amber-500/80 mt-2">
              No matching information found in the knowledge base.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function KnowledgeBase() {
  const { business } = useBusiness();
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [documents, setDocuments] = useState(undefined); // undefined = loading
  const [loadError, setLoadError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const businessId = business?.id;

  const refresh = useCallback(async () => {
    if (!businessId) return;
    setLoadError(null);
    try {
      const docs = await listDocuments(businessId);
      setDocuments(docs);
    } catch (err) {
      setLoadError(err.message || 'Could not load your knowledge base.');
      setDocuments([]);
    }
  }, [businessId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Documents still "processing" get polled briefly so the status updates
  // without the user having to refresh the page manually.
  useEffect(() => {
    if (!documents?.some((d) => d.status === 'processing')) return;
    const timer = setTimeout(refresh, 2000);
    return () => clearTimeout(timer);
  }, [documents, refresh]);

  const handleFiles = useCallback(
    async (fileList) => {
      const files = Array.from(fileList || []);
      if (files.length === 0) return;

      setUploading(true);
      let succeeded = 0;
      let failed = 0;
      for (const file of files) {
        const ext = `.${file.name.split('.').pop()?.toLowerCase()}`;
        if (!ACCEPTED_EXTENSIONS.includes(ext)) {
          toast.error(`${file.name}: unsupported file type.`);
          failed += 1;
          continue;
        }
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
          toast.error(`${file.name}: exceeds ${MAX_FILE_SIZE_MB}MB limit.`);
          failed += 1;
          continue;
        }
        try {
          await uploadDocument(businessId, file);
          succeeded += 1;
        } catch (err) {
          toast.error(`${file.name}: ${err.message || 'upload failed'}`);
          failed += 1;
        }
      }
      setUploading(false);
      if (succeeded > 0) {
        toast.success(
          succeeded === 1 ? 'Document uploaded — processing now.' : `${succeeded} documents uploaded.`
        );
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
      refresh();
    },
    [businessId, refresh, toast]
  );

  const handleDelete = useCallback(
    async (documentId) => {
      setDeletingId(documentId);
      try {
        await deleteDocument(businessId, documentId);
        toast.success('Document removed.');
        setDocuments((prev) => (prev || []).filter((d) => d.id !== documentId));
      } catch (err) {
        toast.error(err.message || 'Could not remove this document.');
      } finally {
        setDeletingId(null);
      }
    },
    [businessId, toast]
  );

  const onDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold text-slate-100">Knowledge Base</h1>
      <p className="text-sm text-slate-500 mt-1">
        Upload documents so your assistant can answer customer questions using your
        business's own information. Answers are generated only from what you upload here.
      </p>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        className={`mt-6 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragActive ? 'border-violet-500/60 bg-violet-500/5' : 'border-slate-800 bg-slate-900/40'
        }`}
      >
        <p className="text-sm text-slate-300">
          Drag and drop files here, or{' '}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-violet-400 hover:text-violet-300 underline underline-offset-2"
          >
            browse
          </button>
        </p>
        <p className="text-xs text-slate-600 mt-2">
          PDF, TXT, MD, or DOCX — up to {MAX_FILE_SIZE_MB}MB each
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS.join(',')}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {uploading && (
          <div className="mt-4 flex justify-center">
            <LoadingIndicator label="Uploading and processing…" />
          </div>
        )}
      </div>

      <div className="mt-6">
        {loadError && <ErrorMessage error={loadError} onDismiss={() => setLoadError(null)} />}

        {documents === undefined ? (
          <div className="flex justify-center py-10">
            <LoadingIndicator label="Loading knowledge base…" />
          </div>
        ) : documents.length === 0 ? (
          <EmptyState
            title="No documents yet"
            description="Upload FAQs, product info, pricing, or policies so your assistant can answer from real business content instead of guessing."
          />
        ) : (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
            {documents.map((doc) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                onDelete={handleDelete}
                deleting={deletingId === doc.id}
              />
            ))}
          </div>
        )}
      </div>

      {documents && documents.some((d) => d.status === 'ready') && businessId && (
        <div className="mt-6">
          <TestAssistant businessId={businessId} />
        </div>
      )}
    </div>
  );
}