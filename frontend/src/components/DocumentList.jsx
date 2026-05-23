function formatDate(value) {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toLocaleDateString('vi-VN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function toStatus(status) {
  const normalized = String(status || '').toLowerCase()
  if (normalized.includes('process') || normalized.includes('pending'))
    return { label: 'Đang xử lý', tone: 'processing' }
  if (normalized.includes('error') || normalized.includes('fail'))
    return { label: 'Lỗi', tone: 'error' }
  return { label: 'Sẵn sàng', tone: 'ready' }
}

export default function DocumentList({
  documents = [],
  selectedId,
  onSelect,
  onDelete,
}) {
  if (!documents.length)
    return <div className="doc-empty">Chưa có tài liệu nào.</div>

  return (
    <div className="doc-list">
      {documents.map((doc) => {
        const docId     = doc?.id || doc?.doc_id
        const title     = doc?.title || doc?.filename || 'Tài liệu chưa đặt tên'
        const status    = toStatus(doc?.status)
        const createdAt = formatDate(doc?.created_at || doc?.createdAt)

        return (
          <article
            key={docId}
            className={`doc-item fade-in ${String(selectedId) === String(docId) ? 'is-active' : ''}`}
            onClick={() => onSelect?.(docId)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onSelect?.(docId)}
          >
            <div className="doc-main">
              <h4>📄 {title}</h4>
              <div className="doc-meta">
                <span className={`status-badge ${status.tone}`}>{status.label}</span>
                {createdAt && <span>{createdAt}</span>}
              </div>
            </div>

            <button
              className="doc-delete"
              onClick={(e) => {
                e.stopPropagation()
                onDelete?.(docId)
              }}
              aria-label="Xóa tài liệu"
            >
              ×
            </button>
          </article>
        )
      })}
    </div>
  )
}
