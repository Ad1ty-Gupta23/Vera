"""AssemblyAI Voice Agent API bootstrap helpers.

The browser connects directly to AssemblyAI with a short-lived, single-use
token. VERA's API key never leaves this backend. Business behavior stays in
``business_chat.send_message`` and is exposed to the managed agent as one
tenant-scoped JSON-Schema tool by the API routes.
"""
from __future__ import annotations

import logging
import re

import httpx

from app.config.settings import settings
from app.models.assistant import AssistantConfig
from app.models.business import Business

logger = logging.getLogger(__name__)

TOKEN_URL = "https://agents.assemblyai.com/v1/token"
WEBSOCKET_URL = "wss://agents.assemblyai.com/v1/ws"
TOOL_NAME = "handle_customer_message"

_URL_RE = re.compile(r"\bhttps?://[^\s<>()]+", re.IGNORECASE)
_STEP_WORDS = {1: "First", 2: "Second", 3: "Third"}


class VoiceAgentUnavailable(RuntimeError):
    """Raised when the optional managed runtime cannot start."""


def make_spoken_answer(answer: str) -> str:
    """Turn the structured visual response into concise, natural TTS text."""
    contains_url = bool(_URL_RE.search(answer or ""))
    spoken = answer or ""

    # Written headings make the chat easy to scan, but should become natural
    # transitions rather than being read aloud as labels.
    spoken = re.sub(r"(?im)^\s*\*\*?answer:\*\*?\s*", "", spoken)
    spoken = re.sub(r"(?im)^\s*answer:\s*", "", spoken)
    spoken = re.sub(r"(?im)^\s*\*\*?website:\*\*?\s*", "The website is ", spoken)
    spoken = re.sub(r"(?im)^\s*website:\s*", "The website is ", spoken)
    spoken = re.sub(r"(?im)^\s*details:[ \t]*", "Here are the details.\n", spoken)
    spoken = re.sub(r"(?im)^\s*next steps:[ \t]*", "Here are the next steps.\n", spoken)
    spoken = re.sub(r"(?im)^\s*next step:[ \t]*", "Next, ", spoken)
    spoken = re.sub(r"(?im)^\s*summary:[ \t]*", "Here is the summary. ", spoken)

    def speak_numbered_step(match: re.Match) -> str:
        number = int(match.group(1))
        transition = _STEP_WORDS.get(number, "Next")
        item = match.group(2).strip()
        punctuation = "" if item.endswith((".", "!", "?")) else "."
        return f"{transition}, {item}{punctuation} "

    def speak_bullet(match: re.Match) -> str:
        item = match.group(1).strip()
        punctuation = "" if item.endswith((".", "!", "?")) else "."
        return f"{item}{punctuation} "

    spoken = re.sub(r"(?m)^\s*(\d+)[.)]\s+(.+?)\s*$", speak_numbered_step, spoken)
    spoken = re.sub(r"(?m)^\s*[-•]\s+(.+?)\s*$", speak_bullet, spoken)

    def speak_url(match: re.Match) -> str:
        raw = match.group(0)
        trailing = ""
        while raw and raw[-1] in ".,!?;:":
            trailing = raw[-1] + trailing
            raw = raw[:-1]
        readable = re.sub(r"^https?://", "", raw, flags=re.IGNORECASE)
        readable = re.sub(r"^www\.", "", readable, flags=re.IGNORECASE)
        replacements = {
            ".": " dot ",
            "/": " slash ",
            "-": " dash ",
            "_": " underscore ",
            "?": " question mark ",
            "=": " equals ",
            "&": " and ",
        }
        for character, word in replacements.items():
            readable = readable.replace(character, word)
        return re.sub(r"\s+", " ", readable).strip() + trailing

    spoken = _URL_RE.sub(speak_url, spoken)
    spoken = re.sub(r"\s+", " ", spoken).strip()
    if contains_url and "clickable link" not in spoken.lower():
        spoken = f"{spoken} The complete clickable link is displayed in the chat."
    return spoken


