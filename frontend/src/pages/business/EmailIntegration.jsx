import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import LoadingIndicator from '../../components/common/LoadingIndicator';
import ErrorMessage from '../../components/common/ErrorMessage';
import { getGmailStatus, startGmailConnect, disconnectGmail } from '../../services/gmail';

const ERROR_MESSAGES = {
  gmail_connect_failed: "Google couldn't complete the connection. Please try again.",
  oauth_failed: "Google couldn't complete the connection. Please try again.",
};

export default function EmailIntegration() {
  const [status, setStatus] = useState(undefined); // undefined = loading
  const [loadError, setLoadError] = useState(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      const s = await getGmailStatus();
      setStatus(s);
    } catch (err) {
      setLoadError(err.message || 'Could not load Gmail connection status.');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (searchParams.get('gmail') === 'connected') {
      toast.success('Gmail connected.');
      setSearchParams({}, { replace: true });
    }
    const gmailError = searchParams.get('gmail_error');
    if (gmailError) {
      toast.error(ERROR_MESSAGES[gmailError] || 'Could not connect Gmail. Please try again.');
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnectGmail();
      toast.success('Gmail disconnected.');
      await refresh();
    } catch (err) {
      toast.error(err.message || 'Could not disconnect Gmail.');
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-100">Email Integration</h1>
      <p className="text-sm text-slate-500 mt-1 max-w-2xl">
        Connect your Gmail account so your assistant can send customer issue reports to your
        helpdesk email. Customers always review and confirm the email before anything sends —
        nothing goes out automatically.
      </p>

      {loadError && (
        <div className="mt-6 max-w-2xl">
          <ErrorMessage error={loadError} onDismiss={() => setLoadError(null)} />
        </div>
      )}

      {status === undefined ? (
        <div className="flex justify-center py-14">
          <LoadingIndicator label="Checking Gmail connection…" />
        </div>
      ) : (
        <div className="mt-6 max-w-2xl rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          {status.connected ? (
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <p className="text-sm font-medium text-slate-200">Gmail connected</p>
                </div>
                <p className="text-sm text-slate-400 mt-1.5">{status.email}</p>
                <p className="text-xs text-slate-600 mt-2 max-w-md">
                  Issue-report emails send from this account to your configured helpdesk email.
                  You can change the helpdesk email in Settings.
                </p>
              </div>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="shrink-0 rounded-lg border border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-40"
              >
                {disconnecting ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    status.status === 'needs_reauth' ? 'bg-amber-400' : 'bg-slate-600'
                  }`}
                />
                <p className="text-sm font-medium text-slate-200">
                  {status.status === 'needs_reauth' ? 'Reconnect needed' : 'Gmail not connected'}
                </p>
              </div>
              <p className="text-sm text-slate-500 mt-1.5 max-w-md">
                {status.status === 'needs_reauth'
                  ? 'Your Gmail connection expired or was revoked in your Google Account. Reconnect to keep sending issue reports.'
                  : 'Connect Gmail to let your assistant email customer issue reports to your helpdesk.'}
              </p>
              <button
                onClick={startGmailConnect}
                className="mt-4 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500 transition-colors"
              >
                {status.status === 'needs_reauth' ? 'Reconnect Gmail' : 'Connect Gmail'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
