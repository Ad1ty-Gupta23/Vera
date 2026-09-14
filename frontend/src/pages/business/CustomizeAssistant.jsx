import { useCallback, useEffect, useRef, useState } from 'react';
import { useBusiness } from '../../context/BusinessContext';
import { useToast } from '../../context/ToastContext';
import LoadingIndicator from '../../components/common/LoadingIndicator';
import ErrorMessage from '../../components/common/ErrorMessage';
import { getAssistantConfig, updateAssistantConfig, sendTestMessage } from '../../services/assistant';
import { updateIncidentDraft, confirmIncident, cancelIncident } from '../../services/incidents';
import { createTicketFromIncident } from '../../services/support';
import { createVoiceSession } from '../../services/voice';
import {
  createAssemblyVoiceAgentSession,
  VoiceAgentUnavailableError,
} from '../../services/assemblyVoiceAgent';
import { speak, stop as stopSpeech } from '../../services/tts';
import API_BASE from '../../services/api';

// Same host/port as the REST API, just ws(s):// instead of http(s):// —
// mirrors how the free chatbot's voice session reuses the API's own host.
const BUSINESS_VOICE_WS_BASE = API_BASE.replace(/^http/, 'ws');

const THEME_PRESETS = ['#7c3aed', '#2563eb', '#059669', '#dc2626', '#d97706', '#0891b2'];
const MESSAGE_URL_RE = /(https?:\/\/[^\s]+)/g;

/* ─── shared styles ────────────────────────────────────────── */
const GLASS = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(180,195,255,0.1)', borderRadius: '16px' };
const INPUT_STYLE = {
  width: '100%', boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(180,195,255,0.12)',
  borderRadius: '10px', padding: '10px 14px', fontSize: '13px', color: '#DCE5FF',
  outline: 'none', transition: 'border-color 0.2s',
};
const BTN_PRIMARY = {
  background: 'linear-gradient(135deg, #7191FF, #9B8CFF)', border: 'none', borderRadius: '10px',
  padding: '9px 18px', fontSize: '13px', fontWeight: 600, color: '#fff', cursor: 'pointer',
};
const BTN_GHOST = {
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(180,195,255,0.15)', borderRadius: '10px',
  padding: '8px 14px', fontSize: '12px', color: '#A7AEC4', cursor: 'pointer',
};

function MessageContent({ children }) {
  return String(children || '').split(MESSAGE_URL_RE).map((part, index) => (
    /^https?:\/\//i.test(part) ? (
      <a key={index} href={part} target="_blank" rel="noopener noreferrer"
        style={{ textDecoration: 'underline', textUnderlineOffset: '2px', wordBreak: 'break-all' }}>
        {part}
      </a>
    ) : <span key={index}>{part}</span>
  ));
}

