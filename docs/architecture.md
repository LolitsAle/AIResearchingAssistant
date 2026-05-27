# Architecture

- Backend: FastAPI (Python), deployed on Render.
- Frontend: React + Vite, deployed on Vercel.
- PDF parsing: `pdfplumber` per-page extraction.
- Embedding: Google `text-embedding-004`.
- LLM: Gemini `gemini-1.5-flash`.
- Vector DB: Supabase PostgreSQL with `pgvector` (`document_chunks.embedding`).
- RAG flow: upload -> parse -> chunk -> embed -> store -> retrieve top-k by pgvector -> Gemini answer + citations.
- Studio flow: template run returns assistant message appended to ChatBox (no auto-note).
- Notes flow: notes are created manually or from “Lưu vào ghi chú” on assistant chat messages only.
