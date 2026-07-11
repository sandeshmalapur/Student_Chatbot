"""
RAG pipeline: PDF text + diagram extraction -> chunk (page-aware) -> embed -> store in Qdrant
                (namespaced per user/note) -> query -> retrieve top-k -> also fetch any diagrams
                on the same pages -> construct grounded prompt -> call Groq
"""
import io
import uuid
from functools import lru_cache

import fitz  # PyMuPDF
from groq import Groq
from langchain.text_splitter import RecursiveCharacterTextSplitter
from pypdf import PdfReader
from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels
from sentence_transformers import SentenceTransformer
from sqlalchemy.orm import Session

from core.config import settings
from models.note_image import NoteImage
from services.storage_service import get_image_signed_url

COLLECTION_NAME = "note_chunks"
CHUNK_SIZE = 800
CHUNK_OVERLAP = 100
TOP_K = 5
MIN_SIMILARITY_SCORE = 0.25  # below this, treat as "no relevant context found"


@lru_cache(maxsize=1)
def get_embedding_model() -> SentenceTransformer:
    return SentenceTransformer(settings.EMBEDDING_MODEL)


@lru_cache(maxsize=1)
def get_qdrant_client() -> QdrantClient:
    return QdrantClient(url=settings.QDRANT_URL, api_key=settings.QDRANT_API_KEY or None)


@lru_cache(maxsize=1)
def get_groq_client() -> Groq:
    return Groq(api_key=settings.GROQ_API_KEY)


def ensure_collection() -> None:
    client = get_qdrant_client()
    existing = [c.name for c in client.get_collections().collections]
    vector_size = get_embedding_model().get_sentence_embedding_dimension()
    
    if COLLECTION_NAME in existing:
        info = client.get_collection(COLLECTION_NAME)
        current_size = info.config.params.vectors.size
        if current_size != vector_size:
            print(f"Dimension mismatch in collection '{COLLECTION_NAME}': current size {current_size}, model size {vector_size}. Dropping and recreating collection.")
            client.delete_collection(COLLECTION_NAME)
        else:
            return
            
    client.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=qmodels.VectorParams(size=vector_size, distance=qmodels.Distance.COSINE),
    )


# ---------- PDF extraction (text, page-aware) ----------

def extract_text_by_page(pdf_bytes: bytes) -> list[str]:
    """Returns a list where index i is the text of page i+1 (1-indexed pages)."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages = []
    try:
        for page in doc:
            pages.append((page.get_text() or "").strip())
    finally:
        doc.close()
    return pages


def chunk_pages(pages_text: list[str]) -> list[dict]:
    """Chunks each page independently so every chunk knows which page it came from.
    Returns a list of {"text": str, "page_number": int} (1-indexed)."""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    chunks: list[dict] = []
    for page_number, text in enumerate(pages_text, start=1):
        if not text:
            continue
        for piece in splitter.split_text(text):
            piece = piece.strip()
            if piece:
                chunks.append({"text": piece, "page_number": page_number})
    return chunks


# ---------- PDF extraction (diagrams/images) ----------

def extract_images_by_page(pdf_bytes: bytes) -> dict[int, list[bytes]]:
    """Returns {page_number (1-indexed): [raw image bytes, ...]} for real diagrams only.

    Filters out soft masks, stencil masks, small watermark stamps/logos, and duplicates.
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    images_by_page: dict[int, list[bytes]] = {}
    try:
        for page_index in range(len(doc)):
            page = doc[page_index]
            image_refs = page.get_images(full=True)
            
            # Build a set of all smask xrefs referenced by other images on this page
            smask_xrefs = set()
            for img in image_refs:
                if len(img) > 1 and img[1] > 0:
                    smask_xrefs.add(img[1])
            
            seen_xrefs = set()
            page_images = []
            
            for img in image_refs:
                xref = img[0]
                
                # Check for smask exclusion
                if xref in smask_xrefs:
                    continue
                
                # De-duplicate by xref within a page
                if xref in seen_xrefs:
                    continue
                seen_xrefs.add(xref)
                
                # Check stencil mask: empty colorspace or cs_name
                colorspace = img[5] if len(img) > 5 else None
                cs_name = img[6] if len(img) > 6 else None
                if not colorspace and not cs_name:
                    continue
                
                width = img[2] if len(img) > 2 else 0
                height = img[3] if len(img) > 3 else 0
                
                # Check size: minimum 150x150 px
                if width < 150 or height < 150:
                    continue
                
                # Check total area: minimum 40,000 px^2
                if width * height < 40000:
                    continue
                
                try:
                    base_image = doc.extract_image(xref)
                    page_images.append(base_image["image"])  # raw bytes, usually png/jpeg
                except Exception:
                    continue  # skip any image PyMuPDF can't decode, don't fail the whole upload
            if page_images:
                images_by_page[page_index + 1] = page_images
    finally:
        doc.close()
    return images_by_page


