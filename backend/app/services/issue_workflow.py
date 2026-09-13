"""
Stage 6 — the customer action-request workflow described in the brief's
section 12 ("Customer Issue Workflow"): recognize the intent, collect only
what's still missing, draft an email, and stop — never send without an
explicit, separate confirm step (see api/incident_routes.py).

Deliberately separate from app.services.business_chat's RAG prompt (same
reasoning as knowledge/prompts.py vs business_chat.py's own prompt: these
must never blend). business_chat.send_message calls maybe_handle_turn()
first; if it returns handled=True, the normal RAG path is skipped for
that turn entirely.

Field collection uses one LLM call per turn to (a) detect an actionable
customer request when no case is open yet, and (b) pull any of the required
fields out of free text. Which field to ask next, and the final email
draft, are both decided deterministically in Python — not by the model —
so behavior stays predictable and nothing is invented (the email draft is
built from a template using only what the customer actually said).
"""
from __future__ import annotations

import datetime
import json
import logging
import re
from typing import Optional

from groq import APIError, APITimeoutError
from sqlalchemy.orm import Session

from app.config.settings import settings
from app.models.business import Business
from app.models.conversation import Conversation
from app.models.incident import Incident
from app.services.groq import get_client

logger = logging.getLogger(__name__)

# The LLM extracts fields only after a deterministic intent gate. Without
# this guard, a permissive classifier can turn ordinary FAQ questions into
# an action form. Patterns deliberately require an action/problem signal;
# nouns alone ("appointment policy", "return window") remain normal Q&A.
_ACTION_REQUEST_PATTERNS = tuple(
    re.compile(pattern, re.IGNORECASE)
    for pattern in (
        r"\b(report|file|raise|open)\b.{0,30}\b(issue|problem|complaint|case)\b",
        r"\b(damaged|broken|defective|not working|stopped working|charged twice|billing error)\b",
        r"\b(book|schedule|reschedule|cancel|change|move|make)\b.{0,35}\b(appointment|reservation|booking|consultation|viewing)\b",
        r"\b(request|need|want|get|send)\b.{0,25}\b(quote|estimate|demo|callback|call back|refund|return|replacement|exchange)\b",
        r"\b(call|contact|email|reach|follow up with)\s+(me|us)\b",
        r"\b(speak|talk)\s+(to|with)\b.{0,25}\b(human|person|agent|staff|team|representative)\b",
        r"\b(interested in|apply for|application for)\b",
        r"\b(i need help|i need support|please help me)\b.{0,80}\b(with|because|about)\b",
    )
)

_INFORMATIONAL_PREFIX = re.compile(
    r"^(what|when|where|why|how|do you|does|is there|are there|can you tell|could you tell)\b",
    re.IGNORECASE,
)
_PERSONAL_ACTION_SIGNAL = re.compile(
    r"\b(for me|for us|i (?:need|want|would like)|we (?:need|want|would like)|please)\b",
    re.IGNORECASE,
)


def looks_like_action_request(message: str) -> bool:
    """Return True only for an explicit request that needs business action."""
    text = " ".join((message or "").split())
    # "How do I book?" and "Do you offer appointments?" ask for
    # information. A personal signal such as "please book for me" opts into
    # the action flow even when phrased as a question.
    if _INFORMATIONAL_PREFIX.search(text) and not _PERSONAL_ACTION_SIGNAL.search(text):
        return False
    return any(pattern.search(text) for pattern in _ACTION_REQUEST_PATTERNS)

# Asked in this order. name + issue_description are required before a
# draft can be produced at all; email + order_reference are asked once
# each but are skippable ("I don't have one" / "skip" -> stored as "" to
# mean "asked, declined" so we never ask twice). phone is never
# proactively asked (see brief section 10: "if collected and consented
# to") — only captured if the customer volunteers it.
REQUIRED_FIELDS = ["customer_name", "issue_description"]
SKIPPABLE_FIELDS = ["customer_email", "order_reference"]
ASK_ORDER = REQUIRED_FIELDS + SKIPPABLE_FIELDS

