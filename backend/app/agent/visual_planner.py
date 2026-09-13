import logging
import re
import uuid

from app.agent.state import VERAState
from app.agent.visual_schemas import VisualDecision

logger = logging.getLogger(__name__)

# Loose, cheap keyword net so an EXPLICIT ask for a visual ("give its
# workflow diagram", "show me a 3d model", "draw that out") still reaches
# the Visual Planner even when intent classification tags it as a generic
# follow_up/change_request rather than explain_concept (which happens
# often, since these requests are phrased as continuations of a topic
# already being discussed, e.g. "its workflow diagram" after "explain me
# kafka"). Without this, such a message never reaches plan_visual at all
# whenever nothing is on screen yet.
_VISUAL_REQUEST_PATTERN = re.compile(
    r"\b(diagram|flowchart|flow chart|workflow|architecture|"
    r"visuali[sz]e|visual(?:ly)?|illustrat|3d|3-d|render it|draw|"
    r"show.*(?:diagram|model|scene)|picture of)\b",
    re.IGNORECASE,
)


def _mentions_visual_request(message: str) -> bool:
    return bool(_VISUAL_REQUEST_PATTERN.search(message or ""))


async def visual_planner_node(state: VERAState) -> dict:
    """
    Decide whether this turn needs a visual, and if so what kind.

    Trusts the graph's routing to only send it turns worth considering
    (see `_route_after_requirements` in graph.py), rather than re-deriving
    that decision from `current_intent` here — a prior version required
    BOTH a follow_up/change_request intent AND an already-active visual to
    treat a turn as an edit, which meant an explicit "give its workflow
    diagram" with nothing on screen yet fell through to plain text instead
    of creating a new visual. Now: if a visual is already active, treat
    this as a possible edit to it; otherwise treat it as a fresh request.
    """
    from app.services.visual_planning import plan_visual

    active_visual_id = state.get("active_visual_id")
    is_follow_up = bool(active_visual_id)

    try:
        decision: VisualDecision = await plan_visual(
            user_message=state["last_user_message"],
            current_visual=state.get("visual_spec") if is_follow_up else None,
            is_follow_up=is_follow_up,
        )
    except Exception as exc:
        logger.exception("[node:visual_planner] plan_visual failed: %s", exc)
        # Fail soft — the turn still gets a normal text response.
        return {"visual_required": False}

    if not decision.visual_required or decision.visual is None:
        if decision.action == "hide":
            return {
                "visual_required": False,
                "active_visual_id": None,
                "visual_spec": None,
                "last_assistant_message": decision.narration or state.get("last_assistant_message"),
            }
        return {"visual_required": False}

    visual = decision.visual

    # Belt-and-suspenders: if the declared type's payload is still empty
    # after plan_visual's own repair pass, don't ship a spec the frontend
    # can't render — it would just show an empty panel with no visible
    # error. Fall back to text-only instead.
    payload_by_type = {
        "diagram": visual.diagram,
        "scene_3d": visual.scene3d,
        "image_generated": visual.image,
        "image_retrieved": visual.image,
    }
    if payload_by_type.get(visual.type) is None:
        logger.warning(
            "[node:visual_planner] session=%s dropping visual — type=%s has no payload",
            state.get("session_id"), visual.type,
        )
        response_parts = [p for p in (decision.narration, decision.explanation) if p]
        return {
            "visual_required": False,
            "last_assistant_message": " ".join(response_parts) or state.get("last_assistant_message"),
        }

    if decision.action == "create" or not active_visual_id:
        visual.visual_id = str(uuid.uuid4())
    else:
        visual.visual_id = active_visual_id

    logger.info(
        "[node:visual_planner] session=%s type=%s action=%s complexity=%s id=%s",
        state.get("session_id"), visual.type, decision.action, visual.complexity, visual.visual_id,
    )

    # The narration is a short spoken lead-in; the explanation is the real
    # content. Combine them (narration first, if it isn't just repeating
    # the explanation) so the chat bubble/TTS carries the full answer, not
    # just a one-line pointer at the visual.
    response_parts = [p for p in (decision.narration, decision.explanation) if p]
    response_text = " ".join(response_parts) or state.get("last_assistant_message")

    return {
        "visual_required": True,
        "visual_type": visual.type,
        "visual_spec": visual.model_dump(),
        "active_visual_id": visual.visual_id,
        "current_action": f"visual:{decision.action}:{visual.type}",
        "agent_status": "responding",
        "last_assistant_message": response_text,
    }


async def execute_visual_tool_node(state: VERAState) -> dict:
    """
    Resolves an image visual's prompt/query into an actual URL. Diagrams and
    3D scenes need no external call — their spec IS the renderable artifact —
    so this node is only reached when visual_type is an image type (see the
    conditional edge in graph.py).
    """
    from app.tools.visual_tools import IMAGE_TOOL_REGISTRY

    spec = state.get("visual_spec")
    if not spec or not spec.get("image"):
        return {}

    mode = spec["image"]["mode"]
    tool_fn = IMAGE_TOOL_REGISTRY.get(mode)
    if tool_fn is None:
        logger.warning("[node:execute_visual_tool] No image tool for mode=%s", mode)
        return {}

    result = await tool_fn(spec["image"]["prompt_or_query"])
    if not result.success:
        logger.warning("[node:execute_visual_tool] Image resolution failed: %s", result.error_message)
        # Fail soft: keep the narration text, just drop the visual rather
        # than showing a broken image.
        return {"visual_required": False, "visual_spec": None, "visual_type": None}

    spec["image"]["resolved_url"] = result.url
    if result.caption and not spec["image"].get("caption"):
        spec["image"]["caption"] = result.caption

    return {"visual_spec": spec}