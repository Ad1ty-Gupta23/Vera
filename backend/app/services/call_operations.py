"""Voice-call outcomes, resolution confirmation, and human escalation."""
from __future__ import annotations

import datetime
import re
from typing import Optional

from sqlalchemy.orm import Session

from app.models.business import Business
from app.models.conversation import Conversation, ConversationMessage
from app.models.incident import Incident
from app.models.support import HumanHandoff, SupportTicket, VoiceCall

_HUMAN_RE = re.compile(
    r"\b(human|real person|someone from (?:the )?(?:team|business)|live agent|representative|manager)\b"
    r"|\b(speak|talk|connect|transfer)\b.{0,24}\b(person|agent|staff|team|representative|manager)\b",
    re.IGNORECASE,
)
_POSITIVE_FEEDBACK = {
    "yes",
    "yes thanks",
    "yes thank you",
    "that helped",
    "that solved it",
    "it is resolved",
    "resolved",
    "all good",
    "perfect thanks",
}
_NEGATIVE_FEEDBACK = {
    "no",
    "nope",
    "that did not help",
    "that didnt help",
    "not resolved",
    "still not working",
    "i still need help",
}
_NEGATIVE_WORDS = {
    "angry", "bad", "broken", "complaint", "damaged", "disappointed", "error",
    "failed", "fraud", "frustrated", "not working", "terrible", "upset", "wrong",
}
_POSITIVE_WORDS = {"excellent", "good", "great", "helpful", "perfect", "thanks", "thank you"}


def _normalize(value: str) -> str:
    text = (value or "").lower().replace("'", "").replace("’", "")
    return " ".join(re.sub(r"[^a-z0-9\s]", " ", text).split())


def wants_human(message: str) -> bool:
    return bool(_HUMAN_RE.search(message or ""))


def resolution_feedback(message: str) -> Optional[bool]:
    normalized = _normalize(message)
    if normalized in _NEGATIVE_FEEDBACK:
        return False
    if normalized in _POSITIVE_FEEDBACK:
        return True
    if normalized.startswith(("no ", "nope ")):
        return False
    if normalized.startswith(("yes ", "yeah ", "yep ")) and not any(
        marker in normalized for marker in ("but", "not resolved", "didnt help", "still")
    ):
        return True
    return None


def _sentiment(message: str) -> str:
    normalized = _normalize(message)
    if any(word in normalized for word in _NEGATIVE_WORDS):
        return "negative"
    if any(word in normalized for word in _POSITIVE_WORDS):
        return "positive"
    return "neutral"


def _routing_category(text: str) -> str:
    normalized = _normalize(text)
    categories = (
        ("billing", ("billing", "payment", "refund", "charged", "invoice")),
        ("technical", ("technical", "error", "login", "not working", "bug", "app")),
        ("order", ("order", "delivery", "shipping", "return", "replacement")),
        ("appointment", ("appointment", "doctor", "dentist", "clinic", "consultation")),
        ("reservation", ("reservation", "booking", "table", "hotel")),
        ("sales", ("quote", "demo", "price", "property", "admission")),
    )
    for category, keywords in categories:
        if any(keyword in normalized for keyword in keywords):
            return category
    return "general"


def call_out(call: VoiceCall) -> dict:
    return {
        "id": call.id,
        "assemblyai_session_id": call.assemblyai_session_id,
        "client_session_id": call.client_session_id,
        "conversation_id": call.conversation_id,
        "status": call.status,
        "outcome": call.outcome,
        "primary_intent": call.primary_intent,
        "sentiment": call.sentiment,
        "summary": call.summary,
        "turns": call.turns,
        "tool_calls": call.tool_calls,
        "interruptions": call.interruptions,
        "started_at": call.started_at,
        "ended_at": call.ended_at,
    }


def handoff_out(handoff: HumanHandoff) -> dict:
    return {
        "id": handoff.id,
        "conversation_id": handoff.conversation_id,
        "voice_call_id": handoff.voice_call_id,
        "status": handoff.status,
        "routing_category": handoff.routing_category,
        "reason": handoff.reason,
        "summary": handoff.summary,
        "customer_name": handoff.customer_name,
        "customer_email": handoff.customer_email,
        "customer_phone": handoff.customer_phone,
        "requested_at": handoff.requested_at,
        "accepted_at": handoff.accepted_at,
        "completed_at": handoff.completed_at,
    }


def _get_or_create_call(
    db: Session,
    business: Business,
    conversation: Conversation,
    assemblyai_session_id: Optional[str],
) -> Optional[VoiceCall]:
    provider_id = (assemblyai_session_id or "").strip()
    if not provider_id:
        return None
    call = (
        db.query(VoiceCall)
        .filter(
            VoiceCall.business_id == business.id,
            VoiceCall.assemblyai_session_id == provider_id,
        )
        .first()
    )
    if call is None:
        call = VoiceCall(
            business_id=business.id,
            conversation_id=conversation.id,
            assemblyai_session_id=provider_id,
            client_session_id=conversation.session_id,
        )
        db.add(call)
        db.flush()
    return call


