import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ToastProvider, useToast } from '../context/ToastContext';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import KnowledgeBase from '../pages/business/KnowledgeBase';
import { handleAuthenticatedResponse } from '../services/apiResponse';
import { listKnowledgeGaps } from '../services/knowledgeBase';

vi.mock('../context/BusinessContext', () => ({
  useBusiness: () => ({ business: { id: 1 } }),
}));

let container;
let root;
let toast;
let auth;

function Probe() {
  const currentToast = useToast();
  useEffect(() => { toast = currentToast; }, [currentToast]);
  return null;
}

function AuthProbe() {
  const currentAuth = useAuth();
  useEffect(() => { auth = currentAuth; }, [currentAuth]);
  return null;
}

function LoginLocation() {
  const location = useLocation();
  return <p>{location.pathname}{location.search}</p>;
}

async function mount(ui) {
  await act(async () => { root.render(ui); });
}

function callsFor(fetchMock, path) {
  return fetchMock.mock.calls.filter(([url]) => String(url).endsWith(path));
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  toast = undefined;
  auth = undefined;
});

afterEach(async () => {
  await act(async () => { root.unmount(); });
  container.remove();
  vi.useRealTimers();
});

describe('knowledge-base request recovery', () => {
  it('keeps toast actions stable when notifications appear and disappear', async () => {
    vi.useFakeTimers();
    await mount(<ToastProvider><Probe /></ToastProvider>);
    const originalToast = toast;
    await act(async () => { toast.error('A temporary error'); });
    expect(container.textContent).toContain('A temporary error');
    expect(toast).toBe(originalToast);
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(container.textContent).not.toContain('A temporary error');
    expect(toast).toBe(originalToast);
  });

  it('does not repeat failed gap requests or refetch when another toast changes', async () => {
    vi.useFakeTimers();
    let failing = true;
    const fetchMock = vi.fn(async (url) => {
      if (String(url).endsWith('/gaps') && failing) throw new TypeError('Failed to fetch');
      return Response.json([]);
    });
    vi.stubGlobal('fetch', fetchMock);
    await mount(<ToastProvider><Probe /><KnowledgeBase /></ToastProvider>);
    expect(callsFor(fetchMock, '/gaps')).toHaveLength(1);
    expect(container.textContent).toContain('Failed to fetch');
    expect(container.textContent).not.toContain('No open knowledge gaps');
    await act(async () => { toast.success('Unrelated upload completed'); });
    await act(async () => { vi.advanceTimersByTime(20000); });
    expect(callsFor(fetchMock, '/gaps')).toHaveLength(1);

    failing = false;
    const retry = [...container.querySelectorAll('button')]
      .find((button) => button.textContent.includes('Retry loading knowledge gaps'));
    await act(async () => { retry.click(); });
    expect(callsFor(fetchMock, '/gaps')).toHaveLength(2);
    expect(container.textContent).toContain('No open knowledge gaps');
    expect(container.textContent).not.toContain('Failed to fetch');
  });

  it('redirects a missing user to sign-in and stops document polling', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async (url) => {
      if (String(url).endsWith('/auth/me')) return Response.json({ id: 1 });
      if (String(url).endsWith('/gaps')) return Response.json({ detail: 'User not found' }, { status: 401 });
      return Response.json([{ id: 1, filename: 'demo.txt', file_type: 'txt', status: 'processing' }]);
    });
    vi.stubGlobal('fetch', fetchMock);
    await mount(
      <MemoryRouter initialEntries={['/business/knowledge-base']}>
        <ToastProvider><AuthProvider><AuthProbe />
          <Routes>
            <Route path="/business/knowledge-base" element={<ProtectedRoute><KnowledgeBase /></ProtectedRoute>} />
            <Route path="/login" element={<LoginLocation />} />
          </Routes>
        </AuthProvider></ToastProvider>
      </MemoryRouter>
    );
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.sessionExpired).toBe(true);
    expect(container.textContent).toContain('/login?reason=session_expired');
    const count = fetchMock.mock.calls.length;
    await act(async () => { vi.advanceTimersByTime(20000); });
    expect(fetchMock).toHaveBeenCalledTimes(count);
    expect(callsFor(fetchMock, '/gaps')).toHaveLength(1);
  });

  it('does not let a late auth refresh restore an invalidated session', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ id: 1 }));
    vi.stubGlobal('fetch', fetchMock);
    await mount(<AuthProvider><AuthProbe /></AuthProvider>);
    let resolveRefresh;
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { resolveRefresh = resolve; }));
    let pending;
    await act(async () => { pending = auth.refreshUser(); });
    await act(async () => {
      await handleAuthenticatedResponse(Response.json({ detail: 'User not found' }, { status: 401 })).catch(() => {});
      resolveRefresh(Response.json({ id: 1 }));
      await pending;
    });
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.sessionExpired).toBe(true);
  });

  it('stops a multi-file upload after a 401 without refetching lists', async () => {
    const fetchMock = vi.fn(async (url) => String(url).endsWith('/upload')
      ? Response.json({ detail: 'User not found' }, { status: 401 })
      : Response.json([]));
    vi.stubGlobal('fetch', fetchMock);
    await mount(<ToastProvider><KnowledgeBase /></ToastProvider>);
    const input = container.querySelector('input[type="file"]');
    Object.defineProperty(input, 'files', { value: [
      new File(['one'], 'one.txt', { type: 'text/plain' }),
      new File(['two'], 'two.txt', { type: 'text/plain' }),
    ] });
    await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(callsFor(fetchMock, '/upload')).toHaveLength(1);
    expect(callsFor(fetchMock, '/knowledge-base')).toHaveLength(1);
    expect(callsFor(fetchMock, '/gaps')).toHaveLength(1);
  });

  it('aborts gap requests when the page unmounts', async () => {
    const fetchMock = vi.fn(async () => Response.json([]));
    vi.stubGlobal('fetch', fetchMock);
    await mount(<ToastProvider><KnowledgeBase /></ToastProvider>);
    const [[, { signal }]] = callsFor(fetchMock, '/gaps');
    await mount(<ToastProvider />);
    expect(signal.aborted).toBe(true);
  });

  it('sends the session cookie when requesting knowledge gaps', async () => {
    const fetchMock = vi.fn(async () => Response.json([]));
    vi.stubGlobal('fetch', fetchMock);
    await listKnowledgeGaps(1);
    expect(fetchMock.mock.calls[0][1].credentials).toBe('include');
  });
});
