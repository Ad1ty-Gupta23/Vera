import datetime

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey

from app.db.session import Base


class Subscription(Base):
    """
    Tracks which plan a user is on. Stage 3 has no payment provider
    connected, so `status="active"` here means "the flag has been set by
    the user", not "a payment cleared" — see subscription_routes.py for
    where a real provider (Stripe, etc.) would hook in via webhook instead
    of direct client input.
    """

    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)

    # "free" | "business"
    plan = Column(String, nullable=False, default="free")
    # "active" | "canceled" | "inactive"
    status = Column(String, nullable=False, default="active")

    # Left null until a real payment provider is wired up.
    provider = Column(String, nullable=True)
    provider_customer_id = Column(String, nullable=True)
    provider_subscription_id = Column(String, nullable=True)
    current_period_start = Column(DateTime, nullable=True)
    current_period_end = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(
        DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow
    )
