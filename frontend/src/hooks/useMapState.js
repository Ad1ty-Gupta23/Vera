import { useVERAContext } from '../context/VERAContext';

export function useMapState() {
  const { state, dispatch } = useVERAContext();

  const openMap = () => dispatch({ type: 'SET_MAP_VISIBLE', payload: true });
  const closeMap = () => dispatch({ type: 'SET_MAP_VISIBLE', payload: false });

  const updateMapResults = (results) =>
    dispatch({ type: 'SET_SEARCH_RESULTS', payload: results });

  const selectPlace = (place) =>
    dispatch({ type: 'SET_SELECTED_PLACE', payload: place });

  return {
    mapVisible: state.mapVisible,
    location: state.location,
    searchResults: state.searchResults,
    selectedPlace: state.selectedPlace,
    openMap,
    closeMap,
    updateMapResults,
    selectPlace,
  };
}
