"""Tenant-scoped helpdesk tickets and demo order lookup."""
from __future__ import annotations

import datetime
import re
import secrets
from typing import Optional

from sqlalchemy.orm import Session

from app.models.business import Business
from app.models.conversation import Conversation
from app.models.incident import Incident
from app.models.support import SupportOrder, SupportTicket, SupportTicketEvent

TICKET_STATUSES = {
    SupportTicket.STATUS_OPEN,
    SupportTicket.STATUS_IN_PROGRESS,
    SupportTicket.STATUS_WAITING,
    SupportTicket.STATUS_RESOLVED,
    SupportTicket.STATUS_CLOSED,
}
TICKET_PRIORITIES = {
    SupportTicket.PRIORITY_LOW,
    SupportTicket.PRIORITY_NORMAL,
    SupportTicket.PRIORITY_HIGH,
    SupportTicket.PRIORITY_URGENT,
}

_ALLOWED_TRANSITIONS = {
    SupportTicket.STATUS_OPEN: {
        SupportTicket.STATUS_IN_PROGRESS,
        SupportTicket.STATUS_WAITING,
        SupportTicket.STATUS_RESOLVED,
        SupportTicket.STATUS_CLOSED,
    },
    SupportTicket.STATUS_IN_PROGRESS: {
        SupportTicket.STATUS_OPEN,
        SupportTicket.STATUS_WAITING,
        SupportTicket.STATUS_RESOLVED,
        SupportTicket.STATUS_CLOSED,
    },
    SupportTicket.STATUS_WAITING: {
        SupportTicket.STATUS_OPEN,
        SupportTicket.STATUS_IN_PROGRESS,
        SupportTicket.STATUS_RESOLVED,
        SupportTicket.STATUS_CLOSED,
    },
    SupportTicket.STATUS_RESOLVED: {
        SupportTicket.STATUS_IN_PROGRESS,
        SupportTicket.STATUS_CLOSED,
    },
    SupportTicket.STATUS_CLOSED: {SupportTicket.STATUS_IN_PROGRESS},
}

_CONFIRM_TICKET_PHRASES = {
    "yes",
    "yes create it",
    "create it",
    "create ticket",
    "create the ticket",
    "confirm",
    "confirm ticket",
    "open a ticket",
    "open the ticket",
    "submit ticket",
    "submit the ticket",
    "create case",
    "create the case",
    "open a case",
    "open the case",
    "submit case",
    "submit the case",
    "save request",
    "save the request",
}
_ORDER_REFERENCE_RE = re.compile(r"\b([A-Z]{2,8}-\d{3,12})\b", re.IGNORECASE)
_ORDER_LOOKUP_PHRASES = (
    "where is",
    "track",
    "tracking",
    "order status",
    "status of",
    "delivery status",
    "when will",
    "when is",
    "delivery date",
)


def _normalize_text(value: str) -> str:
    return " ".join(re.sub(r"[^a-z0-9\s]", " ", (value or "").lower()).split())


def _ticket_number(db: Session, business_id: int) -> str:
    for _ in range(8):
        suffix = secrets.token_hex(3).upper()
        candidate = f"VERA-{business_id}-{suffix}"
        if not db.query(SupportTicket.id).filter(SupportTicket.ticket_number == candidate).first():
            return candidate
    raise RuntimeError("Could not generate a unique ticket number")


