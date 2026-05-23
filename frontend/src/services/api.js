const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'

async function request(path, options = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, options)
    const text = await response.text()
    let data = {}
    if (text) {
      try { data = JSON.parse(text) } catch { data = { detail: text } }
    }

    if (!response.ok) {
      throw new Error(data?.error?.message || data?.detail || `Request thất bại (${response.status})`)
    }
    return data
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Không kết nối được backend. Hãy kiểm tra FastAPI đang chạy tại http://localhost:8000.')
    }
    throw error
  }
}

const json = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

export const api = {
  getHealth: () => request('/health'),
  getWorkspaces: () => request('/workspaces'),
  createWorkspace: (payload) => request('/workspaces', json('POST', payload)),
  getWorkspace: (workspaceId) => request(`/workspaces/${workspaceId}`),
  updateWorkspace: (workspaceId, payload) => request(`/workspaces/${workspaceId}`, json('PATCH', payload)),
  deleteWorkspace: (workspaceId) => request(`/workspaces/${workspaceId}`, { method: 'DELETE' }),

  getWorkspaceSources: (workspaceId) => request(`/workspaces/${workspaceId}/sources`),
  uploadDocument: (workspaceId, file) => {
    const fd = new FormData(); fd.append('file', file)
    return request(`/workspaces/${workspaceId}/documents/upload`, { method: 'POST', body: fd })
  },
  deleteDocument: (documentId) => request(`/documents/${documentId}`, { method: 'DELETE' }),
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

  // @deprecated: Không còn được sử dụng trong UI mới. Đã thay bằng uploadDocument(workspaceId, file).
  // Giữ tạm để tránh phá các import cũ nếu còn sót.
  uploadPaper: (file) => { const fd = new FormData(); fd.append('file', file); return request('/papers/upload', { method: 'POST', body: fd }) },
}
