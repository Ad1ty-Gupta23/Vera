import { useCallback, useEffect, useState } from 'react';
import { useBusiness } from '../../context/BusinessContext';
import { useToast } from '../../context/ToastContext';
import LoadingIndicator from '../../components/common/LoadingIndicator';
import ErrorMessage from '../../components/common/ErrorMessage';
import { getEmbedConfig, updateEmbedConfig, regenerateEmbedId } from '../../services/embed';

const GLASS = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(180,195,255,0.1)', borderRadius: '16px' };
const INPUT_STYLE = {
  width: '100%', boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(180,195,255,0.12)',
  borderRadius: '10px', padding: '10px 14px', fontSize: '13px', color: '#DCE5FF',
  outline: 'none', transition: 'border-color 0.2s',
};
const BTN_PRIMARY = {
  background: 'linear-gradient(135deg, #7191FF, #9B8CFF)', border: 'none', borderRadius: '10px',
  padding: '10px 20px', fontSize: '13px', fontWeight: 600, color: '#fff', cursor: 'pointer',
};
const BTN_GHOST = {
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(180,195,255,0.15)', borderRadius: '10px',
  padding: '8px 14px', fontSize: '12px', color: '#A7AEC4', cursor: 'pointer',
};

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Could not copy — select and copy the snippet manually.');
    }
  };

  return (
    <button
      onClick={handleCopy}
      style={{
        ...BTN_GHOST,
        color: copied ? '#34D399' : '#A7AEC4',
        borderColor: copied ? 'rgba(52,211,153,0.3)' : 'rgba(180,195,255,0.15)',
        transition: 'all 0.15s',
      }}
    >
      {copied ? '✓ Copied!' : 'Copy'}
    </button>
  );
}

