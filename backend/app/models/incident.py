import datetime

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.db.session import Base


class Incident(Base):
    """
    Stage 6 — a customer issue-report thread inside a business assistant
    Conversation. One row per report; a Conversation can have at most one
    *open* (status in COLLECTING/READY_FOR_REVIEW) Incident at a time, but
    keeps its full history if the customer reports more than one issue.

    This is the structured state machine described in the brief's
    "Customer Issue Workflow" section (12): intent -> collected fields ->
    generated draft -> review/edit -> confirm -> send. Driven by
    app/services/issue_workflow.py; app/services/business_chat.py routes a
    conversation turn here instead of the normal RAG answer whenever an
    open Incident exists (or the turn itself expresses report/complaint
    intent).
    """

    __tablename__ = "incidents"

    # ------------------------------------------------------------- status --
    STATUS_COLLECTING = "collecting"
    STATUS_READY_FOR_REVIEW = "ready_for_review"
    STATUS_TICKET_CREATED = "ticket_created"
    STATUS_SENT = "sent"
    STATUS_CANCELLED = "cancelled"
    STATUS_FAILED = "failed"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False, index=True)

    # "collecting" | "ready_for_review" | "ticket_created" | "sent" |
    # "cancelled" | "failed"
    status = Column(String, nullable=False, default=STATUS_COLLECTING)

    # --- collected fields (all nullable — filled in as the customer answers) --
    customer_name = Column(String, nullable=True)
    customer_email = Column(String, nullable=True)
    customer_phone = Column(String, nullable=True)
    order_reference = Column(String, nullable=True)
    issue_description = Column(Text, nullable=True)
    additional_details = Column(Text, nullable=True)

    # JSON-encoded list[str] of field names still needed before a draft can
    # be generated, e.g. ["customer_name", "issue_description"]. Kept as a
    # plain column (not derived) so the workflow can decide "only ask for
    # what's still missing" without recomputing business rules elsewhere.
    missing_fields = Column(Text, nullable=True)

    # --- generated draft (editable by the business owner before sending) --
    email_to = Column(String, nullable=True)  # snapshot of business.helpdesk_email at draft time
    email_subject = Column(String, nullable=True)
    email_body = Column(Text, nullable=True)

    # --- send outcome --
    sent_at = Column(DateTime, nullable=True)
    send_error = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(
        DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow
    )

    business = relationship("Business")
    conversation = relationship("Conversation")
