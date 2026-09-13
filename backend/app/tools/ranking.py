"""
Deterministic place ranking — no LLM hallucination.
Ranking is explainable and based on real returned data only.
"""
from app.tools.place_normalizer import PlaceResult

# Business status priority
_STATUS_SCORE = {
    "OPERATIONAL": 2,
    "CLOSED_TEMPORARILY": 1,
    None: 1,
    "CLOSED_PERMANENTLY": 0,
}


def rank_places(
    places: list[PlaceResult],
    prioritize_distance: bool = True,
    prioritize_rating: bool = False,
    open_only: bool = False,
) -> list[PlaceResult]:
    """
    Rank places deterministically.

    Scoring:
    - Operational status (always applied)
    - Distance (lower = better, when prioritize_distance=True)
    - Rating (higher = better, when prioritize_rating=True)
    - open_only filters out closed places when True
    """
    candidates = places

    if open_only:
        # Only filter if we actually have open_now data
        has_open_data = any(p.open_now is not None for p in candidates)
        if has_open_data:
            candidates = [p for p in candidates if p.open_now is not False]

    def score(place: PlaceResult) -> tuple:
        status = _STATUS_SCORE.get(place.business_status, 1)
        dist = place.distance_meters or float("inf")
        rating = place.rating or 0.0
        rating_count = place.user_rating_count or 0

        if prioritize_rating and prioritize_distance:
            # Balance: rating weight + distance weight
            return (status, rating, rating_count, -dist)
        if prioritize_rating:
            return (status, rating, rating_count, -dist)
        # Default: distance first
        return (status, -dist)

    return sorted(candidates, key=score, reverse=True)
