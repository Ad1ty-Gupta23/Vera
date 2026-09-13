import datetime

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey

from app.db.session import Base


class Business(Base):
    """
    A single business workspace. Stage 3 assumes one workspace per owner
    (that's all the onboarding flow creates), but nothing here enforces
    that at the DB level — a user could own several — so multi-workspace
    support later is a frontend/UX change, not a schema migration.
    """

    __tablename__ = "businesses"

    id = Column(Integer, primary_key=True, index=True)
    owner_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String, nullable=True)
    website = Column(String, nullable=True)
    contact_email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    address = Column(String, nullable=True)
    # Required — this is where Stage 6/12's issue-report emails will be sent.
    helpdesk_email = Column(String, nullable=False)
    logo_url = Column(String, nullable=True)
    working_hours = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(
        DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow
    )
