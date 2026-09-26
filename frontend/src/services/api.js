// Use the current origin in production so the React app, API, cookies, and
// WebSockets all share one Render URL. Local development can still point at
// the standalone FastAPI server through VITE_API_BASE_URL.
const API_BASE = (
  import.meta.env.VITE_API_BASE_URL
  || (import.meta.env.DEV ? 'http://localhost:8000/api' : '/api')
).replace(/\/$/, '');

export function toWebSocketUrl(httpUrl) {
  const url = new URL(httpUrl, window.location.origin);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

export async function checkHealth() {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
}

// WebSocket connection — will be wired to AssemblyAI voice agent in a later part
export function createVERASocket(onEvent) {
  // Placeholder: returns a no-op object until WebSocket is implemented
  return {
    send: () => {},
    close: () => {},
  };
}

export default API_BASE;
