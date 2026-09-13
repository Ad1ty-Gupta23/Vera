import logging
from langchain_core.messages import HumanMessage, AIMessage
from app.agent.state import VERAState
from app.agent.schemas import AgentDecision
from app.services.groq import classify_intent
from app.services.location import LocationState
from app.services.text_cleanup import clean_stammered_text

logger = logging.getLogger(__name__)

MAP_INTENTS = {
    "find_hospital", "find_pharmacy", "find_restaurant",
    "find_hotel", "find_place", "directions",
    "emergency_medical", "emergency_general",
}

LOCATION_REQUIRED_INTENTS = {
    "find_hospital", "find_pharmacy", "find_restaurant",
    "find_hotel", "find_place", "directions",
    "emergency_medical", "location_request",
}

ALLOWED_TOOLS = {
    "find_hospitals", "find_pharmacies", "find_restaurants",
    "find_hotels", "search_places", "get_directions",
}

# Deterministic intent → tool mapping. The LLM is asked to pick a matching
# tool_name itself, but it sometimes improvises a plausible-looking name that
# isn't actually registered (e.g. "places_search"), which silently disabled
# every tool call. We trust our own mapping over the model's free-text guess
# whenever we have one for the classified intent.
INTENT_TOOL_MAP = {
    "find_hospital": "find_hospitals",
    "emergency_medical": "find_hospitals",
    "find_pharmacy": "find_pharmacies",
    "find_restaurant": "find_restaurants",
    "find_hotel": "find_hotels",
    "find_place": "search_places",
    "emergency_general": "search_places",
    "directions": "get_directions",
}

_WIDER_KEYWORDS = {"farther", "wider", "further", "more", "expand", "larger"}
_RADIUS_STEP = 2500


def ingest_message(state: VERAState) -> dict:
    raw_msg = state["last_user_message"]
    msg = clean_stammered_text(raw_msg)
    if msg != raw_msg:
        logger.debug(
            "[node:ingest_message] session=%s cleaned disfluent input: %r -> %r",
            state.get("session_id"), raw_msg, msg,
        )
    else:
        logger.debug("[node:ingest_message] session=%s msg=%r", state.get("session_id"), msg)
    # Overwrite last_user_message with the cleaned version so classify_intent_node,
    # the stored conversation history, and every downstream node all see the same
    # clean text instead of a raw, possibly-stammered transcript.
    return {
        "last_user_message": msg,
        "messages": [HumanMessage(content=msg)],
        "agent_status": "processing",
    }


async def classify_intent_node(state: VERAState) -> dict:
    messages = state.get("messages", [])
    history: list[dict] = []
    for m in messages[:-1]:
        if isinstance(m, HumanMessage):
            history.append({"role": "user", "content": m.content})
        elif isinstance(m, AIMessage):
            history.append({"role": "assistant", "content": m.content})

    prev_intent = state.get("current_intent")
    if prev_intent:
        history.append({"role": "system", "content": f"[Context] Previous intent was: {prev_intent}"})

    if state.get("search_results"):
        history.append({
            "role": "system",
            "content": f"[Context] There are {len(state['search_results'])} search results currently available.",
        })

    try:
        decision: AgentDecision = await classify_intent(state["last_user_message"], history)
    except Exception as exc:
        logger.error("[node:classify_intent] Groq error: %s", exc)
        return {
            "current_intent": "unknown", "intent_confidence": 0.0, "urgency": "normal",
            "requires_clarification": False, "clarification_question": None,
            "map_required": False, "tool_required": False, "tool_name": None,
            "tool_arguments": None,
            "last_assistant_message": "I'm having trouble processing that right now. Please try again.",
            "agent_status": "error",
        }

    previous_intent = state.get("current_intent")

    # Detect radius expansion
    from app.config.settings import settings
    msg_lower = state["last_user_message"].lower()
    current_radius = state.get("search_radius_meters") or settings.default_search_radius_meters
    new_radius = (
        min(current_radius + _RADIUS_STEP, settings.max_search_radius_meters)
        if any(kw in msg_lower for kw in _WIDER_KEYWORDS)
        else current_radius
    )

    # Clear stale results on intent switch between place types
    clear_results = (
        previous_intent != decision.intent
        and previous_intent in MAP_INTENTS
        and decision.intent in MAP_INTENTS
        and decision.intent not in ("follow_up", "change_request")
    )

    # Prefer our own deterministic mapping for the classified intent over
    # whatever tool_name string the model produced — see INTENT_TOOL_MAP above.
    resolved_tool_name = decision.tool_name
    if decision.tool_required:
        resolved_tool_name = INTENT_TOOL_MAP.get(decision.intent, decision.tool_name)
        if resolved_tool_name not in ALLOWED_TOOLS:
            logger.warning(
                "[node:classify_intent] No tool mapping for intent=%s (model said tool_name=%s)",
                decision.intent, decision.tool_name,
            )
            resolved_tool_name = None

    logger.info(
        "[node:classify_intent] session=%s intent=%s (prev=%s) conf=%.2f tool=%s",
        state.get("session_id"), decision.intent, previous_intent, decision.confidence, resolved_tool_name,
    )

    return {
        "previous_intent": previous_intent,
        "current_intent": decision.intent,
        "intent_confidence": decision.confidence,
        "urgency": decision.urgency,
        "requires_clarification": decision.requires_clarification,
        "clarification_question": decision.clarification_question,
        "map_required": decision.map_required,
        "tool_required": decision.tool_required and resolved_tool_name is not None,
        "tool_name": resolved_tool_name,
        "tool_arguments": decision.tool_arguments,
        "last_assistant_message": decision.response,
        "agent_status": "processing",
        "search_radius_meters": new_radius,
        "location_query": decision.location_query,
        **({"search_results": [], "selected_place": None} if clear_results else {}),
    }


