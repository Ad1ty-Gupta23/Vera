import logging

from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.security import get_current_user
from app.config.settings import settings
from app.db.session import get_db
from app.models.gmail_connection import GmailConnection
from app.models.user import User
from app.services import gmail_oauth

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/gmail", tags=["gmail"])


class GmailStatusOut(BaseModel):
    connected: bool
    email: str | None = None
    status: str | None = None  # "connected" | "needs_reauth" | None (never connected)


@router.get("/connect")
async def connect(request: Request, current_user: User = Depends(get_current_user)):
    """
    Browser-navigated (not fetch) — the frontend does
    `window.location.href = '${API_BASE}/gmail/connect'`, same pattern as
    the existing /api/auth/google login redirect. Requires the user to
    already be logged in (session cookie), since this attaches the Gmail
    grant to their account.
    """
    return await gmail_oauth.start_authorization(request)


@router.get("/callback")
async def callback(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        await gmail_oauth.handle_callback(request, db, current_user)
    except Exception as exc:  # noqa: BLE001
        # handle_callback raises HTTPException with a safe detail message
        # for real failures; anything else is unexpected but still
        # shouldn't leak internals into the redirect URL.
        detail = getattr(exc, "detail", "gmail_connect_failed")
        logger.error("[gmail_routes] callback failed user_id=%s: %s", current_user.id, exc)
        return RedirectResponse(f"{settings.frontend_url}/business/email?gmail_error={detail}")

    return RedirectResponse(f"{settings.frontend_url}/business/email?gmail=connected")


@router.get("/status", response_model=GmailStatusOut)
def get_status(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    connection = db.query(GmailConnection).filter(GmailConnection.user_id == current_user.id).first()
    if connection is None:
        return GmailStatusOut(connected=False)
    return GmailStatusOut(
        connected=connection.status == "connected",
        email=connection.google_email,
        status=connection.status,
    )


@router.post("/disconnect", status_code=204)
def disconnect(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    connection = db.query(GmailConnection).filter(GmailConnection.user_id == current_user.id).first()
    if connection is not None:
        gmail_oauth.disconnect(db, connection)
        logger.info("[gmail_routes] disconnected user_id=%s", current_user.id)
    return None
