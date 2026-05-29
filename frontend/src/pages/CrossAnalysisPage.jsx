import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Columns, Download, FileText, GitCompare, Loader2, Merge, MessageSquare, Search, UploadCloud, WandSparkles, X } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

const CRITERIA = [
  { key: 'problem_motivation', label: 'Định vị vấn đề và động lực', hint: 'Mục tiêu, giả định và động lực nghiên cứu.' },
  { key: 'methodology', label: 'Phương pháp tiếp cận', hint: 'Thuật toán, kiến trúc, tính mới và chi phí.' },
  { key: 'datasets_experiments', label: 'Dữ liệu và thiết lập thực nghiệm', hint: 'Datasets, baselines, metrics và fairness.' },
  { key: 'results_tradeoffs', label: 'Kết quả và đánh đổi', hint: 'Điều kiện thắng, ablation, tốc độ và độ chính xác.' },
  { key: 'scalability_limitations', label: 'Khả năng mở rộng và hạn chế', hint: 'Ứng dụng thực tiễn, rủi ro production, future work.' },
];

const STYLES = `
  .ca-page { min-height: 100vh; padding: 30px clamp(18px, 3vw, 42px) 60px; background: radial-gradient(ellipse at 44% 0%, rgba(196,164,100,0.12), transparent 44%), #0f0d0a; color: #e8dfd0; font-family: 'Lora', Georgia, serif; }
  .ca-page button, .ca-page input, .ca-page textarea { font-family: inherit; }
  .ca-hero { border: 1px solid rgba(255,255,255,.08); border-radius: 28px; padding: clamp(22px, 4vw, 38px); background: radial-gradient(circle at 84% 20%, rgba(112,88,42,.32), transparent 30%), linear-gradient(135deg, rgba(255,255,255,.06), rgba(255,255,255,.02)); box-shadow: 0 28px 90px rgba(0,0,0,.32); }
  .ca-eyebrow { display: inline-flex; align-items: center; gap: 8px; color: #d8bd77; font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
  .ca-hero h1 { margin: 12px 0 10px; font-size: clamp(30px, 5vw, 54px); line-height: 1.04; color: #f3ebdc; }
  .ca-hero p { max-width: 840px; color: #a99e8e; line-height: 1.7; }
  .ca-section { margin-top: 20px; border: 1px solid rgba(255,255,255,.08); border-radius: 24px; background: rgba(255,255,255,.035); box-shadow: 0 20px 70px rgba(0,0,0,.24); padding: 18px; }
  .ca-section-title { display:flex; align-items:center; gap: 10px; margin: 0 0 14px; color:#f2d48b; font-size: 18px; }
  .ca-picker-grid, .ca-split { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
  .ca-slot, .ca-doc-panel { border: 1px solid rgba(255,255,255,.08); border-radius: 20px; background: rgba(0,0,0,.18); padding: 16px; min-height: 190px; }
  .ca-slot-head { display:flex; align-items:center; justify-content: space-between; gap:12px; color:#d8caa8; }
  .ca-slot-label { display:flex; align-items:center; gap:8px; font-weight: 800; color:#f3ebdc; }
  .ca-doc-title { margin: 14px 0 8px; font-size: 18px; color:#f3ebdc; }
  .ca-muted { color:#928777; font-size: 13px; line-height: 1.6; }
  .ca-actions { display:flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
  .ca-btn { border:0; border-radius: 14px; padding: 11px 15px; display:inline-flex; align-items:center; justify-content:center; gap:8px; background: rgba(255,255,255,.06); color:#d8caa8; cursor:pointer; border:1px solid rgba(255,255,255,.08); }
  .ca-btn:hover { color:#f5db98; border-color: rgba(196,164,100,.25); }
  .ca-btn.primary { background: linear-gradient(135deg, #d4b66f, #8a6a30); color:#18130d; font-weight:900; border:0; }
  .ca-btn.danger { color:#ffb4a8; }
  .ca-btn:disabled { opacity:.45; cursor:not-allowed; }
  .ca-warning { margin-top: 12px; border: 1px solid rgba(224,120,120,.24); background: rgba(224,120,120,.08); color:#f0b5aa; border-radius: 15px; padding: 11px 13px; display:flex; gap:8px; align-items:flex-start; }
  .ca-criteria { display:grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap:10px; margin-top:14px; }
  .ca-criterion { display:flex; gap:10px; align-items:flex-start; padding: 12px; border-radius:16px; border:1px solid rgba(255,255,255,.08); background:rgba(0,0,0,.14); cursor:pointer; }
  .ca-criterion input { margin-top:3px; accent-color:#d4b66f; }
  .ca-criterion strong { display:block; color:#f0e5d5; font-size:13px; }
  .ca-criterion span { display:block; color:#8d8374; font-size:12px; margin-top:4px; line-height:1.45; }
  .ca-toolbar { display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; align-items:center; }
  .ca-table-wrap { overflow:auto; max-height: 520px; border-radius:18px; border:1px solid rgba(255,255,255,.08); }
  .ca-table { width:100%; border-collapse:collapse; min-width:920px; background: rgba(0,0,0,.16); }
  .ca-table th, .ca-table td { padding: 13px 14px; border-bottom:1px solid rgba(255,255,255,.07); text-align:left; vertical-align:top; color:#d8cfc0; line-height:1.55; }
  .ca-table th { position:sticky; top:0; background:#1a160f; color:#f2d48b; z-index:1; }
  .ca-confidence { white-space:nowrap; color:#9fd0aa; font-weight:800; }
  .ca-doc-panel { max-height: 410px; overflow:auto; }
  .ca-doc-panel h3 { margin: 0 0 8px; color:#f3ebdc; }
  .ca-snippet { margin-top: 12px; padding: 12px; border-radius:15px; background:rgba(255,255,255,.045); color:#bfb4a3; line-height:1.6; font-size:13px; }
  .ca-chat-log { display:grid; gap:10px; max-height: 360px; overflow:auto; padding-right:4px; }
  .ca-message { border-radius:16px; padding:12px 14px; line-height:1.6; white-space:pre-wrap; }
  .ca-message.user { margin-left:auto; max-width:80%; background:rgba(212,182,111,.16); color:#f4e7ca; }
  .ca-message.assistant { background:rgba(255,255,255,.045); color:#d8cfc0; }
  .ca-chat-form { display:grid; grid-template-columns: 1fr auto; gap:10px; margin-top:12px; }
  .ca-chat-form textarea, .ca-modal-search { width:100%; border:1px solid rgba(255,255,255,.09); background:rgba(0,0,0,.22); color:#eee6d8; border-radius:15px; padding:12px; outline:none; resize:vertical; }
  .ca-result-box { margin-top:14px; border:1px solid rgba(196,164,100,.18); background:rgba(196,164,100,.07); border-radius:18px; padding:14px; color:#d8cfc0; line-height:1.6; }
  .ca-modal-backdrop { position:fixed; inset:0; z-index:90; background:rgba(0,0,0,.7); backdrop-filter: blur(5px); display:grid; place-items:center; padding:20px; }
  .ca-modal { width:min(880px, 100%); max-height:85vh; overflow:auto; border:1px solid rgba(255,255,255,.1); border-radius:24px; background:#17130e; padding:18px; box-shadow: 0 30px 100px rgba(0,0,0,.55); }
  .ca-modal-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px; }
  .ca-modal-list { display:grid; gap:10px; margin-top:12px; }
  .ca-modal-doc { text-align:left; border:1px solid rgba(255,255,255,.08); border-radius:16px; background:rgba(255,255,255,.035); padding:12px; color:#d8cfc0; cursor:pointer; }
  .ca-modal-doc:hover { border-color:rgba(196,164,100,.28); }
  @media (max-width: 900px) { .ca-picker-grid, .ca-split { grid-template-columns: 1fr; } .ca-chat-form { grid-template-columns: 1fr; } }
`;

