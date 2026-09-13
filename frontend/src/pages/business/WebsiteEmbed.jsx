import { useCallback, useEffect, useState } from 'react';
import { useBusiness } from '../../context/BusinessContext';
import { useToast } from '../../context/ToastContext';
import LoadingIndicator from '../../components/common/LoadingIndicator';
import ErrorMessage from '../../components/common/ErrorMessage';
import { getEmbedConfig, updateEmbedConfig, regenerateEmbedId } from '../../services/embed';

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
      className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

export default function WebsiteEmbed() {
  const { business } = useBusiness();
  const businessId = business?.id;

  const [config, setConfig] = useState(undefined); // undefined = loading
  const [loadError, setLoadError] = useState(null);
  const [origins, setOrigins] = useState(''); // textarea, one per line
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

  useEffect(() => {
    refresh();
  }, [refresh]);

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
      const list = origins
        .split('\n')
        .map((o) => o.trim())
        .filter(Boolean);
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
    if (!window.confirm('This immediately breaks any snippet already installed using the old code. Continue?')) {
      return;
    }
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
    <div>
      <h1 className="text-xl font-semibold text-slate-100">Website Embed</h1>
      <p className="text-sm text-slate-500 mt-1 max-w-2xl">
        Add this snippet to your website to give visitors your assistant — knowledge base answers,
        issue reporting, and everything else you've configured, right on your own site.
      </p>

      {loadError && (
        <div className="mt-6 max-w-2xl">
          <ErrorMessage error={loadError} onDismiss={() => setLoadError(null)} />
        </div>
      )}

      {config === undefined ? (
        <div className="flex justify-center py-14">
          <LoadingIndicator label="Loading embed settings…" />
        </div>
      ) : (
        <div className="mt-6 max-w-2xl space-y-6">
          {/* Status */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${config.embed_enabled ? 'bg-emerald-400' : 'bg-slate-600'}`}
                />
                <p className="text-sm font-medium text-slate-200">
                  {config.embed_enabled ? 'Widget is live' : 'Widget is offline'}
                </p>
              </div>
              <p className="text-xs text-slate-500 mt-1.5 max-w-sm">
                {config.embed_enabled
                  ? 'Anywhere the snippet below is installed, visitors can chat with your assistant.'
                  : 'The snippet is installed but will show nothing until you turn this back on.'}
              </p>
            </div>
            <button
              onClick={handleToggleEnabled}
              disabled={saving}
              className={`shrink-0 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors disabled:opacity-40 ${
                config.embed_enabled
                  ? 'border border-slate-700 text-slate-300 hover:bg-slate-800'
                  : 'bg-violet-600 text-white hover:bg-violet-500'
              }`}
            >
              {config.embed_enabled ? 'Take offline' : 'Publish widget'}
            </button>
          </div>

          {/* Snippet */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-slate-200">Embed code</h2>
              <CopyButton text={config.snippet} />
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              Paste this right before the closing <code className="text-slate-400">&lt;/body&gt;</code> tag on
              every page you want the assistant to appear.
            </p>
            <pre className="mt-3 rounded-lg bg-slate-950 border border-slate-800 p-3.5 text-[11px] leading-relaxed text-slate-300 overflow-x-auto whitespace-pre-wrap break-all">
{config.snippet}
            </pre>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-[11px] text-slate-600">
                Assistant ID: <span className="font-mono text-slate-500">{config.public_id}</span>
              </p>
              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-40"
              >
                {regenerating ? 'Generating…' : 'Regenerate code'}
              </button>
            </div>
          </div>

          {/* Position */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <h2 className="text-sm font-medium text-slate-200">Widget position</h2>
            <p className="text-xs text-slate-500 mt-1.5">Where the chat bubble appears on your site.</p>
            <div className="mt-3 flex gap-2">
              {[
                { value: 'bottom-right', label: 'Bottom right' },
                { value: 'bottom-left', label: 'Bottom left' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handlePositionChange(opt.value)}
                  disabled={saving}
                  className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-colors disabled:opacity-40 ${
                    config.widget_position === opt.value
                      ? 'bg-violet-600 text-white'
                      : 'border border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Allowed origins */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <h2 className="text-sm font-medium text-slate-200">Allowed websites</h2>
            <p className="text-xs text-slate-500 mt-1.5 max-w-md">
              Optional. Restrict the widget to specific websites, one per line, e.g.{' '}
              <span className="text-slate-400">https://www.yourbusiness.com</span>. Leave empty while
              you're testing — it works anywhere until you lock it down.
            </p>
            <textarea
              value={origins}
              onChange={(e) => setOrigins(e.target.value)}
              rows={3}
              placeholder={'https://www.yourbusiness.com\nhttps://yourbusiness.com'}
              className="mt-3 w-full rounded-lg bg-slate-900 border border-slate-700/60 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all resize-none font-mono text-xs"
            />
            <button
              onClick={handleSaveOrigins}
              disabled={saving}
              className="mt-3 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving…' : 'Save allowed websites'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
