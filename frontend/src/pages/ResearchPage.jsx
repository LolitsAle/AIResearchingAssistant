import { useEffect, useMemo, useRef, useState } from 'react'

const DOCUMENTS = [
  { id: 1, name: 'Attention Is All You Need', type: 'PDF', size: '1.2 MB', date: 'May 20', pages: 15, active: true },
  { id: 2, name: 'BERT: Pre-training of Deep Bidirectional Transformers', type: 'PDF', size: '980 KB', date: 'May 19', pages: 16, active: false },
  { id: 3, name: 'GPT-4 Technical Report', type: 'PDF', size: '2.1 MB', date: 'May 18', pages: 100, active: false },
  { id: 4, name: 'Chain-of-Thought Prompting', type: 'PDF', size: '654 KB', date: 'May 17', pages: 12, active: false },
  { id: 5, name: 'LLaMA 2: Open Foundation Models', type: 'PDF', size: '3.4 MB', date: 'May 16', pages: 77, active: false },
]

const INITIAL_MESSAGES = [
  { id: 1, role: 'assistant', content: 'Xin chào! Tôi là trợ lý nghiên cứu AI của bạn. Tôi đã phân tích 5 tài liệu trong thư viện của bạn. Bạn muốn khám phá chủ đề nào hôm nay?', timestamp: '10:24 SA', sources: [] },
  { id: 2, role: 'user', content: 'Cơ chế attention trong Transformer hoạt động như thế nào? Giải thích chi tiết về scaled dot-product attention.', timestamp: '10:25 SA' },
]

const SOURCE_CARDS = [
  { id: 1, title: 'Attention Is All You Need', authors: 'Vaswani et al., 2017', excerpt: 'Scaled dot-product attention computes the dot products of the query with all keys, divide each by √d_k, and apply a softmax function.', page: 4, relevance: 98, color: '#6366f1' },
  { id: 2, title: 'BERT: Pre-training of Deep Bidirectional Transformers', authors: 'Devlin et al., 2019', excerpt: 'BERT uses bidirectional self-attention, while GPT uses constrained self-attention.', page: 3, relevance: 84, color: '#8b5cf6' },
]

const STUDIO_TEMPLATES = [
  'Tóm tắt chuyên sâu', 'Rút trích luận điểm', 'Hỏi đáp theo từng đoạn', 'Giải thích thuật ngữ', 'So sánh nhiều nguồn',
  'Trả lời có trích dẫn', 'Flashcards', 'Bài kiểm tra', 'Bảng dữ liệu',
]

function IconButton({ icon, label, onClick }) {
  return <button type="button" className="icon-btn" aria-label={label} data-tooltip={label} onClick={onClick}>{icon}</button>
}

