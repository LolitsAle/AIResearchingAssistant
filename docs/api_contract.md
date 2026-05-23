# API Contract - AI Researching Assistant

Base URL: `http://localhost:8000/api`

## Error format
```json
{ "error": { "message": "human readable" } }
```

## Endpoints
### GET /health
Response:
```json
{ "status": "ok", "ollama": "available" }
```

### POST /papers/upload
Multipart form-data: `file` (PDF).
Response:
```json
{ "paper": { "id":"...", "title":"...", "filename":"...", "status":"indexed", "page_count":10, "chunk_count":35, "created_at":"..." } }
```

### GET /papers
```json
{ "papers": [Paper] }
```

### GET /papers/{paper_id}
```json
{ "paper": Paper, "summary": Summary | null }
```

### DELETE /papers/{paper_id}
```json
{ "deleted": true }
```

### POST /papers/{paper_id}/summarize
Response:
```json
{ "paper_id":"...", "summary": { "short_summary":"...", "detailed_summary":"...", "research_problem":"...", "methodology":"...", "main_contributions":[], "key_ideas":[], "results":[], "limitations":[] } }
```

### POST /papers/{paper_id}/ask
Request:
```json
{ "question": "..." }
```
Response:
```json
{ "answer":"...", "citations":[{ "chunk_id":"...", "paper_id":"...", "section":"...", "page_start":1, "page_end":1, "snippet":"...", "score":0.91 }] }
```

### POST /papers/{paper_id}/terms/explain
Request:
```json
{ "term":"Transformer" }
```
Response:
```json
{ "term":"Transformer", "explanation":"...", "citations":[] }
```

### POST /papers/compare
Request:
```json
{ "paper_ids": ["id1", "id2"] }
```
Response:
```json
{ "comparison": { "overview":"...", "papers":[{"paper_id":"id1","title":"..."}], "comparison_table":[], "conclusion":"..." } }
```

### GET /papers/{paper_id}/chat
```json
{ "messages":[{ "id":"...", "role":"user", "content":"...", "citations":[], "created_at":"..." }] }
```

## Main data models
- Paper: id, title, filename, status, page_count, chunk_count, created_at
- Citation: chunk_id, paper_id, section, page_start, page_end, snippet, score
- Summary: structured academic summary fields listed above.
