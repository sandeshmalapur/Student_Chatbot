# Student Notes Chatbot

Upload lecture note PDFs and ask questions in natural language. A RAG pipeline retrieves relevant content from your notes and answers using an LLM, grounded only in what you uploaded.

## Team Members
- <Your Name(s) Here>

## Problem Statement
Students accumulate large volumes of lecture notes as PDFs and struggle to quickly find or recall specific information. This project lets a student upload their notes and chat with them directly, receiving answers grounded strictly in that material (no hallucinated outside knowledge).

## Features
- JWT-based registration/login
- Upload, list, and delete PDF notes (stored in Supabase Storage)
- Automatic background indexing: PDF text extraction -> chunking -> embeddings -> Qdrant vector store
- Chat sessions per note, with full message history
- Retrieval-augmented answers via Groq LLM, grounded only in the note's own content; explicitly says so when a question isn't covered
- Fully Dockerized (backend, frontend, Qdrant) and deployable to a single EC2 instance

## Tech Stack
**Frontend:** React 18, TypeScript, Vite, React Router, Axios, Tailwind CSS
**Backend:** FastAPI, SQLAlchemy 2.0, Alembic, JWT (python-jose + passlib)
**Database:** PostgreSQL (Supabase, transaction pooler)
**RAG:** LangChain (chunking), Sentence-Transformers (`all-MiniLM-L6-v2` embeddings), Qdrant (vector DB), Groq (LLM inference)
**Storage:** Supabase Storage (PDF files)
**Infra:** Docker, Docker Compose, AWS EC2

## Architecture
```
Browser (React SPA)
   |  JWT via Axios interceptor
   v
FastAPI backend
   |-- /auth    -> Postgres (Supabase)
   |-- /notes   -> Supabase Storage (PDF bytes) + background indexing task
   |-- /chat    -> Qdrant (retrieval) + Groq (generation)
   v
Qdrant (vector store, Docker)      Supabase Postgres + Storage (managed)
```
Upload flow: PDF -> Supabase Storage -> extract text (pypdf) -> chunk (LangChain) -> embed (Sentence-Transformers) -> upsert into Qdrant, namespaced by `owner_id` + `note_id`.
Chat flow: user question -> embed -> Qdrant similarity search filtered to that note/user -> if no chunk clears the similarity threshold, respond "not covered" -> otherwise build a grounded prompt -> Groq completion -> store both messages.

## Installation (local dev, Windows/PowerShell)

### Backend
```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env      # then fill in real values, see below
alembic upgrade head
uvicorn main:app --reload
```

### Frontend
```powershell
cd frontend
npm install
copy .env.example .env      # VITE_API_BASE_URL=http://localhost:8000
npm run dev
```

### Qdrant (needed for RAG, run locally via Docker)
```powershell
docker run -p 6333:6333 -v qdrant_data:/qdrant/storage qdrant/qdrant:v1.12.1
```
Then set `QDRANT_URL=http://localhost:6333` in `backend/.env` for local (non-Docker-Compose) runs.

## Environment variables (`backend/.env`)
| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Supabase Dashboard -> Project Settings -> Database -> Connection string -> **Transaction pooler** |
| `JWT_SECRET_KEY` | Generate: `python -c "import secrets; print(secrets.token_hex(32))"` |
| `SUPABASE_URL` | Supabase Dashboard -> Project Settings -> API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard -> Project Settings -> API (service_role, secret) |
| `SUPABASE_STORAGE_BUCKET` | Create a bucket named e.g. `notes-pdfs` under Storage in Supabase |
| `GROQ_API_KEY` | https://console.groq.com/keys |
| `QDRANT_URL` | `http://qdrant:6333` in Docker Compose, `http://localhost:6333` for local dev |

## Docker (full stack)
```powershell
copy backend\.env.example backend\.env   # fill in real values
docker compose up -d --build
```
- Frontend: http://localhost
- Backend Swagger: http://localhost:8000/docs

## Deployment (AWS EC2)
See [deploy/EC2_DEPLOYMENT.md](deploy/EC2_DEPLOYMENT.md) for the full step-by-step (security groups, Docker install, env setup, verification).

## Screenshots
_Add screenshots of Register/Login, Dashboard, Notes, and Chat pages here after running the app._

## Future Scope
- Streaming token-by-token chat responses
- Multi-note chat (query across all of a user's notes at once)
- Highlighting the exact source chunk/page used for an answer
- Support for non-PDF formats (docx, pptx, images via OCR)
