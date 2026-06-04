import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";

const MAX_UPLOAD_MB = Number(import.meta.env.VITE_MAX_UPLOAD_MB || 50);
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
const SUPPORTED_UPLOAD_EXTENSIONS = new Set(["pdf", "docx", "doc", "txt", "md", "rtf"]);
const SUPPORTED_UPLOAD_ACCEPT = ".pdf,.docx,.doc,.txt,.md,.rtf";
const LAST_SESSION_KEY = "researchWorkspace:lastActiveSessionId";
const LEFT_COLLAPSED_KEY = "notebookWorkspaceLeftCollapsed";
const RIGHT_COLLAPSED_KEY = "notebookWorkspaceRightCollapsed";
const LEFT_WIDTH_KEY = "notebookWorkspaceLeftWidth";
const RIGHT_WIDTH_KEY = "notebookWorkspaceRightWidth";
const RIGHT_TAB_KEY = "notebookWorkspaceRightTab";

const PROMPT_GROUPS = [
  { group: "Hiểu tài liệu", prompts: ["Tóm tắt ý chính của các tài liệu đã chọn", "Giải thích các thuật ngữ quan trọng", "Liệt kê các luận điểm chính kèm nguồn"] },
  { group: "Phương pháp", prompts: ["Phân tích phương pháp nghiên cứu được sử dụng", "Các giả định quan trọng của phương pháp là gì?"] },
  { group: "Kết quả", prompts: ["Kết quả chính và bằng chứng hỗ trợ là gì?", "Kết quả nào có độ tin cậy cao nhất theo nguồn?"] },
  { group: "Hạn chế", prompts: ["Nêu các hạn chế và rủi ro diễn giải", "Tài liệu còn thiếu bằng chứng ở đâu?"] },
  { group: "So sánh", prompts: ["So sánh ngắn các tài liệu đang chọn trong phiên này", "Tài liệu nào mâu thuẫn hoặc bổ sung cho nhau?"] },
  { group: "Viết lại / Outline", prompts: ["Tạo outline bài viết dựa trên nguồn đã chọn", "Viết lại câu trả lời thành đoạn văn học thuật ngắn"] },
];

const PROCESSING_STEPS = ["uploaded", "parsing", "chunking", "embedding", "ready"];
const PROCESSING_LABELS = {
  uploaded: "Uploaded",
  parsing: "Parsing",
  chunking: "Chunking",
  embedding: "Embedding",
  ready: "Ready",
  failed: "Failed",
};

function useLocalStorageState(key, initialValue, parser = (value) => value) {
  const [value, setValue] = useState(() => {
    const stored = localStorage.getItem(key);
    if (stored == null) return initialValue;
    try { return parser(stored); } catch { return initialValue; }
  });
  useEffect(() => { localStorage.setItem(key, String(value)); }, [key, value]);
  return [value, setValue];
}

function normalizeDocument(doc = {}) {
  const id = String(doc.id || doc.doc_id || "");
  const rawStatus = doc.processing_status || doc.status || (doc.chunk_count > 0 ? "ready" : "uploaded");
  const status = rawStatus === "error" ? "failed" : rawStatus;
  const ready = status === "ready" || doc.is_vector_ready === true || doc.status === "ready";
  return {
    ...doc,
    id,
    doc_id: id,
    filename: doc.filename || doc.title || "Tài liệu",
    processing_status: ready ? "ready" : status,
    processing_error: doc.processing_error || doc.error || doc.message || null,
    is_vector_ready: ready,
    chunk_count: Number(doc.chunk_count || 0),
    page_count: Number(doc.page_count || 0),
  };
}

function citationTitle(citation = {}) {
  return String(citation.document_title || citation.filename || citation.title || "").trim();
}
function citationSnippet(citation = {}) {
  return String(citation.snippet || citation.summary || citation.content || "").trim();
}
function citationPage(citation = {}) {
  const start = citation.page_start ?? citation.page ?? citation.page_number;
  const end = citation.page_end;
  if (!start) return citation.section || citation.location || "Không rõ trang";
  return end && end !== start ? `Trang ${start}-${end}` : `Trang ${start}`;
}
function isValidCitation(citation = {}) {
  return Boolean(citationTitle(citation)) && Boolean(citationSnippet(citation) || citation.page_start || citation.page || citation.section || citation.score != null);
}
function normalizeCitations(citations = []) {
  return (Array.isArray(citations) ? citations : [])
    .map((citation, index) => ({
      ...citation,
      citation_index: citation.citation_index || citation.index || index + 1,
      chunk_id: citation.chunk_id || citation.id || citation.citation_id,
      document_id: citation.document_id || citation.doc_id,
      document_title: citationTitle(citation),
      snippet: citationSnippet(citation),
      page_start: citation.page_start ?? citation.page ?? citation.page_number,
      page_end: citation.page_end ?? citation.page ?? citation.page_number,
      score: citation.score ?? citation.relevance ?? citation.confidence,
    }))
    .filter(isValidCitation);
}
function formatScore(score) {
  if (score == null || score === "") return "—";
  const numeric = Number(score);
  if (!Number.isFinite(numeric)) return String(score);
  return numeric <= 1 ? `${Math.round(numeric * 100)}%` : `${Math.round(numeric)}%`;
}
function formatTime(value) {
  if (!value) return "Vừa cập nhật";
  try { return new Date(value).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }); } catch { return "Vừa cập nhật"; }
}
function generateNoteTitle(content = "") {
  const text = content.replace(/\s+/g, " ").trim();
  return text ? text.split(" ").slice(0, 10).join(" ").slice(0, 90) : "Ghi chú mới";
}
function noteMarkdownFromMessage(message, citations) {
  const sourceLines = normalizeCitations(citations).map((citation) => `- [${citation.citation_index}] ${citationTitle(citation)} — ${citationPage(citation)}${citation.chunk_id ? ` — chunk ${citation.chunk_id}` : ""}`);
  return [message.content || "", sourceLines.length ? "\n\n## Nguồn\n" + sourceLines.join("\n") : ""].join("");
}
function getContribution(citations = []) {
  const counts = new Map();
  normalizeCitations(citations).forEach((citation) => {
    const key = citation.document_id || citationTitle(citation);
    const label = citationTitle(citation) || "Nguồn không rõ";
    if (!key || !label) return;
    const item = counts.get(key) || { key, label, count: 0 };
    item.count += 1;
    counts.set(key, item);
  });
  const total = [...counts.values()].reduce((sum, item) => sum + item.count, 0);
  return [...counts.values()].sort((a, b) => b.count - a.count).map((item) => ({ ...item, percent: total ? Math.round((item.count / total) * 100) : 0 }));
}
function buildDiagnostics(citations = [], diagnostics = null, selectedDocumentIds = []) {
  if (diagnostics) return diagnostics;
  const valid = normalizeCitations(citations);
  const scores = valid.map((c) => Number(c.score)).filter(Number.isFinite);
  return {
    top_score: scores.length ? Math.max(...scores) : null,
    chunks_used: valid.length,
    selected_document_ids_used: [...new Set(valid.map((c) => c.document_id).filter(Boolean))],
    retrieval_mode: selectedDocumentIds.length ? "vector" : "selected_context_fallback",
    is_out_of_scope: false,
    warning: null,
  };
}