# ---------- Indexing ----------

def _point_id(note_id: int, chunk_index: int) -> str:
    # deterministic UUID so re-indexing the same note/chunk overwrites the same point
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, f"note-{note_id}-chunk-{chunk_index}"))


def delete_note_vectors(note_id: int) -> None:
    client = get_qdrant_client()
    ensure_collection()
    client.delete(
        collection_name=COLLECTION_NAME,
        points_selector=qmodels.FilterSelector(
            filter=qmodels.Filter(
                must=[qmodels.FieldCondition(key="note_id", match=qmodels.MatchValue(value=note_id))]
            )
        ),
    )


def delete_note_images_db_and_storage(note_id: int) -> None:
    """Deletes all note_images database rows and their associated Supabase Storage files."""
    from database import SessionLocal
    from models.note_image import NoteImage
    from services.storage_service import delete_note_images
    
    db = SessionLocal()
    try:
        images = db.query(NoteImage).filter(NoteImage.note_id == note_id).all()
        if images:
            delete_note_images([img.storage_path for img in images])
            db.query(NoteImage).filter(NoteImage.note_id == note_id).delete()
            db.commit()
    finally:
        db.close()


def process_pdf_for_indexing(note_id: int, owner_id: int, pdf_bytes: bytes) -> tuple[int, dict[int, list[bytes]]]:
    """Extracts text+images, embeds+stores text chunks in Qdrant (with page_number in payload).
    Returns (chunks_indexed, images_by_page) — the caller is responsible for persisting
    images_by_page to Supabase Storage + the note_images table (needs a DB session,
    which this module intentionally doesn't own)."""
    ensure_collection()

    pages_text = extract_text_by_page(pdf_bytes)
    chunks = chunk_pages(pages_text)
    images_by_page = extract_images_by_page(pdf_bytes)

    delete_note_vectors(note_id)  # clear any previous vectors for this note (handles re-upload)
    delete_note_images_db_and_storage(note_id)  # clear previous images (handles re-upload)

    if not chunks:
        return 0, images_by_page

    model = get_embedding_model()
    texts = [c["text"] for c in chunks]
    embeddings = model.encode(texts, show_progress_bar=False, normalize_embeddings=True)

    points = [
        qmodels.PointStruct(
            id=_point_id(note_id, i),
            vector=embeddings[i].tolist(),
            payload={
                "note_id": note_id,
                "owner_id": owner_id,
                "chunk_index": i,
                "text": chunks[i]["text"],
                "page_number": chunks[i]["page_number"],
            },
        )
        for i in range(len(chunks))
    ]
    get_qdrant_client().upsert(collection_name=COLLECTION_NAME, points=points)

    return len(points), images_by_page


# ---------- Retrieval + generation ----------

def retrieve_relevant_chunks(query: str, owner_id: int, note_id: int, top_k: int = TOP_K) -> list[dict]:
    ensure_collection()
    model = get_embedding_model()
    query_vector = model.encode([query], normalize_embeddings=True)[0].tolist()

    results = get_qdrant_client().search(
        collection_name=COLLECTION_NAME,
        query_vector=query_vector,
        query_filter=qmodels.Filter(
            must=[
                qmodels.FieldCondition(key="note_id", match=qmodels.MatchValue(value=note_id)),
                qmodels.FieldCondition(key="owner_id", match=qmodels.MatchValue(value=owner_id)),
            ]
        ),
        limit=top_k,
    )
    return [
        {"text": r.payload["text"], "score": r.score, "page_number": r.payload.get("page_number")}
        for r in results
    ]