def record_voice_turn(
    db: Session,
    business: Business,
    conversation_id: int,
    assemblyai_session_id: Optional[str],
    customer_message: str,
    result: dict,
) -> Optional[VoiceCall]:
    conversation = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id, Conversation.business_id == business.id)
        .first()
    )
    if conversation is None:
        return None
    call = _get_or_create_call(db, business, conversation, assemblyai_session_id)
    if call is None:
        return None

    call.turns += 1
    call.tool_calls += 1
    current_sentiment = _sentiment(customer_message)
    if current_sentiment == "negative" or call.sentiment == "neutral":
        call.sentiment = current_sentiment

    if result.get("resolution_feedback") is True:
        call.outcome = "resolved"
        call.sentiment = "positive"
        call.awaiting_resolution = 0
    elif result.get("handoff"):
        call.primary_intent = result["handoff"].get("routing_category") or "human_handoff"
        call.outcome = "escalated"
        call.awaiting_resolution = 0
    elif result.get("ticket"):
        call.primary_intent = result["ticket"].get("category") or "customer_action"
        call.outcome = "case_created"
        call.awaiting_resolution = 0
    elif result.get("incident"):
        call.primary_intent = "customer_action"
        call.awaiting_resolution = 0
    elif result.get("order"):
        call.primary_intent = "order_lookup"
        call.awaiting_resolution = 1
    else:
        call.primary_intent = call.primary_intent or "knowledge_question"
        call.awaiting_resolution = 1

    call.summary = f"Latest request: {customer_message.strip()[:500]}"
    db.add(call)
    db.commit()
    db.refresh(call)
    return call


def create_handoff(
    db: Session,
    business: Business,
    conversation: Conversation,
    reason: str,
    assemblyai_session_id: Optional[str] = None,
) -> HumanHandoff:
    existing = (
        db.query(HumanHandoff)
        .filter(
            HumanHandoff.business_id == business.id,
            HumanHandoff.conversation_id == conversation.id,
            HumanHandoff.status.in_([
                HumanHandoff.STATUS_PENDING,
                HumanHandoff.STATUS_ACCEPTED,
            ]),
        )
        .order_by(HumanHandoff.id.desc())
        .first()
    )
    if existing is not None:
        return existing

    incident = (
        db.query(Incident)
        .filter(
            Incident.business_id == business.id,
            Incident.conversation_id == conversation.id,
        )
        .order_by(Incident.id.desc())
        .first()
    )
    ticket = (
        db.query(SupportTicket)
        .filter(
            SupportTicket.business_id == business.id,
            SupportTicket.conversation_id == conversation.id,
        )
        .order_by(SupportTicket.id.desc())
        .first()
    )
    call = _get_or_create_call(db, business, conversation, assemblyai_session_id)
    recent_customer = (
        db.query(ConversationMessage)
        .filter(
            ConversationMessage.conversation_id == conversation.id,
            ConversationMessage.role == "customer",
        )
        .order_by(ConversationMessage.id.desc())
        .limit(4)
        .all()
    )
    routing_text = " ".join(row.content for row in reversed(recent_customer))
    # The explicit escalation reason is the strongest current signal; recent
    # conversation gives useful context without masking that reason.
    routing_category = ticket.category if ticket else _routing_category(f"{routing_text} {reason}")
    handoff = HumanHandoff(
        business_id=business.id,
        conversation_id=conversation.id,
        voice_call_id=call.id if call else None,
        status=HumanHandoff.STATUS_PENDING,
        routing_category=routing_category,
        reason=reason.strip()[:2000] or "Customer requested human assistance",
        summary=(
            f"Human follow-up requested. Latest customer message: {reason.strip()[:500]}"
        ),
        customer_name=(ticket.customer_name if ticket else None) or (incident.customer_name if incident else None),
        customer_email=(ticket.customer_email if ticket else None) or (incident.customer_email if incident else None),
        customer_phone=(ticket.customer_phone if ticket else None) or (incident.customer_phone if incident else None),
    )
    db.add(handoff)
    if incident and incident.status in {
        Incident.STATUS_COLLECTING,
        Incident.STATUS_READY_FOR_REVIEW,
    }:
        incident.status = Incident.STATUS_CANCELLED
        db.add(incident)
    if call:
        call.outcome = "escalated"
        call.awaiting_resolution = 0
        db.add(call)
    db.commit()
    db.refresh(handoff)
    return handoff


