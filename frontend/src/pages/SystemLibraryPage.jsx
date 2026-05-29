import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Library, Sparkles } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import SystemLibrarySearchBar from '../components/system-library/SystemLibrarySearchBar';
import SystemLibraryFilters from '../components/system-library/SystemLibraryFilters';
import SystemLibraryToolbar from '../components/system-library/SystemLibraryToolbar';
import SystemDocumentCard from '../components/system-library/SystemDocumentCard';

const emptyFilters = { categories: [], file_types: [], updated_ranges: [], vector_status: [] };

const STYLES = `
  .sl-page { min-height: 100vh; padding: 30px clamp(18px, 3vw, 42px) 54px; background: radial-gradient(ellipse at 40% 0%, rgba(196,164,100,0.11), transparent 42%), linear-gradient(180deg, #0f0d0a 0%, #12100c 100%); font-family: 'Lora', Georgia, serif; }
  .sl-hero { border: 1px solid rgba(255,255,255,0.08); border-radius: 28px; padding: clamp(24px, 4vw, 38px); background: radial-gradient(circle at 80% 20%, rgba(112,88,42,0.3), transparent 28%), linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02)); box-shadow: 0 30px 90px rgba(0,0,0,0.32); }
  .sl-page button, .sl-page input { font-family: inherit; }
  .sl-hero__eyebrow { display: inline-flex; align-items: center; gap: 8px; color: #d8bd77; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
  .sl-hero h1 { margin: 12px 0 10px; color: #f3ebdc; font-size: clamp(30px, 5vw, 54px); line-height: 1.04; }
  .sl-hero p { max-width: 780px; color: #9f9587; line-height: 1.7; font-size: 15px; }
  .sl-hero__stats { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 22px; }
  .sl-stat { padding: 11px 14px; border-radius: 16px; background: rgba(0,0,0,0.18); border: 1px solid rgba(255,255,255,0.07); color: #bfb4a3; font-size: 12px; }
  .sl-stat strong { color: #f0d089; font-size: 18px; margin-right: 6px; }
  .sl-search { margin-top: 24px; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 12px; padding: 10px; border-radius: 20px; background: rgba(8,7,5,0.74); border: 1px solid rgba(255,255,255,0.09); }
  .sl-search__icon { margin-left: 8px; color: #c4a464; }
  .sl-search input { min-width: 0; border: 0; outline: none; background: transparent; color: #eee6d8; font-size: 15px; }
  .sl-search__button, .sl-toolbar-btn, .sl-chat-action { border: 0; border-radius: 14px; padding: 11px 16px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; background: linear-gradient(135deg, #d4b66f, #8a6a30); color: #18130d; font-weight: 800; cursor: pointer; text-decoration: none; }
  .sl-search__button:disabled, .sl-toolbar-btn:disabled, .sl-chat-action:disabled { opacity: .42; cursor: not-allowed; }
  .sl-body { display: grid; grid-template-columns: minmax(220px, 276px) 1fr; gap: 20px; margin-top: 22px; align-items: start; }
  .sl-filters, .sl-toolbar, .sl-card, .sl-empty, .sl-error { border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.035); border-radius: 22px; box-shadow: 0 18px 60px rgba(0,0,0,0.24); }
  .sl-filters { position: sticky; top: 18px; padding: 18px; color: #bfb4a3; }
  .sl-filters__header { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 14px; }
  .sl-filters__header p { margin: 0 0 2px; color: #746b5d; font-size: 11px; text-transform: uppercase; }
  .sl-filters__header strong, .sl-filter-group h3 { color: #efe6d8; }
  .sl-filter-group { margin-top: 18px; }
  .sl-filter-group h3 { margin: 0 0 10px; font-size: 14px; }
  .sl-filter-options, .sl-active-tags, .sl-card__tags { display: flex; flex-wrap: wrap; gap: 8px; }
  .sl-filter-chip { border: 1px solid rgba(255,255,255,0.08); border-radius: 999px; padding: 7px 10px; cursor: pointer; color: #a79b8a; font-size: 12px; }
  .sl-filter-chip input { display: none; }
  .sl-filter-chip.is-active { color: #1a130c; background: #d4b66f; }
  .sl-link-button { border: 0; background: transparent; color: #d4b66f; cursor: pointer; }
  .sl-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 15px 18px; color: #bfb4a3; margin-bottom: 16px; }
  .sl-toolbar strong { color: #f2d48b; font-size: 22px; }
  .sl-toolbar__actions { display: flex; gap: 10px; }
  .sl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
  .sl-card { position: relative; padding: 16px; color: #efe6d8; display: flex; flex-direction: column; gap: 14px; }
  .sl-preview { display: none; position: absolute; z-index: 10; left: 16px; right: 16px; top: 58px; padding: 14px; border-radius: 16px; border: 1px solid rgba(255,255,255,.1); background: rgba(15,13,10,.98); color: #efe6d8; box-shadow: 0 18px 60px rgba(0,0,0,.38); }
  .sl-card:hover .sl-preview { display: block; }
  .sl-preview h4 { margin: 8px 0; }
  .sl-preview p, .sl-preview dd { color: #a79b8a; }
  .sl-preview dl { display: grid; gap: 6px; margin: 8px 0; }
  .sl-preview dt { color: #d4b66f; font-size: 12px; }
  .sl-preview__status, .sl-preview__tags, .sl-preview__topline { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .sl-card__header, .sl-card__footer, .sl-card__actions, .sl-card__badges, .sl-card__meta { display: flex; align-items: center; gap: 8px; }
  .sl-card__header, .sl-card__footer { justify-content: space-between; }
  .sl-card__file-icon { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 13px; background: rgba(212,182,111,.14); color: #f2d48b; }
  .sl-bookmark, .sl-icon-action { width: 38px; height: 38px; border-radius: 12px; border: 1px solid rgba(255,255,255,.08); background: rgba(0,0,0,.16); color: #d4b66f; display: inline-flex; align-items:center; justify-content:center; cursor:pointer; }
  .sl-card h3 { margin: 8px 0; font-size: 18px; }
  .sl-card p { color: #a79b8a; line-height: 1.6; min-height: 50px; }
  .sl-badge, .sl-tag, .sl-more-tags { border-radius: 999px; padding: 5px 9px; background: rgba(255,255,255,.07); color: #d8caa8; font-size: 12px; border: 0; }
  .sl-tag { cursor: pointer; }
  .sl-card__meta { color: #8f8474; flex-wrap: wrap; font-size: 12px; }
  .sl-vector { display: inline-flex; align-items: center; gap: 6px; color: #d7c494; font-size: 12px; }
  .sl-vector.is-ready { color: #8fe09e; }
  .sl-toast { margin-top: 16px; color: #f2d48b; background: rgba(212,182,111,.1); border: 1px solid rgba(212,182,111,.18); border-radius: 14px; padding: 12px 14px; }
  .sl-empty, .sl-error { padding: 32px; color: #a79b8a; text-align: center; }
  @media (max-width: 900px) { .sl-body { grid-template-columns: 1fr; } .sl-filters { position: static; } }
`;

