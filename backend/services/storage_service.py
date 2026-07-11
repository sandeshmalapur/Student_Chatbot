"""Handles PDF and note-image upload/download/delete against Supabase Storage."""
import uuid

from fastapi import HTTPException, UploadFile, status
from supabase import Client, create_client

from core.config import settings

_client: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024  # 20 MB
SIGNED_URL_EXPIRY_SECONDS = 3600  # 1 hour


def _bucket():
    return _client.storage.from_(settings.SUPABASE_STORAGE_BUCKET)


async def upload_pdf(owner_id: int, file: UploadFile) -> tuple[str, str]:
    """Uploads a PDF to Supabase Storage. Returns (storage_path, original_filename)."""
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only PDF files are allowed")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File exceeds 20MB limit")

    storage_path = f"{owner_id}/{uuid.uuid4().hex}_{file.filename}"
    try:
        _bucket().upload(storage_path, contents, {"content-type": "application/pdf"})
    except Exception as exc:  # supabase raises generic exceptions on failure
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Failed to upload to storage: {exc}"
        ) from exc

    return storage_path, file.filename


def download_pdf_bytes(storage_path: str) -> bytes:
    try:
        return _bucket().download(storage_path)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Failed to download from storage: {exc}"
        ) from exc


def delete_pdf(storage_path: str) -> None:
    try:
        _bucket().remove([storage_path])
    except Exception:
        # Non-fatal: DB row deletion should still proceed even if storage cleanup fails
        pass


def upload_image(owner_id: int, note_id: int, page_number: int, image_index: int, image_bytes: bytes, ext: str = "png") -> str:
    """Uploads one extracted diagram/figure image. Returns its storage_path."""
    storage_path = f"{owner_id}/note_{note_id}/images/page{page_number}_{image_index}.{ext}"
    try:
        _bucket().upload(
            storage_path,
            image_bytes,
            {"content-type": f"image/{ext}", "upsert": "true"},
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Failed to upload image to storage: {exc}"
        ) from exc
    return storage_path


def get_image_signed_url(storage_path: str) -> str | None:
    """Returns a temporary signed URL so the private bucket's image can be shown in <img> tags."""
    try:
        result = _bucket().create_signed_url(storage_path, SIGNED_URL_EXPIRY_SECONDS)
    except Exception:
        return None
    # supabase-py has used different key casings across versions; check both.
    return result.get("signedURL") or result.get("signedUrl") or result.get("signed_url")


def delete_note_images(storage_paths: list[str]) -> None:
    if not storage_paths:
        return
    try:
        _bucket().remove(storage_paths)
    except Exception:
        pass