def maybe_handle_resolution_feedback(
    db: Session,
    business: Business,
    conversation: Conversation,
    message: str,
    assemblyai_session_id: Optional[str],
) -> Optional[dict]:
    feedback = resolution_feedback(message)
    if feedback is None or not assemblyai_session_id:
        return None
    call = (
        db.query(VoiceCall)
        .filter(
            VoiceCall.business_id == business.id,
            VoiceCall.assemblyai_session_id == assemblyai_session_id,
            VoiceCall.status == VoiceCall.STATUS_ACTIVE,
            VoiceCall.awaiting_resolution == 1,
        )
        .first()
    )
    if call is None:
        return None
    call.awaiting_resolution = 0
    if feedback:
        call.outcome = "resolved"
        call.sentiment = "positive"
        db.add(call)
        db.commit()
        return {
            "answer": "Answer:\nGreat — I've marked your request as resolved. Is there anything else I can help with?",
            "handoff": None,
            "resolution_feedback": True,
        }

    handoff = create_handoff(
        db,
        business,
        conversation,
        "The customer said the AI response did not resolve the request.",
        assemblyai_session_id,
    )
    return {
        "answer": (
            "Answer:\nI’ve escalated this for human follow-up.\n\n"
            "Next steps:\n1. A team member can review the full conversation in the Action Center.\n"
            "2. You do not need to repeat the issue."
        ),
        "handoff": handoff_out(handoff),
        "resolution_feedback": False,
    }


def finish_call(
    db: Session,
    business: Business,
    assemblyai_session_id: str,
    interruptions: int = 0,
) -> Optional[VoiceCall]:
    call = (
        db.query(VoiceCall)
        .filter(
            VoiceCall.business_id == business.id,
            VoiceCall.assemblyai_session_id == assemblyai_session_id,
        )
        .first()
    )
    if call is None:
        return None
    call.status = VoiceCall.STATUS_ENDED
    call.ended_at = datetime.datetime.utcnow()
    call.interruptions = max(call.interruptions, max(0, interruptions))
    if call.outcome == "in_progress":
        # Ending without an explicit yes/no is unknown, not a successful
        # resolution. Keeping it unconfirmed avoids inflating containment.
        call.outcome = "unconfirmed" if call.awaiting_resolution else "unresolved"
    call.awaiting_resolution = 0

    customer_rows = (
        db.query(ConversationMessage)
        .filter(
            ConversationMessage.conversation_id == call.conversation_id,
            ConversationMessage.role == "customer",
        )
        .order_by(ConversationMessage.id.desc())
        .limit(3)
        .all()
    )
    if customer_rows:
        requests = "; ".join(row.content.strip()[:180] for row in reversed(customer_rows))
        call.summary = f"{call.primary_intent or 'Customer call'}: {requests}"[:1000]
    db.add(call)
    db.commit()
    db.refresh(call)
    return call


def list_calls(db: Session, business_id: int, limit: int = 30) -> list[VoiceCall]:
    return (
        db.query(VoiceCall)
        .filter(VoiceCall.business_id == business_id)
        .order_by(VoiceCall.started_at.desc())
        .limit(limit)
        .all()
    )


def list_handoffs(db: Session, business_id: int) -> list[HumanHandoff]:
    return (
        db.query(HumanHandoff)
        .filter(HumanHandoff.business_id == business_id)
        .order_by(HumanHandoff.requested_at.desc())
        .all()
    )


def get_active_handoff(
    db: Session, business_id: int, conversation_id: int
) -> Optional[HumanHandoff]:
    return (
        db.query(HumanHandoff)
        .filter(
            HumanHandoff.business_id == business_id,
            HumanHandoff.conversation_id == conversation_id,
            HumanHandoff.status.in_([
                HumanHandoff.STATUS_PENDING,
                HumanHandoff.STATUS_ACCEPTED,
            ]),
        )
        .order_by(HumanHandoff.id.desc())
        .first()
    )


def update_handoff(db: Session, handoff: HumanHandoff, new_status: str) -> HumanHandoff:
    allowed = {
        HumanHandoff.STATUS_PENDING: {HumanHandoff.STATUS_ACCEPTED, HumanHandoff.STATUS_DISMISSED},
        HumanHandoff.STATUS_ACCEPTED: {HumanHandoff.STATUS_COMPLETED, HumanHandoff.STATUS_DISMISSED},
        HumanHandoff.STATUS_COMPLETED: set(),
        HumanHandoff.STATUS_DISMISSED: set(),
    }
    if new_status == handoff.status:
        return handoff
    if new_status not in allowed.get(handoff.status, set()):
        raise ValueError(f"Cannot move handoff from {handoff.status} to {new_status}")
    now = datetime.datetime.utcnow()
    handoff.status = new_status
    if new_status == HumanHandoff.STATUS_ACCEPTED:
        handoff.accepted_at = now
    elif new_status in {HumanHandoff.STATUS_COMPLETED, HumanHandoff.STATUS_DISMISSED}:
        handoff.completed_at = now
    db.add(handoff)
    db.commit()
    db.refresh(handoff)
    return handoff
