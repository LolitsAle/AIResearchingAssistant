import axios from 'axios'

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')

const api = axios.create({
  baseURL: BASE_URL,
})

async function safeParseErrorResponse(response) {
  if (!response) return null
  try {
    return await response.json()
  } catch {
    return null
  }
}

function normalizeError(err) {
  if (axios.isAxiosError(err)) {
    const apiError = err.response?.data?.error
    const message = apiError?.message || err.message || 'Không thể kết nối server'
    const error = new Error(message)
    error.code = apiError?.code || 'NETWORK_ERROR'
    error.status = err.response?.status
    error.details = err.response?.data
    return error
  }

  const fallback = new Error(err?.message || 'Đã có lỗi xảy ra')
  fallback.code = err?.code || 'UNKNOWN_ERROR'
  return fallback
}

async function unwrapRequest(requestFn) {
  try {
    const { data } = await requestFn()
    if (data?.success === false) {
      const error = new Error(data?.error?.message || 'Yêu cầu thất bại')
      error.code = data?.error?.code || 'API_ERROR'
      error.details = data
      throw error
    }
    return data?.data
  } catch (err) {
    throw normalizeError(err)
  }
}

export async function uploadDocument(file, onProgress) {
  const formData = new FormData()
  formData.append('file', file)

  return unwrapRequest(() =>
    api.post('/api/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded * 100) / e.total))
      },
    }),
  )
}

export function getDocuments() {
  return unwrapRequest(() => api.get('/api/documents'))
}

export function deleteDocument(docId) {
  return unwrapRequest(() => api.delete(`/api/documents/${docId}`))
}

export function summarizeDocument(docId) {
  return unwrapRequest(() => api.post(`/api/documents/${docId}/summarize`))
}

export function sendResearchQuery({ docId, question, chatHistory = [] }) {
  return unwrapRequest(() =>
    api.post('/api/chat/ask', {
      doc_id: docId,
      question,
      chat_history: chatHistory,
    }),
  )
}

export async function askQuestionStream({ docId, question, chatHistory = [], onSources, onToken }) {
  const response = await fetch(`${BASE_URL}/api/chat/ask/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ doc_id: docId, question, chat_history: chatHistory }),
  })

  if (!response.ok) {
    const errorData = await safeParseErrorResponse(response)
    const error = new Error(errorData?.error?.message || 'Streaming thất bại')
    error.code = errorData?.error?.code || `HTTP_${response.status}`
    throw error
  }

  if (!response.body) throw new Error('Không nhận được dữ liệu stream')

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let fullAnswer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split('\n\n')
    buffer = events.pop() || ''

    for (const eventChunk of events) {
      const line = eventChunk.split('\n').find((row) => row.startsWith('data:'))
      if (!line) continue

      const payload = JSON.parse(line.replace('data:', '').trim())
      if (payload.type === 'sources') onSources?.(Array.isArray(payload.sources) ? payload.sources : [])
      if (payload.type === 'token') {
        fullAnswer += payload.content || ''
        onToken?.(payload.content || '', fullAnswer)
      }
      if (payload.type === 'error') {
        const error = new Error(payload.message || 'Streaming thất bại')
        error.code = payload.code || 'STREAM_ERROR'
        throw error
      }
    }
  }

  return { answer: fullAnswer }
}

export function askQuestion(docId, question, chatHistory = []) {
  return sendResearchQuery({ docId, question, chatHistory })
}
