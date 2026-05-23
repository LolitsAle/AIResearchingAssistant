import { useState, useRef, useEffect } from "react";
import {
  Search,
  Upload,
  FileText,
  Send,
  Bot,
  User,
  ExternalLink,
  MoreHorizontal,
  ChevronRight,
  Paperclip,
  X,
  CheckCircle2,
  Clock,
  BookOpen,
  Sparkles,
  FilePlus,
  Trash2,
} from "lucide-react";

// ─── Data ───────────────────────────────────────────────────────────────────

const DOCUMENTS = [
  {
    id: 1,
    name: "Attention Is All You Need",
    type: "PDF",
    size: "1.2 MB",
    date: "May 20",
    pages: 15,
    active: true,
  },
  {
    id: 2,
    name: "BERT: Pre-training of Deep Bidirectional Transformers",
    type: "PDF",
    size: "980 KB",
    date: "May 19",
    pages: 16,
    active: false,
  },
  {
    id: 3,
    name: "GPT-4 Technical Report",
    type: "PDF",
    size: "2.1 MB",
    date: "May 18",
    pages: 100,
    active: false,
  },
  {
    id: 4,
    name: "Chain-of-Thought Prompting",
    type: "PDF",
    size: "654 KB",
    date: "May 17",
    pages: 12,
    active: false,
  },
  {
    id: 5,
    name: "LLaMA 2: Open Foundation Models",
    type: "PDF",
    size: "3.4 MB",
    date: "May 16",
    pages: 77,
    active: false,
  },
];

type Role = "user" | "assistant";

interface Message {
  id: number;
  role: Role;
  content: string;
  timestamp: string;
  sources?: number[];
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: 1,
    role: "assistant",
    content:
      "Xin chào! Tôi là trợ lý nghiên cứu AI của bạn. Tôi đã phân tích 5 tài liệu trong thư viện của bạn. Bạn muốn khám phá chủ đề nào hôm nay?",
    timestamp: "10:24 SA",
    sources: [],
  },
  {
    id: 2,
    role: "user",
    content:
      "Cơ chế attention trong Transformer hoạt động như thế nào? Giải thích chi tiết về scaled dot-product attention.",
    timestamp: "10:25 SA",
  },
  {
    id: 3,
    role: "assistant",
    content:
      'Scaled dot-product attention là trái tim của kiến trúc Transformer. Cơ chế này hoạt động theo ba bước chính:\n\n**1. Tạo Queries, Keys và Values**\nTừ vector đầu vào, mô hình học ba ma trận chiếu (W_Q, W_K, W_V) để tạo ra Q, K, V tương ứng.\n\n**2. Tính Attention Scores**\nĐiểm attention được tính bằng tích vô hướng của Q và K, sau đó chia cho √d_k để ổn định gradient:\n\n```\nAttention(Q, K, V) = softmax(QK^T / √d_k) · V\n```\n\n**3. Weighted Sum**\nSau khi qua softmax, các trọng số được nhân với V để tạo ra đầu ra cuối cùng.\n\nViệc chia cho √d_k ngăn chặn hiện tượng vanishing gradient khi d_k lớn, giữ cho phân phối softmax không bị quá nhọn.',
    timestamp: "10:25 SA",
    sources: [1, 2],
  },
  {
    id: 4,
    role: "user",
    content: "Multi-head attention khác gì so với single-head attention?",
    timestamp: "10:28 SA",
  },
  {
    id: 5,
    role: "assistant",
    content:
      "Multi-head attention cho phép mô hình tập trung đồng thời vào thông tin từ các không gian biểu diễn khác nhau ở các vị trí khác nhau. Thay vì một lần attention duy nhất, MHA chạy h attention function song song:\n\n**Lợi ích chính:**\n- Mỗi head học được các mối quan hệ phụ thuộc khác nhau (cú pháp, ngữ nghĩa, vị trí)\n- Tăng biểu đạt mô hình mà không tăng quá nhiều chi phí tính toán\n- Trong paper gốc, h=8 heads với d_model=512, nên d_k = d_v = 64 mỗi head",
    timestamp: "10:29 SA",
    sources: [1],
  },
];

