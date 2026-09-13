"""
Chroma-backed vector store for business knowledge bases.

Tenant isolation: every chunk is stored with a `business_id` metadata field,
and EVERY query/delete below filters on it via Chroma's `where` clause.
There is a single collection shared across all businesses (simpler ops than
one collection per business) — the `where` filter is what prevents one
business's documents from ever being retrievable by another's assistant.
Never call the underlying collection directly from route/service code;
go through these functions so that filter can't be forgotten.
"""
from __future__ import annotations

import logging
import threading
from typing import TypedDict

import chromadb
from chromadb.utils import embedding_functions

from app.config.settings import settings

logger = logging.getLogger(__name__)

_COLLECTION_NAME = "business_knowledge_base"

_client = None
_collection = None
_lock = threading.Lock()


def _get_collection():
    """Lazily creates the Chroma client + collection on first use, so
    importing this module never triggers a (slow) embedding-model load."""
    global _client, _collection
    if _collection is not None:
        return _collection

    with _lock:
        if _collection is None:
            _client = chromadb.PersistentClient(path=settings.chroma_persist_dir)
            embedder = embedding_functions.SentenceTransformerEmbeddingFunction(
                model_name=settings.kb_embedding_model
            )
            _collection = _client.get_or_create_collection(
                name=_COLLECTION_NAME,
                embedding_function=embedder,
                metadata={"hnsw:space": "cosine"},
            )
    return _collection


class RetrievedChunk(TypedDict):
    text: str
    document_id: int
    filename: str
    distance: float


def add_document_chunks(
    business_id: int,
    document_id: int,
    filename: str,
    chunks: list[str],
) -> int:
    """Embeds and stores `chunks`. Returns the number stored."""
    if not chunks:
        return 0

    collection = _get_collection()
    ids = [f"biz{business_id}-doc{document_id}-chunk{i}" for i in range(len(chunks))]
    metadatas = [
        {"business_id": business_id, "document_id": document_id, "filename": filename}
        for _ in chunks
    ]
    collection.add(ids=ids, documents=chunks, metadatas=metadatas)
    logger.info(
        "[knowledge] embedded %d chunk(s) for business_id=%s document_id=%s",
        len(chunks),
        business_id,
        document_id,
    )
    return len(chunks)


def delete_document_chunks(business_id: int, document_id: int) -> None:
    """Removes every chunk belonging to one document. Safe to call even if
    the document has no chunks (e.g. it failed before embedding)."""
    collection = _get_collection()
    collection.delete(where={"$and": [
        {"business_id": business_id},
        {"document_id": document_id},
    ]})


def delete_business_chunks(business_id: int) -> None:
    """Removes every chunk for a business — used when the whole workspace
    is deleted, so no orphaned embeddings linger in Chroma."""
    collection = _get_collection()
    collection.delete(where={"business_id": business_id})


def query(business_id: int, question: str, top_k: int) -> list[RetrievedChunk]:
    """
    Returns up to `top_k` chunks most relevant to `question`, restricted to
    `business_id`. Empty list means either the business has no knowledge
    base yet, or nothing matched.
    """
    collection = _get_collection()
    count = collection.count()
    if count == 0:
        return []

    results = collection.query(
        query_texts=[question],
        n_results=top_k,
        where={"business_id": business_id},
    )

    documents = results.get("documents") or [[]]
    metadatas = results.get("metadatas") or [[]]
    distances = results.get("distances") or [[]]

    chunks: list[RetrievedChunk] = []
    for text, meta, distance in zip(documents[0], metadatas[0], distances[0]):
        chunks.append(
            RetrievedChunk(
                text=text,
                document_id=meta.get("document_id"),
                filename=meta.get("filename", ""),
                distance=distance,
            )
        )
    return chunks
