"""
Splits extracted text into overlapping chunks small enough to embed well
and retrieve precisely, while keeping enough context that a chunk is still
meaningful on its own.

Deliberately simple (paragraph-aware, character-length-based) rather than
a tokenizer-aware splitter — good enough for FAQ/policy/product documents,
and easy to swap for something fancier later without touching callers.
"""
from __future__ import annotations


def chunk_text(
    text: str,
    chunk_size: int = 1200,
    overlap: int = 200,
) -> list[str]:
    """
    Returns a list of overlapping text chunks, each <= chunk_size chars
    (best-effort — a single paragraph longer than chunk_size is hard-split).
    `overlap` characters from the end of one chunk carry into the start of
    the next, so an answer split across a chunk boundary isn't lost.
    """
    if chunk_size <= 0:
        raise ValueError("chunk_size must be positive")
    if overlap >= chunk_size:
        overlap = chunk_size // 4  # sane fallback rather than an infinite loop

    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    if not paragraphs:
        paragraphs = [text.strip()]

    chunks: list[str] = []
    current = ""

    def flush():
        if current.strip():
            chunks.append(current.strip())

    for para in paragraphs:
        # A single paragraph too big for one chunk gets hard-split on its own.
        if len(para) > chunk_size:
            if current:
                flush()
                current = ""
            start = 0
            while start < len(para):
                end = start + chunk_size
                chunks.append(para[start:end].strip())
                start = end - overlap if end - overlap > start else end
            continue

        candidate = f"{current}\n\n{para}" if current else para
        if len(candidate) <= chunk_size:
            current = candidate
        else:
            flush()
            # Carry the tail of the previous chunk forward for continuity.
            tail = current[-overlap:] if overlap and current else ""
            current = f"{tail}\n\n{para}" if tail else para

    flush()
    return [c for c in chunks if c]
