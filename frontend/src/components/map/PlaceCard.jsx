export default function PlaceCard({ place, onSelect, isSelected }) {
  if (!place) return null;

  const typeLabel = place.primary_type
    ? place.primary_type.replace(/_/g, ' ')
    : null;

  // Category icon by type
  const getCategoryIcon = (type) => {
    if (!type) return null;
    const t = type.toLowerCase();
    if (t.includes('hospital') || t.includes('clinic') || t.includes('medical') || t.includes('health')) {
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      );
    }
    if (t.includes('restaurant') || t.includes('food') || t.includes('dining')) {
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
          <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
          <line x1="6" y1="1" x2="6" y2="4" />
          <line x1="10" y1="1" x2="10" y2="4" />
          <line x1="14" y1="1" x2="14" y2="4" />
        </svg>
      );
    }
    if (t.includes('cafe') || t.includes('coffee') || t.includes('bakery')) {
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
          <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
        </svg>
      );
    }
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    );
  };

  return (
    <div
      onClick={() => onSelect?.(place)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect?.(place)}
      aria-pressed={isSelected}
      className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-[rgba(113,145,255,0.4)] ${isSelected
          ? 'border-[rgba(113,145,255,0.5)] bg-[rgba(113,145,255,0.1)] shadow-[0_0_16px_rgba(113,145,255,0.12)]'
          : 'border-[rgba(180,195,255,0.1)] bg-[rgba(255,255,255,0.04)] hover:border-[rgba(180,195,255,0.25)] hover:bg-[rgba(255,255,255,0.07)]'
        }`}
    >
      <div className="flex items-start gap-2.5">
        {/* Icon */}
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors ${isSelected ? 'bg-[rgba(113,145,255,0.25)] text-[#A8B7FF]' : 'bg-[rgba(255,255,255,0.06)] text-[#5A6180]'
            }`}
        >
          {getCategoryIcon(place.primary_type)}
        </div>

        <div className="flex-1 min-w-0">
          {place.name && (
            <p className={`text-sm font-semibold truncate ${isSelected ? 'text-white' : 'text-[#DCE5FF]'}`}>
              {place.name}
            </p>
          )}
          {typeLabel && (
            <p className="text-[11px] text-[#5A6180] capitalize mt-0.5">{typeLabel}</p>
          )}
          {place.address && (
            <p className="text-xs text-[#A7AEC4] mt-1 truncate">{place.address}</p>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
            {place.distance_text && (
              <span className="text-[11px] text-[#7191FF] font-medium">{place.distance_text}</span>
            )}
            {place.rating != null && (
              <span className="text-[11px] text-[#A7AEC4] flex items-center gap-1">
                <span className="text-[#FFB347]">★</span>
                {place.rating}
                {place.user_rating_count != null && (
                  <span className="text-[#5A6180]">({place.user_rating_count})</span>
                )}
              </span>
            )}
            {place.open_now === true && (
              <span className="text-[10px] font-semibold text-[#6BCB77] px-1.5 py-0.5 rounded-full bg-[rgba(107,203,119,0.12)] border border-[rgba(107,203,119,0.2)]">
                Open
              </span>
            )}
            {place.open_now === false && (
              <span className="text-[10px] font-semibold text-red-400 px-1.5 py-0.5 rounded-full bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)]">
                Closed
              </span>
            )}
            {place.business_status && place.business_status !== 'OPERATIONAL' && (
              <span className="text-[10px] text-[#FFB347]">
                {place.business_status === 'CLOSED_TEMPORARILY' ? 'Temp. closed' : 'Closed'}
              </span>
            )}
          </div>

          {/* Directions link */}
          {place.directions_uri && (
            <a
              href={place.directions_uri}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 mt-2 text-[11px] text-[#7191FF] hover:text-[#A8B7FF] transition-colors font-medium"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="3 11 22 2 13 21 11 13 3 11" />
              </svg>
              Get Directions
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
