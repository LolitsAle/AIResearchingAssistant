import { BookmarkCheck, RefreshCw } from 'lucide-react';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'title_az', label: 'Title A-Z' },
  { value: 'title_za', label: 'Title Z-A' },
  { value: 'vote_highest', label: 'Vote highest' },
  { value: 'citation_highest', label: 'Citation highest' },
  { value: 'download_highest', label: 'Download highest' },
];

export default function SystemLibraryToolbar({ total, bookmarksOnly, onToggleBookmarksOnly, sort = 'newest', onSortChange, hasQuery }) {
  const options = hasQuery ? [...SORT_OPTIONS, { value: 'semantic_relevance', label: 'Semantic relevance' }] : SORT_OPTIONS;
  return (
    <div className="sl-toolbar">
      <div><strong>{total}</strong> tài liệu phù hợp</div>
      <div className="sl-toolbar__actions">
        <select value={sort} onChange={(event) => onSortChange?.(event.target.value)} aria-label="Sắp xếp tài liệu">
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <button type="button" className={`sl-toolbar-btn ${bookmarksOnly ? 'is-active' : ''}`} onClick={onToggleBookmarksOnly}>
          {bookmarksOnly ? <BookmarkCheck size={16} /> : <RefreshCw size={16} />} {bookmarksOnly ? 'Đang xem đã ghim' : 'Chỉ tài liệu đã ghim'}
        </button>
      </div>
    </div>
  );
}
