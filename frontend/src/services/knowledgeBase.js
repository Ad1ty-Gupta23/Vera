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

export async function listDocuments(businessId) {
  const res = await fetch(`${API_BASE}/businesses/${businessId}/knowledge-base`, {
    credentials: 'include',
  });
  return handle(res);
}

export async function uploadDocument(businessId, file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/businesses/${businessId}/knowledge-base/upload`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  return handle(res);
}

export async function deleteDocument(businessId, documentId) {
  const res = await fetch(
    `${API_BASE}/businesses/${businessId}/knowledge-base/${documentId}`,
    { method: 'DELETE', credentials: 'include' }
  );
  return handle(res);
}

export async function queryKnowledgeBase(businessId, question) {
  const res = await fetch(`${API_BASE}/businesses/${businessId}/knowledge-base/query`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  return handle(res);
}

export async function listKnowledgeGaps(businessId) {
  const res = await fetch(`${API_BASE}/businesses/${businessId}/knowledge-base/gaps`, {
    credentials: 'include',
  });
  return handle(res);
}

export async function resolveKnowledgeGap(businessId, gapId, answer) {
  const res = await fetch(
    `${API_BASE}/businesses/${businessId}/knowledge-base/gaps/${gapId}/resolve`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer }),
    }
  );
  return handle(res);
}

export async function dismissKnowledgeGap(businessId, gapId) {
  const res = await fetch(
    `${API_BASE}/businesses/${businessId}/knowledge-base/gaps/${gapId}/dismiss`,
    { method: 'POST', credentials: 'include' }
  );
  return handle(res);
}

export async function getKnowledgeInsights(businessId) {
  const res = await fetch(`${API_BASE}/businesses/${businessId}/knowledge-base/insights`, {
    credentials: 'include',
  });
  return handle(res);
}
