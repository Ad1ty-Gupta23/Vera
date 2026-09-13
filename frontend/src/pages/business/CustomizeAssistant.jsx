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

function MessageContent({ children }) {
  return String(children || '').split(MESSAGE_URL_RE).map((part, index) => (
    /^https?:\/\//i.test(part) ? (
      <a
        key={index}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 break-all"
      >
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

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-5">
      <div>
        <label className="text-xs text-slate-400">Assistant name</label>
        <input
          value={form.assistant_name}
          onChange={(e) => setForm((f) => ({ ...f, assistant_name: e.target.value }))}
          maxLength={80}
          required
          className="mt-1.5 w-full rounded-lg bg-slate-900 border border-slate-700/60 px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all"
        />
      </div>

      <div>
        <label className="text-xs text-slate-400">Greeting message</label>
        <textarea
          value={form.greeting_message}
          onChange={(e) => setForm((f) => ({ ...f, greeting_message: e.target.value }))}
          maxLength={500}
          required
          rows={2}
          className="mt-1.5 w-full rounded-lg bg-slate-900 border border-slate-700/60 px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all resize-none"
        />
        <p className="text-[11px] text-slate-600 mt-1">Shown as the first message customers see.</p>
      </div>

      <div>
        <label className="text-xs text-slate-400">Custom instructions (optional)</label>
        <textarea
          value={form.custom_instructions || ''}
          onChange={(e) => setForm((f) => ({ ...f, custom_instructions: e.target.value }))}
          maxLength={4000}
          rows={4}
          placeholder="e.g. Always mention our 30-day return window when discussing refunds."
          className="mt-1.5 w-full rounded-lg bg-slate-900 border border-slate-700/60 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all resize-none"
        />
        <p className="text-[11px] text-slate-600 mt-1">
          Extra tone or policy guidance layered on top of your knowledge base — this can't override
          how the assistant handles security or grounding.
        </p>
      </div>

      <div>
        <label className="text-xs text-slate-400">Theme color</label>
        <div className="mt-1.5 flex items-center gap-2">
          {THEME_PRESETS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setForm((f) => ({ ...f, theme_color: color }))}
              className={`w-7 h-7 rounded-full transition-all ${
                form.theme_color === color ? 'ring-2 ring-offset-2 ring-offset-slate-900 ring-slate-200' : ''
              }`}
              style={{ backgroundColor: color }}
              aria-label={`Use theme color ${color}`}
            />
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={!dirty || saving}
        className="rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
    <div className="rounded-xl border border-violet-600/30 bg-violet-600/[0.06] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-violet-300">Review customer action</p>
        <p className="text-[11px] text-emerald-400">Ready to create a case</p>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs">
        <p className="text-[10px] uppercase tracking-wider text-slate-600">Requested outcome</p>
        <p className="mt-1.5 whitespace-pre-wrap text-slate-200">
          {incident.fields?.issue_description || 'Customer follow-up requested'}
        </p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500">
          <span>Customer: {incident.fields?.customer_name || 'Not provided'}</span>
          {incident.fields?.order_reference && <span>Reference: {incident.fields.order_reference}</span>}
          {incident.fields?.customer_email && <span>Contact: {incident.fields.customer_email}</span>}
        </div>
      </div>

      {showEmail && (
        <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium text-slate-300">Optional email</p>
            <p className="text-[10px] text-slate-600">To: {incident.email_draft.to}</p>
          </div>
          <div>
            <label className="text-[11px] text-slate-500">Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={300}
              className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700/60 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-500">Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              maxLength={8000}
              className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700/60 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all resize-none font-mono text-xs"
            />
          </div>
        </div>
      )}

      {error && <ErrorMessage error={error} onDismiss={() => setError(null)} />}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleCreateTicket}
          disabled={sending || cancelling || creatingTicket}
          className="rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-emerald-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {creatingTicket ? 'Creating…' : 'Create case'}
        </button>
        {showEmail ? (
          <button
            onClick={handleConfirm}
            disabled={sending || cancelling || creatingTicket || !subject.trim() || !body.trim()}
            className="rounded-lg bg-violet-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-violet-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sending ? 'Sending…' : 'Confirm & Send Email'}
          </button>
        ) : (
          <button
            onClick={() => setShowEmail(true)}
            disabled={sending || cancelling || creatingTicket}
            className="rounded-lg border border-violet-500/30 px-3.5 py-2 text-xs font-medium text-violet-300 hover:bg-violet-500/10 transition-colors disabled:opacity-40"
          >
            Email this request
          </button>
        )}
        <button
          onClick={handleCancel}
          disabled={sending || cancelling || creatingTicket}
          className="rounded-lg border border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-40"
        >
          {cancelling ? 'Cancelling…' : 'Cancel'}
        </button>
      </div>
      <p className="text-[10px] text-slate-600">
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
      case 'transcript.partial':
        setPartial(event.text);
        break;
      case 'transcript.final':
        setPartial(null);
        setMessages((prev) => [...prev, { role: 'customer', content: event.text }]);
        break;
      case 'agent.status':
        setSending(event.status === 'processing');
        break;
      case 'agent.response':
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: event.text, grounded: event.grounded, sources: event.sources },
        ]);
        // Managed Voice Agent replies already arrive as natural PCM audio.
        // The established voice path still uses browser speech synthesis.
        if (!event.audioManaged) speak(event.spoken_text || event.text);
        break;
      case 'incident.update':
        setActiveIncident(event.incident);
        break;
      case 'ticket.update':
        setLatestTicket(event.ticket);
        setActiveIncident(null);
        break;
      case 'voice.session':
        setAssemblyaiSessionId(event.sessionId || null);
        break;
      case 'handoff.update':
        setLatestHandoff(event.handoff);
        setActiveIncident(null);
        break;
      case 'agent.interrupted':
        stopSpeech();
        break;
      case 'speech.started':
        // Standard voice mode receives this before the backend finishes
        // cancelling its previous turn, so stop browser TTS immediately.
        stopSpeech();
        break;
      case 'voice.mode':
        setVoiceMode(event.mode);
        break;
      case 'error':
        setError(event.message || 'Voice session error.');
        break;
      default:
        break;
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
      // Reset/unmount may intentionally stop a connection while start() is
      // still waiting for session.ready. Do not revive it via fallback.
      if (voiceSessionRef.current !== managedSession) return;
      managedSession.stop();
      // The feature flag, account access, or provider may be unavailable.
      // Fall back transparently to the voice implementation VERA already had.
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
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col h-[520px]">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800/70">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-slate-200">Test your assistant</h2>
          {voiceActive && (
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
              {voiceMode === 'assemblyai-managed' ? 'AssemblyAI Voice Agent' : 'Standard voice'}
            </span>
          )}
        </div>
        <button
          onClick={reset}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          Reset conversation
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        <div className="flex justify-start">
          <div
            className="max-w-[85%] rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm text-white"
            style={{ backgroundColor: themeColor }}
          >
            {greeting}
          </div>
        </div>
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'customer' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={
                m.role === 'customer'
                  ? 'max-w-[85%] rounded-2xl rounded-br-sm px-4 py-2.5 text-sm bg-slate-800 text-slate-100'
                  : 'max-w-[85%] rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm text-white'
              }
              style={m.role === 'assistant' ? { backgroundColor: themeColor } : undefined}
            >
              <p className="whitespace-pre-wrap"><MessageContent>{m.content}</MessageContent></p>
              {m.role === 'assistant' && !m.grounded && (
                <p className="text-[10px] text-white/70 mt-1.5">No matching info found</p>
              )}
              {m.role === 'assistant' && m.sources?.length > 0 && (
                <p className="text-[10px] text-white/70 mt-1.5">Source: {m.sources.join(', ')}</p>
              )}
            </div>
          </div>
        ))}
        {partial && (
          <div className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-br-sm px-4 py-2.5 text-sm bg-slate-800/60 text-slate-400 italic">
              {partial}
            </div>
          </div>
        )}
        {sending && (
          <div className="flex justify-start">
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
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] px-4 py-3" role="status">
            <p className="text-xs font-medium text-emerald-300">Case {latestTicket.ticket_number} created</p>
            <p className="mt-1 text-[11px] capitalize text-slate-500">
              {latestTicket.priority} priority · {latestTicket.category} · {latestTicket.status.replaceAll('_', ' ')}
            </p>
          </div>
        )}
        {latestHandoff && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-4 py-3" role="status">
            <p className="text-xs font-medium text-amber-300">Human follow-up requested</p>
            <p className="mt-1 text-[11px] text-slate-500">
              The business can see this conversation and escalation in the Action Center.
            </p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <div className="px-5 pb-2">
          <ErrorMessage error={error} onDismiss={() => setError(null)} />
        </div>
      )}

      <form onSubmit={handleSend} className="flex gap-2 px-5 py-3 border-t border-slate-800/70">
        <button
          type="button"
          onClick={toggleVoice}
          title={voiceActive ? 'Stop voice' : 'Speak to test the assistant'}
          className={
            'rounded-lg px-3 py-2.5 text-sm font-medium transition-colors shrink-0 ' +
            (voiceActive
              ? 'bg-red-600 text-white hover:bg-red-500'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700')
          }
        >
          {voiceActive ? '⏹ Stop' : '🎤'}
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask as a customer would…"
          className="flex-1 rounded-lg bg-slate-900 border border-slate-700/60 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          Send
        </button>
      </form>
    </div>
  );
}

export default function CustomizeAssistant() {
  const { business } = useBusiness();
  const [config, setConfig] = useState(undefined); // undefined = loading
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

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSave = async (updates) => {
    const updated = await updateAssistantConfig(businessId, updates);
    setConfig(updated);
  };

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-100">Customize Assistant</h1>
      <p className="text-sm text-slate-500 mt-1">
        Set your assistant's name, greeting, and tone, then try it out live using your uploaded
        knowledge base.
      </p>

      {loadError && (
        <div className="mt-6">
          <ErrorMessage error={loadError} onDismiss={() => setLoadError(null)} />
        </div>
      )}

      {config === undefined ? (
        <div className="flex justify-center py-14">
          <LoadingIndicator label="Loading assistant…" />
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-2 max-w-5xl">
          <ConfigForm config={config} onSave={handleSave} />
          <TestChat businessId={businessId} greeting={config.greeting_message} themeColor={config.theme_color} />
        </div>
      )}
    </div>
  );
}
