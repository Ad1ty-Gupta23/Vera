import asyncio
import json
import logging
import re
import uuid
from collections import deque
from time import perf_counter
import websockets
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState
from langchain_core.messages import AIMessage, HumanMessage
from langgraph.graph.message import add_messages
from sqlalchemy.orm import Session
from app.services.assemblyai import close_assemblyai, connect_assemblyai, parse_assemblyai_event, is_open
from app.services.location import LocationState, parse_location
from app.agent.graph import vera_graph, _route_after_requirements
from app.agent.state import VERAState
from app.agent.schemas import AgentStateSnapshot
from app.auth.security import _decode_session_token
from app.config.settings import settings
from app.db.session import SessionLocal
from app.models.business import Business
from app.services import business_chat, voice_agent

logger = logging.getLogger("uvicorn.error.vera.voice")
router = APIRouter()

_sessions: dict[str, VERAState] = {}

# How long (seconds) to wait for AssemblyAI SessionBegins before giving up
_AAI_CONNECT_TIMEOUT = 8
_AAI_SEND_TIMEOUT = 2
_AUDIO_BYTES_PER_SECOND = 16000 * 2
_AUDIO_PACKET_BYTES = _AUDIO_BYTES_PER_SECOND // 5  # coalesce up to 200 ms


async def _send_client_event(client_ws: WebSocket, event: dict) -> None:
    """Treat a closed browser as a disconnect, never as another agent failure."""
    if any(getattr(client_ws, name, None) == WebSocketState.DISCONNECTED
           for name in ("client_state", "application_state")):
        raise WebSocketDisconnect(code=1006)
    try:
        await client_ws.send_json(event)
    except RuntimeError:
        # Another task may discover the disconnect between the check and send.
        if any(getattr(client_ws, name, None) == WebSocketState.DISCONNECTED
               for name in ("client_state", "application_state")):
            raise WebSocketDisconnect(code=1006) from None
        raise


def _make_initial_state(session_id: str) -> VERAState:
    return VERAState(
        messages=[],
        session_id=session_id,
        last_user_message="",
        input_mode="text",
        current_message_id=None,
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
        location_query=None,
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
        visual_required=False,
        visual_type=None,
        visual_spec=None,
        active_visual_id=None,
    )