def determine_requirements(state: VERAState) -> dict:
    intent = state.get("current_intent", "unknown")
    missing: list[str] = []
    has_location = state.get("location") is not None
    has_location_query = bool(state.get("location_query"))
    # Location is not missing if we have browser coords OR an explicit text query to geocode
    if intent in LOCATION_REQUIRED_INTENTS and not has_location and not has_location_query:
        missing.append("location")
    location_permission_required = "location" in missing
    logger.debug("[node:determine_requirements] intent=%s missing=%s location_query=%r",
                 intent, missing, state.get("location_query"))
    return {
        "missing_information": missing,
        "location_available": has_location,
        "location_permission_required": location_permission_required,
    }


async def resolve_location(state: VERAState) -> dict:
    """
    Geocode an explicit text location query (e.g. "Bandra") into real coordinates.
    Only runs when location_query is set and no browser location is available,
    OR when the user has explicitly named a different location than the current one.
    """
    from app.services.geocoding import geocode_location, GeocodeError

    location_query = state.get("location_query")
    if not location_query:
        return {}  # nothing to resolve

    # If we already have a browser location but user named a place, the named
    # place takes priority for this search — resolve it.
    existing = state.get("location")
    if existing and existing.source == "user_provided" and state.get("location_query") == location_query:
        # Same query as last time — reuse existing resolved location
        logger.debug("[node:resolve_location] Reusing existing location for query=%r", location_query)
        return {}

    logger.info("[node:resolve_location] Geocoding query=%r", location_query)

    try:
        result = await geocode_location(location_query)
    except GeocodeError as exc:
        logger.error("[node:resolve_location] Geocode error: %s — %s", exc.code, exc.message)
        return {
            "location": None,
            "location_available": False,
            "last_assistant_message": "I couldn't determine that location. Could you give me a little more detail?",
            "agent_status": "responding",
            "current_action": "geocode_failed",
        }

    if result is None:
        logger.info("[node:resolve_location] No geocode result for query=%r", location_query)
        return {
            "location": None,
            "location_available": False,
            "last_assistant_message": "I couldn't find that location. Could you be more specific?",
            "agent_status": "responding",
            "current_action": "geocode_failed",
        }

    loc = LocationState(
        latitude=result.latitude,
        longitude=result.longitude,
        accuracy=None,
        source="user_provided",
    )
    logger.info(
        "[node:resolve_location] Resolved %r → lat=%.4f lon=%.4f addr=%s",
        location_query, loc.latitude, loc.longitude, result.formatted_address,
    )
    return {
        "location": loc,
        "location_available": True,
        "location_source": "user_provided",
        "location_permission_required": False,
        "missing_information": [],
    }


def generate_clarification(state: VERAState) -> dict:
    question = state.get("clarification_question") or "Could you clarify what you're looking for?"
    logger.info("[node:generate_clarification] question=%r", question)
    return {
        "last_assistant_message": question,
        "agent_status": "clarifying",
        "messages": [AIMessage(content=question)],
    }


def prepare_tool_action(state: VERAState) -> dict:
    tool_name = state.get("tool_name")
    if tool_name not in ALLOWED_TOOLS:
        logger.warning("[node:prepare_tool_action] Unknown tool: %s", tool_name)
        return {"tool_required": False, "tool_name": None, "tool_arguments": None, "agent_status": "responding"}

    if "location" in (state.get("missing_information") or []):
        logger.info("[node:prepare_tool_action] Location missing for tool=%s", tool_name)
        return {"current_action": "location_required", "agent_status": "tool_pending"}

    logger.info("[node:prepare_tool_action] tool=%s validated", tool_name)
    return {"current_action": f"tool:{tool_name}", "agent_status": "tool_pending"}


