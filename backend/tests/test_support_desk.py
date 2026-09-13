import asyncio
import unittest
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.session import Base
from app.models import (  # noqa: F401 - register all foreign-key targets
    assistant,
    business,
    conversation,
    gmail_connection,
    incident,
    knowledge,
    subscription,
    support,
    user,
)
from app.models.business import Business
from app.models.conversation import Conversation, ConversationMessage
from app.models.incident import Incident
from app.models.support import HumanHandoff, SupportTicket, VoiceCall
from app.services import business_chat, call_operations, issue_workflow, support_desk


class SupportDeskTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite:///:memory:", connect_args={"check_same_thread": False}
        )
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()
        self.business = Business(
            owner_user_id=1,
            name="NovaNest",
            helpdesk_email="support@novanest.example",
        )
        self.db.add(self.business)
        self.db.commit()
        self.db.refresh(self.business)
        self.conversation = Conversation(
            business_id=self.business.id,
            session_id="widget:demo-session",
        )
        self.db.add(self.conversation)
        self.db.commit()
        self.db.refresh(self.conversation)

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def make_incident(self) -> Incident:
        row = Incident(
            business_id=self.business.id,
            conversation_id=self.conversation.id,
            status=Incident.STATUS_READY_FOR_REVIEW,
            customer_name="Maya Rao",
            customer_email="maya@example.com",
            order_reference="NN-1043",
            issue_description="My order arrived damaged and I need a replacement.",
            email_to=self.business.helpdesk_email,
            email_subject="Damaged order",
            email_body="Please review the damaged order.",
        )
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return row

    def test_confirmed_incident_creates_idempotent_audited_ticket(self):
        incident_row = self.make_incident()
        ticket = support_desk.create_ticket_from_incident(
            self.db,
            self.business,
            incident_row,
            channel="voice",
            assemblyai_session_id="sess_voice_123",
        )

        self.assertTrue(ticket.ticket_number.startswith(f"VERA-{self.business.id}-"))
        self.assertEqual(ticket.status, SupportTicket.STATUS_OPEN)
        self.assertEqual(ticket.priority, SupportTicket.PRIORITY_HIGH)
        self.assertEqual(ticket.category, "order")
        self.assertEqual(ticket.assemblyai_session_id, "sess_voice_123")
        self.assertEqual(ticket.events[0].event_type, "created")
        self.db.refresh(incident_row)
        self.assertEqual(incident_row.status, Incident.STATUS_TICKET_CREATED)

        repeated = support_desk.create_ticket_from_incident(
            self.db, self.business, incident_row, channel="voice"
        )
        self.assertEqual(repeated.id, ticket.id)
        self.assertEqual(self.db.query(SupportTicket).count(), 1)

    def test_ticket_status_updates_create_an_audit_event(self):
        ticket = support_desk.create_ticket_from_incident(
            self.db, self.business, self.make_incident()
        )
        updated = support_desk.update_ticket(
            self.db,
            ticket,
            status=SupportTicket.STATUS_IN_PROGRESS,
            assigned_to="Demo support team",
        )

        self.assertEqual(updated.status, SupportTicket.STATUS_IN_PROGRESS)
        self.assertEqual(updated.assigned_to, "Demo support team")
        status_event = next(
            event for event in updated.events if event.event_type == "status_changed"
        )
        self.assertEqual(status_event.from_status, SupportTicket.STATUS_OPEN)
        self.assertEqual(status_event.to_status, SupportTicket.STATUS_IN_PROGRESS)
        self.assertTrue(
            any(event.event_type == "assignment_changed" for event in updated.events)
        )

    def test_demo_orders_are_repeatable_and_tenant_scoped(self):
        first = support_desk.seed_demo_orders(self.db, self.business)
        second = support_desk.seed_demo_orders(self.db, self.business)
        self.assertEqual(len(first), 3)
        self.assertEqual(len(second), 3)

        lookup = support_desk.maybe_lookup_order(
            self.db, self.business, "Where is order NN-1042?"
        )
        self.assertTrue(support_desk.is_order_lookup_request("Where is order NN-1042?"))
        self.assertFalse(support_desk.is_order_lookup_request("Order NN-1042 arrived damaged"))
        self.assertIn("in transit", lookup["answer"])
        self.assertEqual(lookup["order"]["order_number"], "NN-1042")

        other_business = Business(
            owner_user_id=2,
            name="Other Store",
            helpdesk_email="support@other.example",
        )
        self.db.add(other_business)
        self.db.commit()
        self.db.refresh(other_business)
        missing = support_desk.maybe_lookup_order(
            self.db, other_business, "Where is order NN-1042?"
        )
        self.assertIsNone(missing["order"])

    def test_explicit_tracking_question_bypasses_issue_detection(self):
        support_desk.seed_demo_orders(self.db, self.business)
        with patch("app.services.business_chat.issue_workflow.maybe_handle_turn") as detector:
            result = asyncio.run(
                business_chat.send_message(
                    self.db,
                    self.business,
                    "order-demo",
                    "Where is order NN-1042?",
                )
            )

        detector.assert_not_called()
        self.assertTrue(result["grounded"])
        self.assertEqual(result["order"]["order_number"], "NN-1042")
        self.assertIn("Order NN-1042 is in transit", result["answer"])

    def test_general_business_actions_are_classified(self):
        examples = [
            ("Book a dental appointment next Tuesday", "appointment", "schedule"),
            ("Reserve a table for four people", "reservation", "reservation"),
            ("I would like a software product demo", "lead", "follow up"),
            ("I would like a quote and consultation", "lead", "follow up"),
            ("Please call me about your services", "general", "Contact"),
        ]
        for request, expected_category, expected_action in examples:
            with self.subTest(request=request):
                category, _priority, action = support_desk._classify_issue(request)
                self.assertEqual(category, expected_category)
                self.assertIn(expected_action.lower(), action.lower())

    def test_action_intent_gate_keeps_questions_out_of_intake(self):
        ordinary_questions = [
            "What is your return window?",
            "What are your opening hours?",
            "Do you offer appointments?",
            "How do I book an appointment?",
            "Which products do you sell?",
            "Can you give me your website URL?",
        ]
        action_requests = [
            "I need to book an appointment.",
            "Can you please book an appointment for me?",
            "Please send me a quote.",
            "My product is broken and not working.",
            "I want to speak with a human agent.",
            "Please call me about a product demo.",
        ]
        for message in ordinary_questions:
            with self.subTest(message=message):
                self.assertFalse(issue_workflow.looks_like_action_request(message))
        for message in action_requests:
            with self.subTest(message=message):
                self.assertTrue(issue_workflow.looks_like_action_request(message))

    def test_voice_call_resolution_and_handoff_operations(self):
        self.db.add(
            ConversationMessage(
                conversation_id=self.conversation.id,
                role="customer",
                content="What are your hours?",
            )
        )
        self.db.commit()
        call = call_operations.record_voice_turn(
            self.db,
            self.business,
            self.conversation.id,
            "sess_resolution_1",
            "What are your hours?",
            {"conversation_id": self.conversation.id, "answer": "Answer:\n9 to 5"},
        )
        self.assertEqual(call.awaiting_resolution, 1)
        self.assertTrue(
            call_operations.resolution_feedback("Yeah, so that's it, right?")
        )
        self.assertFalse(
            call_operations.resolution_feedback("No, it still didn't help")
        )
        result = call_operations.maybe_handle_resolution_feedback(
            self.db,
            self.business,
            self.conversation,
            "Yes, thank you",
            "sess_resolution_1",
        )
        self.assertTrue(result["resolution_feedback"])
        self.db.refresh(call)
        self.assertEqual(call.outcome, "resolved")

        handoff = call_operations.create_handoff(
            self.db,
            self.business,
            self.conversation,
            "I need a human about a billing problem",
            "sess_resolution_1",
        )
        self.assertEqual(handoff.status, HumanHandoff.STATUS_PENDING)
        self.assertEqual(handoff.routing_category, "billing")
        updated = call_operations.update_handoff(
            self.db, handoff, HumanHandoff.STATUS_ACCEPTED
        )
        self.assertEqual(updated.status, HumanHandoff.STATUS_ACCEPTED)
        completed = call_operations.update_handoff(
            self.db, handoff, HumanHandoff.STATUS_COMPLETED
        )
        self.assertEqual(completed.status, HumanHandoff.STATUS_COMPLETED)

        ended = call_operations.finish_call(
            self.db, self.business, "sess_resolution_1", interruptions=2
        )
        self.assertEqual(ended.status, VoiceCall.STATUS_ENDED)
        self.assertEqual(ended.interruptions, 2)

    def test_ticket_creation_rejects_another_business_incident(self):
        incident_row = self.make_incident()
        other_business = Business(
            owner_user_id=2,
            name="Other Store",
            helpdesk_email="support@other.example",
        )
        self.db.add(other_business)
        self.db.commit()
        self.db.refresh(other_business)

        with self.assertRaisesRegex(ValueError, "does not belong"):
            support_desk.create_ticket_from_incident(
                self.db,
                other_business,
                incident_row,
            )


if __name__ == "__main__":
    unittest.main()
