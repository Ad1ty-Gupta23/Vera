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

/* ─── constants (unchanged) ──────────────────────────────── */
const STATUS_LABELS = {
  open: 'Open',
  in_progress: 'In progress',
  waiting_on_customer: 'Waiting on customer',
  resolved: 'Resolved',
  closed: 'Closed',
};

const STATUS_STYLES = {
  open:                 { text: '#7DD3FC', bg: 'rgba(125,211,252,0.1)',  border: 'rgba(125,211,252,0.25)'  },
  in_progress:         { text: '#A8B7FF', bg: 'rgba(168,183,255,0.1)', border: 'rgba(168,183,255,0.25)'  },
  waiting_on_customer: { text: '#FBBF24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.25)'   },
  resolved:            { text: '#34D399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.25)'   },
  closed:              { text: '#5A6180', bg: 'rgba(90,97,128,0.1)',   border: 'rgba(90,97,128,0.2)'    },
};

const PRIORITY_COLORS = {
  low: '#5A6180', normal: '#7DD3FC', high: '#FD9A3C', urgent: '#F87171',
};

const OUTCOME_COLORS = {
  resolved: '#34D399', unconfirmed: '#DCE5FF', case_created: '#7DD3FC',
  escalated: '#FBBF24', unresolved: '#F87171', in_progress: '#A8B7FF',
};

