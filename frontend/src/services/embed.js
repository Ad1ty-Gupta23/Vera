import API_BASE from './api';

import { handleAuthenticatedResponse as handle } from './apiResponse';

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
