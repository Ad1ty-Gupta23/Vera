import logging
from typing import Literal, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.security import get_current_user
from app.db.session import get_db
from app.models.subscription import Subscription
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])


class SelectPlanRequest(BaseModel):
    plan: Literal["free", "business"]


class SubscriptionOut(BaseModel):
    plan: str
    status: str
    provider: Optional[str] = None

    model_config = {"from_attributes": True}


def _get_or_create_subscription(db: Session, user: User) -> Subscription:
    sub = db.query(Subscription).filter(Subscription.user_id == user.id).first()
    if sub is None:
        # Lazily backfill — a user created before this table existed (or
        # who has never touched subscription endpoints) still implicitly
        # has whatever plan is on their user row.
        sub = Subscription(user_id=user.id, plan=user.plan, status="active")
        db.add(sub)
        db.commit()
        db.refresh(sub)
    return sub


@router.get("/me", response_model=SubscriptionOut)
def get_my_subscription(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    return _get_or_create_subscription(db, current_user)


@router.post("/select", response_model=SubscriptionOut)
def select_plan(
    body: SelectPlanRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Sets the user's plan. IMPORTANT: no payment provider is configured yet
    — selecting "business" here does not charge anyone, it only unlocks
    the business workspace so the rest of the platform can be built and
    tested. Before launch, put real payment verification in front of this
    (or replace it with a Stripe Checkout session + webhook handler that
    flips `plan`/`status` server-side once payment is confirmed, rather
    than trusting this request body directly).
    """
    sub = _get_or_create_subscription(db, current_user)
    sub.plan = body.plan
    sub.status = "active"
    current_user.plan = body.plan

    db.add(sub)
    db.add(current_user)
    db.commit()
    db.refresh(sub)

    logger.info("[subscriptions] user=%s selected plan=%s", current_user.id, body.plan)
    return sub
