const API_BASE = 'http://localhost:8000/api';

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
