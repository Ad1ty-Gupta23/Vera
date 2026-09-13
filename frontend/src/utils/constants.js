export const CONNECTION_STATUS = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  ERROR: 'error',
};

export const AGENT_STATUS = {
  IDLE: 'idle',
  LISTENING: 'listening',
  PROCESSING: 'processing',
  CLARIFYING: 'clarifying',
  TOOL_PENDING: 'tool_pending',
  RESPONDING: 'responding',
  INTERRUPTED: 'interrupted',
  ERROR: 'error',
  // Legacy aliases kept for AgentStatus component compatibility
  THINKING: 'processing',
  SEARCHING: 'tool_pending',
  SPEAKING: 'responding',
};

export const MESSAGE_ROLE = {
  USER: 'user',
  ASSISTANT: 'assistant',
};

export const TRANSCRIPT_STATUS = {
  PARTIAL: 'partial',
  FINAL: 'final',
  SPEAKING: 'speaking',
  COMPLETE: 'complete',
};

// Map visibility is determined by agent state (map_required), not frontend keyword matching.
