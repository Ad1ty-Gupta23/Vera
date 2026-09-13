"""
Places tools — real Google Places API (New) integration.
No fake results. All data comes from Google.
"""
import logging
from typing import Optional
from app.services.google_places import (
    search_nearby_places,
    search_text_places,
    get_place_details,
    PlacesAPIError,
)
from app.services.location import LocationState
from app.tools.place_types import (
    get_place_types_for_intent,
    should_use_text_search,
    build_text_query,
)
from app.tools.place_normalizer import normalize_places, PlaceResult
from app.tools.ranking import rank_places
from app.config.settings import settings

logger = logging.getLogger(__name__)


class PlacesToolResult:
    def __init__(
        self,
        success: bool,
        places: list[PlaceResult] = None,
        count: int = 0,
        error_code: str = None,
        error_message: str = None,
    ):
        self.success = success
        self.places = places or []
        self.count = count
        self.error_code = error_code
        self.error_message = error_message

    def to_dict(self) -> dict:
        return {
            "success": self.success,
            "count": self.count,
            "places": [p.model_dump() for p in self.places],
            "error_code": self.error_code,
            "error_message": self.error_message,
        }


async def _execute_search(
    intent: str,
    user_message: str,
    location: LocationState,
    radius_meters: int,
    max_results: int,
    prioritize_distance: bool,
    prioritize_rating: bool,
    open_only: bool,
) -> PlacesToolResult:
    """Core search logic shared by all place-finding tools."""
    lat, lon = location.latitude, location.longitude

    try:
        if should_use_text_search(intent, user_message):
            query = build_text_query(intent, user_message)
            logger.info("[places] Text search: %r radius=%d", query, radius_meters)
            raw = await search_text_places(query, lat, lon, radius_meters, max_results)
        else:
            types = get_place_types_for_intent(intent)
            if not types:
                # Fallback to text search when no type mapping exists
                query = build_text_query(intent, user_message)
                logger.info("[places] Fallback text search: %r", query)
                raw = await search_text_places(query, lat, lon, radius_meters, max_results)
            else:
                logger.info("[places] Nearby search: types=%s radius=%d", types, radius_meters)
                raw = await search_nearby_places(lat, lon, types, radius_meters, max_results)

    except PlacesAPIError as exc:
        logger.error("[places] API error: %s — %s", exc.code, exc.message)
        return PlacesToolResult(
            success=False,
            error_code=exc.code,
            error_message=exc.message,
        )
    except Exception as exc:
        logger.error("[places] Unexpected error: %s", exc)
        return PlacesToolResult(
            success=False,
            error_code="PLACES_API_ERROR",
            error_message="I couldn't access nearby place information right now.",
        )

    places = normalize_places(raw, lat, lon)
    ranked = rank_places(
        places,
        prioritize_distance=prioritize_distance,
        prioritize_rating=prioritize_rating,
        open_only=open_only,
    )

    logger.info("[places] Found %d results for intent=%s", len(ranked), intent)
    return PlacesToolResult(success=True, places=ranked, count=len(ranked))


async def find_hospitals(
    location: LocationState,
    user_message: str = "Find a hospital",
    radius_meters: Optional[int] = None,
) -> PlacesToolResult:
    return await _execute_search(
        intent="find_hospital",
        user_message=user_message,
        location=location,
        radius_meters=radius_meters or settings.default_search_radius_meters,
        max_results=10,
        prioritize_distance=True,
        prioritize_rating=False,
        open_only=False,
    )


async def find_pharmacies(
    location: LocationState,
    user_message: str = "Find a pharmacy",
    radius_meters: Optional[int] = None,
) -> PlacesToolResult:
    return await _execute_search(
        intent="find_pharmacy",
        user_message=user_message,
        location=location,
        radius_meters=radius_meters or settings.default_search_radius_meters,
        max_results=10,
        prioritize_distance=True,
        prioritize_rating=False,
        open_only=False,
    )


async def find_restaurants(
    location: LocationState,
    user_message: str = "Find a restaurant",
    radius_meters: Optional[int] = None,
    open_only: bool = False,
    prioritize_rating: bool = False,
) -> PlacesToolResult:
    return await _execute_search(
        intent="find_restaurant",
        user_message=user_message,
        location=location,
        radius_meters=radius_meters or settings.default_search_radius_meters,
        max_results=10,
        prioritize_distance=not prioritize_rating,
        prioritize_rating=prioritize_rating,
        open_only=open_only,
    )


async def find_hotels(
    location: LocationState,
    user_message: str = "Find a hotel",
    radius_meters: Optional[int] = None,
) -> PlacesToolResult:
    return await _execute_search(
        intent="find_hotel",
        user_message=user_message,
        location=location,
        radius_meters=radius_meters or settings.default_search_radius_meters,
        max_results=10,
        prioritize_distance=False,
        prioritize_rating=True,
        open_only=False,
    )


async def search_places(
    location: LocationState,
    user_message: str,
    radius_meters: Optional[int] = None,
) -> PlacesToolResult:
    """Generic place search using text query."""
    return await _execute_search(
        intent="find_place",
        user_message=user_message,
        location=location,
        radius_meters=radius_meters or settings.default_search_radius_meters,
        max_results=10,
        prioritize_distance=True,
        prioritize_rating=False,
        open_only=False,
    )


# Tool dispatch table — only allowed tools can be called
TOOL_REGISTRY = {
    "find_hospitals": find_hospitals,
    "find_pharmacies": find_pharmacies,
    "find_restaurants": find_restaurants,
    "find_hotels": find_hotels,
    "search_places": search_places,
}