function WorkspaceStyles() {
  return <style>{`
    .rw-page{height:calc(100vh - 0px);min-height:720px;background:#0f0d0a;color:#e8e0d0;font-family:'DM Sans',system-ui,sans-serif;display:flex;flex-direction:column;overflow:hidden}
    .rw-topbar{height:58px;display:flex;align-items:center;justify-content:space-between;padding:0 18px;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(15,13,10,.92);backdrop-filter:blur(12px);gap:12px}
    .rw-title{min-width:0}.rw-title h1{font:600 18px Georgia,serif;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rw-title p{margin:2px 0 0;color:#9a9080;font-size:12px}.rw-mode{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.rw-segment{border:1px solid rgba(196,164,100,.28);border-radius:999px;overflow:hidden;display:flex}.rw-segment button{border:0;background:transparent;color:#9a9080;padding:7px 10px;cursor:pointer}.rw-segment button.active{background:rgba(196,164,100,.18);color:#f4d28a}.rw-shell{flex:1;display:flex;min-height:0;overflow:hidden}.rw-panel{min-height:0;background:rgba(255,255,255,.025);border-right:1px solid rgba(255,255,255,.07);display:flex;flex-direction:column}.rw-right{border-right:0;border-left:1px solid rgba(255,255,255,.07)}.rw-center{flex:1;min-width:420px;display:flex;flex-direction:column;min-height:0;background:radial-gradient(circle at top,rgba(196,164,100,.045),transparent 40%)}
    .rw-panel-head{padding:14px;border-bottom:1px solid rgba(255,255,255,.07);display:flex;align-items:center;justify-content:space-between;gap:8px}.rw-panel-head h2{font-size:14px;margin:0}.rw-icon-btn,.rw-soft-btn,.rw-primary,.rw-danger{border:1px solid rgba(255,255,255,.12);border-radius:9px;background:rgba(255,255,255,.04);color:#d4cfc8;padding:7px 10px;cursor:pointer;font-size:12px}.rw-icon-btn{width:34px;height:34px;display:grid;place-items:center;padding:0}.rw-primary{background:linear-gradient(135deg,#c4a464,#8a6a30);color:#19140d;border:0;font-weight:700}.rw-danger{color:#ffb4a8;border-color:rgba(255,100,90,.24)}button:disabled{opacity:.45;cursor:not-allowed}.rw-resizer{width:6px;cursor:col-resize;background:transparent;flex-shrink:0}.rw-resizer:hover{background:rgba(196,164,100,.22)}.rw-reopen{width:42px;border-right:1px solid rgba(255,255,255,.07);display:flex;align-items:flex-start;justify-content:center;padding-top:12px}.rw-right-reopen{border-right:0;border-left:1px solid rgba(255,255,255,.07)}
    .rw-scroll{overflow:auto;min-height:0}.rw-doc-tools{padding:12px 14px;display:grid;gap:10px;border-bottom:1px solid rgba(255,255,255,.06)}.rw-filter-row,.rw-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.rw-chip{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.035);color:#a99f90;border-radius:999px;padding:5px 9px;font-size:12px;cursor:pointer}.rw-chip.active{border-color:rgba(196,164,100,.5);color:#f4d28a;background:rgba(196,164,100,.12)}.rw-upload{border:1px dashed rgba(196,164,100,.35);border-radius:12px;padding:10px;text-align:center;cursor:pointer;background:rgba(196,164,100,.045)}.rw-doc-list{padding:12px;display:grid;gap:10px}.rw-doc{border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.035);padding:10px}.rw-doc-top{display:flex;gap:8px;align-items:flex-start}.rw-doc-title{font-weight:700;font-size:13px;word-break:break-word}.rw-doc-meta{display:flex;gap:8px;flex-wrap:wrap;color:#8d8274;font-size:11px;margin-top:5px}.rw-status{margin-top:8px}.rw-status-line{height:5px;background:rgba(255,255,255,.08);border-radius:99px;overflow:hidden}.rw-status-fill{height:100%;background:linear-gradient(90deg,#8a6a30,#c4a464);border-radius:99px}.rw-status-label{display:flex;justify-content:space-between;margin-top:5px;font-size:11px;color:#9a9080}.rw-status.failed .rw-status-fill{background:#d86b5e}.rw-warning{border:1px solid rgba(245,158,11,.35);background:rgba(245,158,11,.1);color:#f8d18a;border-radius:10px;padding:8px 10px;font-size:12px}.rw-error{border:1px solid rgba(248,113,113,.35);background:rgba(248,113,113,.1);color:#fecaca;border-radius:10px;padding:8px 10px;font-size:12px}
    .rw-chat-head{padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.07);display:flex;align-items:center;justify-content:space-between;gap:12px}.rw-session-name{font-weight:800}.rw-doc-pill{font-size:12px;color:#9a9080;margin-top:2px}.rw-chat-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.rw-messages{flex:1;padding:18px;overflow:auto;min-height:0}.rw-empty{max-width:760px;margin:30px auto;text-align:center;color:#9a9080}.rw-prompts{margin-top:18px;text-align:left;display:grid;gap:10px}.rw-prompt-group{border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:10px;background:rgba(255,255,255,.025)}.rw-prompt-title{font-size:12px;color:#f4d28a;margin-bottom:8px}.rw-prompt-buttons{display:flex;gap:8px;flex-wrap:wrap}.rw-message{display:flex;gap:10px;max-width:920px;margin:0 auto 14px}.rw-message.user{justify-content:flex-end}.rw-bubble{border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:12px 14px;max-width:min(760px,88%);background:rgba(255,255,255,.045);line-height:1.55}.rw-message.user .rw-bubble{background:rgba(196,164,100,.16);border-color:rgba(196,164,100,.24);color:#fff2d2}.rw-avatar{width:30px;height:30px;border-radius:10px;background:rgba(196,164,100,.16);display:grid;place-items:center;color:#f4d28a;flex-shrink:0}.rw-bubble-actions{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}.rw-action-text{font-size:12px;color:#9a9080}.rw-citation-btn{border:1px solid rgba(196,164,100,.35);background:rgba(196,164,100,.1);color:#f4d28a;border-radius:999px;padding:2px 8px;cursor:pointer;margin:0 2px}.rw-input-area{position:sticky;bottom:0;border-top:1px solid rgba(255,255,255,.08);background:rgba(15,13,10,.95);padding:12px 16px}.rw-textarea-wrap{display:flex;gap:10px;align-items:flex-end}.rw-textarea{flex:1;min-height:54px;max-height:180px;resize:vertical;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(255,255,255,.045);color:#f4efe7;padding:12px;outline:none}.rw-hint{margin:6px 0 0;color:#786f64;font-size:11px}.rw-stage{color:#f4d28a;font-size:13px;margin:10px auto;max-width:920px}.rw-contribution,.rw-diagnostics{max-width:920px;margin:10px auto 14px;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:10px;background:rgba(255,255,255,.025)}.rw-bars{display:grid;gap:6px;margin-top:8px}.rw-bar-row{display:grid;grid-template-columns:minmax(120px,1fr) 2fr 42px;gap:8px;align-items:center;font-size:12px}.rw-bar-track{height:8px;background:rgba(255,255,255,.08);border-radius:99px;overflow:hidden}.rw-bar-fill{height:100%;background:linear-gradient(90deg,#c4a464,#f4d28a)}.rw-diag-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;color:#b8ad9d;font-size:12px}
    .rw-tabs{display:flex;border-bottom:1px solid rgba(255,255,255,.07)}.rw-tab{flex:1;border:0;background:transparent;color:#9a9080;padding:12px 8px;cursor:pointer;border-bottom:2px solid transparent}.rw-tab.active{color:#f4d28a;border-bottom-color:#c4a464}.rw-right-content{flex:1;min-height:0;overflow:auto;padding:12px}.rw-source-item,.rw-session-item,.rw-note-item{border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.035);padding:10px;margin-bottom:10px;cursor:pointer}.rw-source-item.active{border-color:rgba(196,164,100,.6);background:rgba(196,164,100,.08)}.rw-source-title,.rw-note-title,.rw-session-title{font-weight:800;font-size:13px}.rw-source-meta,.rw-session-meta,.rw-note-meta{display:flex;gap:8px;flex-wrap:wrap;color:#8d8274;font-size:11px;margin:5px 0}.rw-snippet{font-size:12px;color:#cfc6b9;white-space:pre-wrap}.rw-preview{position:sticky;bottom:0;background:#17130f;border:1px solid rgba(196,164,100,.22);border-radius:14px;padding:12px;margin-top:12px}.rw-note-filters{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}.rw-note-edit{display:grid;gap:8px}.rw-note-edit input,.rw-note-edit textarea,.rw-rename-input{width:100%;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:#f4efe7;border-radius:10px;padding:8px}.rw-session-item.active{border-color:rgba(196,164,100,.58)}.rw-mobile-tabs{display:none}.rw-toast{position:fixed;right:18px;bottom:18px;border-radius:12px;padding:12px 14px;background:#1f1a14;border:1px solid rgba(255,255,255,.12);box-shadow:0 10px 30px rgba(0,0,0,.3);z-index:50}.rw-toast.success{border-color:rgba(74,222,128,.4);color:#bbf7d0}.rw-toast.error{border-color:rgba(248,113,113,.45);color:#fecaca}.rw-md p{margin:.35rem 0}.rw-md ul,.rw-md ol{padding-left:1.2rem}.rw-md code{background:rgba(255,255,255,.08);padding:1px 4px;border-radius:4px}.rw-md a{color:#f4d28a}
    @media (max-width: 900px){.rw-page{height:auto;min-height:100vh;overflow:auto}.rw-topbar{height:auto;align-items:flex-start;padding:12px;flex-direction:column}.rw-shell{display:block;overflow:visible}.rw-panel,.rw-center{width:100%!important;min-width:0;display:none;height:calc(100vh - 132px)}.rw-panel.mobile-active,.rw-center.mobile-active{display:flex}.rw-resizer,.rw-reopen{display:none}.rw-mobile-tabs{display:flex;border-bottom:1px solid rgba(255,255,255,.08);background:#14110d}.rw-mobile-tabs button{flex:1;border:0;background:transparent;color:#9a9080;padding:11px 4px}.rw-mobile-tabs button.active{color:#f4d28a;border-bottom:2px solid #c4a464}.rw-chat-actions{justify-content:flex-start}.rw-bar-row{grid-template-columns:1fr}.rw-diag-grid{grid-template-columns:1fr}}
  `}</style>;
}

