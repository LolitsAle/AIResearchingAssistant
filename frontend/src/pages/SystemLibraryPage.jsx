import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Library, Search, Sparkles, Upload } from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import SystemLibrarySearchBar from "../components/system-library/SystemLibrarySearchBar";
import SystemLibraryFilters from "../components/system-library/SystemLibraryFilters";
import SystemLibraryToolbar from "../components/system-library/SystemLibraryToolbar";
import SystemDocumentCard from "../components/system-library/SystemDocumentCard";
import SystemDocumentDetailModal from "../components/system-library/SystemDocumentDetailModal";
import OpenAlexPaperCard from "../components/system-library/OpenAlexPaperCard";
import OpenAlexPaperDetailModal from "../components/system-library/OpenAlexPaperDetailModal";

const emptyFilters = {
  peer_review_status: [],
  access_types: [],
  review_types: [],
  source_types: [],
  has_pdf: false,
  has_data: false,
  has_code: false,
  citation_count_enabled: false,
  citation_count_min: "",
  sort: "newest",
};

const STYLES = `
  .sl-page { min-height: 100vh; padding: 24px clamp(14px, 3vw, 42px) 54px; background: radial-gradient(ellipse at 40% 0%, rgba(196,164,100,0.11), transparent 42%), linear-gradient(180deg, #0f0d0a 0%, #12100c 100%); font-family: 'Lora', Georgia, serif; }
  .sl-hero, .sl-upload-panel, .sl-paper-panel { border: 1px solid rgba(255,255,255,0.08); border-radius: 28px; padding: clamp(20px, 4vw, 38px); background: radial-gradient(circle at 80% 20%, rgba(112,88,42,0.3), transparent 28%), linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02)); box-shadow: 0 30px 90px rgba(0,0,0,0.32); }
  .sl-page button, .sl-page input, .sl-page select { font-family: inherit; display: flex; justify-content: center; align-items: center;}
  .sl-hero__eyebrow { display: inline-flex; align-items: center; gap: 8px; color: #d8bd77; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
  .sl-hero h1 { margin: 12px 0 10px; color: #f3ebdc; font-size: clamp(28px, 5vw, 50px); line-height: 1.04; }
  .sl-hero p, .sl-upload-panel p, .sl-paper-panel p { max-width: 860px; color: #9f9587; line-height: 1.7; font-size: 15px; }
  .sl-hero__stats, .sl-tabs, .sl-upload-form, .sl-paper-search { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }
  .sl-tab, .sl-stat { padding: 11px 14px; border-radius: 16px; background: rgba(0,0,0,0.18); border: 1px solid rgba(255,255,255,0.07); color: #bfb4a3; font-size: 12px; cursor: pointer; }
  .sl-tab.is-active { color: #1a130c; background: #d4b66f; font-weight: 800; }
  .sl-stat strong { color: #f0d089; font-size: 18px; margin-right: 6px; }
  .sl-search, .sl-paper-search { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 12px; padding: 10px; border-radius: 20px; background: rgba(8,7,5,0.74); border: 1px solid rgba(255,255,255,0.09); }
  .sl-search { margin-top: 24px; }
  .sl-search__icon { margin-left: 8px; color: #c4a464; }
  .sl-search input, .sl-paper-search input, .sl-upload-form input, .sl-toolbar select, .sl-citation-filter input { min-width: 0; border: 1px solid rgba(255,255,255,0.09); outline: none; background: rgba(0,0,0,.2); color: #eee6d8; font-size: 14px; border-radius: 12px; padding: 11px 12px; }
  .sl-search input { border: 0; background: transparent; padding: 0; }
  .sl-search__button, .sl-toolbar-btn, .sl-download-btn, .sl-upload-btn { border: 0; border-radius: 14px; padding: 11px 16px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; background: linear-gradient(135deg, #d4b66f, #8a6a30); color: #18130d; font-weight: 800; cursor: pointer; text-decoration: none; }
  .sl-search__button:disabled, .sl-toolbar-btn:disabled, .sl-download-btn:disabled, .sl-upload-btn:disabled { opacity: .42; cursor: not-allowed; }
  .sl-body { display: grid; grid-template-columns: minmax(220px, 290px) 1fr; gap: 20px; margin-top: 22px; align-items: start; }
  .sl-filters, .sl-toolbar, .sl-card, .sl-empty, .sl-error { border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.035); border-radius: 22px; box-shadow: 0 18px 60px rgba(0,0,0,0.24); }
  .sl-filters { position: sticky; top: 18px; padding: 18px; color: #bfb4a3; }
  .sl-filters__header, .sl-card__header { display: flex; justify-content: space-between; gap: 10px; }
  .sl-card__footer { display: flex; justify-content: space-between; gap: 10px; margin-top: auto; }
  .sl-filters__header p { margin: 0 0 2px; color: #746b5d; font-size: 11px; text-transform: uppercase; }
  .sl-filters__header strong, .sl-filter-group h3 { color: #efe6d8; }
  .sl-filter-group { margin-top: 18px; }
  .sl-filter-group h3 { margin: 0 0 10px; font-size: 14px; }
  .sl-filter-options, .sl-active-tags, .sl-card__tags, .sl-card__badges, .sl-card__metrics, .sl-card__flags, .sl-card__actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .sl-filter-chip { border: 1px solid rgba(255,255,255,0.08); border-radius: 999px; padding: 7px 10px; cursor: pointer; color: #a79b8a; font-size: 12px; background: rgba(0,0,0,.12); }
  .sl-filter-chip input { display: none; }
  .sl-filter-chip.is-active { color: #1a130c; background: #d4b66f; }
  .sl-filter-skeleton { min-height: 42px; padding: 12px; border-radius: 14px; color: #f0d089; background: linear-gradient(90deg, rgba(255,255,255,.05), rgba(212,182,111,.15), rgba(255,255,255,.05)); animation: pulse 1.2s infinite; }
  @keyframes pulse { 50% { opacity: .55; } }
  .sl-link-button, .sl-more-link, .sl-star-btn { border: 0; background: transparent; color: #d4b66f; cursor: pointer; }
  .sl-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 15px 18px; color: #bfb4a3; margin-bottom: 16px; flex-wrap: wrap; }
  .sl-toolbar strong { color: #f2d48b; font-size: 22px; }
  .sl-toolbar__actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .sl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
  .sl-card { position: relative; padding: 16px; color: #efe6d8; min-height: 265px; display: flex; flex-direction: column; gap: 14px; transition: border-color .18s, box-shadow .18s; }
  .sl-card:hover { border-color: rgba(212,182,111,.28); box-shadow: 0 24px 75px rgba(0,0,0,.34); }
  .sl-card__file-icon { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 13px; background: rgba(212,182,111,.14); color: #f2d48b; }
  .sl-bookmark { width: 38px; height: 38px; border-radius: 12px; border: 1px solid rgba(255,255,255,.08); background: rgba(0,0,0,.16); color: #d4b66f; display: inline-flex; align-items:center; justify-content:center; cursor:pointer; }
  .sl-card h3 { margin: 8px 0; font-size: 18px; }
  .sl-card p { color: #a99e8f; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; flex-grow: 1; }
  .sl-badge, .sl-tag, .sl-more-tags { font-size: 11px; border-radius: 999px; padding: 5px 8px; background: rgba(212,182,111,.12); color: #d4b66f; border: 1px solid rgba(212,182,111,.16); }
  .sl-tag { cursor: pointer; }
  .sl-card__meta, .sl-card__metrics, .sl-card__flags { color: #8f8474; font-size: 12px; }
  .sl-card__flags span { opacity: .45; display: inline-flex; align-items: center; gap: 4px; }
  .sl-card__flags .is-on { opacity: 1; color: #f0d089; }
  .sl-modal-overlay { position: fixed; inset: 0; z-index: 40; display: grid; place-items: center; padding: 18px; background: rgba(0,0,0,.62); }
  .sl-modal { width: min(760px, 100%); max-height: min(86vh, 820px); display: flex; flex-direction: column; border: 1px solid rgba(255,255,255,.12); border-radius: 26px; background: #18140f; color: #efe6d8; box-shadow: 0 30px 110px rgba(0,0,0,.55); position: relative; }
  .sl-modal__close { position: absolute; top: 14px; right: 14px; border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.06); color: #efe6d8; border-radius: 999px; width: 36px; height: 36px; cursor: pointer; }
  .sl-modal__header { display: flex; gap: 14px; padding: 24px 26px 12px; }
  .sl-modal__header p { margin: 0 0 4px; color: #d4b66f; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; }
  .sl-modal__header h2 { margin: 0; font-size: clamp(22px, 4vw, 34px); }
  .sl-modal__icon { flex: 0 0 46px; width: 46px; height: 46px; display: grid; place-items: center; border-radius: 16px; background: rgba(212,182,111,.14); color: #f0d089; }
  .sl-modal__content { overflow: auto; padding: 8px 26px 18px; display: grid; gap: 16px; }
  .sl-modal__section { border: 1px solid rgba(255,255,255,.08); border-radius: 18px; padding: 16px; background: rgba(255,255,255,.035); }
  .sl-modal__section h3 { margin: 0 0 10px; font-size: 15px; color: #f0d089; }
  .sl-modal__section p { margin: 0; color: #c6baaa; line-height: 1.7; white-space: pre-wrap; }
  .sl-modal__grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 10px; }
  .sl-modal__row { display: grid; gap: 4px; padding: 10px; border-radius: 12px; background: rgba(0,0,0,.18); }
  .sl-modal__row span, .sl-modal__muted { color: #8f8474; font-size: 12px; }
  .sl-modal__row strong { color: #efe6d8; font-size: 13px; overflow-wrap: anywhere; }
  .sl-rating { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; color: #efe6d8; }
  .sl-rating__stars { display: inline-flex; gap: 4px; color: #d4b66f; }
  .sl-rating__stars .is-dim { color: rgba(255,255,255,.22); }
  .sl-modal__footer { padding: 16px 26px 24px; display: flex; justify-content: flex-end; border-top: 1px solid rgba(255,255,255,.08); }
  .sl-toast { margin-top: 16px; color: #f2d48b; background: rgba(212,182,111,.1); border: 1px solid rgba(212,182,111,.18); border-radius: 14px; padding: 12px 14px; }
  .sl-empty, .sl-error { padding: 32px; color: #a79b8a; text-align: center; }
  .sl-paper-list { display: grid; gap: 12px; margin-top: 18px; }
  .sl-paper-item { border: 1px solid rgba(255,255,255,.08); border-radius: 18px; padding: 14px; background: rgba(0,0,0,.18); color: #efe6d8; }
  .sl-paper-item p { margin: 6px 0; }
  @media (max-width: 900px) { .sl-body { grid-template-columns: 1fr; } .sl-filters { position: static; } }
  @media (max-width: 640px) { .sl-search, .sl-paper-search { grid-template-columns: auto 1fr; } .sl-search__button, .sl-paper-search button { grid-column: 1 / -1; width: 100%; } .sl-modal__grid { grid-template-columns: 1fr; } .sl-card__footer { align-items: stretch; flex-direction: column; } .sl-upload-form { flex-direction: column; } }
`;

