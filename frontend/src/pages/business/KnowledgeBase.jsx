import { useEffect, useState } from 'react';
import { useCallback } from 'react';
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
  listKnowledgeGaps,
  resolveKnowledgeGap,
  dismissKnowledgeGap,
} from '../../services/knowledgeBase';
import { useRef } from 'react';

const ACCEPTED_EXTENSIONS = ['.pdf', '.txt', '.md', '.docx'];
const MAX_FILE_SIZE_MB = 15;

/* ─── shared styles ────────────────────────────────────────── */
const GLASS = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(180,195,255,0.1)', borderRadius: '16px' };
const INPUT_STYLE = {
  width: '100%', boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(180,195,255,0.12)',
  borderRadius: '10px',
  padding: '10px 14px',
  fontSize: '13px',
  color: '#DCE5FF',
  outline: 'none',
  transition: 'border-color 0.2s',
};
const BTN_PRIMARY = {
  background: 'linear-gradient(135deg, #7191FF, #9B8CFF)',
  border: 'none', borderRadius: '10px',
  padding: '9px 18px',
  fontSize: '13px', fontWeight: 600, color: '#fff',
  cursor: 'pointer', transition: 'opacity 0.15s',
};
const BTN_GHOST = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(180,195,255,0.15)',
  borderRadius: '10px',
  padding: '8px 14px',
  fontSize: '12px', color: '#A7AEC4',
  cursor: 'pointer', transition: 'all 0.15s',
};

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_COLORS = {
  ready:      { text: '#34D399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.25)'  },
  processing: { text: '#FBBF24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.25)'  },
  failed:     { text: '#F87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.25)' },
};

function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || { text: '#A7AEC4', bg: 'rgba(255,255,255,0.06)', border: 'rgba(180,195,255,0.15)' };
  return (
    <span style={{
      padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600,
      color: c.text, background: c.bg, border: `1px solid ${c.border}`,
      textTransform: 'capitalize',
    }}>
      {status}
    </span>
  );
}

