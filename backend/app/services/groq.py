import json
import logging
from groq import Groq, APIError, APITimeoutError
from app.config.settings import settings
from app.agent.schemas import AgentDecision
from app.agent.prompts import VERA_SYSTEM_PROMPT, INTENT_CLASSIFICATION_PROMPT

logger = logging.getLogger(__name__)

_client: Groq | None = None


def get_client() -> Groq:
    global _client
    if _client is None:
        if not settings.groq_api_key:
            raise RuntimeError("GROQ_API_KEY is not configured")
        _client = Groq(api_key=settings.groq_api_key)
    return _client


def _parse_decision(raw: str) -> AgentDecision:
    """Parse and validate the model JSON response into AgentDecision."""
    # Strip markdown fences if present
    text = raw.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    data = json.loads(text)
    return AgentDecision(**data)


async def classify_intent(
    user_message: str,
    conversation_history: list[dict],
) -> AgentDecision:
    """
    Call Groq to classify intent and produce a structured AgentDecision.
    conversation_history: list of {"role": "user"|"assistant", "content": str}
    """
    client = get_client()

    messages = [
        {"role": "system", "content": VERA_SYSTEM_PROMPT + "\n\n" + INTENT_CLASSIFICATION_PROMPT},
        *conversation_history,
        {"role": "user", "content": user_message},
    ]

    try:
        response = client.chat.completions.create(
            model=settings.groq_model,
            messages=messages,
            temperature=0.1,
            # gpt-oss-120b is a reasoning model — its hidden "thinking" tokens are
            # drawn from the same budget as the final JSON. 512 was too small, so
            # the model spent the whole budget reasoning and never emitted valid
            # JSON ("max completion tokens reached before generating a valid
            # document"). reasoning_effort="low" keeps the thinking phase short
            # for this simple classification task, and the larger budget below
            # leaves enough room for the actual JSON response either way.
            reasoning_effort="low",
            # Bumped from 1536 — responses are now expected to be genuinely
            # detailed (several sentences), and that "response" text shares
            # this same completion budget with the model's hidden reasoning.
            max_tokens=2048,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content
        decision = _parse_decision(raw)
        logger.info(
            "Groq decision | intent=%s confidence=%.2f urgency=%s tool=%s map=%s",
            decision.intent,
            decision.confidence,
            decision.urgency,
            decision.tool_name,
            decision.map_required,
        )
        return decision

    except APITimeoutError:
        logger.error("Groq API timeout")
        raise
    except APIError as exc:
        logger.error("Groq API error: %s", exc)
        raise
    except (json.JSONDecodeError, ValueError) as exc:
        logger.error("Failed to parse Groq response: %s", exc)
        raise