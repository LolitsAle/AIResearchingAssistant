import { useState } from 'react';
import { AlertTriangle, Globe2, Image, NotebookPen, PlusCircle, Send, Sparkles, X } from 'lucide-react';

const QUICK_PROMPTS = ['Giải thích biểu đồ này', 'Trích xuất số liệu thành bảng', 'Chuyển công thức này sang LaTeX'];

export default function AcademicChatPanel({ activeTab, onTabChange, messages, onSend, pendingImage, onClearImage, onAddToNotepad, onAddToContext, sending }) {
  const [input, setInput] = useState('');
  const isWeb = activeTab === 'web';
  const submit = (event) => {
    event.preventDefault();
    const message = input.trim();
    if (!message && !pendingImage) return;
    onSend({ message: message || (pendingImage ? 'Hãy phân tích ảnh đã chụp.' : ''), tab: activeTab });
    setInput('');
  };

  return (
    <aside className={`al-chat ${isWeb ? 'is-web' : ''}`}>
      <div className="al-chat-tabs">
        <button type="button" className={activeTab === 'document' ? 'active' : ''} onClick={() => onTabChange('document')}><Sparkles size={15} /> Document AI</button>
        <button type="button" className={activeTab === 'web' ? 'active' : ''} onClick={() => onTabChange('web')}><Globe2 size={15} /> Global Web Chat</button>
      </div>
      {isWeb && <div className="al-web-note"><Globe2 size={14} /> Tìm kiếm Web độc lập (không dùng dữ liệu PDF). Câu trả lời thật cần citations/hyperlinks.</div>}
      <div className="al-chat-log">
        {!messages.length ? <p className="al-muted">{isWeb ? 'Tìm kiếm Web độc lập (Không dùng dữ liệu PDF)...' : 'Hỏi AI dựa trên tài liệu đang đọc...'}</p> : messages.map((msg, index) => (
          <div key={index} className={`al-msg ${msg.role} ${msg.warning ? 'warning' : ''}`}>
            <p>{msg.content}</p>
            {msg.warning && <span><AlertTriangle size={13} /> {msg.warning}</span>}
            {msg.role === 'assistant' && (
              <div className="al-msg-actions">
                <button type="button" onClick={() => onAddToNotepad(msg.content)}><NotebookPen size={13} /> Add to Notepad</button>
                {msg.mode === 'web' && <button type="button" onClick={() => onAddToContext(msg)}><PlusCircle size={13} /> Thêm vào Bối cảnh</button>}
              </div>
            )}
          </div>
        ))}
      </div>
      <form className="al-chat-form" onSubmit={submit}>
        {pendingImage && (
          <div className="al-image-draft">
            <img src={pendingImage.dataUrl} alt="Vùng ảnh đã chụp" />
            <button type="button" onClick={onClearImage}><X size={14} /></button>
            <div>{QUICK_PROMPTS.map((prompt) => <button type="button" key={prompt} onClick={() => setInput(prompt)}>{prompt}</button>)}</div>
          </div>
        )}
        <textarea rows={3} value={input} onChange={(event) => setInput(event.target.value)} placeholder={isWeb ? 'Tìm kiếm Web độc lập (Không dùng dữ liệu PDF)...' : 'Hỏi AI dựa trên tài liệu đang đọc...'} />
        <button type="submit" disabled={sending}><Send size={16} /> Gửi</button>
      </form>
    </aside>
  );
}