function DocumentRow({ doc, onDelete, deleting }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '14px',
      padding: '12px 18px',
      borderBottom: '1px solid rgba(180,195,255,0.06)',
    }}>
      {/* Icon */}
      <div style={{
        width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0,
        background: 'rgba(113,145,255,0.1)', border: '1px solid rgba(113,145,255,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7191FF" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
        </svg>
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ fontSize: '13px', color: '#DCE5FF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
          {doc.filename}
        </p>
        <p style={{ fontSize: '11px', color: '#5A6180', marginTop: '2px' }}>
          {doc.file_type.toUpperCase()} · {formatBytes(doc.file_size_bytes)}
          {doc.status === 'ready' && doc.chunk_count != null && (
            <> · {doc.chunk_count} chunk{doc.chunk_count === 1 ? '' : 's'} indexed</>
          )}
        </p>
        {doc.status === 'failed' && doc.error_message && (
          <p style={{ fontSize: '11px', color: '#F87171', marginTop: '4px' }}>{doc.error_message}</p>
        )}
      </div>
      <StatusBadge status={doc.status} />
      <button
        onClick={() => onDelete(doc.id)}
        disabled={deleting}
        style={{ fontSize: '12px', color: '#5A6180', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.15s', flexShrink: 0 }}
        onMouseEnter={(e) => e.currentTarget.style.color = '#F87171'}
        onMouseLeave={(e) => e.currentTarget.style.color = '#5A6180'}
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
    <div style={{ ...GLASS, padding: '20px' }}>
      <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#DCE5FF', margin: '0 0 4px' }}>Test knowledge base</h2>
      <p style={{ fontSize: '12px', color: '#5A6180', marginBottom: '16px' }}>
        Ask a question to preview raw answers from the knowledge base above.
      </p>
      <form onSubmit={handleAsk} style={{ display: 'flex', gap: '8px' }}>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. What's your return policy?"
          style={{ ...INPUT_STYLE, flex: 1 }}
          onFocus={(e) => e.target.style.borderColor = 'rgba(113,145,255,0.5)'}
          onBlur={(e) => e.target.style.borderColor = 'rgba(180,195,255,0.12)'}
        />
        <button
          type="submit"
          disabled={asking || !question.trim()}
          style={{ ...BTN_PRIMARY, opacity: asking || !question.trim() ? 0.4 : 1, flexShrink: 0 }}
        >
          {asking ? 'Asking…' : 'Ask'}
        </button>
      </form>

      {error && <div style={{ marginTop: '12px' }}><ErrorMessage error={error} onDismiss={() => setError(null)} /></div>}

      {result && (
        <div style={{ marginTop: '14px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(180,195,255,0.08)', borderRadius: '12px', padding: '14px' }}>
          <p style={{ fontSize: '13px', color: '#DCE5FF', whiteSpace: 'pre-wrap' }}>{result.answer}</p>
          {result.grounded && result.sources?.length > 0 && (
            <p style={{ fontSize: '11px', color: '#5A6180', marginTop: '8px' }}>Answered from: {result.sources.join(', ')}</p>
          )}
          {!result.grounded && (
            <p style={{ fontSize: '11px', color: 'rgba(251,191,36,0.7)', marginTop: '8px' }}>No matching information found in the knowledge base.</p>
          )}
        </div>
      )}
    </div>
  );
}

function KnowledgeGaps({ businessId, onKnowledgeChanged }) {
  const toast = useToast();
  const [gaps, setGaps] = useState(undefined);
  const [answers, setAnswers] = useState({});
  const [busyId, setBusyId] = useState(null);

  const refresh = useCallback(async () => {
    try {
      setGaps(await listKnowledgeGaps(businessId));
    } catch (err) {
      toast.error(err.message || 'Could not load knowledge gaps.');
      setGaps([]);
    }
  }, [businessId, toast]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleResolve = async (gap) => {
    const answer = (answers[gap.id] || '').trim();
    if (!answer) return;
    setBusyId(gap.id);
    try {
      await resolveKnowledgeGap(businessId, gap.id, answer);
      setAnswers((current) => ({ ...current, [gap.id]: '' }));
      toast.success('Answer approved and added to the knowledge base.');
      await Promise.all([refresh(), onKnowledgeChanged?.()]);
    } catch (err) {
      toast.error(err.message || 'Could not approve this answer.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDismiss = async (gapId) => {
    setBusyId(gapId);
    try {
      await dismissKnowledgeGap(businessId, gapId);
      setGaps((current) => (current || []).filter((gap) => gap.id !== gapId));
      toast.info('Knowledge gap dismissed.');
    } catch (err) {
      toast.error(err.message || 'Could not dismiss this question.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section style={{
      background: 'rgba(113,145,255,0.04)',
      border: '1px solid rgba(113,145,255,0.2)',
      borderRadius: '16px', padding: '20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#DCE5FF', margin: 0 }}>Knowledge gaps</h2>
          <p style={{ fontSize: '12px', color: '#5A6180', marginTop: '4px', maxWidth: '480px' }}>
            Questions the assistant refused to guess. Approve an answer once and it becomes searchable business knowledge for future customers.
          </p>
        </div>
        {gaps?.length > 0 && (
          <span style={{
            borderRadius: '20px', padding: '3px 10px', fontSize: '11px', fontWeight: 600,
            color: '#FBBF24', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', flexShrink: 0,
          }}>
            {gaps.length} open
          </span>
        )}
      </div>

      {gaps === undefined ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
          <LoadingIndicator label="Finding unanswered questions..." />
        </div>
      ) : gaps.length === 0 ? (
        <div style={{ borderRadius: '10px', border: '1px dashed rgba(180,195,255,0.12)', padding: '24px', textAlign: 'center' }}>
          <p style={{ fontSize: '13px', color: '#34D399' }}>No open knowledge gaps</p>
          <p style={{ fontSize: '11px', color: '#5A6180', marginTop: '4px' }}>Unknown customer questions will automatically appear here.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {gaps.map((gap) => (
            <div key={gap.id} style={{ ...GLASS, padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
                <p style={{ fontSize: '13px', fontWeight: 500, color: '#DCE5FF', margin: 0 }}>{gap.question}</p>
                <span style={{
                  fontSize: '11px', color: '#FBBF24', background: 'rgba(251,191,36,0.1)',
                  borderRadius: '20px', padding: '2px 8px', flexShrink: 0,
                }}>
                  Asked {gap.occurrence_count} {gap.occurrence_count === 1 ? 'time' : 'times'}
                </span>
              </div>
              <textarea
                value={answers[gap.id] || ''}
                onChange={(event) => setAnswers((current) => ({ ...current, [gap.id]: event.target.value }))}
                rows={3}
                maxLength={4000}
                placeholder="Enter the verified answer customers should receive..."
                style={{ ...INPUT_STYLE, resize: 'none', marginBottom: '10px' }}
                onFocus={(e) => e.target.style.borderColor = 'rgba(113,145,255,0.5)'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(180,195,255,0.12)'}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleResolve(gap)}
                  disabled={busyId === gap.id || !(answers[gap.id] || '').trim()}
                  style={{ ...BTN_PRIMARY, fontSize: '12px', padding: '7px 14px', opacity: busyId === gap.id || !(answers[gap.id] || '').trim() ? 0.4 : 1 }}
                >
                  {busyId === gap.id ? 'Saving...' : 'Approve & teach VERA'}
                </button>
                <button
                  onClick={() => handleDismiss(gap.id)}
                  disabled={busyId === gap.id}
                  style={{ ...BTN_GHOST, fontSize: '12px', padding: '7px 14px', opacity: busyId === gap.id ? 0.4 : 1 }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function KnowledgeBase() {
  const { business } = useBusiness();
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [documents, setDocuments] = useState(undefined);
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

  useEffect(() => { refresh(); }, [refresh]);

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
        if (!ACCEPTED_EXTENSIONS.includes(ext)) { toast.error(`${file.name}: unsupported file type.`); failed += 1; continue; }
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) { toast.error(`${file.name}: exceeds ${MAX_FILE_SIZE_MB}MB limit.`); failed += 1; continue; }
        try { await uploadDocument(businessId, file); succeeded += 1; } catch (err) { toast.error(`${file.name}: ${err.message || 'upload failed'}`); failed += 1; }
      }
      setUploading(false);
      if (succeeded > 0) toast.success(succeeded === 1 ? 'Document uploaded — processing now.' : `${succeeded} documents uploaded.`);
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
    <div style={{ maxWidth: '720px', fontFamily: "'Inter', system-ui, sans-serif", color: '#DCE5FF' }}>
      <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '22px', fontWeight: 700, color: '#fff', margin: '0 0 6px' }}>
        Knowledge Base
      </h1>
      <p style={{ fontSize: '13px', color: '#5A6180', marginBottom: '24px' }}>
        Upload documents so your assistant can answer customer questions using your business's own information.
      </p>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        style={{
          borderRadius: '16px',
          border: dragActive ? '2px dashed rgba(113,145,255,0.7)' : '2px dashed rgba(180,195,255,0.15)',
          background: dragActive ? 'rgba(113,145,255,0.06)' : 'rgba(255,255,255,0.02)',
          padding: '40px 24px',
          textAlign: 'center',
          transition: 'all 0.2s',
          marginBottom: '20px',
          cursor: 'pointer',
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <div style={{
          width: '44px', height: '44px', borderRadius: '12px', margin: '0 auto 14px',
          background: 'rgba(113,145,255,0.1)', border: '1px solid rgba(113,145,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7191FF" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <p style={{ fontSize: '13px', color: '#A7AEC4', margin: '0 0 6px' }}>
          Drag and drop files here, or{' '}
          <span style={{ color: '#A8B7FF', textDecoration: 'underline', cursor: 'pointer' }}>browse</span>
        </p>
        <p style={{ fontSize: '11px', color: '#5A6180', margin: 0 }}>
          PDF, TXT, MD, or DOCX — up to {MAX_FILE_SIZE_MB}MB each
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS.join(',')}
          style={{ display: 'none' }}
          onChange={(e) => handleFiles(e.target.files)}
        />
        {uploading && (
          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center' }}>
            <LoadingIndicator label="Uploading and processing…" />
          </div>
        )}
      </div>

      {/* Document list */}
      <div style={{ marginBottom: '20px' }}>
        {loadError && <ErrorMessage error={loadError} onDismiss={() => setLoadError(null)} />}

        {documents === undefined ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
            <LoadingIndicator label="Loading knowledge base…" />
          </div>
        ) : documents.length === 0 ? (
          <EmptyState
            title="No documents yet"
            description="Upload FAQs, product info, pricing, or policies so your assistant can answer from real business content instead of guessing."
          />
        ) : (
          <div style={{ ...GLASS, overflow: 'hidden', padding: 0 }}>
            {documents.map((doc, idx) => (
              <div key={doc.id} style={{ borderBottom: idx < documents.length - 1 ? '1px solid rgba(180,195,255,0.06)' : 'none' }}>
                <DocumentRow doc={doc} onDelete={handleDelete} deleting={deletingId === doc.id} />
              </div>
            ))}
          </div>
        )}
      </div>

      {businessId && (
        <div style={{ marginBottom: '20px' }}>
          <KnowledgeGaps businessId={businessId} onKnowledgeChanged={refresh} />
        </div>
      )}

      {documents && documents.some((d) => d.status === 'ready') && businessId && (
        <div>
          <TestAssistant businessId={businessId} />
        </div>
      )}
    </div>
  );
}
