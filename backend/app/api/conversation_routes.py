import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.api.business_routes import get_owned_business
from app.db.session import get_db
from app.models.business import Business
from app.models.conversation import Conversation, ConversationMessage

router = APIRouter(prefix="/businesses/{business_id}/conversations", tags=["conversations"])


# ---------------------------------------------------------------- schemas --

class ConversationSummaryOut(BaseModel):
    id: int
    session_id: str
    status: str
    started_at: datetime.datetime
    last_message_at: datetime.datetime
    message_count: int
    last_message_preview: Optional[str] = None


class ConversationMessageOut(BaseModel):
    id: int
    role: str
    content: str
    grounded: Optional[bool] = None
    created_at: datetime.datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_row(cls, row: ConversationMessage) -> "ConversationMessageOut":
        return cls(
            id=row.id,
            role=row.role,
            content=row.content,
            grounded=None if row.grounded is None else bool(row.grounded),
            created_at=row.created_at,
        )


class ConversationDetailOut(BaseModel):
    id: int
    session_id: str
    status: str
    started_at: datetime.datetime
    last_message_at: datetime.datetime
    messages: List[ConversationMessageOut]


# ------------------------------------------------------- ownership guard --

def _get_owned_conversation(
    conversation_id: int,
    business: Business = Depends(get_owned_business),
    db: Session = Depends(get_db),
) -> Conversation:
    conversation = (
        db.query(Conversation)
        .options(joinedload(Conversation.messages))
        .filter(Conversation.id == conversation_id, Conversation.business_id == business.id)
        .first()
    )
    if conversation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return conversation


# ------------------------------------------------------------------ routes --

@router.get("", response_model=List[ConversationSummaryOut])
def list_conversations(
    business: Business = Depends(get_owned_business),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(Conversation)
        .filter(Conversation.business_id == business.id)
        .order_by(Conversation.last_message_at.desc())
        .all()
    )
    out = []
    for c in rows:
        last = c.messages[-1] if c.messages else None
        out.append(
            ConversationSummaryOut(
                id=c.id,
                session_id=c.session_id,
                status=c.status,
                started_at=c.started_at,
                last_message_at=c.last_message_at,
                message_count=len(c.messages),
                last_message_preview=(last.content[:140] if last else None),
            )
        )
    return out


@router.get("/{conversation_id}", response_model=ConversationDetailOut)
def get_conversation(conversation: Conversation = Depends(_get_owned_conversation)):
    return ConversationDetailOut(
        id=conversation.id,
        session_id=conversation.session_id,
        status=conversation.status,
        started_at=conversation.started_at,
        last_message_at=conversation.last_message_at,
        messages=[ConversationMessageOut.from_orm_row(m) for m in conversation.messages],
    )
