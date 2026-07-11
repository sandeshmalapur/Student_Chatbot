"""One-off script to re-embed all notes with the new multilingual embedding model.
Ensure you run this with the virtualenv active from the backend/ directory.
"""
import sys
from database import SessionLocal
from models.note import Note
from models.note_image import NoteImage
from services.rag_service import process_pdf_for_indexing, ensure_collection
from services.storage_service import download_pdf_bytes, upload_image

def main():
    print("Initializing re-indexing of all student notes...")
    
    # 1. First ensure collection is initialized/resized
    try:
        ensure_collection()
    except Exception as exc:
        print(f"Error ensuring/resizing Qdrant collection: {exc}")
        sys.exit(1)
        
    db = SessionLocal()
    try:
        notes = db.query(Note).all()
        if not notes:
            print("No notes found in the database. Re-indexing complete.")
            return
            
        print(f"Found {len(notes)} note(s) to re-index.")
        for idx, note in enumerate(notes, 1):
            print(f"[{idx}/{len(notes)}] Re-indexing note ID {note.id} ('{note.title}')...")
            
            try:
                # Re-download the PDF from Supabase Storage
                print(f"  Downloading PDF file '{note.file_path}'...")
                pdf_bytes = download_pdf_bytes(note.file_path)
                
                # Re-embed text chunks and extract diagrams
                print(f"  Processing PDF bytes and updating Qdrant vectors...")
                chunks_indexed, images_by_page = process_pdf_for_indexing(note.id, note.owner_id, pdf_bytes)
                
                # Persist new diagrams
                print(f"  Persisting {len(images_by_page)} page(s) of diagrams to storage and DB...")
                for page_number, images in images_by_page.items():
                    for image_index, image_bytes in enumerate(images):
                        storage_path = upload_image(note.owner_id, note.id, page_number, image_index, image_bytes)
                        db.add(NoteImage(note_id=note.id, page_number=page_number, storage_path=storage_path))
                
                # Update status
                note.is_indexed = chunks_indexed > 0
                db.commit()
                print(f"  Note ID {note.id} re-indexed successfully (indexed {chunks_indexed} chunks).")
            except Exception as e:
                db.rollback()
                print(f"  ERROR re-indexing note ID {note.id}: {e}")
                
    finally:
        db.close()
    
    print("\nRe-indexing completed.")

if __name__ == "__main__":
    main()