def _classify_issue(text: str) -> tuple[str, str, Optional[str]]:
    normalized = _normalize_text(text)
    if any(
        word in normalized
        for word in ("fire", "smoke", "burning", "fraud", "stolen", "emergency", "unsafe")
    ):
        priority = SupportTicket.PRIORITY_URGENT
    elif any(word in normalized for word in ("damaged", "broken", "not working", "charged twice")):
        priority = SupportTicket.PRIORITY_HIGH
    elif any(word in normalized for word in ("question", "information", "how do i")):
        priority = SupportTicket.PRIORITY_LOW
    else:
        priority = SupportTicket.PRIORITY_NORMAL

    if any(
        word in normalized
        for word in ("quote", "estimate", "demo", "property", "admission", "enrol", "enroll")
    ):
        category = "lead"
    elif any(
        word in normalized
        for word in ("appointment", "consultation", "doctor", "dentist", "clinic", "salon")
    ):
        category = "appointment"
    elif any(
        word in normalized
        for word in ("reservation", "reserve", "table", "hotel room", "booking")
    ):
        category = "reservation"
    elif any(word in normalized for word in ("delivery", "shipping", "arrived", "order")):
        category = "order"
    elif any(word in normalized for word in ("refund", "payment", "charged", "invoice")):
        category = "billing"
    elif any(word in normalized for word in ("login", "website", "app", "error", "technical")):
        category = "technical"
    elif any(word in normalized for word in ("damaged", "broken", "product", "warranty")):
        category = "product"
    else:
        category = "general"

    if category == "appointment":
        requested_action = "Review and schedule the appointment"
    elif category == "reservation":
        requested_action = "Review and confirm the reservation"
    elif category == "lead":
        requested_action = "Qualify and follow up on the enquiry"
    elif "replacement" in normalized or any(word in normalized for word in ("damaged", "broken")):
        requested_action = "Review replacement eligibility"
    elif "refund" in normalized:
        requested_action = "Review refund eligibility"
    elif "cancel" in normalized:
        requested_action = "Review cancellation request"
    elif "callback" in normalized or "call me" in normalized:
        requested_action = "Contact the customer"
    else:
        requested_action = "Review the customer request and respond"
    return category, priority, requested_action


def ticket_out(ticket: SupportTicket) -> dict:
    return {
        "id": ticket.id,
        "ticket_number": ticket.ticket_number,
        "status": ticket.status,
        "priority": ticket.priority,
        "category": ticket.category,
        "summary": ticket.summary,
        "requested_action": ticket.requested_action,
        "resolution_notes": ticket.resolution_notes,
        "assigned_to": ticket.assigned_to,
        "channel": ticket.channel,
        "assemblyai_session_id": ticket.assemblyai_session_id,
        "customer_name": ticket.customer_name,
        "customer_email": ticket.customer_email,
        "customer_phone": ticket.customer_phone,
        "order_reference": ticket.order_reference,
        "conversation_id": ticket.conversation_id,
        "incident_id": ticket.incident_id,
        "created_at": ticket.created_at,
        "updated_at": ticket.updated_at,
        "resolved_at": ticket.resolved_at,
        "events": [
            {
                "id": event.id,
                "event_type": event.event_type,
                "actor": event.actor,
                "from_status": event.from_status,
                "to_status": event.to_status,
                "note": event.note,
                "created_at": event.created_at,
            }
            for event in ticket.events
        ],
    }


def order_out(order: SupportOrder) -> dict:
    return {
        "id": order.id,
        "order_number": order.order_number,
        "customer_name": order.customer_name,
        "customer_email": order.customer_email,
        "product_name": order.product_name,
        "status": order.status,
        "delivery_estimate": order.delivery_estimate,
        "eligible_action": order.eligible_action,
        "is_demo": bool(order.is_demo),
    }


