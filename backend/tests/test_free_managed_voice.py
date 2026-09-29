"""Managed voice uses the same session for tools, spoken history, and typing."""
import asyncio
import unittest
from unittest.mock import AsyncMock, patch

from langchain_core.messages import AIMessage, HumanMessage
from langgraph.graph.message import add_messages

from app.api import websocket as voice
from app.agent.nodes import ingest_message
from app.services import voice_agent
from tests.test_continuous_voice import Client


class FreeManagedVoiceTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.client = Client()
        self.entered = asyncio.Event()
        self.cancelled = asyncio.Event()
        self.graph_calls = []
        owner = self

        class Graph:
            async def astream(self, state, **_kwargs):
                text = state['last_user_message']
                owner.graph_calls.append(text)
                if text == 'slow visual':
                    owner.entered.set()
                    try:
                        await asyncio.Event().wait()
                    finally:
                        owner.cancelled.set()
                messages = add_messages(state['messages'], ingest_message(state)['messages'])
                result = {**state, 'messages': add_messages(messages, [AIMessage(content='Done.')]),
                          'last_assistant_message': 'Done.', 'agent_status': 'idle', 'current_intent': 'explain_concept',
                          'intent_confidence': 1.0, 'visual_required': True, 'visual_type': 'diagram',
                          'visual_spec': {'title': text}, 'active_visual_id': 'diagram-1'}
                if text == 'nearby hospitals':
                    result.update(visual_required=False, location_permission_required=not bool(state['location']),
                                  current_action='location_required', tool_name='find_hospitals', map_required=True)
                yield 'values', result

            async def ainvoke(self, state):
                async for _kind, result in self.astream(state):
                    return result

        self.graph_patch = patch.object(voice, 'vera_graph', Graph())
        self.graph_patch.start()
        self.bootstrap_patch = patch.object(voice_agent, 'build_free_bootstrap', new=AsyncMock(return_value={
            'token': 'one-use-token', 'websocket_url': voice_agent.WEBSOCKET_URL, 'session': {},
        }))
        self.bootstrap = self.bootstrap_patch.start()
        self.task = asyncio.create_task(voice.voice_session(self.client))
        self.session_id = (await self.client.until('session.begin'))['session_id']

    async def asyncTearDown(self):
        await self.client.incoming.put({'type': 'websocket.disconnect'})
        await asyncio.wait_for(self.task, 3)
        self.graph_patch.stop()
        self.bootstrap_patch.stop()

    async def start_managed(self):
        await self.client.send({'type': 'managed.bootstrap', 'request_id': 'bootstrap'})
        return await self.client.until('managed.result', request_id='bootstrap')

    async def tool(self, text, request_id='tool-1'):
        await self.client.send({'type': 'managed.user', 'message_id': 'user-1', 'text': text})
        await self.client.send({'type': 'managed.tool', 'request_id': request_id, 'user_message_id': 'user-1',
                                'name': 'use_vera', 'message': text})

    async def test_tools_update_the_screen_without_a_second_spoken_answer(self):
        await self.start_managed()
        await self.tool('show a diagram')
        await self.client.until('visual.show', request_id='tool-1')
        result = await self.client.until('managed.result', request_id='tool-1')
        self.assertEqual(result['result']['answer'], 'Done.')
        self.assertFalse(any(e['type'] == 'agent.response' for e in self.client.events))
        history = voice._sessions[self.session_id]['messages']
        self.assertEqual([m.content for m in history], ['show a diagram'])
        for _ in range(2):
            await self.client.send({'type': 'managed.assistant', 'message_id': 'reply-1', 'text': 'Here is the diagram.'})
        await self.client.send({'type': 'managed.stop'})
        await self.client.until('agent.interrupted')
        await self.client.send({'type': 'text.message', 'text': 'explain it'})
        await self.client.until('agent.response')
        history = voice._sessions[self.session_id]['messages']
        self.assertEqual([m.content for m in history], ['show a diagram', 'Here is the diagram.', 'explain it', 'Done.'])

    async def test_interruption_cancels_tools_and_leaves_the_next_turn_available(self):
        await self.start_managed()
        await self.tool('slow visual')
        await asyncio.wait_for(self.entered.wait(), 1)
        await self.client.send({'type': 'agent.interrupt'})
        result = await self.client.until('managed.result', request_id='tool-1')
        self.assertIn('interrupted', result['error'])
        self.assertTrue(self.cancelled.is_set())
        self.assertFalse(any(e['type'] == 'visual.show' for e in self.client.events))
        await self.tool('new diagram', request_id='tool-2')
        result = await self.client.until('managed.result', request_id='tool-2')
        self.assertEqual(result['result']['answer'], 'Done.')

    async def test_location_permission_finishes_the_same_tool_request(self):
        await self.start_managed()
        await self.tool('nearby hospitals')
        await self.client.until('location.request')
        await self.client.send({'type': 'location.update', 'location': {'latitude': 19.07, 'longitude': 72.87, 'accuracy': 10}})
        result = await self.client.until('managed.result', request_id='tool-1')
        self.assertTrue(result['result']['location_available'])
        self.assertEqual(self.graph_calls, ['nearby hospitals', 'nearby hospitals'])
        self.assertEqual(len(voice._sessions[self.session_id]['messages']), 1)

    async def test_invalid_or_inactive_tools_never_run_the_graph(self):
        await self.client.send({'type': 'managed.tool', 'request_id': 'invalid', 'name': 'use_vera', 'message': 'test'})
        result = await self.client.until('managed.result', request_id='invalid')
        self.assertIsNotNone(result['error'])
        await self.start_managed()
        await self.client.send({'type': 'managed.tool', 'request_id': 'wrong-tool', 'name': 'handle_customer_message', 'message': 'test'})
        result = await self.client.until('managed.result', request_id='wrong-tool')
        self.assertIsNotNone(result['error'])
        self.assertEqual(self.graph_calls, [])

    async def test_bootstrap_does_not_block_typing_and_can_be_cancelled(self):
        async def stalled(_state):
            self.entered.set()
            try:
                await asyncio.Event().wait()
            finally:
                self.cancelled.set()
        self.bootstrap.side_effect = stalled
        await self.client.send({'type': 'managed.bootstrap', 'request_id': 'slow-bootstrap'})
        await asyncio.wait_for(self.entered.wait(), 1)
        await self.client.send({'type': 'text.message', 'text': 'hello'})
        await self.client.until('agent.response')
        await self.client.send({'type': 'managed.stop'})
        await asyncio.wait_for(self.cancelled.wait(), 1)


class FreeConfigTests(unittest.IsolatedAsyncioTestCase):
    async def test_restarting_voice_receives_prior_chat_and_screen_context(self):
        state = {'messages': [HumanMessage(content='Tell me about Mars'), AIMessage(content='Mars is a planet')],
                 'visual_type': 'diagram', 'visual_spec': {'title': 'Mars', 'private_large_data': 'omit'}}
        with patch.object(voice_agent, 'mint_temporary_token', new=AsyncMock(return_value='temporary')):
            result = await voice_agent.build_free_bootstrap(state)
        session = result['session']
        self.assertIn('Mars is a planet', session['system_prompt'])
        self.assertNotIn('private_large_data', session['system_prompt'])
        self.assertIn('Answer ordinary conversation', session['system_prompt'])
        self.assertEqual(session['tools'][0]['name'], 'use_vera')
        self.assertEqual(session['input']['transcription_mode'], 'min_latency')
        self.assertTrue(session['input']['turn_detection']['interrupt_response'])
        self.assertEqual(session['input']['turn_detection']['vad_threshold'], 0.65)
        self.assertEqual(session['input']['turn_detection']['interruption_delay'], 150)
        self.assertEqual(session['input']['voice_focus'], 'far-field')
