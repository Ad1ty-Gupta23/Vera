"""
Symmetric encryption for secrets we must persist but never expose — right
now that's exactly one thing: the Gmail refresh token in
GmailConnection.refresh_token_encrypted (app/models/gmail_connection.py).

Uses Fernet (AES-128-CBC + HMAC via the `cryptography` package). That
package isn't a new dependency — it's already pulled in transitively by
`python-jose[cryptography]` (requirements.txt, Stage 2's session JWTs), so
Stage 6 adds zero new backend packages for this.

settings.token_encryption_key must be a urlsafe-base64 32-byte Fernet key.
Generate one with:
    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
"""
from __future__ import annotations

import logging

from cryptography.fernet import Fernet, InvalidToken

from app.config.settings import settings

logger = logging.getLogger(__name__)

_fernet: Fernet | None = None


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        if not settings.token_encryption_key:
            raise RuntimeError(
                "TOKEN_ENCRYPTION_KEY is not configured — required to store Gmail "
                "tokens securely. Generate one with: python -c \"from cryptography."
                "fernet import Fernet; print(Fernet.generate_key().decode())\""
            )
        try:
            _fernet = Fernet(settings.token_encryption_key.encode())
        except (ValueError, TypeError) as exc:
            raise RuntimeError(
                "TOKEN_ENCRYPTION_KEY is not a valid Fernet key. Generate one with: "
                'python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"'
            ) from exc
    return _fernet


def encrypt_secret(plaintext: str) -> str:
    return _get_fernet().encrypt(plaintext.encode()).decode()


def decrypt_secret(ciphertext: str) -> str | None:
    """Returns None (instead of raising) on a bad/rotated key so callers can
    surface a clean 'reconnect Gmail' state instead of a 500."""
    try:
        return _get_fernet().decrypt(ciphertext.encode()).decode()
    except (InvalidToken, ValueError) as exc:
        logger.error("[crypto] failed to decrypt stored secret: %s", exc)
        return None
