import json
import logging

from app.agent.visual_schemas import VisualDecision
from app.agent.visual_prompts import (
    VISUAL_PLANNER_SYSTEM_PROMPT,
    build_visual_planner_user_prompt,
)
from app.services.groq import get_client  # reuse the existing Groq client/singleton
from app.config.settings import settings

logger = logging.getLogger(__name__)


def _repair_visual_shape(visual: dict) -> dict:
    """
    Best-effort fix-up for the most common way the model mis-shapes the
    `visual` object despite the prompt's explicit example: putting the
    type-specific payload (nodes/edges, or objects, or prompt_or_query)
    directly on `visual` itself instead of nested under `visual.diagram` /
    `visual.scene3d` / `visual.image`. Pydantic silently ignores unknown
    top-level keys, so without this the nested field ends up None and the
    frontend renders an empty panel with no error anywhere.
    """
    vtype = visual.get("type")

    if vtype == "diagram" and not visual.get("diagram"):
        if "nodes" in visual or "edges" in visual:
            visual["diagram"] = {
                "title": visual.get("title", ""),
                "direction": visual.get("direction", "horizontal"),
                "nodes": visual.pop("nodes", []),
                "edges": visual.pop("edges", []),
            }
    elif vtype == "scene_3d" and not visual.get("scene3d"):
        if "objects" in visual:
            visual["scene3d"] = {
                "title": visual.get("title", ""),
                "background": visual.get("background", "#0b1220"),
                "camera_position": visual.get("camera_position", [0.0, 2.0, 6.0]),
                "objects": visual.pop("objects", []),
                "auto_rotate": visual.get("auto_rotate", False),
            }
    elif vtype in ("image_generated", "image_retrieved") and not visual.get("image"):
        if "prompt_or_query" in visual:
            visual["image"] = {
                "mode": "generate" if vtype == "image_generated" else "retrieve",
                "prompt_or_query": visual.pop("prompt_or_query"),
                "caption": visual.pop("caption", None),
            }

    return visual


def _parse_visual_decision(raw: str) -> VisualDecision:
    text = raw.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    data = json.loads(text)

    # The model sometimes includes a full `visual` object but forgets the
    # `visual_required` flag itself — infer it rather than hard-failing on
    # a field that's redundant with the data actually present.
    if "visual_required" not in data or data["visual_required"] is None:
        data["visual_required"] = bool(data.get("visual"))

    if isinstance(data.get("visual"), dict):
        data["visual"] = _repair_visual_shape(data["visual"])

    decision = VisualDecision(**data)

    # If the model claimed a type but the matching payload still ended up
    # empty (repair couldn't salvage it), log the raw shape loudly so this
    # is diagnosable from the logs instead of showing up as a silent blank
    # panel days later.
    if decision.visual is not None:
        vtype = decision.visual.type
        payload = {
            "diagram": decision.visual.diagram,
            "scene_3d": decision.visual.scene3d,
            "image_generated": decision.visual.image,
            "image_retrieved": decision.visual.image,
        }.get(vtype)
        if payload is None:
            logger.warning(
                "[visual_planning] visual.type=%r but its payload is empty after parsing — "
                "raw model output was: %s",
                vtype, raw,
            )

    return decision


async def plan_visual(
    user_message: str,
    current_visual: dict | None,
    is_follow_up: bool,
) -> VisualDecision:
    """
    Ask the LLM whether a visual is warranted for this turn and, if so,
    what it should contain. Mirrors classify_intent's call shape so it
    plugs into the same Groq client/settings/error-handling conventions.
    """
    client = get_client()

    messages = [
        {"role": "system", "content": VISUAL_PLANNER_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": build_visual_planner_user_prompt(
                user_message, current_visual, is_follow_up
            ),
        },
    ]

    response = client.chat.completions.create(
        model=settings.groq_model,
        messages=messages,
        temperature=0.2,
        reasoning_effort="low",
        max_tokens=4096,
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content
    decision = _parse_visual_decision(raw)
    logger.debug("[visual_planning] decision=%s", decision.model_dump())
    return decision