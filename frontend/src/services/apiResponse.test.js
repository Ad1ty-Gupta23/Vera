import { describe, expect, it, vi } from 'vitest';
import { handleAuthenticatedResponse, subscribeToSessionExpiry } from './apiResponse';

describe('authenticated API responses', () => {
  it('returns successful JSON and handles empty responses', async () => {
    await expect(handleAuthenticatedResponse(Response.json({ ok: true }))).resolves.toEqual({ ok: true });
    await expect(handleAuthenticatedResponse(new Response(null, { status: 204 }))).resolves.toBeNull();
  });

  it('invalidates the session on 401 and preserves the status for callers', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToSessionExpiry(listener);
    try {
      await expect(handleAuthenticatedResponse(Response.json({ detail: 'User not found' }, { status: 401 })))
        .rejects.toMatchObject({ status: 401, message: 'Your session is no longer valid. Please sign in again.' });
      expect(listener).toHaveBeenCalledTimes(1);
      unsubscribe();
      await expect(handleAuthenticatedResponse(new Response('Unauthorized', { status: 401 })))
        .rejects.toHaveProperty('status', 401);
      expect(listener).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe();
    }
  });

  it.each([403, 404, 422, 502])('does not invalidate a session on %s', async (status) => {
    const listener = vi.fn();
    const unsubscribe = subscribeToSessionExpiry(listener);
    try {
      await expect(handleAuthenticatedResponse(new Response('Not JSON', { status })))
        .rejects.toMatchObject({ status, message: `Request failed (${status})` });
      expect(listener).not.toHaveBeenCalled();
    } finally {
      unsubscribe();
    }
  });
});
