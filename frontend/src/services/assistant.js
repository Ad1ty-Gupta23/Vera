import API_BASE from './api';

import { handleAuthenticatedResponse as handle } from './apiResponse';

export async function getAssistantConfig(businessId) {
  const res = await fetch(`${API_BASE}/businesses/${businessId}/assistant`, {
    credentials: 'include',
  });
  return handle(res);
}

export async function updateAssistantConfig(businessId, payload) {
  const res = await fetch(`${API_BASE}/businesses/${businessId}/assistant`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handle(res);
}

export async function sendTestMessage(businessId, message, sessionId) {
  const res = await fetch(`${API_BASE}/businesses/${businessId}/assistant/test`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, session_id: sessionId }),
  });
  return handle(res);
}
