"""Verify that speech can start before visuals finish, without losing cancellation."""
import asyncio
import json
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from urllib.parse import parse_qs, urlparse
from starlette.websockets import WebSocket, WebSocketDisconnect, WebSocketState

from app.api import websocket as voice
from app.agent.schemas import AgentDecision
from app.agent.visual_schemas import VisualDecision
from app.services import assemblyai, groq
from tests.test_continuous_voice import Client


class VoiceResponseLatencyTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.session_id = "latency-test"
        self.client = Client()
        self.entered = asyncio.Event()
        self.release = asyncio.Event()
        voice._sessions[self.session_id] = voice._make_initial_state(self.session_id)
        voice._sessions[self.session_id]["input_mode"] = "voice"
        self.intent = AsyncMock(return_value=AgentDecision(
            intent="explain_concept", confidence=0.95,
            response="JWTs carry signed claims that a server can verify.",
        ))

        async def plan(**_kwargs):
            self.entered.set()
            await self.release.wait()
            return VisualDecision.model_validate({
                "visual_required": True,
                "narration": "Here is the authentication flow.",
                "explanation": "The client sends its token to the server for verification.",
                "visual": {
                    "type": "diagram", "title": "JWT",
                    "diagram": {"title": "JWT", "nodes": [
                        {"id": "client", "label": "Client"},
                        {"id": "server", "label": "Server"},
                    ], "edges": [{"id": "token", "source": "client", "target": "server"}]},
                },
            })

        self.planner = AsyncMock(side_effect=plan)
        self.patches = [
            patch("app.agent.nodes.classify_intent", self.intent),
            patch("app.services.visual_planning.plan_visual", self.planner),
        ]
        for item in self.patches:
            item.start()
        self.task = None

    async def asyncTearDown(self):
        if self.task is not None:
            self.task.cancel()
            await asyncio.gather(self.task, return_exceptions=True)
        for item in reversed(self.patches):
            item.stop()
        voice._sessions.pop(self.session_id, None)

    async def start_turn(self):
        self.task = asyncio.create_task(voice._run_agent(
            self.session_id, "Explain JWT authentication", "turn-1", self.client,
        ))
        await asyncio.wait_for(self.entered.wait(), timeout=2)

    async def test_speaks_before_visual_is_ready_then_finishes_without_duplicate_speech(self):
        await self.start_turn()
        preview = await self.client.until("agent.response", phase="preview")
        self.assertFalse(self.task.done())
        self.assertEqual(preview["message_id"], "turn-1")
        self.assertFalse(any(event["type"] == "visual.show" for event in self.client.events))
        self.release.set()
        await asyncio.wait_for(self.task, timeout=2)
        final = await self.client.until("agent.response", phase="final")
        self.assertFalse(final["speak"])
        self.assertEqual(final["message_id"], preview["message_id"])
        self.assertIn("authentication flow", final["text"])
        self.assertTrue(any(event["type"] == "visual.show" for event in self.client.events))
        self.assertTrue(self.intent.call_args.kwargs["voice_mode"])
        self.assertTrue(self.planner.call_args.kwargs["voice_mode"])
        history = voice._sessions[self.session_id]["messages"]
        self.assertEqual(len(history), 2)
        self.assertEqual(history[-1].content, final["text"])

    async def test_interrupting_visual_keeps_heard_answer_and_cancels_late_output(self):
        await self.start_turn()
        preview = await self.client.until("agent.response", phase="preview")
        self.task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await self.task
        self.release.set()
        history = voice._sessions[self.session_id]["messages"]
        self.assertEqual(len(history), 2)
        self.assertEqual(history[-1].content, preview["text"])
        self.assertFalse(any(event.get("phase") == "final" for event in self.client.events))

    async def test_typed_question_waits_for_final_response(self):
        voice._sessions[self.session_id]["input_mode"] = "text"
        await self.start_turn()
        self.assertFalse(any(event["type"] == "agent.response" for event in self.client.events))
        self.release.set()
        await asyncio.wait_for(self.task, timeout=2)
        final = await self.client.until("agent.response", phase="final")
        self.assertTrue(final["speak"])
        self.assertFalse(self.intent.call_args.kwargs["voice_mode"])

    async def test_editing_existing_visual_waits_for_actual_result(self):
        voice._sessions[self.session_id]["active_visual_id"] = "existing-visual"
        await self.start_turn()
        self.assertFalse(any(event.get("phase") == "preview" for event in self.client.events))
        self.release.set()
        await asyncio.wait_for(self.task, timeout=2)
        final = await self.client.until("agent.response", phase="final")
        self.assertTrue(final["speak"])

    async def test_browser_disconnect_during_preview_does_not_send_an_error_to_closed_socket(self):
        attempts = []

        async def receive():
            return {"type": "websocket.connect"}

        async def send(event):
            if event["type"] == "websocket.send":
                payload = json.loads(event["text"])
                attempts.append(payload)
                if payload.get("phase") == "preview":
                    raise OSError("browser disconnected")

        client = WebSocket({"type": "websocket"}, receive, send)
        await client.accept()
        with self.assertRaises(WebSocketDisconnect):
            await voice._run_agent(self.session_id, "Explain JWT", "turn-1", client)
        self.assertEqual(client.application_state, WebSocketState.DISCONNECTED)
        self.assertEqual(len(attempts), 2)  # processing, then failed preview; no error sends
        self.planner.assert_not_awaited()

    async def test_model_deadline_reports_service_failure_instead_of_asking_for_clarification(self):
        self.intent.side_effect = TimeoutError()
        await voice._run_agent(self.session_id, "Explain JWT", "turn-1", self.client)
        final = await self.client.until("agent.response", phase="final")
        self.assertIn("taking too long", final["text"])
        self.planner.assert_not_awaited()


