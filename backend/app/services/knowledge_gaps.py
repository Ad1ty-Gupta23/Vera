"""Closed-loop learning for unanswered business-assistant questions."""
from __future__ import annotations

import datetime
import re

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.conversation import Conversation, ConversationMessage
from app.models.incident import Incident
from app.models.knowledge import KnowledgeGap


_SPACE_RE = re.compile(r"\s+")
_NON_WORD_RE = re.compile(r"[^a-z0-9]+")
_QUESTION_STARTERS = {
    "are", "can", "could", "did", "do", "does", "how", "is", "may",
    "should", "what", "when", "where", "which", "who", "why", "will", "would",
}
_NON_QUESTIONS = {
    "hi", "hello", "hey", "thanks", "thank you", "ok", "okay", "bye", "goodbye",
}


def normalize_question(question: str) -> str:
    """Produce a stable key for repeat occurrences of the same question."""
    normalized = _NON_WORD_RE.sub(" ", question.lower()).strip()
    return _SPACE_RE.sub(" ", normalized)[:500]


def should_capture(question: str) -> bool:
    """Avoid turning greetings and tiny chat fragments into knowledge gaps."""
    text = _SPACE_RE.sub(" ", question.strip())
    normalized = normalize_question(text)
    if len(normalized) < 5 or normalized in _NON_QUESTIONS:
        return False
    first_word = normalized.split(" ", 1)[0]
    return "?" in text or first_word in _QUESTION_STARTERS or len(normalized.split()) >= 3


def record_gap(
    db: Session,
    *,
    business_id: int,
    conversation_id: int,
    question: str,
) -> KnowledgeGap | None:
    """Create or increment a tenant-scoped gap without committing the turn."""
    if not should_capture(question):
        return None
    normalized = normalize_question(question)
    gap = (
        db.query(KnowledgeGap)
        .filter(
            KnowledgeGap.business_id == business_id,
            KnowledgeGap.normalized_question == normalized,
        )
        .first()
    )
    now = datetime.datetime.utcnow()
    if gap is None:
        gap = KnowledgeGap(
            business_id=business_id,
            conversation_id=conversation_id,
            question=question.strip(),
            normalized_question=normalized,
            occurrence_count=1,
            status=KnowledgeGap.STATUS_OPEN,
            first_seen_at=now,
            last_seen_at=now,
        )
        db.add(gap)
    else:
        gap.occurrence_count += 1
        gap.conversation_id = conversation_id
        gap.last_seen_at = now
        db.add(gap)
    return gap


def resolve_gap(db: Session, gap: KnowledgeGap, answer: str) -> KnowledgeGap:
    """Index an owner-approved answer and mark its gap resolved."""
    from app.services import knowledge_base

    approved_answer = answer.strip()
    content = (
        f"Approved customer support answer\n\n"
        f"Question: {gap.question}\n"
        f"Answer: {approved_answer}\n"
    ).encode("utf-8")
    document = knowledge_base.process_upload(
        db=db,
        business_id=gap.business_id,
        filename=f"approved-answer-gap-{gap.id}.txt",
        content=content,
    )
    if document.status != "ready":
        raise ValueError(document.error_message or "The approved answer could not be indexed.")

    gap.status = KnowledgeGap.STATUS_RESOLVED
    gap.approved_answer = approved_answer
    gap.source_document_id = document.id
    gap.resolved_at = datetime.datetime.utcnow()
    db.add(gap)
    db.commit()
    db.refresh(gap)
    return gap


def dismiss_gap(db: Session, gap: KnowledgeGap) -> KnowledgeGap:
    gap.status = KnowledgeGap.STATUS_DISMISSED
    db.add(gap)
    db.commit()
    db.refresh(gap)
    return gap


def summary(db: Session, business_id: int) -> dict:
    conversation_count = (
        db.query(func.count(Conversation.id))
        .filter(Conversation.business_id == business_id)
        .scalar()
        or 0
    )
    total_answers = (
        db.query(func.count(ConversationMessage.id))
        .join(Conversation, Conversation.id == ConversationMessage.conversation_id)
        .filter(
            Conversation.business_id == business_id,
            ConversationMessage.role == "assistant",
            ConversationMessage.grounded.isnot(None),
        )
        .scalar()
        or 0
    )
    stored_grounded_answers = (
        db.query(func.count(ConversationMessage.id))
        .join(Conversation, Conversation.id == ConversationMessage.conversation_id)
        .filter(
            Conversation.business_id == business_id,
            ConversationMessage.role == "assistant",
            ConversationMessage.grounded == 1,
        )
        .scalar()
        or 0
    )
    all_gap_occurrences = (
        db.query(func.coalesce(func.sum(KnowledgeGap.occurrence_count), 0))
        .filter(KnowledgeGap.business_id == business_id)
        .scalar()
        or 0
    )
    open_gaps = (
        db.query(func.count(KnowledgeGap.id))
        .filter(
            KnowledgeGap.business_id == business_id,
            KnowledgeGap.status == KnowledgeGap.STATUS_OPEN,
        )
        .scalar()
        or 0
    )
    unanswered_questions = (
        db.query(func.coalesce(func.sum(KnowledgeGap.occurrence_count), 0))
        .filter(
            KnowledgeGap.business_id == business_id,
            KnowledgeGap.status == KnowledgeGap.STATUS_OPEN,
        )
        .scalar()
        or 0
    )
    resolved_gaps = (
        db.query(func.count(KnowledgeGap.id))
        .filter(
            KnowledgeGap.business_id == business_id,
            KnowledgeGap.status == KnowledgeGap.STATUS_RESOLVED,
        )
        .scalar()
        or 0
    )
    sent_incidents = (
        db.query(func.count(Incident.id))
        .filter(
            Incident.business_id == business_id,
            Incident.status == Incident.STATUS_SENT,
        )
        .scalar()
        or 0
    )
    # Older chat behavior considered any populated business profile enough
    # to mark a reply grounded. Gap observations are more precise, so remove
    # those known misses from the displayed coverage without rewriting
    # historical conversation data or changing existing chat responses.
    grounded_answers = max(0, min(stored_grounded_answers, total_answers - all_gap_occurrences))
    grounded_rate = round((grounded_answers / total_answers) * 100) if total_answers else 0
    return {
        "conversation_count": conversation_count,
        "total_answers": total_answers,
        "grounded_answers": grounded_answers,
        "grounded_rate": grounded_rate,
        "open_gaps": open_gaps,
        "unanswered_questions": unanswered_questions,
        "resolved_gaps": resolved_gaps,
        "sent_incidents": sent_incidents,
    }
