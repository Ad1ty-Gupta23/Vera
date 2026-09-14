import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBusiness } from '../../context/BusinessContext';
import { getKnowledgeInsights, listDocuments } from '../../services/knowledgeBase';
import { getAssistantConfig } from '../../services/assistant';
import { listConversations } from '../../services/conversations';
import { getGmailStatus } from '../../services/gmail';
import { getEmbedConfig } from '../../services/embed';
import { listTickets } from '../../services/support';

/* ─── Design tokens ──────────────────────────────────────────── */
const GLASS = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(180,195,255,0.1)',
  borderRadius: '16px',
};

const TONE_COLORS = {
  good:    { text: '#34D399', bg: 'rgba(52,211,153,0.08)',  border: 'rgba(52,211,153,0.2)'  },
  pending: { text: '#FBBF24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.2)'  },
  neutral: { text: '#A7AEC4', bg: 'rgba(255,255,255,0.04)', border: 'rgba(180,195,255,0.1)' },
};

function StatusCard({ label, value, tone = 'neutral', to }) {
  const { text, bg, border } = TONE_COLORS[tone] ?? TONE_COLORS.neutral;

  const inner = (
    <div style={{
      ...GLASS,
      background: bg,
      border: `1px solid ${border}`,
      padding: '16px',
      transition: 'all 0.2s',
    }}>
      <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#5A6180', marginBottom: '8px' }}>
        {label}
      </p>
      <p style={{ fontSize: '14px', fontWeight: 500, color: text }}>{value}</p>
    </div>
  );

  return to ? (
    <Link
      to={to}
      style={{ display: 'block', textDecoration: 'none' }}
      onMouseEnter={(e) => { e.currentTarget.firstChild.style.filter = 'brightness(1.08)'; }}
      onMouseLeave={(e) => { e.currentTarget.firstChild.style.filter = 'none'; }}
    >
      {inner}
    </Link>
  ) : inner;
}