async def _run_agent(
    session_id: str,
    user_message: str,
    message_id: str,
    client_ws: WebSocket,
    *, managed: bool = False, user_message_id: str | None = None,
) -> None:
    state = _sessions.get(session_id)
    if state is None:
        return

    if message_id in state.get("processed_message_ids", []):
        logger.warning("[ws] Duplicate message_id=%s — skipped", message_id)
        return

    await _send_client_event(client_ws, {"type": "agent.status", "status": "processing"})

    state["last_user_message"] = user_message
    state["current_message_id"] = user_message_id or message_id
    state["processed_message_ids"] = [
        *state.get("processed_message_ids", []),
        message_id,
    ]

    started = perf_counter()
    preview_sent = False
    try:
        if state.get("input_mode") == "voice":
            result = state
            async for kind, payload in vera_graph.astream(state, stream_mode=["updates", "values"]):
                if kind == "values":
                    result = payload
                elif kind == "updates" and "determine_requirements" in payload:
                    candidate = {**result, **payload["determine_requirements"]}
                    # Speak the core explanation while the visual is built. Wait
                    # for tool/clarification results and visual edits before speaking.
                    if (
                        not managed and not preview_sent
                        and candidate.get("current_intent") == "explain_concept"
                        and not candidate.get("active_visual_id")
                        and not candidate.get("requires_clarification")
                        and not candidate.get("tool_required")
                        and not candidate.get("map_required")
                        and candidate.get("intent_confidence", 0) >= settings.agent_confidence_threshold
                        and _route_after_requirements(candidate) == "visual_planner"
                        and candidate.get("last_assistant_message")
                    ):
                        await _send_client_event(client_ws, {
                            "type": "agent.response", "phase": "preview",
                            "message_id": message_id,
                            "text": candidate["last_assistant_message"],
                        })
                        preview_sent = True
                        # If interrupted during visual generation, retain what
                        # the user has already heard as conversation context.
                        _sessions[session_id] = {
                            **candidate,
                            "messages": [*candidate["messages"], AIMessage(content=candidate["last_assistant_message"])],
                        }
                        logger.info("[latency] session=%s stage=first_response duration_ms=%.0f",
                                    session_id, (perf_counter() - started) * 1000)
        else:
            result = await vera_graph.ainvoke(state)
    except WebSocketDisconnect:
        raise
    except Exception as exc:
        logger.exception("[ws] LangGraph error session=%s (%s)", session_id, type(exc).__name__)
        await _send_client_event(client_ws, {
            "type": "agent.response",
            "phase": "final", "message_id": message_id,
            "text": "I'm having trouble processing that right now. Please try again.",
        })
        await _send_client_event(client_ws, {"type": "agent.status", "status": "idle"})
        return

    _sessions[session_id] = result

    if result.get("location_permission_required") and not result.get("location"):
        await _send_client_event(client_ws, {"type": "location.request"})
        logger.info("[ws] Location requested for session=%s", session_id)

    if result.get("map_required"):
        await _send_client_event(client_ws, {"type": "map.show", "reason": "location_based_search"})
    else:
        await _send_client_event(client_ws, {"type": "map.hide"})

    # `state` here still holds the pre-turn active_visual_id (it was mutated
    # in place for last_user_message/processed_message_ids but never for
    # active_visual_id), so comparing it against `result` tells us whether
    # this is a brand-new visual or an in-place update.
    if result.get("visual_required") and result.get("visual_spec"):
        event_type = "visual.update" if state.get("active_visual_id") else "visual.show"
        await _send_client_event(client_ws, {
            "type": event_type,
            "visual_type": result.get("visual_type"),
            "visual": result.get("visual_spec"),
        })
    elif result.get("active_visual_id") is None and state.get("active_visual_id"):
        # Visual Planner explicitly cleared it (user said "hide this" / "close it")
        await _send_client_event(client_ws, {"type": "visual.hide"})

    snapshot = AgentStateSnapshot(
        intent=result.get("current_intent"),
        previous_intent=result.get("previous_intent"),
        confidence=result.get("intent_confidence"),
        urgency=result.get("urgency", "normal"),
        current_action=result.get("current_action"),
        agent_status=result.get("agent_status", "idle"),
        map_required=result.get("map_required", False),
        tool_required=result.get("tool_required", False),
        tool_name=result.get("tool_name"),
        requires_clarification=result.get("requires_clarification", False),
        location_available=result.get("location") is not None,
        location_permission_required=result.get("location_permission_required", False),
    )
    await _send_client_event(client_ws, {"type": "agent.state", "data": snapshot.model_dump()})

    search_results = result.get("search_results") or []
    if search_results:
        await _send_client_event(client_ws, {"type": "places.updated", "results": search_results})

    response_text = result.get("last_assistant_message")
    if response_text:
        await _send_client_event(client_ws, {
            "type": "agent.response", "text": response_text,
            "message_id": message_id, "phase": "final", "speak": not preview_sent,
        })

    logger.info("[latency] session=%s stage=turn_complete mode=%s duration_ms=%.0f preview=%s",
                session_id, state.get("input_mode", "text"), (perf_counter() - started) * 1000, preview_sent)

    await _send_client_event(client_ws, {
        "type": "agent.status",
        "status": result.get("agent_status", "idle"),
    })

    logger.info(
        "[ws] session=%s intent=%s conf=%.2f map=%s results=%d",
        session_id,
        result.get("current_intent"),
        result.get("intent_confidence", 0.0),
        result.get("map_required"),
        len(search_results),
    )


