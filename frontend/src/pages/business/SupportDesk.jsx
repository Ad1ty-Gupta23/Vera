import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBusiness } from '../../context/BusinessContext';
import { useToast } from '../../context/ToastContext';
import EmptyState from '../../components/common/EmptyState';
import ErrorMessage from '../../components/common/ErrorMessage';
import LoadingIndicator from '../../components/common/LoadingIndicator';
import {
  listSupportOrders,
  listHandoffs,
  listTickets,
  listVoiceCalls,
  loadDemoOrders,
  updateHandoff,
  updateTicket,
} from '../../services/support';

const STATUS_LABELS = {
  open: 'Open',
  in_progress: 'In progress',
  waiting_on_customer: 'Waiting on customer',
  resolved: 'Resolved',
  closed: 'Closed',
};

const STATUS_STYLES = {
  open: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  in_progress: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
  waiting_on_customer: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  resolved: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  closed: 'border-slate-600 bg-slate-800 text-slate-400',
};

const PRIORITY_STYLES = {
  low: 'text-slate-400',
  normal: 'text-sky-300',
  high: 'text-orange-300',
  urgent: 'text-red-300',
};

const OUTCOME_STYLES = {
  resolved: 'text-emerald-300',
  unconfirmed: 'text-slate-300',
  case_created: 'text-sky-300',
  escalated: 'text-amber-300',
  unresolved: 'text-red-300',
  in_progress: 'text-violet-300',
};

const ACTION_PROFILES = [
  {
    matches: ['ecommerce', 'e-commerce', 'retail', 'store', 'shop'],
    label: 'Commerce',
    showOrders: true,
    actions: [
      ['Order lookup', 'Where is order NN-1042?'],
      ['Return or replacement', 'My order arrived damaged and I need a replacement.'],
      ['Customer follow-up', 'Please ask someone to call me about my purchase.'],
    ],
  },
  {
    matches: ['clinic', 'health', 'medical', 'dental', 'wellness', 'salon'],
    label: 'Appointments & care',
    actions: [
      ['Appointment request', 'I would like to book an appointment next Tuesday.'],
      ['Reschedule', 'I need to change my existing appointment.'],
      ['Staff follow-up', 'Please ask someone to call me about your services.'],
    ],
  },
  {
    matches: ['restaurant', 'hotel', 'hospitality', 'travel'],
    label: 'Bookings & hospitality',
    actions: [
      ['Reservation request', 'I would like to reserve a table for four.'],
      ['Booking change', 'I need to change an existing booking.'],
      ['Guest follow-up', 'Please have your team contact me about a special request.'],
    ],
  },
  {
    matches: ['real estate', 'property', 'realtor'],
    label: 'Property enquiries',
    actions: [
      ['Capture a lead', 'I am interested in a two-bedroom property.'],
      ['Schedule a visit', 'I would like to arrange a property viewing.'],
      ['Agent callback', 'Please ask an agent to call me.'],
    ],
  },
  {
    matches: ['education', 'school', 'college', 'university', 'course', 'training'],
    label: 'Admissions & learning',
    actions: [
      ['Course enquiry', 'I am interested in your next course intake.'],
      ['Admissions follow-up', 'I would like help with an application.'],
      ['Advisor callback', 'Please ask an advisor to contact me.'],
    ],
  },
  {
    matches: ['saas', 'software', 'technology', 'tech'],
    label: 'Product & technical service',
    actions: [
      ['Technical case', 'The application is showing an error when I sign in.'],
      ['Product demo', 'I would like to request a product demo.'],
      ['Sales follow-up', 'Please ask someone to contact me with a quote.'],
    ],
  },
];

const GENERAL_PROFILE = {
  label: 'General business',
  actions: [
    ['Service request', 'I would like help arranging one of your services.'],
    ['Quote or consultation', 'I would like a quote and a consultation.'],
    ['Callback request', 'Please ask someone from the business to call me.'],
  ],
};

