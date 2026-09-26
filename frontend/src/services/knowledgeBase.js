import API_BASE from './api';

import { handleAuthenticatedResponse as handle } from './apiResponse';

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

export async function listKnowledgeGaps(businessId, { signal } = {}) {
  const res = await fetch(`${API_BASE}/businesses/${businessId}/knowledge-base/gaps`, {
    credentials: 'include',
    signal,
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