def create_ticket_from_incident(
    db: Session,
    business: Business,
    incident: Incident,
    *,
    channel: str = "chat",
    assemblyai_session_id: Optional[str] = None,
    actor: str = "customer",
) -> SupportTicket:
    if incident.business_id != business.id:
        raise ValueError("Incident does not belong to this business")
    if incident.status not in (Incident.STATUS_READY_FOR_REVIEW, Incident.STATUS_TICKET_CREATED):
        raise ValueError("Incident is not ready to become a ticket")

    existing = (
        db.query(SupportTicket).filter(SupportTicket.incident_id == incident.id).first()
    )
    if existing is not None:
        return existing

    summary = (incident.issue_description or "Customer support request").strip()
    if incident.additional_details:
        summary = f"{summary} — {incident.additional_details.strip()}"
    category, priority, requested_action = _classify_issue(summary)
    ticket = SupportTicket(
        ticket_number=_ticket_number(db, business.id),
        business_id=business.id,
        conversation_id=incident.conversation_id,
        incident_id=incident.id,
        status=SupportTicket.STATUS_OPEN,
        priority=priority,
        category=category,
        summary=summary,
        requested_action=requested_action,
        channel=channel if channel in {"chat", "voice"} else "chat",
        assemblyai_session_id=(assemblyai_session_id or "").strip() or None,
        customer_name=incident.customer_name,
        customer_email=incident.customer_email or None,
        customer_phone=incident.customer_phone or None,
        order_reference=incident.order_reference or None,
    )
    db.add(ticket)
    db.flush()
    db.add(
        SupportTicketEvent(
            ticket_id=ticket.id,
            event_type="created",
            actor=actor,
            to_status=SupportTicket.STATUS_OPEN,
            note=f"Created from incident #{incident.id} via {ticket.channel}",
        )
    )
    incident.status = Incident.STATUS_TICKET_CREATED
    db.add(incident)
    db.commit()
    db.refresh(ticket)
    return ticket


def maybe_create_ticket_from_message(
    db: Session,
    business: Business,
    conversation: Conversation,
    message: str,
    *,
    channel: str,
    assemblyai_session_id: Optional[str] = None,
) -> Optional[SupportTicket]:
    normalized = _normalize_text(message)
    if normalized not in _CONFIRM_TICKET_PHRASES:
        return None
    incident = (
        db.query(Incident)
        .filter(
            Incident.business_id == business.id,
            Incident.conversation_id == conversation.id,
            Incident.status == Incident.STATUS_READY_FOR_REVIEW,
        )
        .order_by(Incident.id.desc())
        .first()
    )
    if incident is None:
        return None
    return create_ticket_from_incident(
        db,
        business,
        incident,
        channel=channel,
        assemblyai_session_id=assemblyai_session_id,
        actor="customer",
    )


def maybe_lookup_order(db: Session, business: Business, message: str) -> Optional[dict]:
    match = _ORDER_REFERENCE_RE.search(message or "")
    if not match:
        return None
    order_number = match.group(1).upper()
    order = (
        db.query(SupportOrder)
        .filter(
            SupportOrder.business_id == business.id,
            SupportOrder.order_number == order_number,
        )
        .first()
    )
    if order is None:
        return {
            "answer": (
                f"Answer:\nI couldn't find order {order_number} in the connected order records.\n\n"
                "Next steps:\n1. Check the order number and try again.\n"
                "2. Ask me to create a customer case if you still need help."
            ),
            "order": None,
        }

    status_text = order.status.replace("_", " ")
    details = [f"Product: {order.product_name}"]
    if order.delivery_estimate:
        details.append(f"Delivery: {order.delivery_estimate}")
    if order.eligible_action:
        details.append(f"Available action: {order.eligible_action}")
    answer = (
        f"Answer:\nOrder {order.order_number} is {status_text}.\n\nDetails:\n"
        + "\n".join(f"- {detail}" for detail in details[:3])
    )
    return {"answer": answer, "order": order_out(order)}


def is_order_lookup_request(message: str) -> bool:
    """Identify explicit order-status questions without an LLM round trip."""
    normalized = _normalize_text(message)
    return bool(_ORDER_REFERENCE_RE.search(message or "")) and any(
        phrase in normalized for phrase in _ORDER_LOOKUP_PHRASES
    )


