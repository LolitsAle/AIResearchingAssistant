# AI Researching Assistant

## Required Stack
- Backend: FastAPI + Python (Render)
- Frontend: React + Vite (Vercel)
- PDF Parse: pdfplumber
- Embedding: Google text-embedding-004
- Vector DB: Supabase PostgreSQL + pgvector
- LLM: Gemini 1.5 Flash

## Backend setup
1. Copy `backend/.env.example` to `backend/.env` and fill envs.
2. Install dependencies: `pip install -r backend/requirements.txt`
3. Start API: `uvicorn app.main:app --host 0.0.0.0 --port 8000` (run in `backend/`).

### Render deploy
Start command:
`uvicorn app.main:app --host 0.0.0.0 --port $PORT`

Required envs:
- GOOGLE_API_KEY
- GEMINI_MODEL
- GOOGLE_EMBEDDING_MODEL
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- DATABASE_URL
- CORS_ORIGINS

## Frontend setup
1. Copy `frontend/.env.example` to `frontend/.env`.
2. `npm install`
3. `npm run dev`

### Vercel deploy
- Build command: `npm run build`
- Output directory: `dist`
- Env: `VITE_API_BASE_URL=https://<render-backend-url>/api`

## Notes on old stack
- Ollama/Chroma/FAISS/PyMuPDF flows are deprecated and removed from the main runtime flow.
