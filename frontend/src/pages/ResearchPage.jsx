import { useMemo, useState } from "react";

const templates = [
  "Tổng quan tài liệu",
  "Tóm tắt chuyên sâu",
  "Rút trích luận điểm",
  "Bản đồ tư duy",
  "Bài kiểm tra",
  "Flashcards",
  "Giải thích thuật ngữ",
  "So sánh nhiều nguồn",
  "Trả lời có trích dẫn",
  "Bảng dữ liệu",
];

const seed = {
  p1: {
    name: "AI Research Sprint",
    docs: [
      { id: "d1", name: "transformer-paper.pdf",     status: "indexed",    selected: true  },
      { id: "d2", name: "rag-evaluation.pdf",         status: "processing", selected: true  },
      { id: "d3", name: "reasoning-benchmarks.pdf",   status: "indexed",    selected: false },
    ],
    chat: [
      {
        role: "assistant",
        content: "Chào bạn! Hãy chọn nguồn và đặt câu hỏi để bắt đầu phân tích.",
        citations: [],
      },
    ],
    notes: [
      {
        id: "n1",
        title: "Ý tưởng chính",
        content: "So sánh kiến trúc và chi phí suy luận giữa các hướng tiếp cận.",
      },
    ],
  },
  p2: { name: "Thesis Workspace", docs: [], chat: [], notes: [] },
};

export default function ResearchPage() {
  const [projects, setProjects]   = useState(seed);
  const [activeId, setActiveId]   = useState("p1");
  const [query,    setQuery]      = useState("");
  const [message,  setMessage]    = useState("");
  const [dragging, setDragging]   = useState(false);

  const active        = projects[activeId];
  const selectedCount = active.docs.filter((d) => d.selected).length;
  const filteredDocs  = useMemo(
    () => active.docs.filter((d) => d.name.toLowerCase().includes(query.toLowerCase())),
    [active.docs, query],
  );

  const patchActive = (next) =>
    setProjects((p) => ({ ...p, [activeId]: { ...p[activeId], ...next } }));

  const send = () => {
    const text = message.trim();
    if (!text || selectedCount === 0) return;
    const citations = active.docs
      .filter((d) => d.selected)
      .slice(0, 2)
      .map((d, i) => ({ id: d.id, n: i + 1, name: d.name }));
    patchActive({
      chat: [
        ...active.chat,
        { role: "user",      content: text, citations: [] },
        {
          role: "assistant",
          content: `Dựa trên ${selectedCount} nguồn đã chọn, đây là phân tích cô đọng cho: "${text}".`,
          citations,
        },
      ],
    });
    setMessage("");
  };

  const saveNote = (content) =>
    patchActive({
      notes: [
        { id: crypto.randomUUID(), title: "Ghi chú từ AI", content },
        ...active.notes,
      ],
    });

  const toggleDoc = (id) =>
    patchActive({
      docs: active.docs.map((d) => (d.id === id ? { ...d, selected: !d.selected } : d)),
    });

  const toggleAll = (checked) =>
    patchActive({ docs: active.docs.map((d) => ({ ...d, selected: checked })) });

  const reorderNote = (from, to) => {
    const arr = [...active.notes];
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
    patchActive({ notes: arr });
  };

  return (
    <div className="agent-root">

      {/* ── Top Navigation Bar ── */}
      <header className="topbar">
        <div className="left-actions">
          <span className="logo">◉</span>

          <select value={activeId} onChange={(e) => setActiveId(e.target.value)}>
            {Object.entries(projects).map(([id, p]) => (
              <option key={id} value={id}>{p.name}</option>
            ))}
          </select>

          <input
            type="text"
            value={active.name}
            onChange={(e) =>
              setProjects((p) => ({
                ...p,
                [activeId]: { ...p[activeId], name: e.target.value },
              }))
            }
          />
        </div>

        <div className="right-actions">
          <button>＋ Tạo đoạn chat mới</button>
          <button>Số liệu phân tích</button>
          <button>Cài đặt</button>
          <span className="avatar">U</span>
        </div>
      </header>

      {/* ── 3-Column Grid ── */}
      <main className="agent-grid">

        {/* ── Column 1: Source Panel ── */}
        <section className="panel source-panel fade-in stagger-1">
          <div className="panel-header">
            <h3>Nguồn</h3>
          </div>

          <button className="pill">＋ Thêm nguồn</button>

          {/* Pill search bar with magnifying-glass icon */}
          <div className="search-wrap">
            <span className="search-icon">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </span>
            <input
              placeholder="Tìm nguồn..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <label className="checkline">
            <input
              type="checkbox"
              checked={selectedCount === active.docs.length && active.docs.length > 0}
              onChange={(e) => toggleAll(e.target.checked)}
            />
            Chọn tất cả
          </label>
          <small>{selectedCount} nguồn được chọn</small>

          {/* Drop zone */}
          <div
            className={`dropzone ${dragging ? "dragging" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); }}
          >
            <span className="drop-icon">⬆︎</span>
            Kéo tệp vào đây
          </div>

          {/* Document list */}
          <div className="scroll-zone">
            {filteredDocs.map((d) => (
              <article key={d.id} className="doc-card">
                <label>
                  <input
                    type="checkbox"
                    checked={d.selected}
                    onChange={() => toggleDoc(d.id)}
                  />
                  {d.name}
                </label>
                <em data-status={d.status}>{d.status}</em>
              </article>
            ))}
          </div>
        </section>

        {/* ── Column 2: Chat Panel ── */}
        <section className="panel chat-panel fade-in stagger-2">
          <div className="panel-header center-title">
            <h2>Cuộc Trò Chuyện</h2>
          </div>

          <div className="chat-zone scroll-zone">
            {active.chat.map((m, i) => (
              <div key={i} className={`bubble ${m.role}`}>
                <p>{m.content}</p>
                {m.citations?.length > 0 && (
                  <div className="cite-row">
                    {m.citations.map((c) => (
                      <button key={c.id} className="cite-pill">[{c.n}]</button>
                    ))}
                  </div>
                )}
                {m.role === "assistant" && (
                  <button className="save-note" onClick={() => saveNote(m.content)}>
                    Lưu vào ghi chú
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Floating composer */}
          <div className="composer">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Đặt câu hỏi hoặc tạo nội dung…"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <div>
              <span>{selectedCount} nguồn</span>
              <button
                className={`send-btn ${message.trim() ? "active" : ""}`}
                onClick={send}
                aria-label="Gửi"
              >
                ➤
              </button>
            </div>
          </div>
        </section>

        {/* ── Column 3: Studio Panel ── */}
        <section className="panel studio-panel fade-in stagger-3">
          <div className="panel-header">
            <h3>Studio</h3>
          </div>

          <div className="template-grid">
            {templates.map((t) => (
              <button key={t} className="template">
                {t} <span>›</span>
              </button>
            ))}
          </div>

          <h4 style={{ marginTop: "10px" }}>Ghi chú</h4>

          <div className="scroll-zone">
            {active.notes.length === 0 ? (
              <p style={{ fontSize: "0.8rem", color: "var(--text-3)", padding: "10px 0" }}>
                Đầu ra của Studio sẽ được lưu ở đây.
              </p>
            ) : (
              active.notes.map((n, i) => (
                <article
                  key={n.id}
                  className="note"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("idx", String(i))}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => reorderNote(Number(e.dataTransfer.getData("idx")), i)}
                >
                  <strong>{n.title}</strong>
                  <p>{n.content}</p>
                </article>
              ))
            )}
          </div>
        </section>

      </main>
    </div>
  );
}
