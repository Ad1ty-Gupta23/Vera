import datetime
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.auth.security import get_current_user
from app.db.session import get_db
from app.models.business import Business
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/businesses", tags=["businesses"])


# ---------------------------------------------------------------- schemas --

class BusinessCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    category: Optional[str] = None
    website: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    helpdesk_email: EmailStr
    logo_url: Optional[str] = None
    working_hours: Optional[str] = None


class BusinessUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    category: Optional[str] = None
    website: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    helpdesk_email: Optional[EmailStr] = None
    logo_url: Optional[str] = None
    working_hours: Optional[str] = None


class BusinessOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    website: Optional[str] = None
    contact_email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    helpdesk_email: str
    logo_url: Optional[str] = None
    working_hours: Optional[str] = None
    created_at: datetime.datetime

    model_config = {"from_attributes": True}


# ------------------------------------------------------------- dependency --

def get_owned_business(
    business_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Business:
    """
    Shared ownership guard for every /businesses/{business_id}... route.
    Returns 404 — not 403 — when the business exists but belongs to
    someone else, so we don't confirm/deny the existence of IDs a caller
    doesn't own.
    """
    business = db.query(Business).filter(Business.id == business_id).first()
    if business is None or business.owner_user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    return business


# ------------------------------------------------------------------ routes --

@router.post("", response_model=BusinessOut, status_code=status.HTTP_201_CREATED)
def create_business(
    body: BusinessCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.plan != "business":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="A Business plan subscription is required to create a business workspace.",
        )

    business = Business(owner_user_id=current_user.id, **body.model_dump())
    db.add(business)
    db.commit()
    db.refresh(business)
    logger.info("[businesses] created business_id=%s owner=%s", business.id, current_user.id)
    return business


@router.get("", response_model=List[BusinessOut])
def list_businesses(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    return (
        db.query(Business)
        .filter(Business.owner_user_id == current_user.id)
        .order_by(Business.created_at.asc())
        .all()
    )


@router.get("/{business_id}", response_model=BusinessOut)
def get_business(business: Business = Depends(get_owned_business)):
    return business


@router.patch("/{business_id}", response_model=BusinessOut)
def update_business(
    body: BusinessUpdate,
    business: Business = Depends(get_owned_business),
    db: Session = Depends(get_db),
):
    updates = body.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(business, field, value)
    db.add(business)
    db.commit()
    db.refresh(business)
    logger.info("[businesses] updated business_id=%s", business.id)
    return business


@router.delete("/{business_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_business(
    business: Business = Depends(get_owned_business), db: Session = Depends(get_db)
):
    # Stage 4: knowledge base documents + their Chroma embeddings live
    # outside the FK relationship SQLite enforces, so they need an
    # explicit cleanup pass here — otherwise deleting a business would
    # leave orphaned documents and vectors behind.
    from app.services import knowledge_base as kb_service

    kb_service.delete_all_for_business(db, business.id)
    db.delete(business)
    db.commit()
    logger.info("[businesses] deleted business_id=%s", business.id)
    return None
