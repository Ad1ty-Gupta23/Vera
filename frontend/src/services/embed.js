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

export async function getEmbedConfig(businessId) {
  const res = await fetch(`${API_BASE}/businesses/${businessId}/embed`, {
    credentials: 'include',
  });
  return handle(res);
}

export async function updateEmbedConfig(businessId, payload) {
  const res = await fetch(`${API_BASE}/businesses/${businessId}/embed`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handle(res);
}

export async function regenerateEmbedId(businessId) {
  const res = await fetch(`${API_BASE}/businesses/${businessId}/embed/regenerate`, {
    method: 'POST',
    credentials: 'include',
  });
  return handle(res);
}
