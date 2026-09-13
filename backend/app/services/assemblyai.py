import json
import websockets
from websockets.connection import State
from app.config.settings import settings

# AssemblyAI's legacy v2 realtime endpoint (wss://api.assemblyai.com/v2/realtime/ws)
# was fully decommissioned. All streaming now goes through Universal-Streaming v3.
ASSEMBLYAI_RT_URL = "wss://streaming.assemblyai.com/v3/ws"
SAMPLE_RATE = 16000


async def connect_assemblyai():
    """Open an authenticated AssemblyAI Universal-Streaming (v3) WebSocket."""
    if not settings.assemblyai_api_key:
        raise RuntimeError("ASSEMBLYAI_API_KEY is not configured")

    url = f"{ASSEMBLYAI_RT_URL}?sample_rate={SAMPLE_RATE}&format_turns=true"
    headers = {"Authorization": settings.assemblyai_api_key}
    ws = await websockets.connect(url, additional_headers=headers)
    return ws


def is_open(ws) -> bool:
    return ws.state == State.OPEN


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
            return {"type": "transcript.final", "text": text}
        return {"type": "transcript.partial", "text": text}

    # v3 sends "SpeechStarted" the instant it detects the user has begun
    # talking — this fires *before* any Turn text arrives, which makes it the
    # earliest possible signal for barge-in / interruption handling.
    if msg_type == "SpeechStarted":
        return {"type": "speech.started"}

    if msg_type == "Begin":
        return {"type": "session.begin", "session_id": msg.get("id", "")}

    if msg_type == "Termination":
        return {"type": "session.end"}

    if msg_type == "Error":
        return {"type": "error", "message": msg.get("error", "AssemblyAI error")}

    return None