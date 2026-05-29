import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Library, Sparkles } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import SystemLibrarySearchBar from '../components/system-library/SystemLibrarySearchBar';
import SystemLibraryFilters from '../components/system-library/SystemLibraryFilters';
import SystemLibraryToolbar from '../components/system-library/SystemLibraryToolbar';
import SystemDocumentCard from '../components/system-library/SystemDocumentCard';

const emptyFilters = {
  categories: [],
  file_types: [],
  updated_ranges: [],
  access_levels: [],
  vector_status: [],
};

const STYLES = `
  .sl-page {
    min-height: 100vh;
    padding: 30px clamp(18px, 3vw, 42px) 54px;
    background:
      radial-gradient(ellipse at 40% 0%, rgba(196,164,100,0.11), transparent 42%),
      linear-gradient(180deg, #0f0d0a 0%, #12100c 100%);
    font-family: 'DM Sans', system-ui, sans-serif;
  }
  .sl-hero {
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 28px;
    padding: clamp(24px, 4vw, 38px);
    background:
      radial-gradient(circle at 80% 20%, rgba(112,88,42,0.3), transparent 28%),
      linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
    box-shadow: 0 30px 90px rgba(0,0,0,0.32);
  }
  .sl-hero__eyebrow { display: inline-flex; align-items: center; gap: 8px; color: #d8bd77; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
  .sl-hero h1 { margin: 12px 0 10px; color: #f3ebdc; font-family: 'Lora', Georgia, serif; font-size: clamp(30px, 5vw, 54px); line-height: 1.04; max-width: 920px; }
  .sl-hero p { max-width: 760px; color: #9f9587; line-height: 1.7; font-size: 15px; }
  .sl-hero__stats { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 22px; }
  .sl-stat { padding: 11px 14px; border-radius: 16px; background: rgba(0,0,0,0.18); border: 1px solid rgba(255,255,255,0.07); color: #bfb4a3; font-size: 12px; }
  .sl-stat strong { color: #f0d089; font-size: 18px; margin-right: 6px; }
  .sl-search {
    margin-top: 24px;
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 12px;
    padding: 10px;
    border-radius: 20px;
    background: rgba(8,7,5,0.74);
    border: 1px solid rgba(255,255,255,0.09);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
  }
  .sl-search__icon { margin-left: 8px; color: #c4a464; }
  .sl-search input { min-width: 0; border: 0; outline: none; background: transparent; color: #eee6d8; font-size: 15px; }
  .sl-search input::placeholder { color: #6f6657; }
  .sl-search__button, .sl-toolbar-btn, .sl-chat-action {
    border: 0;
    border-radius: 14px;
    padding: 11px 16px;
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    background: linear-gradient(135deg, #d4b66f, #8a6a30);
    color: #18130d;
    font-weight: 800;
    cursor: pointer;
  }
  .sl-search__button:disabled, .sl-toolbar-btn:disabled, .sl-chat-action:disabled { opacity: .42; cursor: not-allowed; }
  .sl-spin { animation: slSpin .8s linear infinite; }
  @keyframes slSpin { to { transform: rotate(360deg); } }
  .sl-body { display: grid; grid-template-columns: minmax(220px, 276px) 1fr; gap: 20px; margin-top: 22px; align-items: start; }
  .sl-filters, .sl-toolbar, .sl-card, .sl-empty, .sl-error {
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.035);
    border-radius: 22px;
    box-shadow: 0 18px 60px rgba(0,0,0,0.24);
  }
  .sl-filters { position: sticky; top: 18px; padding: 18px; }
  .sl-filters__header { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
  .sl-filters__header p { color: #6b6253; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; margin: 0 0 3px; }
  .sl-filters__header strong { color: #eee6d8; font-family: 'Lora', Georgia, serif; }
  .sl-link-button { background: none; border: 0; color: #c4a464; cursor: pointer; font-weight: 700; }
  .sl-filter-group { padding: 14px 0; border-top: 1px solid rgba(255,255,255,0.06); }
  .sl-filter-group h3 { margin: 0 0 10px; color: #b8ad9c; font-size: 12px; text-transform: uppercase; letter-spacing: .07em; }
  .sl-filter-options, .sl-active-tags { display: flex; flex-wrap: wrap; gap: 8px; }
  .sl-filter-chip { cursor: pointer; }
  .sl-filter-chip input { display: none; }
  .sl-filter-chip span, .sl-tag {
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.035);
    color: #9c9282;
    border-radius: 999px;
    padding: 7px 10px;
    font-size: 12px;
  }
  .sl-filter-chip.is-active span, .sl-tag.is-selected { border-color: rgba(196,164,100,0.35); color: #f0d089; background: rgba(196,164,100,0.1); }
  .sl-tag { display: inline-flex; align-items: center; gap: 4px; cursor: pointer; }
  .sl-content { min-width: 0; }
  .sl-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 14px 16px; margin-bottom: 16px; }
  .sl-toolbar strong { color: #f0d089; }
  .sl-toolbar span { color: #8f8576; }
  .sl-toolbar__actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
  .sl-toolbar-btn { background: rgba(255,255,255,0.045); border: 1px solid rgba(255,255,255,0.08); color: #c8bdab; padding: 9px 12px; }
  .sl-toolbar-btn.is-active { color: #f0d089; border-color: rgba(196,164,100,0.35); background: rgba(196,164,100,0.1); }
  .sl-toolbar-btn--primary { background: linear-gradient(135deg, #d4b66f, #8a6a30); color: #18130d; border: 0; }
  .sl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 16px; }
  .sl-card { position: relative; padding: 16px; display: flex; flex-direction: column; min-height: 346px; transition: transform .18s, border-color .18s, background .18s; }
  .sl-card:hover { transform: translateY(-3px); border-color: rgba(196,164,100,0.28); background: rgba(196,164,100,0.045); z-index: 2; }
  .sl-card.is-selected { border-color: rgba(114,191,130,.45); box-shadow: 0 0 0 1px rgba(114,191,130,.18), 0 18px 60px rgba(0,0,0,0.24); }
  .sl-card__header { display: flex; align-items: center; gap: 10px; }
  .sl-select-box input { display: none; }
  .sl-select-box span { display: block; width: 20px; height: 20px; border-radius: 7px; border: 1px solid rgba(255,255,255,.16); background: rgba(0,0,0,.18); }
  .sl-select-box input:checked + span { background: #72bf82; border-color: #72bf82; box-shadow: inset 0 0 0 5px #14100c; }
  .sl-card__file-icon { width: 42px; height: 42px; border-radius: 14px; display: grid; place-items: center; background: rgba(196,164,100,.11); color: #e0c376; border: 1px solid rgba(196,164,100,.18); }
  .sl-bookmark, .sl-icon-action { margin-left: auto; width: 38px; height: 38px; display: inline-flex; align-items: center; justify-content: center; border-radius: 12px; background: rgba(255,255,255,.035); border: 1px solid rgba(255,255,255,.08); color: #8f8576; cursor: pointer; }
  .sl-bookmark.is-bookmarked { color: #f0d089; background: rgba(196,164,100,.11); border-color: rgba(196,164,100,.25); }
  .sl-card__body { padding-top: 14px; flex: 1; }
  .sl-card__badges { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
  .sl-badge { display: inline-flex; align-items: center; gap: 4px; padding: 5px 8px; border-radius: 999px; font-size: 11px; font-weight: 800; background: rgba(255,255,255,.05); color: #b8ad9c; border: 1px solid rgba(255,255,255,.07); }
  .sl-badge--new { background: rgba(114,191,130,.13); border-color: rgba(114,191,130,.24); color: #96e2a6; }
  .sl-badge--free { color: #96e2a6; border-color: rgba(114,191,130,.23); background: rgba(114,191,130,.1); }
  .sl-badge--pro { color: #d7c078; border-color: rgba(215,192,120,.25); background: rgba(215,192,120,.1); }
  .sl-badge--vip { color: #d9a8ff; border-color: rgba(217,168,255,.28); background: rgba(217,168,255,.1); }
  .sl-card h3 { color: #efe6d8; font-family: 'Lora', Georgia, serif; font-size: 18px; line-height: 1.28; margin: 0 0 9px; }
  .sl-card p { color: #908777; font-size: 13px; line-height: 1.55; margin: 0; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .sl-card__meta { display: flex; gap: 7px; flex-wrap: wrap; color: #716858; font-size: 12px; margin: 12px 0; }
  .sl-card__tags { display: flex; flex-wrap: wrap; gap: 7px; }
  .sl-more-tags { color: #7f7667; font-size: 12px; padding: 7px 2px; }
  .sl-card__footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding-top: 14px; margin-top: 14px; border-top: 1px solid rgba(255,255,255,.06); }
  .sl-vector { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; }
  .sl-vector.is-ready { color: #8fd89e; }
  .sl-vector.is-processing { color: #d4b66f; }
  .sl-card__actions { display: flex; gap: 8px; }
  .sl-icon-action { margin-left: 0; width: 38px; height: 38px; }
  .sl-chat-action { min-height: 38px; padding: 9px 12px; }
  .sl-preview { position: absolute; left: 16px; right: 16px; top: 70px; z-index: 8; opacity: 0; pointer-events: none; transform: translateY(8px); transition: opacity .16s, transform .16s; padding: 16px; border-radius: 18px; background: rgba(22,19,14,.98); border: 1px solid rgba(196,164,100,.22); box-shadow: 0 24px 90px rgba(0,0,0,.55); }
  .sl-card:hover .sl-preview { opacity: 1; transform: translateY(0); }
  .sl-preview__topline, .sl-preview__status { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: #8f8576; font-size: 11px; }
  .sl-preview h4 { margin: 9px 0 7px; color: #f1e7d4; font-size: 14px; }
  .sl-preview p { -webkit-line-clamp: 4; color: #b3a895; }
  .sl-preview dl { display: grid; gap: 7px; margin: 12px 0; }
  .sl-preview dl div { display: flex; justify-content: space-between; gap: 12px; }
  .sl-preview dt { color: #766c5d; font-size: 11px; }
  .sl-preview dd { margin: 0; color: #c7bcaa; font-size: 11px; text-align: right; }
  .sl-preview__status { justify-content: flex-start; color: #8fd89e; }
  .sl-preview__tags { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 10px; }
  .sl-preview__tags span { color: #d4b66f; font-size: 11px; }
  .sl-empty, .sl-error { padding: 36px; text-align: center; color: #8f8576; }
  .sl-empty svg, .sl-error svg { color: #c4a464; margin-bottom: 10px; }
  .sl-error svg { color: #e07878; }
  .sl-toast { margin-top: 14px; padding: 12px 14px; border-radius: 16px; border: 1px solid rgba(196,164,100,.18); background: rgba(196,164,100,.08); color: #d8c18a; }
  @media (max-width: 1100px) { .sl-body { grid-template-columns: 1fr; } .sl-filters { position: static; } }
  @media (max-width: 680px) {
    .sl-page { padding-top: 72px; }
    .sl-search { grid-template-columns: auto 1fr; }
    .sl-search__button { grid-column: 1 / -1; width: 100%; }
    .sl-toolbar { align-items: stretch; flex-direction: column; }
    .sl-toolbar__actions { justify-content: stretch; }
    .sl-toolbar-btn { flex: 1 1 auto; }
    .sl-grid { grid-template-columns: 1fr; }
  }
`;