async def _handle_location_update(session_id: str, msg: dict, client_ws: WebSocket, queue_turn=None) -> None:
    state = _sessions.get(session_id)
    if state is None:
        return

    try:
        loc = parse_location(msg)
    except (ValueError, KeyError) as exc:
        logger.warning("[ws] Invalid location data: %s", exc)
        await _send_client_event(client_ws, {"type": "error", "message": "Invalid location data received."})
        return

    state["location"] = loc
    state["location_available"] = True
    state["location_source"] = loc.source
    state["location_accuracy"] = loc.accuracy
    state["location_permission_required"] = False
    _sessions[session_id] = state

    logger.info(
        "[ws] Location stored session=%s lat=%.4f lon=%.4f",
        session_id, loc.latitude, loc.longitude,
    )

    await _send_client_event(client_ws, {
        "type": "location.updated",
        "location": {"latitude": loc.latitude, "longitude": loc.longitude, "accuracy": loc.accuracy},
    })

    if state.get("current_action") == "location_required" and state.get("tool_name"):
        logger.info("[ws] Re-running agent after location received session=%s", session_id)
        await _send_client_event(client_ws, {"type": "places.loading"})
        if queue_turn is not None:
            await queue_turn(state.get("last_user_message", ""))
        else:
            await _run_agent(session_id, state.get("last_user_message", ""), str(uuid.uuid4()), client_ws)


_STOP_COMMANDS = {
    "stop", "stop please", "please stop", "stop talking", "stop speaking",
    "please stop talking", "please stop speaking", "be quiet", "quiet",
    "vera stop", "stop vera", "thats enough", "that is enough",
}


def _is_stop_command(text: str) -> bool:
    normalized = re.sub(r"[^a-z0-9\s]", " ", text.lower().replace("'", "").replace("’", ""))
    return " ".join(normalized.split()) in _STOP_COMMANDS


