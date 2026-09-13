"""
Stage 6 — actually sending an email through Gmail, once we have a valid
access token (see app/services/gmail_oauth.py:get_valid_access_token).

Uses the Gmail REST API directly over httpx (already a dependency) rather
than adding google-api-python-client — the whole feature only needs one
endpoint (users.messages.send), so a full client library would be an
unnecessary dependency per the "don't introduce libraries you don't need"
project rule.
"""
from __future__ import annotations

import base64
import logging
from email.message import EmailMessage

import httpx

logger = logging.getLogger(__name__)

_GMAIL_SEND_ENDPOINT = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"


class GmailSendError(Exception):
    """Raised when Gmail's API rejects the send. Message is safe to show
    the business owner (no tokens/internals in it)."""


async def send_email(*, access_token: str, to: str, subject: str, body: str) -> str:
    """
    Sends a plain-text email. The "From" address is implicitly the
    authenticated Gmail account (Gmail's API always sends as the
    authorized user — this can't be overridden to spoof the business's
    helpdesk address as the sender, which is intentional; see Stage 6
    section 11 of the brief).

    Returns the Gmail message id on success. Raises GmailSendError on
    failure with a message safe to surface to the business owner.
    """
    message = EmailMessage()
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)

    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            _GMAIL_SEND_ENDPOINT,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
            json={"raw": raw},
        )

    if resp.status_code != 200:
        logger.error("[gmail_send] send failed status=%s body=%s", resp.status_code, resp.text)
        detail = "Gmail rejected the send request."
        try:
            payload = resp.json()
            detail = payload.get("error", {}).get("message", detail)
        except ValueError:
            pass
        raise GmailSendError(detail)

    data = resp.json()
    message_id = data.get("id", "")
    logger.info("[gmail_send] sent to=%s gmail_message_id=%s", to, message_id)
    return message_id