const ACTION_PROFILES = [
  {
    matches: ['ecommerce', 'e-commerce', 'retail', 'store', 'shop'],
    label: 'Commerce', showOrders: true,
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
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

/* ─── shared styles ─────────────────────────────────────── */
const GLASS = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(180,195,255,0.1)', borderRadius: '14px' };
const INPUT_STYLE = {
  width: '100%', boxSizing: 'border-box',
  background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(180,195,255,0.1)',
  borderRadius: '8px', padding: '9px 12px', fontSize: '13px', color: '#DCE5FF', outline: 'none',
};
const SELECT_STYLE = {
  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(180,195,255,0.12)',
  borderRadius: '8px', padding: '8px 10px', fontSize: '12px', color: '#DCE5FF', outline: 'none',
};
const BTN_PRIMARY = {
  background: 'linear-gradient(135deg, #7191FF, #9B8CFF)', border: 'none', borderRadius: '9px',
  padding: '8px 16px', fontSize: '12px', fontWeight: 600, color: '#fff', cursor: 'pointer',
};

function StatusBadge({ status }) {
  const c = STATUS_STYLES[status] || STATUS_STYLES.closed;
  return (
    <span style={{
      padding: '2px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: 600,
      color: c.text, background: c.bg, border: `1px solid ${c.border}`,
    }}>
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
      await onSaved({ status, priority, assigned_to: assignedTo, resolution_notes: notes });
    } catch (err) {
      setError(err.message || 'Could not update the case.');
    } finally {
      setSaving(false);
    }
  };

  const labelStyle = { fontSize: '11px', color: '#5A6180', display: 'block', marginBottom: '5px' };

  return (
    <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'grid', gap: '14px', gridTemplateColumns: '1fr 1fr' }}>
        <label>
          <span style={labelStyle}>Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={SELECT_STYLE}>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label>
          <span style={labelStyle}>Priority</span>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} style={SELECT_STYLE}>
            {['low', 'normal', 'high', 'urgent'].map((v) => (
              <option key={v} value={v}>{v[0].toUpperCase() + v.slice(1)}</option>
            ))}
          </select>
        </label>
      </div>
      <label>
        <span style={labelStyle}>Assigned to</span>
        <input value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} placeholder="Owner or team member" maxLength={200} style={INPUT_STYLE}
          onFocus={(e) => e.target.style.borderColor = 'rgba(113,145,255,0.4)'}
          onBlur={(e) => e.target.style.borderColor = 'rgba(180,195,255,0.1)'}
        />
      </label>
      <label>
        <span style={labelStyle}>Resolution notes</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Record what was done for the customer" rows={3} maxLength={4000}
          style={{ ...INPUT_STYLE, resize: 'none' }}
          onFocus={(e) => e.target.style.borderColor = 'rgba(113,145,255,0.4)'}
          onBlur={(e) => e.target.style.borderColor = 'rgba(180,195,255,0.1)'}
        />
      </label>
      {error && <ErrorMessage error={error} onDismiss={() => setError(null)} />}
      <button type="submit" disabled={saving} style={{ ...BTN_PRIMARY, opacity: saving ? 0.5 : 1, alignSelf: 'flex-start' }}>
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
      setTickets(null); setOrders(null); setCalls(null); setHandoffs(null);
    });
    const interval = window.setInterval(() => { refresh().catch(() => {}); }, 10000);
    return () => window.clearInterval(interval);
    // refresh intentionally follows the current workspace id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business?.id]);

  const visibleTickets = useMemo(() => {
    if (!Array.isArray(tickets)) return [];
    if (filter === 'all') return tickets;
    if (filter === 'resolved') return tickets.filter((t) => ['resolved', 'closed'].includes(t.status));
    return tickets.filter((t) => !['resolved', 'closed'].includes(t.status));
  }, [tickets, filter]);

  const selected = visibleTickets.find((t) => t.id === selectedId) || visibleTickets[0];
  const activeCount   = tickets?.filter((t) => !['resolved', 'closed'].includes(t.status)).length || 0;
  const urgentCount   = tickets?.filter((t) => t.priority === 'urgent' && t.status !== 'closed').length || 0;
  const resolvedCount = tickets?.filter((t) => ['resolved', 'closed'].includes(t.status)).length || 0;
  const waitingHandoffs = handoffs?.filter((h) => h.status === 'pending').length || 0;

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
    setTickets((current) => current.map((t) => t.id === updated.id ? updated : t));
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

  if ([tickets, orders, calls, handoffs].some((v) => v === undefined)) {
    return <LoadingIndicator label="Loading Action Center…" />;
  }

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: '#DCE5FF' }}>
      {/* Page header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '22px', fontWeight: 700, color: '#fff', margin: 0 }}>Action Center</h1>
            <span style={{ padding: '3px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, color: '#A8B7FF', background: 'rgba(113,145,255,0.1)', border: '1px solid rgba(113,145,255,0.25)' }}>
              {profile.label}
            </span>
          </div>
          <p style={{ fontSize: '13px', color: '#5A6180', margin: 0 }}>
            Turn voice and chat requests into trackable business actions with an audit trail.
          </p>
        </div>
        <Link
          to="/business/customize"
          style={{
            padding: '8px 16px', borderRadius: '10px', fontSize: '12px', fontWeight: 600,
            color: '#A8B7FF', background: 'rgba(113,145,255,0.1)', border: '1px solid rgba(113,145,255,0.25)',
            textDecoration: 'none', transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(113,145,255,0.15)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(113,145,255,0.1)'; }}
        >
          Test voice actions
        </Link>
      </div>

      {error && <div style={{ marginBottom: '16px' }}><ErrorMessage error={error} onDismiss={() => setError(null)} /></div>}

      {/* Stat cards */}
      <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', marginBottom: '24px' }} role="status" aria-live="polite">
        {[
          ['Active cases', activeCount, '#7DD3FC', 'rgba(125,211,252,0.08)', 'rgba(125,211,252,0.2)'],
          ['Urgent', urgentCount, '#F87171', 'rgba(248,113,113,0.08)', 'rgba(248,113,113,0.2)'],
          ['Resolved', resolvedCount, '#34D399', 'rgba(52,211,153,0.08)', 'rgba(52,211,153,0.2)'],
          ['Waiting for a human', waitingHandoffs, '#FBBF24', 'rgba(251,191,36,0.08)', 'rgba(251,191,36,0.2)'],
        ].map(([label, value, text, bg, border]) => (
          <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: '14px', padding: '16px' }}>
            <p style={{ fontSize: '11px', color: '#5A6180', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>{label}</p>
            <p style={{ fontSize: '26px', fontWeight: 700, color: text, margin: 0, fontFamily: "'Space Grotesk', sans-serif" }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Human handoff queue */}
      <section style={{ marginBottom: '20px', background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: '14px', padding: '20px' }} aria-labelledby="handoff-heading">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
          <div>
            <h2 id="handoff-heading" style={{ fontSize: '13px', fontWeight: 600, color: '#DCE5FF', margin: '0 0 4px' }}>Human handoff queue</h2>
            <p style={{ fontSize: '11px', color: '#5A6180', margin: 0 }}>Escalations arrive with the conversation context so customers do not repeat themselves.</p>
          </div>
          <Link to="/business/conversations" style={{ fontSize: '12px', color: '#A8B7FF', textDecoration: 'none' }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#DCE5FF'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#A8B7FF'}
          >Open transcripts →</Link>
        </div>
        {handoffs?.filter((h) => !['completed', 'dismissed'].includes(h.status)).length ? (
          <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
            {handoffs.filter((h) => !['completed', 'dismissed'].includes(h.status)).map((handoff) => (
              <article key={handoff.id} style={{ ...GLASS, padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: '#FBBF24', textTransform: 'capitalize', margin: 0 }}>{handoff.routing_category} follow-up</p>
                  <span style={{ fontSize: '10px', color: '#FBBF24', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: '20px', padding: '2px 8px', textTransform: 'capitalize' }}>{handoff.status}</span>
                </div>
                <p style={{ fontSize: '12px', color: '#A7AEC4', lineHeight: '1.6', margin: '0 0 10px' }}>{handoff.summary}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', fontSize: '11px', color: '#5A6180', marginBottom: '12px' }}>
                  <span>{handoff.customer_name || 'Customer name not collected'}</span>
                  {handoff.customer_email && <span>{handoff.customer_email}</span>}
                  <span>{formatDate(handoff.requested_at)}</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {handoff.status === 'pending' && (
                    <button type="button" onClick={() => setHandoffStatus(handoff, 'accepted')}
                      style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: '8px', padding: '6px 12px', fontSize: '11px', fontWeight: 600, color: '#FBBF24', cursor: 'pointer' }}>
                      Accept handoff
                    </button>
                  )}
                  {handoff.status === 'accepted' && (
                    <button type="button" onClick={() => setHandoffStatus(handoff, 'completed')}
                      style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: '8px', padding: '6px 12px', fontSize: '11px', fontWeight: 600, color: '#34D399', cursor: 'pointer' }}>
                      Mark completed
                    </button>
                  )}
                  <Link to="/business/conversations"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(180,195,255,0.15)', borderRadius: '8px', padding: '6px 12px', fontSize: '11px', color: '#A7AEC4', textDecoration: 'none' }}>
                    View context
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div style={{ borderRadius: '10px', border: '1px dashed rgba(180,195,255,0.1)', padding: '20px', textAlign: 'center' }}>
            <p style={{ fontSize: '12px', color: '#5A6180', margin: 0 }}>No customer is waiting for a human.</p>
          </div>
        )}
      </section>

      {/* Tickets + detail split */}
      <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'minmax(260px, 0.85fr) minmax(380px, 1.5fr)', minHeight: '520px', marginBottom: '20px' }}>
        {/* Ticket list */}
        <section style={{ ...GLASS, overflow: 'hidden', padding: 0 }} aria-labelledby="tickets-heading">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid rgba(180,195,255,0.07)' }}>
            <h2 id="tickets-heading" style={{ fontSize: '13px', fontWeight: 600, color: '#DCE5FF', margin: 0 }}>Customer cases</h2>
            <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ ...SELECT_STYLE, padding: '4px 8px', fontSize: '11px' }} aria-label="Filter customer cases">
              <option value="active">Active</option>
              <option value="resolved">Resolved</option>
              <option value="all">All</option>
            </select>
          </div>
          {visibleTickets.length === 0 ? (
            <div style={{ padding: '16px' }}>
              <EmptyState title="No cases here" description="Ask the voice agent to book, capture, escalate, or follow up on a customer request." />
            </div>
          ) : (
            <div style={{ maxHeight: '560px', overflowY: 'auto' }}>
              {visibleTickets.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => setSelectedId(ticket.id)}
                  style={{
                    width: '100%', padding: '13px 16px', textAlign: 'left',
                    border: 'none',
                    borderBottom: '1px solid rgba(180,195,255,0.06)',
                    borderLeft: selected?.id === ticket.id ? '2px solid #7191FF' : '2px solid transparent',
                    background: selected?.id === ticket.id ? 'rgba(113,145,255,0.08)' : 'transparent',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => { if (selected?.id !== ticket.id) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                  onMouseLeave={(e) => { if (selected?.id !== ticket.id) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#DCE5FF' }}>{ticket.ticket_number}</span>
                    <StatusBadge status={ticket.status} />
                  </div>
                  <p style={{ fontSize: '11px', color: '#5A6180', lineHeight: '1.5', margin: '0 0 6px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {ticket.summary}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10px' }}>
                    <span style={{ color: PRIORITY_COLORS[ticket.priority], fontWeight: 600, textTransform: 'uppercase' }}>{ticket.priority}</span>
                    <span style={{ color: '#3D4461' }}>{ticket.channel === 'voice' ? 'Voice' : 'Chat'} · {formatDate(ticket.created_at)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Ticket detail */}
        <section style={{ ...GLASS, padding: '20px', overflowY: 'auto' }} aria-labelledby="ticket-detail-heading">
          {!selected ? (
            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ fontSize: '13px', color: '#5A6180' }}>Select a case to inspect it.</p>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '20px' }}>
                <div>
                  <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#5A6180', margin: '0 0 4px' }}>Customer case</p>
                  <h2 id="ticket-detail-heading" style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: 0, fontFamily: "'Space Grotesk', sans-serif" }}>
                    {selected.ticket_number}
                  </h2>
                </div>
                <StatusBadge status={selected.status} />
              </div>

              {/* Request summary */}
              <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(180,195,255,0.08)', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#A7AEC4', margin: '0 0 8px' }}>Customer request</p>
                <p style={{ fontSize: '13px', color: '#DCE5FF', lineHeight: '1.6', margin: '0 0 14px' }}>{selected.summary}</p>
                <dl style={{ display: 'grid', gap: '10px', gridTemplateColumns: '1fr 1fr', fontSize: '12px' }}>
                  {[
                    ['Customer', selected.customer_name || 'Not provided'],
                    ['Reference', selected.order_reference || 'Not provided'],
                    ['Category', selected.category],
                    ['Requested action', selected.requested_action || 'Review and respond'],
                    ['Channel', selected.channel],
                    ['Created', formatDate(selected.created_at)],
                  ].map(([key, val]) => (
                    <div key={key}>
                      <dt style={{ color: '#5A6180', marginBottom: '2px' }}>{key}</dt>
                      <dd style={{ color: '#DCE5FF', textTransform: key === 'Category' || key === 'Channel' ? 'capitalize' : undefined }}>{val}</dd>
                    </div>
                  ))}
                </dl>
                {selected.assemblyai_session_id && (
                  <p style={{ fontSize: '10px', color: '#5A6180', marginTop: '12px', wordBreak: 'break-all' }}>AssemblyAI session: {selected.assemblyai_session_id}</p>
                )}
              </div>

              {/* Manage case */}
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#A7AEC4', margin: '0 0 14px' }}>Manage case</h3>
                <TicketEditor key={selected.id} ticket={selected} onSaved={saveTicket} />
              </div>

              {/* Activity */}
              <div style={{ borderTop: '1px solid rgba(180,195,255,0.08)', paddingTop: '18px' }}>
                <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#A7AEC4', margin: '0 0 12px' }}>Activity</h3>
                <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {selected.events.map((event) => (
                    <li key={event.id} style={{ borderLeft: '2px solid rgba(113,145,255,0.3)', paddingLeft: '12px', fontSize: '12px' }}>
                      <p style={{ color: '#DCE5FF', margin: '0 0 2px' }}>
                        {event.event_type.replaceAll('_', ' ')}
                        {event.to_status ? ` → ${STATUS_LABELS[event.to_status] || event.to_status}` : ''}
                      </p>
                      {event.note && <p style={{ fontSize: '11px', color: '#5A6180', margin: '0 0 2px' }}>{event.note}</p>}
                      <p style={{ fontSize: '10px', color: '#3D4461', margin: 0 }}>{formatDate(event.created_at)} · {event.actor}</p>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Voice call outcomes */}
      <section style={{ ...GLASS, padding: '20px', marginBottom: '20px' }} aria-labelledby="calls-heading">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
          <div>
            <h2 id="calls-heading" style={{ fontSize: '13px', fontWeight: 600, color: '#DCE5FF', margin: '0 0 4px' }}>Voice-call outcomes</h2>
            <p style={{ fontSize: '11px', color: '#5A6180', margin: 0 }}>Operational results from AssemblyAI calls, not just call volume.</p>
          </div>
          <span style={{ fontSize: '10px', color: '#5A6180' }}>Resolution · intent · sentiment · conversation signals</span>
        </div>
        {calls?.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Outcome', 'Intent', 'Summary', 'Signals', 'Started'].map((h) => (
                    <th key={h} style={{ padding: '0 16px 10px 0', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#5A6180', textAlign: 'left', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {calls.slice(0, 8).map((call) => (
                  <tr key={call.id} style={{ borderTop: '1px solid rgba(180,195,255,0.06)', verticalAlign: 'top' }}>
                    <td style={{ padding: '12px 16px 12px 0', fontSize: '12px', color: OUTCOME_COLORS[call.outcome] || '#A7AEC4', textTransform: 'capitalize' }}>{call.outcome.replaceAll('_', ' ')}</td>
                    <td style={{ padding: '12px 16px 12px 0', fontSize: '12px', color: '#A7AEC4', textTransform: 'capitalize' }}>{call.primary_intent?.replaceAll('_', ' ') || 'Unknown'}</td>
                    <td style={{ padding: '12px 16px 12px 0', fontSize: '12px', color: '#DCE5FF', lineHeight: '1.5', maxWidth: '300px' }}>{call.summary || 'Call in progress'}</td>
                    <td style={{ padding: '12px 16px 12px 0', fontSize: '11px', color: '#5A6180', whiteSpace: 'nowrap' }}>
                      {call.turns} turns · {call.interruptions} interruptions · <span style={{ textTransform: 'capitalize' }}>{call.sentiment}</span>
                    </td>
                    <td style={{ padding: '12px 0', fontSize: '11px', color: '#3D4461', whiteSpace: 'nowrap' }}>{formatDate(call.started_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ borderRadius: '10px', border: '1px dashed rgba(180,195,255,0.1)', padding: '24px', textAlign: 'center' }}>
            <p style={{ fontSize: '12px', color: '#5A6180', margin: 0 }}>Completed AssemblyAI calls will appear here with their outcome and summary.</p>
          </div>
        )}
      </section>

      {/* Voice action templates */}
      <section style={{ background: 'rgba(113,145,255,0.04)', border: '1px solid rgba(113,145,255,0.2)', borderRadius: '14px', padding: '20px', marginBottom: '20px' }} aria-labelledby="actions-heading">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
          <div>
            <h2 id="actions-heading" style={{ fontSize: '13px', fontWeight: 600, color: '#DCE5FF', margin: '0 0 4px' }}>Voice action templates</h2>
            <p style={{ fontSize: '11px', color: '#5A6180', margin: 0 }}>
              Suggested for {business?.category || 'a general business'}. VERA converts each request into a managed case only after customer confirmation.
            </p>
          </div>
          <Link to="/business/settings" style={{ fontSize: '12px', color: '#A8B7FF', textDecoration: 'none' }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#DCE5FF'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#A8B7FF'}
          >Change business category →</Link>
        </div>
        <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
          {profile.actions.map(([label, prompt]) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                if (!navigator.clipboard) { toast.info(`Say: "${prompt}"`); return; }
                navigator.clipboard.writeText(prompt)
                  .then(() => toast.success('Example phrase copied. Try it with the voice agent.'))
                  .catch(() => toast.info(`Say: "${prompt}"`));
              }}
              title="Copy this example phrase"
              style={{
                ...GLASS, padding: '16px', textAlign: 'left', border: '1px solid rgba(180,195,255,0.08)',
                cursor: 'pointer', transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(113,145,255,0.3)'; e.currentTarget.style.background = 'rgba(113,145,255,0.07)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(180,195,255,0.08)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
            >
              <p style={{ fontSize: '12px', fontWeight: 600, color: '#A8B7FF', margin: '0 0 8px' }}>{label}</p>
              <p style={{ fontSize: '12px', color: '#5A6180', lineHeight: '1.5', margin: '0 0 10px' }}>"{prompt}"</p>
              <p style={{ fontSize: '10px', color: '#3D4461', margin: 0 }}>Click to copy</p>
            </button>
          ))}
        </div>
        <p style={{ fontSize: '11px', color: '#5A6180', marginTop: '14px' }}>
          Every business also keeps grounded Q&amp;A, callback capture, human escalation, and optional email follow-up.
        </p>
      </section>

      {/* Demo order system */}
      {profile.showOrders && (
        <section style={{ ...GLASS, padding: '20px' }} aria-labelledby="orders-heading">
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
            <div>
              <h2 id="orders-heading" style={{ fontSize: '13px', fontWeight: 600, color: '#DCE5FF', margin: '0 0 4px' }}>Demo order system</h2>
              <p style={{ fontSize: '11px', color: '#5A6180', margin: 0 }}>A replaceable commerce adapter for a judge-verifiable order lookup.</p>
            </div>
            <button
              type="button"
              onClick={seedOrders}
              disabled={seeding}
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(180,195,255,0.15)', borderRadius: '9px', padding: '8px 16px', fontSize: '12px', color: '#A7AEC4', cursor: seeding ? 'not-allowed' : 'pointer', opacity: seeding ? 0.5 : 1 }}
            >
              {seeding ? 'Loading…' : orders?.length ? 'Refresh demo orders' : 'Load demo orders'}
            </button>
          </div>
          {orders?.length ? (
            <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
              {orders.map((order) => (
                <div key={order.id} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(180,195,255,0.08)', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#DCE5FF', margin: 0 }}>{order.order_number}</p>
                    {order.is_demo && <span style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#A8B7FF' }}>Demo</span>}
                  </div>
                  <p style={{ fontSize: '12px', color: '#A7AEC4', margin: '0 0 12px' }}>{order.product_name}</p>
                  <p style={{ fontSize: '11px', color: '#7DD3FC', textTransform: 'capitalize', margin: '0 0 4px' }}>{order.status.replaceAll('_', ' ')}</p>
                  <p style={{ fontSize: '10px', color: '#5A6180', margin: 0 }}>{order.delivery_estimate}</p>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ borderRadius: '10px', border: '1px dashed rgba(180,195,255,0.1)', padding: '24px', textAlign: 'center' }}>
              <p style={{ fontSize: '12px', color: '#5A6180', margin: 0 }}>Load the sample orders, then ask the agent: "Where is order NN-1042?"</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
