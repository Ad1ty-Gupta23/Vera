from app.agent.state import VERAState
from app.config.settings import settings


def route_after_confidence(state: VERAState) -> str:
    """Route based on confidence threshold and intent type."""
    intent = state.get("current_intent", "unknown")
    confidence = state.get("intent_confidence", 0.0)
    requires_clarification = state.get("requires_clarification", False)
    urgency = state.get("urgency", "normal")

    # Emergency always bypasses clarification gate
    if intent in ("emergency_medical", "emergency_general") or urgency in ("high", "critical"):
        return "prepare_tool_action" if state.get("tool_required") else "generate_response"

    # Explicit clarification from model or low confidence
    if requires_clarification or confidence < settings.agent_confidence_threshold:
        return "generate_clarification"

    # Tool-requiring intents
    if state.get("tool_required"):
        return "prepare_tool_action"

    return "generate_response"
