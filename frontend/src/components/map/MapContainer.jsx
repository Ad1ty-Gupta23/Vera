import { MapContainer as LeafletMap, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import PlaceMarker from './PlaceMarker';

// User location icon
const userIcon = L.divIcon({
  className: '',
  html: `<div style="width:14px;height:14px;background:#6366f1;border:3px solid #fff;border-radius:50%;box-shadow:0 0 10px rgba(99,102,241,0.7)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

// Recenter map when location changes
function RecenterMap({ center }) {
  const map = useMap();
  if (center) map.setView(center, map.getZoom());
  return null;
}

const DEFAULT_CENTER = [0, 0];
const DEFAULT_ZOOM = 14;

export default function MapContainer({ location, searchResults = [], selectedPlace, onSelectPlace }) {
  // Support both {latitude, longitude} (from backend) and {lat, lng} (legacy)
  const lat = location?.latitude ?? location?.lat;
  const lng = location?.longitude ?? location?.lng;
  const center = lat != null && lng != null ? [lat, lng] : DEFAULT_CENTER;

  return (
    <LeafletMap
      center={center}
      zoom={DEFAULT_ZOOM}
      className="w-full h-full rounded-xl"
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {location && lat != null && lng != null && (
        <>
          <RecenterMap center={center} />
          <Marker position={center} icon={userIcon} />
        </>
      )}
      {searchResults.map((place) => (
        <PlaceMarker
          key={place.id ?? `${place.latitude}-${place.longitude}`}
          place={place}
          onSelect={onSelectPlace}
        />
      ))}
    </LeafletMap>
  );
}