FIELD_QUESTIONS = {
    "customer_name": "Sure, I can help with that request. Could I get your name?",
    "issue_description": "Thanks — what do you need, and what outcome would you like?",
    "customer_email": "Would you like to leave an email for follow-up? It's optional, so you can say \"skip\".",
    "order_reference": "Do you have a booking, account, order, or other reference number? (Optional — say \"skip\" if not.)",
}

_EXTRACTION_SYSTEM_PROMPT = """You help a business voice assistant for "{business_name}" understand \
when a customer wants the business to take an action, and pull structured details out of what they say.

Respond with ONLY a JSON object (no markdown fences), matching exactly this shape:
{{
  "is_issue_report": boolean,
  "extracted": {{
    "customer_name": string or null,
    "customer_email": string or null,
    "customer_phone": string or null,
    "order_reference": string or null,
    "issue_description": string or null,
    "additional_details": string or null
  }},
  "skip_fields": [array of field names from "extracted" above that the customer just explicitly \
declined to provide, e.g. said "skip" or "I don't have one" or "no email"]
}}

Rules:
- "is_issue_report" is true when the customer wants a trackable business action: reporting a \
problem, requesting support or a callback, booking or changing an appointment/reservation, asking \
for a quote/demo/consultation, expressing interest as a sales lead, requesting a return/refund, or \
asking staff to follow up. It is false for ordinary factual questions that can be answered directly.
- Only put a value in "extracted" if it was stated in the CUSTOMER'S LATEST MESSAGE (not earlier \
turns — those are already recorded). Leave anything not mentioned as null.
- Never invent a name, email, phone, order number, or description that wasn't actually said.
- "issue_description" should be a concise restatement of the requested action or problem in the \
customer's own terms, not a guess at missing details or the cause.
- If the customer's latest message is just answering "what's your name" with a bare name, put it in \
customer_name even without a full sentence.
"""


def _get_open_incident(db: Session, conversation_id: int) -> Optional[Incident]:
    return (
        db.query(Incident)
        .filter(
            Incident.conversation_id == conversation_id,
            Incident.status.in_([Incident.STATUS_COLLECTING, Incident.STATUS_READY_FOR_REVIEW]),
        )
        .order_by(Incident.id.desc())
        .first()
    )


def _call_extraction(business: Business, message: str, history: list[dict]) -> dict:
    client = get_client()
    system_prompt = _EXTRACTION_SYSTEM_PROMPT.format(business_name=business.name or "this business")
    # Only the last few turns — this call just needs to disambiguate the
    # latest message, not re-read the whole thread.
    trimmed_history = history[-6:]
    response = client.chat.completions.create(
        model=settings.groq_model,
        messages=[
            {"role": "system", "content": system_prompt},
            *trimmed_history,
            {"role": "user", "content": message},
        ],
        temperature=0.1,
        reasoning_effort="low",
        max_tokens=768,
        response_format={"type": "json_object"},
    )
    raw = response.choices[0].message.content.strip()
    if raw.startswith("```"):
        lines = raw.splitlines()
        raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    return json.loads(raw)


def _apply_extraction(incident: Incident, extracted: dict, skip_fields: list[str]) -> None:
    for field in ("customer_name", "customer_email", "customer_phone", "order_reference", "issue_description"):
        value = extracted.get(field)
        if value:
            setattr(incident, field, str(value).strip())
    extra = extracted.get("additional_details")
    if extra:
        incident.additional_details = (
            f"{incident.additional_details}\n{extra}" if incident.additional_details else str(extra).strip()
        )
    for field in skip_fields or []:
        if field in SKIPPABLE_FIELDS and not getattr(incident, field, None):
            setattr(incident, field, "")  # "" = asked, customer declined


def _next_missing_field(incident: Incident) -> Optional[str]:
    for field in ASK_ORDER:
        value = getattr(incident, field, None)
        if value is None:  # None = not yet asked/known; "" = declined, counts as resolved
            return field
    return None


