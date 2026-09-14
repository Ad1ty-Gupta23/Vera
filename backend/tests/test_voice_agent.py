import json
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.business_routes import get_owned_business
from app.api.voice_agent_routes import router as voice_agent_router
from app.config.settings import settings
from app.db.session import get_db
from app.models.assistant import AssistantConfig
from app.models.business import Business
from app.services import voice_agent
from app.services.assemblyai import parse_assemblyai_event


class AssemblyAIStreamingEventTests(unittest.TestCase):
    def test_final_transcript_preserves_stable_turn_id(self):
        event = parse_assemblyai_event(json.dumps({
            "type": "Turn",
            "turn_order": 0,
            "end_of_turn": True,
            "transcript": "Where is my order?",
        }))

        self.assertEqual(event, {
            "type": "transcript.final",
            "text": "Where is my order?",
            "turn_id": 0,
        })


class VoiceAgentConfigTests(unittest.TestCase):
    def test_inline_config_uses_one_tenant_safe_json_schema_tool(self):
        business = Business(name="NovaNest", helpdesk_email="support@novanest.example")
        config = AssistantConfig(
            assistant_name="Nova",
            greeting_message="Welcome to NovaNest support!",
            custom_instructions="PRIVATE OWNER NOTE",
        )

        session = voice_agent.build_session_config(config, business)

        self.assertEqual(session["greeting"], "Welcome to NovaNest support!")
        self.assertEqual(session["input"]["format"]["encoding"], "audio/pcm")
        self.assertEqual(session["input"]["transcription_mode"], "balanced")
        self.assertEqual(session["input"]["turn_detection"]["interruption_delay"], 100)
        self.assertTrue(session["input"]["turn_detection"]["interrupt_response"])
        self.assertEqual(session["output"]["format"]["encoding"], "audio/pcm")
        self.assertEqual(len(session["tools"]), 1)
        tool = session["tools"][0]
        self.assertEqual(tool["name"], voice_agent.TOOL_NAME)
        self.assertEqual(tool["parameters"]["required"], ["message"])
        self.assertFalse(tool["parameters"]["additionalProperties"])
        self.assertEqual(tool["execution_mode"], "interactive")
        self.assertEqual(tool["timeout_seconds"], 30)
        self.assertIn("call the handle_customer_message tool exactly once", session["system_prompt"])
        # Inline config is visible to a browser, so owner-only custom text
        # stays inside business_chat and is never returned in the bootstrap.
        self.assertNotIn("PRIVATE OWNER NOTE", session["system_prompt"])

    def test_spoken_answer_does_not_read_url_syntax(self):
        spoken = voice_agent.make_spoken_answer(
            "Check our website at https://novanest.example or contact support."
        )
        self.assertEqual(
            spoken,
            "Check our website at novanest dot example or contact support. "
            "The complete clickable link is displayed in the chat.",
        )

    def test_spoken_answer_converts_written_structure_to_natural_speech(self):
        spoken = voice_agent.make_spoken_answer(
            "Answer:\nYou can exchange it.\n\nNext steps:\n1. Bring the receipt\n2. Visit the store"
        )

        self.assertNotIn("Answer:", spoken)
        self.assertNotIn("Next steps:", spoken)
        self.assertIn("First, Bring the receipt.", spoken)
        self.assertIn("Second, Visit the store.", spoken)


class VoiceAgentTokenTests(unittest.IsolatedAsyncioTestCase):
    async def test_disabled_mode_does_not_call_provider(self):
        with (
            patch.object(settings, "assemblyai_voice_agent_enabled", False),
            patch("app.services.voice_agent.httpx.AsyncClient") as client_class,
        ):
            with self.assertRaises(voice_agent.VoiceAgentUnavailable):
                await voice_agent.mint_temporary_token()
        client_class.assert_not_called()

    async def test_token_request_is_bearer_authenticated_and_bounded(self):
        response = MagicMock()
        response.json.return_value = {"token": "single-use-token"}
        client = MagicMock()
        client.get = AsyncMock(return_value=response)
        context = MagicMock()
        context.__aenter__ = AsyncMock(return_value=client)
        context.__aexit__ = AsyncMock(return_value=None)

        with (
            patch.object(settings, "assemblyai_voice_agent_enabled", True),
            patch.object(settings, "assemblyai_api_key", "server-secret"),
            patch.object(settings, "assemblyai_voice_agent_token_ttl_seconds", 9999),
            patch.object(settings, "assemblyai_voice_agent_max_session_seconds", 1),
            patch("app.services.voice_agent.httpx.AsyncClient", return_value=context),
        ):
            token = await voice_agent.mint_temporary_token()

        self.assertEqual(token, "single-use-token")
        call = client.get.await_args
        self.assertEqual(call.args[0], voice_agent.TOKEN_URL)
        self.assertEqual(call.kwargs["headers"]["Authorization"], "Bearer server-secret")
        self.assertEqual(call.kwargs["params"]["expires_in_seconds"], 600)
        self.assertEqual(call.kwargs["params"]["max_session_duration_seconds"], 60)
        response.raise_for_status.assert_called_once_with()


class VoiceAgentRouteTests(unittest.TestCase):
    def setUp(self):
        self.business = Business(id=7, owner_user_id=1, name="NovaNest", helpdesk_email="help@test")
        self.db = MagicMock()
        app = FastAPI()
        app.include_router(voice_agent_router)
        app.dependency_overrides[get_owned_business] = lambda: self.business
        app.dependency_overrides[get_db] = lambda: self.db
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()

    def test_bootstrap_is_never_cached(self):
        config = AssistantConfig(assistant_name="Nova", greeting_message="Hi")
        payload = {
            "provider": "assemblyai_voice_agent",
            "websocket_url": voice_agent.WEBSOCKET_URL,
            "token": "one-use",
            "session": {},
        }
        with (
            patch(
                "app.api.voice_agent_routes.business_chat.get_or_create_config",
                return_value=config,
            ),
            patch(
                "app.api.voice_agent_routes.voice_agent.build_bootstrap",
                new=AsyncMock(return_value=payload),
            ),
        ):
            response = self.client.get("/businesses/7/voice-agent/session")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["cache-control"], "no-store")
        self.assertEqual(response.json()["token"], "one-use")

    def test_owner_tool_reuses_existing_namespaced_business_pipeline(self):
        result = {
            "conversation_id": 4,
            "answer": "Thirty days.",
            "grounded": True,
            "sources": ["policy.md"],
            "incident": None,
        }
        with patch(
            "app.api.voice_agent_routes.business_chat.send_message",
            new=AsyncMock(return_value=result),
        ) as send_message:
            response = self.client.post(
                "/businesses/7/voice-agent/tool",
                json={"session_id": "browser-123", "message": "What is the return window?"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["answer"], "Thirty days.")
        self.assertEqual(
            response.json()["spoken_answer"],
            "Thirty days. Did that resolve your request?",
        )
        self.assertEqual(send_message.await_args.kwargs["session_id"], "owner-test:browser-123")
        self.assertIs(send_message.await_args.kwargs["business"], self.business)


if __name__ == "__main__":
    unittest.main()
