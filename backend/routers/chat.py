from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from core.dependencies import get_current_user
from database import get_db
from models.chat import ChatSession, Message
from models.note import Note
from models.user import User
from schemas.chat import ChatSessionCreate, ChatSessionOut, MessageCreate, MessageOut
from schemas.shared import SharedLinkOut
from services.rag_service import generate_answer_with_images
from services.sharing_service import create_or_get_share_link, revoke_share_link

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/sessions", response_model=ChatSessionOut, status_code=status.HTTP_201_CREATED)
def create_session(
    payload: ChatSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    note = db.query(Note).filter(Note.id == payload.note_id, Note.owner_id == current_user.id).first()
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")

    session = ChatSession(owner_id=current_user.id, note_id=note.id, title=payload.title)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("/sessions", response_model=list[ChatSessionOut])
def list_sessions(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return (
        db.query(ChatSession)
        .filter(ChatSession.owner_id == current_user.id)
        .order_by(ChatSession.created_at.desc())
        .all()
    )


@router.get("/sessions/{session_id}/messages", response_model=list[MessageOut])
def list_messages(session_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    session = _get_owned_session(db, session_id, current_user.id)
    return session.messages


@router.post("/sessions/{session_id}/messages", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
def send_message(
    session_id: int,
    payload: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _get_owned_session(db, session_id, current_user.id)

    user_message = Message(session_id=session.id, role="user", content=payload.content)
    db.add(user_message)
    db.commit()

    answer_text, image_urls = generate_answer_with_images(
        payload.content, owner_id=current_user.id, note_id=session.note_id, db=db
    )

    assistant_message = Message(
        session_id=session.id, role="assistant", content=answer_text, image_urls=image_urls or None
    )
    db.add(assistant_message)
    db.commit()
    db.refresh(assistant_message)

    return assistant_message


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(session_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    session = _get_owned_session(db, session_id, current_user.id)
    db.delete(session)
    db.commit()


def _get_owned_session(db: Session, session_id: int, owner_id: int) -> ChatSession:
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.owner_id == owner_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found")
    return session


@router.post("/sessions/{session_id}/share", response_model=SharedLinkOut)
def share_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    link = create_or_get_share_link(db, session_id=session_id, owner_id=current_user.id)
    return SharedLinkOut(token=link.token, share_path=f"/shared/{link.token}")


@router.delete("/sessions/{session_id}/share", status_code=status.HTTP_204_NO_CONTENT)
def unshare_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    revoke_share_link(db, session_id=session_id, owner_id=current_user.id)