async def execute_tool(state: VERAState) -> dict:
    """Execute the real Google Places tool and return results."""
    from app.tools.places import TOOL_REGISTRY

    tool_name = state.get("tool_name")
    location = state.get("location")

    if tool_name not in TOOL_REGISTRY:
        logger.warning("[node:execute_tool] Unknown tool: %s", tool_name)
        msg = "I'm not sure how to handle that request."
        return {
            "tool_required": False, "agent_status": "responding",
            "last_assistant_message": msg, "messages": [AIMessage(content=msg)],
        }

    if not location:
        logger.warning("[node:execute_tool] No location for tool=%s", tool_name)
        msg = "I need your location to search for nearby places."
        return {
            "current_action": "location_required", "agent_status": "tool_pending",
            "last_assistant_message": msg, "messages": [AIMessage(content=msg)],
        }

    tool_fn = TOOL_REGISTRY[tool_name]
    user_message = state.get("last_user_message", "")
    radius = state.get("search_radius_meters") or 5000
    tool_args = state.get("tool_arguments") or {}

    logger.info("[node:execute_tool] tool=%s radius=%d", tool_name, radius)

    try:
        if tool_name == "find_restaurants":
            result = await tool_fn(
                location=location, user_message=user_message, radius_meters=radius,
                open_only=tool_args.get("open_only", False),
                prioritize_rating=tool_args.get("prioritize_rating", False),
            )
        else:
            result = await tool_fn(location=location, user_message=user_message, radius_meters=radius)
    except Exception as exc:
        logger.error("[node:execute_tool] Tool error: %s", exc)
        msg = "I couldn't complete that search right now. Please try again."
        return {
            "agent_status": "error",
            "last_assistant_message": msg, "messages": [AIMessage(content=msg)],
        }

    if not result.success:
        msg = result.error_message or "I couldn't find results right now."
        return {
            "agent_status": "responding",
            "last_assistant_message": msg, "messages": [AIMessage(content=msg)],
            "search_results": [],
        }

    places = result.places
    places_dicts = [p.model_dump() for p in places]
    area_name = None
    try:
        from app.services.geocoding import reverse_geocode_location
        area_name = await reverse_geocode_location(location.latitude, location.longitude)
    except Exception as exc:
        logger.debug("[node:execute_tool] Reverse geocode skipped: %s", exc)

    urgency = state.get("urgency", "normal")
    response = _build_places_response(tool_name, places, area_name=area_name, urgency=urgency)

    logger.info("[node:execute_tool] tool=%s returned %d results", tool_name, len(places))
    return {
        "search_results": places_dicts,
        "current_action": f"results:{tool_name}",
        "agent_status": "responding",
        "last_assistant_message": response,
        "messages": [AIMessage(content=response)],
        "map_required": True,
    }


_EMERGENCY_TOOLS = {"find_hospitals"}
_MAX_PLACES_IN_RESPONSE = 3


def _describe_place(place) -> str:
    """One informative sentence-fragment per place: rating, reviews, distance, address."""
    bits = []
    if place.rating is not None:
        review_part = f" ({place.user_rating_count} reviews)" if place.user_rating_count else ""
        bits.append(f"rated {place.rating}★{review_part}")
    if place.distance_text:
        bits.append(place.distance_text)
    if place.open_now is True:
        bits.append("open now")
    elif place.open_now is False:
        bits.append("closed now")
    detail = ", ".join(bits)
    location_part = f" on {place.address}" if place.address else ""
    if detail:
        return f"{place.name}{location_part} — {detail}"
    return f"{place.name}{location_part}"


def _build_places_response(
    tool_name: str,
    places: list,
    area_name: str | None = None,
    urgency: str = "normal",
) -> str:
    category = {
        "find_hospitals": "hospitals", "find_pharmacies": "pharmacies",
        "find_restaurants": "restaurants", "find_hotels": "hotels",
        "search_places": "places",
    }.get(tool_name, "places")

    near_phrase = f" near {area_name}" if area_name else " nearby"

    if not places:
        msg = f"I couldn't find any {category}{near_phrase}. Want me to search a wider area?"
        if tool_name in _EMERGENCY_TOOLS and urgency in ("high", "critical"):
            msg += " If this is a serious emergency, please call your local emergency number right away."
        return msg

    top = places[:_MAX_PLACES_IN_RESPONSE]
    listed = ". ".join(_describe_place(p) for p in top)
    count_phrase = (
        f"Here's the one I found{near_phrase}: "
        if len(places) == 1
        else f"I found {len(places)} {category}{near_phrase}. Here are the top {len(top)}: "
    )
    response = f"{count_phrase}{listed}."

    if tool_name in _EMERGENCY_TOOLS and urgency in ("high", "critical"):
        response = (
            f"Pulling up the closest hospitals for you now. {response} "
            "If your injuries are serious, please call your local emergency number immediately."
        )

    return response


def generate_response(state: VERAState) -> dict:
    response = state.get("last_assistant_message") or "How can I help you?"
    logger.info("[node:generate_response] response=%r", response)
    return {
        "last_assistant_message": response,
        "agent_status": "responding",
        "messages": [AIMessage(content=response)],
    }


def emit_events(state: VERAState) -> dict:
    logger.debug(
        "[node:emit_events] session=%s intent=%s map=%s results=%d",
        state.get("session_id"), state.get("current_intent"),
        state.get("map_required"), len(state.get("search_results") or []),
    )
    return {}