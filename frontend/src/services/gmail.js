import API_BASE from './api';

import { handleAuthenticatedResponse as handle } from './apiResponse';

export async function getGmailStatus() {
  const res = await fetch(`${API_BASE}/gmail/status`, { credentials: 'include' });
  return handle(res);
}

// Full-page navigation, not fetch — this needs to leave the SPA so the
// browser follows Google's OAuth consent redirect chain, exactly like the
// existing login flow (see AuthContext / Login.jsx's window.location use
// for /api/auth/google).
export function startGmailConnect() {
  window.location.href = `${API_BASE}/gmail/connect`;
}

export async function disconnectGmail() {
  const res = await fetch(`${API_BASE}/gmail/disconnect`, {
    method: 'POST',
    credentials: 'include',
  });
  return handle(res);
}
