const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'

const getToken = () => localStorage.getItem('access_token')

async function request(path, options = {}) {
  try {
    const headers = { ...(options.headers || {}) }
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
    const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })
    const text = await response.text()
    let data = {}
    if (text) {
      try { data = JSON.parse(text) } catch { data = { detail: text } }
    }

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('access_token')
      }
      throw new Error(data?.error?.message || data?.detail || `Request thất bại (${response.status})`)
    }
    return data
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Không kết nối được backend.')
    }
    throw error
  }
}

const json = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

export const api = {
  register: (payload) => request('/auth/register', json('POST', payload)),
  login: (payload) => request('/auth/login', json('POST', payload)),
  loginWithGoogle: (credential) => request('/auth/google', json('POST', { credential })),
  getMe: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),

  getHealth: () => request('/health'),
  getWorkspaces: () => request('/workspaces'),
  createWorkspace: (payload) => request('/workspaces', json('POST', payload)),
  getWorkspace: (workspaceId) => request(`/workspaces/${workspaceId}`),
  updateWorkspace: (workspaceId, payload) => request(`/workspaces/${workspaceId}`, json('PATCH', payload)),
  deleteWorkspace: (workspaceId) => request(`/workspaces/${workspaceId}`, { method: 'DELETE' }),
  getWorkspaceSources: (workspaceId) => request(`/workspaces/${workspaceId}/sources`),
  uploadDocument: (workspaceId, file) => { const fd = new FormData(); fd.append('file', file); return request(`/workspaces/${workspaceId}/documents/upload`, { method: 'POST', body: fd }) },
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
}
