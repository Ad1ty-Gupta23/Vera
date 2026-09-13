import { createContext, useContext, useReducer } from 'react';
import { CONNECTION_STATUS, AGENT_STATUS } from '../utils/constants';

const initialState = {
  connectionStatus: CONNECTION_STATUS.DISCONNECTED,
  agentStatus: AGENT_STATUS.IDLE,
  messages: [],
  partialTranscript: null,
  currentIntent: null,
  previousIntent: null,
  confidence: null,
  urgency: 'normal',
  currentAction: null,
  location: null,
  searchResults: [],
  selectedPlace: null,
  mapVisible: false,
  visualType: null,
  visualSpec: null,
  visualVisible: false,
  isListening: false,
  isSpeaking: false,
  error: null,
};

function veraReducer(state, action) {
  switch (action.type) {
    case 'SET_CONNECTION_STATUS':
      return { ...state, connectionStatus: action.payload };
    case 'SET_AGENT_STATUS':
      return { ...state, agentStatus: action.payload };
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.payload] };
    case 'UPDATE_LAST_MESSAGE':
      return {
        ...state,
        messages: state.messages.map((m, i) =>
          i === state.messages.length - 1 ? { ...m, ...action.payload } : m
        ),
      };
    case 'SET_PARTIAL_TRANSCRIPT':
      return { ...state, partialTranscript: action.payload };
    case 'SET_INTENT':
      return {
        ...state,
        previousIntent: state.currentIntent,
        currentIntent: action.payload,
      };
    case 'SET_AGENT_STATE': {
      const d = action.payload;
      return {
        ...state,
        currentIntent: d.intent ?? state.currentIntent,
        previousIntent: d.previous_intent ?? state.previousIntent,
        confidence: d.confidence ?? state.confidence,
        urgency: d.urgency ?? state.urgency,
        currentAction: d.current_action ?? state.currentAction,
        agentStatus: d.agent_status ?? state.agentStatus,
      };
    }
    case 'SET_LOCATION':
      return { ...state, location: action.payload };
    case 'SET_SEARCH_RESULTS':
      return { ...state, searchResults: action.payload };
    case 'SET_SELECTED_PLACE':
      return { ...state, selectedPlace: action.payload };
    case 'SET_MAP_VISIBLE':
      return { ...state, mapVisible: action.payload };
    case 'SET_VISUAL':
      return {
        ...state,
        visualType: action.payload.visual_type,
        visualSpec: action.payload.visual,
        visualVisible: true,
      };
    case 'HIDE_VISUAL':
      return { ...state, visualVisible: false, visualType: null, visualSpec: null };
    case 'SET_LISTENING':
      return { ...state, isListening: action.payload };
    case 'SET_SPEAKING':
      return { ...state, isSpeaking: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    default:
      return state;
  }
}

const VERAContext = createContext(null);

export function VERAProvider({ children }) {
  const [state, dispatch] = useReducer(veraReducer, initialState);
  return (
    <VERAContext.Provider value={{ state, dispatch }}>
      {children}
    </VERAContext.Provider>
  );
}

export function useVERAContext() {
  const ctx = useContext(VERAContext);
  if (!ctx) throw new Error('useVERAContext must be used within VERAProvider');
  return ctx;
}