@router.websocket("/ws/voice")
async def voice_session(client_ws: WebSocket):
    await client_ws.accept()
    session_id = str(uuid.uuid4())
    _sessions[session_id] = _make_initial_state(session_id)
    await _send_client_event(client_ws, {"type": "session.begin", "session_id": session_id})
    logger.info("[ws] Session started: %s", session_id)

    transcript_queue: asyncio.Queue = asyncio.Queue()
    current_task: asyncio.Task | None = None
    provider_task: asyncio.Task | None = None
    aai_ws = None
    voice_requested = False
    pending_audio = deque()
    pending_audio_bytes = 0
    audio_started_at = None
    audio_available = asyncio.Event()
    provider_ready = asyncio.Event()
    audio_send_error = None
    voice_epoch = 0
    managed_active = False
    bootstrap_task = None
    location_ready = asyncio.Event()

    async def send_managed_result(request_id, result=None, error=None):
        await _send_client_event(client_ws, {
            "type": "managed.result", "request_id": request_id,
            "result": result, "error": error,
        })

    async def bootstrap_managed(request_id):
        nonlocal managed_active
        try:
            result = await voice_agent.build_free_bootstrap(_sessions[session_id])
            managed_active = True
            await send_managed_result(request_id, result=result)
        except voice_agent.VoiceAgentUnavailable:
            await send_managed_result(request_id, error="Managed voice is unavailable; trying standard voice.")
        except WebSocketDisconnect:
            return
        except Exception as exc:
            logger.warning("[voice] Managed bootstrap failed (%s)", type(exc).__name__)
            await send_managed_result(request_id, error="Could not configure managed voice; trying standard voice.")

    class ManagedToolSocket:
        """Only screen events go to the UI; the answer goes back to the voice tool."""
        def __init__(self, request_id):
            self.request_id = request_id
            self.answer = ""

        def __getattr__(self, name):
            return getattr(client_ws, name)

        async def send_json(self, event):
            if event["type"] == "agent.response":
                self.answer = event.get("text", "")
            else:
                await _send_client_event(client_ws, {**event, "request_id": self.request_id})

    async def run_managed_tool(text, msg_id, request):
        request_id = request["request_id"]
        tool_ws = ManagedToolSocket(request_id)
        location_ready.clear()

        async def run():
            await _run_agent(session_id, text, str(uuid.uuid4()), tool_ws,
                             managed=True, user_message_id=msg_id)
            # Keep what the user actually hears in history. The managed agent
            # sends its spoken transcript separately after receiving this result.
            state = _sessions[session_id]
            if state["messages"] and isinstance(state["messages"][-1], AIMessage):
                state["messages"] = state["messages"][:-1]

        try:
            async with asyncio.timeout(40):
                await run()
                state = _sessions[session_id]
                if state.get("location_permission_required") and not state.get("location"):
                    try:
                        await asyncio.wait_for(location_ready.wait(), timeout=15)
                    except TimeoutError:
                        pass
                    if _sessions[session_id].get("location"):
                        await run()
                state = _sessions[session_id]
                await send_managed_result(request_id, result={
                    "answer": tool_ws.answer,
                    "visual_visible": bool(state.get("visual_required") and state.get("visual_spec")),
                    "map_visible": bool(state.get("map_required")),
                    "location_available": bool(state.get("location")),
                })
        except asyncio.CancelledError:
            await send_managed_result(request_id, error="Request interrupted by the user.")
            raise
        except TimeoutError:
            await send_managed_result(request_id, error="The action took too long. Please try again.")

    async def interrupt():
        # Discard queued responses as well as the one currently being generated.
        while not transcript_queue.empty():
            _text, _id, _mode, request = transcript_queue.get_nowait()
            if request:
                await send_managed_result(request["request_id"], error="Request interrupted by the user.")
        if current_task is not None and not current_task.done():
            current_task.cancel()
        await _send_client_event(client_ws, {"type": "agent.interrupted"})
        await _send_client_event(client_ws, {
            "type": "agent.status", "status": "listening" if voice_requested else "idle",
        })

    async def submit(text, input_mode=None, managed_request=None):
        await interrupt()
        if not _is_stop_command(text):
            # Location retries keep the original turn's input mode.
            mode = input_mode or _sessions[session_id].get("input_mode", "text")
            msg_id = managed_request.get("user_message_id") if managed_request else None
            await transcript_queue.put((text, msg_id or str(uuid.uuid4()), mode, managed_request))
        elif managed_request:
            await send_managed_result(managed_request["request_id"], error="Request interrupted by the user.")

    async def forward_transcripts():
        nonlocal aai_ws, voice_requested, pending_audio_bytes, audio_started_at, audio_send_error
        # Reconnect the speech provider without replacing the conversation socket
        # or throwing away the LangGraph history.
        for attempt in range(3):
            if not voice_requested:
                return
            upstream = None
            ready = False
            connect_started = perf_counter()
            try:
                await _send_client_event(client_ws, {"type": "voice.status", "status": "connecting"})
                upstream = await asyncio.wait_for(connect_assemblyai(conversational=True), timeout=_AAI_CONNECT_TIMEOUT)
                seen_final_turns = set()
                speech_started = False
                while voice_requested:
                    raw = await asyncio.wait_for(
                        upstream.recv(), timeout=None if ready else max(0.01, _AAI_CONNECT_TIMEOUT - (perf_counter() - connect_started)),
                    )
                    event = parse_assemblyai_event(raw)
                    if not event:
                        continue
                    event_type = event["type"]
                    if event_type == "session.begin":
                        ready = True
                        aai_ws = upstream
                        provider_ready.set()
                        logger.info("[voice timing] session=%s provider_ready_ms=%.0f",
                                    session_id, (perf_counter() - connect_started) * 1000)
                        await _send_client_event(client_ws, {"type": "voice.status", "status": "listening"})
                        continue
                    if event_type in ("session.end", "error"):
                        raise RuntimeError(event.get("message") or "Speech provider session ended")
                    if event_type == "transcript.final":
                        turn_id = event.get("turn_id")
                        if turn_id is not None:
                            if turn_id in seen_final_turns:
                                continue
                            seen_final_turns.add(turn_id)
                        logger.info("[voice timing] session=%s transcript_final audio_elapsed_ms=%.0f",
                                    session_id, (perf_counter() - audio_started_at) * 1000 if audio_started_at else 0)
                    # Some streaming models send partial transcripts without
                    # SpeechStarted. Both must be able to interrupt an old reply.
                    if event_type == "speech.started" or (
                        event_type == "transcript.partial" and event.get("text", "").strip()
                    ):
                        if not speech_started:
                            await interrupt()
                            speech_started = True
                    await _send_client_event(client_ws, event)
                    if event_type == "transcript.final":
                        await submit(event["text"], input_mode="voice")
                        speech_started = False
            except asyncio.CancelledError:
                raise
            except WebSocketDisconnect:
                return
            except Exception as exc:
                logger.warning("[ws] speech connection attempt %s failed: %s: %s",
                               attempt + 1, type(exc).__name__, str(exc)[:200])
            finally:
                if aai_ws is upstream:
                    aai_ws = None
                    provider_ready.clear()
                if upstream is not None:
                    await close_assemblyai(upstream)
            # One bounded startup attempt. Three silent startup retries could
            # consume 30+ seconds while the user's initial speech was discarded.
            if not ready:
                break
            if audio_send_error:
                break
            if voice_requested and attempt < 2:
                await asyncio.sleep(0.5)
        if voice_requested:
            voice_requested = False
            pending_audio.clear()
            pending_audio_bytes = 0
            await _send_client_event(client_ws, {
                "type": "voice.status",
                "status": "unavailable",
                "message": audio_send_error or "Speech connection unavailable. You can keep typing or try starting voice again.",
            })

    def start_transcription():
        nonlocal voice_requested, provider_task, audio_started_at, audio_send_error, voice_epoch
        voice_requested = True
        if provider_task is None or provider_task.done():
            voice_epoch += 1
            audio_started_at = None
            audio_send_error = None
            provider_task = asyncio.create_task(forward_transcripts())

    async def stop_transcription():
        nonlocal voice_requested, provider_task, pending_audio_bytes, aai_ws, voice_epoch
        voice_epoch += 1
        stopped_epoch = voice_epoch
        voice_requested = False
        task = provider_task
        provider_task = None
        aai_ws = None
        pending_audio.clear()
        pending_audio_bytes = 0
        audio_available.clear()
        provider_ready.clear()
        if task is not None:
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)
        if stopped_epoch == voice_epoch:
            await _send_client_event(client_ws, {"type": "voice.status", "status": "paused"})
        return stopped_epoch

    async def send_audio():
        """An upstream write must never block browser stop/disconnect messages."""
        nonlocal pending_audio_bytes, audio_send_error
        while True:
            await provider_ready.wait()
            await audio_available.wait()
            upstream = aai_ws
            if upstream is None or not voice_requested:
                audio_available.clear()
                continue
            chunks = []
            size = 0
            while pending_audio and size + len(pending_audio[0]) <= _AUDIO_PACKET_BYTES:
                chunk = pending_audio.popleft()
                pending_audio_bytes -= len(chunk)
                chunks.append(chunk)
                size += len(chunk)
            if not chunks and pending_audio:
                chunk = pending_audio.popleft()
                pending_audio_bytes -= len(chunk)
                chunks.append(chunk)
            if not pending_audio:
                audio_available.clear()
            if not chunks:
                continue
            try:
                await asyncio.wait_for(upstream.send(b"".join(chunks)), timeout=_AAI_SEND_TIMEOUT)
            except (TimeoutError, websockets.exceptions.ConnectionClosed):
                if upstream is not aai_ws or not voice_requested:
                    continue
                audio_send_error = "Speech connection is too slow. Please restart voice or keep typing."
                logger.warning("[voice timing] session=%s audio_send_stalled queued_ms=%.0f",
                               session_id, pending_audio_bytes / _AUDIO_BYTES_PER_SECOND * 1000)
                stopped_epoch = await stop_transcription()
                if stopped_epoch == voice_epoch:
                    await _send_client_event(client_ws, {
                        "type": "voice.status", "status": "unavailable", "message": audio_send_error,
                    })

    async def receive_client_messages():
        nonlocal pending_audio_bytes, audio_started_at, audio_send_error, bootstrap_task, managed_active
        while True:
            msg = await client_ws.receive()
            if msg["type"] == "websocket.disconnect":
                return
            if msg["type"] != "websocket.receive":
                continue
            if msg.get("bytes"):
                if voice_requested and audio_started_at is None:
                    audio_started_at = perf_counter()
                limit = _AUDIO_BYTES_PER_SECOND * (2 if provider_ready.is_set() else _AAI_CONNECT_TIMEOUT)
                if voice_requested and pending_audio_bytes + len(msg["bytes"]) <= limit:
                    pending_audio.append(msg["bytes"])
                    pending_audio_bytes += len(msg["bytes"])
                    audio_available.set()
                elif voice_requested:
                    audio_send_error = "Speech connection is falling behind. Please restart voice or keep typing."
                    await stop_transcription()
                    await _send_client_event(client_ws, {
                        "type": "voice.status", "status": "unavailable", "message": audio_send_error,
                    })
                continue
            if not msg.get("text"):
                continue
            try:
                data = json.loads(msg["text"])
            except (ValueError, TypeError):
                continue
            event_type = data.get("type")
            if event_type == "managed.bootstrap":
                request_id = str(data.get("request_id", ""))[:128]
                if bootstrap_task is not None and not bootstrap_task.done():
                    await send_managed_result(request_id, error="Voice setup is already in progress.")
                else:
                    bootstrap_task = asyncio.create_task(bootstrap_managed(request_id))
            elif event_type == "managed.stop":
                managed_active = False
                if bootstrap_task is not None:
                    bootstrap_task.cancel()
                await interrupt()
            elif event_type in ("managed.user", "managed.assistant") and managed_active:
                text = str(data.get("text") or "").strip()[:20000]
                item_id = str(data.get("message_id") or "")[:128]
                if text and item_id:
                    state = _sessions[session_id]
                    cls = HumanMessage if event_type == "managed.user" else AIMessage
                    state["messages"] = add_messages(state["messages"], [cls(content=text, id=item_id)])
                    if cls is HumanMessage:
                        state["last_user_message"] = text
            elif event_type == "managed.tool":
                request_id = str(data.get("request_id", ""))[:128]
                text = str(data.get("message") or "").strip()[:4000]
                if not managed_active or data.get("name") != voice_agent.FREE_TOOL_NAME or not text:
                    await send_managed_result(request_id, error="Invalid or inactive voice tool request.")
                else:
                    await submit(text, "voice", {
                        "request_id": request_id,
                        "user_message_id": str(data.get("user_message_id") or "")[:128],
                    })
            elif event_type == "text.message":
                text = (data.get("text") or "").strip()
                if text:
                    await submit(text, input_mode="text")
            elif event_type == "agent.interrupt":
                await interrupt()
            elif event_type == "voice.start":
                managed_active = False
                start_transcription()
            elif event_type == "voice.stop":
                await interrupt()
                await stop_transcription()
            elif event_type == "location.update":
                async def skip_retry(_text):
                    pass  # The managed tool waits for this location and retries itself.
                await _handle_location_update(session_id, data, client_ws, queue_turn=skip_retry if managed_active else submit)
                location_ready.set()
            elif event_type == "location.denied":
                state = _sessions.get(session_id)
                if state:
                    state["location_permission_required"] = False
                location_ready.set()

    async def process_agent():
        nonlocal current_task
        while True:
            text, msg_id, input_mode, managed_request = await transcript_queue.get()
            _sessions[session_id]["input_mode"] = input_mode
            task = asyncio.create_task(run_managed_tool(text, msg_id, managed_request) if managed_request
                                       else _run_agent(session_id, text, msg_id, client_ws))
            current_task = task
            try:
                await task
            except asyncio.CancelledError:
                # Child cancellation means "stop this reply"; parent cancellation
                # means the client left and this worker must exit.
                if asyncio.current_task().cancelling():
                    raise
            except WebSocketDisconnect:
                return
            except Exception as exc:
                logger.error("[ws] Agent processing error: %s", exc)
                if managed_request:
                    await send_managed_result(managed_request["request_id"], error="Could not perform that action. Please try again.")
                else:
                    await _send_client_event(client_ws, {"type": "error", "message": "Could not answer. Please try again."})
            finally:
                if current_task is task:
                    current_task = None

    # New clients explicitly enable voice; legacy callers still start in voice mode.
    if client_ws.query_params.get("voice") != "manual":
        start_transcription()
    receiver = asyncio.create_task(receive_client_messages())
    processor = asyncio.create_task(process_agent())
    audio_sender = asyncio.create_task(send_audio())
    try:
        done, _pending = await asyncio.wait((receiver, processor, audio_sender), return_when=asyncio.FIRST_COMPLETED)
        for task in done:
            task.result()
    except WebSocketDisconnect:
        pass
    finally:
        voice_requested = False
        tasks = [task for task in (receiver, processor, audio_sender, provider_task, current_task, bootstrap_task) if task is not None]
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        _sessions.pop(session_id, None)
        logger.info("[ws] Session cleaned up: %s", session_id)

