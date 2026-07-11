from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from core.dependencies import get_current_user
from database import SessionLocal, get_db
from models.note import Note
from models.note_image import NoteImage
from models.user import User
from schemas.note import NoteOut
from services.rag_service import delete_note_vectors, process_pdf_for_indexing
from services.storage_service import delete_note_images, delete_pdf, download_pdf_bytes, upload_image, upload_pdf

router = APIRouter(prefix="/notes", tags=["notes"])


def _index_note_background(note_id: int, owner_id: int, pdf_bytes: bytes) -> None:
    # Background tasks run after the request-scoped DB session has closed,
    # so a fresh session is opened here rather than reusing the request's Depends(get_db).
    chunks_indexed, images_by_page = process_pdf_for_indexing(note_id, owner_id, pdf_bytes)

    db = SessionLocal()
    try:
        # Persist extracted diagrams: upload each to Storage, then record it in note_images.
        for page_number, images in images_by_page.items():
            for image_index, image_bytes in enumerate(images):
                storage_path = upload_image(owner_id, note_id, page_number, image_index, image_bytes)
                db.add(NoteImage(note_id=note_id, page_number=page_number, storage_path=storage_path))

        note = db.query(Note).filter(Note.id == note_id).first()
        if note:
            note.is_indexed = chunks_indexed > 0
        db.commit()
    finally:
        db.close()


@router.post("", response_model=NoteOut, status_code=status.HTTP_201_CREATED)
async def upload_note(
    background_tasks: BackgroundTasks,
    file: UploadFile,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    storage_path, original_filename = await upload_pdf(current_user.id, file)

    note = Note(
        owner_id=current_user.id,
        title=original_filename.rsplit(".", 1)[0],
        file_path=storage_path,
        original_filename=original_filename,
        is_indexed=False,
    )
    db.add(note)
    db.commit()
    db.refresh(note)

    pdf_bytes = download_pdf_bytes(storage_path)
    background_tasks.add_task(_index_note_background, note.id, current_user.id, pdf_bytes)

    return note


@router.get("", response_model=list[NoteOut])
def list_notes(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Note).filter(Note.owner_id == current_user.id).order_by(Note.created_at.desc()).all()


@router.get("/{note_id}", response_model=NoteOut)
def get_note(note_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    note = db.query(Note).filter(Note.id == note_id, Note.owner_id == current_user.id).first()
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    return note


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(note_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    note = db.query(Note).filter(Note.id == note_id, Note.owner_id == current_user.id).first()
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")

    note_images = db.query(NoteImage).filter(NoteImage.note_id == note.id).all()
    delete_note_images([img.storage_path for img in note_images])

    delete_pdf(note.file_path)
    delete_note_vectors(note.id)
    db.delete(note)  # cascades to note_images rows, chat_sessions, messages, shared_links
    db.commit()