function toggleInList(list, value) {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}
const canPublish = (user) =>
  user?.role === "admin" ||
  (user?.canPublishDocuments ??
    user?.can_publish_documents ??
    user?.canUploadLibraryDocuments ??
    user?.can_upload_library_documents ??
    true) !== false;

export default function SystemLibraryPage() {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = useState("community");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filters, setFilters] = useState(emptyFilters);
  const [selectedTags, setSelectedTags] = useState([]);
  const [suggestedTags, setSuggestedTags] = useState([]);
  const [bookmarksOnly, setBookmarksOnly] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadTags, setUploadTags] = useState("");
  const [uploadCitationThreshold, setUploadCitationThreshold] = useState("");
  const [paperQuery, setPaperQuery] = useState("");
  const [paperResults, setPaperResults] = useState([]);
  const [paperLoading, setPaperLoading] = useState(false);
  const [selectedPaper, setSelectedPaper] = useState(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 400);
    return () => window.clearTimeout(timer);
  }, [query]);

  const fetchDocuments = useCallback(async () => {
    if (!token || activeTab === "internet") return;
    setLoading(true);
    setError("");
    try {
      const citationMin = Number(filters.citation_count_min);
      const searchFilters = {
        ...filters,
        tags: selectedTags,
        bookmarked: bookmarksOnly,
        my_documents: activeTab === "my",
      };
      if (filters.citation_count_enabled)
        searchFilters.citation_count_min = Number.isFinite(citationMin)
          ? citationMin
          : 0;
      else delete searchFilters.citation_count_min;
      delete searchFilters.citation_count_enabled;
      const result = await api.searchSystemLibrary(
        { query: debouncedQuery, filters: searchFilters },
        token,
      );
      setDocuments(result?.documents || []);
      setTotal(result?.total || 0);
    } catch (err) {
      setDocuments([]);
      setTotal(0);
      setError(err.message || "Không thể tải Thư viện tài liệu.");
    } finally {
      setLoading(false);
    }
  }, [token, activeTab, debouncedQuery, filters, selectedTags, bookmarksOnly]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);
  useEffect(() => {
    if (token)
      api
        .getSystemLibraryTags(token)
        .then((data) => setSuggestedTags(data?.tags || []))
        .catch(() => setSuggestedTags([]));
  }, [token, documents.length]);

  const stats = useMemo(
    () => ({
      saved: documents.filter((doc) => doc.bookmarked_by_current_user).length,
    }),
    [documents],
  );
  const patchDocument = (documentId, patch) =>
    setDocuments((current) =>
      current.map((doc) =>
        doc.id === documentId ? { ...doc, ...patch } : doc,
      ),
    );

  const handleToggleBookmark = async (document) => {
    const nextValue = !document.bookmarked_by_current_user;
    patchDocument(document.id, { bookmarked_by_current_user: nextValue });
    try {
      if (nextValue) await api.bookmarkSystemDocument(document.id, token);
      else await api.unbookmarkSystemDocument(document.id, token);
    } catch (err) {
      patchDocument(document.id, { bookmarked_by_current_user: !nextValue });
      setNotice(err.message || "Không thể cập nhật danh sách đã ghim.");
    }
  };

  const handleVote = async (document, rating) => {
    try {
      const result = await api.voteSystemDocument(document.id, rating, token);
      patchDocument(document.id, {
        vote_avg: result.vote_avg,
        vote_count: result.vote_count,
      });
      setNotice(`Đã vote ${rating} sao.`);
    } catch (err) {
      setNotice(err.message || "Không thể vote tài liệu.");
    }
  };

  const handleDownload = async (document) => {
    if (!document?.id || downloadingId) return;
    setDownloadingId(document.id);
    setNotice("Đang tải tài liệu...");
    try {
      await api.downloadSystemDocument(
        document.id,
        token,
        document.filename || document.title || "library-document",
      );
      setNotice("Đã bắt đầu tải tài liệu.");
      patchDocument(document.id, {
        download_count: (Number(document.download_count) || 0) + 1,
      });
    } catch (err) {
      setNotice(err.message || "Không thể tải tài liệu.");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!canPublish(user)) {
      setNotice(
        "Tài khoản của bạn đã bị tạm khóa quyền đăng tài liệu. Vui lòng liên hệ quản trị viên.",
      );
      return;
    }
    if (!uploadFile) {
      setNotice("Vui lòng chọn file để upload.");
      return;
    }
    setLoading(true);
    setNotice("Đang upload và xử lý tài liệu...");
    try {
      const result = await api.uploadCommunityLibraryDocument(
        {
          file: uploadFile,
          title: uploadTitle,
          tags: uploadTags,
          citationThreshold: uploadCitationThreshold,
        },
        token,
      );
      setUploadFile(null);
      setUploadTitle("");
      setUploadTags("");
      setUploadCitationThreshold("");
      setNotice(
        result?.document?.status === "PENDING_REVIEW"
          ? "Đã upload tài liệu và đang chờ admin duyệt trước khi public."
          : "Đã upload tài liệu vào Thư viện cộng đồng.",
      );
      setActiveTab("my");
      await fetchDocuments();
    } catch (err) {
      setNotice(err.message || "Không thể upload tài liệu.");
    } finally {
      setLoading(false);
    }
  };

  const handlePaperSearch = async (event) => {
    event.preventDefault();
    if (!paperQuery.trim()) return;
    setPaperLoading(true);
    setPaperResults([]);
    setNotice("Đang tìm paper qua OpenAlex...");
    try {
      const result = await api.searchInternetPapers(
        { query: paperQuery.trim(), provider: "openalex", limit: 20 },
        token,
      );
      setPaperResults(result?.papers || []);
      setNotice("Đã normalize kết quả internet search.");
    } catch (err) {
      setNotice(err.message || "Không thể tìm paper internet.");
    } finally {
      setPaperLoading(false);
    }
  };

  const handleImportPaper = async (paper) => {
    if (!canPublish(user)) {
      setNotice(
        "Tài khoản của bạn đã bị tạm khóa quyền đăng tài liệu. Vui lòng liên hệ quản trị viên.",
      );
      return;
    }
    try {
      await api.importInternetPaperToLibrary(paper, token);
      setNotice("Đã import paper vào thư viện.");
      setActiveTab("community");
      await fetchDocuments();
    } catch (err) {
      setNotice(err.message || "Không thể import paper vào thư viện.");
    }
  };

  return (
    <div className="sl-page">
      <style>{STYLES}</style>
      <section className="sl-hero">
        <span className="sl-hero__eyebrow">
          <Sparkles size={14} /> Community library · Internet paper search
        </span>
        <h1>Thư viện tài liệu cộng đồng cho nghiên cứu chuyên nghiệp</h1>
        <p>
          Upload, xem, lọc, vote và download tài liệu public hợp lệ. Tab Paper
          internet search dùng abstraction PaperProvider và OpenAlex, không
          scrape Google Scholar trực tiếp.
        </p>
        <div className="sl-tabs">
          <button
            className={`sl-tab ${activeTab === "community" ? "is-active" : ""}`}
            onClick={() => setActiveTab("community")}
          >
            Thư viện cộng đồng
          </button>
          <button
            className={`sl-tab ${activeTab === "my" ? "is-active" : ""}`}
            onClick={() => setActiveTab("my")}
          >
            Tài liệu của tôi
          </button>
          <button
            className={`sl-tab ${activeTab === "internet" ? "is-active" : ""}`}
            onClick={() => setActiveTab("internet")}
          >
            Paper internet search
          </button>
        </div>
        <div className="sl-hero__stats">
          <span className="sl-stat">
            <strong>{total}</strong>tài liệu
          </span>
          <span className="sl-stat">
            <strong>{stats.saved}</strong>đã ghim trong kết quả
          </span>
        </div>
        {activeTab !== "internet" && (
          <SystemLibrarySearchBar
            value={query}
            onChange={setQuery}
            onSubmit={(event) => {
              event.preventDefault();
              setDebouncedQuery(query.trim());
            }}
            loading={loading}
          />
        )}
        {notice && <div className="sl-toast">{notice}</div>}
      </section>

      {activeTab === "internet" ? (
        <section className="sl-paper-panel" style={{ marginTop: 22 }}>
          <h2>Paper internet search</h2>
          <p>
            Kết quả được normalize về source, externalId, title, abstract,
            authors, year, DOI, URL/PDF URL, citations, Open Access, peer-review
            và asset flags.
          </p>
          <form className="sl-paper-search" onSubmit={handlePaperSearch}>
            <Search className="sl-search__icon" size={18} />
            <input
              value={paperQuery}
              onChange={(event) => setPaperQuery(event.target.value)}
              placeholder="Tìm paper trên OpenAlex..."
            />
            <button className="sl-search__button" disabled={paperLoading}>
              {paperLoading ? "Đang tìm..." : "Search"}
            </button>
          </form>
          {paperLoading ? (
            <div className="sl-empty">Đang search paper...</div>
          ) : paperResults.length === 0 ? (
            <div className="sl-empty">
              <Library size={34} />
              <p>Nhập từ khóa để tìm paper internet.</p>
            </div>
          ) : (
            <div className="sl-grid">
              {paperResults.map((paper) => (
                <OpenAlexPaperCard
                  key={`${paper.source || "OpenAlex"}-${paper.id || paper.externalId}`}
                  paper={paper}
                  onOpenDetails={setSelectedPaper}
                  onImport={handleImportPaper}
                />
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          <section className="sl-upload-panel" style={{ marginTop: 22 }}>
            <h2>
              <Upload size={18} /> Upload tài liệu cộng đồng
            </h2>
            <p>
              {canPublish(user)
                ? "User có canPublishDocuments = true có thể gửi tài liệu; tài liệu user thường sẽ chờ duyệt nếu bật kiểm duyệt."
                : "Tài khoản của bạn đã bị tạm khóa quyền đăng tài liệu. Vui lòng liên hệ quản trị viên."}
            </p>
            <form className="sl-upload-form" onSubmit={handleUpload}>
              <input
                type="file"
                onChange={(event) =>
                  setUploadFile(event.target.files?.[0] || null)
                }
              />
              <input
                value={uploadTitle}
                onChange={(event) => setUploadTitle(event.target.value)}
                placeholder="Tiêu đề"
              />
              <input
                value={uploadTags}
                onChange={(event) => setUploadTags(event.target.value)}
                placeholder="tags, cách nhau bằng dấu phẩy"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={uploadCitationThreshold}
                onChange={(event) =>
                  setUploadCitationThreshold(event.target.value)
                }
                placeholder="Citation threshold mặc định: 0"
              />
              <button className="sl-upload-btn" disabled={loading}>
                {loading ? "Đang xử lý..." : "Upload"}
              </button>
            </form>
          </section>
          <div className="sl-body">
            <SystemLibraryFilters
              filters={filters}
              selectedTags={selectedTags}
              suggestedTags={suggestedTags}
              loading={loading}
              onToggleFilter={(group, value) =>
                setFilters((current) => ({
                  ...current,
                  [group]: toggleInList(current[group] || [], value),
                }))
              }
              onToggleTag={(tag) =>
                setSelectedTags((current) => toggleInList(current, tag))
              }
              onBooleanFilter={(key) =>
                setFilters((current) => ({ ...current, [key]: !current[key] }))
              }
              onCitationChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  citation_count_min: value,
                }))
              }
              onClear={() => {
                setFilters(emptyFilters);
                setSelectedTags([]);
                setBookmarksOnly(false);
              }}
            />
            <section className="sl-content">
              <SystemLibraryToolbar
                total={total}
                bookmarksOnly={bookmarksOnly}
                onToggleBookmarksOnly={() =>
                  setBookmarksOnly((value) => !value)
                }
                sort={filters.sort}
                onSortChange={(sort) =>
                  setFilters((current) => ({ ...current, sort }))
                }
                hasQuery={Boolean(debouncedQuery)}
              />
              {error ? (
                <div className="sl-error">
                  <AlertCircle size={30} />
                  <p>{error}</p>
                </div>
              ) : loading ? (
                <div className="sl-grid">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="sl-card sl-filter-skeleton">
                      Đang tải tài liệu...
                    </div>
                  ))}
                </div>
              ) : documents.length === 0 ? (
                <div className="sl-empty">
                  <Library size={34} />
                  <p>
                    {activeTab === "my"
                      ? "Bạn chưa có tài liệu nào phù hợp."
                      : "Chưa có tài liệu cộng đồng phù hợp."}
                  </p>
                </div>
              ) : (
                <div className="sl-grid">
                  {documents.map((document) => (
                    <SystemDocumentCard
                      key={document.id}
                      document={document}
                      onToggleBookmark={handleToggleBookmark}
                      onToggleTag={(tag) =>
                        setSelectedTags((current) => toggleInList(current, tag))
                      }
                      onOpenDetails={setSelectedDocument}
                      onDownload={handleDownload}
                      downloading={downloadingId === document.id}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
      <SystemDocumentDetailModal
        document={selectedDocument}
        onClose={() => setSelectedDocument(null)}
        onDownload={handleDownload}
        downloading={downloadingId === selectedDocument?.id}
      />
      <OpenAlexPaperDetailModal
        paper={selectedPaper}
        onClose={() => setSelectedPaper(null)}
        onImport={handleImportPaper}
      />
    </div>
  );
}
