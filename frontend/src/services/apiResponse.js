const sessionExpiryListeners = new Set();

export function subscribeToSessionExpiry(listener) {
  sessionExpiryListeners.add(listener);
  return () => sessionExpiryListeners.delete(listener);
}

// Only use this for VERA's authenticated APIs, not public widgets or providers.
export async function handleAuthenticatedResponse(res) {
  if (res.status === 401) {
    for (const listener of sessionExpiryListeners) listener();
  }
  if (res.status === 204) return null;

  let body = null;
  try {
    body = await res.json();
  } catch {
    // Gateways can return HTML instead of a JSON error body.
  }

  if (!res.ok) {
    const detail = body?.detail;
    const message = res.status === 401
      ? 'Your session is no longer valid. Please sign in again.'
      : (typeof detail === 'string' ? detail : `Request failed (${res.status})`);
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }
  return body;
}
