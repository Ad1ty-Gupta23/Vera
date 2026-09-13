import asyncio
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
        self.assertTrue(first["grounded"])
        self.assertTrue(second["grounded"])
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