function ConfigForm({ config, onSave }) {
  const [form, setForm] = useState(config);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => setForm(config), [config]);

  const dirty =
    form.assistant_name !== config.assistant_name ||
    form.greeting_message !== config.greeting_message ||
    (form.custom_instructions || '') !== (config.custom_instructions || '') ||
    form.theme_color !== config.theme_color;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(form);
      toast.success('Assistant updated.');
    } catch (err) {
      toast.error(err.message || 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  const labelStyle = { fontSize: '12px', fontWeight: 500, color: '#A7AEC4', display: 'block', marginBottom: '6px' };
  const hintStyle = { fontSize: '11px', color: '#5A6180', marginTop: '4px' };

  return (
    <form onSubmit={handleSubmit} style={{ ...GLASS, padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <label style={labelStyle}>Assistant name</label>
        <input
          value={form.assistant_name}
          onChange={(e) => setForm((f) => ({ ...f, assistant_name: e.target.value }))}
          maxLength={80}
          required
          style={INPUT_STYLE}
          onFocus={(e) => e.target.style.borderColor = 'rgba(113,145,255,0.5)'}
          onBlur={(e) => e.target.style.borderColor = 'rgba(180,195,255,0.12)'}
        />
      </div>

      <div>
        <label style={labelStyle}>Greeting message</label>
        <textarea
          value={form.greeting_message}
          onChange={(e) => setForm((f) => ({ ...f, greeting_message: e.target.value }))}
          maxLength={500}
          required
          rows={2}
          style={{ ...INPUT_STYLE, resize: 'none' }}
          onFocus={(e) => e.target.style.borderColor = 'rgba(113,145,255,0.5)'}
          onBlur={(e) => e.target.style.borderColor = 'rgba(180,195,255,0.12)'}
        />
        <p style={hintStyle}>Shown as the first message customers see.</p>
      </div>

      <div>
        <label style={labelStyle}>Custom instructions (optional)</label>
        <textarea
          value={form.custom_instructions || ''}
          onChange={(e) => setForm((f) => ({ ...f, custom_instructions: e.target.value }))}
          maxLength={4000}
          rows={4}
          placeholder="e.g. Always mention our 30-day return window when discussing refunds."
          style={{ ...INPUT_STYLE, resize: 'none' }}
          onFocus={(e) => e.target.style.borderColor = 'rgba(113,145,255,0.5)'}
          onBlur={(e) => e.target.style.borderColor = 'rgba(180,195,255,0.12)'}
        />
        <p style={hintStyle}>
          Extra tone or policy guidance layered on top of your knowledge base — this can't override how the assistant handles security or grounding.
        </p>
      </div>

      <div>
        <label style={labelStyle}>Theme color</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
          {THEME_PRESETS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setForm((f) => ({ ...f, theme_color: color }))}
              style={{
                width: '28px', height: '28px', borderRadius: '50%', background: color, border: 'none', cursor: 'pointer',
                outline: form.theme_color === color ? `3px solid ${color}` : 'none',
                outlineOffset: '2px',
                boxShadow: form.theme_color === color ? `0 0 10px ${color}60` : 'none',
                transition: 'all 0.15s',
              }}
              aria-label={`Use theme color ${color}`}
            />
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={!dirty || saving}
        style={{ ...BTN_PRIMARY, opacity: !dirty || saving ? 0.4 : 1, cursor: !dirty || saving ? 'not-allowed' : 'pointer' }}
      >
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  );
}

// Stage 6 — editable preview of the issue-report email draft. Rendered
// below the chat log whenever the workflow has an open incident; the
// customer/owner reviews and edits here, then explicitly confirms or
// cancels — the backend never sends without this step (see
// api/incident_routes.py, business_chat's issue_workflow hand-off).
function ActionReviewCard({
  businessId,
  incident,
  channel,
  assemblyaiSessionId,
  onResolved,
  onTicketCreated,
}) {
  const [subject, setSubject] = useState(incident.email_draft?.subject || '');
  const [body, setBody] = useState(incident.email_draft?.body || '');
  const [sending, setSending] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [error, setError] = useState(null);
  const toast = useToast();

  useEffect(() => {
    setSubject(incident.email_draft?.subject || '');
    setBody(incident.email_draft?.body || '');
  }, [incident.id, incident.email_draft?.subject, incident.email_draft?.body]);

  if (incident.status !== 'ready_for_review' || !incident.email_draft) return null;

  const dirty =
    subject !== (incident.email_draft?.subject || '') || body !== (incident.email_draft?.body || '');

  const handleConfirm = async () => {
    setSending(true);
    setError(null);
    try {
      if (dirty) {
        await updateIncidentDraft(businessId, incident.id, { email_subject: subject, email_body: body });
      }
      await confirmIncident(businessId, incident.id);
      toast.success('Email sent to your helpdesk.');
      onResolved();
    } catch (err) {
      setError(err.message || 'Could not send the email.');
    } finally {
      setSending(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    setError(null);
    try {
      await cancelIncident(businessId, incident.id);
      toast.info('Customer request cancelled.');
      onResolved();
    } catch (err) {
      setError(err.message || 'Could not cancel.');
    } finally {
      setCancelling(false);
    }
  };

  const handleCreateTicket = async () => {
    setCreatingTicket(true);
    setError(null);
    try {
      const ticket = await createTicketFromIncident(businessId, incident.id, {
        channel,
        assemblyai_session_id: assemblyaiSessionId || null,
      });
      toast.success(`Case ${ticket.ticket_number} created.`);
      onTicketCreated(ticket);
    } catch (err) {
      setError(err.message || 'Could not create the case.');
    } finally {
      setCreatingTicket(false);
    }
  };

  return (
    <div style={{
      background: 'rgba(113,145,255,0.06)', border: '1px solid rgba(113,145,255,0.3)',
      borderRadius: '14px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: '12px', fontWeight: 600, color: '#A8B7FF', margin: 0 }}>Review customer action</p>
        <p style={{ fontSize: '11px', color: '#34D399', margin: 0 }}>Ready to create a case</p>
      </div>

      <div style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(180,195,255,0.08)', borderRadius: '10px', padding: '12px', fontSize: '12px' }}>
        <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#5A6180', margin: '0 0 6px' }}>Requested outcome</p>
        <p style={{ fontSize: '13px', color: '#DCE5FF', whiteSpace: 'pre-wrap', margin: '0 0 10px' }}>
          {incident.fields?.issue_description || 'Customer follow-up requested'}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', fontSize: '11px', color: '#5A6180' }}>
          <span>Customer: {incident.fields?.customer_name || 'Not provided'}</span>
          {incident.fields?.order_reference && <span>Reference: {incident.fields.order_reference}</span>}
          {incident.fields?.customer_email && <span>Contact: {incident.fields.customer_email}</span>}
        </div>
      </div>

      {showEmail && (
        <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(180,195,255,0.08)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#DCE5FF', margin: 0 }}>Optional email</p>
            <p style={{ fontSize: '11px', color: '#5A6180', margin: 0 }}>To: {incident.email_draft.to}</p>
          </div>
          <div>
            <label style={{ fontSize: '11px', color: '#5A6180', display: 'block', marginBottom: '4px' }}>Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={300}
              style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(180,195,255,0.12)', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: '#DCE5FF', outline: 'none' }}
              onFocus={(e) => e.target.style.borderColor = 'rgba(113,145,255,0.5)'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(180,195,255,0.12)'}
            />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: '#5A6180', display: 'block', marginBottom: '4px' }}>Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              maxLength={8000}
              style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(180,195,255,0.12)', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', fontFamily: 'monospace', color: '#DCE5FF', outline: 'none', resize: 'none' }}
              onFocus={(e) => e.target.style.borderColor = 'rgba(113,145,255,0.5)'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(180,195,255,0.12)'}
            />
          </div>
        </div>
      )}

      {error && <ErrorMessage error={error} onDismiss={() => setError(null)} />}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <button
          onClick={handleCreateTicket}
          disabled={sending || cancelling || creatingTicket}
          style={{ background: 'linear-gradient(135deg, #34D399, #059669)', border: 'none', borderRadius: '10px', padding: '8px 14px', fontSize: '12px', fontWeight: 600, color: '#fff', cursor: 'pointer', opacity: sending || cancelling || creatingTicket ? 0.4 : 1 }}
        >
          {creatingTicket ? 'Creating…' : 'Create case'}
        </button>
        {showEmail ? (
          <button
            onClick={handleConfirm}
            disabled={sending || cancelling || creatingTicket || !subject.trim() || !body.trim()}
            style={{ ...BTN_PRIMARY, fontSize: '12px', padding: '8px 14px', opacity: sending || cancelling || creatingTicket || !subject.trim() || !body.trim() ? 0.4 : 1 }}
          >
            {sending ? 'Sending…' : 'Confirm & Send Email'}
          </button>
        ) : (
          <button
            onClick={() => setShowEmail(true)}
            disabled={sending || cancelling || creatingTicket}
            style={{ background: 'rgba(113,145,255,0.1)', border: '1px solid rgba(113,145,255,0.3)', borderRadius: '10px', padding: '8px 14px', fontSize: '12px', color: '#A8B7FF', cursor: 'pointer', opacity: sending || cancelling || creatingTicket ? 0.4 : 1 }}
          >
            Email this request
          </button>
        )}
        <button
          onClick={handleCancel}
          disabled={sending || cancelling || creatingTicket}
          style={{ ...BTN_GHOST, fontSize: '12px', padding: '8px 14px', opacity: sending || cancelling || creatingTicket ? 0.4 : 1 }}
        >
          {cancelling ? 'Cancelling…' : 'Cancel'}
        </button>
      </div>
      <p style={{ fontSize: '11px', color: '#5A6180', margin: 0 }}>
        Nothing is emailed automatically. Create a case, or explicitly open and confirm the optional email.
      </p>
    </div>
  );
}

function TestChat({ businessId, greeting, themeColor }) {
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [activeIncident, setActiveIncident] = useState(null);
  const [latestTicket, setLatestTicket] = useState(null);
  const [latestHandoff, setLatestHandoff] = useState(null);
  const [assemblyaiSessionId, setAssemblyaiSessionId] = useState(null);
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceMode, setVoiceMode] = useState(null);
  const [partial, setPartial] = useState(null);
  const voiceSessionRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeIncident, latestHandoff, partial]);

  useEffect(() => () => voiceSessionRef.current?.stop(), []);

  const reset = () => {
    voiceSessionRef.current?.stop();
    voiceSessionRef.current = null;
    setVoiceActive(false);
    setVoiceMode(null);
    setPartial(null);
    setSessionId(crypto.randomUUID());
    setMessages([]);
    setActiveIncident(null);
    setLatestTicket(null);
    setLatestHandoff(null);
    setAssemblyaiSessionId(null);
    setError(null);
  };

  const handleVoiceEvent = (event) => {
    switch (event.type) {
      case 'transcript.partial': setPartial(event.text); break;
      case 'transcript.final':
        setPartial(null);
        setMessages((prev) => [...prev, { role: 'customer', content: event.text }]);
        break;
      case 'agent.status': setSending(event.status === 'processing'); break;
      case 'agent.response':
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: event.text, grounded: event.grounded, sources: event.sources },
        ]);
        if (!event.audioManaged) speak(event.spoken_text || event.text);
        break;
      case 'incident.update': setActiveIncident(event.incident); break;
      case 'ticket.update':
        setLatestTicket(event.ticket);
        setActiveIncident(null);
        break;
      case 'voice.session': setAssemblyaiSessionId(event.sessionId || null); break;
      case 'handoff.update':
        setLatestHandoff(event.handoff);
        setActiveIncident(null);
        break;
      case 'agent.interrupted': stopSpeech(); break;
      case 'speech.started': stopSpeech(); break;
      case 'voice.mode': setVoiceMode(event.mode); break;
      case 'error': setError(event.message || 'Voice session error.'); break;
      default: break;
    }
  };

  const toggleVoice = async () => {
    if (voiceActive) {
      voiceSessionRef.current?.stop();
      voiceSessionRef.current = null;
      setVoiceActive(false);
      setVoiceMode(null);
      setPartial(null);
      stopSpeech();
      return;
    }
    setError(null);
    const managedSession = createAssemblyVoiceAgentSession(handleVoiceEvent, {
      sessionUrl: `${API_BASE}/businesses/${businessId}/voice-agent/session`,
      toolUrl: `${API_BASE}/businesses/${businessId}/voice-agent/tool`,
      sessionId,
    });
    voiceSessionRef.current = managedSession;
    try {
      await managedSession.start();
      setVoiceActive(true);
    } catch (err) {
      if (voiceSessionRef.current !== managedSession) return;
      managedSession.stop();
      if (err instanceof VoiceAgentUnavailableError || err?.fallbackAllowed) {
        const wsUrl = `${BUSINESS_VOICE_WS_BASE}/ws/business-voice/test/${businessId}?session_id=${encodeURIComponent(sessionId)}`;
        const fallbackSession = createVoiceSession(handleVoiceEvent, wsUrl);
        voiceSessionRef.current = fallbackSession;
        try {
          await fallbackSession.start();
          setVoiceMode('standard');
          setVoiceActive(true);
          setError(null);
          return;
        } catch (fallbackError) {
          fallbackSession.stop();
          voiceSessionRef.current = null;
          const msg =
            fallbackError?.name === 'NotAllowedError' ? 'Microphone permission denied.' :
            fallbackError?.name === 'NotFoundError' ? 'No microphone found.' :
            'Could not start voice session.';
          setError(msg);
          return;
        }
      }
      voiceSessionRef.current = null;
      const msg =
        err?.name === 'NotAllowedError' ? 'Microphone permission denied.' :
        err?.name === 'NotFoundError' ? 'No microphone found.' :
        'Could not start voice session.';
      setError(msg);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'customer', content: text }]);
    setSending(true);
    setError(null);
    try {
      const result = await sendTestMessage(businessId, text, sessionId);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: result.answer, grounded: result.grounded, sources: result.sources },
      ]);
      setActiveIncident(result.incident || null);
      if (result.ticket) {
        setLatestTicket(result.ticket);
        setActiveIncident(null);
      }
      if (result.handoff) {
        setLatestHandoff(result.handoff);
        setActiveIncident(null);
      }
    } catch (err) {
      setError(err.message || 'Could not get a response.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ ...GLASS, display: 'flex', flexDirection: 'column', height: '520px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid rgba(180,195,255,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: voiceActive ? '#34D399' : '#5A6180', transition: 'background 0.2s' }} />
          <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#DCE5FF', margin: 0 }}>Test your assistant</h2>
          {voiceActive && (
            <span style={{ padding: '2px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: 600, color: '#34D399', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)' }}>
              {voiceMode === 'assemblyai-managed' ? 'AssemblyAI Voice Agent' : 'Standard voice'}
            </span>
          )}
        </div>
        <button onClick={reset} style={{ background: 'none', border: 'none', fontSize: '12px', color: '#5A6180', cursor: 'pointer', transition: 'color 0.15s' }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#DCE5FF'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#5A6180'}
        >
          Reset
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Greeting */}
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <div style={{ maxWidth: '85%', borderRadius: '16px 16px 16px 4px', padding: '10px 14px', fontSize: '13px', color: '#fff', background: themeColor }}>
            {greeting}
          </div>
        </div>

        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'customer' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '85%',
              borderRadius: m.role === 'customer' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              padding: '10px 14px', fontSize: '13px',
              color: m.role === 'customer' ? '#DCE5FF' : '#fff',
              background: m.role === 'customer' ? 'rgba(255,255,255,0.08)' : themeColor,
              border: m.role === 'customer' ? '1px solid rgba(180,195,255,0.1)' : 'none',
            }}>
              <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}><MessageContent>{m.content}</MessageContent></p>
              {m.role === 'assistant' && !m.grounded && (
                <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', marginTop: '6px' }}>No matching info found</p>
              )}
              {m.role === 'assistant' && m.sources?.length > 0 && (
                <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', marginTop: '6px' }}>Source: {m.sources.join(', ')}</p>
              )}
            </div>
          </div>
        ))}

        {partial && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ maxWidth: '85%', borderRadius: '16px 16px 4px 16px', padding: '10px 14px', fontSize: '13px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(180,195,255,0.08)', color: '#5A6180', fontStyle: 'italic' }}>
              {partial}
            </div>
          </div>
        )}

        {sending && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <LoadingIndicator label="Thinking…" />
          </div>
        )}

        {activeIncident?.status === 'ready_for_review' && (
          <ActionReviewCard
            businessId={businessId}
            incident={activeIncident}
            channel={voiceActive ? 'voice' : 'chat'}
            assemblyaiSessionId={assemblyaiSessionId}
            onResolved={() => setActiveIncident(null)}
            onTicketCreated={(ticket) => {
              setLatestTicket(ticket);
              setActiveIncident(null);
            }}
          />
        )}

        {latestTicket && (
          <div style={{ background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: '12px', padding: '12px 16px' }} role="status">
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#34D399', margin: '0 0 4px' }}>Case {latestTicket.ticket_number} created</p>
            <p style={{ fontSize: '11px', color: '#5A6180', textTransform: 'capitalize', margin: 0 }}>
              {latestTicket.priority} priority · {latestTicket.category} · {latestTicket.status.replaceAll('_', ' ')}
            </p>
          </div>
        )}

        {latestHandoff && (
          <div style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '12px', padding: '12px 16px' }} role="status">
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#FBBF24', margin: '0 0 4px' }}>Human follow-up requested</p>
            <p style={{ fontSize: '11px', color: '#5A6180', margin: 0 }}>
              The business can see this conversation and escalation in the Action Center.
            </p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {error && (
        <div style={{ padding: '0 16px 8px' }}>
          <ErrorMessage error={error} onDismiss={() => setError(null)} />
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} style={{ display: 'flex', gap: '8px', padding: '12px 16px', borderTop: '1px solid rgba(180,195,255,0.07)' }}>
        <button
          type="button"
          onClick={toggleVoice}
          title={voiceActive ? 'Stop voice' : 'Speak to test the assistant'}
          style={{
            flexShrink: 0, borderRadius: '10px', padding: '9px 12px', fontSize: '14px', border: 'none', cursor: 'pointer',
            background: voiceActive ? '#EF4444' : 'rgba(255,255,255,0.08)',
            color: voiceActive ? '#fff' : '#A7AEC4',
            transition: 'all 0.15s',
          }}
        >
          {voiceActive ? '⏹' : '🎤'}
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask as a customer would…"
          style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(180,195,255,0.12)', borderRadius: '10px', padding: '9px 14px', fontSize: '13px', color: '#DCE5FF', outline: 'none' }}
          onFocus={(e) => e.target.style.borderColor = 'rgba(113,145,255,0.4)'}
          onBlur={(e) => e.target.style.borderColor = 'rgba(180,195,255,0.12)'}
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          style={{ ...BTN_PRIMARY, flexShrink: 0, opacity: sending || !input.trim() ? 0.4 : 1, cursor: sending || !input.trim() ? 'not-allowed' : 'pointer' }}
        >
          Send
        </button>
      </form>
    </div>
  );
}

