import datetime

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.db.session import Base


class AssistantConfig(Base):
    """
    Per-business assistant persona/config (Stage 5). One row per business —
    created lazily with sane defaults the first time it's read (see
    app.services.business_chat.get_or_create_config) so a brand-new
    workspace always has a real, non-fake "assistant status" instead of a
    hardcoded UI string.
    """

    __tablename__ = "assistant_configs"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(
        Integer, ForeignKey("businesses.id"), nullable=False, unique=True, index=True
    )

    assistant_name = Column(String, nullable=False, default="Assistant")
    greeting_message = Column(
        Text, nullable=False, default="Hi! How can I help you today?"
    )
    # Additional tone/policy guidance the business owner can add on top of
    # the standard grounding rules (e.g. "Always be extra apologetic about
    # shipping delays"). Never allowed to override security/grounding
    # rules — see BUSINESS_ASSISTANT_SYSTEM_PROMPT in business_chat.py.
    custom_instructions = Column(Text, nullable=True)
    theme_color = Column(String, nullable=False, default="#7c3aed")

    # --- Stage 7: website embed widget ---
    # Public, unguessable identifier the embedded widget uses to look up
    # this assistant — deliberately NOT the business_id (which is a small
    # sequential int) so a widget on one business's site can't be used to
    # probe/enumerate other businesses. Safe to expose in client-side HTML;
    # it can only ever read this one business's public-safe config and
    # chat with its assistant, never anything owner-only.
    public_id = Column(String, nullable=True, unique=True, index=True)
    # "bottom-right" | "bottom-left" — purely cosmetic, validated on write.
    widget_position = Column(String, nullable=False, default="bottom-right")
    # Comma-separated list of allowed website origins (e.g.
    # "https://example.com,https://www.example.com"). Empty/null means
    # "no restriction yet" — intentionally permissive by default so a
    # business can test the snippet immediately after generating it,
    # rather than being blocked until they've configured this correctly.
    allowed_origins = Column(Text, nullable=True)
    # Lets a business owner pull the widget offline (e.g. while trialing
    # it) without deleting/regenerating the public_id.
    embed_enabled = Column(Integer, nullable=False, default=1)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(
        DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow
    )

    business = relationship("Business")
