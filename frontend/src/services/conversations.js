import API_BASE from './api';

import { handleAuthenticatedResponse as handle } from './apiResponse';

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
