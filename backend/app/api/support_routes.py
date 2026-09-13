import datetime
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.business_routes import get_owned_business
from app.db.session import get_db
from app.models.business import Business
from app.models.incident import Incident
from app.models.support import HumanHandoff, SupportTicket
from app.services import call_operations, support_desk

router = APIRouter(prefix="/businesses/{business_id}/support", tags=["action-center"])


class TicketEventOut(BaseModel):
    id: int
    event_type: str
    actor: str
    from_status: Optional[str] = None
    to_status: Optional[str] = None
    note: Optional[str] = None
    created_at: datetime.datetime


class TicketOut(BaseModel):
    id: int
    ticket_number: str
    status: str
    priority: str
    category: str
    summary: str
    requested_action: Optional[str] = None
    resolution_notes: Optional[str] = None
    assigned_to: Optional[str] = None
    channel: str
    assemblyai_session_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    order_reference: Optional[str] = None
    conversation_id: int
    incident_id: int
    created_at: datetime.datetime
    updated_at: datetime.datetime
    resolved_at: Optional[datetime.datetime] = None
    events: List[TicketEventOut]


class OrderOut(BaseModel):
    id: int
    order_number: str
    customer_name: str
    customer_email: Optional[str] = None
    product_name: str
    status: str
    delivery_estimate: Optional[str] = None
    eligible_action: Optional[str] = None
    is_demo: bool


class VoiceCallOut(BaseModel):
    id: int
    assemblyai_session_id: str
    client_session_id: Optional[str] = None
    conversation_id: int
    status: str
    outcome: str
    primary_intent: Optional[str] = None
    sentiment: str
    summary: Optional[str] = None
    turns: int
    tool_calls: int
    interruptions: int
    started_at: datetime.datetime
    ended_at: Optional[datetime.datetime] = None


class HumanHandoffOut(BaseModel):
    id: int
    conversation_id: int
    voice_call_id: Optional[int] = None
    status: str
    routing_category: str
    reason: str
    summary: str
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    requested_at: datetime.datetime
    accepted_at: Optional[datetime.datetime] = None
    completed_at: Optional[datetime.datetime] = None


class TicketCreateRequest(BaseModel):
    channel: Literal["chat", "voice"] = "chat"
    assemblyai_session_id: Optional[str] = Field(default=None, max_length=200)


class TicketUpdateRequest(BaseModel):
    status: Optional[Literal["open", "in_progress", "waiting_on_customer", "resolved", "closed"]] = None
    priority: Optional[Literal["low", "normal", "high", "urgent"]] = None
    assigned_to: Optional[str] = Field(default=None, max_length=200)
    resolution_notes: Optional[str] = Field(default=None, max_length=4000)


class HumanHandoffUpdateRequest(BaseModel):
    status: Literal["accepted", "completed", "dismissed"]


def _get_owned_ticket(
    ticket_id: int,
    business: Business = Depends(get_owned_business),
    db: Session = Depends(get_db),
) -> SupportTicket:
    ticket = (
        db.query(SupportTicket)
        .filter(SupportTicket.id == ticket_id, SupportTicket.business_id == business.id)
        .first()
    )
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    return ticket


def _get_owned_handoff(
    handoff_id: int,
    business: Business = Depends(get_owned_business),
    db: Session = Depends(get_db),
) -> HumanHandoff:
    handoff = (
        db.query(HumanHandoff)
        .filter(
            HumanHandoff.id == handoff_id,
            HumanHandoff.business_id == business.id,
        )
        .first()
    )
    if handoff is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Handoff not found")
    return handoff


@router.get("/tickets", response_model=List[TicketOut])
def list_support_tickets(
    business: Business = Depends(get_owned_business),
    db: Session = Depends(get_db),
):
    return [support_desk.ticket_out(ticket) for ticket in support_desk.list_tickets(db, business.id)]


@router.post("/tickets/from-incident/{incident_id}", response_model=TicketOut)
def create_support_ticket(
    incident_id: int,
    body: TicketCreateRequest,
    business: Business = Depends(get_owned_business),
    db: Session = Depends(get_db),
):
    incident = (
        db.query(Incident)
        .filter(Incident.id == incident_id, Incident.business_id == business.id)
        .first()
    )
    if incident is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")
    try:
        ticket = support_desk.create_ticket_from_incident(
            db,
            business,
            incident,
            channel=body.channel,
            assemblyai_session_id=body.assemblyai_session_id,
            actor="owner",
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return support_desk.ticket_out(ticket)


@router.patch("/tickets/{ticket_id}", response_model=TicketOut)
def update_support_ticket(
    body: TicketUpdateRequest,
    ticket: SupportTicket = Depends(_get_owned_ticket),
    db: Session = Depends(get_db),
):
    try:
        updated = support_desk.update_ticket(db, ticket, **body.model_dump(exclude_unset=True))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return support_desk.ticket_out(updated)


@router.get("/orders", response_model=List[OrderOut])
def list_support_orders(
    business: Business = Depends(get_owned_business),
    db: Session = Depends(get_db),
):
    return [support_desk.order_out(order) for order in support_desk.list_orders(db, business.id)]


@router.post("/orders/demo", response_model=List[OrderOut])
def load_demo_orders(
    business: Business = Depends(get_owned_business),
    db: Session = Depends(get_db),
):
    return [support_desk.order_out(order) for order in support_desk.seed_demo_orders(db, business)]


@router.get("/calls", response_model=List[VoiceCallOut])
def list_voice_calls(
    business: Business = Depends(get_owned_business),
    db: Session = Depends(get_db),
):
    return [call_operations.call_out(call) for call in call_operations.list_calls(db, business.id)]


@router.get("/handoffs", response_model=List[HumanHandoffOut])
def list_human_handoffs(
    business: Business = Depends(get_owned_business),
    db: Session = Depends(get_db),
):
    return [
        call_operations.handoff_out(handoff)
        for handoff in call_operations.list_handoffs(db, business.id)
    ]


@router.patch("/handoffs/{handoff_id}", response_model=HumanHandoffOut)
def update_human_handoff(
    body: HumanHandoffUpdateRequest,
    handoff: HumanHandoff = Depends(_get_owned_handoff),
    db: Session = Depends(get_db),
):
    try:
        updated = call_operations.update_handoff(db, handoff, body.status)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return call_operations.handoff_out(updated)
