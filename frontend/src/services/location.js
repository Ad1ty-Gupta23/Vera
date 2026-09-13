/**
 * Browser geolocation service.
 * Location is only requested when VERA explicitly needs it (triggered by location.request event).
 * Never called on app start or for general conversation.
 */

export function requestBrowserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject({ code: 'UNSUPPORTED', message: 'Geolocation is not supported by this browser.' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? null,
        });
      },
      (err) => {
        const codeMap = {
          1: { code: 'PERMISSION_DENIED', message: 'Location permission was denied.' },
          2: { code: 'POSITION_UNAVAILABLE', message: 'Location information is unavailable.' },
          3: { code: 'TIMEOUT', message: 'Location request timed out.' },
        };
        reject(codeMap[err.code] ?? { code: 'UNKNOWN', message: 'Could not get location.' });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });
}