async def mint_temporary_token() -> str:
    """Mint a short-lived, single-use browser token without exposing the key."""
    if not settings.assemblyai_voice_agent_enabled:
        raise VoiceAgentUnavailable("Managed Voice Agent mode is disabled")
    if not settings.assemblyai_api_key:
        raise VoiceAgentUnavailable("ASSEMBLYAI_API_KEY is not configured")

    expires = max(1, min(settings.assemblyai_voice_agent_token_ttl_seconds, 600))
    duration = max(60, min(settings.assemblyai_voice_agent_max_session_seconds, 10800))
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            response = await client.get(
                TOKEN_URL,
                params={
                    "expires_in_seconds": expires,
                    "max_session_duration_seconds": duration,
                },
                headers={"Authorization": f"Bearer {settings.assemblyai_api_key}"},
            )
            response.raise_for_status()
            token = response.json().get("token")
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("[voice_agent] temporary token request failed: %s", exc)
        raise VoiceAgentUnavailable("AssemblyAI Voice Agent is unavailable") from exc

    if not token:
        raise VoiceAgentUnavailable("AssemblyAI returned an empty Voice Agent token")
    return token


def build_session_config(config: AssistantConfig, business: Business) -> dict:
    """Build safe inline configuration for this business's managed agent.

    The prompt contains no API secrets or private owner-only instructions.
    The authoritative answer still comes from VERA's existing tenant-aware
    business pipeline through ``handle_customer_message``.
    """
    assistant_name = config.assistant_name or "Assistant"
    business_name = business.name or "this business"
    keyterms = list(dict.fromkeys(v for v in (business_name, assistant_name) if v))

    system_prompt = f"""You are {assistant_name}, the customer-facing voice action assistant for {business_name}.

Critical rule: for every customer request after the greeting, call the handle_customer_message tool exactly once.
Pass the customer's complete request in the message
field without adding facts or changing its meaning. The tool is the only authoritative source for
business facts and actions.

After the tool returns, speak only its spoken_answer field. Do not summarize, omit, or replace
specific details. In particular, never replace a spoken web address with the vague phrase "our
website." The spoken_answer is already converted from written headings, steps, and URL syntax into
natural speech. Keep delivery concise and conversational. Never invent a policy, price, order
status, contact detail, or completed action. Do not expose tool internals. If the tool fails,
apologize briefly and ask the customer to try again. Never claim an email was sent unless the tool
result explicitly says it was sent."""

    return {
        "system_prompt": system_prompt,
        "greeting": config.greeting_message,
        "tools": [
            {
                "type": "function",
                "name": TOOL_NAME,
                "description": (
                    "Send the customer's request through VERA's secure business knowledge, "
                    "conversation, and action workflow. Use for every customer request."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "message": {
                            "type": "string",
                            "description": "The customer's complete spoken request.",
                        }
                    },
                    "required": ["message"],
                    "additionalProperties": False,
                },
                "execution_mode": "interactive",
                "timeout_seconds": 30,
            }
        ],
        "input": {
            "format": {"encoding": "audio/pcm"},
            "keyterms": keyterms[:100],
            "transcription_mode": "balanced",
            # Balanced mode normally waits 500 ms before confirming barge-in.
            # Keep its stronger transcription while making interruption feel
            # immediate for a live support conversation.
            "turn_detection": {
                "interrupt_response": True,
                "interruption_delay": 100,
            },
            "transcription_prompt": (
                f"This is a customer support call with {business_name}. "
                "Preserve names, email addresses, phone numbers, and order references exactly."
            )[:1750],
        },
        "output": {
            "voice": settings.assemblyai_voice_agent_voice,
            "format": {"encoding": "audio/pcm"},
        },
    }


async def build_bootstrap(config: AssistantConfig, business: Business) -> dict:
    return {
        "provider": "assemblyai_voice_agent",
        "websocket_url": WEBSOCKET_URL,
        "token": await mint_temporary_token(),
        "session": build_session_config(config, business),
    }
