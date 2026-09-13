"""
Stage 7 — the ONLY routes in the whole backend that a random website
visitor (not logged in, no session cookie) can call. Everything here is
scoped by an assistant's public_id (see business_chat.get_config_and_business_by_public_id)
— never a business_id or incident_id trusted on its own — so a widget
embedded on one business's site can never read or affect another
business's data, and reuses the exact same tenant-aware chat pipeline
(app.services.business_chat.send_message) the owner-only /assistant/test
route in assistant_routes.py uses, so a customer on the real widget gets
identical grounding/behavior to what the owner saw in their preview.
"""
import logging
import os
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.incident_routes import _confirm_and_send_incident
from app.db.session import get_db
from app.models.assistant import AssistantConfig
from app.models.business import Business
from app.models.incident import Incident
from app.services import business_chat

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/public", tags=["public-embed"])

_WIDGET_JS_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)), "static", "embed", "widget.js"
)


@router.get("/widget.js", include_in_schema=False)
def get_widget_script():
    """
    The actual embeddable widget (Stage 7) — a static asset, not
    business-scoped itself. Every business's snippet points at this same
    file with a different `data-assistant-id`; the file only ever talks
    to the routes below, which is where all the tenant scoping lives.
    """
    return FileResponse(_WIDGET_JS_PATH, media_type="application/javascript")


# ---------------------------------------------------------------- schemas --

class AssistantPublicOut(BaseModel):
    assistant_name: str
    greeting_message: str
    theme_color: str
    widget_position: str
    business_name: str


class PublicMessageRequest(BaseModel):
    session_id: str = Field(min_length=1, max_length=128)
    message: str = Field(min_length=1, max_length=2000)


class IncidentFieldsOut(BaseModel):
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    order_reference: Optional[str] = None
    issue_description: Optional[str] = None
    additional_details: Optional[str] = None


class EmailDraftOut(BaseModel):
    to: str
    subject: str
    body: str


class PublicIncidentOut(BaseModel):
    id: int
    status: str
    fields: IncidentFieldsOut
    email_draft: Optional[EmailDraftOut] = None


class PublicMessageResponse(BaseModel):
    conversation_id: int
    answer: str
    grounded: bool
    sources: List[str]
    incident: Optional[PublicIncidentOut] = None


class IncidentDraftUpdate(BaseModel):
    customer_name: Optional[str] = Field(default=None, max_length=200)
    customer_email: Optional[str] = Field(default=None, max_length=200)
    customer_phone: Optional[str] = Field(default=None, max_length=50)
    order_reference: Optional[str] = Field(default=None, max_length=100)
    email_subject: Optional[str] = Field(default=None, min_length=1, max_length=300)
    email_body: Optional[str] = Field(default=None, min_length=1, max_length=8000)


class IncidentActionOut(BaseModel):
    id: int
    status: str
    email_to: Optional[str] = None
    email_subject: Optional[str] = None
    email_body: Optional[str] = None
    send_error: Optional[str] = None

    model_config = {"from_attributes": True}


# ------------------------------------------------------------- dependency --

def get_public_business(
    public_id: str,
    request: Request,
    db: Session = Depends(get_db),
) -> tuple[AssistantConfig, Business]:
    result = business_chat.get_config_and_business_by_public_id(db, public_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assistant not found")
    config, business = result
    if not config.embed_enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This assistant isn't published for website use right now.",
        )
    origin = request.headers.get("origin") or request.headers.get("referer")
    if not business_chat.origin_is_allowed(config, origin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This website is not authorized to use this assistant.",
        )
    return config, business


def _get_public_incident(
    incident_id: int,
    session_id: str,
    ctx: tuple = Depends(get_public_business),
    db: Session = Depends(get_db),
) -> Incident:
    _config, business = ctx
    incident = (
        db.query(Incident)
        .filter(Incident.id == incident_id, Incident.business_id == business.id)
        .first()
    )
    # Requiring the caller to know the conversation's own session_id (not
    # just the incident_id) keeps one widget visitor from poking at another
    # visitor's in-progress issue report just by guessing small integers.
    # Public message creation namespaces widget sessions before persisting
    # them (see send_public_message below). The browser keeps and sends the
    # raw UUID, so apply the same namespace for incident authorization.
    expected_session_id = f"widget:{session_id}"
    if incident is None or incident.conversation.session_id != expected_session_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")
    return incident


# ------------------------------------------------------------------ routes --

@router.get("/assistants/{public_id}", response_model=AssistantPublicOut)
def get_public_assistant(ctx: tuple = Depends(get_public_business)):
    config, business = ctx
    return AssistantPublicOut(
        assistant_name=config.assistant_name,
        greeting_message=config.greeting_message,
        theme_color=config.theme_color,
        widget_position=config.widget_position,
        business_name=business.name or "",
    )


@router.post("/assistants/{public_id}/messages", response_model=PublicMessageResponse)
async def send_public_message(
    body: PublicMessageRequest,
    ctx: tuple = Depends(get_public_business),
    db: Session = Depends(get_db),
):
    _config, business = ctx
    try:
        result = await business_chat.send_message(
            db=db,
            business=business,
            # Namespaced so a widget session id can never collide with an
            # owner-dashboard test session id in the same conversation table.
            session_id=f"widget:{body.session_id}",
            message=body.message,
        )
    except Exception as exc:  # noqa: BLE001
        logger.error("[public] chat failed business_id=%s: %s", business.id, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Couldn't reach the assistant right now — please try again in a moment.",
        )
    return result


@router.patch("/assistants/{public_id}/incidents/{incident_id}", response_model=IncidentActionOut)
def update_public_incident(
    body: IncidentDraftUpdate,
    incident: Incident = Depends(_get_public_incident),
    db: Session = Depends(get_db),
):
    if incident.status != Incident.STATUS_READY_FOR_REVIEW:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="This draft isn't ready for review yet."
        )
    updates = body.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(incident, field, value)
    db.add(incident)
    db.commit()
    db.refresh(incident)
    return incident


@router.post("/assistants/{public_id}/incidents/{incident_id}/confirm", response_model=IncidentActionOut)
async def confirm_public_incident(
    incident: Incident = Depends(_get_public_incident),
    ctx: tuple = Depends(get_public_business),
    db: Session = Depends(get_db),
):
    _config, business = ctx
    updated = await _confirm_and_send_incident(db, incident, business)
    logger.info("[public] sent incident_id=%s business_id=%s", incident.id, business.id)
    return updated


@router.post("/assistants/{public_id}/incidents/{incident_id}/cancel", response_model=IncidentActionOut)
def cancel_public_incident(
    incident: Incident = Depends(_get_public_incident),
    db: Session = Depends(get_db),
):
    if incident.status not in (Incident.STATUS_COLLECTING, Incident.STATUS_READY_FOR_REVIEW):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Nothing to cancel.")
    incident.status = Incident.STATUS_CANCELLED
    db.add(incident)
    db.commit()
    db.refresh(incident)
    return incident
