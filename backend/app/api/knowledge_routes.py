import datetime
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.business_routes import get_owned_business
from app.config.settings import settings
from app.db.session import get_db
from app.knowledge.extraction import SUPPORTED_EXTENSIONS
from app.models.business import Business
from app.models.knowledge import KnowledgeDocument, KnowledgeGap
from app.services import knowledge_base as kb_service
from app.services import knowledge_gaps as gap_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/businesses/{business_id}/knowledge-base", tags=["knowledge-base"])


# ---------------------------------------------------------------- schemas --

class KnowledgeDocumentOut(BaseModel):
    id: int
    filename: str
    file_type: str
    file_size_bytes: Optional[int] = None
    status: str
    error_message: Optional[str] = None
    char_count: Optional[int] = None
    chunk_count: Optional[int] = None
    created_at: str

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_row(cls, row: KnowledgeDocument) -> "KnowledgeDocumentOut":
        return cls(
            id=row.id,
            filename=row.filename,
            file_type=row.file_type,
            file_size_bytes=row.file_size_bytes,
            status=row.status,
            error_message=row.error_message,
            char_count=row.char_count,
            chunk_count=row.chunk_count,
            created_at=row.created_at.isoformat() if row.created_at else "",
        )


class QueryRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)


class QueryResponse(BaseModel):
    answer: str
    grounded: bool
    sources: List[str]


class KnowledgeGapOut(BaseModel):
    id: int
    question: str
    occurrence_count: int
    status: str
    approved_answer: Optional[str] = None
    source_document_id: Optional[int] = None
    first_seen_at: datetime.datetime
    last_seen_at: datetime.datetime
    resolved_at: Optional[datetime.datetime] = None

    model_config = {"from_attributes": True}


class ResolveGapRequest(BaseModel):
    answer: str = Field(min_length=1, max_length=4000)


class KnowledgeInsightsOut(BaseModel):
    conversation_count: int
    total_answers: int
    grounded_answers: int
    grounded_rate: int
    open_gaps: int
    unanswered_questions: int
    resolved_gaps: int
    sent_incidents: int


# ------------------------------------------------------- document lookup --

def get_owned_document(
    document_id: int,
    business: Business = Depends(get_owned_business),
    db: Session = Depends(get_db),
) -> KnowledgeDocument:
    document = (
        db.query(KnowledgeDocument)
        .filter(
            KnowledgeDocument.id == document_id,
            KnowledgeDocument.business_id == business.id,
        )
        .first()
    )
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return document


def get_owned_gap(
    gap_id: int,
    business: Business = Depends(get_owned_business),
    db: Session = Depends(get_db),
) -> KnowledgeGap:
    gap = (
        db.query(KnowledgeGap)
        .filter(KnowledgeGap.id == gap_id, KnowledgeGap.business_id == business.id)
        .first()
    )
    if gap is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge gap not found")
    return gap


# ------------------------------------------------------------------ routes --

@router.post("/upload", response_model=KnowledgeDocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    business: Business = Depends(get_owned_business),
    db: Session = Depends(get_db),
):
    if "." not in file.filename:
        raise HTTPException(status_code=400, detail="File must have an extension.")
    ext = file.filename.rsplit(".", 1)[-1].lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '.{ext}'. Supported: {', '.join(sorted(SUPPORTED_EXTENSIONS))}.",
        )

    content = await file.read()
    max_bytes = settings.kb_max_file_size_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds the {settings.kb_max_file_size_mb}MB limit.",
        )
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="File is empty.")

    document = kb_service.process_upload(
        db=db, business_id=business.id, filename=file.filename, content=content
    )
    logger.info(
        "[knowledge] upload business_id=%s document_id=%s status=%s",
        business.id, document.id, document.status,
    )
    return KnowledgeDocumentOut.from_orm_row(document)


@router.get("", response_model=List[KnowledgeDocumentOut])
def list_documents(
    business: Business = Depends(get_owned_business),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(KnowledgeDocument)
        .filter(KnowledgeDocument.business_id == business.id)
        .order_by(KnowledgeDocument.created_at.desc())
        .all()
    )
    return [KnowledgeDocumentOut.from_orm_row(r) for r in rows]


@router.get("/gaps", response_model=List[KnowledgeGapOut])
def list_knowledge_gaps(
    business: Business = Depends(get_owned_business),
    db: Session = Depends(get_db),
):
    return (
        db.query(KnowledgeGap)
        .filter(
            KnowledgeGap.business_id == business.id,
            KnowledgeGap.status == KnowledgeGap.STATUS_OPEN,
        )
        .order_by(KnowledgeGap.occurrence_count.desc(), KnowledgeGap.last_seen_at.desc())
        .all()
    )


@router.post("/gaps/{gap_id}/resolve", response_model=KnowledgeGapOut)
def resolve_knowledge_gap(
    body: ResolveGapRequest,
    gap: KnowledgeGap = Depends(get_owned_gap),
    db: Session = Depends(get_db),
):
    if gap.status != KnowledgeGap.STATUS_OPEN:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Knowledge gap is not open")
    try:
        return gap_service.resolve_gap(db, gap, body.answer)
    except ValueError as exc:
        logger.error("[knowledge] failed to resolve gap_id=%s: %s", gap.id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The answer could not be added to the knowledge base.",
        ) from exc


@router.post("/gaps/{gap_id}/dismiss", response_model=KnowledgeGapOut)
def dismiss_knowledge_gap(
    gap: KnowledgeGap = Depends(get_owned_gap),
    db: Session = Depends(get_db),
):
    if gap.status != KnowledgeGap.STATUS_OPEN:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Knowledge gap is not open")
    return gap_service.dismiss_gap(db, gap)


@router.get("/insights", response_model=KnowledgeInsightsOut)
def get_knowledge_insights(
    business: Business = Depends(get_owned_business),
    db: Session = Depends(get_db),
):
    return gap_service.summary(db, business.id)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document: KnowledgeDocument = Depends(get_owned_document),
    db: Session = Depends(get_db),
):
    kb_service.delete_document(db, document)
    logger.info("[knowledge] deleted document_id=%s", document.id)
    return None


@router.post("/query", response_model=QueryResponse)
async def query_knowledge_base(
    body: QueryRequest,
    business: Business = Depends(get_owned_business),
):
    """
    Test/preview endpoint — lets a business owner try their assistant's
    knowledge base answers from the dashboard before embedding it anywhere.
    The Stage 5 business chat route will call the same
    app.services.knowledge_base.answer_question() for real customer
    conversations instead of duplicating this logic.
    """
    try:
        result = await kb_service.answer_question(business, body.question)
    except Exception as exc:  # noqa: BLE001
        logger.error("[knowledge] query failed business_id=%s: %s", business.id, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Couldn't reach the AI model to answer this question.",
        )
    return result
