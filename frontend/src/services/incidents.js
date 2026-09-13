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

export async function updateIncidentDraft(businessId, incidentId, payload) {
  const res = await fetch(
    `${API_BASE}/businesses/${businessId}/assistant/incidents/${incidentId}`,
    {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return handle(res);
}

export async function confirmIncident(businessId, incidentId) {
  const res = await fetch(
    `${API_BASE}/businesses/${businessId}/assistant/incidents/${incidentId}/confirm`,
    { method: 'POST', credentials: 'include' }
  );
  return handle(res);
}

export async function cancelIncident(businessId, incidentId) {
  const res = await fetch(
    `${API_BASE}/businesses/${businessId}/assistant/incidents/${incidentId}/cancel`,
    { method: 'POST', credentials: 'include' }
  );
  return handle(res);
}
