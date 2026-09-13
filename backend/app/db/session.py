"""
SQLAlchemy engine + session factory.

SQLite for now (per project decision). Swapping to Postgres later only
means changing `settings.database_url` — nothing else in the app touches
the engine directly, everything goes through `get_db()`.
"""
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config.settings import settings

# check_same_thread=False is required for SQLite + FastAPI's threaded request
# handling; it's a no-op for any other database URL.
connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}

engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency — yields a DB session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create all tables that don't exist yet. Safe to call on every startup."""
    # Import models here (not at module top) so every model module is
    # registered on Base.metadata before create_all runs, without creating
    # a circular import between db/session.py and models/*.py.
    from app.models import (  # noqa: F401
        user,
        business,
        subscription,
        knowledge,
        assistant,
        conversation,
        gmail_connection,
        incident,
        support,
    )

    Base.metadata.create_all(bind=engine)
    _add_missing_columns()


# `create_all` only creates tables that don't exist yet — it never alters an
# existing table, so a schema change to a model that already shipped (like
# Stage 7 adding embed columns to assistant_configs) would silently no-op on
# an existing dev database. SQLite supports simple `ADD COLUMN`, so this
# does a best-effort catch-up on startup rather than requiring a real
# migration tool for what is, so far, only ever additive/nullable columns.
_TABLE_COLUMNS_TO_BACKFILL = {
    "assistant_configs": {
        "public_id": "VARCHAR",
        "widget_position": "VARCHAR DEFAULT 'bottom-right'",
        "allowed_origins": "TEXT",
        "embed_enabled": "INTEGER DEFAULT 1",
    },
}


def _add_missing_columns() -> None:
    if not settings.database_url.startswith("sqlite"):
        # Non-SQLite deployments should use a real migration tool instead —
        # this shortcut is only safe for the SQLite dev/default setup.
        return
    inspector = inspect(engine)
    with engine.begin() as conn:
        for table, columns in _TABLE_COLUMNS_TO_BACKFILL.items():
            if table not in inspector.get_table_names():
                continue
            existing = {c["name"] for c in inspector.get_columns(table)}
            for column, ddl_type in columns.items():
                if column in existing:
                    continue
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl_type}"))
        # Best-effort — a fresh DB gets this as a real UNIQUE index via
        # create_all already; this only matters for a pre-Stage-7 DB where
        # the column above was just backfilled and has no index yet.
        conn.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS ix_assistant_configs_public_id "
                "ON assistant_configs (public_id)"
            )
        )
