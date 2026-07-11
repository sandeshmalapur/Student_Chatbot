"""Public, no-login endpoints for read-only shared notes.
Authorization here is 'possession of a valid token in the URL' — same model as
a Google Docs share link — deliberately NOT behind get_current_user."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from database import get_db
from schemas.chat import MessageOut
from schemas.shared import SharedMessageCreate, SharedNoteInfo
from services.rag_service import generate_answer_with_images
from services.sharing_service import check_rate_limit, get_active_link

router = APIRouter(prefix="/shared", tags=["shared"])


def _get_valid_link(db: Session, token: str):
    link = get_active_link(db, token)
    if not link:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="This share link is invalid or has been revoked")
    return link


@router.get("/{token}", response_model=SharedNoteInfo)
def get_shared_note(token: str, db: Session = Depends(get_db)):
    link = _get_valid_link(db, token)
    return SharedNoteInfo(
        note_title=link.session.note.title,
        is_active=link.is_active,
        messages=link.session.messages,
    )


@router.post("/{token}/messages", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
def send_shared_message(
    token: str,
    payload: SharedMessageCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    link = _get_valid_link(db, token)

    client_ip = request.client.host if request.client else "unknown"
    check_rate_limit(client_ip)

    answer_text, image_urls = generate_answer_with_images(
        payload.content,
        owner_id=link.session.owner_id,
        note_id=link.session.note_id,
        db=db,
    )

    # Shared/anonymous chat is stateless by design (no user account to attach history to);
    # each question is answered independently and nothing is persisted to the messages table.
    return MessageOut(
        id=0,
        role="assistant",
        content=answer_text,
        image_urls=image_urls,
        created_at=datetime.now(timezone.utc),
    )