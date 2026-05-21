import { useEffect, useRef } from 'react'

export default function ChatBox({
  messages = [],
  value,
  onChange,
  onSubmit,
  loading,
  error,
  disabled,
  placeholder = 'Đặt câu hỏi về tài liệu...',
}) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      onSubmit?.()
    }
  }

  return (
    <div>
      <div style={{ minHeight: 320, maxHeight: 540, overflowY: 'auto', marginBottom: 12 }}>
        {messages.length === 0 && <p style={{ color: '#64748b' }}>Hãy nhập câu hỏi để bắt đầu nghiên cứu tài liệu.</p>}

        {messages.map((msg, index) => (
          <div key={`${msg.role}-${index}`} style={{ marginBottom: 12 }}>
            <strong>{msg.role === 'user' ? 'Bạn' : 'Trợ lý'}:</strong>
            <p style={{ whiteSpace: 'pre-wrap', margin: '4px 0 0' }}>{msg.content}</p>
          </div>
        ))}

        {loading && <p style={{ marginTop: 8 }}>Đang xử lý câu trả lời...</p>}
        <div ref={bottomRef} />
      </div>

      {error && <p style={{ color: '#b91c1c', marginBottom: 8 }}>{error}</p>}

      <textarea
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={loading || disabled}
        rows={4}
        maxLength={1000}
        style={{ width: '100%', resize: 'vertical', marginBottom: 8, padding: 10 }}
      />
      <button onClick={onSubmit} disabled={loading || disabled || !value?.trim()}>
        {loading ? 'Đang gửi...' : 'Gửi câu hỏi'}
      </button>
    </div>
  )
}