LANGUAGE_NAME_MAP = {
    "en": "English",
    "hi": "Hindi",
    "kn": "Kannada",
    "ta": "Tamil",
    "te": "Telugu",
    "mr": "Marathi"
}


def build_prompt(query: str, chunks: list[dict], answer_language: str = "en") -> str:
    context = "\n\n---\n\n".join(c["text"] for c in chunks)
    lang_name = LANGUAGE_NAME_MAP.get(answer_language, "English")
    return (
        f"You are a study assistant. Answer the question using ONLY the context below, "
        f"which was extracted from the student's own uploaded lecture notes. "
        f"Answer the question in {lang_name}, even if the context or query is in a different language. "
        f"Translate the relevant information into {lang_name}. Do NOT mix languages or write in a language other than {lang_name}.\n\n"
        f"If the answer is not contained in the context, state clearly in {lang_name} that the notes "
        f"don't cover this and do not make anything up.\n\n"
        f"CONTEXT:\n{context}\n\n"
        f"QUESTION:\n{query}\n\n"
        f"ANSWER ({lang_name}):"
    )


def _images_for_pages(db: Session, note_id: int, page_numbers: list[int], limit: int = 3) -> list[str]:
    """Looks up any diagrams stored for the given pages (in order of priority)
    and returns signed, browser-loadable URLs, up to `limit` total images."""
    if not page_numbers:
        return []
    
    images = (
        db.query(NoteImage)
        .filter(NoteImage.note_id == note_id, NoteImage.page_number.in_(page_numbers))
        .all()
    )
    
    # Sort images based on the order of pages in the page_numbers list
    page_order = {page: idx for idx, page in enumerate(page_numbers)}
    images.sort(key=lambda img: page_order.get(img.page_number, 9999))
    
    urls = []
    for image in images:
        if len(urls) >= limit:
            break
        url = get_image_signed_url(image.storage_path)
        if url:
            urls.append(url)
    return urls


def generate_answer_with_images(query: str, owner_id: int, note_id: int, db: Session, answer_language: str = "en") -> tuple[str, list[str]]:
    """Returns (answer_text, image_urls). image_urls are diagrams found on the top-scoring page(s) only."""
    chunks = retrieve_relevant_chunks(query, owner_id, note_id)
    relevant = [c for c in chunks if c["score"] >= MIN_SIMILARITY_SCORE]

    if not relevant:
        lang_name = LANGUAGE_NAME_MAP.get(answer_language, "English")
        if answer_language == "hi":
            no_context_msg = "मुझे इस प्रश्न से संबंधित कोई जानकारी आपके नोट्स में नहीं मिली। कृपया पुनः प्रयास करें।"
        elif answer_language == "kn":
            no_context_msg = "ಈ ಪ್ರಶ್ನೆಗೆ ಸಂಬಂಧಿಸಿದ ಯಾವುದೇ ಮಾಹಿತಿ ನಿಮ್ಮ ಟಿಪ್ಪಣಿಗಳಲ್ಲಿ ಕಂಡುಬಂದಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೊಮ್ಮೆ ಪ್ರಯತ್ನಿಸಿ."
        else:
            no_context_msg = f"I couldn't find anything relevant to that question in this note. Try rephrasing, or ask about a topic that's actually covered in the uploaded PDF."
        return (
            no_context_msg,
            [],
        )

    prompt = build_prompt(query, relevant, answer_language)
    client = get_groq_client()
    completion = client.chat.completions.create(
        model=settings.GROQ_MODEL,
        messages=[
            {"role": "system", "content": "You are a helpful, accurate study assistant grounded strictly in provided notes."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,
        max_tokens=800,
    )
    answer_text = completion.choices[0].message.content.strip()

    # Get top 1-2 distinct pages based on chunk relevance score (preserving order)
    top_pages: list[int] = []
    for chunk in relevant:
        page = chunk.get("page_number")
        if page is not None and page not in top_pages:
            top_pages.append(page)
        if len(top_pages) >= 2:
            break

    image_urls = _images_for_pages(db, note_id, top_pages, limit=3)

    return answer_text, image_urls