import { MessageSquare, GitCompare, Bookmark } from 'lucide-react';

export default function SystemLibraryToolbar({ total, selectedCount, bookmarksOnly, onToggleBookmarksOnly, onCreateCollection, onCompareSelected }) {
  return (
    <div className="sl-toolbar">
      <div>
        <strong>{total}</strong>
        <span> tài liệu phù hợp</span>
      </div>
      <div className="sl-toolbar__actions">
        <button type="button" className={`sl-toolbar-btn ${bookmarksOnly ? 'is-active' : ''}`} onClick={onToggleBookmarksOnly}>
          <Bookmark size={15} /> Tủ sách của tôi
        </button>
        <button type="button" className="sl-toolbar-btn" onClick={onCompareSelected} disabled={selectedCount < 2}>
          <GitCompare size={15} /> So sánh ({selectedCount})
        </button>
        <button type="button" className="sl-toolbar-btn sl-toolbar-btn--primary" onClick={onCreateCollection} disabled={selectedCount === 0}>
          <MessageSquare size={15} /> Tạo nhóm Chat RAG
        </button>
      </div>
    </div>
  );
}
