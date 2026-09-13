import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.business_routes import get_owned_business
from app.config.settings import settings
from app.db.session import get_db
from app.models.business import Business
from app.services import business_chat

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/businesses/{business_id}/embed", tags=["embed"])

WIDGET_POSITIONS = {"bottom-right", "bottom-left"}
_MAX_ORIGINS = 10


# ---------------------------------------------------------------- schemas --

class EmbedConfigOut(BaseModel):
    public_id: str
    embed_enabled: bool
    widget_position: str
    allowed_origins: List[str]
    widget_script_url: str
    snippet: str


class EmbedConfigUpdate(BaseModel):
    embed_enabled: Optional[bool] = None
    widget_position: Optional[str] = Field(default=None)
    # Full replacement list — simplest mental model for the dashboard form
    # (a textarea, one origin per line) rather than incremental add/remove.
    allowed_origins: Optional[List[str]] = Field(default=None, max_length=_MAX_ORIGINS)


# ------------------------------------------------------------------- util --

def _snippet(public_id: str) -> str:
    return (
        f'<script\n'
        f'  src="{settings.backend_public_url}/api/public/widget.js"\n'
        f'  data-assistant-id="{public_id}"\n'
        f'  data-api-base="{settings.backend_public_url}/api"\n'
        f'  async>\n'
        f'</script>'
    )


def _to_out(config) -> EmbedConfigOut:
    origins = [o.strip() for o in (config.allowed_origins or "").split(",") if o.strip()]
    return EmbedConfigOut(
        public_id=config.public_id,
        embed_enabled=bool(config.embed_enabled),
        widget_position=config.widget_position,
        allowed_origins=origins,
        widget_script_url=f"{settings.backend_public_url}/api/public/widget.js",
        snippet=_snippet(config.public_id),
    )


# ------------------------------------------------------------------ routes --

@router.get("", response_model=EmbedConfigOut)
def get_embed_config(
    business: Business = Depends(get_owned_business),
    db: Session = Depends(get_db),
):
    config = business_chat.get_or_create_config(db, business)
    return _to_out(config)


@router.patch("", response_model=EmbedConfigOut)
def update_embed_config(
    body: EmbedConfigUpdate,
    business: Business = Depends(get_owned_business),
    db: Session = Depends(get_db),
):
    config = business_chat.get_or_create_config(db, business)
    updates = body.model_dump(exclude_unset=True)

    if "widget_position" in updates and updates["widget_position"] is not None:
        if updates["widget_position"] not in WIDGET_POSITIONS:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"widget_position must be one of {sorted(WIDGET_POSITIONS)}",
            )
        config.widget_position = updates["widget_position"]

    if "embed_enabled" in updates and updates["embed_enabled"] is not None:
        config.embed_enabled = 1 if updates["embed_enabled"] else 0

    if "allowed_origins" in updates and updates["allowed_origins"] is not None:
        cleaned = [o.strip().rstrip("/") for o in updates["allowed_origins"] if o.strip()]
        for origin in cleaned:
            if not (origin.startswith("http://") or origin.startswith("https://")):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"'{origin}' must include http:// or https://",
                )
        config.allowed_origins = ",".join(cleaned) if cleaned else None

    db.add(config)
    db.commit()
    db.refresh(config)
    logger.info("[embed] updated config business_id=%s", business.id)
    return _to_out(config)


@router.post("/regenerate", response_model=EmbedConfigOut)
def regenerate_embed_id(
    business: Business = Depends(get_owned_business),
    db: Session = Depends(get_db),
):
    """Rotates the public assistant id, immediately invalidating any
    previously copied snippet — for when a business wants to be sure an
    old/leaked snippet can no longer reach their assistant."""
    config = business_chat.get_or_create_config(db, business)
    config = business_chat.regenerate_public_id(db, config)
    logger.info("[embed] regenerated public_id business_id=%s", business.id)
    return _to_out(config)
