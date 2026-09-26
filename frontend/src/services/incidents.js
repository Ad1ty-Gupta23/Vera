import API_BASE from './api';

import { handleAuthenticatedResponse as handle } from './apiResponse';

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
