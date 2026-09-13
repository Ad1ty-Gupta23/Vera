import datetime
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import Optional

from app.api.business_routes import get_owned_business
from app.db.session import get_db
from app.models.business import Business
from app.models.incident import Incident
from app.services import gmail_oauth, gmail_send

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/businesses/{business_id}/assistant/incidents", tags=["incidents"])


# ---------------------------------------------------------------- schemas --

class IncidentDraftUpdate(BaseModel):
    """Lets the business owner edit the draft before sending. All fields
    optional — only what's provided gets changed."""
    customer_name: Optional[str] = Field(default=None, max_length=200)
    customer_email: Optional[str] = Field(default=None, max_length=200)
    customer_phone: Optional[str] = Field(default=None, max_length=50)
    order_reference: Optional[str] = Field(default=None, max_length=100)
    email_subject: Optional[str] = Field(default=None, min_length=1, max_length=300)
    email_body: Optional[str] = Field(default=None, min_length=1, max_length=8000)


class IncidentOut(BaseModel):
    id: int
    status: str
    email_to: Optional[str] = None
    email_subject: Optional[str] = None
    email_body: Optional[str] = None
    send_error: Optional[str] = None

    model_config = {"from_attributes": True}


# ------------------------------------------------------------- dependency --

def _get_owned_incident(
    incident_id: int,
    business: Business = Depends(get_owned_business),
    db: Session = Depends(get_db),
) -> Incident:
    incident = (
        db.query(Incident)
        .filter(Incident.id == incident_id, Incident.business_id == business.id)
        .first()
    )
    if incident is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")
    return incident


# ------------------------------------------------------------------ routes --

@router.patch("/{incident_id}", response_model=IncidentOut)
def update_draft(
    body: IncidentDraftUpdate,
    incident: Incident = Depends(_get_owned_incident),
    db: Session = Depends(get_db),
):
    if incident.status not in (
        Incident.STATUS_READY_FOR_REVIEW,
        Incident.STATUS_TICKET_CREATED,
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This draft isn't ready for review yet.",
        )
    updates = body.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(incident, field, value)
    db.add(incident)
    db.commit()
    db.refresh(incident)
    return incident


@router.post("/{incident_id}/confirm", response_model=IncidentOut)
async def confirm_and_send(
    incident: Incident = Depends(_get_owned_incident),
    business: Business = Depends(get_owned_business),
    db: Session = Depends(get_db),
):
    updated = await _confirm_and_send_incident(db, incident, business)
    logger.info("[incidents] sent incident_id=%s business_id=%s", incident.id, business.id)
    return updated


async def _confirm_and_send_incident(db: Session, incident: Incident, business: Business) -> Incident:
    """
    Shared by this owner-authenticated route and Stage 7's public embed
    route — always sends through the *business owner's* connected Gmail
    (see gmail_oauth.get_connection_for_business), never a per-caller
    connection, so behavior is identical whether "confirm" was clicked by
    the business owner testing their assistant or by an anonymous
    customer on the embedded widget.
    """
    if incident.status not in (
        Incident.STATUS_READY_FOR_REVIEW,
        Incident.STATUS_TICKET_CREATED,
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This draft has already been sent or cancelled.",
        )
    if not incident.email_subject or not incident.email_body or not incident.email_to:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Draft is incomplete.")

    connection = gmail_oauth.get_connection_for_business(db, business)
    if connection is None or connection.status != "connected":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Issue reports can't be sent yet — this business hasn't connected Gmail.",
        )

    access_token = await gmail_oauth.get_valid_access_token(db, connection)

    try:
        await gmail_send.send_email(
            access_token=access_token,
            to=incident.email_to,
            subject=incident.email_subject,
            body=incident.email_body,
        )
    except gmail_send.GmailSendError as exc:
        logger.error("[incidents] send failed incident_id=%s: %s", incident.id, exc)
        incident.status = Incident.STATUS_FAILED
        incident.send_error = str(exc)
        db.add(incident)
        db.commit()
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))

    incident.status = Incident.STATUS_SENT
    incident.sent_at = datetime.datetime.utcnow()
    incident.send_error = None
    incident.conversation.status = "closed"
    db.add(incident)
    db.commit()
    db.refresh(incident)
    return incident


@router.post("/{incident_id}/cancel", response_model=IncidentOut)
def cancel(
    incident: Incident = Depends(_get_owned_incident),
    db: Session = Depends(get_db),
):
    if incident.status not in (
        Incident.STATUS_COLLECTING,
        Incident.STATUS_READY_FOR_REVIEW,
        Incident.STATUS_TICKET_CREATED,
    ):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Nothing to cancel.")
    incident.status = Incident.STATUS_CANCELLED
    db.add(incident)
    db.commit()
    db.refresh(incident)
    return incident
