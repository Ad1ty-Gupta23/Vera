import { useVERAContext } from '../context/VERAContext';
import { AGENT_STATUS } from '../utils/constants';

export function useVERA() {
  const { state, dispatch } = useVERAContext();

  const setConnectionStatus = (status) =>
    dispatch({ type: 'SET_CONNECTION_STATUS', payload: status });

  const setAgentStatus = (status) =>
    dispatch({ type: 'SET_AGENT_STATUS', payload: status });

  const addMessage = (message) =>
    dispatch({ type: 'ADD_MESSAGE', payload: { id: crypto.randomUUID(), timestamp: Date.now(), ...message } });

  const updateLastMessage = (updates) =>
    dispatch({ type: 'UPDATE_LAST_MESSAGE', payload: updates });

  const setPartialTranscript = (text) =>
    dispatch({ type: 'SET_PARTIAL_TRANSCRIPT', payload: text });

  const setIntent = (intent) =>
    dispatch({ type: 'SET_INTENT', payload: intent });

  const setLocation = (location) =>
    dispatch({ type: 'SET_LOCATION', payload: location });

  const setSearchResults = (results) =>
    dispatch({ type: 'SET_SEARCH_RESULTS', payload: results });

  const setSelectedPlace = (place) =>
    dispatch({ type: 'SET_SELECTED_PLACE', payload: place });

  const openMap = () => dispatch({ type: 'SET_MAP_VISIBLE', payload: true });
  const closeMap = () => dispatch({ type: 'SET_MAP_VISIBLE', payload: false });

  const setVisual = (payload) => dispatch({ type: 'SET_VISUAL', payload });
  const hideVisual = () => dispatch({ type: 'HIDE_VISUAL' });

  const setListening = (val) => dispatch({ type: 'SET_LISTENING', payload: val });
  const setSpeaking = (val) => dispatch({ type: 'SET_SPEAKING', payload: val });

  const setError = (error) => dispatch({ type: 'SET_ERROR', payload: error });
  const clearError = () => dispatch({ type: 'CLEAR_ERROR' });

  const handleAgentEvent = (event) => {
    switch (event.type) {
      case 'map.show':
        openMap();
        break;
      case 'map.hide':
        closeMap();
        break;
      case 'agent.state':
        dispatch({ type: 'SET_AGENT_STATE', payload: event.data });
        break;
      case 'agent.status':
        setAgentStatus(event.status ?? AGENT_STATUS.IDLE);
        break;
      case 'places.updated':
        setSearchResults(event.results ?? []);
        break;
      default:
        break;
    }
  };

  return {
    ...state,
    setConnectionStatus,
    setAgentStatus,
    addMessage,
    updateLastMessage,
    setPartialTranscript,
    setIntent,
    setLocation,
    setSearchResults,
    setSelectedPlace,
    openMap,
    closeMap,
    setVisual,
    hideVisual,
    setListening,
    setSpeaking,
    setError,
    clearError,
    handleAgentEvent,
  };
}