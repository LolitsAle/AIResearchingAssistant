# Architecture
## Frontend (React + Vite)
- Sidebar: upload, health, paper list.
- Main workspace: summary, chat, terms, compare, quick actions.
- Source panel: citations with section/page/snippet/score.
- API layer centralized in `frontend/src/services/api.js`.

## Backend (FastAPI)
- Routers: health + papers endpoints.
- Services:
  - PDF extraction via PyMuPDF.
  - Chunking by page/section with overlap.
  - Retrieval via TF-IDF cosine top-5.
  - Ollama integration for summary, QA, term explain, compare.
- Persistence: SQLite via SQLAlchemy.

## PDF Processing flow
Upload -> validate PDF -> save local file -> extract per-page text -> detect section headings -> chunk -> persist chunks.

## RAG flow
Question -> load paper chunks -> TF-IDF rank top 5 -> build grounded prompt -> Ollama generate -> return answer + chunk citations -> save chat.

## Storage
- DB: `backend/research_assistant.db`
- Upload files: `backend/app/storage/uploads`