def _build_draft(business: Business, incident: Incident) -> tuple[str, str]:
    """Deterministic template — never an LLM call — so the email can never
    contain an invented policy, price, or contact detail (brief section 10/12)."""
    subject = f"Customer Action Request — {business.name or 'Business'}"
    if incident.order_reference:
        subject += f" (Reference {incident.order_reference})"

    lines = [
        f"Customer name: {incident.customer_name or 'Not provided'}",
    ]
    if incident.customer_email:
        lines.append(f"Customer email: {incident.customer_email}")
    if incident.customer_phone:
        lines.append(f"Customer phone: {incident.customer_phone}")
    if incident.order_reference:
        lines.append(f"Reference number: {incident.order_reference}")
    lines.append("")
    lines.append("Customer request:")
    lines.append(incident.issue_description or "Not provided")
    if incident.additional_details:
        lines.append("")
        lines.append("Additional details:")
        lines.append(incident.additional_details)
    lines.append("")
    lines.append(f"— Reported via the {business.name or 'business'} AI assistant.")
    body = "\n".join(lines)
    return subject, body


def _incident_out(incident: Incident) -> dict:
    return {
        "id": incident.id,
        "status": incident.status,
        "fields": {
            "customer_name": incident.customer_name,
            "customer_email": incident.customer_email or None,
            "customer_phone": incident.customer_phone or None,
            "order_reference": incident.order_reference or None,
            "issue_description": incident.issue_description,
            "additional_details": incident.additional_details,
        },
        "email_draft": (
            {"to": incident.email_to, "subject": incident.email_subject, "body": incident.email_body}
            if incident.status == Incident.STATUS_READY_FOR_REVIEW
            else None
        ),
    }


def maybe_handle_turn(
    db: Session,
    business: Business,
    conversation: Conversation,
    message: str,
    history: list[dict],
) -> Optional[dict]:
    """
    Returns None if this turn is not part of an issue report (caller
    should fall through to the normal RAG answer). Otherwise returns
    {"answer": str, "incident": {...}} and the turn is considered fully
    handled — the caller must not also run the RAG path.
    """
    incident = _get_open_incident(db, conversation.id)

    if incident is None:
        if not looks_like_action_request(message):
            return None
        try:
            result = _call_extraction(business, message, history)
        except (APIError, APITimeoutError, json.JSONDecodeError, ValueError) as exc:
            logger.error("[issue_workflow] extraction call failed business_id=%s: %s", business.id, exc)
            return None  # fall back to normal RAG rather than blocking the turn

        if not result.get("is_issue_report"):
            return None

        incident = Incident(business_id=business.id, conversation_id=conversation.id)
        db.add(incident)
        db.flush()
        _apply_extraction(incident, result.get("extracted") or {}, result.get("skip_fields") or [])
    else:
        try:
            result = _call_extraction(business, message, history)
        except (APIError, APITimeoutError, json.JSONDecodeError, ValueError) as exc:
            logger.error("[issue_workflow] extraction call failed business_id=%s: %s", business.id, exc)
            # Keep the incident open and just re-ask the same question rather
            # than silently dropping the workflow.
            next_field = _next_missing_field(incident)
            question = FIELD_QUESTIONS.get(next_field, "Could you tell me a bit more about the issue?")
            db.commit()
            return {"answer": question, "incident": _incident_out(incident)}

        _apply_extraction(incident, result.get("extracted") or {}, result.get("skip_fields") or [])

    next_field = _next_missing_field(incident)
    if next_field is not None:
        incident.status = Incident.STATUS_COLLECTING
        db.add(incident)
        db.commit()
        db.refresh(incident)
        return {"answer": FIELD_QUESTIONS[next_field], "incident": _incident_out(incident)}

    # All required + skippable fields resolved -> draft.
    subject, body = _build_draft(business, incident)
    incident.email_to = business.helpdesk_email
    incident.email_subject = subject
    incident.email_body = body
    incident.status = Incident.STATUS_READY_FOR_REVIEW
    incident.updated_at = datetime.datetime.utcnow()
    db.add(incident)
    db.commit()
    db.refresh(incident)

    answer = (
        "I've prepared your request for review. Say \"create the case\" or use the "
        "Create case button to add it to the Action Center. Email is optional and will appear only "
        "if you choose it."
    )
    return {"answer": answer, "incident": _incident_out(incident)}