export default function ResearchPage() {
  const [projects, setProjects] = useState([
    { id: 'p1', name: 'Foundations of Entity-Relationship Database Modeling' },
    { id: 'p2', name: 'Transformer Fundamentals' },
  ])
  const [activeProjectId, setActiveProjectId] = useState('p1')
  const [projectName, setProjectName] = useState('Foundations of Entity-Relationship Database Modeling')
  const [projectMenuOpen, setProjectMenuOpen] = useState(false)

  const [documents, setDocuments] = useState(DOCUMENTS)
  const [sourceCards, setSourceCards] = useState(SOURCE_CARDS)
  const [messages, setMessages] = useState(INITIAL_MESSAGES)
  const [notes, setNotes] = useState([])

  const [inputValue, setInputValue] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isTyping, setIsTyping] = useState(false)

  const messagesEndRef = useRef(null)

  const filteredDocs = useMemo(() => documents.filter((d) => d.name.toLowerCase().includes(searchQuery.toLowerCase())), [documents, searchQuery])
  const activeCount = documents.filter((d) => d.active).length

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const sendMessage = () => {
    if (!inputValue.trim()) return
    const userMsg = { id: Date.now(), role: 'user', content: inputValue.trim(), timestamp: 'Bây giờ' }
    setMessages((prev) => [...prev, userMsg])
    setInputValue('')
    setIsTyping(true)
    setTimeout(() => {
      setMessages((prev) => [...prev, { id: Date.now() + 1, role: 'assistant', content: 'Đây là phản hồi mô phỏng từ AI dựa trên các nguồn đang chọn.', timestamp: 'Bây giờ', sources: [1] }])
      setIsTyping(false)
    }, 1200)
  }

  return <div className="workspace-shell"><header className="workspace-topbar"><div className="topbar-left"><div className="brand-mark">✦</div><div><p className="brand-title">Research AI</p><p className="brand-meta">{activeCount} tài liệu</p></div></div><div className="topbar-center"><div className="project-selector"><button type="button" className="project-caret" onClick={() => setProjectMenuOpen((v) => !v)} aria-label="Mở danh sách dự án">▾</button><input aria-label="Tên dự án" value={projectName} onChange={(e) => setProjectName(e.target.value)} onBlur={() => setProjects((prev) => prev.map((p) => (p.id === activeProjectId ? { ...p, name: projectName } : p)))} />{projectMenuOpen && <div className="project-menu">{projects.map((p) => <button key={p.id} type="button" onClick={() => { setActiveProjectId(p.id); setProjectName(p.name); setProjectMenuOpen(false) }}>{p.name}</button>)}<div className="project-divider" /><button type="button" onClick={() => { const id = `p${Date.now()}`; const name = `Research Project ${projects.length + 1}`; setProjects((prev) => [...prev, { id, name }]); setActiveProjectId(id); setProjectName(name); setProjectMenuOpen(false) }}>+ Tạo dự án mới</button></div>}</div></div><div className="topbar-right"><IconButton icon="＋" label="Tạo đoạn chat mới" onClick={() => setMessages([])} /><IconButton icon="📈" label="Số liệu phân tích" onClick={() => {}} /><IconButton icon="⚙" label="Cài đặt" onClick={() => {}} /></div></header>
  <div className="workspace-grid"><aside className="workspace-column left-col"><div className="search-wrap"><span className="search-icon">⌕</span><input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Tìm tài liệu..." /></div><div className="scroll-zone">{filteredDocs.map((doc) => <div key={doc.id} onClick={() => setDocuments((prev) => prev.map((d) => (d.id === doc.id ? { ...d, active: !d.active } : d)))} className={`doc-card ${doc.active ? 'is-highlight' : ''}`}><label><span>📄</span>{doc.name}</label><button type="button" className="doc-delete" onClick={(e) => { e.stopPropagation(); setDocuments((prev) => prev.filter((d) => d.id !== doc.id)) }}>×</button></div>)}</div><div className={`dropzone ${isDragging ? 'dragging' : ''}`} onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }} onDragLeave={() => setIsDragging(false)} onDrop={(e) => { e.preventDefault(); setIsDragging(false) }}><span className="drop-icon">⤴</span>Tải tài liệu lên<br /><small>PDF, DOCX, TXT · Tối đa 50MB</small></div></aside>
  <main className="workspace-column mid-col"><div className="panel-header center-title"><h2>CUỘC TRÒ CHUYỆN</h2></div><div className="chat-zone scroll-zone">{messages.map((m) => <div key={m.id} className={`bubble ${m.role}`}><p style={{ fontFamily: "'Lora', serif" }}>{m.content}</p><div className="message-actions"><span className="brand-meta">{m.timestamp}</span>{m.sources?.map((s) => <span className="cite-pill" key={s}>[{s}]</span>)}</div></div>)}{isTyping && <div className="bubble assistant">● ● ●</div>}<div ref={messagesEndRef} /></div><div className="composer"><textarea value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }} placeholder="Đặt câu hỏi về tài liệu của bạn..." /><div><span>Enter gửi · Shift+Enter xuống dòng</span><button type="button" className={`send-btn ${inputValue.trim() && !isTyping ? 'active' : ''}`} onClick={sendMessage}>➤</button></div></div></main>
  <aside className="workspace-column right-col"><div className="panel-header"><h3>Studio</h3><p className="brand-meta">Tạo ghi chú, flashcards và tổng hợp từ nguồn đã chọn</p></div><div className="template-grid">{STUDIO_TEMPLATES.map((t) => <button key={t} type="button" className="template" onClick={() => setNotes((prev) => [{ id: Date.now(), title: t, content: `Kết quả mẫu cho: ${t}` }, ...prev])}>{t}<span>›</span></button>)}</div><div className="notes-head"><h4>Ghi chú đã lưu</h4><button type="button" className="save-note" onClick={() => setNotes((prev) => [{ id: Date.now(), title: 'Ghi chú mới', content: 'Nội dung ghi chú...' }, ...prev])}>+ Thêm ghi chú</button></div><div className="scroll-zone">{!notes.length ? <div className="note"><strong>Chưa có ghi chú</strong><p>Đầu ra của Studio sẽ được lưu ở đây. Bạn có thể lưu câu trả lời từ Chat hoặc tạo ghi chú mới.</p></div> : notes.map((n) => <article key={n.id} className="note"><strong>{n.title}</strong><p>{n.content}</p><div className="note-actions"><button type="button" className="save-note" onClick={() => {}}>Sửa</button><button type="button" className="save-note" onClick={() => setNotes((prev) => prev.filter((x) => x.id !== n.id))}>Xóa</button></div></article>)}<div className="source-card"><header><h4>Nguồn liên quan gần đây</h4></header>{sourceCards.map((card) => <p key={card.id} className="source-doc">• {card.title}</p>)}</div></div></aside></div></div>
}
