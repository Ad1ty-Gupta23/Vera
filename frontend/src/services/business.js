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

// --- Subscription -----------------------------------------------------

export async function getSubscription() {
  const res = await fetch(`${API_BASE}/subscriptions/me`, { credentials: 'include' });
  return handle(res);
}

export async function selectPlan(plan) {
  const res = await fetch(`${API_BASE}/subscriptions/select`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan }),
  });
  return handle(res);
}

// --- Business workspaces -----------------------------------------------

export async function listBusinesses() {
  const res = await fetch(`${API_BASE}/businesses`, { credentials: 'include' });
  return handle(res);
}

export async function createBusiness(payload) {
  const res = await fetch(`${API_BASE}/businesses`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handle(res);
}

export async function updateBusiness(businessId, payload) {
  const res = await fetch(`${API_BASE}/businesses/${businessId}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handle(res);
}

export async function deleteBusiness(businessId) {
  const res = await fetch(`${API_BASE}/businesses/${businessId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  return handle(res);
}
