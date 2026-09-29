import asyncio
import json
from urllib.parse import urlencode
import websockets
from websockets.connection import State
from app.config.settings import settings

# AssemblyAI's legacy v2 realtime endpoint (wss://api.assemblyai.com/v2/realtime/ws)
# was fully decommissioned. All streaming now goes through Universal-Streaming v3.
ASSEMBLYAI_RT_URL = "wss://streaming.assemblyai.com/v3/ws"
SAMPLE_RATE = 16000


async def connect_assemblyai(*, conversational: bool = False):
    """Open an authenticated AssemblyAI Universal-Streaming (v3) WebSocket."""
    if not settings.assemblyai_api_key:
        raise RuntimeError("ASSEMBLYAI_API_KEY is not configured")

    params = {"sample_rate": SAMPLE_RATE, "format_turns": "true"}
    if conversational:
        params.update({
            "mode": "min_latency",
            "interruption_delay": 0,
            "format_turns": "false",
            "min_turn_silence": settings.free_voice_min_turn_silence_ms,
            "max_turn_silence": settings.free_voice_max_turn_silence_ms,
        })
    url = f"{ASSEMBLYAI_RT_URL}?{urlencode(params)}"
    headers = {"Authorization": settings.assemblyai_api_key}
    ws = await websockets.connect(url, additional_headers=headers)
    return ws


def is_open(ws) -> bool:
    return ws.state == State.OPEN


async def close_assemblyai(ws) -> None:
    """Explicitly end a live speech session, even if its transport is stalled.

    Call after stopping transcription processing: a user ending voice should
    not launch another answer from the final turn emitted by Terminate.
    """
    try:
        if is_open(ws):
            await asyncio.wait_for(ws.send(json.dumps({"type": "Terminate"})), timeout=0.2)
    except Exception:
        pass  # Still close the transport if the termination frame cannot send.
    finally:
        try:
            await asyncio.wait_for(ws.close(), timeout=2)
        except Exception:
            pass


def parse_assemblyai_event(raw: str) -> dict | None:
    """Parse a raw AssemblyAI Universal-Streaming (v3) message into a normalised VERA event dict."""
    try:
        msg = json.loads(raw)
    except json.JSONDecodeError:
        return None

    msg_type = msg.get("type", "")

    # v3 sends a single "Turn" event type for both partial and final transcripts,
    # distinguished by the "end_of_turn" flag (replaces v2's PartialTranscript/FinalTranscript).
    if msg_type == "Turn":
        text = (msg.get("transcript") or "").strip()
        if not text:
            return None
        if msg.get("end_of_turn"):
            return {
                "type": "transcript.final",
                "text": text,
                # AssemblyAI keeps this stable for all deliveries belonging
                # to the same turn. Preserve it so callers can make final
                # transcript handling idempotent.
                "turn_id": msg.get("turn_order"),
            }
        return {
            "type": "transcript.partial",
            "text": text,
            "turn_id": msg.get("turn_order"),
        }

    # SpeechStarted precedes the first transcript on supporting models. It is
    # provider-timed (not immediate local VAD); partials also support barge-in.
    if msg_type == "SpeechStarted":
        return {"type": "speech.started"}

    if msg_type == "Begin":
        return {"type": "session.begin", "session_id": msg.get("id", "")}

    if msg_type == "Termination":
        return {"type": "session.end"}

    if msg_type == "Error":
        return {"type": "error", "message": msg.get("error", "AssemblyAI error")}

    return None
