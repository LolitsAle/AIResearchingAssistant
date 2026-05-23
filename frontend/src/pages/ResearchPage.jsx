import { useEffect, useMemo, useRef, useState } from 'react'
import Toast from '../components/Toast'
import { api } from '../services/api'

const templateMap = {
  'Tổng quan tài liệu': 'overview',
  'Tóm tắt chuyên sâu': 'deep_summary',
  'Rút trích luận điểm': 'key_arguments',
  'Bản đồ tư duy': 'mind_map',
  'Bài kiểm tra': 'quiz',
  Flashcards: 'flashcards',
  'Giải thích thuật ngữ': 'terminology',
  'So sánh nhiều nguồn': 'compare_sources',
  'Trả lời có trích dẫn': 'citation_answer',
  'Bảng dữ liệu': 'data_table',
}

export default function ResearchPage() {
  const fileRef = useRef(null)
  const toastTimerRef = useRef(null)

  const [workspaces, setWorkspaces] = useState([])
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('')
  const [workspaceName, setWorkspaceName] = useState('')
  const [documents, setDocuments] = useState([])
  const [selectedDocumentIds, setSelectedDocumentIds] = useState([])
  const [messages, setMessages] = useState([])
  const [notes, setNotes] = useState([])
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const [analytics, setAnalytics] = useState(null)
  const [accent, setAccent] = useState('#6366f1')
  const [toast, setToast] = useState(null)
  const [activeCitationId, setActiveCitationId] = useState(null)

  const filteredDocs = useMemo(
    () => documents.filter((d) => (d.title || d.filename || '').toLowerCase().includes(query.toLowerCase())),
    [documents, query],
  )

  const showToast = (messageText, type = 'success') => {
    setToast({ message: messageText, type })
    window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2200)
  }

  const loadWorkspaceData = async (workspaceId) => {
    const [sources, chat, noteData] = await Promise.all([
      api.getWorkspaceSources(workspaceId),
      api.getWorkspaceChat(workspaceId),
      api.getNotes(workspaceId),
    ])
    setDocuments(sources.sources || [])
    setSelectedDocumentIds(sources.selected_document_ids || [])
    setMessages(chat.messages || [])
    setNotes(noteData.notes || [])
  }

  useEffect(() => {
    const init = async () => {
      try {
        const settings = await api.getSettings()
        if (settings?.accent_color) {
          setAccent(settings.accent_color)
          document.documentElement.style.setProperty('--accent', settings.accent_color)
        }
        const wsData = await api.getWorkspaces()
        let workspaceList = wsData.workspaces || []
        if (!workspaceList.length) {
          const created = await api.createWorkspace({ name: 'Research Workspace' })
          workspaceList = [created.workspace]
        }
        setWorkspaces(workspaceList)
        setActiveWorkspaceId(workspaceList[0].id)
        setWorkspaceName(workspaceList[0].name)
        await loadWorkspaceData(workspaceList[0].id)
      } catch (err) {
        showToast(err.message, 'error')
      }
    }
    init()
    return () => window.clearTimeout(toastTimerRef.current)
  }, [])

  const onWorkspaceChange = async (id) => {
    setActiveWorkspaceId(id)
    const ws = workspaces.find((w) => w.id === id)
    setWorkspaceName(ws?.name || '')
    try {
      await loadWorkspaceData(id)
      showToast('Đã chuyển workspace', 'info')
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const onUpload = async (file) => {
    if (!file) return
    setLoading(true)
    try {
      await api.uploadDocument(activeWorkspaceId, file)
      await loadWorkspaceData(activeWorkspaceId)
      showToast(`Đã thêm nguồn: ${file.name}`)
    } catch (err) {
      showToast(`Không thể tải tài liệu lên. ${err.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const onUpdateSelection = async (ids) => {
    try {
      const result = await api.updateSourceSelection(activeWorkspaceId, ids)
      setSelectedDocumentIds(result.selected_document_ids || [])
      showToast('Đã cập nhật nguồn được chọn', 'info')
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const onSend = async (prompt = message) => {
    const text = prompt.trim()
    if (!text) return showToast('Vui lòng nhập câu hỏi', 'warning')
    if (!selectedDocumentIds.length) return showToast('Vui lòng chọn ít nhất một nguồn trước khi hỏi AI.', 'warning')

    const tempUserMessage = { id: `temp-${Date.now()}`, role: 'user', content: text, citations: [] }
    setMessages((prev) => [...prev, tempUserMessage])
    setMessage('')
    setLoading(true)

    try {
      const res = await api.sendWorkspaceMessage(activeWorkspaceId, {
        message: text,
        selected_document_ids: selectedDocumentIds,
      })
      const assistantMessage = res.message || {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: res.answer,
        citations: res.citations || [],
      }
      setMessages((prev) => [...prev, assistantMessage])
      showToast('Đã gửi câu hỏi')
    } catch (err) {
      const msg = err.message.includes('Ollama')
        ? 'Ollama chưa sẵn sàng. Hãy chạy ollama serve và tải model đã cấu hình.'
        : err.message
      showToast(msg, 'error')
    } finally {
      setLoading(false)
    }
  }

  const onRunStudio = async (label) => {
    if (!selectedDocumentIds.length) return showToast('Vui lòng chọn nguồn trước khi dùng Studio', 'warning')
    setLoading(true)
    try {
      const result = await api.runStudioTemplate(activeWorkspaceId, {
        template: templateMap[label] || 'overview',
        selected_document_ids: selectedDocumentIds,
      })

      if (result.type === 'chat') {
        setMessages((prev) => [...prev, { id: `studio-${Date.now()}`, role: 'assistant', content: result.content, citations: result.citations || [] }])
      } else {
        await api.createNote(activeWorkspaceId, { title: result.title, content: result.content, citations: result.citations || [] })
        const noteData = await api.getNotes(activeWorkspaceId)
        setNotes(noteData.notes || [])
      }
      showToast(`Đã chạy: ${label}`)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return <div className="agent-root"><header className="topbar"><div className="left-actions"><span className="logo">✦</span><select value={activeWorkspaceId} onChange={(e) => onWorkspaceChange(e.target.value)}>{workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select><input type="text" value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} onBlur={async () => { try { const res = await api.updateWorkspace(activeWorkspaceId, { name: workspaceName }); setWorkspaces((prev) => prev.map((w) => (w.id === activeWorkspaceId ? res.workspace : w))); showToast('Đã cập nhật tên workspace') } catch (err) { showToast(err.message, 'error') } }} /></div><div className="right-actions"><button type="button" onClick={async () => { try { const r = await api.createNewChat(activeWorkspaceId); setMessages(r.messages || []); showToast('Đã tạo đoạn chat mới') } catch (err) { showToast(err.message, 'error') } }}>＋ Tạo đoạn chat mới</button><button type="button" onClick={async () => { setAnalyticsOpen(true); try { setAnalytics(await api.getAnalytics(activeWorkspaceId)); showToast('Đã mở số liệu phân tích', 'info') } catch (err) { showToast(err.message, 'error') } }}>Số liệu phân tích</button><button type="button" onClick={() => showToast('Tính năng chia sẻ sẽ được phát triển sau', 'info')}>Chia sẻ</button><button type="button" onClick={() => setSettingsOpen(true)}>Cài đặt</button><span className="avatar">U</span></div></header>
  <main className="agent-grid"><section className="panel source-panel"><div className="panel-header"><h3>Nguồn tài liệu</h3></div><input ref={fileRef} hidden type="file" accept="application/pdf,.pdf" onChange={(e) => onUpload(e.target.files?.[0])} /><button type="button" className="pill" onClick={() => fileRef.current?.click()}>＋ Thêm nguồn</button><div className="search-wrap"><span className="search-icon">⌕</span><input placeholder="Tìm nguồn..." value={query} onChange={(e) => setQuery(e.target.value)} /></div><label className="checkline"><input type="checkbox" checked={selectedDocumentIds.length > 0 && selectedDocumentIds.length === documents.length} onChange={() => onUpdateSelection(selectedDocumentIds.length === documents.length ? [] : documents.map((d) => d.id))} />Chọn tất cả</label><small>{selectedDocumentIds.length} nguồn được chọn</small><div className="scroll-zone">{filteredDocs.map((d) => <article key={d.id} className={`doc-card ${activeCitationId?.startsWith(d.id) ? 'is-highlight' : ''}`}><label><input type="checkbox" checked={selectedDocumentIds.includes(d.id)} onChange={() => onUpdateSelection(selectedDocumentIds.includes(d.id) ? selectedDocumentIds.filter((x) => x !== d.id) : [...selectedDocumentIds, d.id])} />{d.title || d.filename}</label><button type="button" className="doc-delete" onClick={async () => { try { await api.deleteDocument(d.id); await loadWorkspaceData(activeWorkspaceId); showToast('Đã xoá nguồn khỏi giao diện') } catch (err) { showToast(err.message, 'error') } }}>×</button></article>)}</div></section>
  <section className="panel chat-panel"><div className="panel-header center-title"><h2>Cuộc trò chuyện</h2></div><div className="chat-zone scroll-zone">{messages.map((m) => <div key={m.id} className={`bubble ${m.role}`}><p>{m.content}</p>{!!m.citations?.length && <div className="cite-row">{m.citations.map((c, idx) => <button type="button" key={c.id || idx} className="cite-pill" onClick={() => { setActiveCitationId(c.document_id || c.paper_id || ''); showToast('Đã chọn trích dẫn', 'info') }}>[{idx + 1}]</button>)}</div>}{m.role === 'assistant' && <div className="message-actions"><button type="button" className="save-note" onClick={async () => { try { await api.createNote(activeWorkspaceId, { title: 'Ghi chú từ AI', content: m.content, citations: m.citations || [] }); const noteData = await api.getNotes(activeWorkspaceId); setNotes(noteData.notes || []); showToast('Đã lưu vào ghi chú') } catch (err) { showToast(err.message, 'error') } }}>Lưu vào ghi chú</button></div>}</div>)}{loading && <div className="bubble assistant"><p>Đang xử lý...</p></div>}</div><div className="composer"><textarea value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend() } }} /><div><span>{selectedDocumentIds.length} nguồn</span><button type="button" className={`send-btn ${message.trim() && selectedDocumentIds.length ? 'active' : ''}`} onClick={() => onSend()}>➤</button></div></div></section>
  <section className="panel studio-panel"><div className="panel-header"><h3>Studio</h3></div><div className="template-grid">{Object.keys(templateMap).map((t) => <button key={t} type="button" className="template" onClick={() => onRunStudio(t)}>{t}<span>›</span></button>)}</div><div className="notes-head"><h4>Ghi chú</h4><button type="button" className="save-note" onClick={async () => { try { await api.createNote(activeWorkspaceId, { title: 'Ghi chú mới', content: '' }); const noteData = await api.getNotes(activeWorkspaceId); setNotes(noteData.notes || []); showToast('Đã thêm ghi chú mới') } catch (err) { showToast(err.message, 'error') } }}>+ Thêm ghi chú</button></div><div className="scroll-zone">{notes.map((n) => <article key={n.id} className="note"><strong>{n.title}</strong><p>{n.content}</p><div className="note-actions"><button type="button" className="save-note" onClick={async () => { try { await api.updateNote(n.id, { title: n.title, content: `${n.content}\n(đã chỉnh sửa)` }); const rs = await api.getNotes(activeWorkspaceId); setNotes(rs.notes || []); showToast('Đã cập nhật ghi chú') } catch (err) { showToast(err.message, 'error') } }}>Sửa</button><button type="button" className="save-note" onClick={async () => { try { await api.deleteNote(n.id); setNotes((prev) => prev.filter((x) => x.id !== n.id)); showToast('Đã xoá ghi chú') } catch (err) { showToast(err.message, 'error') } }}>Xóa</button></div></article>)}</div></section></main>
  {settingsOpen && <div className="modal-wrap"><div className="panel modal-panel"><h3>Cài đặt giao diện</h3><label className="modal-field">Accent color</label><input value={accent} onChange={(e) => setAccent(e.target.value)} /><div className="modal-actions"><button type="button" onClick={async () => { try { const settings = await api.updateSettings({ theme_mode: 'dark', accent_color: accent }); document.documentElement.style.setProperty('--accent', settings.accent_color); setSettingsOpen(false); showToast('Đã lưu cài đặt tạm thời') } catch (err) { showToast(err.message, 'error') } }}>Lưu</button><button type="button" onClick={() => setSettingsOpen(false)}>Đóng</button></div></div></div>}
  {analyticsOpen && <div className="modal-wrap"><div className="panel modal-panel"><h3>Analytics</h3><p className="analytics-line">Tài liệu: <strong>{analytics?.document_count ?? '...'}</strong></p><p className="analytics-line">Nguồn đã chọn: <strong>{analytics?.selected_source_count ?? '...'}</strong></p><p className="analytics-line">Câu hỏi: <strong>{analytics?.chat_message_count ?? '...'}</strong></p><p className="analytics-line">Ghi chú: <strong>{analytics?.note_count ?? '...'}</strong></p><p className="analytics-line">Trích dẫn: <strong>{analytics?.citation_count ?? '...'}</strong></p><div className="modal-actions"><button type="button" onClick={() => setAnalyticsOpen(false)}>Đóng</button></div></div></div>}
  <Toast toast={toast} onClose={() => setToast(null)} /></div>
}
