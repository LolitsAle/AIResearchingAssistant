import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DocumentList from '../components/DocumentList'
import DocumentUploader from '../components/DocumentUploader'
import { api } from '../services/api'

const features = [
  'Tóm tắt paper',
  'Trích xuất đóng góp chính',
  'Hỏi đáp theo tài liệu',
  'Giải thích thuật ngữ học thuật',
  'So sánh nhiều paper',
  'Hiển thị nguồn trích dẫn',
]

export default function HomePage() {
  const navigate = useNavigate()
  const [documents, setDocuments] = useState([])

  const loadDocs = async () => {
    const data = await api.listPapers()
    setDocuments(data?.papers || [])
  }

  useEffect(() => {
    loadDocs().catch(console.error)
  }, [])

  return (
    <div className="home-page">
      <section className="hero card-glass">
        <div>
          <h1>AI Researching Assistant</h1>
          <p>Trợ lý AI giúp bạn đọc, hiểu, tóm tắt và so sánh tài liệu học thuật nhanh hơn.</p>
          <div className="hero-actions">
            <button onClick={() => navigate('/research/new')} className="btn-primary">Bắt đầu nghiên cứu</button>
            <button onClick={() => document.querySelector('.uploader-card input')?.click()} className="btn-secondary">Tải tài liệu PDF</button>
          </div>
        </div>
        <div className="hero-visual">
          <div className="mini-chat">
            <p><strong>AI Agent:</strong> Câu trả lời được tạo dựa trên nội dung tài liệu.</p>
            <p><strong>Nguồn:</strong> 3 đoạn trích từ phần Methodology và Results.</p>
          </div>
        </div>
      </section>

      <section className="home-grid">
        <div className="card-glass">
          <h3>Tính năng nghiên cứu</h3>
          <div className="feature-grid">
            {features.map((feature) => <span key={feature}>{feature}</span>)}
          </div>
        </div>

        <div className="card-glass">
          <DocumentUploader onSuccess={(doc) => setDocuments((prev) => [doc, ...prev])} />
          <DocumentList
            documents={documents}
            onSelect={(id) => navigate(`/research/${id}`)}
            onDelete={async (id) => {
              await api.deletePaper(id)
              setDocuments((prev) => prev.filter((item) => (item.id || item.doc_id) !== id))
            }}
          />
        </div>
      </section>
    </div>
  )
}
