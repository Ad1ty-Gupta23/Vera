from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.api.routes import router
from app.api.websocket import router as ws_router
from app.api.auth_routes import router as auth_router
from app.api.business_routes import router as business_router
from app.api.knowledge_routes import router as knowledge_router
from app.api.subscription_routes import router as subscription_router
from app.api.assistant_routes import router as assistant_router
from app.api.conversation_routes import router as conversation_router
from app.api.gmail_routes import router as gmail_router
from app.api.incident_routes import router as incident_router
from app.api.embed_routes import router as embed_router
from app.api.public_routes import router as public_router
from app.api.voice_agent_routes import router as voice_agent_router
from app.api.support_routes import router as support_router
from app.config.settings import settings
from app.db.session import init_db

app = FastAPI(title="VERA Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,  # required so the browser sends the auth cookie
    allow_methods=["*"],
    allow_headers=["*"],
)

# NOTE: this is a *different* cookie from our own auth session cookie — it's
# Starlette/Authlib's transient "oauth state" store, alive only for the
# ~seconds between /auth/google and /auth/google/callback. It never holds
# user data or tokens.
app.add_middleware(SessionMiddleware, secret_key=settings.session_secret_key)


class PublicEmbedCORSMiddleware:
    """
    Stage 7 — the embed widget runs on arbitrary third-party business
    websites, so /api/public/* must be reachable cross-origin from
    anywhere. Deliberately separate from the CORSMiddleware above (which
    stays locked to our own frontend origin, since every other route in
    the app relies on a credentialed session cookie): these public routes
    never read that cookie and are scoped entirely by an unguessable
    per-assistant public_id (plus an optional business-configured origin
    allowlist enforced in app.api.public_routes), so opening CORS wide
    here doesn't weaken anything the cookie-based routes rely on.

    Registered last so it's the outermost middleware and can answer an
    OPTIONS preflight for /api/public/* directly, before it would
    otherwise reach the origin-restricted CORSMiddleware above.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or not scope["path"].startswith("/api/public"):
            await self.app(scope, receive, send)
            return

        header_map = dict(scope.get("headers") or [])
        origin = header_map.get(b"origin", b"*")

        if scope["method"] == "OPTIONS":
            await send(
                {
                    "type": "http.response.start",
                    "status": 204,
                    "headers": [
                        (b"access-control-allow-origin", origin),
                        (b"access-control-allow-methods", b"GET, POST, PATCH, OPTIONS"),
                        (b"access-control-allow-headers", b"content-type"),
                        (b"access-control-max-age", b"600"),
                        (b"vary", b"origin"),
                    ],
                }
            )
            await send({"type": "http.response.body", "body": b""})
            return

        async def send_with_cors(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers.append((b"access-control-allow-origin", origin))
                headers.append((b"vary", b"origin"))
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_with_cors)


app.add_middleware(PublicEmbedCORSMiddleware)


@app.on_event("startup")
def on_startup():
    init_db()


app.include_router(router, prefix="/api")
app.include_router(ws_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(business_router, prefix="/api")
app.include_router(knowledge_router, prefix="/api")
app.include_router(subscription_router, prefix="/api")
app.include_router(assistant_router, prefix="/api")
app.include_router(conversation_router, prefix="/api")
app.include_router(gmail_router, prefix="/api")
app.include_router(incident_router, prefix="/api")
app.include_router(embed_router, prefix="/api")
app.include_router(public_router, prefix="/api")
app.include_router(voice_agent_router, prefix="/api")
app.include_router(support_router, prefix="/api")