const SOURCE_CARDS = [
  {
    id: 1,
    title: "Attention Is All You Need",
    authors: "Vaswani et al., 2017",
    excerpt:
      "Scaled dot-product attention computes the dot products of the query with all keys, divide each by √d_k, and apply a softmax function.",
    page: 4,
    relevance: 98,
    color: "#6366f1",
  },
  {
    id: 2,
    title: "BERT: Pre-training of Deep Bidirectional Transformers",
    authors: "Devlin et al., 2019",
    excerpt:
      "BERT uses bidirectional self-attention, while the GPT language model uses constrained self-attention where every token can only attend to context to its left.",
    page: 3,
    relevance: 84,
    color: "#8b5cf6",
  },
  {
    id: 3,
    title: "GPT-4 Technical Report",
    authors: "OpenAI, 2023",
    excerpt:
      "The architecture follows the transformer architecture with some modifications including pre-normalization using RMSNorm.",
    page: 7,
    relevance: 71,
    color: "#06b6d4",
  },
];

// ─── Components ─────────────────────────────────────────────────────────────

function DocumentItem({
  doc,
  onToggle,
  onDismiss,
}: {
  doc: (typeof DOCUMENTS)[0];
  onToggle: (id: number) => void;
  onDismiss: (id: number) => void;
}) {
  return (
    <div
      onClick={() => onToggle(doc.id)}
      className={`group relative flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 ${
        doc.active
          ? "bg-primary/10 border border-primary/25"
          : "hover:bg-secondary border border-transparent"
      }`}
    >
      <div
        className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
          doc.active ? "bg-primary/20" : "bg-muted"
        }`}
      >
        <FileText
          size={14}
          className={doc.active ? "text-primary" : "text-muted-foreground"}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={`text-xs font-medium leading-snug truncate ${
            doc.active ? "text-foreground" : "text-foreground/80"
          }`}
          style={{ fontFamily: "'Lora', serif" }}
        >
          {doc.name}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="font-mono text-[10px] text-muted-foreground">
            {doc.pages}p · {doc.size}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground/60">
            {doc.date}
          </span>
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDismiss(doc.id); }}
        className="opacity-0 group-hover:opacity-100 flex-shrink-0 mt-0.5 w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-all duration-150"
        aria-label="Xóa tài liệu"
      >
        <X size={11} />
      </button>
    </div>
  );
}

function ChatMessage({ message }: { message: Message }) {
  const isAssistant = message.role === "assistant";

  return (
    <div
      className={`flex gap-3 ${isAssistant ? "items-start" : "items-start flex-row-reverse"}`}
    >
      <div
        className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
          isAssistant
            ? "bg-primary/15 border border-primary/30"
            : "bg-secondary border border-border"
        }`}
      >
        {isAssistant ? (
          <Sparkles size={12} className="text-primary" />
        ) : (
          <User size={12} className="text-muted-foreground" />
        )}
      </div>

      <div className={`flex-1 max-w-[85%] ${isAssistant ? "" : "flex flex-col items-end"}`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isAssistant
              ? "bg-card border border-border text-foreground rounded-tl-sm"
              : "bg-primary text-primary-foreground rounded-tr-sm"
          }`}
          style={{ fontFamily: "'Lora', serif" }}
        >
          {message.content.split("\n").map((line, i) => {
            if (line.startsWith("**") && line.endsWith("**")) {
              return (
                <p key={i} className="font-semibold mt-2 mb-1 first:mt-0">
                  {line.slice(2, -2)}
                </p>
              );
            }
            if (line.startsWith("```")) return null;
            if (line.trim() === "") return <br key={i} />;
            if (line.startsWith("-")) {
              return (
                <p key={i} className="pl-3 border-l-2 border-primary/30 my-1 text-foreground/80">
                  {line.slice(1).trim()}
                </p>
              );
            }
            if (line.includes("```")) {
              const parts = line.split("```");
              return (
                <p key={i}>
                  {parts.map((p, j) =>
                    j % 2 === 1 ? (
                      <code
                        key={j}
                        className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-primary"
                      >
                        {p}
                      </code>
                    ) : (
                      p
                    )
                  )}
                </p>
              );
            }
            return <p key={i}>{line}</p>;
          })}
        </div>

        <div
          className={`flex items-center gap-2 mt-1.5 ${isAssistant ? "" : "flex-row-reverse"}`}
        >
          <span className="font-mono text-[10px] text-muted-foreground/60">
            {message.timestamp}
          </span>
          {message.sources && message.sources.length > 0 && (
            <div className="flex items-center gap-1">
              {message.sources.map((s) => (
                <span
                  key={s}
                  className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20"
                >
                  [{s}]
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SourceCard({
  card,
  onDismiss,
}: {
  card: (typeof SOURCE_CARDS)[0];
  onDismiss: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="group border border-border rounded-xl p-4 bg-card hover:border-border/70 transition-all duration-200 cursor-pointer"
      onClick={() => setExpanded(!expanded)}
      style={{ borderLeftColor: card.color, borderLeftWidth: "2px" }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p
            className="text-xs font-semibold text-foreground leading-snug line-clamp-2"
            style={{ fontFamily: "'Lora', serif" }}
          >
            {card.title}
          </p>
          <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
            {card.authors}
          </p>
        </div>
        <div className="flex-shrink-0 flex items-center gap-1">
          <span
            className="font-mono text-[10px] font-medium px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: card.color + "20",
              color: card.color,
            }}
          >
            {card.relevance}%
          </span>
        </div>
      </div>

      <div className={`overflow-hidden transition-all duration-300 ${expanded ? "max-h-40" : "max-h-8"}`}>
        <p
          className={`text-xs text-muted-foreground leading-relaxed ${!expanded ? "line-clamp-2" : ""}`}
          style={{ fontFamily: "'Lora', serif" }}
        >
          "{card.excerpt}"
        </p>
      </div>

      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border">
        <div className="flex items-center gap-1.5">
          <BookOpen size={10} className="text-muted-foreground" />
          <span className="font-mono text-[10px] text-muted-foreground">
            Trang {card.page}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink size={9} />
            Mở
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDismiss(card.id); }}
            className="flex items-center justify-center w-4 h-4 rounded text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-all duration-150"
            aria-label="Bỏ qua nguồn"
          >
            <X size={9} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── App ────────────────────────────────────────────────────────────────────

export default function App() {
  const [documents, setDocuments] = useState(DOCUMENTS);
  const [sourceCards, setSourceCards] = useState(SOURCE_CARDS);
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [inputValue, setInputValue] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const filteredDocs = documents.filter((d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  function toggleDoc(id: number) {
    setDocuments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, active: !d.active } : d))
    );
  }

  function dismissDoc(id: number) {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }

  function dismissSource(id: number) {
    setSourceCards((prev) => prev.filter((c) => c.id !== id));
  }

  function sendMessage() {
    if (!inputValue.trim()) return;

    const userMsg: Message = {
      id: messages.length + 1,
      role: "user",
      content: inputValue.trim(),
      timestamp: new Date().toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsTyping(true);

    setTimeout(() => {
      const aiMsg: Message = {
        id: messages.length + 2,
        role: "assistant",
        content:
          "Đây là một câu hỏi thú vị. Dựa trên các tài liệu bạn đã tải lên, tôi có thể cung cấp phân tích chi tiết về chủ đề này. Hãy để tôi tổng hợp thông tin từ nhiều nguồn khác nhau trong thư viện của bạn...",
        timestamp: new Date().toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        sources: [1, 3],
      };
      setIsTyping(false);
      setMessages((prev) => [...prev, aiMsg]);
    }, 1800);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function autoResize(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInputValue(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }

  const activeCount = documents.filter((d) => d.active).length;

  return (
    <div
      className="flex h-screen w-full overflow-hidden bg-background"
      style={{ fontFamily: "'Inter', sans-serif", fontSize: "15px" }}
    >
      {/* ── LEFT COLUMN ─────────────────────────────── */}
      <aside className="flex flex-col w-[20%] min-w-[200px] border-r border-border bg-card/50 overflow-hidden">
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-4 py-5 border-b border-border">
          <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
            <Sparkles size={13} className="text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground tracking-wide">
              ResearchAI
            </p>
            <p className="font-mono text-[9px] text-muted-foreground">
              {activeCount} tài liệu đang hoạt động
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-3 border-b border-border">
          <div className="relative flex items-center">
            <Search
              size={13}
              className="absolute left-3 text-muted-foreground pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm tài liệu..."
              className="w-full pl-8 pr-3 py-2 text-xs rounded-full bg-muted border border-border placeholder:text-muted-foreground/60 text-foreground outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 text-muted-foreground hover:text-foreground"
              >
                <X size={11} />
              </button>
            )}
          </div>
        </div>

        {/* Document list */}
        <div
          className="flex-1 overflow-y-auto px-3 py-3 space-y-1"
          style={{
            scrollbarWidth: "none",
          }}
        >
          <div className="flex items-center justify-between px-1 mb-2">
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
              Thư viện ({filteredDocs.length})
            </span>
            <button className="text-muted-foreground hover:text-foreground transition-colors">
              <FilePlus size={12} />
            </button>
          </div>
          {filteredDocs.map((doc) => (
            <DocumentItem key={doc.id} doc={doc} onToggle={toggleDoc} onDismiss={dismissDoc} />
          ))}
        </div>

        {/* Upload zone */}
        <div className="px-3 pb-4 pt-2 border-t border-border">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 transition-all duration-200 cursor-pointer ${
              isDragging
                ? "border-primary/60 bg-primary/10"
                : "border-border hover:border-muted-foreground/30 hover:bg-muted/40 bg-muted/20"
            }`}
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                isDragging ? "bg-primary/20" : "bg-muted"
              }`}
            >
              <Upload
                size={14}
                className={isDragging ? "text-primary" : "text-muted-foreground"}
              />
            </div>
            <div className="text-center">
              <p className="text-xs font-medium text-foreground/80">
                Tải tài liệu lên
              </p>
              <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
                PDF, DOCX, TXT · Tối đa 50MB
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── CENTER COLUMN ────────────────────────────── */}
      <main className="flex flex-col flex-1 w-[55%] overflow-hidden border-r border-border">
        {/* Sticky header with glassmorphism */}
        <header
          className="sticky top-0 z-20 flex items-center justify-center px-6 py-4 border-b border-border"
          style={{
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            backgroundColor: "rgba(22, 22, 26, 0.72)",
          }}
        >
          <div className="text-center">
            <h1
              className="text-lg font-bold tracking-[0.2em] uppercase text-foreground"
              style={{ letterSpacing: "0.22em", fontFamily: "'Lora', serif" }}
            >
              CUỘC TRÒ CHUYỆN
            </h1>
            <div className="flex items-center justify-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono text-[10px] text-muted-foreground">
                {activeCount} tài liệu · Phiên #{Math.floor(Math.random() * 900 + 100)}
              </span>
            </div>
          </div>

          <div className="absolute right-6 flex items-center gap-2">
            <button className="w-8 h-8 rounded-lg bg-muted hover:bg-secondary border border-border flex items-center justify-center transition-colors">
              <MoreHorizontal size={14} className="text-muted-foreground" />
            </button>
          </div>
        </header>

        {/* Messages */}
        <div
          className="flex-1 overflow-y-auto px-6 py-6 space-y-6"
          style={{ scrollbarWidth: "none" }}
        >
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}

          {isTyping && (
            <div className="flex gap-3 items-start">
              <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center">
                <Sparkles size={12} className="text-primary" />
              </div>
              <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex items-center gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area — floating, 95% width, centered */}
        <div className="flex justify-center px-4 pb-5 pt-2">
          <div className="w-[95%] rounded-2xl bg-card border border-border shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-all focus-within:border-primary/40 focus-within:shadow-[0_8px_40px_rgba(99,102,241,0.15)]">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={autoResize}
              onKeyDown={handleKeyDown}
              placeholder="Đặt câu hỏi về tài liệu của bạn..."
              rows={1}
              className="w-full resize-none bg-transparent px-4 pt-3.5 pb-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none leading-relaxed"
              style={{ minHeight: "48px", maxHeight: "120px", scrollbarWidth: "none" }}
            />
            <div className="flex items-center justify-between px-3 pb-3 pt-1">
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                  <Paperclip size={13} />
                  <span className="text-xs">Đính kèm</span>
                </button>
                <div className="w-px h-4 bg-border" />
                <span className="font-mono text-[10px] text-muted-foreground/60">
                  Enter để gửi · Shift+Enter xuống dòng
                </span>
              </div>
              <button
                onClick={sendMessage}
                disabled={!inputValue.trim() || isTyping}
                className={`flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-200 ${
                  inputValue.trim() && !isTyping
                    ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                }`}
              >
                <Send size={13} />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* ── RIGHT COLUMN ─────────────────────────────── */}
      <aside
        className="flex flex-col w-[25%] min-w-[220px] overflow-hidden"
        style={{ scrollbarWidth: "none" }}
      >
        {/* Header */}
        <div className="px-4 py-5 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-foreground tracking-wide">
                Nguồn tham chiếu
              </p>
              <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
                {SOURCE_CARDS.length} đoạn được trích dẫn
              </p>
            </div>
            <div className="w-7 h-7 rounded-lg bg-muted border border-border flex items-center justify-center">
              <BookOpen size={12} className="text-muted-foreground" />
            </div>
          </div>
        </div>

        {/* Relevance bar */}
        <div className="px-4 py-2.5 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
              Độ liên quan
            </span>
            <div className="flex-1 h-px bg-border" />
            <ChevronRight size={10} className="text-muted-foreground" />
          </div>
        </div>

        {/* Source cards */}
        <div
          className="flex-1 overflow-y-auto px-3 py-3 space-y-3"
          style={{ scrollbarWidth: "none" }}
        >
          {sourceCards.map((card) => (
            <SourceCard key={card.id} card={card} onDismiss={dismissSource} />
          ))}

          {/* Summary card */}
          <div className="border border-border rounded-xl p-4 bg-primary/5 border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={12} className="text-primary" />
              <p className="text-xs font-semibold text-primary">
                Tóm tắt phiên
              </p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Cuộc trò chuyện này đã đề cập đến cơ chế attention, multi-head attention, và kiến trúc Transformer. Tổng cộng{" "}
              <span className="text-foreground font-medium">3 nguồn</span> được trích dẫn.
            </p>
            <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-border">
              <Clock size={10} className="text-muted-foreground" />
              <span className="font-mono text-[10px] text-muted-foreground">
                Phiên bắt đầu · 10:24 SA
              </span>
            </div>
          </div>
        </div>

        {/* Footer stats */}
        <div className="px-4 py-3 border-t border-border bg-card/30">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Câu hỏi", value: messages.filter((m) => m.role === "user").length },
              { label: "Nguồn", value: sourceCards.length },
              { label: "Tài liệu", value: activeCount },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="font-mono text-sm font-semibold text-foreground">
                  {stat.value}
                </p>
                <p className="font-mono text-[9px] text-muted-foreground uppercase tracking-wide">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
