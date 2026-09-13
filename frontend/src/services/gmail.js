import API_BASE from './api';

async function handle(res) {
  if (res.status === 204) return null;
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const message = body?.detail || `Request failed (${res.status})`;
    throw new Error(typeof message === 'string' ? message : 'Request failed');
  }
  return body;
}

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