class VoiceConfigurationTests(unittest.IsolatedAsyncioTestCase):
    async def test_no_send_is_attempted_on_an_already_closed_browser(self):
        client = SimpleNamespace(application_state=WebSocketState.DISCONNECTED, send_json=AsyncMock())
        with self.assertRaises(WebSocketDisconnect):
            await voice._send_client_event(client, {"type": "error"})
        client.send_json.assert_not_awaited()

    async def test_disconnect_race_is_normalized_but_unrelated_errors_are_not_swallowed(self):
        client = SimpleNamespace(application_state=WebSocketState.CONNECTED)

        async def disconnect(_event):
            client.application_state = WebSocketState.DISCONNECTED
            raise RuntimeError('Cannot call "send" once a close message has been sent.')

        client.send_json = disconnect
        with self.assertRaises(WebSocketDisconnect):
            await voice._send_client_event(client, {"type": "agent.status"})
        client.application_state = WebSocketState.CONNECTED
        client.send_json = AsyncMock(side_effect=RuntimeError("unrelated bug"))
        with self.assertRaisesRegex(RuntimeError, "unrelated bug"):
            await voice._send_client_event(client, {"type": "agent.status"})

    async def test_voice_model_request_is_cancelled_at_its_deadline(self):
        cancelled = asyncio.Event()

        async def stalled(**_kwargs):
            try:
                await asyncio.Event().wait()
            finally:
                cancelled.set()

        client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=stalled)))
        with patch.object(groq, "get_async_client", return_value=client), \
                patch.object(groq.settings, "free_voice_response_timeout_seconds", 0.02):
            with self.assertRaises(TimeoutError):
                await groq.classify_intent("hello", [], voice_mode=True)
        self.assertTrue(cancelled.is_set())

    async def test_fast_endpointing_is_only_used_for_conversational_connections(self):
        with patch.object(assemblyai.settings, "assemblyai_api_key", "test-key"), \
                patch.object(assemblyai.websockets, "connect", new=AsyncMock()) as connect:
            await assemblyai.connect_assemblyai()
            default = parse_qs(urlparse(connect.call_args.args[0]).query)
            self.assertNotIn("min_turn_silence", default)
            self.assertEqual(default["format_turns"], ["true"])
            await assemblyai.connect_assemblyai(conversational=True)
            fast = parse_qs(urlparse(connect.call_args.args[0]).query)
            self.assertEqual(fast["min_turn_silence"], [str(assemblyai.settings.free_voice_min_turn_silence_ms)])
            self.assertEqual(fast["max_turn_silence"], [str(assemblyai.settings.free_voice_max_turn_silence_ms)])
            self.assertEqual(fast["format_turns"], ["false"])
            self.assertEqual(fast["mode"], ["min_latency"])
            self.assertEqual(fast["interruption_delay"], ["0"])

    async def test_short_spoken_style_does_not_leak_into_typed_turns(self):
        decision = AgentDecision(intent="general_conversation", confidence=0.9, response="Hello.")
        create = AsyncMock(return_value=SimpleNamespace(choices=[
            SimpleNamespace(message=SimpleNamespace(content=json.dumps(decision.model_dump())))
        ]))
        client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
        history = [{"role": "user", "content": "Earlier question"}]
        with patch.object(groq, "get_async_client", return_value=client):
            await groq.classify_intent("Hello", history, voice_mode=True)
            self.assertIn(groq.VOICE_RESPONSE_STYLE, create.call_args.kwargs["messages"][0]["content"])
            await groq.classify_intent("Hello", history)
            self.assertNotIn(groq.VOICE_RESPONSE_STYLE, create.call_args.kwargs["messages"][0]["content"])
            self.assertEqual(create.call_args.kwargs["messages"][1], history[0])


if __name__ == "__main__":
    unittest.main()
