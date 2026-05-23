import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../services/api'

const templates = ['Tổng quan tài liệu', 'Tóm tắt chuyên sâu', 'Rút trích luận điểm', 'Bản đồ tư duy']

export default function ResearchPage() {
  const fileRef = useRef(null)
  const [workspaces, setWorkspaces] = useState([])
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('')
  const [workspaceName, setWorkspaceName] = useState('')
  const [documents, setDocuments] = useState([])
  const [selectedDocumentIds, setSelectedDocumentIds] = useState([])
  const [messages, setMessages] = useState([])
  const [notes, setNotes] = useState([])
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [analytics, setAnalytics] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const [accent, setAccent] = useState('#6d5dfc')

  const selectedCount = selectedDocumentIds.length
  const filteredDocs = useMemo(() => documents.filter((d) => (d.filename || d.title || '').toLowerCase().includes(query.toLowerCase())), [documents, query])

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId)

  const loadWorkspaceData = async (workspaceId) => {
    const [sources, chat, noteData] = await Promise.all([
      api.getWorkspaceSources(workspaceId),
      api.getWorkspaceChat(workspaceId),
      api.getNotes(workspaceId),
    ])
    setDocuments(sources.documents || [])
    setSelectedDocumentIds(sources.selected_document_ids || [])
    setMessages(chat.messages || [])
    setNotes(noteData.notes || [])
  }

  useEffect(() => {
    const init = async () => {
      try {
        setError('')
        await api.getHealth()
        const s = await api.getSettings()
        const savedAccent = s?.accent_color || localStorage.getItem('accent_color') || '#6d5dfc'
        setAccent(savedAccent)
        document.documentElement.style.setProperty('--accent', savedAccent)
        const wsData = await api.getWorkspaces()
        let list = wsData.workspaces || []
        if (!list.length) {
          const created = await api.createWorkspace({ name: 'Workspace mới' })
          list = [created]
        }
        setWorkspaces(list)
        setActiveWorkspaceId(list[0].id)
        setWorkspaceName(list[0].name)
        await loadWorkspaceData(list[0].id)
      } catch (err) {
        setError(err.message)
      }
    }
    init()
  }, [])

  const onWorkspaceChange = async (id) => {
    setActiveWorkspaceId(id)
    const next = workspaces.find((w) => w.id === id)
    setWorkspaceName(next?.name || '')
    try { await loadWorkspaceData(id) } catch (err) { setError(err.message) }
  }

  const onUpload = async (file) => {
    if (!activeWorkspaceId || !file) return
    console.debug('[UI] upload clicked')
    try {
      setError('')
      await api.uploadDocument(activeWorkspaceId, file)
      await loadWorkspaceData(activeWorkspaceId)
    } catch (err) { setError(err.message) }
  }

  const updateSelection = async (ids) => {
    setSelectedDocumentIds(ids)
    try { await api.updateSourceSelection(activeWorkspaceId, ids) } catch (err) { setError(err.message) }
  }

  const toggleDoc = (id) => updateSelection(selectedDocumentIds.includes(id) ? selectedDocumentIds.filter((x) => x !== id) : [...selectedDocumentIds, id])
  const toggleAll = (checked) => updateSelection(checked ? documents.map((d) => d.id) : [])

  const send = async () => {
    const text = message.trim()
    if (!text || !activeWorkspaceId || selectedCount === 0) return
    const payload = { message: text, selected_document_ids: selectedDocumentIds }
    console.debug('[UI] sending message', payload)
    setLoading(true)
    setError('')
    setMessages((prev) => [...prev, { role: 'user', content: text, citations: [] }])
    try {
      const data = await api.sendWorkspaceMessage(activeWorkspaceId, payload)
      setMessages((prev) => [...prev, { role: 'assistant', content: data.answer, citations: data.citations || [] }])
      setMessage('')
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  const onNewChat = async () => { try { await api.createNewChat(activeWorkspaceId); setMessages([]) } catch (err) { setError(err.message) } }
  const onSaveNote = async (content) => { try { const n = await api.createNote(activeWorkspaceId, { title: 'Ghi chú từ AI', content }); setNotes((p) => [n, ...p]) } catch (err) { setError(err.message) } }
  const onRunStudio = async (template) => { try { const r = await api.runStudioTemplate(activeWorkspaceId, { template, selected_document_ids: selectedDocumentIds }); setNotes((p) => [{ title: r.title, content: r.content, id: crypto.randomUUID() }, ...p]) } catch (err) { setError(err.message) } }
  const onAnalytics = async () => { setAnalyticsOpen(true); try { setAnalytics(await api.getAnalytics(activeWorkspaceId)) } catch (err) { setError(err.message) } }
  const onSaveSettings = async () => {
    document.documentElement.style.setProperty('--accent', accent)
    localStorage.setItem('accent_color', accent)
    try { await api.updateSettings({ accent_color: accent }); setSettingsOpen(false) } catch (err) { setError(`${err.message} (đã lưu local)`); setSettingsOpen(false) }
  }

  return <div className="agent-root"><header className="topbar"><div className="left-actions"><span className="logo">◉</span><select value={activeWorkspaceId} onChange={(e) => onWorkspaceChange(e.target.value)}>{workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select><input value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} onBlur={async () => { try { const updated = await api.updateWorkspace(activeWorkspaceId, { name: workspaceName }); setWorkspaces((prev) => prev.map((w) => w.id === activeWorkspaceId ? updated : w)) } catch (err) { setError(err.message) } }} /></div><div className="right-actions"><button onClick={onNewChat}>＋ Tạo đoạn chat mới</button><button onClick={onAnalytics}>Số liệu phân tích</button><button onClick={() => setSettingsOpen(true)}>Cài đặt</button><span className="avatar">U</span></div></header><main className="agent-grid"><section className="panel source-panel"><div className="panel-header"><h3>Nguồn</h3></div><input ref={fileRef} hidden type="file" accept="application/pdf,.pdf" onChange={(e) => onUpload(e.target.files?.[0])} /><button className="pill" onClick={() => fileRef.current?.click()}>＋ Thêm nguồn</button><div className="search-wrap"><input placeholder="Tìm nguồn..." value={query} onChange={(e) => setQuery(e.target.value)} /></div><label className="checkline"><input type="checkbox" checked={selectedCount > 0 && selectedCount === documents.length} onChange={(e) => toggleAll(e.target.checked)} />Chọn tất cả</label><small>{selectedCount} nguồn được chọn</small><div className="scroll-zone">{filteredDocs.map((d) => <article key={d.id} className="doc-card"><label><input type="checkbox" checked={selectedDocumentIds.includes(d.id)} onChange={() => toggleDoc(d.id)} />{d.filename || d.title}</label><button onClick={async () => { try { await api.deleteDocument(d.id); await loadWorkspaceData(activeWorkspaceId) } catch (err) { setError(err.message) } }}>Xóa</button></article>)}</div></section><section className="panel chat-panel"><div className="panel-header center-title"><h2>Cuộc Trò Chuyện</h2></div><div className="chat-zone scroll-zone">{messages.map((m, i) => <div key={i} className={`bubble ${m.role}`}><p>{m.content}</p>{m.role === 'assistant' && <button className="save-note" onClick={() => onSaveNote(m.content)}>Lưu vào ghi chú</button>}</div>)}</div><div className="composer"><textarea value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} /><div><span>{selectedCount} nguồn</span><button className="send-btn" disabled={loading || !message.trim() || selectedCount === 0} onClick={send}>➤</button></div></div></section><section className="panel studio-panel"><div className="panel-header"><h3>Studio</h3></div><div className="template-grid">{templates.map((t) => <button key={t} className="template" onClick={() => onRunStudio(t)}>{t}<span>›</span></button>)}</div><h4 style={{ marginTop: '10px' }}>Ghi chú</h4><div className="scroll-zone">{notes.map((n) => <article key={n.id} className="note"><strong>{n.title}</strong><p>{n.content}</p><button onClick={async () => { try { await api.deleteNote(n.id); setNotes((prev) => prev.filter((x) => x.id !== n.id)) } catch (err) { setError(err.message) } }}>Xóa</button></article>)}</div></section></main>{error && <div className="chat-error" style={{ margin: 12 }}>{error}</div>}{settingsOpen && <div className="panel" style={{ position: 'fixed', top: '20%', left: '35%', right: '35%', zIndex: 100 }}><h3>Cài đặt</h3><input value={accent} onChange={(e) => setAccent(e.target.value)} /><button onClick={onSaveSettings}>Lưu</button><button onClick={() => setSettingsOpen(false)}>Đóng</button></div>}{analyticsOpen && <div className="panel" style={{ position: 'fixed', top: '18%', left: '30%', right: '30%', zIndex: 100 }}><h3>Analytics</h3><pre>{JSON.stringify(analytics, null, 2)}</pre><button onClick={() => setAnalyticsOpen(false)}>Đóng</button></div>}</div>
}