function DocumentsPanel({ documents, selectedDocumentIds, onToggleDocument, onSelectAllReady, onCreateSession, onUpload, uploadProgress, uploadError, filter, onFilterChange, loadingDocuments }) {
  const fileInputRef = useRef(null);
  const filtered = documents.filter((doc) => {
    if (filter === "all") return true;
    if (filter === "ready") return doc.processing_status === "ready";
    if (filter === "processing") return !["ready", "failed"].includes(doc.processing_status);
    if (filter === "failed") return doc.processing_status === "failed";
    return true;
  });
  const handleFiles = (files) => onUpload?.([...files]);
  return <>
    <div className="rw-panel-head"><h2>📄 Tài liệu</h2><button className="rw-soft-btn" type="button" title="Chọn toàn bộ tài liệu ready" onClick={onSelectAllReady}>Chọn ready</button></div>
    <div className="rw-doc-tools">
      <label className="rw-upload" title="Upload thêm tài liệu vào notebook">
        <input ref={fileInputRef} type="file" multiple accept={SUPPORTED_UPLOAD_ACCEPT} hidden onChange={(e) => handleFiles(e.target.files)} />
        <strong>＋ Upload / kéo thêm tài liệu</strong><br/><small>PDF, DOCX, TXT, MD · tối đa {MAX_UPLOAD_MB}MB/file</small>
      </label>
      {uploadProgress > 0 && uploadProgress < 100 && <div className="rw-status"><div className="rw-status-line"><div className="rw-status-fill" style={{ width: `${uploadProgress}%` }} /></div><div className="rw-status-label"><span>Đang upload</span><span>{uploadProgress}%</span></div></div>}
      {uploadError && <div className="rw-error">⚠ {uploadError}</div>}
      <button type="button" className="rw-soft-btn" title="Mở thư viện hệ thống để link tài liệu cộng đồng vào notebook" onClick={() => { window.location.href = "/system-library"; }}>Link từ Thư viện cộng đồng ↗</button>
      <div className="rw-filter-row" aria-label="Lọc tài liệu theo trạng thái">
        {["all", "ready", "processing", "failed"].map((key) => <button key={key} type="button" className={`rw-chip ${filter === key ? "active" : ""}`} onClick={() => onFilterChange(key)}>{key === "all" ? "Tất cả" : key === "ready" ? "Ready" : key === "processing" ? "Processing" : "Failed"}</button>)}
      </div>
      <button type="button" className="rw-primary" disabled={!selectedDocumentIds.length} title="Tạo phiên nghiên cứu mới từ các tài liệu đang chọn" onClick={onCreateSession}>Tạo phiên mới từ {selectedDocumentIds.length} tài liệu</button>
    </div>
    <div className="rw-doc-list rw-scroll">
      {loadingDocuments && <div className="rw-warning">Đang tải danh sách tài liệu...</div>}
      {!loadingDocuments && filtered.length === 0 && <div className="rw-warning">Chưa có tài liệu phù hợp bộ lọc.</div>}
      {filtered.map((doc) => {
        const ready = doc.processing_status === "ready";
        const failed = doc.processing_status === "failed";
        const stepIndex = failed ? PROCESSING_STEPS.length : Math.max(1, PROCESSING_STEPS.indexOf(doc.processing_status) + 1);
        const percent = ready ? 100 : failed ? 100 : Math.round((stepIndex / PROCESSING_STEPS.length) * 100);
        return <div key={doc.id} className="rw-doc">
          <div className="rw-doc-top">
            <input type="checkbox" checked={selectedDocumentIds.includes(doc.id)} disabled={!ready} onChange={() => onToggleDocument(doc.id)} aria-label={`Chọn tài liệu ${doc.filename}`} title={ready ? "Chọn/bỏ chọn tài liệu cho phiên" : "Tài liệu chưa ready nên chưa chọn được cho RAG"} />
            <div style={{ flex: 1 }}>
              <div className="rw-doc-title">{doc.filename}</div>
              <div className="rw-doc-meta"><span>{doc.file_type || "file"}</span><span>{doc.page_count} trang</span><span>{doc.chunk_count} chunks</span><span>{doc.is_vector_ready ? "Vector ready" : "Vector chưa sẵn sàng"}</span></div>
            </div>
          </div>
          <div className={`rw-status ${failed ? "failed" : ""}`}>
            <div className="rw-status-line"><div className="rw-status-fill" style={{ width: `${percent}%` }} /></div>
            <div className="rw-status-label"><span>{PROCESSING_LABELS[doc.processing_status] || doc.processing_status}</span><span>{ready ? "Dùng được" : failed ? "Lỗi" : "Đang xử lý"}</span></div>
          </div>
          {!ready && !failed && <div className="rw-warning" style={{ marginTop: 8 }}>Tài liệu này chưa sẵn sàng vector; chat có thể cần fallback keyword/text nếu backend hỗ trợ.</div>}
          {failed && <div className="rw-error" style={{ marginTop: 8 }}>Lỗi xử lý: {doc.processing_error || "Không rõ lý do"}. <button className="rw-soft-btn" type="button" title="Backend hiện chưa cung cấp retry endpoint cho tài liệu này" disabled>Retry parse/embed</button></div>}
        </div>;
      })}
    </div>
  </>;
}

