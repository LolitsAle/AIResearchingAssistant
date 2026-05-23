import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ChatBox from '../components/ChatBox'
import DocumentList from '../components/DocumentList'
import DocumentUploader from '../components/DocumentUploader'
import SourceCard from '../components/SourceCard'
import { api } from '../services/api'

const quickActions = [
  'Tóm tắt tài liệu',
  'Trích xuất đóng góp chính',
  'Giải thích phương pháp',
  'Tìm hạn chế nghiên cứu',
  'Giải thích thuật ngữ khó',
  'So sánh paper',
]

export default function ResearchPage() {
  const { docId } = useParams()
  const navigate = useNavigate()
  const [documents, setDocuments] = useState([])
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sources, setSources] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const selectedDoc = useMemo(
    () => documents.find((doc) => String(doc.id || doc.doc_id) === String(docId)),
    [documents, docId],
  )

  useEffect(() => {
    api.listPapers().then((d) => setDocuments(d?.papers || [])).catch(console.error)
  }, [])

  const sendQuestion = async (text = input) => {
    if (!docId || docId === 'new') return
    const question = text.trim()
    if (!question || loading) return
    setError('')
    setInput('')
    setMessages((v) => [...v, { role: 'user', content: question }])
    setLoading(true)
    try {
      const r = await api.ask(docId, question)
      setMessages((v) => [...v, { role: 'assistant', content: r?.answer || 'Không có câu trả lời phù hợp.' }])
      setSources(Array.isArray(r?.citations) ? r.citations : [])
    } catch (err) {
      setError(err.message || 'API error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="research-page">
      <aside className="left-panel card-glass">
        <Link to="/" className="brand">AI Researching Assistant</Link>
        <p className="muted">Workspace nghiên cứu học thuật với AI Agent.</p>
        <DocumentUploader onSuccess={(doc) => {
          setDocuments((prev) => [doc, ...prev])
          const newId = doc?.id || doc?.doc_id
          if (newId) navigate(`/research/${newId}`)
        }} />
        <DocumentList
          documents={documents}
          selectedId={docId}
          onSelect={(id) => navigate(`/research/${id}`)}
          onDelete={async (id) => {
            await api.deletePaper(id)
            setDocuments((prev) => prev.filter((item) => (item.id || item.doc_id) !== id))
          }}
        />
      </aside>

      <main className="main-panel card-glass">
        <header className="workspace-header">
          <h2>{selectedDoc?.title || selectedDoc?.filename || 'Chưa chọn tài liệu'}</h2>
          <p>{selectedDoc ? 'Câu trả lời được tạo dựa trên nội dung tài liệu.' : 'Tải lên một paper PDF để AI bắt đầu đọc và phân tích.'}</p>
        </header>

        <div className="quick-actions">
          {quickActions.map((action) => (
            <button key={action} onClick={() => setInput(action)}>{action}</button>
          ))}
        </div>

        <ChatBox
          messages={messages}
          value={input}
          onChange={setInput}
          onSubmit={() => sendQuestion()}
          loading={loading}
          error={error}
          disabled={!selectedDoc}
          sourcesCount={sources.length}
        />
      </main>

      <aside className="right-panel card-glass">
        <h3>Nguồn tham chiếu</h3>
        {!sources.length ? (
          <p className="muted">Không tìm thấy nguồn phù hợp trong tài liệu.</p>
        ) : (
          sources.map((source, idx) => <SourceCard key={source.chunk_id || idx} source={source} />)
        )}
      </aside>
    </div>
  )
}
