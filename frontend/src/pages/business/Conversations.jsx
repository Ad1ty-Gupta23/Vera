import { useCallback, useEffect, useState } from 'react';
import { useBusiness } from '../../context/BusinessContext';
import EmptyState from '../../components/common/EmptyState';
import LoadingIndicator from '../../components/common/LoadingIndicator';
import ErrorMessage from '../../components/common/ErrorMessage';
import { listConversations, getConversation } from '../../services/conversations';

function formatRelative(iso) {
  const date = new Date(iso + 'Z'); // backend sends naive UTC timestamps
  const diffMs = Date.now() - date.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function ConversationRow({ conversation, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-slate-800/70 last:border-b-0 transition-colors ${
        active ? 'bg-violet-600/10' : 'hover:bg-slate-900'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-slate-200 truncate">
          Conversation #{conversation.id}
        </p>
        <span
          className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full border ${
            conversation.status === 'open'
              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
              : 'text-slate-400 bg-slate-500/10 border-slate-500/20'
          }`}
        >
          {conversation.status}
        </span>
      </div>
      <p className="text-xs text-slate-500 truncate mt-0.5">
        {conversation.last_message_preview || 'No messages yet'}
      </p>
      <p className="text-[11px] text-slate-600 mt-1">
        {conversation.message_count} message{conversation.message_count === 1 ? '' : 's'} ·{' '}
        {formatRelative(conversation.last_message_at)}
      </p>
    </button>
  );
}

function ConversationDetail({ businessId, conversationId }) {
  const [detail, setDetail] = useState(undefined); // undefined = loading
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setDetail(undefined);
    setError(null);
    getConversation(businessId, conversationId)
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch((err) => { if (!cancelled) setError(err.message || 'Could not load conversation.'); });
    return () => { cancelled = true; };
  }, [businessId, conversationId]);

  if (error) return <ErrorMessage error={error} />;
  if (detail === undefined) {
    return (
      <div className="flex justify-center py-14">
        <LoadingIndicator label="Loading conversation…" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-3 border-b border-slate-800/70">
        <h2 className="text-sm font-medium text-slate-200">Conversation #{detail.id}</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Started {formatRelative(detail.started_at)} · session {detail.session_id}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {detail.messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'customer' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                m.role === 'customer'
                  ? 'rounded-br-sm bg-slate-800 text-slate-100'
                  : 'rounded-bl-sm bg-violet-600/90 text-white'
              }`}
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.role === 'assistant' && m.grounded === false && (
                <p className="text-[10px] text-white/70 mt-1.5">No matching info found</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Conversations() {
  const { business } = useBusiness();
  const businessId = business?.id;

  const [conversations, setConversations] = useState(undefined); // undefined = loading
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const refresh = useCallback(async () => {
    if (!businessId) return;
    setError(null);
    try {
      const rows = await listConversations(businessId);
      setConversations(rows);
      setSelectedId((prev) => prev ?? (rows.length > 0 ? rows[0].id : null));
    } catch (err) {
      setError(err.message || 'Could not load conversations.');
      setConversations([]);
    }
  }, [businessId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-100">Conversations</h1>
      <p className="text-sm text-slate-500 mt-1">
        Review customer conversations handled by your assistant, including test conversations run
        from Customize Assistant.
      </p>

      {error && (
        <div className="mt-6">
          <ErrorMessage error={error} onDismiss={() => setError(null)} />
        </div>
      )}

      {conversations === undefined ? (
        <div className="flex justify-center py-14">
          <LoadingIndicator label="Loading conversations…" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No conversations yet"
            description="Once customers start chatting with your assistant — or you try it from Customize Assistant — conversations will show up here."
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-[320px_1fr] max-w-5xl h-[600px]">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-y-auto">
            {conversations.map((c) => (
              <ConversationRow
                key={c.id}
                conversation={c}
                active={c.id === selectedId}
                onClick={() => setSelectedId(c.id)}
              />
            ))}
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
            {selectedId != null && (
              <ConversationDetail businessId={businessId} conversationId={selectedId} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
