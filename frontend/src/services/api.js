const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'

async function request(path, options = {}) {
  const method = options.method || 'GET'
  const url = `${API_BASE}${path}`
  console.debug('[API]', method, url)

  try {
    const res = await fetch(url, options)
    const text = await res.text()
    let data = {}

    if (text) {
      try {
        data = JSON.parse(text)
      } catch {
        data = { raw: text }
      }
    }

    if (!res.ok) {
      const message =
        data?.error?.message ||
        data?.detail ||
        `Request thất bại (${res.status})`
      throw new Error(message)
    }

    return data
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Không kết nối được backend. Hãy kiểm tra FastAPI đang chạy tại http://localhost:8000.')
    }
    throw error instanceof Error ? error : new Error('Không thể kết nối backend.')
  }
}

const json = (method, body) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export const api = {
  getHealth: () => request('/health'),
  getWorkspaces: () => request('/workspaces'),
  createWorkspace: (payload) => request('/workspaces', json('POST', payload)),
  updateWorkspace: (workspaceId, payload) => request(`/workspaces/${workspaceId}`, json('PATCH', payload)),
  deleteWorkspace: (workspaceId) => request(`/workspaces/${workspaceId}`, { method: 'DELETE' }),
  getWorkspace: (workspaceId) => request(`/workspaces/${workspaceId}`),
  getWorkspaceSources: (workspaceId) => request(`/workspaces/${workspaceId}/sources`),
  uploadDocument: (workspaceId, file) => { const fd = new FormData(); fd.append('file', file); return request(`/workspaces/${workspaceId}/documents/upload`, { method: 'POST', body: fd }) },
  deleteDocument: (documentId) => request(`/papers/${documentId}`, { method: 'DELETE' }),
  updateSourceSelection: (workspaceId, selectedDocumentIds) => request(`/workspaces/${workspaceId}/sources/selection`, json('PATCH', { selected_document_ids: selectedDocumentIds })),
  getWorkspaceChat: (workspaceId) => request(`/workspaces/${workspaceId}/chat`),
  createNewChat: (workspaceId) => request(`/workspaces/${workspaceId}/chat/new`, { method: 'POST' }),
  sendWorkspaceMessage: (workspaceId, payload) => request(`/workspaces/${workspaceId}/chat`, json('POST', payload)),
  runStudioTemplate: (workspaceId, payload) => request(`/workspaces/${workspaceId}/studio/run`, json('POST', payload)),
  getNotes: (workspaceId) => request(`/workspaces/${workspaceId}/notes`),
  createNote: (workspaceId, payload) => request(`/workspaces/${workspaceId}/notes`, json('POST', payload)),
  updateNote: (noteId, payload) => request(`/notes/${noteId}`, json('PATCH', payload)),
  deleteNote: (noteId) => request(`/notes/${noteId}`, { method: 'DELETE' }),
  getAnalytics: (workspaceId) => request(`/workspaces/${workspaceId}/analytics`),
  getSettings: () => request('/settings'),
  updateSettings: (payload) => request('/settings', json('PATCH', payload)),
}
