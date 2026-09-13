from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    assemblyai_api_key: str = ""
    # Optional sponsor-native runtime for business voice conversations. When
    # disabled (or unavailable), the frontend keeps using VERA's established
    # Universal Streaming STT + browser TTS path unchanged.
    assemblyai_voice_agent_enabled: bool = True
    assemblyai_voice_agent_voice: str = "alba"
    assemblyai_voice_agent_token_ttl_seconds: int = 120
    assemblyai_voice_agent_max_session_seconds: int = 900
    groq_api_key: str = ""
    google_places_api_key: str = ""
    # llama-3.3-70b-versatile was decommissioned by Groq on 08/16/26.
    # openai/gpt-oss-120b is their recommended replacement (also supports
    # json_object response_format, which classify_intent() relies on).
    groq_model: str = "openai/gpt-oss-120b"
    agent_confidence_threshold: float = 0.65
    default_search_radius_meters: int = 5000
    max_search_radius_meters: int = 25000

    # --- SaaS expansion: auth + persistence (Stage 2) ---
    database_url: str = "sqlite:///./vera.db"
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/auth/google/callback"
    # Signs the session cookie's JWT. MUST be overridden in .env for any
    # real deployment — this default is only so local dev doesn't crash
    # with an empty secret.
    session_secret_key: str = "dev-only-insecure-secret-change-me"
    session_cookie_name: str = "vera_session"
    session_max_age_seconds: int = 60 * 60 * 24 * 14  # 14 days
    # Where the browser is sent after a successful Google login.
    frontend_url: str = "http://localhost:5173"

    # --- SaaS expansion: business knowledge base / RAG (Stage 4) ---
    # Chroma persists to disk here so embeddings survive backend restarts.
    chroma_persist_dir: str = "./chroma_data"
    # Local, free embedding model — avoids needing a second paid API key
    # just for embeddings (Groq's API here is chat-completions only). First
    # run downloads the model from Hugging Face, so the host needs outbound
    # internet access once; after that it's cached and fully offline.
    kb_embedding_model: str = "all-MiniLM-L6-v2"
    kb_max_file_size_mb: int = 15
    kb_chunk_size_chars: int = 1200
    kb_chunk_overlap_chars: int = 200
    kb_retrieval_top_k: int = 4
    # Chroma similarity distance (cosine) above which a "match" is treated
    # as not actually relevant — keeps the assistant from answering off a
    # barely-related chunk instead of admitting it doesn't know.
    kb_max_relevant_distance: float = 0.8

    # --- SaaS expansion: Gmail integration / issue-report workflow (Stage 6) ---
    # Deliberately a *separate* OAuth client registration from
    # app.auth.oauth (login) even though it reuses the same Google Cloud
    # project credentials — login only ever requests "openid email
    # profile" and must never accidentally end up holding a Gmail-send
    # grant, and vice versa. See app/services/gmail_oauth.py.
    google_gmail_redirect_uri: str = "http://localhost:8000/api/gmail/callback"
    gmail_send_scope: str = "https://www.googleapis.com/auth/gmail.send"
    # Fernet key (urlsafe-base64, 32 bytes) used to encrypt the Gmail
    # refresh token at rest. MUST be overridden in .env for any real
    # deployment. Generate with:
    #   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    token_encryption_key: str = ""
    # Issue-report intent classification + field extraction use the same
    # Groq model as the rest of the app (settings.groq_model) — no
    # separate model setting needed.
    incident_confidence_threshold: float = 0.6

    # --- SaaS expansion: website embed widget (Stage 7) ---
    # Base URL customers' browsers use to reach this backend from a
    # *third-party* website (unlike frontend_url above, which is only ever
    # used server-side for redirecting our own logged-in dashboard).
    # MUST be a real publicly-reachable HTTPS URL in production — embed
    # snippets are generated from this value.
    backend_public_url: str = "http://localhost:8000"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
