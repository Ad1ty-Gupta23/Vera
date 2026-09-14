import MapContainer from './MapContainer';
import PlaceCard from './PlaceCard';

export default function MapPanel({ location, searchResults = [], selectedPlace, onSelectPlace, onClose }) {
  return (
    <div
      className="flex flex-col h-full rounded-2xl overflow-hidden border"
      style={{
        background: 'rgba(16,20,38,0.85)',
        backdropFilter: 'blur(20px)',
        borderColor: 'rgba(180,195,255,0.15)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(113,145,255,0.05)',
      }}
    >
      {/* Map header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b shrink-0"
        style={{ borderColor: 'rgba(180,195,255,0.1)', background: 'rgba(113,145,255,0.04)' }}
      >
        <div className="flex items-center gap-2.5">
          {/* Map icon */}
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(113,145,255,0.18)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7191FF" strokeWidth="2">
              <polygon points="3 11 22 2 13 21 11 13 3 11" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase text-[#A8B7FF]">Location Map</p>
            {!location && (
              <p className="text-[10px] text-[#5A6180] mt-0.5">Awaiting location…</p>
            )}
            {location && (
              <p className="text-[10px] text-[#5A6180] mt-0.5">
                {searchResults.length > 0 ? `${searchResults.length} place${searchResults.length !== 1 ? 's' : ''} nearby` : 'Location acquired'}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Live indicator */}
          {location && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full" style={{ background: 'rgba(107,203,119,0.1)', border: '1px solid rgba(107,203,119,0.25)' }}>
              <div className="w-1.5 h-1.5 rounded-full bg-[#6BCB77] animate-pulse" />
              <span className="text-[10px] font-semibold text-[#6BCB77]">Live</span>
            </div>
          )}

          <button
            onClick={onClose}
            aria-label="Close map"
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-[rgba(113,145,255,0.4)]"
            style={{ color: '#5A6180' }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#A7AEC4'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#5A6180'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
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
        <div
          className="max-h-48 overflow-y-auto border-t p-3 flex flex-col gap-2 shrink-0"
          style={{ borderColor: 'rgba(180,195,255,0.1)' }}
        >
          <p className="text-[10px] uppercase tracking-widest text-[#5A6180] font-semibold px-1">Nearby Places</p>
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
