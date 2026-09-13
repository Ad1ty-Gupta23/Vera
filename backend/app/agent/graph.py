from langgraph.graph import StateGraph, START, END
from app.agent.state import VERAState
from app.agent.nodes import (
    ingest_message,
    classify_intent_node,
    determine_requirements,
    resolve_location,
    generate_clarification,
    prepare_tool_action,
    execute_tool,
    generate_response,
    emit_events,
)
from app.agent.router import route_after_confidence
from app.agent.visual_planner import visual_planner_node, execute_visual_tool_node, _mentions_visual_request


def build_graph():
    g = StateGraph(VERAState)

    g.add_node("ingest_message", ingest_message)
    g.add_node("classify_intent", classify_intent_node)
    g.add_node("determine_requirements", determine_requirements)
    g.add_node("resolve_location", resolve_location)
    g.add_node("generate_clarification", generate_clarification)
    g.add_node("prepare_tool_action", prepare_tool_action)
    g.add_node("execute_tool", execute_tool)
    g.add_node("generate_response", generate_response)
    g.add_node("emit_events", emit_events)
    g.add_node("visual_planner", visual_planner_node)
    g.add_node("execute_visual_tool", execute_visual_tool_node)

    g.add_edge(START, "ingest_message")
    g.add_edge("ingest_message", "classify_intent")
    g.add_edge("classify_intent", "determine_requirements")

    # After determine_requirements: geocode if location_query present, else route normally
    g.add_conditional_edges(
        "determine_requirements",
        _route_after_requirements,
        {
            "resolve_location": "resolve_location",
            "generate_clarification": "generate_clarification",
            "prepare_tool_action": "prepare_tool_action",
            "visual_planner": "visual_planner",
            "generate_response": "generate_response",
        },
    )

    g.add_conditional_edges(
        "visual_planner",
        _route_after_visual_planner,
        {
            "execute_visual_tool": "execute_visual_tool",
            "generate_response": "generate_response",
        },
    )
    g.add_edge("execute_visual_tool", "generate_response")

    # After geocoding: if it failed go straight to response, else continue routing
    g.add_conditional_edges(
        "resolve_location",
        _route_after_geocode,
        {
            "generate_clarification": "generate_clarification",
            "prepare_tool_action": "prepare_tool_action",
            "generate_response": "generate_response",
        },
    )

    g.add_edge("generate_clarification", "emit_events")
    g.add_conditional_edges(
        "prepare_tool_action",
        _route_after_prepare,
        {
            "execute_tool": "execute_tool",
            "generate_response": "generate_response",
        },
    )
    g.add_edge("execute_tool", "generate_response")
    g.add_edge("generate_response", "emit_events")
    g.add_edge("emit_events", END)

    return g.compile()


def _route_after_requirements(state: VERAState) -> str:
    """
    If the user provided an explicit location query, geocode it first.
    Otherwise fall through to the normal confidence-based routing.
    """
    location_query = state.get("location_query")
    has_location = state.get("location") is not None

    # Geocode when: explicit query present AND (no location yet, OR existing location
    # is user_provided from a previous query — meaning user named a new place)
    if location_query:
        existing = state.get("location")
        if not has_location or (existing and existing.source == "user_provided"):
            return "resolve_location"

    # Educational/conceptual questions go to the Visual Planner. So does any
    # follow-up/change-request while a visual is already active ("zoom into
    # this part", "add the database"), OR — even with nothing on screen yet
    # — a follow-up that explicitly asks for a visual ("give its workflow
    # diagram", "show me a 3d model of that"). That last case matters
    # because such requests are phrased as continuations of the topic
    # ("its"/"that"), so intent classification tags them follow_up rather
    # than explain_concept; without this they'd never reach the planner at
    # all when no visual exists yet.
    intent = state.get("current_intent")
    active_visual = bool(state.get("active_visual_id"))
    is_visual_followup = intent in ("follow_up", "change_request") and (
        active_visual or _mentions_visual_request(state.get("last_user_message", ""))
    )
    if intent == "explain_concept" or is_visual_followup:
        return "visual_planner"

    # No geocoding needed — use normal routing
    return route_after_confidence(state)


def _route_after_geocode(state: VERAState) -> str:
    """After resolve_location: if geocoding failed, respond. Otherwise continue normally."""
    if state.get("current_action") == "geocode_failed":
        return "generate_response"
    return route_after_confidence(state)


def _route_after_prepare(state: VERAState) -> str:
    """After prepare_tool_action: execute if location is available, else respond."""
    if state.get("current_action") == "location_required":
        return "generate_response"
    if state.get("tool_name") and state.get("location"):
        return "execute_tool"
    return "generate_response"


def _route_after_visual_planner(state: VERAState) -> str:
    """After visual_planner: image visuals need a URL resolved, diagrams/3D scenes don't."""
    if state.get("visual_required") and state.get("visual_type") in ("image_generated", "image_retrieved"):
        return "execute_visual_tool"
    return "generate_response"


vera_graph = build_graph()