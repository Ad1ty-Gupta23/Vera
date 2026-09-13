import API_BASE from './api';

async function handle(res) {
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

export async function listTickets(businessId) {
  return handle(await fetch(`${API_BASE}/businesses/${businessId}/support/tickets`, {
    credentials: 'include',
  }));
}

export async function createTicketFromIncident(businessId, incidentId, payload = {}) {
  return handle(await fetch(
    `${API_BASE}/businesses/${businessId}/support/tickets/from-incident/${incidentId}`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  ));
}

export async function updateTicket(businessId, ticketId, payload) {
  return handle(await fetch(`${API_BASE}/businesses/${businessId}/support/tickets/${ticketId}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }));
}

export async function listSupportOrders(businessId) {
  return handle(await fetch(`${API_BASE}/businesses/${businessId}/support/orders`, {
    credentials: 'include',
  }));
}

export async function loadDemoOrders(businessId) {
  return handle(await fetch(`${API_BASE}/businesses/${businessId}/support/orders/demo`, {
    method: 'POST',
    credentials: 'include',
  }));
}

export async function listVoiceCalls(businessId) {
  return handle(await fetch(`${API_BASE}/businesses/${businessId}/support/calls`, {
    credentials: 'include',
  }));
}

export async function listHandoffs(businessId) {
  return handle(await fetch(`${API_BASE}/businesses/${businessId}/support/handoffs`, {
    credentials: 'include',
  }));
}

export async function updateHandoff(businessId, handoffId, status) {
  return handle(await fetch(
    `${API_BASE}/businesses/${businessId}/support/handoffs/${handoffId}`,
    {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    },
  ));
}
