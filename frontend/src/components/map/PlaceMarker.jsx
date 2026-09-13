import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// Override default icon to avoid broken image paths in Vite
const icon = L.divIcon({
  className: '',
  html: `<div style="width:12px;height:12px;background:#8b5cf6;border:2px solid #fff;border-radius:50%;box-shadow:0 0 6px rgba(139,92,246,0.6)"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

export default function PlaceMarker({ place, onSelect }) {
  if (!place?.latitude || !place?.longitude) return null;

  return (
    <Marker
      position={[place.latitude, place.longitude]}
      icon={icon}
      eventHandlers={{ click: () => onSelect?.(place) }}
    >
      <Popup>
        <span className="text-sm font-medium">{place.name ?? 'Unknown place'}</span>
      </Popup>
    </Marker>
  );
}
