const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'

async function request(path, options = {}) {
  let res
  try {
    res = await fetch(`${API_BASE}${path}`, options)
  } catch {
    throw new Error('Backend is not reachable. Please start FastAPI server.')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error?.message || data?.detail || 'Request failed')
  return data
}

export const api = {
  health: () => request('/health'),
  listPapers: () => request('/papers'),
  uploadPaper: (file) => {
    const fd = new FormData(); fd.append('file', file)
    return request('/papers/upload', { method: 'POST', body: fd })
  },
  getPaper: (id) => request(`/papers/${id}`),
  deletePaper: (id) => request(`/papers/${id}`, { method: 'DELETE' }),
  summarize: (id) => request(`/papers/${id}/summarize`, { method: 'POST' }),
  ask: (id, question) => request(`/papers/${id}/ask`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question }) }),
  explainTerm: (id, term) => request(`/papers/${id}/terms/explain`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ term }) }),
  compare: (paper_ids) => request('/papers/compare', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paper_ids }) }),
  chat: (id) => request(`/papers/${id}/chat`),
}
