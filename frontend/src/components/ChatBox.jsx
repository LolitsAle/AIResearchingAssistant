import { useEffect, useRef } from 'react'

const suggestions = [
  'Tóm tắt paper này giúp tôi',
  'Bài này đóng góp gì mới?',
  'Giải thích phương pháp nghiên cứu',
  'Hạn chế của nghiên cứu này là gì?',
]

export default function ChatBox({
  messages = [],
  value,
  onChange,
  onSubmit,
  loading,
  error,
  disabled,
  sourcesCount = 0,
}) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, loading])

  return (
    <section className="chat-shell">

      {/* ── Centered uppercase panel title ── */}
      <div className="panel-header center-title" style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border)', borderRadius: 'var(--r-xl) var(--r-xl) 0 0', background: 'rgba(24,28,36,0.9)' }}>
        <h2>Cuộc Trò Chuyện</h2>
      </div>

      {/* ── Chat log ── */}
      <div className="chat-log">
        {!messages.length && (
          <div className="chat-empty fade-in">
            <p>AI đang sẵn sàng đồng hành cùng bạn. Hãy chọn một gợi ý:</p>
            <div className="quick-actions">
              {suggestions.map((item) => (
                <button
                  key={item}
                  onClick={() => onChange?.(item)}
                  type="button"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, index) => (
          <div key={`${msg.role}-${index}`} className={`msg-row ${msg.role} fade-in`}>
            <div className="avatar">{msg.role === 'user' ? 'U' : 'AI'}</div>
            <div className="msg-bubble">{msg.content}</div>
          </div>
        ))}

        {loading && (
          <div className="msg-row assistant fade-in">
            <div className="avatar">AI</div>
            <div className="msg-bubble loading-bubble">
              Đang phân tích tài liệu
              <span className="dots">
                <span>.</span><span>.</span><span>.</span>
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Status hints ── */}
      {sourcesCount > 0 && (
        <div className="source-hint">{sourcesCount} nguồn được tìm thấy</div>
      )}
      {error && (
        <div className="chat-error">{error}</div>
      )}

      {/* ── Floating composer input ── */}
      <div className="chat-input-wrap">
        <textarea
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              onSubmit?.()
            }
          }}
          placeholder="Đặt câu hỏi học thuật, ví dụ: Hãy so sánh phương pháp của bài này với nghiên cứu truyền thống."
          disabled={disabled || loading}
          rows={3}
        />
        <button
          onClick={onSubmit}
          disabled={!value?.trim() || disabled || loading}
        >
          {loading ? 'Đang gửi…' : 'Gửi'}
        </button>
      </div>
    </section>
  )
}
