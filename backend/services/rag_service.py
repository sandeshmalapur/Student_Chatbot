"""
RAG pipeline: PDF text extraction -> chunk -> embed -> store in Qdrant (namespaced per user/note)
                query -> embed -> retrieve top-k -> construct grounded prompt -> call Groq
"""
import io
import uuid
from functools import lru_cache

from groq import Groq
from langchain.text_splitter import RecursiveCharacterTextSplitter
from pypdf import PdfReader
from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels
from sentence_transformers import SentenceTransformer

from core.config import settings

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
    if COLLECTION_NAME in existing:
        return
    vector_size = get_embedding_model().get_sentence_embedding_dimension()
    client.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=qmodels.VectorParams(size=vector_size, distance=qmodels.Distance.COSINE),
    )


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(pdf_bytes))
    pages_text = [page.extract_text() or "" for page in reader.pages]
    return "\n\n".join(pages_text).strip()


def chunk_text(text: str) -> list[str]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    return [c.strip() for c in splitter.split_text(text) if c.strip()]


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


def index_note(note_id: int, owner_id: int, pdf_bytes: bytes) -> int:
    """Extracts, chunks, embeds and stores a note's PDF content in Qdrant. Returns number of chunks indexed."""
    ensure_collection()

    text = extract_text_from_pdf(pdf_bytes)
    if not text:
        return 0

    chunks = chunk_text(text)
    if not chunks:
        return 0

    model = get_embedding_model()
    embeddings = model.encode(chunks, show_progress_bar=False, normalize_embeddings=True)

    # clear any previous vectors for this note (handles re-upload/re-index)
    delete_note_vectors(note_id)

    points = [
        qmodels.PointStruct(
            id=_point_id(note_id, i),
            vector=embeddings[i].tolist(),
            payload={"note_id": note_id, "owner_id": owner_id, "chunk_index": i, "text": chunks[i]},
        )
        for i in range(len(chunks))
    ]

    get_qdrant_client().upsert(collection_name=COLLECTION_NAME, points=points)
    return len(points)


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
    return [{"text": r.payload["text"], "score": r.score} for r in results]


def build_prompt(query: str, chunks: list[dict]) -> str:
    context = "\n\n---\n\n".join(c["text"] for c in chunks)
    return (
        "You are a study assistant. Answer the question using ONLY the context below, "
        "which was extracted from the student's own uploaded lecture notes. "
        "If the answer is not contained in the context, say clearly that the notes "
        "don't cover this and do not make anything up.\n\n"
        f"CONTEXT:\n{context}\n\n"
        f"QUESTION:\n{query}\n\n"
        "ANSWER:"
    )


def generate_answer(query: str, owner_id: int, note_id: int) -> str:
    chunks = retrieve_relevant_chunks(query, owner_id, note_id)
    relevant = [c for c in chunks if c["score"] >= MIN_SIMILARITY_SCORE]

    if not relevant:
        return (
            "I couldn't find anything relevant to that question in this note. "
            "Try rephrasing, or ask about a topic that's actually covered in the uploaded PDF."
        )

    prompt = build_prompt(query, relevant)
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
    return completion.choices[0].message.content.strip()
