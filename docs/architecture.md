# Architecture

## Frontend (React + Vite)
- `src/services/api.js`: all API requests.
- Pages: Home and Research workspace.
- Components: uploader, paper list, chat, source cards, compare and term explain sections.
- Mobile-first: stacked sections; desktop: document / chat / sources workspace.

## Backend (FastAPI)
- `app/main.py`: app setup + routers + CORS.
- `core/config.py`: env-based configuration.
- `db/models.py`: SQLite schema via SQLAlchemy.
- Routers:
  - health
  - papers (upload/list/detail/delete/summarize)
  - chat (ask/term/chat history)
  - compare
- Services:
  - `pdf_service`: PDF parsing with PyMuPDF
  - `chunk_service`: chunk generation
  - `retrieval_service`: TF-IDF + cosine top-k
  - `ollama_service`: local Ollama HTTP wrapper
  - `summary_service` / `comparison_service`: LLM orchestration

## PDF processing flow
1. Upload PDF.
2. Save file to `backend/app/storage/uploads`.
3. Extract page text using PyMuPDF.
4. Detect sections by common headings.
5. Chunk text with overlap and persist to SQLite.

## RAG flow
1. Receive question.
2. Load paper chunks.
3. TF-IDF retrieval top 5 chunks.
4. Build grounded prompt with chunk context.
5. Send to Ollama generate endpoint.
6. Return answer + citations from real chunks.

## Ollama integration
- Base URL: env `OLLAMA_BASE_URL`.
- Chat model: `OLLAMA_CHAT_MODEL` (default `llama3.1`).
- Health uses `/api/tags`.
- Generation uses `/api/generate`.

## SQLite schema
- `papers`
- `paper_chunks`
- `paper_summaries`
- `chat_messages`

## Local storage
- Uploaded PDFs stored locally in `app/storage/uploads`.
- Metadata, chunks, summary, chat persisted in SQLite DB (`research_assistant.db`).