function actionProfile(category) {
  const normalized = String(category || '').trim().toLowerCase();
  return ACTION_PROFILES.find((profile) => (
    profile.matches.some((term) => normalized.includes(term))
  )) || GENERAL_PROFILE;
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function StatusBadge({ status }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[status] || STATUS_STYLES.closed}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function TicketEditor({ ticket, onSaved }) {
  const [status, setStatus] = useState(ticket.status);
  const [priority, setPriority] = useState(ticket.priority);
  const [assignedTo, setAssignedTo] = useState(ticket.assigned_to || '');
  const [notes, setNotes] = useState(ticket.resolution_notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSaved({
        status,
        priority,
        assigned_to: assignedTo,
        resolution_notes: notes,
      });
    } catch (err) {
      setError(err.message || 'Could not update the case.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-slate-500">
          Status
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-700/60 bg-slate-950 px-3 py-2.5 text-sm text-slate-200"
          >
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-500">
          Priority
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-700/60 bg-slate-950 px-3 py-2.5 text-sm text-slate-200"
          >
            {['low', 'normal', 'high', 'urgent'].map((value) => (
              <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-xs text-slate-500">
        Assigned to
        <input
          value={assignedTo}
          onChange={(event) => setAssignedTo(event.target.value)}
          placeholder="Owner or team member"
          maxLength={200}
          className="mt-1.5 w-full rounded-lg border border-slate-700/60 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-700"
        />
      </label>
      <label className="block text-xs text-slate-500">
        Resolution notes
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Record what was done for the customer"
          rows={3}
          maxLength={4000}
          className="mt-1.5 w-full resize-none rounded-lg border border-slate-700/60 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-700"
        />
      </label>
      {error && <ErrorMessage error={error} onDismiss={() => setError(null)} />}
      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-violet-600 px-4 py-2.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save case'}
      </button>
    </form>
  );
}

export default function SupportDesk() {
  const { business } = useBusiness();
  const toast = useToast();
  const [tickets, setTickets] = useState(undefined);
  const [orders, setOrders] = useState(undefined);
  const [calls, setCalls] = useState(undefined);
  const [handoffs, setHandoffs] = useState(undefined);
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState('active');
  const [error, setError] = useState(null);
  const [seeding, setSeeding] = useState(false);
  const profile = actionProfile(business?.category);

  const refresh = async () => {
    if (!business?.id) return;
    const [ticketRows, orderRows, callRows, handoffRows] = await Promise.all([
      listTickets(business.id),
      listSupportOrders(business.id),
      listVoiceCalls(business.id),
      listHandoffs(business.id),
    ]);
    setTickets(ticketRows);
    setOrders(orderRows);
    setCalls(callRows);
    setHandoffs(handoffRows);
    setSelectedId((current) => current || ticketRows[0]?.id || null);
  };

  useEffect(() => {
    if (!business?.id) return;
    refresh().catch((err) => {
      setError(err.message || 'Could not load the Action Center.');
      setTickets(null);
      setOrders(null);
      setCalls(null);
      setHandoffs(null);
    });
    const interval = window.setInterval(() => {
      refresh().catch(() => {});
    }, 10000);
    return () => window.clearInterval(interval);
  // refresh intentionally follows the current workspace id.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business?.id]);

  const visibleTickets = useMemo(() => {
    if (!Array.isArray(tickets)) return [];
    if (filter === 'all') return tickets;
    if (filter === 'resolved') {
      return tickets.filter((ticket) => ['resolved', 'closed'].includes(ticket.status));
    }
    return tickets.filter((ticket) => !['resolved', 'closed'].includes(ticket.status));
  }, [tickets, filter]);
  const selected = visibleTickets.find((ticket) => ticket.id === selectedId) || visibleTickets[0];
  const activeCount = tickets?.filter((ticket) => !['resolved', 'closed'].includes(ticket.status)).length || 0;
  const urgentCount = tickets?.filter((ticket) => ticket.priority === 'urgent' && ticket.status !== 'closed').length || 0;
  const resolvedCount = tickets?.filter((ticket) => ['resolved', 'closed'].includes(ticket.status)).length || 0;
  const waitingHandoffs = handoffs?.filter((handoff) => handoff.status === 'pending').length || 0;

  const seedOrders = async () => {
    setSeeding(true);
    setError(null);
    try {
      const rows = await loadDemoOrders(business.id);
      setOrders(rows);
      toast.success('Three demo orders are ready for the voice demo.');
    } catch (err) {
      setError(err.message || 'Could not load demo orders.');
    } finally {
      setSeeding(false);
    }
  };

  const saveTicket = async (payload) => {
    const updated = await updateTicket(business.id, selected.id, payload);
    setTickets((current) => current.map((ticket) => ticket.id === updated.id ? updated : ticket));
    toast.success(`${updated.ticket_number} updated.`);
  };

  const setHandoffStatus = async (handoff, status) => {
    try {
      const updated = await updateHandoff(business.id, handoff.id, status);
      setHandoffs((current) => current.map((row) => row.id === updated.id ? updated : row));
      toast.success(status === 'accepted' ? 'Handoff accepted.' : 'Handoff completed.');
    } catch (err) {
      setError(err.message || 'Could not update the handoff.');
    }
  };

  if ([tickets, orders, calls, handoffs].some((value) => value === undefined)) {
    return <LoadingIndicator label="Loading Action Center…" />;
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-100">Action Center</h1>
            <span className="rounded-full border border-violet-500/25 bg-violet-500/10 px-2.5 py-1 text-[10px] font-medium text-violet-300">
              {profile.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Turn voice and chat requests into trackable business actions with an audit trail.
          </p>
        </div>
        <Link
          to="/business/customize"
          className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-3.5 py-2 text-xs font-medium text-violet-300 hover:bg-violet-500/15"
        >
          Test voice actions
        </Link>
      </div>

      {error && <div className="mt-4"><ErrorMessage error={error} onDismiss={() => setError(null)} /></div>}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" role="status" aria-live="polite">
        {[
          ['Active cases', activeCount, 'text-sky-300'],
          ['Urgent', urgentCount, 'text-red-300'],
          ['Resolved', resolvedCount, 'text-emerald-300'],
          ['Waiting for a human', waitingHandoffs, 'text-amber-300'],
        ].map(([label, value, tone]) => (
          <div key={label} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs text-slate-500">{label}</p>
            <p className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</p>
          </div>
        ))}
      </div>

      <section className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-5" aria-labelledby="handoff-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="handoff-heading" className="text-sm font-medium text-slate-200">Human handoff queue</h2>
            <p className="mt-1 text-xs text-slate-600">Escalations arrive with the conversation context so customers do not repeat themselves.</p>
          </div>
          <Link to="/business/conversations" className="text-xs text-violet-400 hover:text-violet-300">Open transcripts →</Link>
        </div>
        {handoffs?.filter((handoff) => !['completed', 'dismissed'].includes(handoff.status)).length ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {handoffs.filter((handoff) => !['completed', 'dismissed'].includes(handoff.status)).map((handoff) => (
              <article key={handoff.id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-medium capitalize text-amber-300">{handoff.routing_category} follow-up</p>
                  <span className="rounded-full border border-amber-500/20 px-2 py-0.5 text-[10px] capitalize text-amber-300">{handoff.status}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">{handoff.summary}</p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-600">
                  <span>{handoff.customer_name || 'Customer name not collected'}</span>
                  {handoff.customer_email && <span>{handoff.customer_email}</span>}
                  <span>{formatDate(handoff.requested_at)}</span>
                </div>
                <div className="mt-3 flex gap-2">
                  {handoff.status === 'pending' && (
                    <button
                      type="button"
                      onClick={() => setHandoffStatus(handoff, 'accepted')}
                      className="rounded-md bg-amber-500/15 px-3 py-1.5 text-[11px] font-medium text-amber-300 hover:bg-amber-500/20"
                    >
                      Accept handoff
                    </button>
                  )}
                  {handoff.status === 'accepted' && (
                    <button
                      type="button"
                      onClick={() => setHandoffStatus(handoff, 'completed')}
                      className="rounded-md bg-emerald-500/15 px-3 py-1.5 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/20"
                    >
                      Mark completed
                    </button>
                  )}
                  <Link to="/business/conversations" className="rounded-md border border-slate-700 px-3 py-1.5 text-[11px] text-slate-400 hover:bg-slate-800">
                    View context
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-lg border border-dashed border-slate-800 px-4 py-5 text-center text-xs text-slate-600">
            No customer is waiting for a human.
          </p>
        )}
      </section>

      <div className="mt-6 grid min-h-[520px] gap-4 lg:grid-cols-[minmax(280px,0.85fr)_minmax(420px,1.5fr)]">
        <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60" aria-labelledby="tickets-heading">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <h2 id="tickets-heading" className="text-sm font-medium text-slate-200">Customer cases</h2>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-300"
              aria-label="Filter customer cases"
            >
              <option value="active">Active</option>
              <option value="resolved">Resolved</option>
              <option value="all">All</option>
            </select>
          </div>
          {visibleTickets.length === 0 ? (
            <div className="p-4">
              <EmptyState title="No cases here" description="Ask the voice agent to book, capture, escalate, or follow up on a customer request." />
            </div>
          ) : (
            <div className="max-h-[620px] overflow-y-auto">
              {visibleTickets.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => setSelectedId(ticket.id)}
                  className={`w-full border-b border-slate-800/70 px-4 py-3 text-left last:border-0 hover:bg-slate-900 ${selected?.id === ticket.id ? 'bg-violet-500/[0.07]' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-200">{ticket.ticket_number}</span>
                    <StatusBadge status={ticket.status} />
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-500">{ticket.summary}</p>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-slate-600">
                    <span className={PRIORITY_STYLES[ticket.priority]}>{ticket.priority.toUpperCase()}</span>
                    <span>{ticket.channel === 'voice' ? 'Voice' : 'Chat'} · {formatDate(ticket.created_at)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5" aria-labelledby="ticket-detail-heading">
          {!selected ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-600">Select a case to inspect it.</div>
          ) : (
            <div>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-600">Customer case</p>
                  <h2 id="ticket-detail-heading" className="mt-1 text-lg font-semibold text-slate-100">{selected.ticket_number}</h2>
                </div>
                <StatusBadge status={selected.status} />
              </div>

              <div className="mt-5 rounded-lg border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs font-medium text-slate-400">Customer request</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-200">{selected.summary}</p>
                <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
                  <div><dt className="text-slate-600">Customer</dt><dd className="mt-0.5 text-slate-300">{selected.customer_name || 'Not provided'}</dd></div>
                  <div><dt className="text-slate-600">Reference</dt><dd className="mt-0.5 text-slate-300">{selected.order_reference || 'Not provided'}</dd></div>
                  <div><dt className="text-slate-600">Category</dt><dd className="mt-0.5 capitalize text-slate-300">{selected.category}</dd></div>
                  <div><dt className="text-slate-600">Requested action</dt><dd className="mt-0.5 text-slate-300">{selected.requested_action || 'Review and respond'}</dd></div>
                  <div><dt className="text-slate-600">Channel</dt><dd className="mt-0.5 capitalize text-slate-300">{selected.channel}</dd></div>
                  <div><dt className="text-slate-600">Created</dt><dd className="mt-0.5 text-slate-300">{formatDate(selected.created_at)}</dd></div>
                </dl>
                {selected.assemblyai_session_id && (
                  <p className="mt-3 break-all text-[10px] text-slate-600">AssemblyAI session: {selected.assemblyai_session_id}</p>
                )}
              </div>

              <div className="mt-5">
                <h3 className="mb-3 text-xs font-medium text-slate-300">Manage case</h3>
                <TicketEditor key={selected.id} ticket={selected} onSaved={saveTicket} />
              </div>

              <div className="mt-6 border-t border-slate-800 pt-5">
                <h3 className="text-xs font-medium text-slate-300">Activity</h3>
                <ol className="mt-3 space-y-3">
                  {selected.events.map((event) => (
                    <li key={event.id} className="border-l border-slate-700 pl-3 text-xs">
                      <p className="text-slate-300">
                        {event.event_type.replaceAll('_', ' ')}
                        {event.to_status ? ` → ${STATUS_LABELS[event.to_status] || event.to_status}` : ''}
                      </p>
                      {event.note && <p className="mt-0.5 text-slate-600">{event.note}</p>}
                      <p className="mt-0.5 text-[10px] text-slate-700">{formatDate(event.created_at)} · {event.actor}</p>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900/60 p-5" aria-labelledby="calls-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="calls-heading" className="text-sm font-medium text-slate-200">Voice-call outcomes</h2>
            <p className="mt-1 text-xs text-slate-600">Operational results from AssemblyAI calls, not just call volume.</p>
          </div>
          <span className="text-[10px] text-slate-600">Resolution · intent · sentiment · conversation signals</span>
        </div>
        {calls?.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="pb-2 pr-4 font-medium">Outcome</th>
                  <th className="pb-2 pr-4 font-medium">Intent</th>
                  <th className="pb-2 pr-4 font-medium">Summary</th>
                  <th className="pb-2 pr-4 font-medium">Signals</th>
                  <th className="pb-2 font-medium">Started</th>
                </tr>
              </thead>
              <tbody>
                {calls.slice(0, 8).map((call) => (
                  <tr key={call.id} className="border-t border-slate-800/80 align-top">
                    <td className={`py-3 pr-4 capitalize ${OUTCOME_STYLES[call.outcome] || 'text-slate-400'}`}>
                      {call.outcome.replaceAll('_', ' ')}
                    </td>
                    <td className="py-3 pr-4 capitalize text-slate-400">{call.primary_intent?.replaceAll('_', ' ') || 'Unknown'}</td>
                    <td className="max-w-md py-3 pr-4 leading-relaxed text-slate-300">{call.summary || 'Call in progress'}</td>
                    <td className="whitespace-nowrap py-3 pr-4 text-[10px] text-slate-500">
                      {call.turns} turns · {call.interruptions} interruptions · <span className="capitalize">{call.sentiment}</span>
                    </td>
                    <td className="whitespace-nowrap py-3 text-[10px] text-slate-600">{formatDate(call.started_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 rounded-lg border border-dashed border-slate-800 px-4 py-5 text-center text-xs text-slate-600">
            Completed AssemblyAI calls will appear here with their outcome and summary.
          </p>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-violet-500/20 bg-violet-500/[0.04] p-5" aria-labelledby="actions-heading">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="actions-heading" className="text-sm font-medium text-slate-200">Voice action templates</h2>
            <p className="mt-1 text-xs text-slate-600">
              Suggested for {business?.category || 'a general business'}. VERA converts each request into a managed case only after customer confirmation.
            </p>
          </div>
          <Link to="/business/settings" className="text-xs text-violet-400 hover:text-violet-300">
            Change business category →
          </Link>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {profile.actions.map(([label, prompt]) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                if (!navigator.clipboard) {
                  toast.info(`Say: “${prompt}”`);
                  return;
                }
                navigator.clipboard.writeText(prompt)
                  .then(() => toast.success('Example phrase copied. Try it with the voice agent.'))
                  .catch(() => toast.info(`Say: “${prompt}”`));
              }}
              className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-left hover:border-violet-500/30 hover:bg-slate-950"
              title="Copy this example phrase"
            >
              <p className="text-xs font-medium text-violet-300">{label}</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">“{prompt}”</p>
              <p className="mt-3 text-[10px] text-slate-700">Select to copy</p>
            </button>
          ))}
        </div>
        <p className="mt-4 text-[11px] text-slate-600">
          Every business also keeps grounded Q&amp;A, callback capture, human escalation, and optional email follow-up.
        </p>
      </section>

      {profile.showOrders && <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900/60 p-5" aria-labelledby="orders-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="orders-heading" className="text-sm font-medium text-slate-200">Demo order system</h2>
            <p className="mt-1 text-xs text-slate-600">A replaceable commerce adapter for a judge-verifiable order lookup.</p>
          </div>
          <button
            type="button"
            onClick={seedOrders}
            disabled={seeding}
            className="rounded-lg border border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            {seeding ? 'Loading…' : orders?.length ? 'Refresh demo orders' : 'Load demo orders'}
          </button>
        </div>
        {orders?.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {orders.map((order) => (
              <div key={order.id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-200">{order.order_number}</p>
                  {order.is_demo && <span className="text-[9px] uppercase tracking-wider text-violet-400">Demo</span>}
                </div>
                <p className="mt-1 text-xs text-slate-400">{order.product_name}</p>
                <p className="mt-3 text-[11px] capitalize text-sky-300">{order.status.replaceAll('_', ' ')}</p>
                <p className="mt-1 text-[10px] text-slate-600">{order.delivery_estimate}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-lg border border-dashed border-slate-800 px-4 py-6 text-center text-xs text-slate-600">
            Load the sample orders, then ask the agent: “Where is order NN-1042?”
          </p>
        )}
      </section>}
    </div>
  );
}
