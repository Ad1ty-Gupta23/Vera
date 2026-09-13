import datetime

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.db.session import Base


class Conversation(Base):
    """
    One customer <-> business-assistant conversation thread (Stage 5).

    `session_id` identifies the customer's browser/widget session (no
    customer account exists yet — that's fine, the same pattern the free
    chatbot already uses for its own sessions). Everything here is scoped
    to `business_id`, and every route that touches a Conversation must go
    through the same ownership guard as the rest of the business API
    (see api/conversation_routes.py) so one business can never read
    another's customer conversations.
    """

    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False, index=True)
    session_id = Column(String, nullable=False, index=True)

    # "open" | "closed" — reserved for Stage 6 (issue-report workflow will
    # close a conversation once its email is sent/confirmed).
    status = Column(String, nullable=False, default="open")

    started_at = Column(DateTime, default=datetime.datetime.utcnow)
    last_message_at = Column(DateTime, default=datetime.datetime.utcnow)

    business = relationship("Business")
    messages = relationship(
        "ConversationMessage",
        back_populates="conversation",
        order_by="ConversationMessage.created_at",
        cascade="all, delete-orphan",
    )


class ConversationMessage(Base):
    __tablename__ = "conversation_messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False, index=True)

    # "customer" | "assistant"
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    # True when the answer was grounded in the knowledge base / business
    # profile; False for the "I don't have that information" fallback.
    # Null for customer messages.
    grounded = Column(Integer, nullable=True)  # 1 / 0 / NULL — SQLite has no bool

    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    conversation = relationship("Conversation", back_populates="messages")