# ===========================================================================
# Business assistant voice — mirrors voice_session() above but talks to
# app.services.business_chat.send_message instead of the free chatbot's
# LangGraph agent. Deliberately kept separate and much simpler (no
# location/map/visual orchestration): a business assistant reply is just
# "text in, grounded text out", so this only needs STT in and the same
# text-turn pipeline the REST test/public routes already use. Two thin
# entrypoints below share one core loop — they differ only in how the
# caller is authorized (owner session cookie vs. public assistant id).
# ===========================================================================

async def _run_business_turn(
    db: Session,
    business: Business,
    session_prefix: str,
    session_id: str,
    text: str,
    client_ws: WebSocket,
) -> None:
    await client_ws.send_json({"type": "agent.status", "status": "processing"})
    try:
        result = await business_chat.send_message(
            db=db,
            business=business,
            session_id=f"{session_prefix}:{session_id}",
            message=text,
            channel="voice",
        )
    except Exception as exc:  # noqa: BLE001
        logger.error("[ws-business] chat failed business_id=%s: %s", business.id, exc)
        await client_ws.send_json({
            "type": "agent.response",
            "text": "I'm having trouble answering right now — please try again in a moment.",
        })
        await client_ws.send_json({"type": "agent.status", "status": "idle"})
        return

    await client_ws.send_json({
        "type": "agent.response",
        "text": result["answer"],
        "spoken_text": voice_agent.make_spoken_answer(result["answer"]),
        "grounded": result["grounded"],
        "sources": result["sources"],
    })
    if result.get("incident"):
        await client_ws.send_json({"type": "incident.update", "incident": result["incident"]})
    if result.get("ticket"):
        await client_ws.send_json({"type": "ticket.update", "ticket": result["ticket"]})
    if result.get("order"):
        await client_ws.send_json({"type": "order.update", "order": result["order"]})
    if result.get("handoff"):
        await client_ws.send_json({"type": "handoff.update", "handoff": result["handoff"]})
    await client_ws.send_json({"type": "agent.status", "status": "idle"})


