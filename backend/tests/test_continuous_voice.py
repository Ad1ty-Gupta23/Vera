"""Offline conversation tests: real socket loop, mocked speech and model providers."""
import asyncio
import json
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from websockets.connection import State

from app.api import websocket as voice
from app.services.groq import classify_intent
from app.services.visual_planning import plan_visual


class Client:
    query_params = {"voice": "manual"}

    def __init__(self):
        self.incoming = asyncio.Queue()
        self.outgoing = asyncio.Queue()
        self.events = []

    async def accept(self):
        pass

    async def receive(self):
        return await self.incoming.get()

    async def send_json(self, event):
        self.events.append(event)
        await self.outgoing.put(event)

    async def send(self, event):
        await self.incoming.put({"type": "websocket.receive", "text": json.dumps(event)})

    async def until(self, event_type, **fields):
        async def read():
            while True:
                event = await self.outgoing.get()
                if event["type"] == event_type and all(event.get(k) == v for k, v in fields.items()):
                    return event
        return await asyncio.wait_for(read(), timeout=3)


class SpeechProvider:
    def __init__(self):
        self.state = State.OPEN
        self.events = asyncio.Queue()
        self.events.put_nowait(json.dumps({"type": "Begin", "id": "test-stt-session"}))
        self.audio = []
        self.controls = []
        self.closed = False

    async def recv(self):
        event = await self.events.get()
        if isinstance(event, Exception):
            raise event
        return event

    async def send(self, data):
        if isinstance(data, str):
            assert not self.closed, "Control sent after transport closed"
            self.controls.append(json.loads(data))
        else:
            self.audio.append(data)

    async def close(self):
        self.closed = True
        self.state = State.CLOSED

    async def turn(self, text, turn_id, final=True):
        await self.events.put(json.dumps({
            "type": "Turn", "transcript": text, "turn_order": turn_id, "end_of_turn": final,
        }))


class ContinuousVoiceTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.client = Client()
        self.provider = SpeechProvider()
        self.calls = []
        self.cancelled = asyncio.Event()
        self.release = asyncio.Event()
        self.connect_patch = patch.object(voice, "connect_assemblyai", new=AsyncMock(return_value=self.provider))
        self.connect = self.connect_patch.start()

        async def run_agent(session_id, text, _message_id, client):
            history = voice._sessions[session_id]["messages"]
            self.calls.append((session_id, text, list(history)))
            await client.send_json({"type": "agent.status", "status": "processing"})
            if text == "long answer":
                try:
                    await self.release.wait()
                except asyncio.CancelledError:
                    self.cancelled.set()
                    raise
            history.append(text)
            await client.send_json({"type": "agent.response", "text": "Answer: " + text})
            await client.send_json({"type": "agent.status", "status": "idle"})

        self.agent_patch = patch.object(voice, "_run_agent", new=run_agent)
        self.agent_patch.start()
        self.session_task = asyncio.create_task(voice.voice_session(self.client))
        self.session_id = (await self.client.until("session.begin"))["session_id"]

    async def asyncTearDown(self):
        await self.client.incoming.put({"type": "websocket.disconnect"})
        await asyncio.wait_for(self.session_task, timeout=3)
        self.agent_patch.stop()
        self.connect_patch.stop()
        self.assertNotIn(self.session_id, voice._sessions)

    async def enable_voice(self):
        await self.client.send({"type": "voice.start"})
        await self.client.until("voice.status", status="listening")

    async def test_opening_audio_is_preserved_until_provider_is_ready(self):
        connected = asyncio.Event()

        async def delayed_connect(**_kwargs):
            await connected.wait()
            return self.provider

        self.connect.side_effect = delayed_connect
        await self.client.send({"type": "voice.start"})
        await self.client.until("voice.status", status="connecting")
        first, second, third = bytes([1]) * 1600, bytes([2]) * 1600, bytes([3]) * 1600
        for chunk in (first, second):
            await self.client.incoming.put({"type": "websocket.receive", "bytes": chunk})
        await self.ask("typing while connecting")  # receiver has consumed the audio
        self.assertEqual(self.provider.audio, [])
        connected.set()
        await self.client.until("voice.status", status="listening")
        await self.client.incoming.put({"type": "websocket.receive", "bytes": third})
        await self.ask("typing after connecting")
        self.assertEqual(b"".join(self.provider.audio), first + second + third)

    async def test_stalled_startup_fails_once_and_keeps_text_available(self):
        async def stalled(**_kwargs):
            await asyncio.Event().wait()

        self.connect.side_effect = stalled
        with patch.object(voice, "_AAI_CONNECT_TIMEOUT", 0.02):
            await self.client.send({"type": "voice.start"})
            await self.client.until("voice.status", status="unavailable")
        self.connect.assert_awaited_once()
        await self.ask("text still works")

    async def test_stop_and_typing_stay_responsive_while_audio_upload_is_blocked(self):
        await self.enable_voice()
        sending = asyncio.Event()

        async def blocked_send(_data):
            sending.set()
            await asyncio.Event().wait()

        self.provider.send = blocked_send
        await self.client.incoming.put({"type": "websocket.receive", "bytes": bytes(3200)})
        await asyncio.wait_for(sending.wait(), timeout=1)
        await asyncio.wait_for(self.ask("typed interruption"), timeout=0.5)
        await self.client.send({"type": "voice.stop"})
        await asyncio.wait_for(self.client.until("voice.status", status="paused"), timeout=0.5)
        self.assertTrue(self.provider.closed)

    async def test_stalled_audio_upload_reports_error_and_discards_old_audio(self):
        await self.enable_voice()

        async def blocked_send(_data):
            await asyncio.Event().wait()

        self.provider.send = blocked_send
        with patch.object(voice, "_AAI_SEND_TIMEOUT", 0.02):
            await self.client.incoming.put({"type": "websocket.receive", "bytes": bytes(3200)})
            event = await self.client.until("voice.status", status="unavailable")
        self.assertIn("too slow", event["message"])
        self.assertTrue(self.provider.closed)
        await self.ask("typing after a slow connection")

    async def test_audio_backlog_is_bounded_without_delaying_disconnect(self):
        await self.enable_voice()
        sending = asyncio.Event()

        async def blocked_send(_data):
            sending.set()
            await asyncio.Event().wait()

        self.provider.send = blocked_send
        await self.client.incoming.put({"type": "websocket.receive", "bytes": bytes(3200)})
        await asyncio.wait_for(sending.wait(), timeout=1)
        for _ in range(22):
            await self.client.incoming.put({"type": "websocket.receive", "bytes": bytes(3200)})
        event = await asyncio.wait_for(self.client.until("voice.status", status="unavailable"), timeout=0.5)
        self.assertIn("falling behind", event["message"])
        await self.ask("no audio backlog before this text")

    async def ask(self, text):
        await self.client.send({"type": "text.message", "text": text})
        return await self.client.until("agent.response", text="Answer: " + text)

    async def test_typing_does_not_start_speech_and_voice_uses_the_same_history(self):
        await self.ask("first typed question")
        self.assertEqual(voice._sessions[self.session_id]["input_mode"], "text")
        self.connect.assert_not_awaited()
        await self.enable_voice()
        await self.provider.turn("spoken follow-up", 0)
        await self.client.until("agent.response", text="Answer: spoken follow-up")
        self.assertEqual(voice._sessions[self.session_id]["input_mode"], "voice")
        self.assertEqual(self.calls[-1], (self.session_id, "spoken follow-up", ["first typed question"]))
        self.connect.assert_awaited_once()
        await self.ask("typed follow-up with mic still on")
        self.assertEqual(voice._sessions[self.session_id]["input_mode"], "text")

    async def test_multiple_voice_turns_and_formatted_duplicates_keep_one_session(self):
        await self.enable_voice()
        await self.provider.turn("first question", 0)
        await self.client.until("agent.response", text="Answer: first question")
        await self.provider.turn("First question.", 0)
        await self.provider.turn("follow-up", 1)
        await self.client.until("agent.response", text="Answer: follow-up")
        self.assertEqual([call[1] for call in self.calls], ["first question", "follow-up"])
        self.assertEqual(self.calls[-1][2], ["first question"])
        self.assertFalse(self.provider.closed)

    async def test_spoken_stop_cancels_generation_and_accepts_the_next_question(self):
        await self.enable_voice()
        await self.provider.turn("long answer", 0)
        await self.client.until("agent.status", status="processing")
        await self.provider.turn("Stop.", 1)
        await self.client.until("transcript.final", text="Stop.")
        await asyncio.wait_for(self.cancelled.wait(), timeout=1)
        self.release.set()
        await self.provider.turn("next question", 2)
        await self.client.until("agent.response", text="Answer: next question")
        self.assertEqual([call[1] for call in self.calls], ["long answer", "next question"])
        replies = [event["text"] for event in self.client.events if event["type"] == "agent.response"]
        self.assertEqual(replies, ["Answer: next question"])
        self.assertFalse(self.provider.closed)

    async def test_partial_speech_interrupts_even_without_speech_started(self):
        await self.enable_voice()
        await self.provider.turn("long answer", 0)
        await self.client.until("agent.status", status="processing")
        await self.provider.turn("Actually", 1, final=False)
        await self.client.until("transcript.partial", text="Actually")
        await asyncio.wait_for(self.cancelled.wait(), timeout=1)
        await self.provider.turn("Actually explain something else", 1)
        await self.client.until("agent.response", text="Answer: Actually explain something else")
        self.assertEqual(len(self.calls), 2)

    async def test_stop_response_control_keeps_the_conversation_alive(self):
        await self.client.send({"type": "text.message", "text": "long answer"})
        await self.client.until("agent.status", status="processing")
        await self.client.send({"type": "agent.interrupt"})
        await asyncio.wait_for(self.cancelled.wait(), timeout=1)
        await self.ask("next question")
        self.assertEqual(len(self.calls), 2)

    async def test_end_voice_releases_provider_but_preserves_chat_and_can_restart(self):
        await self.enable_voice()
        await self.provider.turn("spoken question", 0)
        await self.client.until("agent.response", text="Answer: spoken question")
        await self.client.send({"type": "voice.stop"})
        await self.client.until("voice.status", status="paused")
        self.assertTrue(self.provider.closed)
        self.assertEqual(self.provider.controls, [{"type": "Terminate"}])
        await self.ask("typed follow-up")
        self.assertEqual(self.calls[-1][2], ["spoken question"])
        next_provider = SpeechProvider()
        self.connect.return_value = next_provider
        await self.enable_voice()
        await next_provider.turn("another spoken question", 0)
        await self.client.until("agent.response", text="Answer: another spoken question")
        self.assertEqual(self.calls[-1][2], ["spoken question", "typed follow-up"])

    async def test_browser_disconnect_terminates_the_active_speech_session(self):
        await self.enable_voice()
        await self.client.incoming.put({"type": "websocket.disconnect"})
        await asyncio.wait_for(self.session_task, timeout=0.5)
        self.assertEqual(self.provider.controls, [{"type": "Terminate"}])
        self.assertTrue(self.provider.closed)
        self.assertNotIn(self.session_id, voice._sessions)

    async def test_provider_disconnect_reconnects_without_restarting_the_client(self):
        await self.enable_voice()
        await self.provider.turn("first question", 0)
        await self.client.until("agent.response", text="Answer: first question")
        next_provider = SpeechProvider()
        self.connect.return_value = next_provider
        await self.provider.events.put(RuntimeError("Temporary disconnect"))
        await self.client.until("voice.status", status="connecting")
        await self.client.until("voice.status", status="listening")
        await next_provider.turn("follow-up", 0)
        await self.client.until("agent.response", text="Answer: follow-up")
        self.assertEqual(self.calls[-1][2], ["first question"])

    async def test_provider_failure_leaves_typing_available_and_can_be_retried(self):
        self.connect.side_effect = RuntimeError("Provider unavailable")
        await self.client.send({"type": "voice.start"})
        await self.client.until("voice.status", status="unavailable")
        await self.ask("typed question")
        self.connect.side_effect = None
        await self.enable_voice()
        await self.provider.turn("voice recovered", 0)
        await self.client.until("agent.response", text="Answer: voice recovered")

    async def test_regular_question_containing_stop_is_not_a_control(self):
        await self.ask("How do I stop a running process?")
        self.assertEqual(len(self.calls), 1)


class InterruptibleModelTests(unittest.IsolatedAsyncioTestCase):
    async def test_model_requests_yield_to_interruptions(self):
        for target, operation in (
            ("app.services.groq.get_async_client", lambda: classify_intent("hello", [])),
            ("app.services.visual_planning.get_async_client", lambda: plan_visual("diagram", None, False)),
        ):
            with self.subTest(target=target):
                entered = asyncio.Event()
                cancelled = asyncio.Event()

                async def completion(**_kwargs):
                    entered.set()
                    try:
                        await asyncio.Event().wait()
                    except asyncio.CancelledError:
                        cancelled.set()
                        raise

                client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=AsyncMock(side_effect=completion))))
                with patch(target, return_value=client):
                    task = asyncio.create_task(operation())
                    await asyncio.wait_for(entered.wait(), timeout=1)
                    self.assertFalse(task.done())
                    task.cancel()
                    with self.assertRaises(asyncio.CancelledError):
                        await task
                    self.assertTrue(cancelled.is_set())


if __name__ == "__main__":
    unittest.main()