function sourceLabel(doc) {
  if (!doc) return 'Chưa chọn';
  return doc.source_type === 'system_library' ? 'Thư viện Hệ thống' : 'File upload tạm';
}

function toDocumentRef(doc) {
  if (!doc) return null;
  return { id: doc.id, source_type: doc.source_type, title: doc.title, filename: doc.filename, file_type: doc.file_type };
}

function sameDocument(a, b) {
  return Boolean(a && b && a.source_type === b.source_type && String(a.id) === String(b.id));
}

function escapeCsv(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(rows) {
  const headers = ['Tiêu chí', 'Tài liệu A', 'Tài liệu B', 'Nhận xét so sánh', 'Độ tin cậy'];
  const lines = [headers.map(escapeCsv).join(','), ...rows.map((row) => [row.criterion, row.document_a, row.document_b, row.analysis, row.confidence].map(escapeCsv).join(','))];
  const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `cross-analysis-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function DocumentSlot({ label, document, onUpload, onOpenLibrary, onClear, uploading }) {
  const inputRef = useRef(null);
  return (
    <section className="ca-slot">
      <div className="ca-slot-head">
        <span className="ca-slot-label"><FileText size={18} /> {label}</span>
        {document && <button className="ca-btn danger" type="button" onClick={onClear}><X size={15} /> Bỏ chọn</button>}
      </div>
      {document ? (
        <>
          <h3 className="ca-doc-title">{document.title || document.filename}</h3>
          <p className="ca-muted">{sourceLabel(document)} · {document.file_type || 'FILE'}</p>
          {document.summary && <p className="ca-muted">{document.summary}</p>}
        </>
      ) : (
        <p className="ca-muted" style={{ marginTop: 16 }}>Upload file từ máy hoặc chọn tài liệu đã chuẩn hóa trong Thư viện Hệ thống.</p>
      )}
      <div className="ca-actions">
        <input ref={inputRef} type="file" hidden accept=".pdf,.docx,.txt,.md" onChange={(event) => event.target.files?.[0] && onUpload(event.target.files[0])} />
        <button className="ca-btn" type="button" disabled={uploading} onClick={() => inputRef.current?.click()}>{uploading ? <Loader2 size={16} /> : <UploadCloud size={16} />} Upload File</button>
        <button className="ca-btn" type="button" onClick={onOpenLibrary}><Search size={16} /> Chọn từ Thư viện Hệ thống</button>
      </div>
    </section>
  );
}

function SystemDocumentPickerModal({ open, onClose, onSelect }) {
  const { token } = useAuth();
  const [query, setQuery] = useState('');
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    api.listSystemLibraryDocuments({ q: query }, token)
      .then((data) => { if (!cancelled) setDocuments(data?.documents || data?.items || []); })
      .catch((err) => { if (!cancelled) setError(err.message || 'Không thể tải Thư viện Hệ thống.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, query, token]);

  if (!open) return null;
  return (
    <div className="ca-modal-backdrop" onClick={onClose}>
      <section className="ca-modal" onClick={(event) => event.stopPropagation()}>
        <div className="ca-modal-head">
          <h2 className="ca-section-title"><Search size={18} /> Chọn từ Thư viện Hệ thống</h2>
          <button className="ca-btn" type="button" onClick={onClose}><X size={16} /> Đóng</button>
        </div>
        <input className="ca-modal-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên, tag, chủ đề..." />
        {error && <div className="ca-warning"><AlertTriangle size={16} /> {error}</div>}
        {loading ? <p className="ca-muted" style={{ marginTop: 12 }}>Đang tải tài liệu...</p> : (
          <div className="ca-modal-list">
            {documents.map((doc) => (
              <button key={doc.id} className="ca-modal-doc" type="button" onClick={() => { onSelect({ ...doc, source_type: 'system_library' }); onClose(); }}>
                <strong>{doc.title || doc.filename}</strong>
                <p className="ca-muted">{doc.category || 'Khác'} · {doc.file_type || 'FILE'} · {doc.is_vector_ready ? 'RAG ready' : 'Chưa vector ready'}</p>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function QuickResultPanel({ quickResult }) {
  if (!quickResult) return null;
  const { type, result } = quickResult;
  if (type === 'conflicts') {
    const conflicts = result?.conflicts || [];
    return (
      <div className="ca-result-box">
        <strong>Kết quả tìm mâu thuẫn</strong>
        {!conflicts.length && <p>{result?.message || 'Không tìm thấy mâu thuẫn đáng kể.'}</p>}
        {conflicts.map((item, index) => (
          <div className="ca-snippet" key={`${item.topic}-${index}`}>
            <strong>{item.topic || `Mâu thuẫn ${index + 1}`} · {item.conflict_level || 'unknown'}</strong>
            <p><b>A:</b> {item.document_a_claim || 'Không thấy trong trích đoạn.'}</p>
            <p><b>B:</b> {item.document_b_claim || 'Không thấy trong trích đoạn.'}</p>
            <p>{item.explanation}</p>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="ca-result-box">
      <strong>Bản hợp nhất kiến thức</strong>
      {result?.synthesis && <p>{result.synthesis}</p>}
      {Boolean(result?.key_points?.length) && <ul>{result.key_points.map((point, index) => <li key={index}>{point}</li>)}</ul>}
      {Boolean(result?.keep_from_a?.length) && <p><b>Nên giữ từ A:</b> {result.keep_from_a.join('; ')}</p>}
      {Boolean(result?.keep_from_b?.length) && <p><b>Nên giữ từ B:</b> {result.keep_from_b.join('; ')}</p>}
    </div>
  );
}

export default function CrossAnalysisPage() {
  const { token } = useAuth();
  const [documentA, setDocumentA] = useState(null);
  const [documentB, setDocumentB] = useState(null);
  const [selectedCriteria, setSelectedCriteria] = useState(CRITERIA.map((item) => item.key));
  const [comparisonResult, setComparisonResult] = useState(null);
  const [quickResult, setQuickResult] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [activeSlot, setActiveSlot] = useState(null);
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');

  const tableRows = comparisonResult?.comparison_table || [];
  const canAnalyze = documentA && documentB && !sameDocument(documentA, documentB);
  const sameWarning = sameDocument(documentA, documentB) ? 'Vui lòng chọn hai tài liệu khác nhau để so sánh.' : '';
  const payload = useMemo(() => ({ document_a: toDocumentRef(documentA), document_b: toDocumentRef(documentB) }), [documentA, documentB]);

  const uploadForSlot = async (slot, file) => {
    setLoading(`upload-${slot}`);
    setError('');
    try {
      const doc = await api.uploadCrossAnalysisDocument(file, token);
      if (slot === 'A') setDocumentA(doc); else setDocumentB(doc);
    } catch (err) {
      setError(err.message || 'Upload thất bại.');
    } finally {
      setLoading('');
    }
  };

  const analyze = async () => {
    if (!canAnalyze) return;
    setLoading('compare');
    setError('');
    setQuickResult(null);
    try {
      const result = await api.compareCrossAnalysisDocuments({ ...payload, criteria: selectedCriteria }, token);
      setComparisonResult(result);
    } catch (err) {
      setError(err.message || 'Không thể phân tích hai tài liệu.');
    } finally {
      setLoading('');
    }
  };

  const runQuickAction = async (type) => {
    if (!canAnalyze) return;
    setLoading(type);
    setError('');
    try {
      const result = type === 'conflicts' ? await api.findCrossAnalysisConflicts(payload, token) : await api.synthesizeCrossAnalysisDocuments(payload, token);
      setQuickResult({ type, result });
    } catch (err) {
      setError(err.message || 'Quick action thất bại.');
    } finally {
      setLoading('');
    }
  };

  const sendChat = async (event) => {
    event.preventDefault();
    const message = chatInput.trim();
    if (!message || !canAnalyze) return;
    const nextHistory = [...chatMessages, { role: 'user', content: message }];
    setChatMessages(nextHistory);
    setChatInput('');
    setLoading('chat');
    try {
      const result = await api.chatCrossAnalysisDocuments({ ...payload, message, chat_history: nextHistory }, token);
      setChatMessages((current) => [...current, { role: 'assistant', content: result.answer || 'Không có phản hồi.' }]);
    } catch (err) {
      setChatMessages((current) => [...current, { role: 'assistant', content: err.message || 'Không thể trả lời chat.' }]);
    } finally {
      setLoading('');
    }
  };

  return (
    <div className="ca-page">
      <style>{STYLES}</style>
      <section className="ca-hero">
        <span className="ca-eyebrow"><GitCompare size={15} /> Cross-Analysis · two-document RAG</span>
        <h1>Phân tích Tương quan</h1>
        <p>So sánh sâu hai tài liệu, phát hiện mâu thuẫn logic, hợp nhất tri thức và xuất bảng đối chiếu ra CSV có hỗ trợ tiếng Việt.</p>
      </section>

      <section className="ca-section">
        <h2 className="ca-section-title"><Columns size={20} /> 1. Chọn hai tài liệu</h2>
        <div className="ca-picker-grid">
          <DocumentSlot label="Tài liệu A" document={documentA} uploading={loading === 'upload-A'} onUpload={(file) => uploadForSlot('A', file)} onOpenLibrary={() => setActiveSlot('A')} onClear={() => setDocumentA(null)} />
          <DocumentSlot label="Tài liệu B" document={documentB} uploading={loading === 'upload-B'} onUpload={(file) => uploadForSlot('B', file)} onOpenLibrary={() => setActiveSlot('B')} onClear={() => setDocumentB(null)} />
        </div>
        <div className="ca-criteria">
          {CRITERIA.map((criterion) => (
            <label key={criterion.key} className="ca-criterion" title={criterion.hint}>
              <input type="checkbox" checked={selectedCriteria.includes(criterion.key)} onChange={() => setSelectedCriteria((current) => current.includes(criterion.key) ? current.filter((key) => key !== criterion.key) : [...current, criterion.key])} />
              <span><strong>{criterion.label}</strong><span>{criterion.hint}</span></span>
            </label>
          ))}
        </div>
        {(error || sameWarning) && <div className="ca-warning"><AlertTriangle size={17} /> {error || sameWarning}</div>}
        <div className="ca-actions">
          <button className="ca-btn primary" type="button" disabled={!canAnalyze || loading === 'compare'} onClick={analyze}>{loading === 'compare' ? <Loader2 size={17} /> : <GitCompare size={17} />} Phân tích</button>
          <button className="ca-btn" type="button" disabled={!canAnalyze || loading === 'conflicts'} onClick={() => runQuickAction('conflicts')}><AlertTriangle size={17} /> Tìm Điểm Mâu Thuẫn</button>
          <button className="ca-btn" type="button" disabled={!canAnalyze || loading === 'synthesis'} onClick={() => runQuickAction('synthesis')}><Merge size={17} /> Hợp nhất Kiến thức</button>
        </div>
      </section>

      <section className="ca-section">
        <div className="ca-toolbar">
          <h2 className="ca-section-title"><CheckCircle2 size={20} /> 2. Bảng đối chiếu trực quan</h2>
          <button className="ca-btn" type="button" disabled={!tableRows.length} onClick={() => downloadCsv(tableRows)}><Download size={16} /> Xuất CSV</button>
        </div>
        {comparisonResult?.summary && <p className="ca-muted">{comparisonResult.summary}</p>}
        {tableRows.length ? (
          <div className="ca-table-wrap">
            <table className="ca-table">
              <thead><tr><th>Tiêu chí</th><th>Tài liệu A</th><th>Tài liệu B</th><th>Nhận xét so sánh</th><th>Độ tin cậy</th></tr></thead>
              <tbody>{tableRows.map((row, index) => <tr key={`${row.criterion}-${index}`}><td>{row.criterion}</td><td>{row.document_a}</td><td>{row.document_b}</td><td>{row.analysis}</td><td className="ca-confidence">{typeof row.confidence === 'number' ? `${Math.round(row.confidence * 100)}%` : row.confidence || 'N/A'}</td></tr>)}</tbody>
            </table>
          </div>
        ) : <p className="ca-muted">Bảng sẽ xuất hiện ngay dưới phần chọn tài liệu sau khi bấm “Phân tích”.</p>}
        <QuickResultPanel quickResult={quickResult} />
      </section>

      <section className="ca-section">
        <h2 className="ca-section-title"><Columns size={20} /> 3. Split-screen hai tài liệu</h2>
        <div className="ca-split">
          {[['A', documentA], ['B', documentB]].map(([label, doc]) => (
            <article key={label} className="ca-doc-panel">
              <h3>Tài liệu {label}: {doc?.title || 'Chưa chọn'}</h3>
              <p className="ca-muted">{sourceLabel(doc)} · {doc?.filename || '—'}</p>
              {doc?.summary && <div className="ca-snippet"><strong>Tóm tắt:</strong><br />{doc.summary}</div>}
              {(doc?.snippets || []).map((snippet, index) => <div className="ca-snippet" key={index}><strong>{snippet.section || 'Trích đoạn'} · Trang {snippet.page_number || '?'}</strong><br />{snippet.content}</div>)}
            </article>
          ))}
        </div>
      </section>

      <section className="ca-section">
        <h2 className="ca-section-title"><MessageSquare size={20} /> 4. Chat AI theo đúng hai tài liệu</h2>
        <div className="ca-chat-log">
          {chatMessages.length === 0 ? <p className="ca-muted">Hỏi AI về điểm giống/khác nhau, lý do mâu thuẫn, hoặc cách kết hợp hai tài liệu.</p> : chatMessages.map((msg, index) => <div key={index} className={`ca-message ${msg.role}`}>{msg.content}</div>)}
        </div>
        <form className="ca-chat-form" onSubmit={sendChat}>
          <textarea rows={3} value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder="Ví dụ: Hai tài liệu khác nhau ở giả định nào?" />
          <button className="ca-btn primary" type="submit" disabled={!canAnalyze || loading === 'chat'}>{loading === 'chat' ? <Loader2 size={17} /> : <WandSparkles size={17} />} Gửi</button>
        </form>
      </section>

      <SystemDocumentPickerModal open={Boolean(activeSlot)} onClose={() => setActiveSlot(null)} onSelect={(doc) => activeSlot === 'A' ? setDocumentA(doc) : setDocumentB(doc)} />
    </div>
  );
}
