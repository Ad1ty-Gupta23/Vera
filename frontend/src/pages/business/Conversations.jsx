import { useCallback, useEffect, useState } from 'react';
import { useBusiness } from '../../context/BusinessContext';
import EmptyState from '../../components/common/EmptyState';
import LoadingIndicator from '../../components/common/LoadingIndicator';
import ErrorMessage from '../../components/common/ErrorMessage';
import { listConversations, getConversation } from '../../services/conversations';

const GLASS = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(180,195,255,0.1)', borderRadius: '14px' };

function formatRelative(iso) {
  const date = new Date(iso + 'Z');
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
      style={{
        width: '100%', textAlign: 'left', padding: '13px 16px',
        borderBottom: '1px solid rgba(180,195,255,0.06)',
        background: active ? 'rgba(113,145,255,0.1)' : 'transparent',
        border: 'none',
        borderLeft: active ? '2px solid #7191FF' : '2px solid transparent',
        cursor: 'pointer', transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
        <p style={{ fontSize: '13px', color: '#DCE5FF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0, fontWeight: active ? 600 : 400 }}>
          Conversation #{conversation.id}
        </p>
        <span style={{
          fontSize: '10px', padding: '2px 8px', borderRadius: '20px', flexShrink: 0,
          color: conversation.status === 'open' ? '#34D399' : '#A7AEC4',
          background: conversation.status === 'open' ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${conversation.status === 'open' ? 'rgba(52,211,153,0.25)' : 'rgba(180,195,255,0.1)'}`,
        }}>
          {conversation.status}
        </span>
      </div>
      <p style={{ fontSize: '11px', color: '#5A6180', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: '0 0 4px' }}>
        {conversation.last_message_preview || 'No messages yet'}
      </p>
      <p style={{ fontSize: '11px', color: '#3D4461', margin: 0 }}>
        {conversation.message_count} message{conversation.message_count === 1 ? '' : 's'} · {formatRelative(conversation.last_message_at)}
      </p>
    </button>
  );
}

function ConversationDetail({ businessId, conversationId }) {
  const [detail, setDetail] = useState(undefined);
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
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <LoadingIndicator label="Loading conversation…" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(180,195,255,0.08)' }}>
        <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#DCE5FF', margin: '0 0 3px' }}>Conversation #{detail.id}</h2>
        <p style={{ fontSize: '11px', color: '#5A6180', margin: 0 }}>
          Started {formatRelative(detail.started_at)} · session {detail.session_id}
        </p>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {detail.messages.map((m) => (
          <div key={m.id} style={{ display: 'flex', justifyContent: m.role === 'customer' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '85%', borderRadius: m.role === 'customer' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              padding: '10px 14px', fontSize: '13px',
              background: m.role === 'customer' ? 'rgba(113,145,255,0.15)' : 'rgba(155,140,255,0.15)',
              border: `1px solid ${m.role === 'customer' ? 'rgba(113,145,255,0.25)' : 'rgba(155,140,255,0.2)'}`,
              color: '#DCE5FF',
            }}>
              <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{m.content}</p>
              {m.role === 'assistant' && m.grounded === false && (
                <p style={{ fontSize: '10px', color: 'rgba(251,191,36,0.7)', marginTop: '6px' }}>No matching info found</p>
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

  const [conversations, setConversations] = useState(undefined);
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

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: '#DCE5FF' }}>
      <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '22px', fontWeight: 700, color: '#fff', margin: '0 0 6px' }}>
        Conversations
      </h1>
      <p style={{ fontSize: '13px', color: '#5A6180', marginBottom: '24px' }}>
        Review customer conversations handled by your assistant, including test conversations run from Customize Assistant.
      </p>

      {error && <div style={{ marginBottom: '16px' }}><ErrorMessage error={error} onDismiss={() => setError(null)} /></div>}

      {conversations === undefined ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '56px 0' }}>
          <LoadingIndicator label="Loading conversations…" />
        </div>
      ) : conversations.length === 0 ? (
        <EmptyState
          title="No conversations yet"
          description="Once customers start chatting with your assistant — or you try it from Customize Assistant — conversations will show up here."
        />
      ) : (
        <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: '300px 1fr', maxWidth: '900px', height: '580px' }}>
          <div style={{ ...GLASS, overflowY: 'auto', padding: 0 }}>
            {conversations.map((c) => (
              <ConversationRow
                key={c.id}
                conversation={c}
                active={c.id === selectedId}
                onClick={() => setSelectedId(c.id)}
              />
            ))}
          </div>
          <div style={{ ...GLASS, overflow: 'hidden', padding: 0 }}>
            {selectedId != null && (
              <ConversationDetail businessId={businessId} conversationId={selectedId} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
