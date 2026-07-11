# 📚 StudentNotesChatbot — Complete Project Flow & Architecture

> A full-stack AI-powered study assistant where students upload PDF lecture notes and chat with them using RAG (Retrieval-Augmented Generation), with multilingual support and shareable chat sessions.

---

## Table of Contents

1. [High-Level Architecture](#1-high-level-architecture)
2. [Tech Stack — Explained in Detail](#2-tech-stack--explained-in-detail)
3. [Backend — File-by-File Breakdown](#3-backend--file-by-file-breakdown)
4. [Frontend — File-by-File Breakdown](#4-frontend--file-by-file-breakdown)
5. [API Endpoints — What Each Does](#5-api-endpoints--what-each-does)
6. [Function Reference — What Each Function Does](#6-function-reference--what-each-function-does)
7. [RAG Pipeline — Deep Dive](#7-rag-pipeline--deep-dive)
8. [Database Models & Relationships](#8-database-models--relationships)
9. [End-to-End User Flow](#9-end-to-end-user-flow)
10. [Deployment Architecture](#10-deployment-architecture)

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         STUDENT'S BROWSER                          │
│  React + TypeScript + Vite (port 5173 dev / 80 prod via Nginx)     │
│  Pages: Login, Register, Dashboard, Notes, Chat, SharedNote        │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ HTTP/REST (axios)
                            │ Bearer JWT in Authorization header
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    FASTAPI BACKEND (port 8000)                      │
│  Routers: /auth  /notes  /chat  /shared                            │
│  Services: auth_service, rag_service, storage_service,             │
│            sharing_service, security                               │
└────┬────────────────┬──────────────────┬──────────────────┬────────┘
     │                │                  │                  │
     ▼                ▼                  ▼                  ▼
┌─────────┐   ┌──────────────┐   ┌───────────┐   ┌──────────────────┐
│ Supabase│   │    Qdrant    │   │  Groq API │   │   Supabase DB    │
│ Storage │   │ Vector DB    │   │  (LLM)    │   │  PostgreSQL      │
│ (PDFs + │   │ (port 6333)  │   │ Llama-3.3 │   │  (Users, Notes, │
│ Images) │   │ Embeddings   │   │  70B      │   │  Chat, Shared)   │
└─────────┘   └──────────────┘   └───────────┘   └──────────────────┘
```

---

## 2. Tech Stack — Explained in Detail

### 🔵 Frontend

#### React 18 + TypeScript
- **What it is**: A JavaScript UI library for building component-based interfaces. TypeScript adds static typing.
- **Why used here**: Provides a reactive, component-driven UI. TypeScript catches type errors at compile time (e.g., `NoteOut`, `MessageOut` interfaces ensure API response shapes are enforced).
- **Key use case**: All pages (Dashboard, Chat, Notes) are React functional components using hooks (`useState`, `useEffect`, `useRef`).

#### Vite
- **What it is**: A next-generation frontend bundler and dev server (much faster than CRA/Webpack).
- **Why used here**: Instant HMR (Hot Module Replacement), faster builds, and native ESM support. Dev server runs on port `5173`.
- **Key use case**: `vite.config.ts` configures the React plugin; `VITE_API_BASE_URL` env var is injected at build time to point the frontend at the backend.

#### React Router DOM v6
- **What it is**: Client-side routing library for React SPAs.
- **Why used here**: Enables navigation between `/login`, `/register`, `/dashboard`, `/notes`, `/chat`, `/shared/:token` without full page reloads.
- **Key use case**: `ProtectedRoute` component wraps authenticated routes — if no JWT token, redirects to `/login`.

#### Axios
- **What it is**: A promise-based HTTP client for browser/Node.
- **Why used here**: Used in `api.ts` to create a centralized Axios instance with:
  - `baseURL` pointed to the backend
  - **Request interceptor**: Attaches `Authorization: Bearer <JWT>` to every request automatically
  - **Response interceptor**: On `401 Unauthorized`, clears the stale JWT from `localStorage` and redirects to `/login` (skips this for login/register routes)
- **Key use case**: Every API call in every page uses `api.get(...)`, `api.post(...)`, etc.

#### TailwindCSS
- **What it is**: A utility-first CSS framework.
- **Why used here**: Rapid UI development with consistent design tokens. Dark mode, glassmorphism effects (`glass-panel`, `glass-panel-glow`), and responsive layouts all done via Tailwind classes.

#### Lucide React
- **What it is**: An icon library for React.
- **Why used here**: Provides sharp, consistent SVG icons throughout the UI (e.g., `Send`, `Trash2`, `Share2`, `Sparkles`, `FileText`).

---

### 🟢 Backend

#### FastAPI
- **What it is**: A modern, high-performance Python web framework built on ASGI (Starlette + Pydantic).
- **Why used here**: Auto-generates OpenAPI docs, supports async I/O, dependency injection (used for `get_current_user`, `get_db`), and response model validation via Pydantic.
- **Key use case**: All 4 routers (`auth`, `notes`, `chat`, `shared`) are FastAPI `APIRouter` instances mounted on the main `FastAPI` app in `main.py`.

#### SQLAlchemy 2.x (ORM)
- **What it is**: Python's most popular ORM — maps Python classes to database tables.
- **Why used here**: Defines all 5 data models (`User`, `Note`, `NoteImage`, `ChatSession`, `Message`, `SharedLink`) as Python classes with typed columns using the new `Mapped[T]` / `mapped_column()` API.
- **Key use case**: `get_db()` yields a `Session` per request via FastAPI's `Depends()` injection. Cascade deletes are configured (deleting a User deletes their Notes, which cascade to ChatSessions, Messages, and SharedLinks).

#### Alembic
- **What it is**: SQLAlchemy's database migration tool.
- **Why used here**: Manages schema evolution — creating/altering tables across environments without manual SQL.
- **Key use case**: `alembic/` directory holds migration scripts. `alembic.ini` configures the migration environment.

#### Pydantic + pydantic-settings
- **What it is**: Data validation library. `pydantic-settings` loads config from `.env` files.
- **Why used here**: All request/response shapes are Pydantic schemas (`UserRegister`, `NoteOut`, `MessageCreate`, etc.). `Settings` class in `core/config.py` loads all environment variables with type validation.
- **Key use case**: `settings.GROQ_API_KEY`, `settings.QDRANT_URL`, `settings.JWT_SECRET_KEY` etc. are all loaded and validated at startup from `.env`.

#### PyJWT + passlib (bcrypt)
- **What it is**: `PyJWT` encodes/decodes JSON Web Tokens. `passlib` with bcrypt hashes passwords.
- **Why used here**: Stateless JWT-based authentication — no server-side sessions needed.
- **Key use case**: `create_access_token(user_id)` creates a JWT with expiry. `hash_password()` / `verify_password()` protect user credentials. `get_current_user()` in `core/dependencies.py` decodes the JWT on every protected request.

#### Supabase (Python SDK)
- **What it is**: An open-source Firebase alternative providing PostgreSQL + Storage + Auth.
- **Why used here**:
  - **PostgreSQL database** (via Supabase): Stores all relational data (users, notes, sessions, messages).
  - **Supabase Storage**: Object storage for PDF files and extracted diagram images, organized by `owner_id/`.
- **Key use case**: `storage_service.py` uses `supabase.storage.from_("notes-pdfs")` to upload/download/delete files. Signed URLs (1-hour expiry) are generated for private image access in `<img>` tags.

---

### 🔴 RAG / AI Stack

#### Qdrant (Vector Database)
- **What it is**: A high-performance vector similarity search engine with filtering support.
- **Why used here**: Stores all text chunk embeddings from uploaded PDFs. Supports payload-based filtering to scope searches per `note_id` and `owner_id` — critical for multi-tenant isolation.
- **How deployed**: Runs as a Docker container (`qdrant/qdrant:v1.12.1`) on port `6333`, with a named volume (`qdrant_data`) for persistence.
- **Collection name**: `note_chunks`
- **Distance metric**: **Cosine similarity** (normalized embeddings)

#### Sentence Transformers (`paraphrase-multilingual-mpnet-base-v2`)
- **What it is**: A HuggingFace model that converts text into dense semantic vector embeddings.
- **Why used here**: This specific model supports **50+ languages** (including Hindi, Kannada, Tamil, Telugu, Marathi, English), which aligns with the app's multilingual answer feature.
- **Vector size**: 768 dimensions
- **Key use case**: Embeds both PDF text chunks (at index time) and user queries (at query time) into the same vector space for semantic similarity search.

#### Groq API (LLM — `llama-3.3-70b-versatile`)
- **What it is**: A fast LLM inference API running Meta's Llama 3.3 70B model.
- **Why used here**: Groq's hardware (LPU chips) provides extremely low-latency inference — critical for a responsive chat experience. The 70B model provides high-quality answers.
- **Key use case**: Given retrieved text chunks as context, Groq generates a grounded, accurate answer strictly from the note content. Temperature set to `0.2` for factual accuracy.

#### PyMuPDF (fitz)
- **What it is**: Python bindings for MuPDF, a fast PDF/document rendering library.
- **Why used here**: Used for both **text extraction** (page-by-page) and **image/diagram extraction** from PDF files.
- **Key use case**: `extract_text_by_page()` uses `page.get_text()`. `extract_images_by_page()` uses `page.get_images(full=True)` then filters out soft masks, stencil masks, watermarks, and tiny images (<150×150 px).

#### pypdf
- **What it is**: A pure-Python PDF library.
- **Why used here**: Imported alongside PyMuPDF as a fallback PDF reader (present in dependencies for compatibility).

#### LangChain (`RecursiveCharacterTextSplitter`)
- **What it is**: A popular LLM framework. Only the text splitting utility is used.
- **Why used here**: `RecursiveCharacterTextSplitter` intelligently splits text with overlapping chunks, trying separators in order (`\n\n`, `\n`, `. `, ` `, `""`) to keep semantic units together.
- **Configuration**: `chunk_size=800`, `chunk_overlap=100` (meaning each chunk overlaps 100 characters with the next, preventing context from being cut at boundaries).

---

### 🐳 Infrastructure / DevOps

#### Docker + Docker Compose
- **What it is**: Containerization platform for packaging and running services.
- **Why used here**: `docker-compose.yml` defines 3 services: `qdrant`, `backend`, `frontend`. Ensures consistent environments across dev and prod.
- **Key use case**: `qdrant` service with a named volume provides persistent vector storage. `backend` and `frontend` have their own `Dockerfile`.

#### Nginx (in frontend container)
- **What it is**: A high-performance HTTP server/reverse proxy.
- **Why used here**: Serves the Vite-built static assets in the production Docker container. `nginx.conf` handles SPA routing (all routes fall back to `index.html`).

---

## 3. Backend — File-by-File Breakdown

```
backend/
├── main.py                    ← FastAPI app entry point
├── database.py                ← SQLAlchemy engine + session factory
├── alembic.ini                ← Alembic migration config
├── alembic/                   ← Migration scripts
├── core/
│   ├── config.py              ← Pydantic Settings (env vars)
│   └── dependencies.py        ← FastAPI Depends: get_current_user
├── models/
│   ├── user.py                ← User table model
│   ├── note.py                ← Note table model
│   ├── note_image.py          ← NoteImage table model
│   ├── chat.py                ← ChatSession + Message table models
│   └── shared_link.py         ← SharedLink table model
├── schemas/
│   ├── user.py                ← UserRegister, UserLogin, UserOut, Token
│   ├── note.py                ← NoteOut
│   ├── chat.py                ← ChatSessionCreate, ChatSessionOut, MessageCreate, MessageOut
│   └── shared.py              ← SharedNoteInfo, SharedMessageCreate, SharedLinkOut
├── routers/
│   ├── auth.py                ← POST /auth/register, POST /auth/login, GET /auth/me
│   ├── notes.py               ← POST /notes, GET /notes, GET /notes/{id}, DELETE /notes/{id}
│   ├── chat.py                ← Full CRUD for chat sessions + messages + share links
│   └── shared.py              ← Public read-only shared note endpoints
└── services/
    ├── auth_service.py        ← register_user(), authenticate_user()
    ├── security.py            ← hash_password(), verify_password(), create_access_token()
    ├── rag_service.py         ← THE CORE: full RAG pipeline
    ├── storage_service.py     ← Supabase Storage upload/download/delete
    └── sharing_service.py     ← Share link create/revoke/lookup + rate limiting
```

---

## 4. Frontend — File-by-File Breakdown

```
frontend/src/
├── main.tsx                   ← React root, wraps App in AuthProvider
├── App.tsx                    ← React Router routes definition
├── index.css                  ← Global CSS + Tailwind directives
├── context/
│   └── AuthContext.tsx        ← Global auth state: user, login(), register(), logout()
├── services/
│   ├── api.ts                 ← Axios instance with JWT interceptors
│   └── types.ts               ← TypeScript interfaces: UserOut, NoteOut, MessageOut, etc.
├── components/
│   ├── Navbar.tsx             ← Top navigation bar with user info + logout
│   └── ProtectedRoute.tsx     ← Route guard: redirects unauthenticated users to /login
└── pages/
    ├── Login.tsx              ← Login form page
    ├── Register.tsx           ← Registration form page
    ├── Dashboard.tsx          ← Overview: stats, recent notes, active sessions
    ├── Notes.tsx              ← Upload PDF notes, list notes with index status
    ├── Chat.tsx               ← Main AI chat interface (sidebar + message window)
    └── SharedNote.tsx         ← Public read-only view of a shared chat session
```

---

## 5. API Endpoints — What Each Does

### Auth Routes (`/auth`)

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| `POST` | `/auth/register` | No | Registers a new user. Hashes password with bcrypt. Returns the created `UserOut`. |
| `POST` | `/auth/login` | No | Validates email+password, returns a JWT `access_token` (expires in 60 min). |
| `GET` | `/auth/me` | ✅ Yes | Returns the currently authenticated user's profile. Used by frontend on load to hydrate `AuthContext`. |

### Notes Routes (`/notes`)

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| `POST` | `/notes` | ✅ Yes | Uploads a PDF (max 20MB). Saves file to Supabase Storage. Creates a `Note` DB row with `is_indexed=False`. Triggers RAG indexing as a **background task** so the HTTP response returns immediately. |
| `GET` | `/notes` | ✅ Yes | Lists all notes owned by the authenticated user, ordered newest first. |
| `GET` | `/notes/{note_id}` | ✅ Yes | Fetches a single note (must be owned by caller). |
| `DELETE` | `/notes/{note_id}` | ✅ Yes | Deletes the note: removes PDF from Supabase Storage, deletes all vector embeddings from Qdrant, deletes all extracted images from Storage, then deletes the DB row (cascading to sessions, messages, links). |

### Chat Routes (`/chat`)

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| `POST` | `/chat/sessions` | ✅ Yes | Creates a new chat session linked to a specific `note_id` (which must be owned by caller). |
| `GET` | `/chat/sessions` | ✅ Yes | Lists all chat sessions for the authenticated user, newest first. |
| `GET` | `/chat/sessions/{id}/messages` | ✅ Yes | Returns all messages in a session (ordered by `created_at`). |
| `POST` | `/chat/sessions/{id}/messages` | ✅ Yes | **The core RAG endpoint.** Saves the user message, calls `generate_answer_with_images()`, saves the assistant response (with any diagram image URLs), returns the assistant message. |
| `DELETE` | `/chat/sessions/{id}` | ✅ Yes | Deletes the session and all its messages (cascade). |
| `POST` | `/chat/sessions/{id}/share` | ✅ Yes | Generates a random secure token and creates a `SharedLink` DB row. Returns the sharable `/shared/<token>` path. Idempotent — if a link already exists, returns it. |
| `DELETE` | `/chat/sessions/{id}/share` | ✅ Yes | Revokes (deactivates) the active share link. The token becomes invalid. |

### Shared (Public) Routes (`/shared`)

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| `GET` | `/shared/{token}` | ❌ No | Looks up the token, verifies it's active, returns the note title + all messages in the session. Public read — no login needed. |
| `POST` | `/shared/{token}/messages` | ❌ No | **Stateless RAG for guests.** Validates token, checks per-IP rate limit (10 req/min), runs the RAG pipeline against the shared note, returns the answer. **Nothing is persisted** — anonymous chats are ephemeral by design. |

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Returns `{"status": "ok"}`. Used by container orchestrators for liveness checks. |

---

## 6. Function Reference — What Each Function Does

### `services/rag_service.py`

| Function | What It Does |
|----------|-------------|
| `get_embedding_model()` | Loads `paraphrase-multilingual-mpnet-base-v2` from HuggingFace (cached with `@lru_cache`). Reused across all requests — loads once at startup. |
| `get_qdrant_client()` | Creates and caches a `QdrantClient` connected to `settings.QDRANT_URL`. |
| `get_groq_client()` | Creates and caches a `Groq` client with the API key. |
| `ensure_collection()` | Checks if the `note_chunks` Qdrant collection exists. If not, creates it with 768-dimensional cosine vectors. If dimension mismatch (model changed), drops and recreates the collection. |
| `extract_text_by_page(pdf_bytes)` | Opens the PDF with PyMuPDF, iterates every page, returns a list of page text strings (index = page number - 1). |
| `chunk_pages(pages_text)` | Applies `RecursiveCharacterTextSplitter` **per page** so every chunk carries its `page_number`. Returns list of `{"text": str, "page_number": int}`. |
| `extract_images_by_page(pdf_bytes)` | Extracts real diagrams from PDF pages. Filters out: soft mask images, stencil masks (no colorspace), images smaller than 150×150 px, and images with area < 40,000 px². Returns `{page_number: [bytes, ...]}`. |
| `_point_id(note_id, chunk_index)` | Generates a deterministic UUID5 from `"note-{id}-chunk-{i}"`. This ensures re-uploading the same note **overwrites** the same Qdrant points rather than duplicating them. |
| `delete_note_vectors(note_id)` | Deletes all Qdrant points where `payload.note_id == note_id`. Called before re-indexing to avoid stale vectors. |
| `delete_note_images_db_and_storage(note_id)` | Opens a fresh DB session, fetches all `NoteImage` rows for the note, deletes their files from Supabase Storage, then deletes the DB rows. |
| `process_pdf_for_indexing(note_id, owner_id, pdf_bytes)` | **Main indexing orchestrator.** Calls `extract_text_by_page → chunk_pages → extract_images_by_page`. Clears old vectors+images. Encodes all chunk texts with the embedding model. Upserts points to Qdrant with full payload. Returns `(chunks_indexed, images_by_page)`. |
| `retrieve_relevant_chunks(query, owner_id, note_id, top_k=5)` | Encodes the user query into a vector. Searches Qdrant for top-K most similar chunks, filtered to `note_id` AND `owner_id` (multi-tenant safety). Returns list of `{text, score, page_number}`. |
| `build_prompt(query, chunks, answer_language)` | Concatenates retrieved chunks as CONTEXT. Constructs a strict grounded prompt instructing the LLM to answer **only** from the context, in the specified language, without hallucinating. |
| `_images_for_pages(db, note_id, page_numbers, limit=3)` | Queries `NoteImage` table for any diagrams on the given pages. Sorts by page relevance order. Generates signed Supabase URLs (1-hour expiry). Returns up to 3 URLs. |
| `generate_answer_with_images(query, owner_id, note_id, db, answer_language)` | **Full RAG answer pipeline.** Retrieves chunks → filters by `MIN_SIMILARITY_SCORE=0.25` → if no relevant chunks found, returns a localized "no results" message → builds prompt → calls Groq LLM → extracts top 1–2 distinct page numbers from chunks → fetches relevant diagram URLs → returns `(answer_text, image_urls)`. |

### `services/auth_service.py`

| Function | What It Does |
|----------|-------------|
| `register_user(db, payload)` | Checks for duplicate email (409 if exists). Creates `User` with bcrypt-hashed password. Commits to DB. |
| `authenticate_user(db, payload)` | Queries user by email. Verifies bcrypt hash. If valid, calls `create_access_token(user.id)` and returns the JWT string. |

### `services/security.py`

| Function | What It Does |
|----------|-------------|
| `hash_password(password)` | Returns bcrypt hash using `passlib.CryptContext`. |
| `verify_password(plain, hashed)` | Compares plain text against bcrypt hash, returns bool. |
| `create_access_token(user_id)` | Creates a JWT with `{"sub": user_id, "exp": now + 60min}`, signed with `HS256` and `JWT_SECRET_KEY`. |

### `services/storage_service.py`

| Function | What It Does |
|----------|-------------|
| `upload_pdf(owner_id, file)` | Validates content type (PDF only) and size (≤20MB). Uploads to Supabase Storage at path `{owner_id}/{uuid}_{filename}`. Returns `(storage_path, original_filename)`. |
| `download_pdf_bytes(storage_path)` | Downloads the file bytes from Supabase Storage (used before background indexing). |
| `delete_pdf(storage_path)` | Removes the PDF from Supabase Storage. Non-fatal on failure. |
| `upload_image(owner_id, note_id, page_number, image_index, image_bytes)` | Uploads an extracted diagram to `{owner_id}/note_{note_id}/images/page{page}_{idx}.png`. Uses `upsert: true` to overwrite on re-upload. |
| `get_image_signed_url(storage_path)` | Creates a 1-hour signed URL via Supabase Storage API. Handles multiple key casings (`signedURL`, `signedUrl`, `signed_url`) across SDK versions. |
| `delete_note_images(storage_paths)` | Batch-deletes multiple files from Supabase Storage. |

### `services/sharing_service.py`

| Function | What It Does |
|----------|-------------|
| `check_rate_limit(client_ip)` | In-memory sliding window rate limiter. Allows max 10 requests per IP per 60 seconds. Raises `HTTP 429` if exceeded. Appropriate for single-instance college deployment. |
| `create_or_get_share_link(db, session_id, owner_id)` | Verifies ownership of session. Checks for existing active `SharedLink` — if found, returns it (idempotent). Otherwise creates one with `secrets.token_urlsafe(16)`. |
| `revoke_share_link(db, session_id, owner_id)` | Sets `is_active=False` on all SharedLinks for the session. |
| `get_active_link(db, token)` | Returns the `SharedLink` matching `token` where `is_active=True`, or `None`. |

### `routers/notes.py`

| Function | What It Does |
|----------|-------------|
| `_index_note_background(note_id, owner_id, pdf_bytes)` | Background task (runs after HTTP response). Opens its own DB session. Calls `process_pdf_for_indexing`, then persists extracted images to Supabase Storage and `note_images` DB table. Updates `note.is_indexed = True` on success. |

### Frontend: `AuthContext.tsx`

| Function | What It Does |
|----------|-------------|
| `login(email, password)` | POST to `/auth/login`, stores JWT in `localStorage`, fetches `/auth/me` to hydrate user state. |
| `register(email, fullName, password)` | POST to `/auth/register`, then immediately calls `login()` to authenticate. |
| `logout()` | Removes `access_token` from `localStorage`, sets `user` to `null`. |

### Frontend: `Chat.tsx`

| Function | What It Does |
|----------|-------------|
| `handleNewSession()` | Creates a new chat session via `POST /chat/sessions` with the selected note. Updates sidebar session list. |
| `handleSend(e)` | Sends user message to `POST /chat/sessions/{id}/messages`. Optimistically appends the user message to the UI, then appends the assistant response when received. |
| `handleShareChat()` | Calls `POST /chat/sessions/{id}/share` to get a shareable URL. Displays the URL in the header with copy + revoke options. |
| `handleUnshareChat()` | Calls `DELETE /chat/sessions/{id}/share` to revoke the link. |
| `handleDeleteSession(sessionId)` | Calls `DELETE /chat/sessions/{id}`. Removes from local state. |
| `handleLanguageChange(lang)` | Updates `selectedLanguage` state and persists to `localStorage`. |

---

## 7. RAG Pipeline — Deep Dive

> **RAG = Retrieval-Augmented Generation**
> 
> Instead of asking an LLM to answer from its training data (which may hallucinate), RAG first *retrieves* the relevant passages from the student's own uploaded notes, then *augments* the LLM prompt with those passages, *generating* an answer grounded strictly in the student's material.

### Why RAG Is Used Here

Students upload their own lecture notes (PDFs). The AI should:
1. Answer questions **only from those notes** — not hallucinate from general knowledge
2. Work with notes in **multiple languages** (Hindi, Kannada, Tamil, Telugu, Marathi, English)
3. Surface **relevant diagrams** alongside text answers
4. Be **per-user and per-note isolated** — Student A cannot accidentally see Student B's notes

RAG solves all of these with semantic search over the student's own indexed content.

---

### Phase 1 — Indexing (Triggered on PDF Upload)

```
Student uploads PDF
        │
        ▼
POST /notes  ──→  upload_pdf()  ──→  Supabase Storage (PDF saved)
        │
        ▼
Note DB row created (is_indexed=False)
        │
        ▼
download_pdf_bytes() fetches raw bytes back from Storage
        │
        ▼
BackgroundTasks.add_task(_index_note_background) ← runs AFTER HTTP response
        │
        ▼
process_pdf_for_indexing(note_id, owner_id, pdf_bytes)
        │
        ├── extract_text_by_page(pdf_bytes)
        │       Uses PyMuPDF (fitz): opens PDF, iterates pages
        │       Returns: ["Page 1 text...", "Page 2 text...", ...]
        │
        ├── chunk_pages(pages_text)
        │       RecursiveCharacterTextSplitter: chunk_size=800, overlap=100
        │       Per-page chunking preserves page_number metadata
        │       Returns: [{"text": "...", "page_number": 1}, ...]
        │
        ├── extract_images_by_page(pdf_bytes)
        │       PyMuPDF: get_images(full=True) per page
        │       Filters: ✗ soft masks, ✗ stencil masks, ✗ <150px, ✗ <40k px²
        │       Returns: {page_number: [raw_image_bytes, ...]}
        │
        ├── delete_note_vectors(note_id)  ← clear stale Qdrant points
        ├── delete_note_images_db_and_storage(note_id)  ← clear stale images
        │
        ├── SentenceTransformer.encode(all_chunk_texts)
        │       Model: paraphrase-multilingual-mpnet-base-v2
        │       normalize_embeddings=True  ← for cosine similarity
        │       Output: 768-dim float vectors per chunk
        │
        └── qdrant_client.upsert(collection="note_chunks", points=[...])
                Each point:
                  id: UUID5("note-{id}-chunk-{i}") [deterministic]
                  vector: [768 floats]
                  payload: {
                    note_id, owner_id,
                    chunk_index, text, page_number
                  }

After Qdrant upsert:
  ├── For each extracted diagram:
  │   └── upload_image() → Supabase Storage
  │       → INSERT NoteImage(note_id, page_number, storage_path)
  │
  └── UPDATE notes SET is_indexed=True WHERE id=note_id
```

---

### Phase 2 — Retrieval & Generation (On Each Chat Message)

```
User types question: "What is the process of photosynthesis?"
Language selected: Hindi (hi)
        │
        ▼
POST /chat/sessions/{id}/messages
        │
        ▼
generate_answer_with_images(query, owner_id, note_id, db, answer_language="hi")
        │
        ▼
retrieve_relevant_chunks(query, owner_id, note_id, top_k=5)
        │
        ├── SentenceTransformer.encode([query])
        │       Same model as indexing → same vector space
        │       Output: 768-dim query vector
        │
        └── qdrant_client.search(
                collection="note_chunks",
                query_vector=query_vector,
                query_filter={
                  "must": [
                    {"note_id": == note_id},    ← per-note isolation
                    {"owner_id": == owner_id}   ← per-user isolation
                  ]
                },
                limit=5
              )
              Returns: [{text, score, page_number}, ...]
        │
        ▼
Filter: keep chunks where score >= MIN_SIMILARITY_SCORE (0.25)
        │
        ├── If NO relevant chunks:
        │   Return localized "not found" message in chosen language
        │
        └── If relevant chunks found:
                │
                ▼
            build_prompt(query, chunks, answer_language="hi")
                    Creates:
                    "You are a study assistant. Answer in Hindi.
                     If not in context, say so in Hindi.
                     CONTEXT:
                     [chunk 1 text]
                     ---
                     [chunk 2 text]
                     ...
                     QUESTION:
                     What is the process of photosynthesis?
                     ANSWER (Hindi):"
                │
                ▼
            groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                temperature=0.2,
                max_tokens=800,
                messages=[system_prompt, user_prompt]
              )
                │
                ▼
            Extract top 1–2 distinct page numbers from relevant chunks
            (in order of score)
                │
                ▼
            _images_for_pages(db, note_id, page_numbers, limit=3)
                SELECT NoteImage WHERE note_id=X AND page_number IN (...)
                For each: generate Supabase signed URL (1-hour TTL)
                │
                ▼
            Return (answer_text_in_hindi, [signed_image_url1, signed_image_url2])
        │
        ▼
Save Message(role="assistant", content=answer_text, image_urls=[...])
        │
        ▼
Return MessageOut to frontend → displayed in chat with inline diagram images
```

---

### RAG Configuration Constants

| Constant | Value | Meaning |
|----------|-------|---------|
| `COLLECTION_NAME` | `"note_chunks"` | Single Qdrant collection; isolation via payload filter |
| `CHUNK_SIZE` | `800` | Max characters per chunk |
| `CHUNK_OVERLAP` | `100` | Overlap between adjacent chunks to avoid cutting context |
| `TOP_K` | `5` | Number of candidate chunks retrieved per query |
| `MIN_SIMILARITY_SCORE` | `0.25` | Chunks below this cosine score are discarded as irrelevant |

---

### Multilingual RAG Flow

The multilingual capability is achieved by combining:

1. **Multilingual embedding model** (`paraphrase-multilingual-mpnet-base-v2`): Can embed both English PDF text and a Hindi query into the **same semantic vector space**, enabling cross-lingual retrieval. A Hindi question like "प्रकाश संश्लेषण क्या है?" can retrieve relevant English text chunks about photosynthesis.

2. **Language instruction in the LLM prompt** (`build_prompt`): The prompt explicitly instructs Groq's Llama to translate the retrieved English context into the target language (Hindi, Kannada, etc.) and answer entirely in that language.

3. **Fallback messages**: When no relevant chunks are found, the "not found" message itself is returned in the chosen language (Hindi and Kannada are hardcoded, others fall back to English).

---

## 8. Database Models & Relationships

```
users
├── id, email, full_name, hashed_password, created_at
│
├── notes (one-to-many, cascade delete)
│   ├── id, owner_id, title, file_path, original_filename, is_indexed, created_at
│   │
│   └── note_images (one-to-many, cascade delete)
│       └── id, note_id, page_number, storage_path, created_at
│
└── chat_sessions (one-to-many, cascade delete)
    ├── id, owner_id, note_id, title, created_at
    │
    ├── messages (one-to-many, cascade delete)
    │   └── id, session_id, role, content, image_urls (JSON), answer_language, created_at
    │
    └── shared_links (one-to-many, cascade delete)
        └── id, session_id, token, is_active, created_at
```

**Key Design Decisions:**
- All foreign keys have `ON DELETE CASCADE` — deleting a User removes everything; deleting a Note removes its sessions, messages, and links.
- `is_indexed` flag on `Note` lets the frontend show "Processing" vs "Indexed" status before the background task finishes.
- `image_urls` on `Message` is a `JSON` column — stores a list of Supabase signed URLs for diagrams relevant to that specific AI answer.
- `answer_language` on `Message` is stored so shared viewers see the language badge correctly.

---

## 9. End-to-End User Flow

### Happy Path — Student Uses the App

```
1. REGISTER / LOGIN
   Student opens app → fills Register form
   POST /auth/register → User created, JWT returned
   JWT stored in localStorage
   Redirected to /dashboard

2. UPLOAD A NOTE
   Student clicks "Upload Notes" → /notes page
   Picks a PDF lecture file
   POST /notes (multipart/form-data)
     → PDF uploaded to Supabase Storage
     → Note row created (is_indexed=False, shown as "Processing")
     → Background task starts: extracts text, chunks, embeds, upserts to Qdrant
     → Diagrams extracted → uploaded to Supabase → stored in note_images
     → Note updated: is_indexed=True (shown as "Indexed" ✅)

3. START A CHAT
   Student goes to /chat
   Selects the indexed note from sidebar dropdown
   Clicks "New Chat"
   POST /chat/sessions → session created, shown in sidebar

4. ASK A QUESTION
   Types: "Explain the Krebs cycle steps"
   Selects language: ಕನ್ನಡ (Kannada)
   POST /chat/sessions/{id}/messages
     → Kannada query encoded → 768-dim vector
     → Qdrant searched: top 5 chunks from THIS note by THIS user
     → Chunks above 0.25 similarity filtered in
     → Prompt built: "Answer in Kannada using ONLY this context..."
     → Groq Llama-3.3-70B generates answer in Kannada
     → Relevant page numbers extracted → diagram URLs fetched
     → Answer saved as Message
   Chat UI shows: Kannada answer + embedded diagram images

5. SHARE THE CHAT
   Student clicks "Share Link"
   POST /chat/sessions/{id}/share → token generated
   Shareable URL: https://app.example.com/shared/abc123xyz
   Copied to clipboard, sent to classmates

6. CLASSMATE VIEWS SHARED CHAT
   Opens /shared/abc123xyz (no login needed)
   GET /shared/abc123xyz → note title + all messages displayed
   Types their own question
   POST /shared/abc123xyz/messages
     → Rate limit checked (10 req/min per IP)
     → RAG pipeline runs (same as step 4)
     → Answer returned but NOT saved (anonymous, stateless)

7. REVOKE SHARE LINK
   Student clicks "Revoke"
   DELETE /chat/sessions/{id}/share → is_active=False
   URL no longer works (404)
```

---

## 10. Deployment Architecture

### Development (Current)
```
docker run qdrant (port 6333)          ← Vector DB
uvicorn main:app --reload (port 8000)  ← FastAPI dev server
npm run dev (port 5173)                ← Vite dev server
```

### Production (Docker Compose)
```yaml
services:
  qdrant:    image: qdrant/qdrant:v1.12.1  # port 6333, persisted volume
  backend:   Dockerfile in ./backend       # port 8000, depends on qdrant
  frontend:  Dockerfile in ./frontend      # port 80, Nginx serves built SPA
```

### External Services (Cloud)
- **Supabase**: Hosts the PostgreSQL database + file storage bucket (`notes-pdfs`)
- **Groq**: LLM inference API (no hosting needed — API key only)
- **HuggingFace**: Embedding model downloaded at first run, cached locally in the container

---

## Summary Table

| Component | Technology | Role |
|-----------|-----------|------|
| Frontend UI | React 18 + TypeScript + Vite | User interface & interaction |
| Styling | TailwindCSS | Responsive, dark-mode design |
| HTTP Client | Axios | API calls with JWT injection |
| Routing | React Router DOM v6 | SPA navigation |
| Backend Framework | FastAPI | REST API, dependency injection |
| ORM | SQLAlchemy 2.x | Database models & queries |
| Migrations | Alembic | Schema version control |
| Auth | PyJWT + passlib/bcrypt | JWT auth + password hashing |
| Relational DB | Supabase (PostgreSQL) | Users, notes, chat, links |
| File Storage | Supabase Storage | PDF files + diagram images |
| Vector DB | Qdrant | Embedding search with filtering |
| Embeddings | sentence-transformers | Multilingual text → vectors |
| LLM | Groq (Llama-3.3-70B) | Answer generation from context |
| PDF Text | PyMuPDF (fitz) | Page-aware text extraction |
| PDF Images | PyMuPDF (fitz) | Diagram/figure extraction |
| Text Chunking | LangChain splitter | Semantic chunk splitting |
| Config | pydantic-settings | Environment variable management |
| Containers | Docker + Docker Compose | Service orchestration |
| Prod Web Server | Nginx | Static file serving + SPA routing |
