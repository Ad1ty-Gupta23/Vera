import datetime

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db.session import Base


class KnowledgeDocument(Base):
    """
    One uploaded knowledge base source (file or pasted text), scoped to a
    single business workspace. The actual text lives in Chroma as chunks
    (see app/knowledge/vector_store.py) — this row is the source-of-truth
    for what was uploaded, its processing status, and tenant ownership.

    Chroma chunks are keyed off `id` (as `document_id` in their metadata),
    so deleting a row here must also delete its chunks — see
    app.services.knowledge_base.delete_document().
    """

    __tablename__ = "knowledge_documents"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False, index=True)

    filename = Column(String, nullable=False)
    # "pdf" | "txt" | "md" | "docx" | "text" (manually pasted, no file)
    file_type = Column(String, nullable=False)
    file_size_bytes = Column(Integer, nullable=True)

    # "processing" | "ready" | "failed"
    status = Column(String, nullable=False, default="processing")
    error_message = Column(Text, nullable=True)

    char_count = Column(Integer, nullable=True)
    chunk_count = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(
        DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow
    )

    business = relationship("Business")


class KnowledgeGap(Base):
    """A customer question the assistant could not answer safely.

    Questions are deduplicated per business by ``normalized_question`` so
    repeated demand becomes a useful signal instead of dashboard noise.
    Owners can resolve a gap by approving an answer, which is then indexed
    as a normal KnowledgeDocument.
    """

    __tablename__ = "knowledge_gaps"
    __table_args__ = (
        UniqueConstraint(
            "business_id", "normalized_question", name="uq_knowledge_gap_business_question"
        ),
    )

    STATUS_OPEN = "open"
    STATUS_RESOLVED = "resolved"
    STATUS_DISMISSED = "dismissed"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=True, index=True)
    question = Column(Text, nullable=False)
    normalized_question = Column(String(500), nullable=False)
    occurrence_count = Column(Integer, nullable=False, default=1)
    status = Column(String, nullable=False, default=STATUS_OPEN, index=True)
    approved_answer = Column(Text, nullable=True)
    source_document_id = Column(
        Integer, ForeignKey("knowledge_documents.id"), nullable=True, index=True
    )
    first_seen_at = Column(DateTime, default=datetime.datetime.utcnow)
    last_seen_at = Column(DateTime, default=datetime.datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    business = relationship("Business")
    conversation = relationship("Conversation")
    source_document = relationship("KnowledgeDocument")
