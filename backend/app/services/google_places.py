import logging
import httpx
from app.config.settings import settings

logger = logging.getLogger(__name__)

_NEARBY_URL = "https://places.googleapis.com/v1/places:searchNearby"
_TEXT_URL = "https://places.googleapis.com/v1/places:searchText"
_DETAILS_URL = "https://places.googleapis.com/v1/places/{name}"

# Fields we actually use — controls billing and response size
_NEARBY_FIELD_MASK = (
    "places.id,"
    "places.displayName,"
    "places.formattedAddress,"
    "places.location,"
    "places.primaryType,"
    "places.types,"
    "places.businessStatus,"
    "places.rating,"
    "places.userRatingCount,"
    "places.currentOpeningHours.openNow,"
    "places.googleMapsLinks.directionsUri"
)

_TEXT_FIELD_MASK = (
    "places.id,"
    "places.displayName,"
    "places.formattedAddress,"
    "places.location,"
    "places.primaryType,"
    "places.types,"
    "places.businessStatus,"
    "places.rating,"
    "places.userRatingCount,"
    "places.currentOpeningHours.openNow,"
    "places.googleMapsLinks.directionsUri"
)

_DETAILS_FIELD_MASK = (
    "id,"
    "displayName,"
    "formattedAddress,"
    "location,"
    "primaryType,"
    "types,"
    "businessStatus,"
    "rating,"
    "userRatingCount,"
    "currentOpeningHours,"
    "internationalPhoneNumber,"
    "websiteUri,"
    "googleMapsLinks.directionsUri"
)


def _headers(field_mask: str) -> dict:
    if not settings.google_places_api_key:
        raise RuntimeError("GOOGLE_PLACES_API_KEY is not configured")
    return {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": settings.google_places_api_key,
        "X-Goog-FieldMask": field_mask,
    }


async def search_nearby_places(
    latitude: float,
    longitude: float,
    included_types: list[str],
    radius_meters: int = 5000,
    max_results: int = 10,
) -> list[dict]:
    """
    Google Places API (New) — Nearby Search.
    Returns raw place dicts from the API response.
    """
    body = {
        "includedTypes": included_types,
        "maxResultCount": min(max_results, 20),
        "locationRestriction": {
            "circle": {
                "center": {"latitude": latitude, "longitude": longitude},
                "radius": float(min(radius_meters, settings.max_search_radius_meters)),
            }
        },
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(_NEARBY_URL, json=body, headers=_headers(_NEARBY_FIELD_MASK))

    _raise_for_places_error(resp)
    data = resp.json()
    return data.get("places", [])


async def search_text_places(
    text_query: str,
    latitude: float,
    longitude: float,
    radius_meters: int = 5000,
    max_results: int = 10,
) -> list[dict]:
    """
    Google Places API (New) — Text Search.
    Used for natural-language queries like "vegetarian restaurant" or named places.
    """
    body = {
        "textQuery": text_query,
        "maxResultCount": min(max_results, 20),
        "locationBias": {
            "circle": {
                "center": {"latitude": latitude, "longitude": longitude},
                "radius": float(min(radius_meters, settings.max_search_radius_meters)),
            }
        },
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(_TEXT_URL, json=body, headers=_headers(_TEXT_FIELD_MASK))

    _raise_for_places_error(resp)
    data = resp.json()
    return data.get("places", [])


async def get_place_details(place_name: str) -> dict:
    """
    Google Places API (New) — Place Details.
    place_name is the resource name like "places/ChIJ...".
    Only called when additional detail is explicitly needed.
    """
    url = _DETAILS_URL.format(name=place_name)
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url, headers=_headers(_DETAILS_FIELD_MASK))

    _raise_for_places_error(resp)
    return resp.json()


def _raise_for_places_error(resp: httpx.Response) -> None:
    """Convert Google API HTTP errors into structured exceptions."""
    if resp.status_code == 200:
        return
    try:
        body = resp.json()
        msg = body.get("error", {}).get("message", resp.text)
        status = body.get("error", {}).get("status", str(resp.status_code))
    except Exception:
        msg = resp.text
        status = str(resp.status_code)

    logger.error("Google Places API error %s: %s", resp.status_code, msg)

    if resp.status_code == 403:
        raise PlacesAPIError("PLACES_PERMISSION_DENIED", "Google Places access denied. Check API key and billing.")
    if resp.status_code == 429:
        raise PlacesAPIError("PLACES_QUOTA_EXCEEDED", "Google Places quota exceeded.")
    if resp.status_code == 400:
        raise PlacesAPIError("PLACES_INVALID_REQUEST", f"Invalid Places request: {msg}")
    raise PlacesAPIError("PLACES_API_ERROR", "Google Places API is unavailable right now.")


class PlacesAPIError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)
