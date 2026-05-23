function toScore(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null
  return `${Math.round(value * 100)}%`
}

export default function SourceCard({ source }) {
  if (!source) return null

  const section = source.section || source.title || 'Nguồn tham chiếu'
  const page = source.page || source.page_start
  const pageEnd = source.page_end
  const pageText = page ? (pageEnd && pageEnd !== page ? `Trang ${page}-${pageEnd}` : `Trang ${page}`) : 'Không rõ trang'
  const score = toScore(source.score)
  const snippet = source.snippet || source.content || source.text || 'Không có đoạn trích phù hợp.'

  return (
    <article className="source-card">
      <header>
        <h4>{section}</h4>
        <span className="page-badge">{pageText}</span>
      </header>
      <p>{snippet}</p>
      {score && <div className="source-score">Độ liên quan: {score}</div>}
    </article>
  )
}
