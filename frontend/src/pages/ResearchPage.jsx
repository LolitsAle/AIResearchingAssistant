import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ChatBox from '../components/ChatBox'
import SourceCard from '../components/SourceCard'
import { sendResearchQuery } from '../services/api'

export default function ResearchPage() {
  const { docId } = useParams()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sources, setSources] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const chatHistory = useMemo(() => messages.map(({ role, content }) => ({ role, content })), [messages])

  const handleSubmit = async () => {
    const question = input.trim()
    if (!question || loading) return

    setError('')
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: question }])
    setLoading(true)

    try {
      const data = await sendResearchQuery({ docId, question, chatHistory })
      setMessages((prev) => [...prev, { role: 'assistant', content: data?.answer || 'Không có nội dung trả lời.' }])
      setSources(Array.isArray(data?.sources) ? data.sources : [])
    } catch (err) {
      setError(err.message || 'Không thể nhận phản hồi từ hệ thống.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <Link to="/">← Quay lại trang tài liệu</Link>
      <h2>Nghiên cứu tài liệu</h2>
      <p style={{ fontSize: 14, color: '#475569' }}>Mã tài liệu: {docId}</p>

      <div className="research-layout">
        <section className="card">
          <ChatBox
            messages={messages}
            value={input}
            onChange={setInput}
            onSubmit={handleSubmit}
            loading={loading}
            error={error}
            disabled={!docId}
          />
        </section>

        <aside className="card">
          <h3 style={{ marginTop: 0 }}>Nguồn tham khảo</h3>
          {sources.length === 0 ? (
            <p style={{ color: '#64748b' }}>Chưa có nguồn tham khảo. Hãy gửi câu hỏi để xem các đoạn trích liên quan.</p>
          ) : (
            sources.map((source, index) => <SourceCard key={source.chunk_id || index} source={source} />)
          )}
        </aside>
      </div>
    </div>
  )
}
