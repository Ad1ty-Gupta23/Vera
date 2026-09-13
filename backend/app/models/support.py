import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db.session import Base


class SupportTicket(Base):
    """A helpdesk work item created from a verified customer incident."""

    __tablename__ = "support_tickets"

    STATUS_OPEN = "open"
    STATUS_IN_PROGRESS = "in_progress"
    STATUS_WAITING = "waiting_on_customer"
    STATUS_RESOLVED = "resolved"
    STATUS_CLOSED = "closed"

    PRIORITY_LOW = "low"
    PRIORITY_NORMAL = "normal"
    PRIORITY_HIGH = "high"
    PRIORITY_URGENT = "urgent"

    id = Column(Integer, primary_key=True, index=True)
    ticket_number = Column(String, nullable=False, unique=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=False, unique=True, index=True)

    status = Column(String, nullable=False, default=STATUS_OPEN, index=True)
    priority = Column(String, nullable=False, default=PRIORITY_NORMAL, index=True)
    category = Column(String, nullable=False, default="general", index=True)
    summary = Column(Text, nullable=False)
    requested_action = Column(String, nullable=True)
    resolution_notes = Column(Text, nullable=True)
    assigned_to = Column(String, nullable=True)

    channel = Column(String, nullable=False, default="chat")
    assemblyai_session_id = Column(String, nullable=True, index=True)
    customer_name = Column(String, nullable=True)
    customer_email = Column(String, nullable=True)
    customer_phone = Column(String, nullable=True)
    order_reference = Column(String, nullable=True, index=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False
    )
    resolved_at = Column(DateTime, nullable=True)

    business = relationship("Business")
    conversation = relationship("Conversation")
    incident = relationship("Incident")
    events = relationship(
        "SupportTicketEvent",
        back_populates="ticket",
        order_by="SupportTicketEvent.created_at",
        cascade="all, delete-orphan",
    )


class SupportTicketEvent(Base):
    """Append-only audit trail for ticket creation and owner changes."""

    __tablename__ = "support_ticket_events"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("support_tickets.id"), nullable=False, index=True)
    event_type = Column(String, nullable=False)
    actor = Column(String, nullable=False)
    from_status = Column(String, nullable=True)
    to_status = Column(String, nullable=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    ticket = relationship("SupportTicket", back_populates="events")


class SupportOrder(Base):
    """Small order adapter used by the demo and replaceable by a commerce connector."""

    __tablename__ = "support_orders"
    __table_args__ = (
        UniqueConstraint("business_id", "order_number", name="uq_support_order_business_number"),
    )

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False, index=True)
    order_number = Column(String, nullable=False, index=True)
    customer_name = Column(String, nullable=False)
    customer_email = Column(String, nullable=True)
    product_name = Column(String, nullable=False)
    status = Column(String, nullable=False)
    delivery_estimate = Column(String, nullable=True)
    eligible_action = Column(String, nullable=True)
    is_demo = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False
    )

    business = relationship("Business")


class VoiceCall(Base):
    """Operational record for one managed AssemblyAI customer call."""

    __tablename__ = "voice_calls"

    STATUS_ACTIVE = "active"
    STATUS_ENDED = "ended"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False, index=True)
    assemblyai_session_id = Column(String, nullable=False, unique=True, index=True)
    client_session_id = Column(String, nullable=True, index=True)
    status = Column(String, nullable=False, default=STATUS_ACTIVE, index=True)
    outcome = Column(String, nullable=False, default="in_progress", index=True)
    primary_intent = Column(String, nullable=True, index=True)
    sentiment = Column(String, nullable=False, default="neutral")
    summary = Column(Text, nullable=True)
    turns = Column(Integer, nullable=False, default=0)
    tool_calls = Column(Integer, nullable=False, default=0)
    interruptions = Column(Integer, nullable=False, default=0)
    awaiting_resolution = Column(Integer, nullable=False, default=0)
    started_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    ended_at = Column(DateTime, nullable=True)

    business = relationship("Business")
    conversation = relationship("Conversation")


class HumanHandoff(Base):
    """A contextual escalation from AI to the business team."""

    __tablename__ = "human_handoffs"

    STATUS_PENDING = "pending"
    STATUS_ACCEPTED = "accepted"
    STATUS_COMPLETED = "completed"
    STATUS_DISMISSED = "dismissed"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False, index=True)
    voice_call_id = Column(Integer, ForeignKey("voice_calls.id"), nullable=True, index=True)
    status = Column(String, nullable=False, default=STATUS_PENDING, index=True)
    routing_category = Column(String, nullable=False, default="general", index=True)
    reason = Column(Text, nullable=False)
    summary = Column(Text, nullable=False)
    customer_name = Column(String, nullable=True)
    customer_email = Column(String, nullable=True)
    customer_phone = Column(String, nullable=True)
    requested_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    accepted_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    business = relationship("Business")
    conversation = relationship("Conversation")
    voice_call = relationship("VoiceCall")
