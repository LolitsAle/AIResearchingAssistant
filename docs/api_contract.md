# API Contract
Base URL: `http://localhost:8000/api`

## Error format
```json
{"error":{"code":"STRING_CODE","message":"Human readable message","details":{}}}
```

## Endpoints
- `GET /health`
- `POST /papers/upload`
- `GET /papers`
- `GET /papers/{paper_id}`
- `DELETE /papers/{paper_id}`
- `POST /papers/{paper_id}/summarize`
- `POST /papers/{paper_id}/ask`
- `POST /papers/{paper_id}/terms/explain`
- `POST /papers/compare`
- `GET /papers/{paper_id}/chat`

## Key Models
- Paper: id,title,filename,file_path,page_count,chunk_count,status,created_at,updated_at
- PaperChunk: id,paper_id,section,page_start,page_end,content,chunk_index,embedding_json,created_at
- PaperSummary: id,paper_id,short_summary,detailed_summary,research_problem,methodology,main_contributions_json,key_ideas_json,results_json,limitations_json
- ChatMessage: id,paper_id,role,content,citations_json,created_at

See `/docs` swagger for full live schema and examples.