function toggleInList(list, value) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function canUseDocument(document, userPlan = 'free') {
  const required = String(document.access_level || 'free').toLowerCase();
  if (required === 'free') return true;
  if (required === 'pro') return ['pro', 'vip'].includes(userPlan);
  if (required === 'vip') return userPlan === 'vip';
  return false;
}

export default function SystemLibraryPage({ bookmarksDefault = false }) {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filters, setFilters] = useState(emptyFilters);
  const [selectedTags, setSelectedTags] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedDocumentIds, setSelectedDocumentIds] = useState([]);
  const [bookmarksOnly, setBookmarksOnly] = useState(bookmarksDefault);
  const [notice, setNotice] = useState('');
  const userPlan = user?.plan || 'free';

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 400);
    return () => window.clearTimeout(timer);
  }, [query]);

  const fetchDocuments = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const result = await api.searchSystemLibrary({
        query: debouncedQuery,
        filters: { ...filters, tags: selectedTags, bookmarked: bookmarksOnly },
      }, token);
      setDocuments(result?.documents || []);
      setTotal(result?.total || 0);
    } catch (err) {
      setDocuments([]);
      setTotal(0);
      setError(err.message || 'Không thể tải Thư viện Hệ thống.');
    } finally {
      setLoading(false);
    }
  }, [token, debouncedQuery, filters, selectedTags, bookmarksOnly]);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  const stats = useMemo(() => ({
    ready: documents.filter((doc) => doc.is_vector_ready).length,
    free: documents.filter((doc) => String(doc.access_level || 'free').toLowerCase() === 'free').length,
    saved: documents.filter((doc) => doc.bookmarked_by_current_user).length,
  }), [documents]);

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    setDebouncedQuery(query.trim());
  };

  const handleToggleFilter = (group, value) => {
    setFilters((current) => ({ ...current, [group]: toggleInList(current[group] || [], value) }));
  };

  const handleToggleTag = (tag) => {
    setSelectedTags((current) => toggleInList(current, tag));
  };

  const handleClearFilters = () => {
    setFilters(emptyFilters);
    setSelectedTags([]);
    setBookmarksOnly(false);
  };

  const handleToggleSelect = (documentId) => {
    setSelectedDocumentIds((current) => toggleInList(current, documentId).slice(0, 4));
  };

  const patchDocumentBookmark = (documentId, bookmarked) => {
    setDocuments((current) => current.map((doc) => doc.id === documentId ? { ...doc, bookmarked_by_current_user: bookmarked } : doc));
  };

  const handleToggleBookmark = async (document) => {
    const nextValue = !document.bookmarked_by_current_user;
    patchDocumentBookmark(document.id, nextValue);
    try {
      if (nextValue) await api.bookmarkSystemDocument(document.id, token);
      else await api.unbookmarkSystemDocument(document.id, token);
    } catch (err) {
      patchDocumentBookmark(document.id, !nextValue);
      setNotice(err.message || 'Không thể cập nhật Tủ sách của tôi.');
    }
  };

  const createChatSession = async (documentIds, mode = 'collection') => {
    const selectedDocs = documents.filter((doc) => documentIds.includes(doc.id));
    const blocked = selectedDocs.find((doc) => !doc.is_vector_ready || !canUseDocument(doc, userPlan));
    if (blocked) {
      setNotice(!blocked.is_vector_ready ? 'Tài liệu chưa vector ready nên chưa thể chat.' : 'Tài liệu này yêu cầu gói Pro/VIP.');
      return;
    }
    try {
      const result = await api.createSystemLibraryChatSession({ document_ids: documentIds, mode }, token);
      const session = result?.session;
      setNotice('Đã tạo phiên RAG từ Thư viện Hệ thống. Mở Không gian Nghiên cứu để tiếp tục chat.');
      if (session?.id && session?.notebook_id) navigate(`/research/${session.notebook_id}?session=${session.id}&source=system_library`);
    } catch (err) {
      setNotice(err.message || 'Không thể tạo phiên chat từ Thư viện Hệ thống.');
    }
  };

  const handleCompare = (document) => {
    const next = selectedDocumentIds.includes(document.id) ? selectedDocumentIds : [...selectedDocumentIds, document.id].slice(0, 4);
    setSelectedDocumentIds(next);
    setNotice(next.length < 2 ? 'Hãy chọn thêm ít nhất 1 tài liệu để so sánh.' : 'Đã sẵn sàng so sánh các tài liệu đã chọn.');
  };

  const handleCompareSelected = () => createChatSession(selectedDocumentIds, 'compare');
  const handleCreateCollection = () => createChatSession(selectedDocumentIds, 'collection');

  return (
    <div className="sl-page">
      <style>{STYLES}</style>
      <section className="sl-hero">
        <span className="sl-hero__eyebrow"><Sparkles size={14} /> Smart cataloging · Semantic RAG</span>
        <h1>Thư viện Hệ thống cho nghiên cứu chuyên nghiệp</h1>
        <p>Khám phá kho tài liệu do admin/dev chuẩn bị sẵn, lọc theo metadata, xem quick preview, ghim vào tủ sách cá nhân và tạo phiên chat RAG từ một tài liệu hoặc cả collection.</p>
        <div className="sl-hero__stats">
          <span className="sl-stat"><strong>{total}</strong>tài liệu</span>
          <span className="sl-stat"><strong>{stats.ready}</strong>vector ready</span>
          <span className="sl-stat"><strong>{stats.free}</strong>free</span>
          <span className="sl-stat"><strong>{stats.saved}</strong>đã ghim trong kết quả</span>
        </div>
        <SystemLibrarySearchBar value={query} onChange={setQuery} onSubmit={handleSearchSubmit} loading={loading} />
        {notice && <div className="sl-toast">{notice}</div>}
      </section>

      <div className="sl-body">
        <SystemLibraryFilters
          filters={filters}
          selectedTags={selectedTags}
          onToggleFilter={handleToggleFilter}
          onToggleTag={handleToggleTag}
          onClear={handleClearFilters}
        />
        <section className="sl-content">
          <SystemLibraryToolbar
            total={total}
            selectedCount={selectedDocumentIds.length}
            bookmarksOnly={bookmarksOnly}
            onToggleBookmarksOnly={() => setBookmarksOnly((value) => !value)}
            onCreateCollection={handleCreateCollection}
            onCompareSelected={handleCompareSelected}
          />
          {error ? (
            <div className="sl-error"><AlertCircle size={30} /><p>{error}</p></div>
          ) : !loading && documents.length === 0 ? (
            <div className="sl-empty"><Library size={34} /><p>Chưa có tài liệu hệ thống phù hợp. Khi admin/dev upload và index tài liệu, kết quả sẽ hiển thị tại đây.</p></div>
          ) : (
            <div className="sl-grid">
              {documents.map((document) => (
                <SystemDocumentCard
                  key={document.id}
                  document={document}
                  selected={selectedDocumentIds.includes(document.id)}
                  canChat={canUseDocument(document, userPlan)}
                  onToggleSelect={handleToggleSelect}
                  onToggleBookmark={handleToggleBookmark}
                  onToggleTag={handleToggleTag}
                  onChat={createChatSession}
                  onCompare={handleCompare}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