export default function BusinessOverview() {
  const { business } = useBusiness();

  // undefined = loading, null = failed to load, array = loaded
  const [kbDocs, setKbDocs] = useState(undefined);
  const [assistantConfig, setAssistantConfig] = useState(undefined);
  const [conversations, setConversations] = useState(undefined);
  const [gmailStatus, setGmailStatus] = useState(undefined);
  const [embedConfig, setEmbedConfig] = useState(undefined);
  const [insights, setInsights] = useState(undefined);
  const [tickets, setTickets] = useState(undefined);

  useEffect(() => {
    if (!business?.id) return;
    listDocuments(business.id).then(setKbDocs).catch(() => setKbDocs(null));
    getAssistantConfig(business.id).then(setAssistantConfig).catch(() => setAssistantConfig(null));
    listConversations(business.id).then(setConversations).catch(() => setConversations(null));
    getGmailStatus().then(setGmailStatus).catch(() => setGmailStatus(null));
    getEmbedConfig(business.id).then(setEmbedConfig).catch(() => setEmbedConfig(null));
    getKnowledgeInsights(business.id).then(setInsights).catch(() => setInsights(null));
    listTickets(business.id).then(setTickets).catch(() => setTickets(null));
  }, [business?.id]);

  const readyCount = kbDocs?.filter((d) => d.status === 'ready').length ?? 0;
  const kbStatus =
    kbDocs === undefined ? 'Loading…' : readyCount > 0 ? `${readyCount} document${readyCount === 1 ? '' : 's'} indexed` : 'Not set up';
  const kbTone = readyCount > 0 ? 'good' : 'pending';

  const assistantStatus =
    assistantConfig === undefined
      ? 'Loading…'
      : assistantConfig
      ? assistantConfig.assistant_name
      : 'Not configured';
  const assistantTone = assistantConfig ? 'good' : 'pending';

  const recentConversations = conversations?.slice(0, 5) ?? [];

  const emailStatus =
    gmailStatus === undefined
      ? 'Loading…'
      : gmailStatus?.connected
      ? gmailStatus.email
      : gmailStatus?.status === 'needs_reauth'
      ? 'Reconnect needed'
      : 'Gmail not connected';
  const emailTone = gmailStatus?.connected ? 'good' : gmailStatus?.status === 'needs_reauth' ? 'pending' : 'pending';

  const embedStatus =
    embedConfig === undefined ? 'Loading…' : embedConfig?.embed_enabled ? 'Live on your site' : 'Not published';
  const embedTone = embedConfig?.embed_enabled ? 'good' : 'pending';
  const activeTickets = tickets?.filter((ticket) => !['resolved', 'closed'].includes(ticket.status)).length;

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: '#DCE5FF', maxWidth: '900px' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '24px', fontWeight: 700, color: '#fff', margin: 0 }}>
          {business?.name}
        </h1>
        <p style={{ fontSize: '14px', color: '#5A6180', marginTop: '6px' }}>
          {business?.description || 'Add a description in Settings so your assistant can introduce itself.'}
        </p>
      </div>

      {/* Status cards */}
      <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', marginBottom: '32px' }}>
        <StatusCard label="Assistant status" value={assistantStatus} tone={assistantTone} to="/business/customize" />
        <StatusCard label="Knowledge base" value={kbStatus} tone={kbTone} to="/business/knowledge-base" />
        <StatusCard label="Email integration" value={emailStatus} tone={emailTone} to="/business/email" />
        <StatusCard label="Website install" value={embedStatus} tone={embedTone} to="/business/embed" />
      </div>

      {/* Support impact */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div>
            <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#DCE5FF', margin: 0 }}>Support impact</h2>
            <p style={{ fontSize: '11px', color: '#5A6180', marginTop: '3px' }}>
              Live outcomes from customer conversations and verified answers.
            </p>
          </div>
          <Link to="/business/knowledge-base" style={{ fontSize: '12px', color: '#A8B7FF', textDecoration: 'none' }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#DCE5FF'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#A8B7FF'}
          >Improve answers →</Link>
        </div>
        <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
          <StatusCard label="Customer conversations" value={insights === undefined ? 'Loading…' : insights?.conversation_count ?? 'Unavailable'} tone="neutral" />
          <StatusCard label="Grounded answer rate" value={insights === undefined ? 'Loading…' : insights ? `${insights.grounded_rate}%` : 'Unavailable'} tone={insights?.grounded_rate >= 80 ? 'good' : 'pending'} />
          <StatusCard label="Open knowledge gaps" value={insights === undefined ? 'Loading…' : insights ? `${insights.open_gaps} (${insights.unanswered_questions} asks)` : 'Unavailable'} tone={insights?.open_gaps === 0 ? 'good' : 'pending'} to="/business/knowledge-base" />
          <StatusCard label="Action emails sent" value={insights === undefined ? 'Loading…' : insights?.sent_incidents ?? 'Unavailable'} tone={insights?.sent_incidents > 0 ? 'good' : 'neutral'} />
          <StatusCard label="Active customer cases" value={tickets === undefined ? 'Loading…' : activeTickets ?? 'Unavailable'} tone={activeTickets > 0 ? 'pending' : 'good'} to="/business/actions" />
        </div>
      </div>

      {/* Business profile */}
      <div style={{ ...GLASS, padding: '20px', marginBottom: '28px' }}>
        <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#DCE5FF', margin: '0 0 16px' }}>Business profile</h2>
        <dl style={{ display: 'grid', gap: '14px', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {[
            ['Category', business?.category],
            ['Website', business?.website],
            ['Contact email', business?.contact_email],
            ['Phone', business?.phone],
            ['Action inbox email', business?.helpdesk_email],
            ['Working hours', business?.working_hours],
          ].map(([key, val]) => (
            <div key={key}>
              <dt style={{ fontSize: '11px', color: '#5A6180', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{key}</dt>
              <dd style={{ fontSize: '13px', color: '#DCE5FF', marginTop: '4px' }}>{val || '—'}</dd>
            </div>
          ))}
        </dl>
        <Link
          to="/business/settings"
          style={{ display: 'inline-block', marginTop: '18px', fontSize: '12px', color: '#A8B7FF', textDecoration: 'none' }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#DCE5FF'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#A8B7FF'}
        >
          Edit profile →
        </Link>
      </div>

      {/* Recent conversations */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#DCE5FF', margin: 0 }}>Recent conversations</h2>
          {recentConversations.length > 0 && (
            <Link to="/business/conversations"
              style={{ fontSize: '12px', color: '#A8B7FF', textDecoration: 'none' }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#DCE5FF'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#A8B7FF'}
            >View all →</Link>
          )}
        </div>
        {conversations === undefined ? (
          <div style={{ ...GLASS, padding: '32px', textAlign: 'center' }}>
            <p style={{ fontSize: '13px', color: '#5A6180' }}>Loading…</p>
          </div>
        ) : recentConversations.length === 0 ? (
          <div style={{ ...GLASS, padding: '32px', textAlign: 'center', borderStyle: 'dashed' }}>
            <p style={{ fontSize: '13px', color: '#5A6180' }}>
              No conversations yet — once customers chat with your assistant (or you try it from Customize Assistant), they'll show up here.
            </p>
          </div>
        ) : (
          <div style={{ ...GLASS, overflow: 'hidden', padding: 0 }}>
            {recentConversations.map((c, idx) => (
              <Link
                key={c.id}
                to="/business/conversations"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
                  padding: '12px 18px', textDecoration: 'none',
                  borderBottom: idx < recentConversations.length - 1 ? '1px solid rgba(180,195,255,0.07)' : 'none',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: '13px', color: '#DCE5FF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                    Conversation #{c.id}
                  </p>
                  <p style={{ fontSize: '11px', color: '#5A6180', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
                    {c.last_message_preview || 'No messages yet'}
                  </p>
                </div>
                <span style={{ fontSize: '11px', color: '#3D4461', flexShrink: 0 }}>
                  {c.message_count} msg{c.message_count === 1 ? '' : 's'}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
