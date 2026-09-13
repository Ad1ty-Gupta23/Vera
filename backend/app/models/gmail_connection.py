import datetime

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.db.session import Base


class GmailConnection(Base):
    """
    Stage 6 — a platform user's connection to their own Gmail account, used
    to send customer issue-report emails on the business's behalf.

    Deliberately keyed by user_id (not business_id): "Connect Gmail" is a
    dashboard-owner action (see api/gmail_routes.py, gated by the normal
    session cookie / get_current_user — not a business ownership check),
    matching the business.py docstring's "one workspace per owner" model
    and the brief's flat /api/gmail/* route shape (API Design, section 16).

    Only ever holds a refresh token, encrypted at rest via
    app.services.crypto (Fernet). The short-lived access token obtained
    from it is kept in memory only, for the duration of a single send —
    see app/services/gmail_oauth.py:get_valid_access_token. Nothing here is
    ever serialized to the frontend (see api/gmail_routes.py's response
    models, which expose only email + status, never the token).
    """

    __tablename__ = "gmail_connections"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)

    google_email = Column(String, nullable=False)
    refresh_token_encrypted = Column(Text, nullable=False)
    # Space-separated OAuth scopes actually granted — checked before send
    # so a downgraded/edited consent doesn't silently no-op.
    scope = Column(String, nullable=False)

    # "connected" | "needs_reauth" (refresh failed — token revoked/expired,
    # e.g. after 6 months unused or the user revoked access in their
    # Google Account settings)
    status = Column(String, nullable=False, default="connected")
    last_error = Column(Text, nullable=True)

    connected_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(
        DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow
    )

    user = relationship("User")
