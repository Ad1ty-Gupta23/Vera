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

export async function listConversations(businessId) {
  const res = await fetch(`${API_BASE}/businesses/${businessId}/conversations`, {
    credentials: 'include',
  });
  return handle(res);
}

export async function getConversation(businessId, conversationId) {
  const res = await fetch(
    `${API_BASE}/businesses/${businessId}/conversations/${conversationId}`,
    { credentials: 'include' }
  );
  return handle(res);
}
