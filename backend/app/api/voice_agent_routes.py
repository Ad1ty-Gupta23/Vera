"""Optional AssemblyAI Voice Agent API endpoints for owner preview + widget."""
from __future__ import annotations

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.business_routes import get_owned_business
from app.api.public_routes import get_public_business
from app.db.session import get_db
from app.models.business import Business
from app.services import business_chat, call_operations, voice_agent

logger = logging.getLogger(__name__)
router = APIRouter(tags=["voice-agent"])


class VoiceAgentToolRequest(BaseModel):
    session_id: str = Field(min_length=1, max_length=128)
    message: str = Field(min_length=1, max_length=2000)
    assemblyai_session_id: Optional[str] = Field(default=None, max_length=200)


class VoiceAgentToolResponse(BaseModel):
    conversation_id: int
    answer: str
    grounded: bool
    sources: List[str]
    incident: Optional[dict] = None
    ticket: Optional[dict] = None
    order: Optional[dict] = None
    handoff: Optional[dict] = None
    spoken_answer: str


class VoiceCallEndRequest(BaseModel):
    assemblyai_session_id: str = Field(min_length=1, max_length=200)
    interruptions: int = Field(default=0, ge=0, le=10000)


async def _bootstrap(config, business: Business) -> dict:
    try:
        return await voice_agent.build_bootstrap(config, business)
    except voice_agent.VoiceAgentUnavailable as exc:
        # A 503 deliberately tells clients to use the unchanged legacy voice
        # path. Never leak provider response bodies or API credentials.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Managed voice is unavailable; use the standard voice mode.",
        ) from exc


async def _run_tool(
    db: Session,
    business: Business,
    session_id: str,
    message: str,
    assemblyai_session_id: Optional[str] = None,
) -> dict:
    try:
        result = await business_chat.send_message(
            db=db,
            business=business,
            session_id=session_id,
            message=message,
            channel="voice",
            assemblyai_session_id=assemblyai_session_id,
        )
    except Exception as exc:  # noqa: BLE001
        logger.error("[voice_agent] tool failed business_id=%s: %s", business.id, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The business assistant could not process that request.",
        ) from exc

    # Outcome tracking must never turn a successful customer answer into a
    # failed call. Roll back only the analytics write and keep serving.
    try:
        call_operations.record_voice_turn(
            db,
            business,
            result["conversation_id"],
            assemblyai_session_id,
            message,
            result,
        )
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        logger.warning("[voice_agent] outcome tracking failed business_id=%s: %s", business.id, exc)

    spoken_answer = voice_agent.make_spoken_answer(result["answer"])
    should_confirm = not any(
        result.get(key) for key in ("incident", "ticket", "handoff")
    ) and result.get("resolution_feedback") is None
    if should_confirm:
        spoken_answer = f"{spoken_answer} Did that resolve your request?"
    return {
        **result,
        "spoken_answer": spoken_answer,
    }


@router.get("/businesses/{business_id}/voice-agent/session")
async def get_owner_voice_agent_session(
    response: Response,
    business: Business = Depends(get_owned_business),
    db: Session = Depends(get_db),
):
    response.headers["Cache-Control"] = "no-store"
    config = business_chat.get_or_create_config(db, business)
    return await _bootstrap(config, business)


@router.post(
    "/businesses/{business_id}/voice-agent/tool",
    response_model=VoiceAgentToolResponse,
)
async def run_owner_voice_agent_tool(
    body: VoiceAgentToolRequest,
    business: Business = Depends(get_owned_business),
    db: Session = Depends(get_db),
):
    return await _run_tool(
        db,
        business,
        f"owner-test:{body.session_id}",
        body.message,
        body.assemblyai_session_id,
    )


@router.post("/businesses/{business_id}/voice-agent/calls/end")
def end_owner_voice_call(
    body: VoiceCallEndRequest,
    business: Business = Depends(get_owned_business),
    db: Session = Depends(get_db),
):
    call = call_operations.finish_call(
        db, business, body.assemblyai_session_id, body.interruptions
    )
    return {"ok": True, "call": call_operations.call_out(call) if call else None}


@router.get("/public/assistants/{public_id}/voice-agent/session")
async def get_public_voice_agent_session(
    response: Response,
    ctx: tuple = Depends(get_public_business),
):
    response.headers["Cache-Control"] = "no-store"
    config, business = ctx
    return await _bootstrap(config, business)


@router.post(
    "/public/assistants/{public_id}/voice-agent/tool",
    response_model=VoiceAgentToolResponse,
)
async def run_public_voice_agent_tool(
    body: VoiceAgentToolRequest,
    ctx: tuple = Depends(get_public_business),
    db: Session = Depends(get_db),
):
    _config, business = ctx
    return await _run_tool(
        db,
        business,
        f"widget:{body.session_id}",
        body.message,
        body.assemblyai_session_id,
    )


@router.post("/public/assistants/{public_id}/voice-agent/calls/end")
def end_public_voice_call(
    body: VoiceCallEndRequest,
    ctx: tuple = Depends(get_public_business),
    db: Session = Depends(get_db),
):
    _config, business = ctx
    call = call_operations.finish_call(
        db, business, body.assemblyai_session_id, body.interruptions
    )
    return {"ok": True, "call": call_operations.call_out(call) if call else None}
