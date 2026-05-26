# API Contract (FastAPI + Gemini + Supabase pgvector)

## Health
- `GET /api/health`

## Documents
- `POST /api/workspaces/{workspace_id}/documents/upload`
- `GET /api/workspaces/{workspace_id}/sources`
- `DELETE /api/documents/{document_id}`

## Source Selection
- `PATCH /api/workspaces/{workspace_id}/sources/selection`

## Chat
- `GET /api/workspaces/{workspace_id}/chat`
- `POST /api/workspaces/{workspace_id}/chat`
- `POST /api/workspaces/{workspace_id}/chat/new`

## Studio
- `POST /api/workspaces/{workspace_id}/studio/run`
- Response returns `message` (assistant chat message) to append directly into ChatBox.
- Studio does NOT create notes automatically.

## Notes
- `GET /api/workspaces/{workspace_id}/notes`
- `POST /api/workspaces/{workspace_id}/notes`
- `PATCH /api/notes/{note_id}`
- `DELETE /api/notes/{note_id}`

## Settings/Analytics
- `GET /api/workspaces/{workspace_id}/analytics`
- `GET /api/settings`
- `PATCH /api/settings`
