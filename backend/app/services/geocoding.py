import logging
import httpx
from typing import Optional
from app.config.settings import settings

logger = logging.getLogger(__name__)

_GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"


class GeocodeResult:
    def __init__(self, latitude: float, longitude: float, formatted_address: str):
        self.latitude = latitude
        self.longitude = longitude
        self.formatted_address = formatted_address


class GeocodeError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


async def geocode_location(query: str) -> Optional[GeocodeResult]:
    """
    Convert a text location query into coordinates using Google Geocoding API.
    Returns GeocodeResult on success, None if no results found.
    Raises GeocodeError on API failure.
    Never invents coordinates.
    """
    if not settings.google_places_api_key:
        raise GeocodeError("GEOCODE_NOT_CONFIGURED", "Google API key is not configured.")

    params = {"address": query, "key": settings.google_places_api_key}

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(_GEOCODE_URL, params=params)
    except httpx.TimeoutException:
        raise GeocodeError("GEOCODE_TIMEOUT", "Geocoding request timed out.")
    except Exception as exc:
        logger.error("[geocoding] Network error: %s", exc)
        raise GeocodeError("GEOCODE_NETWORK_ERROR", "Could not reach geocoding service.")

    if resp.status_code == 403:
        raise GeocodeError("GEOCODE_PERMISSION_DENIED", "Geocoding access denied. Check API key and billing.")
    if resp.status_code != 200:
        raise GeocodeError("GEOCODE_API_ERROR", "Geocoding service is unavailable right now.")

    data = resp.json()
    status = data.get("status")

    if status == "ZERO_RESULTS":
        logger.info("[geocoding] No results for query=%r", query)
        return None

    if status == "REQUEST_DENIED":
        raise GeocodeError("GEOCODE_PERMISSION_DENIED", "Geocoding access denied. Check API key and billing.")

    if status == "OVER_QUERY_LIMIT":
        raise GeocodeError("GEOCODE_QUOTA_EXCEEDED", "Geocoding quota exceeded.")

    if status != "OK":
        raise GeocodeError("GEOCODE_API_ERROR", f"Geocoding returned status: {status}")

    results = data.get("results", [])
    if not results:
        return None

    # Use the first result — most relevant match
    first = results[0]
    loc = first.get("geometry", {}).get("location", {})
    lat = loc.get("lat")
    lng = loc.get("lng")

    if lat is None or lng is None:
        logger.warning("[geocoding] Missing coordinates in result for query=%r", query)
        return None

    formatted = first.get("formatted_address", query)
    logger.info("[geocoding] Resolved %r → lat=%.4f lon=%.4f (%s)", query, lat, lng, formatted)
    return GeocodeResult(latitude=lat, longitude=lng, formatted_address=formatted)
