"""
Stage 6 — Gmail OAuth for the "send issue-report emails on the business
owner's behalf" feature.

Deliberately a *second*, separate Authlib client registration from
app.auth.oauth (login). Same Google Cloud project / client_id+secret, but:
  - a different redirect_uri (/api/gmail/callback vs /api/auth/google/callback)
  - a narrower scope (gmail.send only — never full mail access)
  - access_type=offline + prompt=consent, which login intentionally
    doesn't request (login has no reason to ask for a refresh token)

Keeping this fully separate means a bug in one flow can't silently expand
what the other is authorized to do, and it makes "the frontend/login
session never sees a Gmail token" trivially true by construction — the
Gmail token never touches app.auth.security's session/JWT code path at
all.
"""
from __future__ import annotations

import datetime
import logging

import httpx
from authlib.integrations.starlette_client import OAuth
from fastapi import HTTPException, Request, status
from sqlalchemy.orm import Session

from app.config.settings import settings
from app.models.gmail_connection import GmailConnection
from app.models.user import User
from app.services import crypto

logger = logging.getLogger(__name__)

_GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"

gmail_oauth = OAuth()
gmail_oauth.register(
    name="google_gmail",
    client_id=settings.google_client_id,
    client_secret=settings.google_client_secret,
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": f"openid email {settings.gmail_send_scope}"},
)


async def start_authorization(request: Request):
    """Kicks off consent. access_type=offline + prompt=consent are required
    to reliably get a refresh_token back — Google only issues one on the
    *first* consent by default, so without prompt=consent a user who
    reconnects after disconnecting would silently get no refresh_token."""
    return await gmail_oauth.google_gmail.authorize_redirect(
        request,
        settings.google_gmail_redirect_uri,
        access_type="offline",
        prompt="consent",
    )


async def handle_callback(request: Request, db: Session, current_user: User) -> GmailConnection:
    """Exchanges the callback code, then creates/updates this user's
    GmailConnection. Raises HTTPException on failure so the route can
    redirect the frontend with a clean error state."""
    try:
        token = await gmail_oauth.google_gmail.authorize_access_token(request)
    except Exception as exc:  # noqa: BLE001
        logger.error("[gmail_oauth] callback token exchange failed: %s", exc)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Gmail authorization failed")

    refresh_token = token.get("refresh_token")
    granted_scope = token.get("scope", "")
    userinfo = token.get("userinfo") or {}
    google_email = userinfo.get("email")

    if not refresh_token:
        # Happens if the user already granted consent once before and
        # Google didn't re-issue a refresh_token this time (prompt=consent
        # above should prevent this, but Google's behavior here isn't
        # 100% guaranteed) — ask them to disconnect+reconnect rather than
        # silently storing an unusable connection.
        logger.error("[gmail_oauth] no refresh_token in callback for user_id=%s", current_user.id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Google didn't grant offline access. Please try connecting again.",
        )

    if settings.gmail_send_scope not in granted_scope:
        logger.error(
            "[gmail_oauth] insufficient scope for user_id=%s: %s", current_user.id, granted_scope
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Gmail send permission was not granted — please allow it to connect.",
        )

    encrypted = crypto.encrypt_secret(refresh_token)

    connection = db.query(GmailConnection).filter(GmailConnection.user_id == current_user.id).first()
    if connection is None:
        connection = GmailConnection(user_id=current_user.id)
        db.add(connection)

    connection.google_email = google_email or connection.google_email or ""
    connection.refresh_token_encrypted = encrypted
    connection.scope = granted_scope
    connection.status = "connected"
    connection.last_error = None
    connection.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(connection)
    logger.info("[gmail_oauth] connected user_id=%s email=%s", current_user.id, google_email)
    return connection


async def get_valid_access_token(db: Session, connection: GmailConnection) -> str:
    """
    Exchanges the stored (encrypted) refresh token for a short-lived
    access token. The access token is returned to the caller only for the
    duration of one send — it is never persisted, never sent to the
    frontend.
    """
    refresh_token = crypto.decrypt_secret(connection.refresh_token_encrypted)
    if refresh_token is None:
        connection.status = "needs_reauth"
        connection.last_error = "Stored credentials could not be decrypted."
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Gmail connection needs to be reconnected.",
        )

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            _GOOGLE_TOKEN_ENDPOINT,
            data={
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            },
        )

    if resp.status_code != 200:
        logger.error(
            "[gmail_oauth] refresh failed user_id=%s status=%s body=%s",
            connection.user_id, resp.status_code, resp.text,
        )
        connection.status = "needs_reauth"
        connection.last_error = "Google rejected the stored refresh token — reconnect required."
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Gmail connection has expired or was revoked. Please reconnect Gmail.",
        )

    data = resp.json()
    access_token = data.get("access_token")
    if not access_token:
        connection.status = "needs_reauth"
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="Gmail authorization response was invalid."
        )
    return access_token


def disconnect(db: Session, connection: GmailConnection) -> None:
    db.delete(connection)
    db.commit()


def get_connection_for_business(db: Session, business) -> GmailConnection | None:
    """
    Issue-report emails always send through the *business owner's*
    connected Gmail account — never the customer's — regardless of
    whether the turn came from the owner's dashboard test chat or an
    anonymous customer on the Stage 7 embed widget. Both call sites
    resolve the connection this same way so behavior can't drift between
    them.
    """
    return (
        db.query(GmailConnection)
        .filter(GmailConnection.user_id == business.owner_user_id)
        .first()
    )
