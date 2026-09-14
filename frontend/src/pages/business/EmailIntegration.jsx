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

const GLASS = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(180,195,255,0.1)', borderRadius: '16px' };
const BTN_PRIMARY = {
  background: 'linear-gradient(135deg, #7191FF, #9B8CFF)', border: 'none', borderRadius: '10px',
  padding: '10px 20px', fontSize: '13px', fontWeight: 600, color: '#fff', cursor: 'pointer',
};
const BTN_GHOST = {
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(180,195,255,0.15)', borderRadius: '10px',
  padding: '8px 16px', fontSize: '12px', color: '#A7AEC4', cursor: 'pointer',
};

export default function EmailIntegration() {
  const [status, setStatus] = useState(undefined);
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

  useEffect(() => { refresh(); }, [refresh]);

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
    <div style={{ maxWidth: '640px', fontFamily: "'Inter', system-ui, sans-serif", color: '#DCE5FF' }}>
      <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '22px', fontWeight: 700, color: '#fff', margin: '0 0 6px' }}>
        Email Integration
      </h1>
      <p style={{ fontSize: '13px', color: '#5A6180', marginBottom: '24px' }}>
        Connect your Gmail account so your assistant can send customer issue reports to your helpdesk email. Customers always review and confirm the email before anything sends — nothing goes out automatically.
      </p>

      {loadError && <div style={{ marginBottom: '16px' }}><ErrorMessage error={loadError} onDismiss={() => setLoadError(null)} /></div>}

      {status === undefined ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '56px 0' }}>
          <LoadingIndicator label="Checking Gmail connection…" />
        </div>
      ) : (
        <div style={{ ...GLASS, padding: '24px' }}>
          {status.connected ? (
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34D399', display: 'inline-block' }} />
                  <p style={{ fontSize: '14px', fontWeight: 600, color: '#DCE5FF', margin: 0 }}>Gmail connected</p>
                </div>
                <p style={{ fontSize: '13px', color: '#A7AEC4', margin: '0 0 8px' }}>{status.email}</p>
                <p style={{ fontSize: '11px', color: '#5A6180', maxWidth: '360px' }}>
                  Issue-report emails send from this account to your configured helpdesk email. You can change the helpdesk email in Settings.
                </p>
              </div>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                style={{ ...BTN_GHOST, flexShrink: 0, opacity: disconnecting ? 0.5 : 1 }}
              >
                {disconnecting ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{
                  width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block',
                  background: status.status === 'needs_reauth' ? '#FBBF24' : '#5A6180',
                }} />
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#DCE5FF', margin: 0 }}>
                  {status.status === 'needs_reauth' ? 'Reconnect needed' : 'Gmail not connected'}
                </p>
              </div>
              <p style={{ fontSize: '13px', color: '#5A6180', maxWidth: '400px', marginBottom: '20px' }}>
                {status.status === 'needs_reauth'
                  ? 'Your Gmail connection expired or was revoked in your Google Account. Reconnect to keep sending issue reports.'
                  : 'Connect Gmail to let your assistant email customer issue reports to your helpdesk.'}
              </p>
              <button onClick={startGmailConnect} style={BTN_PRIMARY}>
                {status.status === 'needs_reauth' ? 'Reconnect Gmail' : 'Connect Gmail'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
