"""
Orchestrates the knowledge base RAG pipeline end to end:

    upload -> extract text -> chunk -> embed + store (Chroma)
    question -> retrieve relevant chunks (Chroma, tenant-filtered) -> LLM answer

Route handlers (app/api/knowledge_routes.py) should only call into this
module — they shouldn't touch extraction/chunking/vector_store directly,
so tenant-isolation and status bookkeeping stay in one place.
"""
from __future__ import annotations

import logging

from groq import APIError, APITimeoutError
from sqlalchemy.orm import Session

from app.config.settings import settings
from app.knowledge import vector_store
from app.knowledge.chunking import chunk_text
from app.knowledge.extraction import ExtractionError, extract_text
from app.knowledge.prompts import KNOWLEDGE_BASE_ANSWER_PROMPT
from app.models.business import Business
from app.models.knowledge import KnowledgeDocument, KnowledgeGap
from app.services.groq import get_client

logger = logging.getLogger(__name__)

NOT_FOUND_ANSWER = (
    "I don't have that information in my knowledge base yet — you may want to "
    "contact the business directly for this."
)


def process_upload(
    db: Session,
    business_id: int,
    filename: str,
    content: bytes,
) -> KnowledgeDocument:
    """
    Creates the KnowledgeDocument row and processes it synchronously
    (extract -> chunk -> embed). Stage-4 scope keeps this synchronous for
    simplicity; a background task queue would be the natural upgrade once
    uploads are large/frequent enough for this to block requests noticeably.
    """
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "unknown"
    document = KnowledgeDocument(
        business_id=business_id,
        filename=filename,
        file_type=ext,
        file_size_bytes=len(content),
        status="processing",
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    try:
        text = extract_text(filename, content)
        chunks = chunk_text(
            text,
            chunk_size=settings.kb_chunk_size_chars,
            overlap=settings.kb_chunk_overlap_chars,
        )
        if not chunks:
            raise ExtractionError("Document produced no usable text chunks.")

        stored = vector_store.add_document_chunks(
            business_id=business_id,
            document_id=document.id,
            filename=filename,
            chunks=chunks,
        )

        document.status = "ready"
        document.char_count = len(text)
        document.chunk_count = stored
        document.error_message = None
    except ExtractionError as exc:
        logger.warning(
            "[knowledge] extraction failed business_id=%s filename=%s: %s",
            business_id, filename, exc,
        )
        document.status = "failed"
        document.error_message = str(exc)
    except Exception as exc:  # noqa: BLE001 — never let an upload 500 silently
        logger.exception(
            "[knowledge] unexpected processing failure business_id=%s filename=%s",
            business_id, filename,
        )
        document.status = "failed"
        document.error_message = "Something went wrong processing this file."

    db.add(document)
    db.commit()
    db.refresh(document)
    return document


def delete_document(db: Session, document: KnowledgeDocument) -> None:
    vector_store.delete_document_chunks(document.business_id, document.id)
    db.delete(document)
    db.commit()


def delete_all_for_business(db: Session, business_id: int) -> None:
    """
    Called when a whole business workspace is deleted. SQLite here doesn't
    enforce FK cascades, and Chroma's embeddings live entirely outside the
    SQL database either way — so both the document rows and their vectors
    need an explicit delete, or they'd linger as orphaned, unreachable data.
    """
    vector_store.delete_business_chunks(business_id)
    db.query(KnowledgeGap).filter(KnowledgeGap.business_id == business_id).delete()
    db.query(KnowledgeDocument).filter(KnowledgeDocument.business_id == business_id).delete()
    db.commit()


async def answer_question(business: Business, question: str) -> dict:
    """
    Retrieves relevant chunks for `business` and asks Groq to answer using
    only that context. Returns a dict with the answer, whether the KB had
    a confident match, and which source documents were used (so the UI can
    show "answered from: refund-policy.pdf" style provenance).

    Never falls back to the model's general knowledge — if retrieval comes
    up empty or too weak a match, we answer NOT_FOUND_ANSWER ourselves
    without calling the LLM at all, per the "don't hallucinate business
    facts" requirement.
    """
    retrieved = vector_store.query(
        business_id=business.id,
        question=question,
        top_k=settings.kb_retrieval_top_k,
    )
    relevant = [c for c in retrieved if c["distance"] <= settings.kb_max_relevant_distance]

    if not relevant:
        return {"answer": NOT_FOUND_ANSWER, "grounded": False, "sources": []}

    context = "\n\n---\n\n".join(c["text"] for c in relevant)
    sources = sorted({c["filename"] for c in relevant if c["filename"]})

    system_prompt = KNOWLEDGE_BASE_ANSWER_PROMPT.format(
        business_name=business.name or "this business",
        context=context,
    )

    client = get_client()
    try:
        response = client.chat.completions.create(
            model=settings.groq_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": question},
            ],
            temperature=0.2,
            reasoning_effort="low",
            max_tokens=1024,
        )
        answer = response.choices[0].message.content.strip()
    except (APIError, APITimeoutError) as exc:
        logger.error("[knowledge] Groq error answering business_id=%s: %s", business.id, exc)
        raise

    return {"answer": answer, "grounded": True, "sources": sources}
