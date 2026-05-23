# AI Researching Assistant (React + FastAPI + Ollama)

## Overview
Local-first AI Research Assistant for uploading academic PDFs, generating structured summaries, Q&A with citations, term explanation, and multi-paper comparison.

## Features
- Upload PDF papers
- Parse and chunk documents
- Generate structured summary
- RAG Q&A with citations
- Explain academic terms
- Compare multiple papers

## Tech Stack
- Frontend: React + Vite
- Backend: FastAPI + SQLAlchemy + SQLite
- LLM: Ollama local (`llama3.1`)
- Retrieval: TF-IDF cosine similarity

## Prerequisites
- Python 3.11+
- Node.js 18+
- Ollama installed

## Ollama setup
```bash
ollama pull llama3.1
ollama pull nomic-embed-text
ollama serve
```

## Backend setup
```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000
```

## Frontend setup
```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

## API docs
- Swagger: http://localhost:8000/docs

## Troubleshooting
- **Ollama not running**: start `ollama serve`.
- **Model not found**: run `ollama pull llama3.1`.
- **Scanned PDF**: OCR is not supported yet.
- **CORS error**: check `CORS_ORIGINS` in backend `.env`.
