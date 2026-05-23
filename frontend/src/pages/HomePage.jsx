import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DocumentList from '../components/DocumentList'
import DocumentUploader from '../components/DocumentUploader'
import { api } from '../services/api'

const features = [
  'Tóm tắt tài liệu chuyên sâu',
  'Rút trích luận điểm chính',
  'Hỏi đáp theo từng đoạn paper',
  'Giải thích thuật ngữ khó',
  'So sánh nhiều nguồn',
  'Trả lời có trích dẫn nguồn',
]

export default function HomePage() {
  const navigate = useNavigate()
  const [documents, setDocuments] = useState([])

  useEffect(() => {
    api.listPapers().then((data) => setDocuments(data?.papers || [])).catch(console.error)
  }, [])

  return (
    <div className="home-page">
      <section className="hero card-glass">
        <div>
          <span className="hero-chip">Research Notebook • AI Agent</span>
          <h1>AI Researching Assistant</h1>
          <p>
            Không gian nghiên cứu yên tĩnh để bạn tải tài liệu, hỏi AI theo ngữ cảnh và kiểm chứng câu trả lời bằng nguồn trích dẫn.
          </p>
          <div className="hero-actions">
            <button onClick={() => navigate('/research/new')} className="btn-primary">Bắt đầu nghiên cứu</button>
            <button onClick={() => document.querySelector('.uploader-card input')?.click()} className="btn-secondary">Tải tài liệu PDF</button>
          </div>
        </div>

        <div className="hero-visual">
          <div className="mini-chat">
            <p><strong>Notebook:</strong> “Hỏi AI dựa trên tài liệu của bạn”</p>
            <p><strong>AI:</strong> Tóm tắt + đối chiếu nguồn ở trang 12–14.</p>
            <p><strong>Citations:</strong> 4 nguồn liên quan được tìm thấy.</p>
          </div>
        </div>
      </section>

      <section className="home-grid">
        <article className="card-glass home-card">
          <h3>Tại sao giao diện này hiệu quả cho nghiên cứu?</h3>
          <div className="feature-grid">
            {features.map((feature) => <span key={feature}>{feature}</span>)}
          </div>
        </article>

        <article className="card-glass home-card">
          <DocumentUploader onSuccess={(doc) => setDocuments((prev) => [doc, ...prev])} />
          <DocumentList
            documents={documents}
            onSelect={(id) => navigate(`/research/${id}`)}
            onDelete={async (id) => {
              await api.deletePaper(id)
              setDocuments((prev) => prev.filter((item) => (item.id || item.doc_id) !== id))
            }}
          />
        </article>
      </section>
    </div>
  )
}
