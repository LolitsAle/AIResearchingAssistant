function formatScore(score) {
  if (typeof score !== 'number' || Number.isNaN(score)) return null
  return `${Math.round(score * 100)}%`
}

export default function SourceCard({ source }) {
  if (!source) return null

  const title = source.title || `Chunk ${source.chunk_id || ''}`.trim() || 'Nguồn không rõ tên'
  const url = source.url || source.link
  const snippet = source.content || source.snippet || source.summary || 'Không có nội dung trích dẫn.'
  const pageText = typeof source.page === 'number' ? `Trang ${source.page}` : 'Không rõ trang'
  const scoreText = formatScore(source.score)

  return (
    <article style={{ borderTop: '1px solid #e2e8f0', paddingTop: 10, marginTop: 10 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>
        {url ? (
          <a href={url} target="_blank" rel="noreferrer">
            {title}
          </a>
        ) : (
          <span>{title}</span>
        )}
      </div>
      <small style={{ color: '#64748b' }}>
        {pageText}
        {scoreText ? ` · Độ liên quan: ${scoreText}` : ''}
      </small>
      <p style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>{snippet}</p>
    </article>
  )
}