function MarkdownWithCitations({ content, citations, onCitationClick }) {
  const citationMap = useMemo(() => new Map(normalizeCitations(citations).map((c) => [String(c.citation_index), c])), [citations]);
  const markdown = String(content || "").replace(/\[(\d+)\]/g, (_, index) => `[${index}](citation:${index})`);
  return <ReactMarkdown className="rw-md" skipHtml components={{
    a: ({ href = "", children }) => {
      if (href.startsWith("citation:")) {
        const key = href.replace("citation:", "");
        const citation = citationMap.get(key);
        if (!citation) return <span>{children}</span>;
        return <button type="button" className="rw-citation-btn" aria-label={`Mở nguồn trích dẫn ${key}`} title="Mở nguồn trong Sources panel" onClick={() => onCitationClick?.(citation)}>{children}</button>;
      }
      return <a href={href} target="_blank" rel="noreferrer">{children}</a>;
    },
  }}>{markdown}</ReactMarkdown>;
}

function ContributionAndDiagnostics({ citations, diagnostics, selectedDocumentIds }) {
  const contribution = getContribution(citations);
  const diag = buildDiagnostics(citations, diagnostics, selectedDocumentIds);
  return <>
    <div className="rw-contribution">
      <strong>Đóng góp tài liệu</strong>
      {!contribution.length ? <p className="rw-action-text">Chưa có nguồn đủ metadata.</p> : <>
        <p className="rw-action-text">Answer dựa nhiều nhất vào: <strong>{contribution[0].label}</strong></p>
        <div className="rw-bars">{contribution.map((item) => <div key={item.key} className="rw-bar-row"><span title={item.label}>{item.label}</span><div className="rw-bar-track"><div className="rw-bar-fill" style={{ width: `${item.percent}%` }} /></div><strong>{item.percent}%</strong></div>)}</div>
      </>}
    </div>
    <div className="rw-diagnostics">
      <strong>Retrieval diagnostics</strong>
      <div className="rw-diag-grid">
        <span>Top score: {formatScore(diag.top_score)}</span><span>Chunks used: {diag.chunks_used ?? normalizeCitations(citations).length}</span><span>Docs used: {(diag.selected_document_ids_used || []).length}</span><span>Mode: {diag.retrieval_mode || "vector"}</span>
      </div>
      {(diag.warning || diag.is_out_of_scope) && <div className="rw-warning" style={{ marginTop: 8 }}>⚠ {diag.warning || "Điểm liên quan thấp, hãy kiểm chứng nguồn cẩn thận."}</div>}
    </div>
  </>;
}

function ChatPanel({ messages, input, onInput, onSubmit, loading, loadingLabel, selectedDocuments, session, onClear, onExport, onRegenerate, onCopy, onSaveNote, savedMessageIds, savingNoteId, onShowSources, activeCitations, diagnostics, mode, onModeChange, onPrompt, showAllPrompts, setShowAllPrompts }) {
  const bottomRef = useRef(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);
  const visibleGroups = showAllPrompts ? PROMPT_GROUPS : PROMPT_GROUPS.slice(0, 3);
  const handleKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSubmit(); } };
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  return <>
    <div className="rw-chat-head">
      <div><div className="rw-session-name">Đang ở phiên: {session?.title || "Chưa chọn phiên"}</div><div className="rw-doc-pill">Phiên này dùng tài liệu: {selectedDocuments.length ? selectedDocuments.map((d) => d.filename).join(", ") : "Chưa chọn tài liệu"}</div></div>
      <div className="rw-chat-actions">
        <div className="rw-segment" aria-label="Retrieval mode"><button className={mode === "strict" ? "active" : ""} type="button" title="Strict: ưu tiên chỉ trả lời khi có nguồn đủ liên quan" onClick={() => onModeChange("strict")}>Strict</button><button className={mode === "exploratory" ? "active" : ""} type="button" title="Exploratory: cho phép trả lời rộng hơn kèm warning từ backend" onClick={() => onModeChange("exploratory")}>Exploratory</button></div>
        <button className="rw-soft-btn" type="button" title="Export DOCX phiên hiện tại" onClick={onExport} disabled={!session?.id}>Export</button>
        <button className="rw-soft-btn" type="button" title="Xóa lịch sử chat của phiên hiện tại" onClick={onClear} disabled={!session?.id || loading}>Clear chat</button>
        <button className="rw-soft-btn" type="button" title="Tạo lại câu trả lời cuối cùng (gọi AI khi bạn bấm)" onClick={() => lastAssistant && onRegenerate(messages.lastIndexOf(lastAssistant))} disabled={!lastAssistant || loading}>Regenerate</button>
      </div>
    </div>
    <div className="rw-messages rw-scroll">
      {messages.length === 0 && <div className="rw-empty"><h2>Research Workspace nhiều tài liệu</h2><p>Chọn tài liệu ở panel trái, tạo/mở phiên, rồi đặt câu hỏi. Quick actions chỉ chạy khi bạn bấm.</p><div className="rw-prompts">{visibleGroups.map((group) => <div key={group.group} className="rw-prompt-group"><div className="rw-prompt-title">{group.group}</div><div className="rw-prompt-buttons">{group.prompts.slice(0, showAllPrompts ? 3 : 1).map((prompt) => <button className="rw-chip" type="button" key={prompt} onClick={() => onPrompt(prompt)} title="Chèn prompt vào input, không tự gọi AI">{prompt}</button>)}</div></div>)}<button className="rw-soft-btn" type="button" onClick={() => setShowAllPrompts(!showAllPrompts)}>{showAllPrompts ? "Thu gọn" : "Xem thêm prompt"}</button></div></div>}
      {messages.map((msg, index) => {
        const citations = normalizeCitations(msg.citations);
        const isAssistant = msg.role === "assistant";
        const sourceId = msg.id || `${msg.role}-${index}`;
        return <div key={sourceId} className={`rw-message ${msg.role}`}>
          {isAssistant && <div className="rw-avatar">✦</div>}
          <div className="rw-bubble">
            {msg.warning && <div className="rw-warning">⚠ {msg.warning}</div>}
            {isAssistant ? <MarkdownWithCitations content={msg.content} citations={citations} onCitationClick={onShowSources} /> : <div style={{ whiteSpace: "pre-wrap" }}>{msg.content}</div>}
            {isAssistant && !msg.streaming && <div className="rw-bubble-actions">
              <button className="rw-soft-btn" type="button" title="Lưu câu trả lời và citations vào Notes" disabled={savedMessageIds.has(sourceId) || savingNoteId === sourceId} onClick={() => onSaveNote(msg)}>{savedMessageIds.has(sourceId) ? "Đã lưu" : "Save to notes"}</button>
              <button className="rw-soft-btn" type="button" title="Copy câu trả lời, không gọi AI" onClick={() => onCopy(msg)}>Copy</button>
              <button className="rw-soft-btn" type="button" title="Mở Sources panel, không gọi AI" onClick={() => citations[0] && onShowSources(citations[0])}>Show sources</button>
              <button className="rw-soft-btn" type="button" title="Regenerate with same sources (gọi AI khi bấm)" onClick={() => onRegenerate(index)}>Regenerate same sources</button>
            </div>}
            {isAssistant && citations.length > 0 && index === messages.length - 1 && <ContributionAndDiagnostics citations={citations} diagnostics={msg.retrieval_diagnostics || diagnostics} selectedDocumentIds={selectedDocuments.map((d) => d.id)} />}
          </div>
        </div>;
      })}
      {loading && <div className="rw-stage">● {loadingLabel || "Đang truy xuất nguồn..."}</div>}
      <div ref={bottomRef} />
    </div>
    <div className="rw-input-area">
      {selectedDocuments.some((doc) => !doc.is_vector_ready) && <div className="rw-warning">Tài liệu chưa sẵn sàng vector; hệ thống có thể dùng fallback keyword/text nếu backend hỗ trợ.</div>}
      <div className="rw-textarea-wrap"><textarea className="rw-textarea rw-scroll" value={input} onChange={(e) => onInput(e.target.value)} onKeyDown={handleKey} placeholder="Đặt câu hỏi về tài liệu..." disabled={loading} maxLength={1000} /><button className="rw-primary" type="button" title="Gửi câu hỏi (Enter)" disabled={!input.trim() || loading} onClick={onSubmit}>{loading ? "Đang gửi" : "Gửi"}</button></div>
      <p className="rw-hint">Enter gửi · Shift+Enter xuống dòng · resize/collapse panel không gọi LLM.</p>
    </div>
  </>;
}

