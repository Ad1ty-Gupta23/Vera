"""
Session handling.

We use a signed, httpOnly, SameSite=Lax cookie holding a short JWT with the
user's DB id. The frontend never sees or handles a token directly — it just
carries the cookie automatically (fetch calls must pass credentials:
"include"). This keeps Google's tokens and our own session both out of
client-side JS entirely, per the "never expose credentials to the frontend"
requirement.
"""
import datetime
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config.settings import settings
from app.db.session import get_db
from app.models.user import User

ALGORITHM = "HS256"


def create_session_token(user_id: int) -> str:
    expire = datetime.datetime.utcnow() + datetime.timedelta(
        seconds=settings.session_max_age_seconds
    )
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, settings.session_secret_key, algorithm=ALGORITHM)


def _decode_session_token(token: str) -> Optional[int]:
    try:
        payload = jwt.decode(token, settings.session_secret_key, algorithms=[ALGORITHM])
        return int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        return None


def get_current_user(
    request: Request, db: Session = Depends(get_db)
) -> User:
    """Raises 401 if there's no valid session. Use for any protected route."""
    token = request.cookies.get(settings.session_cookie_name)
    user_id = _decode_session_token(token) if token else None
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def get_optional_user(
    request: Request, db: Session = Depends(get_db)
) -> Optional[User]:
    """Like get_current_user but returns None instead of raising — for
    routes (like the WS handshake) that work for anonymous users too but
    should attach identity when it's available."""
    token = request.cookies.get(settings.session_cookie_name)
    user_id = _decode_session_token(token) if token else None
    if user_id is None:
        return None
    return db.query(User).filter(User.id == user_id).first()
