from typing import Annotated, Optional
from typing_extensions import TypedDict
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage
from app.services.location import LocationState


class VERAState(TypedDict):
    # Conversation history (LangGraph managed)
    messages: Annotated[list[BaseMessage], add_messages]

    # Session
    session_id: str

    # Current user turn
    last_user_message: str

    # Intent tracking
    current_intent: Optional[str]
    previous_intent: Optional[str]
    intent_confidence: float
    urgency: str  # "normal" | "high" | "critical"

    # Clarification
    requires_clarification: bool
    clarification_question: Optional[str]

    # Location (Part 5)
    location: Optional[LocationState]
    location_available: bool
    location_permission_required: bool
    location_source: Optional[str]   # "browser" | "user_provided"
    location_accuracy: Optional[float]
    location_query: Optional[str]    # explicit text location from user, e.g. "Bandra"

    # Requirements / missing info
    missing_information: list[str]

    # Map / tool decisions
    map_required: bool
    tool_required: bool
    tool_name: Optional[str]
    tool_arguments: Optional[dict]

    # Search context
    search_results: list
    selected_place: Optional[dict]
    search_radius_meters: int

    # Agent lifecycle
    agent_status: str
    current_action: Optional[str]

    # Response to emit
    last_assistant_message: Optional[str]

    # Deduplication
    processed_message_ids: list[str]

    # Visual Intelligence (Part 6)
    visual_required: bool
    visual_type: Optional[str]        # "diagram" | "scene_3d" | "image_generated" | "image_retrieved" | None
    visual_spec: Optional[dict]       # serialized VisualSpec
    active_visual_id: Optional[str]   # persists across turns so follow-ups can patch it