function SourcesPanel({ citations, invalidCount, activeCitation, onSelectCitation, diagnostics }) {
  const valid = normalizeCitations(citations);
  return <div className="rw-right-content rw-scroll">
    {invalidCount > 0 && <div className="rw-warning">Nguồn chưa đủ metadata để kiểm chứng: {invalidCount}</div>}
    {!valid.length && <div className="rw-warning">Chưa có citations đủ metadata từ câu trả lời hiện tại.</div>}
    {valid.map((citation) => <button type="button" key={`${citation.citation_index}-${citation.chunk_id || citation.document_title}`} className={`rw-source-item ${activeCitation?.citation_index === citation.citation_index ? "active" : ""}`} onClick={() => onSelectCitation(citation)} aria-label={`Mở preview nguồn ${citation.citation_index}`}>
      <div className="rw-source-title">[{citation.citation_index}] {citationTitle(citation)}</div>
      <div className="rw-source-meta"><span>{citationPage(citation)}</span>{citation.section && <span>{citation.section}</span>}<span>Score {formatScore(citation.score)}</span>{citation.chunk_id && <span>chunk {citation.chunk_id}</span>}</div>
      <div className="rw-snippet">{citation.snippet.slice(0, 220)}</div>
    </button>)}
    {activeCitation && <div className="rw-preview"><strong>Source preview</strong><div className="rw-source-meta"><span>{citationTitle(activeCitation)}</span><span>{citationPage(activeCitation)}</span>{activeCitation.chunk_id && <span>chunk {activeCitation.chunk_id}</span>}</div><p className="rw-snippet">{activeCitation.snippet || "Không có snippet lớn hơn từ backend; dùng metadata citation hiện có."}</p><button className="rw-soft-btn" type="button" title="Đặt follow-up từ citation này bằng cách tự gửi prompt" onClick={() => navigator.clipboard?.writeText(`Hỏi tiếp về nguồn [${activeCitation.citation_index}]: ${activeCitation.snippet}`)}>Copy follow-up prompt</button></div>}
    {diagnostics && <div className="rw-diagnostics"><strong>Diagnostics nguồn</strong><div className="rw-diag-grid"><span>Top score: {formatScore(diagnostics.top_score)}</span><span>Chunks: {diagnostics.chunks_used ?? valid.length}</span><span>Docs: {(diagnostics.selected_document_ids_used || []).length}</span><span>Mode: {diagnostics.retrieval_mode || "vector"}</span></div></div>}
  </div>;
}

function NotesPanel({ notes, loading, filter, onFilter, editingId, editDraft, onStartEdit, onEditDraft, onSaveEdit, onDelete, onExportMarkdown, onCitation }) {
  const filtered = notes.filter((note) => {
    if (filter === "all") return true;
    if (filter === "with-citation") return Array.isArray(note.citations) && normalizeCitations(note.citations).length > 0;
    return (note.note_type || "text") === filter;
  });
  return <div className="rw-right-content rw-scroll">
    <div className="rw-note-filters">{[["all","Tất cả"],["text","Text notes"],["flashcards","Flashcards"],["quiz","Quiz"],["with-citation","Có citation"]].map(([key,label]) => <button key={key} className={`rw-chip ${filter === key ? "active" : ""}`} type="button" onClick={() => onFilter(key)}>{label}</button>)}</div>
    <button className="rw-soft-btn" type="button" title="Export Markdown từ notes hiện có, không gọi LLM" onClick={onExportMarkdown} disabled={!notes.length}>Export Markdown</button>
    {loading && <div className="rw-warning">Đang tải notes...</div>}
    {!loading && !filtered.length && <div className="rw-warning">Chưa có ghi chú phù hợp.</div>}
    {filtered.map((note) => <div key={note.id} className="rw-note-item" tabIndex={0}>
      {editingId === note.id ? <div className="rw-note-edit"><input value={editDraft.title} onChange={(e) => onEditDraft({ ...editDraft, title: e.target.value })} placeholder="Tiêu đề"/><textarea rows={7} value={editDraft.content} onChange={(e) => onEditDraft({ ...editDraft, content: e.target.value })} placeholder="Nội dung ghi chú"/><div className="rw-row"><button className="rw-primary" type="button" onClick={() => onSaveEdit(note.id)}>Lưu</button><span className="rw-action-text">Autosave sau 1–2 giây khi chỉnh sửa.</span></div></div> : <>
        <div className="rw-row" style={{ justifyContent: "space-between" }}><div className="rw-note-title">{note.title || "Ghi chú mới"}</div><div className="rw-row"><button className="rw-icon-btn" type="button" title="Chỉnh sửa inline" onClick={() => onStartEdit(note)}>✎</button><button className="rw-icon-btn" type="button" title="Xóa ghi chú" onClick={() => onDelete(note.id)}>🗑</button></div></div>
        <p className="rw-snippet">{note.content}</p><div className="rw-note-meta"><span>{note.note_type || "text"}</span><span>{formatTime(note.updated_at || note.created_at)}</span>{normalizeCitations(note.citations).length > 0 && <span>{normalizeCitations(note.citations).length} nguồn</span>}</div>
        {normalizeCitations(note.citations).length > 0 && <div className="rw-row">{normalizeCitations(note.citations).slice(0, 4).map((citation) => <button className="rw-chip" type="button" key={citation.citation_index} onClick={() => onCitation(citation)}>Nguồn [{citation.citation_index}]</button>)}</div>}
      </>}
    </div>)}
  </div>;
}

function SessionsPanel({ sessions, activeSessionId, documents, onOpen, onCreate, onRename, onStar, onDelete, loading }) {
  const [renamingId, setRenamingId] = useState(null);
  const [title, setTitle] = useState("");
  const docMap = useMemo(() => new Map(documents.map((doc) => [doc.id, doc.filename])), [documents]);
  return <div className="rw-right-content rw-scroll">
    <button className="rw-primary" type="button" title="Tạo phiên mới từ selected docs hiện tại" onClick={onCreate}>＋ Phiên mới</button>
    {loading && <div className="rw-warning" style={{ marginTop: 10 }}>Đang tải sessions...</div>}
    {!loading && !sessions.length && <div className="rw-warning" style={{ marginTop: 10 }}>Chưa có phiên nghiên cứu.</div>}
    {sessions.map((session) => {
      const docNames = (session.selected_document_ids || []).map((id) => docMap.get(String(id))).filter(Boolean);
      return <div key={session.id} className={`rw-session-item ${activeSessionId === session.id ? "active" : ""}`} tabIndex={0}>
        {renamingId === session.id ? <div className="rw-note-edit"><input className="rw-rename-input" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") setRenamingId(null); if (e.key === "Enter") { onRename(session.id, title); setRenamingId(null); } }} autoFocus/><div className="rw-row"><button className="rw-primary" type="button" onClick={() => { onRename(session.id, title); setRenamingId(null); }}>Lưu tên</button><button className="rw-soft-btn" type="button" onClick={() => setRenamingId(null)}>Hủy</button></div></div> : <>
          <div className="rw-row" style={{ justifyContent: "space-between" }}><div className="rw-session-title">{activeSessionId === session.id ? "● " : ""}{session.title || "Phiên nghiên cứu"}</div><button className="rw-icon-btn" type="button" title={session.is_starred ? "Bỏ ghim" : "Ghim phiên"} onClick={() => onStar(session)}>{session.is_starred ? "★" : "☆"}</button></div>
          <div className="rw-session-meta"><span>{formatTime(session.updated_at || session.created_at)}</span><span>{docNames.length || (session.selected_document_ids || []).length} tài liệu</span></div><p className="rw-snippet">{docNames.length ? docNames.join(", ") : "Không có tên tài liệu trong cache"}</p>
          <div className="rw-row"><button className="rw-soft-btn" type="button" title="Mở phiên này" onClick={() => onOpen(session)}>Mở</button><button className="rw-soft-btn" type="button" title="Đổi tên phiên" onClick={() => { setRenamingId(session.id); setTitle(session.title || ""); }}>Rename</button><button className="rw-danger" type="button" title="Xóa phiên và lịch sử chat của phiên" onClick={() => onDelete(session.id)}>Delete</button></div>
        </>}
      </div>;
    })}
  </div>;
}

