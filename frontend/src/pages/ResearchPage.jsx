import { useEffect, useMemo, useRef, useState } from 'react'
import Toast from '../components/Toast'
import { api } from '../services/api'

const STUDIO_TEMPLATES = [
  { key: 'deep_summary', label: 'Tóm tắt chuyên sâu' },
  { key: 'key_arguments', label: 'Rút trích luận điểm' },
  { key: 'citation_answer', label: 'Hỏi đáp theo từng đoạn' },
  { key: 'terminology', label: 'Giải thích thuật ngữ' },
  { key: 'compare_sources', label: 'So sánh nhiều nguồn' },
  { key: 'citation_answer', label: 'Trả lời có trích dẫn' },
  { key: 'flashcards', label: 'Flashcards' },
  { key: 'quiz', label: 'Bài kiểm tra' },
  { key: 'data_table', label: 'Bảng dữ liệu' },
]

function IconButton({ icon, label, onClick }) {
  return <button type="button" className="icon-btn" aria-label={label} data-tooltip={label} onClick={onClick}>{icon}</button>
}

export default function ResearchPage() {
  const [projects, setProjects] = useState([])
  const [activeProjectId, setActiveProjectId] = useState('')
  const [projectName, setProjectName] = useState('')
  const [projectMenuOpen, setProjectMenuOpen] = useState(false)
  const [documents, setDocuments] = useState([])
  const [selectedDocumentIds, setSelectedDocumentIds] = useState([])
  const [messages, setMessages] = useState([])
  const [notes, setNotes] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCitationId, setActiveCitationId] = useState(null)
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [analytics, setAnalytics] = useState(null)
  const [toast, setToast] = useState(null)
  const [accentColor, setAccentColor] = useState('#6366f1')
  const [loading, setLoading] = useState(false)
  const [projectLoading, setProjectLoading] = useState(false)

  const toastTimerRef = useRef(null)
  const messagesEndRef = useRef(null)
  const fileRef = useRef(null)

  const filteredDocs = useMemo(() => documents.filter((d) => (d.title || d.filename || '').toLowerCase().includes(searchQuery.toLowerCase())), [documents, searchQuery])
  const activeCount = selectedDocumentIds.length

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2300)
  }

  const loadWorkspaceData = async (workspaceId) => {
    const [src, chat, noteData] = await Promise.all([
      api.getWorkspaceSources(workspaceId),
      api.getWorkspaceChat(workspaceId),
      api.getNotes(workspaceId),
    ])
    setDocuments(src.sources || [])
    setSelectedDocumentIds(src.selected_document_ids || [])
    setMessages(chat.messages || [])
    setNotes(noteData.notes || [])
  }

  useEffect(() => {
    const init = async () => {
      try {
        setProjectLoading(true)
        const settings = await api.getSettings()
        if (settings?.accent_color) {
          setAccentColor(settings.accent_color)
          document.documentElement.style.setProperty('--accent', settings.accent_color)
        }
        const wsData = await api.getWorkspaces()
        let list = wsData.workspaces || []
        if (!list.length) {
          const created = await api.createWorkspace({ name: 'Research Workspace' })
          list = [created.workspace]
        }
        setProjects(list)
        const current = list[0]
        setActiveProjectId(current.id)
        setProjectName(current.name)
        await loadWorkspaceData(current.id)
      } catch (err) {
        showToast(err.message, 'error')
      } finally {
        setProjectLoading(false)
      }
    }
    init()
    return () => window.clearTimeout(toastTimerRef.current)
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    const text = inputValue.trim()
    if (!text) return showToast('Vui lòng nhập câu hỏi', 'warning')
    if (!selectedDocumentIds.length) return showToast('Vui lòng chọn ít nhất một nguồn trước khi hỏi AI.', 'warning')
    setLoading(true)
    setMessages((prev) => [...prev, { id: `tmp-${Date.now()}`, role: 'user', content: text, created_at: new Date().toISOString(), citations: [] }])
    setInputValue('')
    try {
      const res = await api.sendWorkspaceMessage(activeProjectId, { message: text, selected_document_ids: selectedDocumentIds })
      setMessages((prev) => [...prev, res.message || { id: `a-${Date.now()}`, role: 'assistant', content: res.answer, citations: res.citations || [] }])
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return <div className="workspace-shell"><header className="workspace-topbar"><div className="topbar-left"><div className="brand-mark">✦</div><div><p className="brand-title">Research AI</p><p className="brand-meta">{activeCount} tài liệu</p></div></div><div className="topbar-center"><div className="project-selector"><button type="button" className="project-caret" onClick={() => setProjectMenuOpen((v) => !v)} aria-label="Mở danh sách dự án">▾</button><input aria-label="Tên dự án" value={projectName} onChange={(e) => setProjectName(e.target.value)} onBlur={async () => { if (!activeProjectId) return; try { const updated = await api.updateWorkspace(activeProjectId, { name: projectName }); setProjects((prev) => prev.map((p) => (p.id === activeProjectId ? updated.workspace : p))) } catch (err) { showToast(err.message, 'error') } }} />{projectMenuOpen && <div className="project-menu">{projects.map((p) => <button key={p.id} type="button" onClick={async () => { setActiveProjectId(p.id); setProjectName(p.name); setProjectMenuOpen(false); await loadWorkspaceData(p.id) }}>{p.name}</button>)}<div className="project-divider" /><button type="button" onClick={async () => { try { const created = await api.createWorkspace({ name: `Research Workspace ${projects.length + 1}` }); setProjects((prev) => [...prev, created.workspace]); setActiveProjectId(created.workspace.id); setProjectName(created.workspace.name); setProjectMenuOpen(false); await loadWorkspaceData(created.workspace.id) } catch (err) { showToast(err.message, 'error') } }}>+ Tạo dự án mới</button></div>}</div></div><div className="topbar-right"><IconButton icon="＋" label="Tạo đoạn chat mới" onClick={async () => { try { const res = await api.createNewChat(activeProjectId); setMessages(res.messages || []); showToast('Đã tạo đoạn chat mới') } catch (err) { showToast(err.message, 'error') } }} /><IconButton icon="📈" label="Số liệu phân tích" onClick={async () => { try { setAnalytics(await api.getAnalytics(activeProjectId)); setAnalyticsOpen(true) } catch (err) { showToast(err.message, 'error') } }} /><IconButton icon="⚙" label="Cài đặt" onClick={() => setSettingsOpen(true)} /></div></header>
  <div className="workspace-grid"><aside className="workspace-column source-column left-col"><div className="source-head"><div className="search-wrap"><span className="search-icon">⌕</span><input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Tìm tài liệu..." /></div></div><div className="source-list-scroll">{projectLoading ? <div className="doc-empty">Đang tải dữ liệu...</div> : !filteredDocs.length ? <div className="doc-empty">Chưa có tài liệu nào. Hãy tải PDF lên để bắt đầu.</div> : filteredDocs.map((doc) => <div key={doc.id} className={`doc-card ${selectedDocumentIds.includes(doc.id) ? 'is-highlight' : ''}`}><label><input type="checkbox" checked={selectedDocumentIds.includes(doc.id)} onChange={async () => { const next = selectedDocumentIds.includes(doc.id) ? selectedDocumentIds.filter((x) => x !== doc.id) : [...selectedDocumentIds, doc.id]; try { const r = await api.updateSourceSelection(activeProjectId, next); setSelectedDocumentIds(r.selected_document_ids || []) } catch (err) { showToast(err.message, 'error') } }} /><span>📄</span>{doc.title || doc.filename}</label><button type="button" className="doc-delete" onClick={async () => { try { await api.deleteDocument(doc.id); await loadWorkspaceData(activeProjectId); showToast('Đã xoá nguồn khỏi giao diện') } catch (err) { showToast(err.message, 'error') } }}>×</button></div>)}</div><div className="upload-zone-shell"><input ref={fileRef} hidden type="file" accept="application/pdf,.pdf" onChange={(e) => (e.target.files?.[0] ? (async () => { setLoading(true); try { await api.uploadDocument(activeProjectId, e.target.files[0]); await loadWorkspaceData(activeProjectId); showToast(`Đã thêm nguồn: ${e.target.files[0].name}`) } catch (err) { showToast(`Không thể tải tài liệu lên. ${err.message}`, 'error') } finally { setLoading(false) } })() : null)} /><div className="dropzone" onClick={() => fileRef.current?.click()}><span className="drop-icon">⤴</span>Tải tài liệu lên<br /><small>PDF · Tối đa 50MB</small></div></div></aside>
  <main className="workspace-column chat-column mid-col"><div className="panel-header center-title"><h2>CUỘC TRÒ CHUYỆN</h2></div><div className="chat-messages chat-zone">{!messages.length ? <div className="doc-empty">Chưa có hội thoại nào. Hãy gửi câu hỏi đầu tiên.</div> : messages.map((m) => <div key={m.id} className={`bubble ${m.role}`}><p style={{ fontFamily: "'Lora', serif" }}>{m.content}</p><div className="message-actions"><span className="brand-meta">{m.created_at ? new Date(m.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Bây giờ'}</span>{m.citations?.map((c, idx) => <button type="button" className="cite-pill" key={c.id || idx} onClick={() => { setActiveCitationId(c.document_id || c.paper_id || null) }}>[{idx + 1}]</button>)}{m.role === 'assistant' && <button type="button" className="save-note" onClick={async () => { try { await api.createNote(activeProjectId, { title: m.content.slice(0, 48) || 'Ghi chú từ chat', content: m.content, citations: m.citations || [], source_message_id: m.id }); const n = await api.getNotes(activeProjectId); setNotes(n.notes || []); showToast('Đã lưu vào ghi chú') } catch (err) { showToast(err.message, 'error') } }}>Lưu vào ghi chú</button>}</div></div>)}<div ref={messagesEndRef} /></div><div className="chat-input-shell"><div className="composer"><textarea value={inputValue} onChange={(e) => { setInputValue(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px` }} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }} placeholder="Đặt câu hỏi về tài liệu của bạn..." /><div><span>Enter gửi · Shift+Enter xuống dòng</span><button type="button" className={`send-btn ${inputValue.trim() && !loading ? 'active' : ''}`} onClick={sendMessage}>➤</button></div></div></div></main>
  <aside className="workspace-column right-col"><div className="panel-header"><h3>Studio</h3><p className="brand-meta">Chạy prompt template và trả kết quả trực tiếp vào chat</p></div><div className="template-grid">{STUDIO_TEMPLATES.map((t) => <button key={t.label} type="button" className="template" onClick={async () => { if (!selectedDocumentIds.length) return showToast('Vui lòng chọn ít nhất một nguồn trước khi hỏi AI.', 'warning'); try { const r = await api.runStudioTemplate(activeProjectId, { template: t.key, selected_document_ids: selectedDocumentIds }); const studioMessage = r.message || { id: `studio-${Date.now()}`, role: 'assistant', content: r.content, citations: r.citations || [] }; setMessages((prev) => [...prev, studioMessage]); } catch (err) { showToast(err.message, 'error') } }}>{t.label}<span>›</span></button>)}</div><div className="notes-head"><h4>Ghi chú đã lưu</h4><button type="button" className="save-note" onClick={async () => { try { await api.createNote(activeProjectId, { title: 'Ghi chú mới', content: '' }); const n = await api.getNotes(activeProjectId); setNotes(n.notes || []); showToast('Đã thêm ghi chú mới') } catch (err) { showToast(err.message, 'error') } }}>+ Thêm ghi chú</button></div><div className="scroll-zone">{!notes.length ? <div className="note"><strong>Chưa có ghi chú nào.</strong><p>Hãy lưu một câu trả lời từ Chat.</p></div> : notes.map((n) => <article key={n.id} className="note note-card"><button type="button" className="note-card-delete" aria-label="Xoá ghi chú" onClick={async (e) => { e.stopPropagation(); try { await api.deleteNote(n.id); setNotes((prev) => prev.filter((x) => x.id !== n.id)); showToast('Đã xoá ghi chú.') } catch (err) { showToast('Không thể xoá ghi chú.', 'error') } }}>×</button><strong>{n.title}</strong><p>{n.content || 'Ghi chú trống.'}</p><div className="note-actions"><button type="button" className="save-note" onClick={() => showToast('Chỉnh sửa ghi chú demo', 'info')}>Sửa</button></div></article>)}{activeCitationId && <div className="source-card is-highlight"><header><h4>Nguồn liên quan</h4></header><p className="source-doc">Đang chọn citation thuộc document ID: {String(activeCitationId)}</p></div>}</div></aside></div>
  {analyticsOpen && <div className="modal-wrap"><div className="panel modal-panel"><h3>Analytics</h3><p className="analytics-line">Tài liệu: <strong>{analytics?.document_count ?? 0}</strong></p><p className="analytics-line">Nguồn đã chọn: <strong>{analytics?.selected_source_count ?? 0}</strong></p><p className="analytics-line">Tin nhắn: <strong>{analytics?.chat_message_count ?? 0}</strong></p><p className="analytics-line">Ghi chú: <strong>{analytics?.note_count ?? 0}</strong></p><p className="analytics-line">Trích dẫn: <strong>{analytics?.citation_count ?? 0}</strong></p><div className="modal-actions"><button type="button" onClick={() => setAnalyticsOpen(false)}>Đóng</button></div></div></div>}
  {settingsOpen && <div className="modal-wrap"><div className="panel modal-panel"><h3>Cài đặt giao diện</h3><label className="modal-field">Accent color</label><input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} /><div className="modal-actions"><button type="button" onClick={async () => { try { const s = await api.updateSettings({ theme_mode: 'dark', accent_color: accentColor }); document.documentElement.style.setProperty('--accent', s.accent_color); setSettingsOpen(false) } catch (err) { showToast(err.message, 'error') } }}>Lưu</button><button type="button" onClick={() => setSettingsOpen(false)}>Đóng</button></div></div></div>}
  <Toast toast={toast} onClose={() => setToast(null)} /></div>
}
