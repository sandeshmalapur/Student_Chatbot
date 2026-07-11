"""
One-off cleanup script: deletes existing extracted diagram images (Supabase Storage
files + note_images DB rows) so you can re-index notes with the fixed extraction
logic and get clean diagrams, with no leftover black-box/watermark images lying
around from before the fix.

Does NOT touch: the PDF file itself, the note record, or the Qdrant text vectors.
Only note_images rows + their storage files are removed.

USAGE (run from the backend/ directory, with your venv active):

    # Wipe images for ALL notes
    python cleanup_note_images.py

    # Wipe images for a single note only
    python cleanup_note_images.py --note-id 7

    # Preview what would be deleted without actually deleting anything
    python cleanup_note_images.py --dry-run
    python cleanup_note_images.py --note-id 7 --dry-run

After running this, re-upload (or trigger a re-index of) the affected note(s)
so process_pdf_for_indexing() runs again with the fixed extract_images_by_page()
and repopulates note_images with clean diagrams.
"""
import argparse
import sys

# NOTE: adjust this import if your project's DB session lives somewhere else.
# Common alternatives: `from core.db import SessionLocal`, `from db.session import SessionLocal`,
# `from database import SessionLocal`. Check how your routers/*.py files import it
# and match that here.
from database import SessionLocal

from models.note_image import NoteImage
from services.storage_service import delete_note_images


def cleanup(note_id: int | None, dry_run: bool) -> None:
    db = SessionLocal()
    try:
        query = db.query(NoteImage)
        if note_id is not None:
            query = query.filter(NoteImage.note_id == note_id)

        images = query.all()

        if not images:
            scope = f"note_id={note_id}" if note_id is not None else "all notes"
            print(f"No note_images rows found for {scope}. Nothing to clean up.")
            return

        storage_paths = [img.storage_path for img in images]

        print(f"Found {len(images)} image(s) to remove:")
        for img in images:
            print(f"  - note_id={img.note_id} page={img.page_number} path={img.storage_path}")

        if dry_run:
            print("\nDry run: no files or rows were actually deleted.")
            return

        # 1. Delete the actual files from Supabase Storage first.
        delete_note_images(storage_paths)
        print(f"\nDeleted {len(storage_paths)} file(s) from Supabase Storage.")

        # 2. Delete the DB rows.
        deleted_count = query.delete(synchronize_session=False)
        db.commit()
        print(f"Deleted {deleted_count} row(s) from note_images.")

        print("\nDone. Re-upload or re-index the affected note(s) to regenerate clean diagrams.")

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Purge existing note diagram images (storage + DB).")
    parser.add_argument(
        "--note-id",
        type=int,
        default=None,
        help="Only clean up images for this note ID. Omit to clean up ALL notes.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be deleted without actually deleting anything.",
    )
    args = parser.parse_args()

    if args.note_id is None and not args.dry_run:
        confirm = input(
            "No --note-id given, so this will delete images for ALL notes. Type 'yes' to continue: "
        )
        if confirm.strip().lower() != "yes":
            print("Aborted.")
            sys.exit(0)

    cleanup(note_id=args.note_id, dry_run=args.dry_run)