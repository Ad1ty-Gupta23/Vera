import logging

from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.auth.oauth import oauth
from app.auth.security import create_session_token, get_current_user
from app.config.settings import settings
from app.db.session import get_db
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/google")
async def google_login(request: Request):
    """Kicks off the Google OAuth flow. The frontend just redirects the
    browser here (window.location = "/api/auth/google"); it never touches
    a client secret or token."""
    redirect_uri = settings.google_redirect_uri
    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/google/callback")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    try:
        token = await oauth.google.authorize_access_token(request)
    except Exception as exc:
        logger.error("[auth] Google OAuth callback failed: %s", exc)
        return RedirectResponse(f"{settings.frontend_url}/login?error=oauth_failed")

    userinfo = token.get("userinfo")
    if not userinfo or not userinfo.get("sub") or not userinfo.get("email"):
        logger.error("[auth] Google OAuth returned no usable userinfo")
        return RedirectResponse(f"{settings.frontend_url}/login?error=oauth_failed")

    google_sub = userinfo["sub"]
    email = userinfo["email"]
    name = userinfo.get("name")
    picture = userinfo.get("picture")

    user = db.query(User).filter(User.google_sub == google_sub).first()
    if user is None:
        # Also guard against a pre-existing row with the same email from a
        # different sub (shouldn't normally happen, but avoids a unique
        # constraint crash if it does).
        user = db.query(User).filter(User.email == email).first()

    if user is None:
        user = User(google_sub=google_sub, email=email, name=name, picture=picture)
        db.add(user)
    else:
        user.google_sub = google_sub
        user.name = name
        user.picture = picture
    db.commit()
    db.refresh(user)

    session_token = create_session_token(user.id)
    response = RedirectResponse(f"{settings.frontend_url}/dashboard")
    response.set_cookie(
        key=settings.session_cookie_name,
        value=session_token,
        httponly=True,
        secure=not settings.frontend_url.startswith("http://localhost"),
        samesite="lax",
        max_age=settings.session_max_age_seconds,
    )
    return response


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "picture": current_user.picture,
        "plan": current_user.plan,
    }


@router.post("/logout")
def logout():
    """Clear the session cookie and return 200 OK.
    The frontend owns the post-logout redirect (it always navigates to '/').
    Returning a RedirectResponse here caused fetch() to silently follow the
    redirect and hit a CORS error, which prevented the navigate('/') call
    from ever executing.
    """
    from fastapi.responses import JSONResponse
    response = JSONResponse({"ok": True})
    response.delete_cookie(
        key=settings.session_cookie_name,
        httponly=True,
        samesite="lax",
    )
    return response