async def _business_voice_loop(
    client_ws: WebSocket,
    business: Business,
    session_prefix: str,
    session_id: str,
) -> None:
    """Core STT -> business_chat -> reply loop, shared by both entrypoints."""
    db = SessionLocal()
    aai_ws = None
    try:
        aai_ws = await asyncio.wait_for(connect_assemblyai(), timeout=_AAI_CONNECT_TIMEOUT)
    except Exception as exc:
        logger.warning("[ws-business] AssemblyAI unavailable (%s) — text mode only", exc)

    await client_ws.send_json({
        "type": "session.begin",
        "voice_available": aai_ws is not None,
    })

    transcript_queue: asyncio.Queue = asyncio.Queue()
    current_task: dict[str, asyncio.Task | None] = {"task": None}
    seen_final_turns: set[int | str] = set()

    async def forward_transcripts():
        if aai_ws is None:
            return
        try:
            async for raw in aai_ws:
                event = parse_assemblyai_event(raw)
                if not event:
                    continue
                if event["type"] == "transcript.final":
                    turn_id = event.get("turn_id")
                    if turn_id is not None:
                        if turn_id in seen_final_turns:
                            continue
                        seen_final_turns.add(turn_id)
                await client_ws.send_json(event)
                if event["type"] == "speech.started":
                    task = current_task["task"]
                    if task is not None and not task.done():
                        task.cancel()
                    continue
                if event["type"] == "transcript.final":
                    await transcript_queue.put(event["text"])
        except (websockets.exceptions.ConnectionClosed, WebSocketDisconnect):
            pass
        finally:
            await transcript_queue.put(None)

    async def receive_client_messages():
        try:
            while True:
                msg = await client_ws.receive()
                if msg["type"] == "websocket.receive" and msg.get("bytes"):
                    if aai_ws is not None and is_open(aai_ws):
                        await aai_ws.send(msg["bytes"])
                elif msg["type"] == "websocket.receive" and msg.get("text"):
                    try:
                        data = json.loads(msg["text"])
                    except Exception:
                        continue
                    if data.get("type") == "text.message":
                        text = (data.get("text") or "").strip()
                        if text:
                            await transcript_queue.put(text)
                elif msg["type"] == "websocket.disconnect":
                    break
        except WebSocketDisconnect:
            pass
        finally:
            await transcript_queue.put(None)

    async def process_turns():
        while True:
            text = await transcript_queue.get()
            if text is None:
                break
            task = asyncio.ensure_future(
                _run_business_turn(db, business, session_prefix, session_id, text, client_ws)
            )
            current_task["task"] = task
            try:
                await task
            except asyncio.CancelledError:
                try:
                    await client_ws.send_json({"type": "agent.interrupted"})
                    await client_ws.send_json({"type": "agent.status", "status": "interrupted"})
                except Exception:
                    pass
            except WebSocketDisconnect:
                break
            except Exception as exc:
                logger.error("[ws-business] turn error: %s", exc)
            finally:
                if current_task["task"] is task:
                    current_task["task"] = None

    try:
        await asyncio.gather(forward_transcripts(), receive_client_messages(), process_turns())
    finally:
        if aai_ws is not None:
            await close_assemblyai(aai_ws)
        db.close()
        logger.info("[ws-business] session cleaned up business_id=%s", business.id)