export default function WebsiteEmbed() {
  const { business } = useBusiness();
  const businessId = business?.id;

  const [config, setConfig] = useState(undefined);
  const [loadError, setLoadError] = useState(null);
  const [origins, setOrigins] = useState('');
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const toast = useToast();

  const refresh = useCallback(async () => {
    if (!businessId) return;
    setLoadError(null);
    try {
      const cfg = await getEmbedConfig(businessId);
      setConfig(cfg);
      setOrigins(cfg.allowed_origins.join('\n'));
    } catch (err) {
      setLoadError(err.message || 'Could not load embed settings.');
    }
  }, [businessId]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleToggleEnabled = async () => {
    setSaving(true);
    try {
      const updated = await updateEmbedConfig(businessId, { embed_enabled: !config.embed_enabled });
      setConfig(updated);
      toast.success(updated.embed_enabled ? 'Widget is live on your website.' : 'Widget taken offline.');
    } catch (err) {
      toast.error(err.message || 'Could not update.');
    } finally {
      setSaving(false);
    }
  };

  const handlePositionChange = async (position) => {
    setSaving(true);
    try {
      const updated = await updateEmbedConfig(businessId, { widget_position: position });
      setConfig(updated);
    } catch (err) {
      toast.error(err.message || 'Could not update position.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOrigins = async () => {
    setSaving(true);
    try {
      const list = origins.split('\n').map((o) => o.trim()).filter(Boolean);
      const updated = await updateEmbedConfig(businessId, { allowed_origins: list });
      setConfig(updated);
      setOrigins(updated.allowed_origins.join('\n'));
      toast.success('Allowed websites updated.');
    } catch (err) {
      toast.error(err.message || 'Could not save allowed websites.');
    }
    setSaving(false);
  };

  const handleRegenerate = async () => {
    if (!window.confirm('This immediately breaks any snippet already installed using the old code. Continue?')) return;
    setRegenerating(true);
    try {
      const updated = await regenerateEmbedId(businessId);
      setConfig(updated);
      setOrigins(updated.allowed_origins.join('\n'));
      toast.success('New embed code generated — update it on your website.');
    } catch (err) {
      toast.error(err.message || 'Could not regenerate.');
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div style={{ maxWidth: '640px', fontFamily: "'Inter', system-ui, sans-serif", color: '#DCE5FF' }}>
      <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '22px', fontWeight: 700, color: '#fff', margin: '0 0 6px' }}>
        Website Embed
      </h1>
      <p style={{ fontSize: '13px', color: '#5A6180', marginBottom: '24px' }}>
        Add this snippet to your website to give visitors your assistant — knowledge base answers, issue reporting, and everything else you've configured, right on your own site.
      </p>

      {loadError && <div style={{ marginBottom: '16px' }}><ErrorMessage error={loadError} onDismiss={() => setLoadError(null)} /></div>}

      {config === undefined ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '56px 0' }}>
          <LoadingIndicator label="Loading embed settings…" />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Status toggle */}
          <div style={{ ...GLASS, padding: '20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{
                  width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block',
                  background: config.embed_enabled ? '#34D399' : '#5A6180',
                }} />
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#DCE5FF', margin: 0 }}>
                  {config.embed_enabled ? 'Widget is live' : 'Widget is offline'}
                </p>
              </div>
              <p style={{ fontSize: '12px', color: '#5A6180', maxWidth: '320px', margin: 0 }}>
                {config.embed_enabled
                  ? 'Anywhere the snippet below is installed, visitors can chat with your assistant.'
                  : 'The snippet is installed but will show nothing until you turn this back on.'}
              </p>
            </div>
            <button
              onClick={handleToggleEnabled}
              disabled={saving}
              style={{
                flexShrink: 0, ...(config.embed_enabled ? BTN_GHOST : BTN_PRIMARY),
                opacity: saving ? 0.5 : 1,
              }}
            >
              {config.embed_enabled ? 'Take offline' : 'Publish widget'}
            </button>
          </div>

          {/* Embed code */}
          <div style={{ ...GLASS, padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#DCE5FF', margin: 0 }}>Embed code</h2>
              <CopyButton text={config.snippet} />
            </div>
            <p style={{ fontSize: '12px', color: '#5A6180', marginBottom: '12px' }}>
              Paste this right before the closing <code style={{ color: '#A8B7FF' }}>&lt;/body&gt;</code> tag on every page you want the assistant to appear.
            </p>
            <pre style={{
              background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(180,195,255,0.08)',
              borderRadius: '10px', padding: '14px', fontSize: '11px', lineHeight: '1.6',
              color: '#A8B7FF', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
              margin: 0,
            }}>
{config.snippet}
            </pre>
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: '11px', color: '#5A6180', margin: 0 }}>
                Assistant ID: <span style={{ fontFamily: 'monospace', color: '#A7AEC4' }}>{config.public_id}</span>
              </p>
              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                style={{ background: 'none', border: 'none', fontSize: '12px', color: '#F87171', cursor: 'pointer', opacity: regenerating ? 0.5 : 1 }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#FCA5A5'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#F87171'}
              >
                {regenerating ? 'Generating…' : 'Regenerate code'}
              </button>
            </div>
          </div>

          {/* Widget position */}
          <div style={{ ...GLASS, padding: '20px' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#DCE5FF', margin: '0 0 6px' }}>Widget position</h2>
            <p style={{ fontSize: '12px', color: '#5A6180', marginBottom: '14px' }}>Where the chat bubble appears on your site.</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[{ value: 'bottom-right', label: 'Bottom right' }, { value: 'bottom-left', label: 'Bottom left' }].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handlePositionChange(opt.value)}
                  disabled={saving}
                  style={{
                    ...(config.widget_position === opt.value ? BTN_PRIMARY : BTN_GHOST),
                    opacity: saving ? 0.5 : 1,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Allowed origins */}
          <div style={{ ...GLASS, padding: '20px' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#DCE5FF', margin: '0 0 6px' }}>Allowed websites</h2>
            <p style={{ fontSize: '12px', color: '#5A6180', marginBottom: '14px', maxWidth: '400px' }}>
              Optional. Restrict the widget to specific websites, one per line, e.g. <span style={{ color: '#A7AEC4' }}>https://www.yourbusiness.com</span>. Leave empty while you're testing.
            </p>
            <textarea
              value={origins}
              onChange={(e) => setOrigins(e.target.value)}
              rows={3}
              placeholder={'https://www.yourbusiness.com\nhttps://yourbusiness.com'}
              style={{ ...INPUT_STYLE, resize: 'none', fontFamily: 'monospace', marginBottom: '12px' }}
              onFocus={(e) => e.target.style.borderColor = 'rgba(113,145,255,0.5)'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(180,195,255,0.12)'}
            />
            <button
              onClick={handleSaveOrigins}
              disabled={saving}
              style={{ ...BTN_PRIMARY, opacity: saving ? 0.5 : 1 }}
            >
              {saving ? 'Saving…' : 'Save allowed websites'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
