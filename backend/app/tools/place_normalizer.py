"""
Normalize raw Google Places API (New) responses into VERA's PlaceResult schema.
Only includes fields actually returned by Google — never invents values.
"""
from typing import Optional
from pydantic import BaseModel
from app.tools.distance import haversine_meters, format_distance


class PlaceResult(BaseModel):
    id: str
    name: str
    address: Optional[str] = None
    latitude: float
    longitude: float
    primary_type: Optional[str] = None
    types: list[str] = []
    business_status: Optional[str] = None
    rating: Optional[float] = None
    user_rating_count: Optional[int] = None
    open_now: Optional[bool] = None
    directions_uri: Optional[str] = None
    # Computed after normalization
    distance_meters: Optional[float] = None
    distance_text: Optional[str] = None


def normalize_place(raw: dict, user_lat: float, user_lon: float) -> PlaceResult:
    """Convert a single raw Google Places API place dict into a PlaceResult."""
    loc = raw.get("location", {})
    lat = loc.get("latitude", 0.0)
    lon = loc.get("longitude", 0.0)

    dist_m = haversine_meters(user_lat, user_lon, lat, lon)

    # rating — only include if actually present
    rating = raw.get("rating")
    if rating is not None:
        rating = round(float(rating), 1)

    # open_now — nested under currentOpeningHours
    open_now = None
    opening_hours = raw.get("currentOpeningHours")
    if opening_hours is not None:
        open_now = opening_hours.get("openNow")

    # directions URI from googleMapsLinks
    directions_uri = None
    gml = raw.get("googleMapsLinks")
    if gml:
        directions_uri = gml.get("directionsUri")

    return PlaceResult(
        id=raw.get("id", ""),
        name=raw.get("displayName", {}).get("text", "Unknown"),
        address=raw.get("formattedAddress"),
        latitude=lat,
        longitude=lon,
        primary_type=raw.get("primaryType"),
        types=raw.get("types", []),
        business_status=raw.get("businessStatus"),
        rating=rating,
        user_rating_count=raw.get("userRatingCount"),
        open_now=open_now,
        directions_uri=directions_uri,
        distance_meters=dist_m,
        distance_text=format_distance(dist_m),
    )


def normalize_places(raw_list: list[dict], user_lat: float, user_lon: float) -> list[PlaceResult]:
    results = []
    for raw in raw_list:
        try:
            results.append(normalize_place(raw, user_lat, user_lon))
        except Exception:
            pass  # skip malformed entries
    return results
