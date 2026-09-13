import MapContainer from './MapContainer';
import PlaceCard from './PlaceCard';

export default function MapPanel({ location, searchResults = [], selectedPlace, onSelectPlace, onClose }) {
  return (
    <div className="flex flex-col h-full bg-slate-900/60 border border-slate-700/50 rounded-2xl overflow-hidden">
      {/* Map header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-slate-400">Map</p>
          {!location && (
            <p className="text-xs text-slate-600 mt-0.5">Awaiting location</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-slate-300 transition-colors text-xs px-2 py-1 rounded-lg hover:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-600"
          aria-label="Close map"
        >
          Close
        </button>
      </div>

      {/* Map */}
      <div className="flex-1 min-h-0 relative">
        <MapContainer
          location={location}
          searchResults={searchResults}
          selectedPlace={selectedPlace}
          onSelectPlace={onSelectPlace}
        />
      </div>

      {/* Place results */}
      {searchResults.length > 0 && (
        <div className="max-h-44 overflow-y-auto border-t border-slate-700/50 p-3 flex flex-col gap-2">
          {searchResults.map((place) => (
            <PlaceCard
              key={place.id ?? `${place.latitude}-${place.longitude}`}
              place={place}
              onSelect={onSelectPlace}
              isSelected={selectedPlace?.id === place.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