export default function CustomizeAssistant() {
  const { business } = useBusiness();
  const [config, setConfig] = useState(undefined);
  const [loadError, setLoadError] = useState(null);
  const businessId = business?.id;

  const refresh = useCallback(async () => {
    if (!businessId) return;
    setLoadError(null);
    try {
      const cfg = await getAssistantConfig(businessId);
      setConfig(cfg);
    } catch (err) {
      setLoadError(err.message || 'Could not load assistant configuration.');
    }
  }, [businessId]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleSave = async (updates) => {
    const updated = await updateAssistantConfig(businessId, updates);
    setConfig(updated);
  };

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: '#DCE5FF' }}>
      <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '22px', fontWeight: 700, color: '#fff', margin: '0 0 6px' }}>
        Customize Assistant
      </h1>
      <p style={{ fontSize: '13px', color: '#5A6180', marginBottom: '24px' }}>
        Set your assistant's name, greeting, and tone, then try it out live using your uploaded knowledge base.
      </p>

      {loadError && <div style={{ marginBottom: '16px' }}><ErrorMessage error={loadError} onDismiss={() => setLoadError(null)} /></div>}

      {config === undefined ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '56px 0' }}>
          <LoadingIndicator label="Loading assistant…" />
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '20px', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', maxWidth: '900px' }}>
          <ConfigForm config={config} onSave={handleSave} />
          <TestChat businessId={businessId} greeting={config.greeting_message} themeColor={config.theme_color} />
        </div>
      )}
    </div>
  );
}
