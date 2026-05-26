# API Contract (FastAPI + Gemini + Supabase pgvector)

## Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

## Health
- `GET /api/health`

## Workspace APIs (require Bearer token)
- `GET /api/workspaces`
- `POST /api/workspaces`
- `GET /api/workspaces/{workspace_id}`
- `PATCH /api/workspaces/{workspace_id}`
- `DELETE /api/workspaces/{workspace_id}`

- `POST /api/workspaces/{workspace_id}/documents/upload`
- `GET /api/workspaces/{workspace_id}/sources`
- `DELETE /api/documents/{document_id}`
- `PATCH /api/workspaces/{workspace_id}/sources/selection`

- `GET /api/workspaces/{workspace_id}/chat`
- `POST /api/workspaces/{workspace_id}/chat`
- `POST /api/workspaces/{workspace_id}/chat/new`

- `POST /api/workspaces/{workspace_id}/studio/run`
- Studio returns `message` for direct append into ChatBox.

- `GET /api/workspaces/{workspace_id}/notes`
- `POST /api/workspaces/{workspace_id}/notes`
- `PATCH /api/notes/{note_id}`
- `DELETE /api/notes/{note_id}`
