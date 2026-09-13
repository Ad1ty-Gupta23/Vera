from typing import Literal, Optional
from pydantic import BaseModel, Field


# ── Intents ──────────────────────────────────────────────────────────────────

Intent = Literal[
    "general_conversation",
    "find_hospital",
    "find_pharmacy",
    "find_restaurant",
    "find_hotel",
    "find_place",
    "directions",
    "emergency_medical",
    "emergency_general",
    "location_request",
    "follow_up",
    "change_request",
    "cancel_request",
    "explain_concept",
    "unknown",
]

Urgency = Literal["normal", "high", "critical"]

AgentStatusValue = Literal[
    "idle", "listening", "processing", "clarifying",
    "tool_pending", "responding", "interrupted", "error",
]


# ── Structured LLM decision ───────────────────────────────────────────────────

class AgentDecision(BaseModel):
    intent: Intent
    confidence: float = Field(ge=0.0, le=1.0)
    urgency: Urgency = "normal"
    requires_clarification: bool = False
    clarification_question: Optional[str] = None
    map_required: bool = False
    tool_required: bool = False
    tool_name: Optional[str] = None
    tool_arguments: Optional[dict] = None
    response: str
    # Explicit text location extracted from the user message (e.g. "Bandra", "Andheri")
    # null when user says "near me" or no location is mentioned
    location_query: Optional[str] = None
    # Internal routing label — never forwarded to the frontend
    reason: Optional[str] = None


# ── Frontend-safe agent state snapshot ───────────────────────────────────────

class AgentStateSnapshot(BaseModel):
    intent: Optional[str] = None
    previous_intent: Optional[str] = None
    confidence: Optional[float] = None
    urgency: str = "normal"
    current_action: Optional[str] = None
    agent_status: str = "idle"
    map_required: bool = False
    tool_required: bool = False
    tool_name: Optional[str] = None
    requires_clarification: bool = False
    location_available: bool = False
    location_permission_required: bool = False