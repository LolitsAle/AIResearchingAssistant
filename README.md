# AI Researching Assistant (Local Ollama)
A full-stack AI research copilot to upload academic PDFs, index content, run grounded Q&A, summarize papers, explain terms, and compare multiple papers.

## Features
- PDF upload + parsing (PyMuPDF)
- Section-aware chunking
- RAG Q&A with citations
- Structured summary extraction
- Term explanation
- Multi-paper comparison
- Chat history persistence

## Tech stack
- Frontend: React + Vite
- Backend: FastAPI + SQLAlchemy + SQLite
- LLM: Ollama local (`llama3.1`)
- Retrieval: TF-IDF cosine similarity (scikit-learn)

## Prerequisites
- Python 3.11+
- Node.js 18+
- Ollama

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
- http://localhost:8000/docs

## Troubleshooting
- Ollama not running: start `ollama serve`.
- Model not pulled: run `ollama pull llama3.1`.
- Scanned PDF: OCR not supported yet.
- CORS: verify `CORS_ORIGINS` matches frontend URL.
