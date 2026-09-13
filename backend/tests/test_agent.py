"""
VERA Agent Tests — Part 4
All tests use mocked Groq responses. No real API calls are made.
"""
import pytest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from app.agent.schemas import AgentDecision
from app.services.location import LocationState
from app.agent.state import VERAState
from app.agent.router import route_after_confidence
from app.agent.nodes import (
    ingest_message,
    determine_requirements,
    generate_clarification,
    prepare_tool_action,
    generate_response,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_state(**overrides) -> VERAState:
    base = VERAState(
        messages=[],
        session_id="test-session",
        last_user_message="",
        current_intent=None,
        previous_intent=None,
        intent_confidence=0.0,
        urgency="normal",
        requires_clarification=False,
        clarification_question=None,
        location=None,
        location_available=False,
        location_permission_required=False,
        location_source=None,
        location_accuracy=None,
        missing_information=[],
        map_required=False,
        tool_required=False,
        tool_name=None,
        tool_arguments=None,
        search_results=[],
        selected_place=None,
        search_radius_meters=5000,
        agent_status="idle",
        current_action=None,
        last_assistant_message=None,
        processed_message_ids=[],
    )
    base.update(overrides)
    return base


def mock_decision(**kwargs) -> AgentDecision:
    defaults = dict(
        intent="general_conversation",
        confidence=0.95,
        urgency="normal",
        requires_clarification=False,
        clarification_question=None,
        map_required=False,
        tool_required=False,
        tool_name=None,
        tool_arguments=None,
        response="Hello! How can I help you?",
    )
    defaults.update(kwargs)
    return AgentDecision(**defaults)


# ── Router tests ──────────────────────────────────────────────────────────────

class TestRouter:
    def test_high_confidence_conversation_routes_to_response(self):
        state = make_state(
            current_intent="general_conversation",
            intent_confidence=0.95,
            requires_clarification=False,
            tool_required=False,
            urgency="normal",
        )
        assert route_after_confidence(state) == "generate_response"

    def test_low_confidence_routes_to_clarification(self):
        state = make_state(
            current_intent="unknown",
            intent_confidence=0.4,
            requires_clarification=False,
            tool_required=False,
            urgency="normal",
        )
        assert route_after_confidence(state) == "generate_clarification"

    def test_explicit_clarification_flag_routes_to_clarification(self):
        state = make_state(
            current_intent="find_place",
            intent_confidence=0.8,
            requires_clarification=True,
            tool_required=False,
            urgency="normal",
        )
        assert route_after_confidence(state) == "generate_clarification"

    def test_tool_required_routes_to_tool(self):
        state = make_state(
            current_intent="find_hospital",
            intent_confidence=0.92,
            requires_clarification=False,
            tool_required=True,
            tool_name="find_hospitals",
            urgency="normal",
        )
        assert route_after_confidence(state) == "prepare_tool_action"

    def test_emergency_bypasses_clarification_gate(self):
        state = make_state(
            current_intent="emergency_medical",
            intent_confidence=0.3,  # low confidence but emergency
            requires_clarification=True,
            tool_required=True,
            urgency="high",
        )
        assert route_after_confidence(state) == "prepare_tool_action"

    def test_emergency_general_no_tool_routes_to_response(self):
        state = make_state(
            current_intent="emergency_general",
            intent_confidence=0.5,
            requires_clarification=False,
            tool_required=False,
            urgency="high",
        )
        assert route_after_confidence(state) == "generate_response"


# ── Node tests ────────────────────────────────────────────────────────────────

class TestIngestMessage:
    def test_sets_processing_status(self):
        state = make_state(last_user_message="Hello VERA")
        result = ingest_message(state)
        assert result["agent_status"] == "processing"
        assert len(result["messages"]) == 1

    def test_message_content_matches(self):
        state = make_state(last_user_message="Find a hospital")
        result = ingest_message(state)
        assert result["messages"][0].content == "Find a hospital"


class TestDetermineRequirements:
    def test_location_missing_for_hospital(self):
        state = make_state(current_intent="find_hospital", location=None)
        result = determine_requirements(state)
        assert "location" in result["missing_information"]

    def test_location_present_no_missing(self):
        loc = LocationState(latitude=1.0, longitude=2.0)
        state = make_state(current_intent="find_hospital", location=loc)
        result = determine_requirements(state)
        assert "location" not in result["missing_information"]

    def test_general_conversation_no_requirements(self):
        state = make_state(current_intent="general_conversation", location=None)
        result = determine_requirements(state)
        assert result["missing_information"] == []

    def test_directions_requires_location(self):
        state = make_state(current_intent="directions", location=None)
        result = determine_requirements(state)
        assert "location" in result["missing_information"]


class TestGenerateClarification:
    def test_uses_model_question(self):
        state = make_state(clarification_question="Did you mean a pharmacy?")
        result = generate_clarification(state)
        assert result["last_assistant_message"] == "Did you mean a pharmacy?"
        assert result["agent_status"] == "clarifying"

    def test_fallback_question_when_none(self):
        state = make_state(clarification_question=None)
        result = generate_clarification(state)
        assert result["last_assistant_message"] is not None
        assert len(result["last_assistant_message"]) > 0


class TestPrepareToolAction:
    def test_unknown_tool_is_rejected(self):
        state = make_state(
            tool_name="exec_arbitrary_code",
            tool_arguments={},
            missing_information=[],
        )
        result = prepare_tool_action(state)
        assert result["tool_required"] is False
        assert result["tool_name"] is None

    def test_valid_tool_with_location_sets_pending(self):
        loc = LocationState(latitude=1.0, longitude=2.0)
        state = make_state(
            tool_name="find_hospitals",
            tool_arguments={"location_source": "current_location"},
            missing_information=[],
            location=loc,
        )
        result = prepare_tool_action(state)
        assert result["agent_status"] == "tool_pending"
        assert "find_hospitals" in result["current_action"]

    def test_missing_location_sets_location_required(self):
        state = make_state(
            tool_name="find_hospitals",
            tool_arguments={},
            missing_information=["location"],
            location=None,
        )
        result = prepare_tool_action(state)
        assert result["current_action"] == "location_required"


class TestGenerateResponse:
    def test_uses_last_assistant_message(self):
        state = make_state(last_assistant_message="Sure, I'll look for hospitals.")
        result = generate_response(state)
        assert result["last_assistant_message"] == "Sure, I'll look for hospitals."
        assert result["agent_status"] == "responding"

    def test_fallback_when_no_message(self):
        state = make_state(last_assistant_message=None)
        result = generate_response(state)
        assert result["last_assistant_message"] is not None


# ── Full graph integration tests (mocked Groq) ───────────────────────────────

class TestGraphIntegration:
    @pytest.fixture
    def initial_state(self):
        return make_state()


    @pytest.mark.asyncio
    async def test_general_conversation(self, initial_state):
        decision = mock_decision(
            intent="general_conversation",
            confidence=0.97,
            map_required=False,
            tool_required=False,
            response="Hi! I'm VERA, your voice assistant.",
        )
        with patch("app.agent.nodes.classify_intent", new=AsyncMock(return_value=decision)):
            from app.agent.graph import vera_graph
            initial_state["last_user_message"] = "Hello VERA"
            result = await vera_graph.ainvoke(initial_state)
        assert result["current_intent"] == "general_conversation"
        assert result["map_required"] is False
        assert result["last_assistant_message"] == "Hi! I'm VERA, your voice assistant."

    @pytest.mark.asyncio
    async def test_hospital_request(self, initial_state):
        decision = mock_decision(
            intent="find_hospital",
            confidence=0.95,
            map_required=True,
            tool_required=True,
            tool_name="find_hospitals",
            tool_arguments={"location_source": "current_location"},
            response="Sure. I'll look for nearby hospitals.",
        )
        with patch("app.agent.nodes.classify_intent", new=AsyncMock(return_value=decision)):
            from app.agent.graph import vera_graph
            initial_state["last_user_message"] = "Find a hospital near me"
            result = await vera_graph.ainvoke(initial_state)
        assert result["current_intent"] == "find_hospital"
        assert result["map_required"] is True
        assert result["tool_required"] is True

    @pytest.mark.asyncio
    async def test_pharmacy_request(self, initial_state):
        decision = mock_decision(
            intent="find_pharmacy",
            confidence=0.93,
            map_required=True,
            tool_required=True,
            tool_name="find_pharmacies",
            response="Looking for pharmacies near you.",
        )
        with patch("app.agent.nodes.classify_intent", new=AsyncMock(return_value=decision)):
            from app.agent.graph import vera_graph
            initial_state["last_user_message"] = "Find a pharmacy"
            result = await vera_graph.ainvoke(initial_state)
        assert result["current_intent"] == "find_pharmacy"
        assert result["map_required"] is True

    @pytest.mark.asyncio
    async def test_restaurant_request(self, initial_state):
        decision = mock_decision(
            intent="find_restaurant",
            confidence=0.91,
            map_required=True,
            tool_required=True,
            tool_name="find_restaurants",
            response="I'll find restaurants near you.",
        )
        with patch("app.agent.nodes.classify_intent", new=AsyncMock(return_value=decision)):
            from app.agent.graph import vera_graph
            initial_state["last_user_message"] = "Find a vegetarian restaurant"
            result = await vera_graph.ainvoke(initial_state)
        assert result["current_intent"] == "find_restaurant"

    @pytest.mark.asyncio
    async def test_intent_switch_hospital_to_pharmacy(self, initial_state):
        """Previous intent must be preserved when intent changes."""
        initial_state["current_intent"] = "find_hospital"
        decision = mock_decision(
            intent="find_pharmacy",
            confidence=0.94,
            map_required=True,
            tool_required=True,
            tool_name="find_pharmacies",
            response="Sure, switching to pharmacies.",
        )
        with patch("app.agent.nodes.classify_intent", new=AsyncMock(return_value=decision)):
            from app.agent.graph import vera_graph
            initial_state["last_user_message"] = "Actually find a pharmacy instead"
            result = await vera_graph.ainvoke(initial_state)
        assert result["current_intent"] == "find_pharmacy"
        assert result["previous_intent"] == "find_hospital"

    @pytest.mark.asyncio
    async def test_cancel_request(self, initial_state):
        initial_state["current_intent"] = "find_restaurant"
        decision = mock_decision(
            intent="cancel_request",
            confidence=0.90,
            map_required=False,
            tool_required=False,
            response="Okay, cancelled.",
        )
        with patch("app.agent.nodes.classify_intent", new=AsyncMock(return_value=decision)):
            from app.agent.graph import vera_graph
            initial_state["last_user_message"] = "Actually forget that"
            result = await vera_graph.ainvoke(initial_state)
        assert result["current_intent"] == "cancel_request"
        assert result["map_required"] is False

    @pytest.mark.asyncio
    async def test_follow_up_uses_context(self, initial_state):
        initial_state["current_intent"] = "find_hospital"
        decision = mock_decision(
            intent="follow_up",
            confidence=0.88,
            map_required=True,
            tool_required=True,
            tool_name="find_hospitals",
            response="Finding the nearest one.",
        )
        with patch("app.agent.nodes.classify_intent", new=AsyncMock(return_value=decision)):
            from app.agent.graph import vera_graph
            initial_state["last_user_message"] = "Find the nearest one"
            result = await vera_graph.ainvoke(initial_state)
        assert result["current_intent"] == "follow_up"

    @pytest.mark.asyncio
    async def test_low_confidence_triggers_clarification(self, initial_state):
        decision = mock_decision(
            intent="unknown",
            confidence=0.35,
            requires_clarification=True,
            clarification_question="Did you mean a pharmacy or a farmer's market?",
            map_required=False,
            tool_required=False,
            response="Did you mean a pharmacy or a farmer's market?",
        )
        with patch("app.agent.nodes.classify_intent", new=AsyncMock(return_value=decision)):
            from app.agent.graph import vera_graph
            initial_state["last_user_message"] = "Find me a farmer"
            result = await vera_graph.ainvoke(initial_state)
        assert result["agent_status"] == "clarifying"
        assert result["requires_clarification"] is True

    @pytest.mark.asyncio
    async def test_emergency_medical(self, initial_state):
        decision = mock_decision(
            intent="emergency_medical",
            confidence=0.97,
            urgency="high",
            map_required=True,
            tool_required=True,
            tool_name="find_hospitals",
            response="I'll find the nearest hospital immediately.",
        )
        with patch("app.agent.nodes.classify_intent", new=AsyncMock(return_value=decision)):
            from app.agent.graph import vera_graph
            initial_state["last_user_message"] = "My friend collapsed and isn't responding"
            result = await vera_graph.ainvoke(initial_state)
        assert result["current_intent"] == "emergency_medical"
        assert result["urgency"] == "high"
        assert result["map_required"] is True

    @pytest.mark.asyncio
    async def test_map_required_true_for_location_search(self, initial_state):
        decision = mock_decision(
            intent="find_hospital",
            confidence=0.95,
            map_required=True,
            tool_required=True,
            tool_name="find_hospitals",
            response="Looking for hospitals.",
        )
        with patch("app.agent.nodes.classify_intent", new=AsyncMock(return_value=decision)):
            from app.agent.graph import vera_graph
            initial_state["last_user_message"] = "Find a hospital near me"
            result = await vera_graph.ainvoke(initial_state)
        assert result["map_required"] is True

    @pytest.mark.asyncio
    async def test_map_hidden_for_general_conversation(self, initial_state):
        decision = mock_decision(
            intent="general_conversation",
            confidence=0.98,
            map_required=False,
            tool_required=False,
            response="I'm VERA, your voice assistant.",
        )
        with patch("app.agent.nodes.classify_intent", new=AsyncMock(return_value=decision)):
            from app.agent.graph import vera_graph
            initial_state["last_user_message"] = "What can you do?"
            result = await vera_graph.ainvoke(initial_state)
        assert result["map_required"] is False

    @pytest.mark.asyncio
    async def test_missing_location_sets_action(self, initial_state):
        decision = mock_decision(
            intent="find_hospital",
            confidence=0.93,
            map_required=True,
            tool_required=True,
            tool_name="find_hospitals",
            response="I'll look for hospitals once I have your location.",
        )
        with patch("app.agent.nodes.classify_intent", new=AsyncMock(return_value=decision)):
            from app.agent.graph import vera_graph
            initial_state["last_user_message"] = "Find a hospital"
            initial_state["location"] = None
            result = await vera_graph.ainvoke(initial_state)
        assert result["current_action"] == "location_required"

    @pytest.mark.asyncio
    async def test_duplicate_message_id_skipped(self):
        """Duplicate message IDs must not be processed twice."""
        from app.api.websocket import _make_initial_state, _run_agent
        import uuid

        session_id = "dup-test-session"
        msg_id = str(uuid.uuid4())

        # Patch _sessions directly
        from app.api import websocket as ws_module
        ws_module._sessions[session_id] = _make_initial_state(session_id)
        ws_module._sessions[session_id]["processed_message_ids"] = [msg_id]

        mock_ws = AsyncMock()
        # Should return early without calling send_json for agent events
        await _run_agent(session_id, "Find a hospital", msg_id, mock_ws)

        # Only the duplicate-skip path — no agent.state event should be sent
        calls = [str(c) for c in mock_ws.send_json.call_args_list]
        assert not any("agent.state" in c for c in calls)

        del ws_module._sessions[session_id]

    @pytest.mark.asyncio
    async def test_separate_sessions_are_isolated(self):
        """Two sessions must not share state."""
        from app.api.websocket import _make_initial_state
        from app.api import websocket as ws_module

        s1 = "session-1"
        s2 = "session-2"
        ws_module._sessions[s1] = _make_initial_state(s1)
        ws_module._sessions[s2] = _make_initial_state(s2)

        ws_module._sessions[s1]["current_intent"] = "find_hospital"

        assert ws_module._sessions[s2].get("current_intent") is None

        del ws_module._sessions[s1]
        del ws_module._sessions[s2]