export default function ResearchWorkspace() {
  const { notebookId } = useParams();
  const location = useLocation();
  const { token } = useAuth();
  const [notebookName, setNotebookName] = useState("Notebook");
  const [documents, setDocuments] = useState([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState(() => location.state?.selectedDocumentIds || []);
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(() => location.state?.researchSession || null);
  const [messages, setMessages] = useState([]);
  const [notes, setNotes] = useState([]);
  const [input, setInput] = useState(location.state?.prefillQuestion || "");
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("");
  const [toast, setToast] = useState(null);
  const [rightTab, setRightTab] = useLocalStorageState(RIGHT_TAB_KEY, "notes");
  const [leftCollapsed, setLeftCollapsed] = useLocalStorageState(LEFT_COLLAPSED_KEY, false, (v) => v === "true");
  const [rightCollapsed, setRightCollapsed] = useLocalStorageState(RIGHT_COLLAPSED_KEY, false, (v) => v === "true");
  const [leftWidth, setLeftWidth] = useLocalStorageState(LEFT_WIDTH_KEY, 320, Number);
  const [rightWidth, setRightWidth] = useLocalStorageState(RIGHT_WIDTH_KEY, 380, Number);
  const [mobileTab, setMobileTab] = useState("chat");
  const [docFilter, setDocFilter] = useState("all");
  const [noteFilter, setNoteFilter] = useState("all");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [activeCitation, setActiveCitation] = useState(null);
  const [currentCitations, setCurrentCitations] = useState([]);
  const [invalidCitationCount, setInvalidCitationCount] = useState(0);
  const [diagnostics, setDiagnostics] = useState(null);
  const [savedMessageIds, setSavedMessageIds] = useState(new Set());
  const [savingNoteId, setSavingNoteId] = useState(null);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editDraft, setEditDraft] = useState({ title: "", content: "" });
  const [retrievalMode, setRetrievalMode] = useState("strict");
  const [showAllPrompts, setShowAllPrompts] = useState(false);
  const requestRef = useRef(null);
  const autosaveRef = useRef(null);

  const selectedDocuments = useMemo(() => documents.filter((doc) => selectedDocumentIds.includes(doc.id)), [documents, selectedDocumentIds]);
  const readyDocuments = useMemo(() => documents.filter((doc) => doc.processing_status === "ready"), [documents]);
  const activeSessionId = activeSession?.id;

  const showToast = (type, message) => setToast({ type, message });
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(null), 2600); return () => clearTimeout(t); }, [toast]);

  const loadDocuments = async () => {
    if (!token || !notebookId) return;
    setLoadingDocuments(true);
    try {
      const result = await api.getNotebookDocuments(notebookId, token);
      const docs = (result?.documents || []).map(normalizeDocument);
      setDocuments(docs);
      setSelectedDocumentIds((prev) => prev.length ? prev.filter((id) => docs.some((doc) => doc.id === id && doc.processing_status === "ready")) : docs.filter((doc) => doc.processing_status === "ready").map((doc) => doc.id));
    } catch (err) { showToast("error", err.message || "Không thể tải tài liệu."); }
    finally { setLoadingDocuments(false); }
  };
  const loadSessions = async () => {
    if (!token || !notebookId) return;
    setLoadingSessions(true);
    try {
      const result = await api.getResearchSessions(notebookId, token);
      const fetched = result?.sessions || [];
      setSessions(fetched);
      const stateId = location.state?.researchSessionId || location.state?.researchSession?.id;
      const lastId = localStorage.getItem(`${LAST_SESSION_KEY}:${notebookId}`);
      const target = fetched.find((s) => s.id === (stateId || lastId)) || fetched[0] || null;
      if (!activeSession && target) openSession(target, false);
    } catch (err) { showToast("error", err.message || "Không thể tải phiên nghiên cứu."); }
    finally { setLoadingSessions(false); }
  };
  const loadNotebookName = async () => {
    try { const result = await api.getNotebooks(token); const nb = (result?.notebooks || []).find((item) => String(item.notebook_id) === String(notebookId)); if (nb?.name) setNotebookName(nb.name); } catch {}
  };
  useEffect(() => { loadNotebookName(); loadDocuments(); loadSessions(); return () => requestRef.current?.abort?.(); }, [token, notebookId]);

  const loadNotes = async (sessionId) => {
    if (!token || !notebookId || !sessionId) { setNotes([]); setSavedMessageIds(new Set()); return; }
    setLoadingNotes(true);
    try {
      const result = await api.getWorkspaceNotes(notebookId, token, { research_session_id: sessionId });
      const fetched = result?.notes || [];
      setNotes(fetched);
      setSavedMessageIds(new Set(fetched.map((n) => n.source_message_id).filter(Boolean)));
    } catch (err) { showToast("error", err.message || "Không thể tải notes."); }
    finally { setLoadingNotes(false); }
  };
  const openSession = async (session, loadMessages = true) => {
    setActiveSession(session);
    localStorage.setItem(`${LAST_SESSION_KEY}:${notebookId}`, session.id);
    setSelectedDocumentIds((session.selected_document_ids || []).map(String));
    if (!loadMessages) { loadNotes(session.id); return; }
    try {
      const result = await api.getResearchSessionMessages(session.id, token);
      setActiveSession(result?.session || session);
      const loaded = (result?.messages || []).map((m) => ({ ...m, citations: normalizeCitations(m.citations), retrieval_diagnostics: m.retrieval_diagnostics || buildDiagnostics(m.citations, null, session.selected_document_ids) }));
      setMessages(loaded);
      const lastAssistant = [...loaded].reverse().find((m) => m.role === "assistant");
      setCurrentCitations(normalizeCitations(lastAssistant?.citations || []));
      setDiagnostics(lastAssistant?.retrieval_diagnostics || buildDiagnostics(lastAssistant?.citations || [], null, session.selected_document_ids));
      const fetchedNotes = result?.notes || [];
      setNotes(fetchedNotes);
      setSavedMessageIds(new Set(fetchedNotes.map((n) => n.source_message_id).filter(Boolean)));
      setRightTab("sessions");
    } catch (err) { showToast("error", err.message || "Không thể mở phiên."); }
  };
  const createSession = async () => {
    if (!selectedDocumentIds.length) return showToast("error", "Chọn ít nhất một tài liệu ready.");
    try {
      const result = await api.createResearchSession(notebookId, selectedDocumentIds, token);
      const session = result?.session;
      if (!session) throw new Error("Không tạo được phiên.");
      setSessions((prev) => [session, ...prev]);
      setMessages([]); setCurrentCitations([]); setDiagnostics(null);
      await openSession(session, false);
      showToast("success", "Đã tạo phiên nghiên cứu mới.");
    } catch (err) { showToast("error", err.message || "Không thể tạo phiên."); }
  };
  const toggleDocument = async (docId) => {
    const next = selectedDocumentIds.includes(docId) ? selectedDocumentIds.filter((id) => id !== docId) : [...selectedDocumentIds, docId];
    if (activeSession) {
      const choice = window.prompt("Đổi tài liệu cho phiên:\n1 = Cập nhật phiên hiện tại\n2 = Tạo phiên mới\n3 hoặc để trống = Hủy", "1");
      if (choice === "1") {
        try { const result = await api.updateResearchSession(activeSession.id, { selected_document_ids: next }, token); setActiveSession(result?.session || { ...activeSession, selected_document_ids: next }); setSessions((prev) => prev.map((s) => s.id === activeSession.id ? (result?.session || { ...s, selected_document_ids: next }) : s)); setSelectedDocumentIds(next); } catch (err) { showToast("error", err.message || "Không thể cập nhật phiên."); }
      } else if (choice === "2") { setSelectedDocumentIds(next); setTimeout(createSession, 0); }
      return;
    }
    setSelectedDocumentIds(next);
  };
  const handleUpload = async (files) => {
    setUploadError("");
    const valid = files.filter((file) => {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!SUPPORTED_UPLOAD_EXTENSIONS.has(ext)) { setUploadError(`Không hỗ trợ ${file.name}`); return false; }
      if (file.size > MAX_UPLOAD_BYTES) { setUploadError(`${file.name} vượt quá ${MAX_UPLOAD_MB}MB`); return false; }
      return true;
    });
    if (!valid.length) return;
    setUploadProgress(1);
    try { await api.uploadDocuments(notebookId, valid, token, setUploadProgress); showToast("success", "Upload hoàn tất."); await loadDocuments(); }
    catch (err) { setUploadError(err.message || "Upload thất bại."); }
    finally { setTimeout(() => setUploadProgress(0), 800); }
  };

  const startChat = async ({ question, regenerateIndex = null }) => {
    if (!question.trim() || loading) return;
    if (!activeSession) return showToast("error", "Hãy tạo hoặc mở phiên nghiên cứu trước.");
    if (!selectedDocumentIds.length) return showToast("error", "Chọn ít nhất một tài liệu.");
    const controller = new AbortController(); requestRef.current = controller;
    const userMessage = regenerateIndex == null ? { id: crypto.randomUUID?.() || `${Date.now()}-user`, role: "user", content: question } : null;
    const assistantId = crypto.randomUUID?.() || `${Date.now()}-assistant`;
    setInput(""); setLoading(true); setLoadingLabel("Đang truy xuất nguồn…"); setDiagnostics(null); setInvalidCitationCount(0);
    if (userMessage) setMessages((prev) => [...prev, userMessage]);
    else setMessages((prev) => prev.map((m, i) => i === regenerateIndex ? { ...m, content: "", citations: [], streaming: true } : m));
    let full = ""; let streamCitations = []; let streamWarning = null; let streamDiagnostics = null;
    const history = messages.filter((m, i) => regenerateIndex == null || i < regenerateIndex).filter((m) => m.role !== "system").map(({ role, content }) => ({ role, content }));
    try {
      await api.streamResearchQuery({ notebookId, question, chatHistory: history, selectedDocumentIds, researchSessionId: activeSession.id, citationThreshold: retrievalMode === "strict" ? 0.45 : 0 }, token, {
        onStatus: (_status, message) => setLoadingLabel(message || "Đang xử lý…"),
        onSources: (sources) => { streamCitations = normalizeCitations(sources); setCurrentCitations(streamCitations); setInvalidCitationCount((Array.isArray(sources) ? sources.length : 0) - streamCitations.length); setRightTab("sources"); },
        onDiagnostics: (diag) => { streamDiagnostics = diag; setDiagnostics(diag); },
        onWarning: (warning) => { streamWarning = warning; },
        onToken: (tokenChunk) => { full += tokenChunk; const partial = { id: assistantId, role: "assistant", content: full, citations: streamCitations, warning: streamWarning, retrieval_diagnostics: streamDiagnostics, streaming: true }; setMessages((prev) => regenerateIndex == null ? [...prev.filter((m) => m.id !== assistantId), partial] : prev.map((m, i) => i === regenerateIndex ? partial : m)); },
        onSuggestedPrompts: () => {},
      }, { signal: controller.signal });
      setLoadingLabel("Đang lưu phiên…");
      const finalMsg = { id: assistantId, role: "assistant", content: full, citations: streamCitations, warning: streamWarning, retrieval_diagnostics: streamDiagnostics || buildDiagnostics(streamCitations, null, selectedDocumentIds) };
      setMessages((prev) => regenerateIndex == null ? [...prev.filter((m) => m.id !== assistantId), finalMsg] : prev.map((m, i) => i === regenerateIndex ? finalMsg : m));
      setDiagnostics(finalMsg.retrieval_diagnostics); setCurrentCitations(streamCitations);
    } catch (err) { showToast("error", err.message || "Không thể gọi RAG."); }
    finally { setLoading(false); setLoadingLabel(""); requestRef.current = null; }
  };
  const handleSubmit = () => startChat({ question: input });
  const handleRegenerate = (assistantIndex) => {
    const user = [...messages].slice(0, assistantIndex).reverse().find((m) => m.role === "user");
    if (!user) return showToast("error", "Không tìm thấy câu hỏi trước đó.");
    startChat({ question: user.content, regenerateIndex: assistantIndex });
  };
  const handleShowSources = (citation) => { setActiveCitation(citation); setCurrentCitations((prev) => normalizeCitations(prev.length ? prev : citation ? [citation] : [])); setRightTab("sources"); setMobileTab("sources"); };
  const handleSaveNote = async (msg) => {
    const id = msg.id || `${msg.role}-${msg.content.slice(0, 24)}`; if (savedMessageIds.has(id)) return;
    setSavingNoteId(id);
    try { const citations = normalizeCitations(msg.citations); const result = await api.createWorkspaceNote(notebookId, { title: generateNoteTitle(msg.content), content: noteMarkdownFromMessage(msg, citations), citations, source_message_id: id, research_session_id: activeSession?.id, note_type: "text", metadata: { saved_from: "research_workspace" } }, token); const note = result?.note; if (note) setNotes((prev) => [note, ...prev]); setSavedMessageIds((prev) => new Set([...prev, id])); showToast("success", "Đã lưu vào notes."); }
    catch (err) { showToast("error", err.message || "Không thể lưu note."); }
    finally { setSavingNoteId(null); }
  };
  const handleSaveEdit = async (noteId) => {
    try { const result = await api.updateNote(noteId, { title: editDraft.title || "Ghi chú mới", content: editDraft.content }, token); const note = result?.note; setNotes((prev) => prev.map((n) => n.id === noteId ? (note || { ...n, ...editDraft }) : n)); setEditingNoteId(null); showToast("success", "Đã lưu note."); } catch (err) { showToast("error", err.message || "Không thể lưu note."); }
  };
  useEffect(() => {
    if (!editingNoteId) return undefined;
    clearTimeout(autosaveRef.current);
    autosaveRef.current = setTimeout(() => handleSaveEdit(editingNoteId), 1400);
    return () => clearTimeout(autosaveRef.current);
  }, [editDraft.title, editDraft.content]);
  const exportMarkdown = () => {
    const md = [`# Notes - ${activeSession?.title || notebookName}`, ...notes.map((n) => `\n## ${n.title || "Ghi chú"}\n\n${n.content || ""}`)].join("\n");
    const url = URL.createObjectURL(new Blob([md], { type: "text/markdown" })); const a = document.createElement("a"); a.href = url; a.download = `${notebookName}-notes.md`; a.click(); URL.revokeObjectURL(url);
  };
  const handleResize = (side, event) => {
    const startX = event.clientX; const startWidth = side === "left" ? leftWidth : rightWidth;
    const onMove = (e) => { const delta = e.clientX - startX; const next = side === "left" ? startWidth + delta : startWidth - delta; const min = side === "left" ? 260 : 300; const max = side === "left" ? 520 : 560; (side === "left" ? setLeftWidth : setRightWidth)(Math.min(max, Math.max(min, next))); };
    const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
    document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp);
  };

  return <div className="rw-page"><WorkspaceStyles />
    <div className="rw-topbar"><div className="rw-title"><h1>Research Workspace · {notebookName}</h1><p>Documents / Chat / Notes-Sources-Sessions trong một workspace. Không tự gọi LLM khi chỉ đổi layout, panel, source hoặc notes.</p></div><div className="rw-mode"><button className="rw-soft-btn" type="button" aria-label="Ẩn hoặc hiện panel tài liệu" onClick={() => setLeftCollapsed(!leftCollapsed)}>{leftCollapsed ? "Mở Documents" : "Ẩn Documents"}</button><button className="rw-soft-btn" type="button" aria-label="Ẩn hoặc hiện panel phải" onClick={() => setRightCollapsed(!rightCollapsed)}>{rightCollapsed ? "Mở Notes/Sources" : "Ẩn Notes/Sources"}</button></div></div>
    <div className="rw-mobile-tabs">{[["documents","Tài liệu"],["chat","Chat"],["notes","Ghi chú"],["sources","Nguồn"]].map(([key,label]) => <button key={key} type="button" className={mobileTab === key ? "active" : ""} onClick={() => { setMobileTab(key); if (["notes","sources"].includes(key)) setRightTab(key); }}>{label}</button>)}</div>
    <div className="rw-shell">
      {leftCollapsed ? <div className="rw-reopen"><button className="rw-icon-btn" type="button" aria-label="Mở panel tài liệu" title="Mở Documents" onClick={() => setLeftCollapsed(false)}>📄</button></div> : <><aside className={`rw-panel ${mobileTab === "documents" ? "mobile-active" : ""}`} style={{ width: leftWidth }}><DocumentsPanel documents={documents} selectedDocumentIds={selectedDocumentIds} onToggleDocument={toggleDocument} onSelectAllReady={() => setSelectedDocumentIds(readyDocuments.map((d) => d.id))} onCreateSession={createSession} onUpload={handleUpload} uploadProgress={uploadProgress} uploadError={uploadError} filter={docFilter} onFilterChange={setDocFilter} loadingDocuments={loadingDocuments} /></aside><div className="rw-resizer" role="separator" aria-label="Resize documents panel" onMouseDown={(e) => handleResize("left", e)} /></>}
      <main className={`rw-center ${mobileTab === "chat" ? "mobile-active" : ""}`}><ChatPanel messages={messages} input={input} onInput={setInput} onSubmit={handleSubmit} loading={loading} loadingLabel={loadingLabel} selectedDocuments={selectedDocuments} session={activeSession} onClear={async () => { if (!activeSession?.id || !window.confirm("Xóa lịch sử chat phiên này?")) return; await api.clearResearchSessionMessages(activeSession.id, token); setMessages([]); setCurrentCitations([]); }} onExport={async () => { if (!activeSession?.id) return; const response = await api.exportResearchSessionDocx(activeSession.id, token); const url = URL.createObjectURL(new Blob([response.data])); const a = document.createElement("a"); a.href = url; a.download = `${activeSession.title || "research-session"}.docx`; a.click(); URL.revokeObjectURL(url); }} onRegenerate={handleRegenerate} onCopy={(msg) => navigator.clipboard?.writeText(msg.content || "").then(() => showToast("success", "Đã copy."))} onSaveNote={handleSaveNote} savedMessageIds={savedMessageIds} savingNoteId={savingNoteId} onShowSources={handleShowSources} activeCitations={currentCitations} diagnostics={diagnostics} mode={retrievalMode} onModeChange={setRetrievalMode} onPrompt={(prompt) => setInput(prompt)} showAllPrompts={showAllPrompts} setShowAllPrompts={setShowAllPrompts} /></main>
      {rightCollapsed ? <div className="rw-reopen rw-right-reopen"><button className="rw-icon-btn" type="button" aria-label="Mở panel Notes Sources Sessions" title="Mở panel phải" onClick={() => setRightCollapsed(false)}>☰</button></div> : <><div className="rw-resizer" role="separator" aria-label="Resize notes sources sessions panel" onMouseDown={(e) => handleResize("right", e)} /><aside className={`rw-panel rw-right ${["notes","sources"].includes(mobileTab) ? "mobile-active" : ""}`} style={{ width: rightWidth }}><div className="rw-tabs" role="tablist"><button className={`rw-tab ${rightTab === "notes" ? "active" : ""}`} type="button" onClick={() => setRightTab("notes")}>Notes</button><button className={`rw-tab ${rightTab === "sources" ? "active" : ""}`} type="button" onClick={() => setRightTab("sources")}>Sources</button><button className={`rw-tab ${rightTab === "sessions" ? "active" : ""}`} type="button" onClick={() => setRightTab("sessions")}>Sessions</button></div>{rightTab === "notes" && <NotesPanel notes={notes} loading={loadingNotes} filter={noteFilter} onFilter={setNoteFilter} editingId={editingNoteId} editDraft={editDraft} onStartEdit={(note) => { setEditingNoteId(note.id); setEditDraft({ title: note.title || "", content: note.content || "" }); }} onEditDraft={setEditDraft} onSaveEdit={handleSaveEdit} onDelete={async (id) => { if (window.confirm("Xóa ghi chú này?")) { await api.deleteNote(id, token); setNotes((prev) => prev.filter((n) => n.id !== id)); } }} onExportMarkdown={exportMarkdown} onCitation={handleShowSources} />}{rightTab === "sources" && <SourcesPanel citations={currentCitations} invalidCount={invalidCitationCount} activeCitation={activeCitation} onSelectCitation={setActiveCitation} diagnostics={diagnostics} />}{rightTab === "sessions" && <SessionsPanel sessions={sessions} activeSessionId={activeSessionId} documents={documents} loading={loadingSessions} onOpen={openSession} onCreate={createSession} onRename={async (id, title) => { const result = await api.updateResearchSession(id, { title }, token); setSessions((prev) => prev.map((s) => s.id === id ? (result?.session || { ...s, title }) : s)); if (activeSessionId === id) setActiveSession(result?.session || { ...activeSession, title }); }} onStar={async (session) => { const result = await api.updateResearchSession(session.id, { is_starred: !session.is_starred }, token); setSessions((prev) => prev.map((s) => s.id === session.id ? (result?.session || { ...s, is_starred: !s.is_starred }) : s)); }} onDelete={async (id) => { if (!window.confirm("Xóa phiên này? Notes sẽ được giữ theo backend hiện tại.")) return; await api.deleteResearchSession(id, token); setSessions((prev) => prev.filter((s) => s.id !== id)); if (activeSessionId === id) { setActiveSession(null); setMessages([]); setCurrentCitations([]); } }} />}</aside></>}
    </div>{toast && <div className={`rw-toast ${toast.type}`}>{toast.message}</div>}
  </div>;
}
