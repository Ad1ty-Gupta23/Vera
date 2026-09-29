r"""Opt-in live smoke check. Uses configured provider credits; never logs tokens.

Run from backend: .venv\Scripts\python.exe scripts\check_free_managed_voice.py
Requires VERA on port 8000. Exercises two provider replies and a real VERA visual
tool on one session. No microphone is captured and no messages are sent to people.
"""
import asyncio
import argparse
import base64
import json
from pathlib import Path
from time import perf_counter
from urllib.parse import urlencode
import wave

import websockets

stage = 'local_connection'

async def main(speech_dir=None):
    global stage
    started = perf_counter()
    async with websockets.connect('ws://127.0.0.1:8000/api/ws/voice?voice=manual', open_timeout=5) as app:
        stage = 'bootstrap'
        await asyncio.wait_for(app.recv(), 5)
        await app.send(json.dumps({'type': 'managed.bootstrap', 'request_id': 'smoke-bootstrap'}))
        while True:
            event = json.loads(await asyncio.wait_for(app.recv(), 16))
            if event.get('request_id') == 'smoke-bootstrap':
                if event.get('error'):
                    raise RuntimeError('Managed bootstrap unavailable')
                bootstrap = event['result']
                break
        provider_url = bootstrap['websocket_url'] + '?' + urlencode({'token': bootstrap['token']})
        stage = 'provider_connection'
        async with websockets.connect(provider_url, open_timeout=10, close_timeout=2) as provider:
            stage = 'provider_configuration'
            await provider.send(json.dumps({'type': 'session.update', 'session': bootstrap['session']}))
            while True:
                event = json.loads(await asyncio.wait_for(provider.recv(), 15))
                if event['type'] == 'session.error':
                    raise RuntimeError('Provider rejected configuration: ' + str(event.get('code')))
                if event['type'] == 'session.ready':
                    print(f'configuration_accepted setup_seconds={perf_counter()-started:.2f}', flush=True)
                    print('prompt_matches=' + str(event.get('config', {}).get('system_prompt') == bootstrap['session']['system_prompt']), flush=True)
                    break

            audio_queue = asyncio.Queue()

            async def stream_audio():
                while True:
                    chunk = audio_queue.get_nowait() if not audio_queue.empty() else bytes(2400)
                    payload = json.dumps({'type': 'input.audio', 'audio': base64.b64encode(chunk).decode()})
                    await provider.send(payload)
                    await asyncio.sleep(0.05)

            audio_task = asyncio.create_task(stream_audio())
            try:
                for index, text in enumerate(('Say hello in one short sentence.', 'What did I just ask you to say?',
                                               'Show a simple diagram of the water cycle on the screen.')):
                    turn_start = perf_counter()
                    stage = f'turn_{index + 1}'
                    user_id = f'smoke-user-{index}'
                    audio_duration = 0
                    if speech_dir:
                        with wave.open(str(Path(speech_dir) / f'{index + 1}.wav'), 'rb') as wav:
                            if (wav.getframerate(), wav.getsampwidth(), wav.getnchannels()) != (24000, 2, 1):
                                raise RuntimeError('Expected mono PCM16 24kHz WAV files')
                            audio_duration = wav.getnframes() / 24000
                            while chunk := wav.readframes(1200):
                                audio_queue.put_nowait(chunk.ljust(2400, b'\0'))
                    else:
                        await app.send(json.dumps({'type': 'managed.user', 'message_id': user_id, 'text': text}))
                        await provider.send(json.dumps({'type': 'conversation.message', 'role': 'user', 'content': text}))
                        await provider.send(json.dumps({'type': 'reply.create', 'instructions':
                            'Respond to this latest typed user message, using your conversation context and tools when needed: ' + json.dumps(text)}))
                    first_audio = None
                    tool_call = None
                    tools = 0
                    screen_events = 0
                    transcript_received = False
                    async with asyncio.timeout(50):
                        while True:
                            event = json.loads(await provider.recv())
                            kind = event['type']
                            if kind in ('tool.call', 'reply.started', 'reply.done', 'session.error'):
                                print(f'turn={index+1} event={kind} status={event.get("status", "")}', flush=True)
                            if kind == 'session.error':
                                raise RuntimeError('Provider event error: ' + str(event.get('code')))
                            if kind == 'reply.audio' and first_audio is None:
                                first_audio = perf_counter() - turn_start
                            if kind == 'transcript.user':
                                text = event.get('text', '')
                                print('synthetic_transcript=' + text[:300], flush=True)
                                await app.send(json.dumps({'type': 'managed.user', 'message_id': user_id, 'text': text}))
                            if kind == 'transcript.agent':
                                transcript_received = True
                                print('synthetic_reply=' + str(event.get('text', ''))[:300], flush=True)
                                await app.send(json.dumps({'type': 'managed.assistant',
                                    'message_id': 'smoke-' + str(event.get('reply_id', index)), 'text': event.get('text', '')}))
                            if kind == 'tool.call':
                                tool_call = event
                            if kind == 'reply.done':
                                if tool_call:
                                    call = tool_call
                                    tool_call = None
                                    tools += 1
                                    await app.send(json.dumps({'type': 'managed.tool', 'request_id': call['call_id'],
                                        'name': call['name'], 'message': text, 'user_message_id': user_id}))
                                    while True:
                                        result = json.loads(await app.recv())
                                        if result['type'] in ('visual.show', 'visual.update', 'map.show'):
                                            screen_events += 1
                                        if result['type'] == 'managed.result' and result['request_id'] == call['call_id']:
                                            print('synthetic_tool_answer=' + str((result.get('result') or {}).get('answer', result.get('error', '')))[:300], flush=True)
                                            await provider.send(json.dumps({'type': 'tool.result', 'call_id': call['call_id'],
                                                'result': json.dumps(result.get('result') or {'error': result.get('error')}),
                                                'is_error': bool(result.get('error'))}))
                                            break
                                else:
                                    if first_audio is None or not transcript_received:
                                        raise RuntimeError('Reply missing audio or transcript')
                                    if index == 2 and (tools == 0 or screen_events == 0):
                                        raise RuntimeError('Visual request did not reach VERA')
                                    print(f'turn={index+1} first_audio_seconds={first_audio:.2f} input_audio_seconds={audio_duration:.2f} tools={tools} screen_events={screen_events}', flush=True)
                                    break
            finally:
                audio_task.cancel()
                await asyncio.gather(audio_task, return_exceptions=True)
                await provider.send(json.dumps({'type': 'session.end'}))
                await app.send(json.dumps({'type': 'managed.stop'}))
    print('live_managed_smoke=passed', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--speech-dir', help='Directory with synthetic 24kHz mono PCM16 files 1.wav, 2.wav, 3.wav')
    args = parser.parse_args()
    try:
        asyncio.run(main(args.speech_dir))
    except Exception as exc:
        # Exception reprs from WebSocket clients can contain the token URL.
        print('live_managed_smoke=failed stage=' + stage + ' error_type=' + type(exc).__name__, flush=True)
        if isinstance(exc, websockets.exceptions.InvalidStatus):
            print('http_status=' + str(exc.response.status_code), flush=True)
        elif isinstance(exc, RuntimeError):
            print(str(exc), flush=True)
        raise SystemExit(1)
