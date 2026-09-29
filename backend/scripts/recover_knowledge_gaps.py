r"""Recover absent gaps from explicit saved abstentions; dry-run by default.

Run from backend: .venv\Scripts\python.exe scripts/recover_knowledge_gaps.py
--business-id 3 [--apply]. Existing open/resolved/dismissed gaps are untouched.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.session import SessionLocal
from app.models import assistant, business, gmail_connection, incident, subscription, support, user  # noqa: F401
from app.models.conversation import Conversation, ConversationMessage
from app.models.knowledge import KnowledgeGap
from app.services import knowledge_gaps


def recover(db, business_id: int, *, apply: bool = False) -> list[dict]:
    existing = {row[0] for row in db.query(KnowledgeGap.normalized_question).filter(
        KnowledgeGap.business_id == business_id,
    ).all()}
    rows = db.query(ConversationMessage).join(Conversation).filter(
        Conversation.business_id == business_id,
    ).order_by(ConversationMessage.conversation_id, ConversationMessage.id).all()
    pending = {}
    candidates = {}
    for row in rows:
        if row.role == "customer":
            pending[row.conversation_id] = row
            continue
        if row.role != "assistant":
            continue
        question = pending.pop(row.conversation_id, None)
        if question is None or not knowledge_gaps.answer_reports_missing_knowledge(row.content):
            continue
        key = knowledge_gaps.normalize_question(question.content)
        if key in existing or not knowledge_gaps.should_capture(question.content):
            continue
        if key not in candidates:
            candidates[key] = {"question": question.content, "conversation_id": row.conversation_id, "count": 0}
        candidates[key]["count"] += 1
    if apply:
        for item in candidates.values():
            gap = knowledge_gaps.record_gap(db, business_id=business_id,
                conversation_id=item["conversation_id"], question=item["question"])
            gap.occurrence_count = item["count"]
        db.commit()
    return list(candidates.values())


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--business-id", type=int, required=True)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    with SessionLocal() as db:
        candidates = recover(db, args.business_id, apply=args.apply)
        print(f"{'Recovered' if args.apply else 'Would recover'} {len(candidates)} missing gaps for business {args.business_id}.")
        for item in candidates:
            print(ascii(item["question"]))