def seed_demo_orders(db: Session, business: Business) -> list[SupportOrder]:
    rows = [
        {
            "order_number": "NN-1042",
            "customer_name": "Aarav Mehta",
            "customer_email": "aarav@example.com",
            "product_name": "NovaSound X1 Headphones",
            "status": "in_transit",
            "delivery_estimate": "September 18, 2026",
            "eligible_action": "Track shipment",
        },
        {
            "order_number": "NN-1043",
            "customer_name": "Maya Rao",
            "customer_email": "maya@example.com",
            "product_name": "NovaPhone Air",
            "status": "delivered",
            "delivery_estimate": "Delivered September 11, 2026",
            "eligible_action": "Replacement review for reported damage",
        },
        {
            "order_number": "NN-1044",
            "customer_name": "Kabir Shah",
            "customer_email": "kabir@example.com",
            "product_name": "NovaTab Mini",
            "status": "processing",
            "delivery_estimate": "September 16, 2026",
            "eligible_action": "Cancellation review before dispatch",
        },
    ]
    for values in rows:
        exists = (
            db.query(SupportOrder.id)
            .filter(
                SupportOrder.business_id == business.id,
                SupportOrder.order_number == values["order_number"],
            )
            .first()
        )
        if not exists:
            db.add(SupportOrder(business_id=business.id, is_demo=1, **values))
    db.commit()
    return list_orders(db, business.id)


def list_orders(db: Session, business_id: int) -> list[SupportOrder]:
    return (
        db.query(SupportOrder)
        .filter(SupportOrder.business_id == business_id)
        .order_by(SupportOrder.order_number.asc())
        .all()
    )


def list_tickets(db: Session, business_id: int) -> list[SupportTicket]:
    return (
        db.query(SupportTicket)
        .filter(SupportTicket.business_id == business_id)
        .order_by(SupportTicket.updated_at.desc(), SupportTicket.id.desc())
        .all()
    )


def update_ticket(
    db: Session,
    ticket: SupportTicket,
    *,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    assigned_to: Optional[str] = None,
    resolution_notes: Optional[str] = None,
) -> SupportTicket:
    now = datetime.datetime.utcnow()
    if status is not None and status != ticket.status:
        if status not in TICKET_STATUSES:
            raise ValueError("Unknown ticket status")
        if status not in _ALLOWED_TRANSITIONS[ticket.status]:
            raise ValueError(f"Cannot move a ticket from {ticket.status} to {status}")
        old_status = ticket.status
        ticket.status = status
        ticket.resolved_at = now if status in {SupportTicket.STATUS_RESOLVED, SupportTicket.STATUS_CLOSED} else None
        db.add(
            SupportTicketEvent(
                ticket_id=ticket.id,
                event_type="status_changed",
                actor="owner",
                from_status=old_status,
                to_status=status,
            )
        )
    if priority is not None and priority != ticket.priority:
        if priority not in TICKET_PRIORITIES:
            raise ValueError("Unknown ticket priority")
        old_priority = ticket.priority
        ticket.priority = priority
        db.add(
            SupportTicketEvent(
                ticket_id=ticket.id,
                event_type="priority_changed",
                actor="owner",
                note=f"Priority changed from {old_priority} to {priority}",
            )
        )
    if assigned_to is not None:
        new_assignee = assigned_to.strip() or None
        if new_assignee != ticket.assigned_to:
            old_assignee = ticket.assigned_to or "Unassigned"
            ticket.assigned_to = new_assignee
            db.add(
                SupportTicketEvent(
                    ticket_id=ticket.id,
                    event_type="assignment_changed",
                    actor="owner",
                    note=f"Assignment changed from {old_assignee} to {new_assignee or 'Unassigned'}",
                )
            )
    if resolution_notes is not None and resolution_notes != ticket.resolution_notes:
        ticket.resolution_notes = resolution_notes.strip() or None
        db.add(
            SupportTicketEvent(
                ticket_id=ticket.id,
                event_type="note_added",
                actor="owner",
                note=ticket.resolution_notes,
            )
        )
    ticket.updated_at = now
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket
