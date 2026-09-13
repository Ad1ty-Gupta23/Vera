import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBusiness } from '../../context/BusinessContext';
import { getKnowledgeInsights, listDocuments } from '../../services/knowledgeBase';
import { getAssistantConfig } from '../../services/assistant';
import { listConversations } from '../../services/conversations';
import { getGmailStatus } from '../../services/gmail';
import { getEmbedConfig } from '../../services/embed';
import { listTickets } from '../../services/support';

function StatusCard({ label, value, tone = 'neutral', to }) {
  const toneClasses = {
    neutral: 'text-slate-400 border-slate-800',
    good: 'text-emerald-400 border-emerald-900/60',
    pending: 'text-amber-400 border-amber-900/60',
  }[tone];

  const content = (
    <div className={`rounded-xl border bg-slate-900/60 px-4 py-4 ${toneClasses}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-medium mt-1">{value}</p>
    </div>
  );

  return to ? (
    <Link to={to} className="block hover:brightness-110 transition-all">
      {content}
    </Link>
  ) : (
    content
  );
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
    <div>
      <h1 className="text-xl font-semibold text-slate-100">{business?.name}</h1>
      <p className="text-sm text-slate-500 mt-1">
        {business?.description || 'Add a description in Settings so your assistant can introduce itself.'}
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatusCard label="Assistant status" value={assistantStatus} tone={assistantTone} to="/business/customize" />
        <StatusCard
          label="Knowledge base"
          value={kbStatus}
          tone={kbTone}
          to="/business/knowledge-base"
        />
        <StatusCard label="Email integration" value={emailStatus} tone={emailTone} to="/business/email" />
        <StatusCard
          label="Website install"
          value={embedStatus}
          tone={embedTone}
          to="/business/embed"
        />
      </div>

      <div className="mt-8">
        <div className="flex items-end justify-between gap-4 mb-3">
          <div>
            <h2 className="text-sm font-medium text-slate-200">Support impact</h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Live outcomes from customer conversations and verified answers.
            </p>
          </div>
          <Link to="/business/knowledge-base" className="text-xs text-violet-400 hover:text-violet-300">
            Improve answers →
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatusCard
            label="Customer conversations"
            value={insights === undefined ? 'Loading…' : insights?.conversation_count ?? 'Unavailable'}
            tone="neutral"
          />
          <StatusCard
            label="Grounded answer rate"
            value={insights === undefined ? 'Loading…' : insights ? `${insights.grounded_rate}%` : 'Unavailable'}
            tone={insights?.grounded_rate >= 80 ? 'good' : 'pending'}
          />
          <StatusCard
            label="Open knowledge gaps"
            value={
              insights === undefined
                ? 'Loading…'
                : insights
                ? `${insights.open_gaps} (${insights.unanswered_questions} asks)`
                : 'Unavailable'
            }
            tone={insights?.open_gaps === 0 ? 'good' : 'pending'}
            to="/business/knowledge-base"
          />
          <StatusCard
            label="Action emails sent"
            value={insights === undefined ? 'Loading…' : insights?.sent_incidents ?? 'Unavailable'}
            tone={insights?.sent_incidents > 0 ? 'good' : 'neutral'}
          />
          <StatusCard
            label="Active customer cases"
            value={tickets === undefined ? 'Loading…' : activeTickets ?? 'Unavailable'}
            tone={activeTickets > 0 ? 'pending' : 'good'}
            to="/business/actions"
          />
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="text-sm font-medium text-slate-200">Business profile</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-slate-500 text-xs">Category</dt>
            <dd className="text-slate-200 mt-0.5">{business?.category || '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500 text-xs">Website</dt>
            <dd className="text-slate-200 mt-0.5">{business?.website || '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500 text-xs">Contact email</dt>
            <dd className="text-slate-200 mt-0.5">{business?.contact_email || '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500 text-xs">Phone</dt>
            <dd className="text-slate-200 mt-0.5">{business?.phone || '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500 text-xs">Action inbox email</dt>
            <dd className="text-slate-200 mt-0.5">{business?.helpdesk_email || '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500 text-xs">Working hours</dt>
            <dd className="text-slate-200 mt-0.5">{business?.working_hours || '—'}</dd>
          </div>
        </dl>
        <Link
          to="/business/settings"
          className="inline-block mt-5 text-xs text-violet-400 hover:text-violet-300 transition-colors"
        >
          Edit profile →
        </Link>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-slate-200">Recent conversations</h2>
          {recentConversations.length > 0 && (
            <Link to="/business/conversations" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
              View all →
            </Link>
          )}
        </div>
        {conversations === undefined ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-5 py-8 text-center">
            <p className="text-sm text-slate-500">Loading…</p>
          </div>
        ) : recentConversations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/40 px-5 py-8 text-center">
            <p className="text-sm text-slate-500">
              No conversations yet — once customers chat with your assistant (or you try it from
              Customize Assistant), they'll show up here.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
            {recentConversations.map((c) => (
              <Link
                key={c.id}
                to="/business/conversations"
                className="flex items-center justify-between gap-4 px-4 py-3 border-b border-slate-800/70 last:border-b-0 hover:bg-slate-900 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-200 truncate">Conversation #{c.id}</p>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    {c.last_message_preview || 'No messages yet'}
                  </p>
                </div>
                <span className="text-[11px] text-slate-600 shrink-0">
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
