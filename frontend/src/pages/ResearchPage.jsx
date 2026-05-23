import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ChatBox from '../components/ChatBox'
import DocumentList from '../components/DocumentList'
import DocumentUploader from '../components/DocumentUploader'
import SourceCard from '../components/SourceCard'
import { api } from '../services/api'

const quickActions = [
  'Tóm tắt tài liệu này',
  'Rút ra các ý chính',
  'So sánh các nguồn',
  'Tìm rủi ro hoặc điểm bất thường',
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
  const [mobilePane, setMobilePane] = useState('chat')

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
      setMobilePane('sources')
    } catch (err) {
      setError(err.message || 'Không thể gửi câu hỏi tới hệ thống.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="research-page">
      <div className="mobile-switcher card-glass">
        <button className={mobilePane === 'docs' ? 'is-active' : ''} onClick={() => setMobilePane('docs')}>Tài liệu</button>
        <button className={mobilePane === 'chat' ? 'is-active' : ''} onClick={() => setMobilePane('chat')}>Chat AI</button>
        <button className={mobilePane === 'sources' ? 'is-active' : ''} onClick={() => setMobilePane('sources')}>Nguồn</button>
      </div>

      <aside className={`left-panel card-glass mobile-pane ${mobilePane === 'docs' ? 'show-pane' : ''}`}>
        <Link to="/" className="brand">AI Research Notebook</Link>
        <p className="muted">Knowledge workspace cho nghiên cứu học thuật.</p>
        <button className="new-notebook" onClick={() => navigate('/research/new')}>+ Tạo phiên nghiên cứu mới</button>

        <DocumentUploader
          onSuccess={(doc) => {
            setDocuments((prev) => [doc, ...prev])
            const newId = doc?.id || doc?.doc_id
            if (newId) navigate(`/research/${newId}`)
          }}
        />

        <DocumentList
          documents={documents}
          selectedId={docId}
          onSelect={(id) => {
            navigate(`/research/${id}`)
            setMobilePane('chat')
          }}
          onDelete={async (id) => {
            await api.deletePaper(id)
            setDocuments((prev) => prev.filter((item) => (item.id || item.doc_id) !== id))
          }}
        />
      </aside>

      <main className={`main-panel card-glass mobile-pane ${mobilePane === 'chat' ? 'show-pane' : ''}`}>
        <header className="workspace-header">
          <h2>{selectedDoc?.title || selectedDoc?.filename || 'Notebook nghiên cứu mới'}</h2>
          <p>{selectedDoc ? 'Hỏi AI dựa trên tài liệu của bạn. Câu trả lời ưu tiên trích dẫn nguồn.' : 'Tải lên một tài liệu PDF để bắt đầu notebook nghiên cứu.'}</p>
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

      <aside className={`right-panel card-glass mobile-pane ${mobilePane === 'sources' ? 'show-pane' : ''}`}>
        <h3>Nguồn tham chiếu</h3>
        <p className="muted">Citation-first answers cho từng phản hồi của AI.</p>
        {!sources.length ? (
          <p className="muted">Chưa có nguồn. Hãy gửi câu hỏi để AI tìm các đoạn liên quan trong tài liệu.</p>
        ) : (
          sources.map((source, idx) => <SourceCard key={source.chunk_id || idx} source={source} />)
        )}
      </aside>
    </div>
  )
}