@router.websocket("/ws/business-voice/test/{business_id}")
async def business_voice_test(client_ws: WebSocket, business_id: int):
    """
    Owner-only — powers the "Test your assistant" mic button in the
    dashboard (CustomizeAssistant.jsx). Authorized the same way REST routes
    are (session cookie), just read manually since Depends(get_current_user)
    needs a Request, not a WebSocket. Shares the "owner-test:" session
    prefix with the REST /assistant/test route so voice and typed test
    messages land in the same conversation thread.
    """
    await client_ws.accept()
    token = client_ws.cookies.get(settings.session_cookie_name)
    user_id = _decode_session_token(token) if token else None
    if user_id is None:
        await client_ws.close(code=4401, reason="Not authenticated")
        return

    db = SessionLocal()
    try:
        business = (
            db.query(Business)
            .filter(Business.id == business_id, Business.owner_user_id == user_id)
            .first()
        )
    finally:
        db.close()
    if business is None:
        await client_ws.close(code=4404, reason="Business not found")
        return

    session_id = client_ws.query_params.get("session_id") or str(uuid.uuid4())
    await _business_voice_loop(client_ws, business, "owner-test", session_id)


@router.websocket("/ws/business-voice/widget/{public_id}")
async def business_voice_widget(client_ws: WebSocket, public_id: str):
    """
    Public — powers the mic button in the embeddable widget.js running on a
    business's own website. Resolved only through the unguessable public_id
    (never a business_id), same as the REST /public/* routes, and rejects
    unlisted origins once a business has configured an allowlist. Shares
    the "widget:" session prefix with the REST public route so voice and
    typed messages land in the same conversation thread.
    """
    await client_ws.accept()
    db = SessionLocal()
    try:
        result = business_chat.get_config_and_business_by_public_id(db, public_id)
        if result is None:
            await client_ws.close(code=4404, reason="Assistant not found")
            return
        config, business = result
        if not config.embed_enabled:
            await client_ws.close(code=4403, reason="Assistant not published")
            return
        origin = client_ws.headers.get("origin")
        if not business_chat.origin_is_allowed(config, origin):
            await client_ws.close(code=4403, reason="Origin not authorized")
            return
    finally:
        db.close()

    session_id = client_ws.query_params.get("session_id") or str(uuid.uuid4())
    await _business_voice_loop(client_ws, business, "widget", session_id)
