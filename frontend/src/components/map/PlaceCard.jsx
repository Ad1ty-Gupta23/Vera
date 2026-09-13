export default function PlaceCard({ place, onSelect, isSelected }) {
  if (!place) return null;

  // primary_type from PlaceResult — format for display
  const typeLabel = place.primary_type
    ? place.primary_type.replace(/_/g, ' ')
    : null;

  return (
    <div
      onClick={() => onSelect?.(place)}
      className={`p-3 rounded-xl border cursor-pointer transition-all duration-150 ${
        isSelected
          ? 'border-violet-500/50 bg-violet-500/10'
          : 'border-slate-700/50 bg-slate-800/40 hover:border-slate-600/60 hover:bg-slate-800/60'
      }`}
    >
      {place.name && (
        <p className="text-sm font-medium text-slate-100 truncate">{place.name}</p>
      )}
      {typeLabel && (
        <p className="text-xs text-slate-500 mt-0.5 capitalize">{typeLabel}</p>
      )}
      {place.address && (
        <p className="text-xs text-slate-400 mt-1 truncate">{place.address}</p>
      )}
      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
        {/* distance_text is the real computed field from place_normalizer */}
        {place.distance_text && (
          <span className="text-xs text-slate-500">{place.distance_text}</span>
        )}
        {/* Only show rating if Google actually returned one */}
        {place.rating != null && (
          <span className="text-xs text-slate-500">
            ★ {place.rating}
            {place.user_rating_count != null && (
              <span className="text-slate-600"> ({place.user_rating_count})</span>
            )}
          </span>
        )}
        {place.business_status && place.business_status !== 'OPERATIONAL' && (
          <span className="text-xs text-amber-500/80">
            {place.business_status === 'CLOSED_TEMPORARILY' ? 'Temporarily closed' : 'Closed'}
          </span>
        )}
        {place.open_now === false && (
          <span className="text-xs text-red-400/80">Closed now</span>
        )}
        {place.open_now === true && (
          <span className="text-xs text-emerald-400/80">Open now</span>
        )}
      </div>
      {/* Only show directions link if Google returned a real URI */}
      {place.directions_uri && (
        <a
          href={place.directions_uri}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-block mt-2 text-xs text-violet-400 hover:text-violet-300 transition-colors"
        >
          Directions ↗
        </a>
      )}
    </div>
  );
}
