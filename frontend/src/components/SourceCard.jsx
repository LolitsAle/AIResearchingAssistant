function toScore(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null
  return `${Math.round(value * 100)}%`
}

export default function SourceCard({ source }) {
  if (!source) return null

  const section = source.section || source.title || source.document_name || 'Nguồn tham chiếu'
  const docName = source.document_name || source.filename || 'Tài liệu đã chọn'
  const page = source.page || source.page_start
  const pageEnd = source.page_end
  const pageText = page ? (pageEnd && pageEnd !== page ? `Trang ${page}-${pageEnd}` : `Trang ${page}`) : 'Không rõ vị trí'
  const score = toScore(source.score)
  const snippet = source.snippet || source.content || source.text || 'Không có đoạn trích phù hợp.'
  const url = source.url || source.link

  return (
    <article className="source-card">
      <header>
        <h4>{section}</h4>
        <span className="page-badge">{pageText}</span>
      </header>
      <div className="source-doc">{docName}</div>
      <p>{snippet}</p>
      <footer className="source-footer">
        {score && <span className="source-score">Độ liên quan: {score}</span>}
        {url && (
          <a className="source-open" href={url} target="_blank" rel="noreferrer">
            Mở chi tiết
          </a>
        )}
      </footer>
    </article>
  )
}
