"""Read-only share-link management: create/revoke/lookup, plus a tiny in-memory
rate limiter for the public (no-login) shared chat endpoint."""
import secrets
import time
from collections import defaultdict

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from models.note import Note
from models.shared_link import SharedLink

RATE_LIMIT_MAX_REQUESTS = 10
RATE_LIMIT_WINDOW_SECONDS = 60

_rate_limit_state: dict[str, list[float]] = defaultdict(list)


def check_rate_limit(client_ip: str) -> None:
    """Basic per-IP limiter for public endpoints, to stop link-holders from
    hammering the Groq API / DB. In-memory only — fine for a single-instance
    college deployment; would need Redis for a multi-instance deployment."""
    now = time.time()
    timestamps = _rate_limit_state[client_ip]
    timestamps[:] = [t for t in timestamps if now - t < RATE_LIMIT_WINDOW_SECONDS]
    if len(timestamps) >= RATE_LIMIT_MAX_REQUESTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests on this shared link. Please wait a minute and try again.",
        )
    timestamps.append(now)


def create_or_get_share_link(db: Session, session_id: int, owner_id: int) -> SharedLink:
    from models.chat import ChatSession
    # Verify ownership
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.owner_id == owner_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found")

    existing = (
        db.query(SharedLink)
        .filter(SharedLink.session_id == session_id, SharedLink.is_active.is_(True))
        .first()
    )
    if existing:
        return existing

    link = SharedLink(session_id=session_id, token=secrets.token_urlsafe(16))
    db.add(link)
    db.commit()
    db.refresh(link)
    return link


def revoke_share_link(db: Session, session_id: int, owner_id: int) -> None:
    from models.chat import ChatSession
    # Verify ownership
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.owner_id == owner_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found")

    db.query(SharedLink).filter(SharedLink.session_id == session_id).update({"is_active": False})
    db.commit()


def get_active_link(db: Session, token: str) -> SharedLink | None:
    return db.query(SharedLink).filter(SharedLink.token == token, SharedLink.is_active.is_(True)).first()