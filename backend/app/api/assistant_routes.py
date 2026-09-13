import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.business_routes import get_owned_business
from app.db.session import get_db
from app.models.assistant import AssistantConfig
from app.models.business import Business
from app.services import business_chat

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/businesses/{business_id}/assistant", tags=["assistant"])


# ---------------------------------------------------------------- schemas --

class AssistantConfigOut(BaseModel):
    assistant_name: str
    greeting_message: str
    custom_instructions: Optional[str] = None
    theme_color: str

    model_config = {"from_attributes": True}


class AssistantConfigUpdate(BaseModel):
    assistant_name: Optional[str] = Field(default=None, min_length=1, max_length=80)
    greeting_message: Optional[str] = Field(default=None, min_length=1, max_length=500)
    custom_instructions: Optional[str] = Field(default=None, max_length=4000)
    theme_color: Optional[str] = Field(default=None, min_length=4, max_length=9)


class TestMessageRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    # Lets the dashboard "reset" its preview conversation by starting a new
    # session id client-side, without needing a dedicated reset endpoint.
    session_id: str = Field(min_length=1, max_length=128)


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


class IncidentOut(BaseModel):
    id: int
    status: str
    fields: IncidentFieldsOut
    email_draft: Optional[EmailDraftOut] = None


class TestMessageResponse(BaseModel):
    conversation_id: int
    answer: str
    grounded: bool
    sources: List[str]
    # Stage 6 — present whenever this turn was handled by the issue-report
    # workflow instead of the normal knowledge-base answer.
    incident: Optional[IncidentOut] = None


# ------------------------------------------------------------------ routes --

@router.get("", response_model=AssistantConfigOut)
def get_assistant_config(
    business: Business = Depends(get_owned_business),
    db: Session = Depends(get_db),
):
    return business_chat.get_or_create_config(db, business)


@router.patch("", response_model=AssistantConfigOut)
def update_assistant_config(
    body: AssistantConfigUpdate,
    business: Business = Depends(get_owned_business),
    db: Session = Depends(get_db),
):
    config = business_chat.get_or_create_config(db, business)
    updates = body.model_dump(exclude_unset=True)
    updated = business_chat.update_config(db, config, updates)
    logger.info("[assistant] updated config business_id=%s", business.id)
    return updated


@router.post("/test", response_model=TestMessageResponse)
async def test_assistant(
    body: TestMessageRequest,
    business: Business = Depends(get_owned_business),
    db: Session = Depends(get_db),
):
    """
    Business-owner-facing preview chat — runs through the exact same
    tenant-aware pipeline a real customer's message would (Stage 7's public
    embed widget will call the same app.services.business_chat.send_message
    via a public, assistant-ID-scoped route instead of this owner-only one).
    """
    try:
        result = await business_chat.send_message(
            db=db, business=business, session_id=f"owner-test:{body.session_id}", message=body.message
        )
    except Exception as exc:  # noqa: BLE001
        logger.error("[assistant] test chat failed business_id=%s: %s", business.id, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Couldn't reach the AI model to answer this question.",
        )
    return result
