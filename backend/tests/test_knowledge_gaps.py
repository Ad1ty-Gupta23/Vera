import asyncio
import threading
import unittest
from unittest.mock import MagicMock, patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.session import Base
from app.models import (  # noqa: F401 - register every FK target with metadata
    assistant,
    business,
    conversation,
    gmail_connection,
    incident,
    knowledge,
    subscription,
    user,
)
from app.models.business import Business
from app.models.knowledge import KnowledgeGap
from app.services import business_chat, knowledge_gaps


class KnowledgeGapTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite:///:memory:", connect_args={"check_same_thread": False}
        )
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def make_business(self) -> Business:
        row = Business(
            owner_user_id=1,
            name="NovaNest",
            description="An electronics store",
            helpdesk_email="support@example.com",
            working_hours="Monday to Saturday, 9 AM to 7 PM",
        )
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return row

    def test_question_normalization_and_capture_filter(self):
        self.assertEqual(
            knowledge_gaps.normalize_question("  Do you SHIP internationally?! "),
            "do you ship internationally",
        )
        self.assertTrue(knowledge_gaps.should_capture("Do you ship internationally?"))
        self.assertFalse(knowledge_gaps.should_capture("hello"))

    def test_unknown_question_is_observed_without_changing_chat(self):
        business_row = self.make_business()
        response = MagicMock()
        response.choices[0].message.content = "I don't have that information yet."
        with (
            patch("app.services.business_chat.issue_workflow.maybe_handle_turn", return_value=None),
            patch("app.services.business_chat.vector_store.query", return_value=[]),
            patch("app.services.business_chat.get_client") as get_client,
        ):
            get_client.return_value.chat.completions.create.return_value = response
            first = asyncio.run(
                business_chat.send_message(
                    self.db, business_row, "widget:first", "Do you ship internationally?"
                )
            )
            second = asyncio.run(
                business_chat.send_message(
                    self.db, business_row, "widget:second", "Do you ship internationally?"
                )
            )

        # The established response path still runs; gap capture is additive.
        self.assertFalse(first["grounded"])
        self.assertFalse(second["grounded"])
        self.assertIn("don't have that information", first["answer"])
        self.assertEqual(get_client.return_value.chat.completions.create.call_count, 2)
        gaps = self.db.query(KnowledgeGap).all()
        self.assertEqual(len(gaps), 1)
        self.assertEqual(gaps[0].occurrence_count, 2)
        self.assertEqual(gaps[0].status, KnowledgeGap.STATUS_OPEN)

    def test_profile_topic_is_not_recorded_as_a_gap(self):
        business_row = self.make_business()
        self.assertTrue(business_chat._profile_can_answer(business_row, "When are you open?"))
        self.assertFalse(
            business_chat._profile_can_answer(business_row, "Do you ship internationally?")
        )

    def test_related_chunks_do_not_hide_unanswered_questions(self):
        business_row = self.make_business()
        replies = [
            "I don\u2019t have information about a student discount for NovaNest.",
            "The available information does not specify whether we offer gift wrapping.",
            '{"answer":"Please contact us about installation; it is not verified.","knowledge_missing":true}',
        ]
        questions = ["Do you offer student discounts?", "Do you offer gift wrapping?", "Do you offer installation?"]
        with (
            patch.object(business_chat.issue_workflow, "maybe_handle_turn", return_value=None),
            patch.object(business_chat.vector_store, "query", return_value=[{
                "text": "Returns within 30 days", "distance": 0.1, "filename": "policy.txt",
            }]),
            patch.object(business_chat, "get_client") as client,
        ):
            for index, (question, answer) in enumerate(zip(questions, replies)):
                client.return_value.chat.completions.create.return_value.choices[0].message.content = answer
                result = asyncio.run(business_chat.send_message(
                    self.db, business_row, f"widget:unknown-{index}", question, channel="voice",
                ))
                self.assertFalse(result["grounded"])
                self.assertFalse(result["answer"].startswith('Answer:\n{'))
        self.assertEqual(self.db.query(KnowledgeGap).count(), 3)

    def test_supported_json_answer_does_not_create_gap(self):
        business_row = self.make_business()
        with (
            patch.object(business_chat.issue_workflow, "maybe_handle_turn", return_value=None),
            patch.object(business_chat.vector_store, "query", return_value=[]),
            patch.object(business_chat, "get_client") as client,
        ):
            client.return_value.chat.completions.create.return_value.choices[0].message.content = (
                '{"answer":"We are open Monday to Saturday, 9 AM to 7 PM.","knowledge_missing":false}'
            )
            result = asyncio.run(business_chat.send_message(
                self.db, business_row, "widget:hours", "When are you open?",
            ))
        self.assertTrue(result["grounded"])
        self.assertEqual(self.db.query(KnowledgeGap).count(), 0)

    def test_recovery_is_tenant_scoped_idempotent_and_preserves_dismissals(self):
        from scripts.recover_knowledge_gaps import recover
        from app.models.conversation import Conversation, ConversationMessage
        business_row = self.make_business()
        thread = Conversation(business_id=business_row.id, session_id="widget:recovery")
        self.db.add(thread)
        self.db.flush()
        for question in ("Do you offer student discounts?", "Do you gift wrap?"):
            self.db.add(ConversationMessage(conversation_id=thread.id, role="customer", content=question))
            self.db.add(ConversationMessage(conversation_id=thread.id, role="assistant", content="I don't have that information."))
        gap = knowledge_gaps.record_gap(self.db, business_id=business_row.id,
            conversation_id=thread.id, question="Do you gift wrap?")
        gap.status = KnowledgeGap.STATUS_DISMISSED
        self.db.commit()
        self.assertEqual(recover(self.db, 9999), [])
        self.assertEqual(len(recover(self.db, business_row.id)), 1)
        self.assertEqual(self.db.query(KnowledgeGap).count(), 1)
        self.assertEqual(len(recover(self.db, business_row.id, apply=True)), 1)
        self.assertEqual(recover(self.db, business_row.id, apply=True), [])
        self.assertEqual(gap.status, KnowledgeGap.STATUS_DISMISSED)

    def test_business_chat_retrieval_and_model_run_off_event_loop(self):
        business_row = self.make_business()
        loop_thread = threading.get_ident()
        response = MagicMock()
        response.choices[0].message.content = "Returns are accepted within 30 days."

        def retrieve(**kwargs):
            self.assertNotEqual(threading.get_ident(), loop_thread)
            self.assertEqual(kwargs["business_id"], business_row.id)
            return [{
                "text": "Returns are accepted within 30 days.", "document_id": 42,
                "filename": "policy.txt", "distance": 0.1,
            }]

        def complete(**kwargs):
            self.assertNotEqual(threading.get_ident(), loop_thread)
            return response

        with (
            patch.object(business_chat.issue_workflow, "maybe_handle_turn", return_value=None),
            patch.object(business_chat.vector_store, "query", side_effect=retrieve) as query,
            patch.object(business_chat, "get_client") as client,
        ):
            client.return_value.chat.completions.create.side_effect = complete
            result = asyncio.run(business_chat.send_message(
                self.db, business_row, "widget:thread-check", "What is your return policy?"
            ))
        query.assert_called_once()
        client.return_value.chat.completions.create.assert_called_once()
        self.assertTrue(result["grounded"])
        self.assertEqual(result["sources"], ["policy.txt"])
        self.assertIn("30 days", result["answer"])

    def test_retrieval_question_carries_context_into_follow_up(self):
        history = [
            {"role": "user", "content": "What is the return window for a phone?"},
            {"role": "assistant", "content": "Answer:\nThe return window is 30 days."},
        ]
        contextual = business_chat._retrieval_question("What about a damaged one?", history)
        standalone = business_chat._retrieval_question(
            "What is your international shipping policy?", history
        )
        short_standalone = business_chat._retrieval_question(
            "Do you ship internationally?", history
        )

        self.assertIn("return window for a phone", contextual)
        self.assertIn("Follow-up: What about a damaged one?", contextual)
        self.assertEqual(standalone, "What is your international shipping policy?")
        self.assertEqual(short_standalone, "Do you ship internationally?")

    def test_all_generated_answers_receive_the_response_structure(self):
        self.assertEqual(
            business_chat.structure_answer("We are open until 7 PM."),
            "Answer:\nWe are open until 7 PM.",
        )
        self.assertEqual(
            business_chat.structure_answer("Website:\nhttps://novanest.example"),
            "Website:\nhttps://novanest.example",
        )
        self.assertEqual(
            business_chat.structure_answer("Answer: We are open until 7 PM."),
            "Answer:\nWe are open until 7 PM.",
        )

    def test_explicit_website_request_returns_exact_clickable_url_without_llm(self):
        business_row = self.make_business()
        business_row.website = "novanest.example"
        self.db.add(business_row)
        self.db.commit()
        self.assertIsNone(
            business_chat._direct_website_answer(
                business_row, "I need to report an issue with your website"
            )
        )

        with (
            patch(
                "app.services.business_chat.issue_workflow.maybe_handle_turn", return_value=None
            ) as issue_handler,
            patch("app.services.business_chat.vector_store.query") as query,
            patch("app.services.business_chat.get_client") as get_client,
        ):
            result = asyncio.run(
                business_chat.send_message(
                    self.db, business_row, "widget:url", "What is your website URL?"
                )
            )

        self.assertEqual(result["answer"], "Website:\nhttps://novanest.example")
        self.assertTrue(result["grounded"])
        issue_handler.assert_not_called()
        query.assert_not_called()
        get_client.assert_not_called()

    def test_approved_answer_is_indexed_and_gap_is_resolved(self):
        business_row = self.make_business()
        gap = KnowledgeGap(
            business_id=business_row.id,
            question="Do you ship internationally?",
            normalized_question="do you ship internationally",
        )
        self.db.add(gap)
        self.db.commit()
        self.db.refresh(gap)

        document = MagicMock(status="ready", id=42)
        with patch(
            "app.services.knowledge_base.process_upload", return_value=document
        ) as process_upload:
            resolved = knowledge_gaps.resolve_gap(
                self.db, gap, "We currently deliver only within India."
            )

        self.assertEqual(resolved.status, KnowledgeGap.STATUS_RESOLVED)
        self.assertEqual(resolved.source_document_id, 42)
        self.assertEqual(resolved.approved_answer, "We currently deliver only within India.")
        indexed_content = process_upload.call_args.kwargs["content"].decode("utf-8")
        self.assertIn("Question: Do you ship internationally?", indexed_content)
        self.assertIn("Answer: We currently deliver only within India.", indexed_content)


if __name__ == "__main__":
    unittest.main()
