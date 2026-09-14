import asyncio
import json
import logging
import uuid
import websockets
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from app.services.assemblyai import connect_assemblyai, parse_assemblyai_event, is_open
from app.services.location import LocationState, parse_location
from app.agent.graph import vera_graph
from app.agent.state import VERAState
from app.agent.schemas import AgentStateSnapshot
from app.auth.security import _decode_session_token
from app.config.settings import settings
from app.db.session import SessionLocal
from app.models.business import Business
from app.services import business_chat, voice_agent

logger = logging.getLogger(__name__)
router = APIRouter()

_sessions: dict[str, VERAState] = {}

# How long (seconds) to wait for AssemblyAI SessionBegins before giving up
_AAI_CONNECT_TIMEOUT = 8


def _make_initial_state(session_id: str) -> VERAState:
    return VERAState(
        messages=[],
        session_id=session_id,
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
) -> None:
    state = _sessions.get(session_id)
    if state is None:
        return

    if message_id in state.get("processed_message_ids", []):
        logger.warning("[ws] Duplicate message_id=%s — skipped", message_id)
        return

    await client_ws.send_json({"type": "agent.status", "status": "processing"})

    state["last_user_message"] = user_message
    state["processed_message_ids"] = [
        *state.get("processed_message_ids", []),
        message_id,
    ]

    try:
        result: VERAState = await vera_graph.ainvoke(state)
    except Exception as exc:
        logger.error("[ws] LangGraph error session=%s: %s", session_id, exc)
        await client_ws.send_json({
            "type": "agent.response",
            "text": "I'm having trouble processing that right now. Please try again.",
        })
        await client_ws.send_json({"type": "agent.status", "status": "idle"})
        return

    _sessions[session_id] = result

    if result.get("location_permission_required") and not result.get("location"):
        await client_ws.send_json({"type": "location.request"})
        logger.info("[ws] Location requested for session=%s", session_id)

    if result.get("map_required"):
        await client_ws.send_json({"type": "map.show", "reason": "location_based_search"})
    else:
        await client_ws.send_json({"type": "map.hide"})

    # `state` here still holds the pre-turn active_visual_id (it was mutated
    # in place for last_user_message/processed_message_ids but never for
    # active_visual_id), so comparing it against `result` tells us whether
    # this is a brand-new visual or an in-place update.
    if result.get("visual_required") and result.get("visual_spec"):
        event_type = "visual.update" if state.get("active_visual_id") else "visual.show"
        await client_ws.send_json({
            "type": event_type,
            "visual_type": result.get("visual_type"),
            "visual": result.get("visual_spec"),
        })
    elif result.get("active_visual_id") is None and state.get("active_visual_id"):
        # Visual Planner explicitly cleared it (user said "hide this" / "close it")
        await client_ws.send_json({"type": "visual.hide"})

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
    await client_ws.send_json({"type": "agent.state", "data": snapshot.model_dump()})

    search_results = result.get("search_results") or []
    if search_results:
        await client_ws.send_json({"type": "places.updated", "results": search_results})

    response_text = result.get("last_assistant_message")
    if response_text:
        await client_ws.send_json({"type": "agent.response", "text": response_text})

    await client_ws.send_json({
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


async def _handle_location_update(session_id: str, msg: dict, client_ws: WebSocket) -> None:
    state = _sessions.get(session_id)
    if state is None:
        return

    try:
        loc = parse_location(msg)
    except (ValueError, KeyError) as exc:
        logger.warning("[ws] Invalid location data: %s", exc)
        await client_ws.send_json({"type": "error", "message": "Invalid location data received."})
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

    await client_ws.send_json({
        "type": "location.updated",
        "location": {"latitude": loc.latitude, "longitude": loc.longitude, "accuracy": loc.accuracy},
    })

    if state.get("current_action") == "location_required" and state.get("tool_name"):
        logger.info("[ws] Re-running agent after location received session=%s", session_id)
        await client_ws.send_json({"type": "places.loading"})
        await _run_agent(session_id, state.get("last_user_message", ""), str(uuid.uuid4()), client_ws)


@router.websocket("/ws/voice")
async def voice_session(client_ws: WebSocket):
    await client_ws.accept()

    session_id = str(uuid.uuid4())
    _sessions[session_id] = _make_initial_state(session_id)
    logger.info("[ws] Session started: %s", session_id)

    # Try to connect AssemblyAI — non-fatal if it fails (text mode still works)
    aai_ws = None
    try:
        aai_ws = await asyncio.wait_for(connect_assemblyai(), timeout=_AAI_CONNECT_TIMEOUT)
    except Exception as exc:
        logger.warning("[ws] AssemblyAI unavailable (%s) — voice disabled, text mode active", exc)
        # Notify frontend: voice unavailable but session continues for text
        await client_ws.send_json({
            "type": "session.begin",
            "session_id": session_id,
            "voice_available": False,
        })

    transcript_queue: asyncio.Queue = asyncio.Queue()
    # Tracks the currently in-flight _run_agent task (if any) so a new user
    # utterance can interrupt it — this is what makes the conversation feel
    # human: the mic never has to be re-armed, and speaking over VERA cuts
    # its current turn short instead of queuing behind it.
    current_task: dict[str, asyncio.Task | None] = {"task": None}
    seen_final_turns: set[int | str] = set()

    async def forward_transcripts():
        """Forward AssemblyAI transcript events to the client."""
        if aai_ws is None:
            return  # voice not available — just exit, text still works
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
                    # Barge-in: the user has started talking again. If VERA is
                    # still working on (or was about to finish) the previous
                    # turn, cut it off now rather than letting it finish or
                    # queuing the new input behind it.
                    task = current_task["task"]
                    if task is not None and not task.done():
                        task.cancel()
                        logger.info("[ws] session=%s interrupted by new speech", session_id)
                    continue

                if event["type"] == "transcript.final":
                    await transcript_queue.put((event["text"], str(uuid.uuid4())))
        except websockets.exceptions.ConnectionClosed:
            pass
        except WebSocketDisconnect:
            pass
        finally:
            await transcript_queue.put(None)

    async def receive_client_messages():
        """
        Single receiver loop — routes binary (audio) and JSON (control/text) messages.
        Avoids the race condition of having two concurrent receive calls.
        """
        try:
            while True:
                msg = await client_ws.receive()

                # Binary frame → audio data for AssemblyAI
                if msg["type"] == "websocket.receive" and msg.get("bytes"):
                    if aai_ws is not None and is_open(aai_ws):
                        await aai_ws.send(msg["bytes"])

                # Text frame → JSON control message
                elif msg["type"] == "websocket.receive" and msg.get("text"):
                    try:
                        data = json.loads(msg["text"])
                    except Exception:
                        continue

                    event_type = data.get("type")

                    if event_type == "text.message":
                        # User typed a message — run through the same agent pipeline
                        text = (data.get("text") or "").strip()
                        if text:
                            await transcript_queue.put((text, str(uuid.uuid4())))

                    elif event_type == "location.update":
                        await _handle_location_update(session_id, data, client_ws)

                    elif event_type == "location.denied":
                        state = _sessions.get(session_id)
                        if state:
                            state["location_permission_required"] = False
                        logger.info("[ws] Location denied session=%s", session_id)

                elif msg["type"] == "websocket.disconnect":
                    break

        except WebSocketDisconnect:
            pass
        except Exception as exc:
            logger.debug("[ws] receive_client_messages ended: %s", exc)
        finally:
            await transcript_queue.put(None)

    async def process_agent():
        while True:
            item = await transcript_queue.get()
            if item is None:
                break
            text, msg_id = item
            task = asyncio.ensure_future(_run_agent(session_id, text, msg_id, client_ws))
            current_task["task"] = task
            try:
                await task
            except asyncio.CancelledError:
                # Interrupted mid-turn by new speech (see forward_transcripts).
                # Conversation state up to this point is preserved in
                # _sessions[session_id] — only this in-progress response is
                # dropped, so the next utterance still has full prior context.
                logger.info("[ws] session=%s agent turn cancelled (barge-in)", session_id)
                try:
                    await client_ws.send_json({"type": "agent.interrupted"})
                    await client_ws.send_json({"type": "agent.status", "status": "interrupted"})
                except Exception:
                    pass
            except WebSocketDisconnect:
                break
            except Exception as exc:
                logger.error("[ws] Agent processing error: %s", exc)
            finally:
                if current_task["task"] is task:
                    current_task["task"] = None

    try:
        await asyncio.gather(
            forward_transcripts(),
            receive_client_messages(),
            process_agent(),
        )
    finally:
        if aai_ws is not None and is_open(aai_ws):
            await aai_ws.close()
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
        if aai_ws is not None and is_open(aai_ws):
            await aai_ws.close()
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
