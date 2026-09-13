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
from app.models.knowledge import KnowledgeDocument
from app.services import knowledge_base as kb_service

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
