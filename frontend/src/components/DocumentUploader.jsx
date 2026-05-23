import { useRef, useState } from 'react'
import { api } from '../services/api'

export default function DocumentUploader({ onSuccess }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  const handleFile = async (file) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Chỉ chấp nhận file PDF.')
      return
    }

    setUploading(true)
    setError('')

    try {
      const result = await api.uploadPaper(file)
      onSuccess?.(result?.paper)
    } catch (err) {
      setError(err.message || 'Upload thất bại. Vui lòng thử lại.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <section className="uploader-card">
      <div className="uploader-icon" aria-hidden>
        ⬆
      </div>
      <h3>Tải lên paper PDF</h3>
      <p>Hỗ trợ tài liệu PDF học thuật để AI đọc và phân tích tự động.</p>

      <label className={`upload-button ${uploading ? 'is-disabled' : ''}`}>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e) => handleFile(e.target.files?.[0])}
          disabled={uploading}
        />
        {uploading ? 'AI đang phân tích tài liệu...' : 'Chọn file PDF'}
      </label>

      {uploading && <div className="uploader-status">Đang tải tài liệu lên hệ thống...</div>}
      {error && <div className="uploader-error">{error}</div>}
    </section>
  )
}