function toggleInList(list, value) { return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]; }

export default function SystemLibraryPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filters, setFilters] = useState(emptyFilters);
  const [selectedTags, setSelectedTags] = useState([]);
  const [bookmarksOnly, setBookmarksOnly] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => { const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 400); return () => window.clearTimeout(timer); }, [query]);

  const fetchDocuments = useCallback(async () => {
    if (!token) return;
    setLoading(true); setError('');
    try {
      const result = await api.searchSystemLibrary({ query: debouncedQuery, filters: { ...filters, tags: selectedTags, bookmarked: bookmarksOnly } }, token);
      setDocuments(result?.documents || []); setTotal(result?.total || 0);
    } catch (err) {
      setDocuments([]); setTotal(0); setError(err.message || 'Không thể tải Thư viện Hệ thống.');
    } finally { setLoading(false); }
  }, [token, debouncedQuery, filters, selectedTags, bookmarksOnly]);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  const stats = useMemo(() => ({ ready: documents.filter((doc) => doc.is_vector_ready).length, saved: documents.filter((doc) => doc.bookmarked_by_current_user).length }), [documents]);
  const patchDocumentBookmark = (documentId, bookmarked) => setDocuments((current) => current.map((doc) => doc.id === documentId ? { ...doc, bookmarked_by_current_user: bookmarked } : doc));

  const handleToggleBookmark = async (document) => {
    const nextValue = !document.bookmarked_by_current_user;
    patchDocumentBookmark(document.id, nextValue);
    try { if (nextValue) await api.bookmarkSystemDocument(document.id, token); else await api.unbookmarkSystemDocument(document.id, token); }
    catch (err) { patchDocumentBookmark(document.id, !nextValue); setNotice(err.message || 'Không thể cập nhật danh sách đã ghim.'); }
  };

  const handleUseInResearch = async (document) => {
    if (!document.is_vector_ready) { setNotice('Tài liệu chưa vector ready nên chưa thể đưa vào Không gian Nghiên cứu.'); return; }
    setNotice('Đang tạo Không gian Nghiên cứu và thêm tài liệu hệ thống...');
    try {
      const notebook = await api.createNotebook(`Nghiên cứu: ${document.title || document.filename}`, token);
      const notebookId = notebook?.notebook_id || notebook?.notebook?.notebook_id;
      await api.linkSystemDocumentToNotebook(notebookId, document.id, token);
      navigate(`/research/${notebookId}`);
    } catch (err) { setNotice(err.message || 'Không thể đưa tài liệu vào Không gian Nghiên cứu.'); }
  };

  return (
    <div className="sl-page">
      <style>{STYLES}</style>
      <section className="sl-hero">
        <span className="sl-hero__eyebrow"><Sparkles size={14} /> Smart cataloging · Semantic RAG</span>
        <h1>Thư viện Hệ thống cho nghiên cứu chuyên nghiệp</h1>
        <p>Xem, tìm kiếm, lọc, tải xuống và đưa tài liệu hệ thống vào Không gian Nghiên cứu để nghiên cứu và chat tại workspace nghiên cứu.</p>
        <div className="sl-hero__stats"><span className="sl-stat"><strong>{total}</strong>tài liệu</span><span className="sl-stat"><strong>{stats.ready}</strong>vector ready</span><span className="sl-stat"><strong>{stats.saved}</strong>đã ghim trong kết quả</span></div>
        <SystemLibrarySearchBar value={query} onChange={setQuery} onSubmit={(event) => { event.preventDefault(); setDebouncedQuery(query.trim()); }} loading={loading} />
        {notice && <div className="sl-toast">{notice}</div>}
      </section>
      <div className="sl-body">
        <SystemLibraryFilters filters={filters} selectedTags={selectedTags} onToggleFilter={(group, value) => setFilters((current) => ({ ...current, [group]: toggleInList(current[group] || [], value) }))} onToggleTag={(tag) => setSelectedTags((current) => toggleInList(current, tag))} onClear={() => { setFilters(emptyFilters); setSelectedTags([]); setBookmarksOnly(false); }} />
        <section className="sl-content">
          <SystemLibraryToolbar total={total} bookmarksOnly={bookmarksOnly} onToggleBookmarksOnly={() => setBookmarksOnly((value) => !value)} />
          {error ? <div className="sl-error"><AlertCircle size={30} /><p>{error}</p></div> : !loading && documents.length === 0 ? <div className="sl-empty"><Library size={34} /><p>Chưa có tài liệu hệ thống phù hợp.</p></div> : <div className="sl-grid">{documents.map((document) => <SystemDocumentCard key={document.id} document={document} onToggleBookmark={handleToggleBookmark} onToggleTag={(tag) => setSelectedTags((current) => toggleInList(current, tag))} onUseInResearch={handleUseInResearch} />)}</div>}
        </section>
      </div>
    </div>
  );
}
