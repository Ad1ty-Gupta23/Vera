"""Offline regressions: slow KB work must not stall unrelated HTTP requests."""
import asyncio
import datetime
import threading
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import httpx
from fastapi import Depends, FastAPI, HTTPException, UploadFile
from fastapi.responses import Response
from groq import APIConnectionError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api import knowledge_routes
from app.config.settings import settings
from app.db.session import Base
from app.models.business import Business
from app.models.knowledge import KnowledgeDocument
from app.models.user import User
from app.services import knowledge_base


class BlockingOperation:
    """Hold a worker until the test has served other requests on the same loop."""

    def __init__(self, result):
        self.result = result
        self.loop = asyncio.get_running_loop()
        self.loop_thread = threading.get_ident()
        self.started = asyncio.Event()
        self.release = threading.Event()

    def __call__(self, *args, **kwargs):
        self.loop.call_soon_threadsafe(self.started.set)
        if threading.get_ident() == self.loop_thread:
            raise AssertionError("Blocking work ran on the event-loop thread")
        if not self.release.wait(timeout=5):
            raise AssertionError("Test did not release the worker")
        return self.result


class KnowledgeResponsivenessTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        # A small ASGI app avoids production startup, real DBs, model downloads
        # and external API calls while exercising FastAPI's route dispatch.
        self.app = FastAPI()
        self.app.include_router(knowledge_routes.router, prefix="/api")
        self.business = SimpleNamespace(id=7, name="Demo Store")
        self.db = MagicMock()
        self.app.dependency_overrides[knowledge_routes.get_owned_business] = (
            lambda: self.business
        )
        self.app.dependency_overrides[knowledge_routes.get_db] = lambda: self.db

        @self.app.get("/api/health")
        def health():
            return {"status": "ok"}

        @self.app.get("/assets/probe.css")
        async def asset():
            return Response("body { color: black; }", media_type="text/css")

        self.client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=self.app), base_url="http://test"
        )
        self.addAsyncCleanup(self.client.aclose)
        self.base = "/api/businesses/7/knowledge-base"
        self.document = SimpleNamespace(
            id=42, filename="policy.txt", file_type="txt", file_size_bytes=6,
            status="ready", error_message=None, char_count=6, chunk_count=1,
            created_at=datetime.datetime(2026, 1, 1),
        )
        self.chunks = [{
            "text": "Returns are accepted within 30 days.",
            "document_id": 42, "filename": "policy.txt", "distance": 0.1,
        }]
        self.completion = SimpleNamespace(choices=[SimpleNamespace(
            message=SimpleNamespace(content="Returns are accepted within 30 days.")
        )])

    async def assert_other_requests_respond(self, operation, request):
        pending = asyncio.create_task(request)
        try:
            await asyncio.wait_for(operation.started.wait(), timeout=2)
            health, asset = await asyncio.wait_for(
                asyncio.gather(
                    self.client.get("/api/health"),
                    self.client.get("/assets/probe.css"),
                ),
                timeout=2,
            )
            self.assertEqual(health.status_code, 200)
            self.assertEqual(health.json(), {"status": "ok"})
            self.assertEqual(asset.status_code, 200)
            self.assertTrue(asset.headers["content-type"].startswith("text/css"))
            self.assertFalse(pending.done(), "Slow request completed before release")
        finally:
            operation.release.set()
            response = await asyncio.wait_for(pending, timeout=3)
        return response

    async def test_upload_does_not_stall_health_or_asset_requests(self):
        operation = BlockingOperation(self.document)
        with patch.object(knowledge_base, "process_upload", side_effect=operation) as process:
            response = await self.assert_other_requests_respond(
                operation,
                self.client.post(
                    self.base + "/upload", files={"file": ("policy.txt", b"Policy")}
                ),
            )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["status"], "ready")
        self.assertEqual(response.json()["id"], 42)
        process.assert_called_once_with(
            db=self.db, business_id=7, filename="policy.txt", content=b"Policy"
        )

    async def test_retrieval_does_not_stall_health_or_asset_requests(self):
        operation = BlockingOperation(self.chunks)
        with (
            patch.object(knowledge_base.vector_store, "query", side_effect=operation) as query,
            patch.object(knowledge_base, "get_client") as client,
        ):
            client.return_value.chat.completions.create.return_value = self.completion
            response = await self.assert_other_requests_respond(
                operation,
                self.client.post(self.base + "/query", json={"question": "Return policy?"}),
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["sources"], ["policy.txt"])
        self.assertTrue(response.json()["grounded"])
        query.assert_called_once_with(
            business_id=7, question="Return policy?", top_k=settings.kb_retrieval_top_k
        )

    async def test_upload_processes_text_and_saves_document_in_worker(self):
        engine = create_engine(
            "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
        )
        self.addCleanup(engine.dispose)
        Base.metadata.create_all(
            engine, tables=[User.__table__, Business.__table__, KnowledgeDocument.__table__]
        )
        sessions = sessionmaker(bind=engine)
        with sessions() as db:
            db.add(User(id=1, google_sub="test", email="test@example.com"))
            db.add(Business(
                id=7, owner_user_id=1, name="Demo Store", helpdesk_email="help@example.com"
            ))
            db.commit()

        def get_test_db():
            with sessions() as db:
                yield db

        def get_test_business(db=Depends(knowledge_routes.get_db)):
            return db.get(Business, 7)

        self.app.dependency_overrides[knowledge_routes.get_db] = get_test_db
        self.app.dependency_overrides[knowledge_routes.get_owned_business] = get_test_business
        operation = BlockingOperation(1)
        with patch.object(
            knowledge_base.vector_store, "add_document_chunks", side_effect=operation
        ) as store:
            response = await self.assert_other_requests_respond(
                operation,
                self.client.post(
                    self.base + "/upload", files={"file": ("policy.txt", b"Policy")}
                ),
            )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["status"], "ready")
        with sessions() as db:
            document = db.get(KnowledgeDocument, response.json()["id"])
            self.assertEqual(document.business_id, 7)
            self.assertEqual(document.status, "ready")
            self.assertEqual(document.char_count, 6)
            self.assertEqual(document.chunk_count, 1)
        store.assert_called_once_with(
            business_id=7, document_id=response.json()["id"],
            filename="policy.txt", chunks=["Policy"],
        )

    async def test_model_wait_does_not_stall_health_or_asset_requests(self):
        operation = BlockingOperation(self.completion)
        with (
            patch.object(knowledge_base.vector_store, "query", return_value=self.chunks),
            patch.object(knowledge_base, "get_client") as client,
        ):
            client.return_value.chat.completions.create.side_effect = operation
            response = await self.assert_other_requests_respond(
                operation,
                self.client.post(self.base + "/query", json={"question": "Return policy?"}),
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["answer"], self.completion.choices[0].message.content)

    async def test_invalid_uploads_do_not_start_processing(self):
        cases = [
            ("no-extension", b"text", "extension"),
            ("script.exe", b"text", "Unsupported"),
            ("empty.txt", b"", "empty"),
            ("large.txt", b"x" * (1024 * 1024 + 1), "limit"),
        ]
        with (
            patch.object(settings, "kb_max_file_size_mb", 1),
            patch.object(knowledge_base, "process_upload") as process,
        ):
            for filename, content, message in cases:
                with self.subTest(filename=filename):
                    response = await self.client.post(
                        self.base + "/upload", files={"file": (filename, content)}
                    )
                    self.assertEqual(response.status_code, 400)
                    self.assertIn(message, response.json()["detail"])
            process.assert_not_called()

    async def test_file_at_size_limit_is_accepted(self):
        content = b"x" * (1024 * 1024)
        with (
            patch.object(settings, "kb_max_file_size_mb", 1),
            patch.object(knowledge_base, "process_upload", return_value=self.document) as process,
        ):
            response = await self.client.post(
                self.base + "/upload", files={"file": ("policy.txt", content)}
            )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(process.call_args.kwargs["content"], content)

    async def test_upload_read_is_bounded(self):
        limit = settings.kb_max_file_size_mb * 1024 * 1024
        stream = MagicMock()
        stream.read.return_value = b""
        with self.assertRaises(HTTPException):
            knowledge_routes.upload_document(
                file=UploadFile(file=stream, filename="empty.txt"),
                business=self.business, db=self.db,
            )
        stream.read.assert_called_once_with(limit + 1)

    async def test_failed_processing_status_is_preserved(self):
        self.document.status = "failed"
        self.document.error_message = "No extractable text."
        with patch.object(knowledge_base, "process_upload", return_value=self.document):
            response = await self.client.post(
                self.base + "/upload", files={"file": ("policy.txt", b"Policy")}
            )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["status"], "failed")
        self.assertEqual(response.json()["error_message"], "No extractable text.")

    async def test_ownership_rejection_prevents_processing(self):
        def reject_business():
            raise HTTPException(status_code=404, detail="Business not found")

        self.app.dependency_overrides[knowledge_routes.get_owned_business] = reject_business
        with patch.object(knowledge_base, "process_upload") as process:
            response = await self.client.post(
                self.base + "/upload", files={"file": ("policy.txt", b"Policy")}
            )
        self.assertEqual(response.status_code, 404)
        process.assert_not_called()

    async def test_no_relevant_chunks_does_not_call_model(self):
        with (
            patch.object(knowledge_base.vector_store, "query", return_value=[]),
            patch.object(knowledge_base, "get_client") as client,
        ):
            response = await self.client.post(
                self.base + "/query", json={"question": "Return policy?"}
            )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["grounded"])
        self.assertEqual(response.json()["sources"], [])
        client.assert_not_called()

    async def test_model_error_keeps_existing_error_response(self):
        with (
            patch.object(knowledge_base.vector_store, "query", return_value=self.chunks),
            patch.object(knowledge_base, "get_client") as client,
        ):
            client.return_value.chat.completions.create.side_effect = APIConnectionError(
                request=httpx.Request("POST", "https://example.invalid")
            )
            response = await self.client.post(
                self.base + "/query", json={"question": "Return policy?"}
            )
        self.assertEqual(response.status_code, 502)
        self.assertIn("Couldn't reach the AI model", response.json()["detail"])


if __name__ == "__main__":
    unittest.main()
