import { useCallback } from 'react';
import { requestBrowserLocation } from '../services/location';

/**
 * Handles the location.request → browser geolocation → location.update WebSocket flow.
 * The ws ref must point to the active WebSocket instance.
 */
export function useLocation({ wsRef, onLocationObtained, onLocationError }) {
  const handleLocationRequest = useCallback(async () => {
    try {
      const loc = await requestBrowserLocation();

      // Send real coordinates over the existing WebSocket
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'location.update',
            location: {
              latitude: loc.latitude,
              longitude: loc.longitude,
              accuracy: loc.accuracy,
            },
          })
        );
      }

      onLocationObtained?.(loc);
    } catch (err) {
      // Notify backend that location was denied so it doesn't keep waiting
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'location.denied' }));
      }
      onLocationError?.(err.message ?? 'Could not get location.');
    }
  }, [wsRef, onLocationObtained, onLocationError]);

  return { handleLocationRequest };
}
