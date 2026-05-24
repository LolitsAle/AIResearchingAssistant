import { useEffect, useRef, useState } from 'react'

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
  { id: 3, role: 'assistant', content: 'Scaled dot-product attention là trái tim của kiến trúc Transformer. Cơ chế này hoạt động theo ba bước chính:\n\n**1. Tạo Queries, Keys và Values**\nTừ vector đầu vào, mô hình học ba ma trận chiếu (W_Q, W_K, W_V) để tạo ra Q, K, V tương ứng.\n\n**2. Tính Attention Scores**\nĐiểm attention được tính bằng tích vô hướng của Q và K, sau đó chia cho √d_k để ổn định gradient:\n\nAttention(Q, K, V) = softmax(QK^T / √d_k) · V\n\n**3. Weighted Sum**\nSau khi qua softmax, các trọng số được nhân với V để tạo ra đầu ra cuối cùng.', timestamp: '10:25 SA', sources: [1, 2] },
]

const SOURCE_CARDS = [
  { id: 1, title: 'Attention Is All You Need', authors: 'Vaswani et al., 2017', excerpt: 'Scaled dot-product attention computes the dot products of the query with all keys, divide each by √d_k, and apply a softmax function.', page: 4, relevance: 98, color: '#6366f1' },
  { id: 2, title: 'BERT: Pre-training of Deep Bidirectional Transformers', authors: 'Devlin et al., 2019', excerpt: 'BERT uses bidirectional self-attention, while the GPT language model uses constrained self-attention where every token can only attend to context to its left.', page: 3, relevance: 84, color: '#8b5cf6' },
  { id: 3, title: 'GPT-4 Technical Report', authors: 'OpenAI, 2023', excerpt: 'The architecture follows the transformer architecture with some modifications including pre-normalization using RMSNorm.', page: 7, relevance: 71, color: '#06b6d4' },
]

function DocumentItem({ doc, onToggle, onDismiss }) {
  return <div onClick={() => onToggle(doc.id)} className={`doc-card ${doc.active ? 'is-highlight' : ''}`}><label><span>📄</span>{doc.name}</label><button type="button" className="doc-delete" onClick={(e) => { e.stopPropagation(); onDismiss(doc.id) }}>×</button></div>
}

function ChatMessage({ message }) {
  const isAssistant = message.role === 'assistant'
  return <div className={`bubble ${message.role}`}><p style={{ fontFamily: "'Lora', serif" }}>{message.content}</p><div className="message-actions"><span className="font-mono text-[10px] text-muted-foreground/60">{message.timestamp}</span>{isAssistant && message.sources?.length > 0 && message.sources.map((s) => <span key={s} className="cite-pill">[{s}]</span>)}</div></div>
}

function SourceCard({ card, onDismiss }) {
  const [expanded, setExpanded] = useState(false)
  return <div className="source-card" onClick={() => setExpanded((v) => !v)} style={{ borderLeftColor: card.color, borderLeftWidth: 2 }}><header><h4 style={{ fontFamily: "'Lora', serif" }}>{card.title}</h4><span className="page-badge" style={{ backgroundColor: `${card.color}20`, color: card.color }}>{card.relevance}%</span></header><div className="source-doc">{card.authors}</div><p style={{ WebkitLineClamp: expanded ? 'unset' : 3 }}>{card.excerpt}</p><div className="source-footer"><span className="source-score">Trang {card.page}</span><button type="button" className="source-open" onClick={(e) => { e.stopPropagation(); onDismiss(card.id) }}>Bỏ ↗</button></div></div>
}

export default function ResearchPage() {
  const [documents, setDocuments] = useState(DOCUMENTS)
  const [sourceCards, setSourceCards] = useState(SOURCE_CARDS)
  const [messages, setMessages] = useState(INITIAL_MESSAGES)
  const [inputValue, setInputValue] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, isTyping])

  const filteredDocs = documents.filter((d) => d.name.toLowerCase().includes(searchQuery.toLowerCase()))
  const activeCount = documents.filter((d) => d.active).length

  const sendMessage = () => {
    if (!inputValue.trim()) return
    const userMsg = { id: Date.now(), role: 'user', content: inputValue.trim(), timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) }
    setMessages((prev) => [...prev, userMsg])
    setInputValue('')
    setIsTyping(true)
    setTimeout(() => {
      const aiMsg = { id: Date.now() + 1, role: 'assistant', content: 'Đây là một câu hỏi thú vị. Dựa trên các tài liệu bạn đã tải lên, tôi có thể cung cấp phân tích chi tiết về chủ đề này. Hãy để tôi tổng hợp thông tin từ nhiều nguồn khác nhau trong thư viện của bạn...', timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }), sources: [1, 3] }
      setIsTyping(false)
      setMessages((prev) => [...prev, aiMsg])
    }, 1800)
  }

  return <div className="agent-root"><div className="agent-grid" style={{ height: '100vh' }}><aside className="panel" style={{ width: '20%', minWidth: 200, borderRight: '1px solid var(--border)' }}><div className="panel-header"><h3>ResearchAI · {activeCount} tài liệu</h3></div><div className="search-wrap"><span className="search-icon">⌕</span><input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Tìm tài liệu..." /></div><div className="scroll-zone">{filteredDocs.map((doc) => <DocumentItem key={doc.id} doc={doc} onToggle={(id) => setDocuments((prev) => prev.map((d) => d.id === id ? { ...d, active: !d.active } : d))} onDismiss={(id) => setDocuments((prev) => prev.filter((d) => d.id !== id))} />)}</div><div className={`dropzone ${isDragging ? 'dragging' : ''}`} onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }} onDragLeave={() => setIsDragging(false)} onDrop={(e) => { e.preventDefault(); setIsDragging(false) }}><span className="drop-icon">⤴</span>Tải tài liệu lên<br /><small>PDF, DOCX, TXT · Tối đa 50MB</small></div></aside>
  <main className="chat-panel" style={{ width: '55%', borderRight: '1px solid var(--border)' }}><div className="panel-header center-title"><h2>CUỘC TRÒ CHUYỆN</h2><p className="source-hint">● {activeCount} tài liệu · Phiên #123</p></div><div className="chat-zone">{messages.map((m) => <ChatMessage key={m.id} message={m} />)}{isTyping && <div className="bubble assistant"><p>● ● ●</p></div>}<div ref={messagesEndRef} /></div><div className="composer"><textarea value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }} placeholder="Đặt câu hỏi về tài liệu của bạn..." /><div><span>Enter để gửi · Shift+Enter xuống dòng</span><button type="button" className={`send-btn ${inputValue.trim() && !isTyping ? 'active' : ''}`} onClick={sendMessage}>➤</button></div></div></main>
  <aside className="panel" style={{ width: '25%', minWidth: 220 }}><div className="panel-header"><h3>Nguồn tham chiếu ({sourceCards.length})</h3></div><div className="source-hint">Độ liên quan</div><div className="scroll-zone">{sourceCards.map((card) => <SourceCard key={card.id} card={card} onDismiss={(id) => setSourceCards((prev) => prev.filter((c) => c.id !== id))} />)}<div className="note"><strong>Tóm tắt phiên</strong><p>Cuộc trò chuyện này đã đề cập đến cơ chế attention, multi-head attention, và kiến trúc Transformer.</p></div></div><div className="source-footer"><span className="source-score">Câu hỏi: {messages.filter((m) => m.role === 'user').length}</span><span className="source-score">Nguồn: {sourceCards.length}</span><span className="source-score">Tài liệu: {activeCount}</span></div></aside></div></div>
}
